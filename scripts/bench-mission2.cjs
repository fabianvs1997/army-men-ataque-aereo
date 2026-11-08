// Benchmark de la misión 2: simula la fase ESCOLTAR_BC tras matar a
// los enemigos (antes el campo de escombros saturado, 320 piezas) y
// mide el coste de upd() por frame, con conteo de llamadas a
// cover.trace/move. Sin escombros, matar no debe degradar el frame.
// Uso: node scripts/bench-mission2.cjs [kills=0|1] [frames=600]
'use strict';
const { game } = require('../support/fake-host.cjs');

const withKills = process.argv[2] !== '0';
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

function killEnemies(app, state) {
  // Matar a todos los enemigos presentes: antes cada baja dejaba
  // piezas que se acumulaban en el camino; ahora no queda nada.
  let kills = 0;
  for (const e of [...state.E]) {
    if (app.combat.kill(e)) kills++;
  }
  state.E = state.E.filter((e) => !e.dead);
  return kills;
}

function run() {
  const { app, state, counts } = setup();
  const kills = withKills ? killEnemies(app, state) : 0;
  app.fire = true;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < FRAMES; i++) app.upd(1 / 60);
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  console.log(JSON.stringify({
    kills, frames: FRAMES,
    msPerFrame: +(ms / FRAMES).toFixed(3),
    totalMs: +ms.toFixed(1),
    DB: state.DB.length,
    E: state.E.length, BL: state.BL.length, EB: state.EB.length,
    MS: state.MS.length, SM: state.SM.length, FX: state.FX.length,
    tracePerFrame: +(counts.trace / FRAMES).toFixed(1),
    movePerFrame: +(counts.move / FRAMES).toFixed(1),
    stage: state.mission.stage,
  }));
}
run();
