// Benchmark del congelamiento en la escolta B → C (misión 2).
// Reproduce el escenario que colgaba el juego: pelotón marchando hacia C
// con un muro en la ruta, más el coste de arrancar la misión. Antes el
// muro era de escombros (ya no existen: ningún enemigo deja restos), así
// que el muro ahora es de rocas del mundo, que sí bloquean.
// Uso: node scripts/bench-escort-freeze.cjs
// Imprime JSON: peor frame, llamadas a Navigation.path (total/máx) y
// coste de generar el mundo + la malla de terreno.
'use strict';
const { game } = require('../support/fake-host.cjs');
const Navigation = require('../src/escort-navigation.js');
const MissionMap = require('../src/mission-map.js');
const ToyWorld = require('../src/toy-world.js');

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function startCost() {
  let worst = 0;
  for (const seed of [1, 123, 999]) {
    const t0 = nowMs();
    const map = MissionMap.generate(seed);
    const world = ToyWorld.create(map);
    world.mesh();
    worst = Math.max(worst, nowMs() - t0);
  }
  return +worst.toFixed(1);
}

function wallScenario() {
  const { app, state } = game(123);
  app.start(2, true);
  const route = state.mission.rules.routeBC;
  const wx = route[4][0],
    wz = route[4][1];
  // Muro de rocas cruzando la ruta (antes era un muro de escombros en
  // state.DB; sin escombros, las rocas del mundo son el obstáculo).
  // Se reasigna state.DC para que Collision.rebuild() reindexe el mundo.
  for (let i = -8; i <= 8; i++) {
    state.world.rocks.push({
      x: wx + i * 1.2,
      z: wz,
      s: 2,
    });
  }
  state.DC = [...state.DC];
  state.mission.stage = 'ESCOLTAR_BC';
  state.mission.allies.forEach((a, i) => {
    if (a.wounded) return;
    a.state = 'MARCHANDO_A_C';
    a.waypoint = 4;
    a.x = wx - 6 + (i - 2) * 2;
    a.z = wz + (i % 2 ? 3 : -3);
    a.stuck = 0;
    a.repathCooldown = 0;
  });
  state.P.x = route[5][0];
  state.P.z = route[5][1] - 15;
  const orig = Navigation.path;
  const calls = [];
  Navigation.path = (...args) => {
    const t0 = nowMs();
    const r = orig(...args);
    calls.push(+(nowMs() - t0).toFixed(2));
    return r;
  };
  let worst = 0,
    frames = 0;
  try {
    for (let i = 0; i < 1800; i++) {
      const t0 = nowMs();
      app.upd(1 / 60);
      worst = Math.max(worst, nowMs() - t0);
      frames++;
      if (state.mission.stage === 'FRACASADA') break;
    }
  } finally {
    Navigation.path = orig;
  }
  return {
    frames,
    worstFrameMs: +worst.toFixed(1),
    pathCalls: calls.length,
    pathTotalMs: +calls.reduce((a, b) => a + b, 0).toFixed(1),
    pathMaxMs: calls.length ? Math.max(...calls) : 0,
    stage: state.mission.stage,
    waypoints: state.mission.allies
      .filter((a) => !a.wounded)
      .map((a) => a.waypoint),
  };
}

console.log(
  JSON.stringify({ startWorstMs: startCost(), ...wallScenario() }),
);
