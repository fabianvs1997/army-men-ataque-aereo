const test = require('node:test'),
  assert = require('node:assert/strict');
const Model = require('../src/toy-helicopter.js');
test('shared gunship parts are finite, bounded and valid for both renderers', () => {
  for (const angle of [0, 0.5, Math.PI, 1e5]) {
    const parts = Model.parts(angle);
    assert.ok(parts.length < 130);
    for (const p of parts) {
      assert.ok(['box', 'rounded', 'sphere'].includes(p.kind));
      for (const k of ['x', 'y', 'z', 'sx', 'sy', 'sz', 'yaw'])
        assert.ok(Number.isFinite(p[k]));
      assert.ok(p.sx > 0 && p.sy > 0 && p.sz > 0);
      assert.ok(p.color.every((v) => v >= 0 && v <= 1));
      assert.ok(Math.hypot(p.x, p.z) < 10);
    }
  }
});
test('rotor and damage flash do not mutate the permanent player geometry', () => {
  const before = JSON.stringify(Model.parts(0));
  Model.parts(1, true);
  Model.parts(2);
  assert.equal(JSON.stringify(Model.parts(0)), before);
  const a = Model.parts(0),
    b = Model.parts(Math.PI / 2);
  assert.notDeepEqual(a, b);
  assert.deepEqual(a.slice(0, -8), b.slice(0, -8));
});
