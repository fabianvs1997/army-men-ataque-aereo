const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('../support/fake-host.cjs');
const key = (g, k) =>
  g.host.emit('keydown', { key: k, repeat: false, preventDefault() {} });
function completeMission(g) {
  const { app, state: s } = g;
  for (const e of s.E) app.combat.kill(e);
  s.E = [];
  s.EB = [];
  s.airLeft = 0;
  for (const a of s.mission.allies) {
    s.P.x = a.x;
    s.P.z = a.z;
    for (let i = 0; i < 30; i++) app.upd(0.05);
  }
  s.P.x = s.mission.finish.x;
  s.P.z = s.mission.finish.z;
  for (let i = 0; i < 40; i++) app.upd(0.05);
}
test('campaign integrates rescue, extraction, next mission and play again', () => {
  const g = game();
  g.element('go').onclick();
  for (let n = 1; n <= 3; n++) {
    assert.equal(g.state.mis, n);
    completeMission(g);
    assert.equal(g.state.st, n === 3 ? 'campaign' : 'win');
    const score = g.state.P.sc;
    g.app.upd(0.05);
    assert.equal(g.state.P.sc, score);
    g.element('go').onclick();
  }
  assert.equal(g.state.mis, 1);
  assert.equal(g.state.P.sc, 0);
});
test('lethal damage prevents same-frame healing; retry preserves checkpoint and mission', () => {
  const g = game(),
    s = g.state;
  g.app.start(2, true);
  s.checkpoint = 250;
  s.P.sc = 345;
  s.P.arm = 1;
  s.E = [];
  s.PK = [{ x: 0, z: 0, ty: 'a' }];
  s.EB = [{ x: s.P.x, y: s.P.y, z: s.P.z, vx: 0, vy: 0, vz: 0, l: 1 }];
  g.app.upd(0.05);
  assert.equal(s.st, 'over');
  assert.equal(s.P.arm, 0);
  g.element('go').onclick();
  assert.equal(s.st, 'play');
  assert.equal(s.mis, 2);
  assert.equal(s.P.sc, 250);
  assert.equal(s.P.arm, 10);
  assert.equal(s.mission.rescued, 0);
});
test('chase flight advances, reverses and steers continuously with camera alignment', () => {
  for (const k of ['w', 's', 'a', 'd']) {
    const g = game(),
      s = g.state;
    g.app.start(1, true);
    s.E = [];
    s.airLeft = 0;
    key(g, k);
    for (let i = 0; i < 20; i++) {
      const before = s.P.yaw;
      g.app.upd(0.03);
      assert.ok(Math.abs(s.P.yaw - before) <= 1.8 * 0.03 + 1e-9);
      assert.equal(g.app.view.cam.yaw, s.P.yaw);
    }
    if (k === 'w' || k === 's') {
      assert.equal(s.P.yaw, 0);
      assert.ok(s.P.z * (k === 'w' ? 1 : -1) > 0);
    } else {
      assert.equal(s.P.x, 0);
      assert.equal(s.P.z, 0);
      assert.ok(s.P.yaw * (k === 'a' ? 1 : -1) > 0);
    }
    g.app.input.clear();
    const pos = [s.P.x, s.P.z, s.P.yaw];
    g.app.upd(0.03);
    assert.deepEqual([s.P.x, s.P.z, s.P.yaw], pos);
  }
});
test('joystick changes direction without release, keeps firing independent and clears on cancel', () => {
  const g = game(),
    s = g.state;
  g.app.start(1, true);
  s.E = [];
  const c = g.element('c');
  c.emit('pointerdown', { pointerId: 1, clientX: 40, clientY: 200 });
  c.emit('pointermove', { pointerId: 1, clientX: 40, clientY: 130 });
  g.app.upd(0.03);
  assert.ok(s.P.z > 0);
  assert.equal(s.P.yaw, 0);
  const z = s.P.z;
  c.emit('pointermove', { pointerId: 1, clientX: 40, clientY: 270 });
  g.app.upd(0.03);
  assert.ok(s.P.z < z);
  assert.equal(s.P.yaw, 0);
  g.element('fu').emit('pointerdown', { pointerId: 2 });
  c.emit('pointermove', { pointerId: 1, clientX: 110, clientY: 130 });
  g.app.upd(0.03);
  assert.ok(s.P.yaw < 0);
  assert.ok(s.BL.length > 0);
  c.emit('pointercancel', { pointerId: 1 });
  const pos = [s.P.x, s.P.z, s.P.yaw];
  g.app.upd(0.03);
  assert.deepEqual([s.P.x, s.P.z, s.P.yaw], pos);
  assert.equal(g.app.input.read().fire, true);
  g.app.pauseGame();
  assert.equal(g.app.input.read().fire, false);
});
test('paused menus preserve mission; abandon requires confirmation; preferences synchronize', () => {
  const g = game(),
    s = g.state;
  for (const id of ['menuHelp', 'menuSettings', 'menuCredits']) {
    g.element(id).onclick();
    g.element('back').onclick();
    assert.equal(s.st, 'menu');
  }
  g.app.start(2, true);
  s.P.sc = 345;
  s.P.x = 41;
  key(g, 'w');
  g.host.emit('blur');
  assert.equal(s.st, 'paused');
  const time = s.t;
  g.app.upd(0.05);
  assert.equal(s.t, time);
  g.element('menuSettings').onclick();
  key(g, 'p');
  assert.equal(s.st, 'paused');
  g.element('menuSound').onclick();
  assert.equal(
    g.element('sound').textContent,
    g.element('menuSound').textContent,
  );
  g.element('menuQuality').onclick();
  assert.equal(g.saved.get('toy-quality'), 'low');
  g.element('back').onclick();
  g.element('go').onclick();
  assert.equal(s.st, 'play');
  assert.equal(s.P.x, 41);
  assert.equal(s.P.sc, 345);
  key(g, 'Escape');
  g.element('menuExit').onclick();
  g.element('back').onclick();
  assert.equal(s.P.sc, 345);
  g.element('menuExit').onclick();
  g.element('confirmExit').onclick();
  assert.equal(s.st, 'menu');
  assert.equal(s.P, null);
  g.element('go').onclick();
  assert.equal(s.P.sc, 0);
});
test('economy drawing cadence does not slow simulation and hidden/paused views stop work', () => {
  const g = game(),
    s = g.state;
  g.app.start(1, true);
  s.E = [];
  s.lowQuality = true;
  let draws = 0;
  g.app.view.draw = () => draws++;
  for (let i = 1; i <= 60; i++) g.app.loop((i * 1000) / 60);
  assert.equal(draws, 30);
  assert.ok(Math.abs(s.t - 1) < 1e-8);
  g.app.pauseGame();
  g.app.loop(1016);
  const d = draws,
    t = s.t;
  g.app.loop(1032);
  assert.equal(draws, d);
  assert.equal(s.t, t);
  g.host.document.hidden = true;
  s.needsDraw = true;
  g.app.loop(1048);
  assert.equal(draws, d);
});
test('seeded missions reproduce spawns and terrain heights; fallback renders all states', () => {
  const a = game(78),
    b = game(78);
  a.app.start(2, true);
  b.app.start(2, true);
  assert.deepEqual(a.state.E, b.state.E);
  const world = require('../src/toy-world.js');
  for (const e of a.state.E) {
    assert.equal(e.y, world.height(e.x, e.z));
    assert.ok(world.clearOfLandmarks(e.x, e.z, 10));
  }
  a.state.mission.release(0);
  assert.doesNotThrow(() => a.app.render2d.draw(a.app.view));
  a.app.pauseGame();
  assert.doesNotThrow(() => a.app.render2d.draw(a.app.view));
});
test('assisted bullets hit offset infantry without turning the player', () => {
  const g = game(),
    s = g.state;
  g.app.start(1, true);
  s.E = [];
  const target = g.app.spawnE('inf', -90, 100);
  // Place a close target explicitly to isolate aim assistance from spawn policy.
  target.x = 5;
  target.z = 35;
  target.y = require('../src/toy-world.js').height(5, 35);
  target.cd = 999;
  g.element('fu').emit('pointerdown', { pointerId: 1 });
  g.app.upd(0.01);
  g.element('fu').emit('pointerup', { pointerId: 1 });
  for (let i = 0; i < 8; i++) g.app.upd(0.04);
  assert.equal(target.hp, 1);
  assert.equal(s.P.yaw, 0);
});
test('result panels preserve retry/next actions and Escape navigates without losing state', () => {
  for (const [state, expected] of [
    ['over', 2],
    ['win', 3],
    ['campaign', 1],
  ]) {
    const g = game();
    g.app.start(state === 'campaign' ? 3 : 2, true);
    g.app.setState(state);
    g.element('menuCredits').onclick();
    key(g, 'Escape');
    assert.equal(g.state.st, state);
    g.element('go').onclick();
    assert.equal(g.state.mis, expected);
  }
  const g = game();
  let prevented = false;
  g.host.emit('keydown', {
    key: ' ',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, false);
});
