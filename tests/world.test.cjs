const { test } = require('node:test');
const assert = require('node:assert/strict');
const world = require('../src/toy-world.js');
test('terrain remains below flight altitude and the helipad is flat', () => {
  let max = 0;
  for (let x = -200; x <= 200; x += 4)
    for (let z = -200; z <= 200; z += 4) {
      const y = world.height(x, z);
      assert.ok(y >= 0 && y < 5);
      max = Math.max(max, y);
    }
  assert.ok(max > 3);
  for (let x = -7; x <= 7; x++)
    for (let z = -7; z <= 7; z++) assert.equal(world.height(x, z), 0);
});
test('terrain mesh matches height queries with finite upward unit normals', () => {
  const mesh = world.mesh();
  assert.equal(mesh.length, 100 * 100 * 6 * 6);
  for (let i = 0; i < mesh.length; i += 6) {
    const [x, y, z, nx, ny, nz] = mesh.slice(i, i + 6);
    assert.ok(Math.abs(world.height(x, z) - y) < 1e-5);
    assert.ok(ny > 0);
    assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < 1e-5);
  }
  assert.deepEqual(world.mesh(), mesh);
});
test('road centers remain on the cleared ground and landmarks reserve spawn space', () => {
  for (const road of world.roads)
    assert.ok(world.height(road.x, road.z) < 0.12);
  for (const prop of world.landmarks)
    assert.equal(world.clearOfLandmarks(prop.x, prop.z, 10), false);
  assert.equal(world.clearOfLandmarks(0, -170, 10), true);
});
test('height sampling clamps outside the world and is continuous at cell boundaries', () => {
  assert.equal(world.height(220, 12), world.height(200, 12));
  for (let x = -196; x < 196; x += 4)
    assert.ok(
      Math.abs(world.height(x - 0.00001, 55) - world.height(x + 0.00001, 55)) <
        0.001,
    );
});
test('Canvas terrain fallback draws finite projected paths in portrait and landscape', () => {
  let points = 0,
    fills = 0;
  const ctx = {
    beginPath() {},
    closePath() {},
    fill() {
      fills++;
    },
    moveTo(x, y) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      points++;
    },
    lineTo(x, y) {
      this.moveTo(x, y);
    },
  };
  for (const [W, H, F] of [
    [390, 844, 390 / 105],
    [844, 390, 390 / 120],
  ])
    world.drawGround(
      ctx,
      (x, y, z) => [W / 2 - x * F, H / 2 + (z - y) * F],
      { x: 170, z: 170 },
      W,
      H,
      F,
    );
  assert.ok(points > 0 && fills > 0);
});

test('backyard parts are finite, bounded in count and share safe mission footprints', () => {
  assert.ok(world.yard.length > 200 && world.yard.length < 400);
  for (const p of world.yard) {
    assert.ok(['box', 'rounded', 'sphere'].includes(p.kind));
    for (const k of ['x', 'y', 'z', 'sx', 'sy', 'sz', 'yaw'])
      assert.ok(Number.isFinite(p[k]));
    assert.ok(p.sx > 0 && p.sy > 0 && p.sz > 0);
    assert.ok(p.color.every((c) => c >= 0 && c <= 1));
  }
  assert.equal(world.clearOfLandmarks(0, 180, 10), false);
  for (const c of require('../src/toy-missions.js').configs)
    for (const [x, z] of c.bases)
      assert.equal(world.clearOfLandmarks(x, z, 10), true);
});
test('natural shrubs leave the helipad, path and household landmarks clear', () => {
  assert.ok(world.shrubs.length > 10);
  for (const p of world.shrubs) {
    assert.ok(Math.hypot(p.x, p.z) > 24);
    assert.equal(world.clearOfLandmarks(p.x, p.z, 7), true);
    assert.ok(p.z < 156);
    assert.equal(p.t, 'shrub');
  }
});
