const test = require('node:test');
const assert = require('node:assert/strict');
const Debris = require('../src/debris.js');
const Combat = require('../src/combat.js');
const { game, seeded } = require('../support/fake-host.cjs');

test('each toy breaks into molded components without an explosion; repeated hits on dead toys do nothing', () => {
  for (const k of ['inf', 'tank', 'tur', 'heli', 'base']) {
    const s = {
      P: { sc: 0, x: 0, z: 0 },
      FX: [],
      PK: [],
      bd: 0,
      mission: { release() {} },
    };
    const e = { k, x: 10, y: 8, z: 20, hp: 1, p: 10 };
    const effects = { random: () => 1, visualRandom: seeded(44) };
    Combat.hit(s, e, 1, effects);
    assert.equal(s.FX.length, 0);
    assert.ok(s.DB.some((p) => p.large));
    const count = s.DB.length;
    Combat.hit(s, e, 1, effects);
    assert.equal(s.DB.length, count);
    assert.equal(s.P.sc, 10);
  }
});
test('impact fragments originate at collision point and settle on uneven terrain permanently', () => {
  const s = {},
    ground = (x, z) => 2 + Math.sin(x * 0.1) + Math.cos(z * 0.1);
  Debris.emit(s, { k: 'heli', x: 0, y: 8, z: 0 }, false, seeded(3), {
    x: 1,
    y: 9,
    z: 2,
  });
  assert.ok(s.DB.every((p) => p.x === 1 && p.y === 9 && p.z === 2));
  for (let i = 0; i < 600; i++) Debris.step(s, 1 / 60, ground);
  assert.ok(
    s.DB.every(
      (p) => p.settled && Math.abs(p.y - ground(p.x, p.z) - p.sy) < 1e-9,
    ),
  );
  const saved = JSON.stringify(s.DB);
  for (let i = 0; i < 3600; i++) Debris.step(s, 1 / 60, ground);
  assert.equal(JSON.stringify(s.DB), saved);
});
test('debris uses a separate reproducible RNG and caps retained pieces', () => {
  const a = {},
    b = {},
    e = { k: 'tank', x: 0, y: 0, z: 0 };
  Debris.emit(a, e, true, seeded(4));
  Debris.emit(b, e, true, seeded(4));
  assert.deepEqual(a, b);
  for (let i = 0; i < 200; i++) Debris.emit(a, e, true, seeded(i));
  assert.equal(a.DB.length, Debris.MAX_PIECES);
  assert.ok(
    a.DB.every((p) =>
      Object.values(p)
        .filter((v) => typeof v === 'number')
        .every(Number.isFinite),
    ),
  );
});
test('game freezes debris on pause and clears wreckage on retry and menu', () => {
  const { app, state } = game();
  app.start(1, true);
  app.combat.hit(state.E[0], 1);
  assert.ok(state.DB.length);
  app.pauseGame();
  const before = JSON.stringify(state.DB);
  app.loop(16);
  app.loop(32);
  assert.equal(JSON.stringify(state.DB), before);
  app.resumeGame();
  app.start(1, true);
  assert.equal(state.DB.length, 0);
  app.combat.kill(state.E[0]);
  assert.ok(state.DB.length);
  app.pauseGame();
  app.mainMenu();
  assert.equal(state.DB.length, 0);
});
test('surviving bases shed their roof once and do not duplicate it on destruction', () => {
  const s = {
    P: { sc: 0, x: 0, z: 0 },
    FX: [],
    PK: [],
    bd: 0,
    mission: { release() {} },
  };
  const e = { k: 'base', x: 0, y: 0, z: 0, hp: 10, p: 100 };
  for (let i = 0; i < 4; i++) Combat.hit(s, e, 1);
  assert.equal(e.detached, true);
  const roofs = () => s.DB.filter((p) => p.sx === 5.5 && p.sz === 4.5).length;
  assert.equal(roofs(), 1);
  Combat.hit(s, e, 100);
  assert.equal(roofs(), 1);
});
test('missile damage shatters nearby toys without spawning fireball FX', () => {
  const {app,state}=game();app.start(1,true);state.E=[];
  app.spawnE('tank',20,20);
  const e=state.E[0];
  state.MS=[{x:e.x,y:e.y+1,z:e.z,vx:0,vz:0,l:.01}];
  app.combat.stepProjectiles(.02);
  assert.equal(e.dead,1);assert.equal(state.FX.length,0);
  assert.ok(state.DB.some(p=>p.large));assert.equal(state.P.sc,30);
});
