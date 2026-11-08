// Bench de la Misión 1 «Plastic Pandemonium» (vídeo del original):
// mide la simulación completa de M1 con sus reglas nuevas (sin
// escolta ni heridos): combate junto a la caja (tanques guardándola,
// infantería en grupos, jeep Tan) y vuelo hacia el portal, con
// desglose por frame (media/p50/p95/p99/peor, frames >16,7 y >33 ms)
// y contadores de trace/move/A* y de sólidos de colisión.
// Uso: node scripts/bench-mision1-video.cjs [frames=1200]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { game } = require('../support/fake-host.cjs');
const Navigation = require('../src/escort-navigation.js');

const FRAMES = Number(process.argv[2] || 1200);

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return +sorted[i].toFixed(3);
}

function stats(times) {
  const s = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
  return {
    frames: times.length,
    avgMs: +avg.toFixed(3),
    p50Ms: quantile(s, 0.5),
    p95Ms: quantile(s, 0.95),
    p99Ms: quantile(s, 0.99),
    maxMs: +(s[s.length - 1] || 0).toFixed(3),
    over16: times.filter((t) => t > 16.7).length,
    over33: times.filter((t) => t > 33).length,
  };
}

// Tris de los modelos Blender (assets/blender/*-stats.json); la
// infantería y las torretas son procedurales (estimación: 12 tris
// por pieza dibujada). El terreno es constante entre versiones.
const MODEL_TRIS = { heli: 3540, tank: 1680, jeep: 1084, caja: 172 };
try {
  for (const [key, file] of [
    ['heli', 'helicoptero-stats.json'],
    ['tank', 'tanque-stats.json'],
    ['jeep', 'jeep-stats.json'],
    ['caja', 'caja-stats.json'],
  ]) {
    const p = path.join(__dirname, '..', 'assets', 'blender', file);
    if (fs.existsSync(p))
      MODEL_TRIS[key] = JSON.parse(fs.readFileSync(p, 'utf8')).tris;
  }
} catch (e) {
  /* sin stats en disco: usar los valores de arriba */
}
const PROC_TRIS = { inf: 84, tur: 200, base: 120 };

function run() {
  const tStart = nowMs();
  const { app, state } = game(123);
  app.start(1, true);
  const startMs = +(nowMs() - tStart).toFixed(1);

  const view = app.view || {};
  const world = view.world || view.toyWorld || state.world || null;
  const cover = view.cover;

  const byKind = {};
  for (const e of state.E) byKind[e.k] = (byKind[e.k] || 0) + 1;
  const dcByType = {};
  for (const d of state.DC || []) dcByType[d.t] = (dcByType[d.t] || 0) + 1;
  // Sólidos de colisión: el patio (yard) va tal cual, cada roca son
  // 2 esferas y cada decoración 1-3 sólidos (ver src/collision.js).
  const dcSolids = (state.DC || []).reduce(
    (n, d) => n + (d.t === 'pine' || d.t === 't' ? 3 : d.t === 'shrub' ? 2 : 1),
    0,
  );
  const yard = world ? world.yard.length : 0;
  const rocks = world ? world.rocks.length : 0;
  const solids = yard + rocks * 2 + dcSolids;
  const terrainTris = world
    ? ((world.limit * 2) / 4) ** 2 * 2
    : 0;
  // Tris de modelos en la escena de combate (enemigos vivos + heli
  // + caja): lo que varía entre la M1 vieja y la del vídeo.
  let modelTris = MODEL_TRIS.heli + MODEL_TRIS.caja;
  for (const e of state.E)
    modelTris += MODEL_TRIS[e.k] || PROC_TRIS[e.k] || 0;

  const s = {
    traceCalls: 0,
    traceMs: 0,
    traceMaxMs: 0,
    moveCalls: 0,
    moveMs: 0,
    moveMaxMs: 0,
    pathCalls: 0,
    pathMs: 0,
    pathMaxMs: 0,
  };
  if (cover) {
    const origTrace = cover.trace.bind(cover);
    cover.trace = (a, b, r, h) => {
      s.traceCalls++;
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
      const ms = nowMs() - t0;
      s.moveMs += ms;
      if (ms > s.moveMaxMs) s.moveMaxMs = +ms.toFixed(2);
      return out;
    };
  }
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

  function measure(frames) {
    const times = [];
    for (let i = 0; i < frames; i++) {
      const t0 = nowMs();
      app.upd(1 / 60);
      times.push(nowMs() - t0);
    }
    return stats(times);
  }

  // Calentamiento (JIT): no se mide.
  state.P.x = 0;
  state.P.z = 0;
  measure(120);
  const base = { ...s };
  const snap = (o) => ({
    traceCalls: o.traceCalls - base.traceCalls,
    traceMs: +(o.traceMs - base.traceMs).toFixed(1),
    traceMaxMs: o.traceMaxMs,
    moveCalls: o.moveCalls - base.moveCalls,
    moveMs: +(o.moveMs - base.moveMs).toFixed(1),
    moveMaxMs: o.moveMaxMs,
    pathCalls: o.pathCalls - base.pathCalls,
    pathMs: +(o.pathMs - base.pathMs).toFixed(1),
    pathMaxMs: o.pathMaxMs,
  });

  // Fase 1: combate junto a la caja (tanques guardándola).
  state.P.x = -170;
  state.P.z = 120;
  state.P.yaw = Math.PI;
  for (const e of state.E) e.cd = 0;
  app.fire = true;
  const combate = measure(FRAMES);
  const combateIO = snap(s);
  const aliveAfterCombat = state.E.filter((e) => !e.dead).length;

  // Fase 2: vuelo hacia el portal con la caja (sin disparar).
  state.P.x = -60;
  state.P.z = 120;
  state.P.yaw = Math.PI / 2;
  app.fire = false;
  const vuelo = measure(600);
  const vueloIO = snap(s);
  for (const k of ['traceCalls', 'moveCalls', 'pathCalls']) {
    vueloIO[k] -= combateIO[k];
  }
  vueloIO.traceMs = +(vueloIO.traceMs - combateIO.traceMs).toFixed(1);
  vueloIO.moveMs = +(vueloIO.moveMs - combateIO.moveMs).toFixed(1);
  vueloIO.pathMs = +(vueloIO.pathMs - combateIO.pathMs).toFixed(1);

  console.log(
    JSON.stringify(
      {
        mission: 1,
        startMs,
        stage: state.mission.stage,
        allies: (state.mission.allies || []).length,
        noEscort: !!state.mission.rules?.noEscort,
        enemies: { total: state.E.length, byKind },
        enemiesAliveAfterCombat: aliveAfterCombat,
        dc: { total: (state.DC || []).length, byType: dcByType },
        world: world
          ? {
              yard,
              rocks,
              shrubs: world.shrubs.length,
              mountains: (world.mountains || []).length,
              defenses: (world.defenses || []).length,
              solidsEstimate: solids,
              terrainTris,
            }
          : null,
        modelTrisEstimate: modelTris,
        combate: { ...combate, ...combateIO },
        vuelo: { ...vuelo, ...vueloIO },
      },
      null,
      1,
    ),
  );
}

run();
