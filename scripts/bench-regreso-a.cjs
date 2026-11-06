// Bench instrumentado del congelamiento de la MISIÓN 1 (dos variantes).
// Variante 1: liberar B, limpiar hasta C, NO embarcar heridos, volver a A.
// Variante 2: embarcar heridos, ir a C, NO entregarlos (disparando en C),
// volver a A con los heridos a bordo.
// Mide por tramo: peor frame de app.upd con desglose (trace / A* / resto),
// y el peor trace individual (longitud del segmento).
// Uso: node scripts/bench-regreso-a.cjs
'use strict';
const { game } = require('../support/fake-host.cjs');
const Navigation = require('../src/escort-navigation.js');

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function instrument(app, state) {
  const cover = app.view.cover;
  const s = {
    traceCalls: 0,
    traceMs: 0,
    traceMaxMs: 0,
    traceMaxLen: 0,
    moveCalls: 0,
    moveMs: 0,
    pathCalls: 0,
    pathMs: 0,
    pathMaxMs: 0,
    missionMs: 0,
  };
  const origTrace = cover.trace.bind(cover);
  cover.trace = (a, b, r, h) => {
    s.traceCalls++;
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (len > s.traceMaxLen) s.traceMaxLen = +len.toFixed(0);
    const t0 = nowMs();
    const out = origTrace(a, b, r, h);
    const ms = nowMs() - t0;
    s.traceMs += ms;
    if (ms > s.traceMaxMs) s.traceMaxMs = +ms.toFixed(2);
    return out;
  };
  const origMove = cover.move.bind(cover);
  cover.move = (a, b, r, h) => {
    s.moveCalls++;
    const t0 = nowMs();
    const out = origMove(a, b, r, h);
    s.moveMs += nowMs() - t0;
    return out;
  };
  const origPath = Navigation.path;
  Navigation.path = (...args) => {
    s.pathCalls++;
    const t0 = nowMs();
    const out = origPath(...args);
    const ms = nowMs() - t0;
    s.pathMs += ms;
    if (ms > s.pathMaxMs) s.pathMaxMs = +ms.toFixed(2);
    return out;
  };
  const m = state.mission;
  const origUpdate = m.update.bind(m);
  m.update = (...args) => {
    const t0 = nowMs();
    const out = origUpdate(...args);
    s.missionMs += nowMs() - t0;
    return out;
  };
  return {
    stats: s,
    restore() {
      Navigation.path = origPath;
    },
    snapshot() {
      return { ...s };
    },
  };
}

function diff(a, b) {
  const o = {};
  for (const k of Object.keys(a)) o[k] = +(b[k] - a[k]).toFixed(2);
  o.traceMaxMs = b.traceMaxMs;
  o.traceMaxLen = b.traceMaxLen;
  o.pathMaxMs = b.pathMaxMs;
  return o;
}

