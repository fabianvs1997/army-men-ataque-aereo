const test = require('node:test');
const assert = require('node:assert/strict');
const Maps = require('../src/mission-map.js');
const World = require('../src/toy-world.js');
const Collision = require('../src/collision.js');
const Escort = require('../src/escort-mission.js');
const { game } = require('../support/fake-host.cjs');

test('seed reproduces geometry; distinct seeds vary routes, objectives and scenery on a larger map', () => {
  assert.deepEqual(Maps.generate(123), Maps.generate(123));
  const a = Maps.generate(123),
    b = Maps.generate(124);
  assert.notDeepEqual(a.routes, b.routes);
  assert.notDeepEqual(a.rules.B, b.rules.B);
  assert.equal(a.limit * 2, 640);
  const wa = World.create(a),
    wb = World.create(b);
  assert.notDeepEqual(wa.shrubs, wb.shrubs);
  assert.notDeepEqual(wa.roads, wb.roads);
  assert.ok(wa.mesh().every(Number.isFinite));
});

test('generated routes stay connected, objectives distant, troops safe and escort traversable across seeds', () => {
  for (const seed of [0, 1, 2, 3, 17, 99, 123, 999, 12345, 0xffffffff]) {
    const map = Maps.generate(seed),
      world = World.create(map);
    assert.deepEqual(
      world.pads.map((p) => [p.x, p.z]),
      [map.rules.B, map.rules.A, map.rules.C].map((p) => [p.x, p.z]),
    );
    const m = new Escort.Mission(3, map.rules);
    const cover = Collision.create(
      { DC: world.shrubs, DB: [], mission: m },
      world,
    );
    for (const p of [m.rules.B, m.rules.C])
      assert.ok(Math.hypot(p.x, p.z) > 180);
    for (const route of map.routes) {
      for (let i = 1; i < route.length; i++) {
        const [ax, az] = route[i - 1],
          [bx, bz] = route[i];
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
        for (let j = 0; j <= steps; j++) {
          const x = ax + ((bx - ax) * j) / steps,
            z = az + ((bz - az) * j) / steps;
          assert.ok(world.canTravel(x, z, 4), `seed ${seed} blocked route`);
          assert.equal(
            cover.overlaps({ x, y: 8, z }, 1.8, 1.2),
            false,
            `seed ${seed} prop on route ${x},${z}`,
          );
        }
      }
    }
    assert.equal(m.enemyPlan.filter((e) => e.zone === 'AB').length, 8);
    assert.equal(
      m.enemyPlan.filter((e) => e.zone === 'BC' && e.k !== 'heli').length,
      8,
    );
    assert.equal(
      new Set(m.enemyPlan.map((e) => e.id)).size,
      m.enemyPlan.length,
    );
    for (const e of m.enemyPlan.filter((e) => e.id.startsWith('patrol-'))) {
      assert.ok(
        Math.hypot(e.x - m.rules.B.x, e.z - m.rules.B.z) >
          m.rules.perimeter + 10,
      );
      assert.ok(Math.hypot(e.x - m.rules.C.x, e.z - m.rules.C.z) > 45);
      assert.equal(
        cover.overlaps(
          { x: e.x, y: 2, z: e.z },
          e.k === 'tank' ? 3.5 : 1.5,
          1.3,
        ),
        false,
      );
    }
    for (const e of m.enemyPlan) {
      assert.ok(Math.hypot(e.x, e.z) >= m.rules.safeRadius + 4);
      assert.ok(world.canTravel(e.x, e.z, 4), `seed ${seed} enemy ${e.id}`);
    }
    const env = { groundAt: world.height, cover, enemies: [] };
    for (const a of m.allies.filter((a) => a.wounded))
      for (let i = 0; i < 40; i++) m.update(0.05, a, env);
    for (let i = 0; i < 2000 && m.stage !== 'COMPLETADA'; i++) {
      const before = m.allies.map((a) => ({ ...a }));
      m.update(0.05, m.finish, env);
      m.allies.forEach((a, j) => {
        if (!a.wounded)
          assert.ok(
            Math.hypot(a.x - before[j].x, a.z - before[j].z) <=
              m.rules.soldierSpeed * 0.05 * 1.1,
          );
      });
    }
    assert.equal(
      m.delivered,
      7,
      `seed ${seed}: ${m.allies.map((a) => a.cause || a.state)}`,
    );
    assert.equal(m.stage, 'COMPLETADA');
  }
});

test('retry keeps the map; new game and next mission regenerate without sharing world instances', () => {
  const a = game(12),
    b = game(13);
  a.app.start(1, true);
  b.app.start(1, true);
  const seed = a.state.mapSeed,
    roads = JSON.stringify(a.state.world.roads);
  const other = JSON.stringify(b.state.world.roads);
  a.app.start(1, true, true);
  assert.equal(a.state.mapSeed, seed);
  assert.equal(JSON.stringify(a.state.world.roads), roads);
  a.app.start(2, false);
  assert.notEqual(a.state.mapSeed, seed);
  assert.notEqual(JSON.stringify(a.state.world.roads), roads);
  assert.equal(JSON.stringify(b.state.world.roads), other);
  const next = a.state.mapSeed;
  a.app.start(1, true);
  assert.notEqual(a.state.mapSeed, next);
});
