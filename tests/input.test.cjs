const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { fakeHost } = require('../support/fake-host.cjs');
const Input = require('../src/input.js');
function setup() {
  const f = fakeHost(),
    env = {
      host: f.host,
      $: f.element,
      cv: f.element('c'),
      st: 'play',
      overlayPage: 'result',
      needsDraw: false,
      clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
      audio() {
        env.unlocked = (env.unlocked || 0) + 1;
      },
      humOn() {},
      pauseGame() {
        env.st = 'paused';
      },
      resumeGame() {
        env.st = 'play';
      },
      menuBack() {
        env.overlayPage = 'result';
      },
    };
  const input = Input.create(env);
  input.bind();
  return { ...f, env, input };
}
const key = (f, k, repeat = false) =>
  f.host.emit('keydown', { key: k, repeat, preventDefault() {} });
test('pilot pointer has sole ownership and joystick caps visual travel', () => {
  const f = setup(),
    c = f.element('c');
  c.emit('pointerdown', { pointerId: 1, clientX: 20, clientY: 200 });
  assert.equal(f.env.unlocked, 1);
  c.emit('pointerdown', { pointerId: 2, clientX: 80, clientY: 220 });
  c.emit('pointermove', { pointerId: 2, clientX: 900, clientY: 900 });
  assert.equal(f.input.read().sx, 0);
  c.emit('pointermove', { pointerId: 1, clientX: 1020, clientY: 200 });
  assert.equal(f.input.read().sx, 1);
  assert.equal(f.element('knob').style.transform, 'translate(40px,0px)');
  c.emit('pointerup', { pointerId: 2 });
  assert.equal(f.input.read().sx, 1);
  c.emit('pointercancel', { pointerId: 1 });
  assert.equal(f.input.read().sx, 0);
  assert.equal(f.element('stick').style.display, 'none');
});
test('fire ownership ignores another finger and lost capture releases it', () => {
  const f = setup(),
    b = f.element('fu');
  b.emit('pointerdown', { pointerId: 10 });
  assert.equal(f.env.unlocked, 1);
  b.emit('pointerdown', { pointerId: 11 });
  b.emit('pointerup', { pointerId: 11 });
  assert.equal(f.input.read().fire, true);
  b.emit('lostpointercapture', { pointerId: 10 });
  assert.equal(f.input.read().fire, false);
});
test('missiles do not repeat on key hold and clear resets all inputs', () => {
  const f = setup();
  key(f, 'm', true);
  assert.equal(f.input.read().missile, false);
  key(f, 'm');
  assert.equal(f.input.read().missile, true);
  f.input.consumeMissile();
  assert.equal(f.input.read().missile, false);
  key(f, 'w');
  key(f, ' ');
  assert.equal(f.input.read().sy, 1);
  assert.equal(f.input.read().fire, true);
  f.input.clear();
  assert.deepEqual(f.input.read(), {
    sx: 0,
    sy: 0,
    fire: false,
    missile: false,
  });
});
test('resize clears pilot and fire; paused menus do not accept movement', () => {
  const f = setup();
  f.element('fu').emit('pointerdown', { pointerId: 1 });
  key(f, 'd');
  f.host.emit('resize');
  assert.deepEqual(f.input.read(), {
    sx: 0,
    sy: 0,
    fire: false,
    missile: false,
  });
  assert.equal(f.env.needsDraw, true);
  f.env.st = 'paused';
  f.env.overlayPage = 'settings';
  key(f, 'p');
  assert.equal(f.env.st, 'paused');
  key(f, 'w');
  assert.equal(f.input.read().sy, 0);
});
