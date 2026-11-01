const test = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('../support/fake-host.cjs');
const World = require('../src/toy-world.js');
const { layout } = require('../src/toy-missions.js');
const distance = (e) => Math.hypot(e.x - layout.start.x, e.z - layout.start.z);
test('all three missions and retries keep every enemy outside the departure buffer', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { app, state } = game(seed);
    for (let n = 1; n <= 3; n++)
      for (let retry = 0; retry < 2; retry++) {
        app.start(n, true);
        const config = state.mission.config;
        assert.equal(
          state.E.length,
          config.bases.length + config.tanks + config.turrets + config.infantry,
        );
        for (const e of state.E) {
          assert.ok(distance(e) - e.r >= layout.minEnemyDistance - 1e-9, e.k);
          assert.ok(World.canTravel(e.x, e.z));
        }
      }
  }
});
test('near-start spawn requests and timed air reinforcements obey the same buffer', () => {
  for (const seed of [1, 31, 77]) {
    const { app, state } = game(seed);
    app.start(3, true);
    for (const k of ['base', 'tank', 'tur', 'inf', 'heli']) {
      const e = app.spawnE(k, layout.start.x, layout.start.z);
      assert.ok(e);
      assert.ok(distance(e) - e.r >= layout.minEnemyDistance - 1e-9);
    }
    state.E = state.E.filter((e) => e.k !== 'heli');
    state.hs = 0;
    app.upd(0.01);
    const air = state.E.filter((e) => e.k === 'heli');
    assert.equal(air.length, 1);
    assert.ok(distance(air[0]) >= layout.minEnemyDistance);
  }
});
test('no valid terrain cancels the spawn instead of using an unsafe fallback', () => {
  const { app, state } = game();
  app.start(1, true);
  const original = World.canTravel,
    count = state.E.length;
  try {
    World.canTravel = () => false;
    assert.equal(app.spawnE('inf', 0, 0), null);
    assert.equal(state.E.length, count);
    const air = state.airLeft;
    state.hs = 0;
    app.upd(0.01);
    assert.equal(
      state.airLeft,
      air,
      'failed reinforcement should remain available',
    );
    assert.equal(state.E.length, count);
  } finally {
    World.canTravel = original;
  }
});
