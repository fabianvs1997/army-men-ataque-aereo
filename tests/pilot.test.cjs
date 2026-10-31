const test = require('node:test'),
  assert = require('node:assert/strict');
const { pilotMotion } = require('../src/game.js');
const { game } = require('../support/fake-host.cjs');
test('neutral jitter is ignored and reverse preserves heading at every orientation', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const p = { yaw };
    assert.deepEqual(pilotMotion(p, 0.05, 0.05, 0.1), {
      dx: 0,
      dz: 0,
      active: false,
    });
    assert.equal(p.yaw, yaw);
    const m = pilotMotion(p, 0, -1, 0.1);
    assert.ok(
      Math.abs(m.dx * Math.sin(yaw) + m.dz * Math.cos(yaw) + 2.8) < 1e-9,
    );
    assert.ok(
      Math.abs(Math.atan2(Math.sin(p.yaw - yaw), Math.cos(p.yaw - yaw))) < 1e-9,
    );
  }
});
test('diagonal input stays bounded and steering is independent of frame rate', () => {
  const run = (rate) => {
    const p = { yaw: 0, x: 0, z: 0 };
    for (let i = 0; i < rate; i++) {
      const m = pilotMotion(p, 1, 1, 1 / rate);
      assert.ok(Math.hypot(m.dx, m.dz) <= 28 / rate);
      p.x += m.dx;
      p.z += m.dz;
    }
    return p;
  };
  const a = run(30),
    b = run(120);
  assert.ok(Math.abs(a.yaw - b.yaw) < 1e-9);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.01);
});
test('opposite keys cancel without cancelling the other axis or fire', () => {
  const g = game();
  g.app.start(1, true);
  for (const key of ['w', 's', 'a', 'd', ' '])
    g.host.emit('keydown', { key, repeat: false, preventDefault() {} });
  assert.deepEqual(g.app.input.read(), {
    sx: 0,
    sy: 0,
    fire: true,
    missile: false,
  });
  g.host.emit('keyup', { key: 's' });
  assert.equal(g.app.input.read().sy, 1);
  assert.equal(g.app.input.read().sx, 0);
});
