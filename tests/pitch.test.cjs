const test = require('node:test'),
  assert = require('node:assert/strict');
const { updatePitch } = require('../src/game.js');
const { game } = require('../support/fake-host.cjs');
function advance(p, seconds, speed, rate = 60) {
  for (let i = 0; i < seconds * rate; i++)
    updatePitch(p, 0, (speed * 28) / rate, 1 / rate);
}
test('nose lowers during travel, rises under braking, then returns to level', () => {
  const p = { yaw: 0 };
  advance(p, 1, 1);
  assert.ok(p.pitch > 0.3 && p.pitch <= 0.4);
  advance(p, 0.2, 0);
  assert.ok(p.pitch < -0.05);
  advance(p, 3, 0);
  assert.ok(Math.abs(p.pitch) < 0.001);
  assert.equal(p.yaw, 0);
});
test('pitch is signed relative to heading, bounded and stable across frame rates', () => {
  const backward = { yaw: 0 };
  advance(backward, 1, -1);
  assert.ok(backward.pitch < -0.25);
  const a = { yaw: 0 },
    b = { yaw: 0 };
  advance(a, 1, 1, 30);
  advance(b, 1, 1, 120);
  assert.ok(Math.abs(a.pitch - b.pitch) < 0.01);
  updatePitch(a, 1, 1, 0);
  assert.ok(Number.isFinite(a.pitch));
  const side = { yaw: Math.PI / 2 };
  for (let i = 0; i < 60; i++) updatePitch(side, 28 / 60, 0, 1 / 60);
  assert.ok(side.pitch > 0.3);
});
test('blocked movement stays level; pause preserves pose and restart clears it', () => {
  const g = game();
  g.app.start(1, true);
  g.state.E = [];
  g.state.airLeft = 0;
  g.app.view.cover.move = (p) => ({ ...p });
  g.host.emit('keydown', { key: 'w', repeat: false, preventDefault() {} });
  for (let i = 0; i < 20; i++) g.app.upd(0.05);
  assert.equal(g.state.P.pitch, 0);
  g.state.P.pitch = 0.25;
  g.state.P.pitchSpeed = 1;
  g.app.pauseGame();
  g.app.loop(16);
  g.app.loop(32);
  assert.equal(g.state.P.pitch, 0.25);
  g.app.start(1, true);
  assert.equal(g.state.P.pitch, 0);
  assert.equal(g.state.P.pitchSpeed, 0);
});
