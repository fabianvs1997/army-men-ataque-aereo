// Rendimiento de la Misión 1 «Plastic Pandemonium» (vídeo del original):
// presupuestos medidos con scripts/bench-mision1-video.cjs (Node,
// combate junto a la caja con todos los enemigos vivos, 1.200 frames).
// Medido 2026-11-08: combate 0,28-0,31 ms/frame de media (p50 0,12,
// p95 0,25-0,29) con la colisión optimizada (src/collision.js sin
// allocations); sin optimizar era 0,35-0,43 ms/frame. Los picos de
// 45-65 ms cada ~400 frames son pausas de GC de Node, preexistentes
// en Master (también 7-11 frames >33 ms por cada 1.200 en 7a9af91):
// el test no los acota porque dependen del GC del entorno, no del
// juego; lo visual y los FPS en iPhone los confirma Fabian.
// Los conteos (enemigos, sólidos, tris) son deterministas y sí se
// acotan: si la Misión 1 crece en enemigos o colisiones, este test
// avisa antes de que la sim se degrade.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('../support/fake-host.cjs');
const Navigation = require('../src/escort-navigation.js');

test('M1 del vídeo: composición de enemigos y presupuestos de sim', () => {
  const { app, state } = game(123);
  app.start(1, true);
  const byKind = {};
  for (const e of state.E) byKind[e.k] = (byKind[e.k] || 0) + 1;
  // Del vídeo: 3 tanques guardando la caja, 1 jeep/camión Tan al
  // norte, infantería en grupos junto al camino y al puesto, y
  // ningún helicóptero Tan.
  assert.equal(state.E.length, 30);
  assert.equal(byKind.tank, 6);
  assert.equal(byKind.inf, 19);
  assert.equal(byKind.tur, 4);
  assert.equal(byKind.jeep, 1);
  assert.equal(byKind.heli || 0, 0);
  // Sin escolta ni heridos en M1: el pelotón no existe y A* no se
  // usa (presupuesto de pathfinding: 0 llamadas, sin congelamientos).
  assert.equal((state.mission.allies || []).length, 0);
  assert.equal(state.mission.rules?.noEscort, true);

  const world = app.view.world || app.view.toyWorld || state.world;
  if (world) {
    const dcSolids = (state.DC || []).reduce(
      (n, d) =>
        n + (d.t === 'pine' || d.t === 't' ? 3 : d.t === 'shrub' ? 2 : 1),
      0,
    );
    const solids =
      world.yard.length + world.rocks.length * 2 + dcSolids;
    // La base verde no añade sólidos nuevos frente a Master
    // (2.018 medidos): si sube, la colisión por frame sube con ella.
    assert.ok(solids <= 2100, 'sólidos de colisión: ' + solids);
  }

  // Contadores de trace/move/A* durante el combate (1200 frames).
  const cover = app.view.cover;
  const counts = { trace: 0, move: 0, path: 0 };
  const origTrace = cover.trace.bind(cover);
  cover.trace = (...args) => {
    counts.trace++;
    return origTrace(...args);
  };
  const origMove = cover.move.bind(cover);
  cover.move = (...args) => {
    counts.move++;
    return origMove(...args);
  };
  const origPath = Navigation.path;
  Navigation.path = (...args) => {
    counts.path++;
    return origPath(...args);
  };
  try {
    state.P.x = -170;
    state.P.z = 120;
    state.P.yaw = Math.PI;
    for (const e of state.E) e.cd = 0;
    app.fire = true;
    for (let i = 0; i < 120; i++) app.upd(1 / 60);
    // Los contadores solo cubren los 600 frames medidos, no el
    // calentamiento (JIT) previo.
    counts.trace = 0;
    counts.move = 0;
    counts.path = 0;
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 600; i++) app.upd(1 / 60);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const avg = ms / 600;
    // move() se llama una vez por enemigo vivo y por frame (30) más
    // el jugador; trace() son las líneas de visión enemigas.
    assert.ok(
      counts.move / 600 <= 35,
      'move/frame: ' + (counts.move / 600).toFixed(1),
    );
    assert.ok(
      counts.trace / 600 < 20,
      'trace/frame: ' + (counts.trace / 600).toFixed(1),
    );
    assert.equal(counts.path, 0);
    // Margen amplio (medido 0,28-0,97 ms/frame según la carga del
    // entorno): solo caza regresiones graves, no ruido de GC.
    assert.ok(avg < 3, 'media ms/frame en combate M1: ' + avg.toFixed(3));
  } finally {
    Navigation.path = origPath;
  }
});
