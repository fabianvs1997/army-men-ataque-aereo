const test = require('node:test'),
  assert = require('node:assert/strict');
const { game } = require('../support/fake-host.cjs');
const { layout } = require('../src/toy-missions.js');
test('mission start and retry preload the entire air squadron outside the departure zone', () => {
  for (const seed of [1, 17, 123]) {
    const { app, state } = game(seed);
    for (let n = 1; n <= 3; n++)
      for (let retry = 0; retry < 2; retry++) {
        app.start(n, true);
        const air = state.E.filter((e) => e.k === 'heli');
        assert.equal(air.length, state.mission.config.air);
        for (const e of air) {
          assert.equal(e.y, 8);
          assert.ok(
            Math.hypot(
              e.x - state.mission.start.x,
              e.z - state.mission.start.z,
            ) -
              e.r >=
              layout.minEnemyDistance,
          );
        }
      }
  }
});
test('simulation never adds helicopters or replaces destroyed ones after old timer deadlines', () => {
  for (let n = 1; n <= 3; n++) {
    const { app, state } = game(n);
    app.start(n, true);
    const initial = new Set(state.E),
      air = state.E.filter((e) => e.k === 'heli');
    // Los coches de la Misión 2 sí aparecen durante la partida: los
    // sueltan los garajes Tan vivos (no son helicópteros nuevos ni
    // reemplazos de los destruidos).
    const isNewCar = (e) => e.k === 'car' && !initial.has(e);
    for (let i = 0; i < 700; i++) {
      state.P.inv = 100;
      app.upd(0.05);
      assert.equal(state.st, 'play');
      assert.ok(
        state.E.every((e) => initial.has(e) || isNewCar(e)),
        'new enemy appeared',
      );
    }
    for (const e of air) app.combat.kill(e);
    for (let i = 0; i < 1400; i++) {
      state.P.inv = 100;
      app.upd(0.05);
    }
    assert.equal(state.st, 'play');
    assert.equal(state.E.filter((e) => e.k === 'heli' && !e.dead).length, 0);
    assert.ok(state.E.every((e) => initial.has(e) || isNewCar(e)));
  }
});
