const test = require('node:test'),
  assert = require('node:assert/strict');
const World = require('../src/toy-world.js');
const Collision = require('../src/collision.js');
const Missions = require('../src/toy-missions.js');
const { game } = require('../support/fake-host.cjs');
test('all distant rescues and the final pad are reachable along a long route', () => {
  const cover = Collision.create({ DC: World.shrubs, DB: [] }, World);
  const queue = [[0, 0]],
    seen = new Set(['0,0']),
    distances = new Map([['0,0', 0]]);
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        key = nx + ',' + nz;
      if (seen.has(key) || !World.canTravel(nx, nz, 1.8)) continue;
      const p = cover.move({ x, y: 8, z }, { x: nx, y: 8, z: nz });
      if (Math.hypot(p.x - nx, p.z - nz) > 0.01) continue;
      seen.add(key);
      distances.set(key, distances.get(x + ',' + z) + 2);
      queue.push([nx, nz]);
    }
  }
  const finish = Missions.layout.finish;
  const end = queue.filter(
    ([x, z]) => Math.hypot(x - finish.x, z - finish.z) < 3,
  );
  assert.ok(end.length > 0, 'finish is inaccessible');
  assert.ok(
    Math.min(...end.map(([x, z]) => distances.get(x + ',' + z))) > 350,
    'a shortcut bypasses the winding route',
  );
  for (let n = 1; n <= 3; n++)
    for (const a of new Missions.Mission(n).allies)
      assert.ok(
        queue.some(([x, z]) => Math.hypot(x - a.x, z - a.z) < 3),
        `unreachable rescue ${n}: ${a.x},${a.z}`,
      );
});
test('ridges stop helicopter movement and projectiles, including long sweeps', () => {
  const cover = Collision.create({ DC: [], DB: [] }, World);
  let ridge;
  for (let x = -180; x < 180 && !ridge; x += 4)
    for (let z = -180; z < 180; z += 4)
      if (World.height(x, z) > 20) {
        ridge = { x, y: 8, z };
        break;
      }
  const start = { x: 0, y: 8, z: 0 };
  const p = cover.move(start, ridge);
  assert.ok(World.canTravel(p.x, p.z, 1.8));
  assert.ok(Math.hypot(p.x - ridge.x, p.z - ridge.z) > 5);
  assert.ok(cover.trace(start, ridge));
});
test('campaign enemies spawn on the valley floor across deterministic seeds', () => {
  for (const seed of [1, 123, 98765]) {
    const { app, state } = game(seed);
    for (let n = 1; n <= 3; n++) {
      app.start(n, true);
      for (const e of state.E)
        assert.ok(World.canTravel(e.x, e.z), `${e.k} spawned on ridge`);
      assert.equal(state.E.filter((e) => e.k === 'base').length, n);
    }
  }
});
