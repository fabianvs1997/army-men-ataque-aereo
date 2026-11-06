// Benchmark de la misión 2: simula la fase ESCOLTAR_BC con el campo de
// escombros saturado (320 piezas, como en la captura) y mide el coste de
// upd() por frame, con conteo de llamadas a cover.trace/move.
// Uso: node scripts/bench-mission2.cjs [saturate=0|1] [frames=600]
'use strict';
const { game, seeded } = require('../support/fake-host.cjs');
const Debris = require('../src/debris.js');

const saturate = process.argv[2] !== '0';
const FRAMES = Number(process.argv[3] || 600);

function setup() {
  const { app, state } = game(123);
  app.start(2, true);
  // Fase de la captura: pelotón en marcha de B a C, jugador cerca de C.
  state.mission.stage = 'ESCOLTAR_BC';
  const route = state.mission.rules.routeBC;
  state.mission.allies.forEach((a, i) => {
    if (a.wounded) return;
    a.state = 'MARCHANDO_A_C';
    a.waypoint = 2;
    a.x = route[2][0] + (i - 2) * 2;
    a.z = route[2][1] + (i % 2 ? 3 : -3);
  });
  state.P.x = route[3][0];
  state.P.z = route[3][1] - 12;
  state.P.yaw = 0;
  for (const e of state.E) e.cd = 0;
  // Contar llamadas de colisión.
  const cover = app.view.cover;
  const counts = { trace: 0, move: 0 };
  const origTrace = cover.trace, origMove = cover.move;
  cover.trace = (...args) => { counts.trace++; return origTrace(...args); };
  cover.move = (...args) => { counts.move++; return origMove(...args); };
  return { app, state, counts };
}

function saturateDebris(state) {
  const rand = seeded(7);
  const kinds = ['tank', 'tur', 'heli', 'inf', 'base'];
  for (let i = 0; i < 30; i++) {
    const k = kinds[i % kinds.length];
    Debris.emit(
      state,
      { k, x: -60 + (i % 10) * 14, y: 2, z: 100 + Math.floor(i / 10) * 12 },
      true,
      rand,
    );
  }
  // Asentar todos los escombros como en una partida larga.
  const groundAt = (x, z) => state.world.height(x, z);
  for (let i = 0; i < 600; i++) Debris.step(state, 1 / 60, groundAt);
  return state.DB.filter((p) => p.settled).length;
}

function run() {
  const { app, state, counts } = setup();
  const settled = saturate ? saturateDebris(state) : 0;
  app.fire = true;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < FRAMES; i++) app.upd(1 / 60);
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  console.log(JSON.stringify({
    saturate, frames: FRAMES,
    msPerFrame: +(ms / FRAMES).toFixed(3),
    totalMs: +ms.toFixed(1),
    DB: state.DB.length, settled,
    E: state.E.length, BL: state.BL.length, EB: state.EB.length,
    MS: state.MS.length, SM: state.SM.length, FX: state.FX.length,
    tracePerFrame: +(counts.trace / FRAMES).toFixed(1),
    movePerFrame: +(counts.move / FRAMES).toFixed(1),
    stage: state.mission.stage,
  }));
}
run();
