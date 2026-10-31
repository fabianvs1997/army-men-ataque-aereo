const test = require('node:test'),
  assert = require('node:assert/strict');
const Collision = require('../src/collision.js');
const Combat = require('../src/combat.js');
const Missions = require('../src/toy-missions.js');
const World = require('../src/toy-world.js');
const wall = { kind: 'box', x: 5, y: 5, z: 0, sx: 0.25, sy: 5, sz: 8, yaw: 0 };
function fixture(objects = [wall]) {
  const state = {
    st: 'play',
    DC: [],
    DB: [],
    E: [],
    BL: [],
    EB: [],
    MS: [],
    FX: [],
    PK: [],
    P: { x: 10, y: 5, z: 0, sc: 0 },
    bd: 0,
  };
  const world = {
    yard: objects,
    rocks: [],
    height: () => 0,
    clearOfLandmarks: () => true,
  };
  const cover = Collision.create(state, world);
  let damage = 0;
  const combat = Combat.create({
    ...state,
    state,
    cover,
    ToyMissions: Missions,
    groundAt: world.height,
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
    sfx: {},
    buzz() {},
    hurt() {
      damage++;
    },
  });
  return { state, cover, combat, damage: () => damage };
}
const bullet = () => ({ x: 0, y: 5, z: 0, vx: 1000, vy: 0, vz: 0, l: 1 });
const enemy = (x) => ({ k: 'heli', x, y: 5, z: 0, r: 0.5, hp: 6, p: 10 });
test('swept box and rotated geometry stop fast rounds; spheres do not block empty corners', () => {
  assert.equal(
    Collision.segment({ x: 0, y: 5, z: 0 }, { x: 20, y: 5, z: 0 }, wall),
    0.2375,
  );
  assert.notEqual(
    Collision.segment(
      { x: 0, y: 5, z: 0 },
      { x: 20, y: 5, z: 0 },
      { ...wall, yaw: Math.PI / 4 },
    ),
    null,
  );
  const sphere = { kind: 'sphere', x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1 };
  assert.equal(
    Collision.segment(
      { x: 0.9, y: 0.9, z: -2 },
      { x: 0.9, y: 0.9, z: 2 },
      sphere,
    ),
    null,
  );
  assert.equal(
    Collision.segment({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, sphere),
    0,
  );
});
test('player and enemy bullets stop at the first cover, but hit a target before cover', () => {
  for (const enemyShot of [true, false]) {
    const f = fixture();
    const target = enemy(10);
    f.state.E.push(target);
    (enemyShot ? f.state.EB : f.state.BL).push(bullet());
    f.combat.stepProjectiles(0.02);
    assert.equal(target.hp, 6);
    assert.equal(f.damage(), 0);
    assert.equal((enemyShot ? f.state.EB : f.state.BL)[0].l, 0);
  }
  const f = fixture([{ ...wall, x: 15 }]);
  const e = enemy(10);
  f.state.E.push(e);
  f.state.BL.push(bullet());
  f.combat.stepProjectiles(0.02);
  assert.equal(e.hp, 5);
  const g = fixture([{ ...wall, x: 15 }]);
  g.state.EB.push(bullet());
  g.combat.stepProjectiles(0.02);
  assert.equal(g.damage(), 1);
});
test('missiles collide with cover and splash cannot damage enemies on the other side', () => {
  const f = fixture(),
    front = enemy(1),
    behind = enemy(8);
  f.state.E.push(front, behind);
  f.state.MS.push({ x: 4, y: 5, z: 0, vx: 0, vz: 0, l: 0.01 });
  f.combat.stepProjectiles(0.02);
  assert.equal(front.dead, 1);
  assert.equal(behind.hp, 6);
  const g = fixture();
  g.state.MS.push({ x: 0, y: 5, z: 0, vx: 1000, vz: 0, l: 2 });
  g.combat.stepProjectiles(0.02);
  assert.equal(g.state.MS[0].l, 0);
  assert.ok(Math.abs(g.state.MS[0].x - 4.75) < 1e-8);
});
test('movement sweeps and slides, respects height, and can escape an initial overlap', () => {
  const f = fixture([{ ...wall, x: 0 }]);
  const end = f.cover.move({ x: -5, y: 5, z: -5 }, { x: 20, y: 5, z: 5 }, 1, 1);
  assert.ok(end.x < -1.25);
  assert.equal(end.z, 5);
  assert.equal(
    f.cover.move({ x: -5, y: 20, z: 0 }, { x: 20, y: 20, z: 0 }, 1, 1).x,
    20,
  );
  assert.ok(
    f.cover.move({ x: 0, y: 5, z: 0 }, { x: 4, y: 5, z: 0 }, 1, 1).x > 0,
  );
});
test('every yard part, rocks, shrubs and wreckage participates in collision', () => {
  const state = { DC: World.shrubs, DB: [] },
    c = Collision.create(state, World);
  for (const p of World.yard) assert.ok(c.overlaps(p, 0.01, 0.01));
  for (const r of World.rocks)
    assert.ok(
      c.overlaps(
        { x: r.x, y: World.height(r.x, r.z) + r.s * 0.45, z: r.z },
        0.01,
        0.01,
      ),
    );
  for (const d of World.shrubs)
    assert.ok(
      c.overlaps(
        { x: d.x, y: World.height(d.x, d.z) + d.s * 0.65, z: d.z },
        0.01,
        0.01,
      ),
    );
  const f = fixture([]);
  f.state.DB.push({ ...wall });
  assert.ok(f.cover.trace({ x: 0, y: 5, z: 0 }, { x: 10, y: 5, z: 0 }));
});
test('hidden rescue-area vegetation has no invisible collider; terrain stops low shots', () => {
  const state = {
    DC: [{ t: 'shrub', x: 0, z: 0, s: 3 }],
    mission: { rescued: 0, allies: [{ x: 0, z: 0, state: 'waiting' }] },
  };
  const world = {
    yard: [],
    rocks: [],
    height: () => 0,
    clearOfLandmarks: () => true,
  };
  const c = Collision.create(state, world);
  assert.equal(c.overlaps({ x: 0, y: 3, z: 0 }, 0.01, 0.01), false);
  state.mission.rescued = 1;
  state.mission.allies[0].state = 'rescued';
  assert.equal(c.overlaps({ x: 0, y: 3, z: 0 }, 0.01, 0.01), true);
  const hill = Collision.create(
    { DC: [] },
    { ...world, height: (x) => (x > 4 && x < 7 ? 6 : 0) },
  );
  assert.ok(hill.trace({ x: 0, y: 4, z: 0 }, { x: 10, y: 4, z: 0 }));
});
test('touching an obstacle cannot tunnel through it on a subsequent long movement', () => {
  const f = fixture([{ ...wall, x: 0 }]);
  const p = { x: -1.25, y: 5, z: 0 };
  const next = f.cover.move(p, { x: 50, y: 5, z: 0 }, 1, 1);
  assert.equal(next.x, p.x);
  assert.ok(f.cover.move(p, { x: -5, y: 5, z: 0 }, 1, 1).x < p.x);
});
test('all campaign rescue points and helipad remain reachable at flight height', () => {
  const { game } = require('../support/fake-host.cjs');
  for (let n = 1; n <= 3; n++) {
    const { app, state } = game();
    app.start(n, true);
    for (const p of [{ x: 0, z: 0 }, ...state.mission.allies])
      assert.equal(
        app.view.cover.overlaps({ x: p.x, y: 8, z: p.z }),
        false,
        `mission ${n} rescue ${p.x},${p.z}`,
      );
    for (const e of state.E)
      assert.equal(
        app.view.cover.overlaps(
          {
            x: e.x,
            y: e.k === 'heli' ? 8 : app.view.groundAt(e.x, e.z) + 2,
            z: e.z,
          },
          e.k === 'base' ? 6 : e.k === 'inf' ? 0.7 : e.r,
          e.k === 'base' ? 2.5 : 1.3,
        ),
        false,
        `mission ${n} spawn ${e.k}`,
      );
  }
});