function run(mission, seed, variant) {
  const { app, state } = game(seed);
  app.start(mission, true);
  const m = state.mission;
  const ins = instrument(app, state);
  const legs = [];
  let stageAfterBoard = null;
  let boarded = 0;
  let worst = { ms: 0, leg: '', traceMs: 0, pathMs: 0, missionMs: 0 };

  function step(dt) {
    const before = ins.snapshot();
    const t0 = nowMs();
    app.upd(dt);
    const ms = nowMs() - t0;
    const after = ins.snapshot();
    if (ms > worst.ms)
      worst = {
        ms: +ms.toFixed(1),
        leg: currentLeg,
        traceMs: +(after.traceMs - before.traceMs).toFixed(2),
        pathMs: +(after.pathMs - before.pathMs).toFixed(2),
        missionMs: +(after.missionMs - before.missionMs).toFixed(2),
        traceCalls: after.traceCalls - before.traceCalls,
      };
    return ms;
  }
  let currentLeg = '';
  function flyTo(x, z, label, speed = 28) {
    currentLeg = label;
    const before = ins.snapshot();
    let frames = 0;
    let w = 0;
    for (;;) {
      const dx = x - state.P.x;
      const dz = z - state.P.z;
      const d = Math.hypot(dx, dz);
      if (d < 1 || frames > 30000) break;
      const st = Math.min(d, speed / 60);
      state.P.x += (dx / d) * st;
      state.P.z += (dz / d) * st;
      state.P.arm = 10;
      state.P.inv = 0;
      w = Math.max(w, step(1 / 60));
      frames++;
    }
    legs.push({
      label,
      frames,
      worstFrameMs: +w.toFixed(1),
      stage: m.stage,
      ...diff(before, ins.snapshot()),
    });
  }
  function idle(frames, label, setup) {
    currentLeg = label;
    const before = ins.snapshot();
    let w = 0;
    for (let i = 0; i < frames; i++) {
      if (setup) setup(i);
      // No morir durante la medición sin marcar "dañado" (eso bloquearía
      // embarque/entrega): se repone el blindaje en vez de usar inv.
      state.P.arm = 10;
      state.P.inv = 0;
      w = Math.max(w, step(1 / 60));
    }
    legs.push({
      label,
      frames,
      worstFrameMs: +w.toFixed(1),
      stage: m.stage,
      ...diff(before, ins.snapshot()),
    });
  }

  // Ir a B y despejar la amenaza (sin embarcar todavía).
  flyTo(m.rules.B.x, m.rules.B.z, 'A->B');
  for (const e of m.threats(state.E)) app.combat.kill(e);
  state.EB = [];
  idle(30, 'despeje-B');
  const stageAfterB = m.stage;
  // Las patrullas de AB persiguen al jugador y pueden volver a entrar en
  // el perímetro de B durante el embarque (ahí el juego bloquea el
  // abordaje por diseño). Para medir la variante 2, se despeja del todo.
  function clearThreats() {
    for (let i = 0; i < 20 && m.threats(state.E).length; i++) {
      for (const e of m.threats(state.E)) app.combat.kill(e);
      state.EB = [];
      for (let j = 0; j < 10; j++) step(1 / 60);
    }
  }

  if (variant === 1) {
    // Limpiar hasta el final: matar enemigos de zona BC al llegar a C.
    flyTo(m.finish.x, m.finish.z, 'B->C');
    for (const e of [...state.E].filter((e) => e.zone === 'BC'))
      app.combat.kill(e);
    state.EB = [];
    idle(120, 'asentar-C');
    // Volver a A sin heridos: quedan vivas las patrullas de AB.
    flyTo(m.start.x, m.start.z, 'C->A');
    idle(600, 'merodeo-A');
  } else {
    // Embarcar a los 3 heridos.
    clearThreats();
    for (const a of m.allies.filter((a) => a.wounded)) {
      state.P.x = a.x;
      state.P.z = a.z;
      state.P.arm = 10;
      state.P.inv = 0;
      currentLeg = 'embarque';
      for (let i = 0; i < 40; i++) {
        state.P.arm = 10;
        state.P.inv = 0;
        step(0.05);
      }
    }
    stageAfterBoard = m.stage;
    boarded = m.rescued;
    // Ir a C con el pelotón marchando; limpiar la zona BC.
    flyTo(m.finish.x, m.finish.z, 'B->C');
    for (const e of [...state.E].filter((e) => e.zone === 'BC'))
      app.combat.kill(e);
    state.EB = [];
    // En C, sin entregar: seguir disparando (no estable → no hay entrega).
    app.view.fire = true;
    idle(600, 'en-C-disparando');
    app.view.fire = false;
    // Volver a A con los heridos a bordo.
    flyTo(m.start.x, m.start.z, 'C->A');
    idle(600, 'merodeo-A');
    legs.stageAfterBoard = stageAfterBoard;
  }
  ins.restore();
  return {
    mission,
    seed,
    variant,
    stageAfterB,
    stageAfterBoard,
    boarded,
    stageFinal: m.stage,
    gameState: state.st,
    debris: state.DB.length,
    enemiesLeft: state.E.length,
    worstFrame: worst,
    legs,
  };
}

const out = [];
for (const seed of [1, 123, 999, 2026, 7, 42])
  out.push(run(1, seed, 1));
for (const seed of [1, 123, 999, 2026])
  out.push(run(1, seed, 2));
console.log(JSON.stringify(out, null, 1));
