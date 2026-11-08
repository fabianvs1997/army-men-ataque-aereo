const { test } = require('node:test'),
  assert = require('node:assert/strict');
const Combat = require('../src/combat.js');
const Missions = require('../src/toy-missions.js');
const enemy = (x = 0, z = 30, k = 'inf') => ({
  x,
  y: 0,
  z,
  k,
  hp: 2,
  r: 1.5,
  p: 10,
  cd: 999,
});
const state = () => ({
  st: 'play',
  P: { x: 0, y: 8, z: 0, sc: 0 },
  FX: [],
  PK: [],
  E: [],
  BL: [],
  EB: [],
  MS: [],
  bd: 0,
  mission: { release() {} },
});
test('gunVelocity covers both cone edges, rejects range/behind and keeps bullet speed', () => {
  for (const angle of [-11, 11, -13, 13, 180]) {
    const r = (angle * Math.PI) / 180,
      e = enemy(Math.sin(r) * 60, Math.cos(r) * 60),
      v = Combat.gunVelocity({ x: 0, z: 0, yaw: 0 }, { x: 0, y: 8, z: 0 }, [e]);
    if (Math.abs(angle) < 12) {
      assert.ok(v.vx * angle > 0);
      // Velocidad 3D exacta (antes se fijaba la horizontal; a
      // quemarropa la vertical se disparaba y la bala picaba).
      assert.ok(Math.abs(Math.hypot(v.vx, v.vy, v.vz) - 170) < 1e-8);
    } else assert.equal(v.vx, 0);
  }
  assert.deepEqual(
    Combat.gunVelocity({ x: 0, z: 0, yaw: 0 }, { x: 0, y: 8, z: 0 }, [
      enemy(10, 140),
    ]),
    { vx: 0, vy: -16, vz: 170 },
  );
  // A quemarropa (1 u, antes zona muerta: el cañón disparaba recto
  // y no tocaba al enemigo): ahora apunta al centro del objetivo.
  const close = Combat.gunVelocity(
    { x: 0, z: 0, yaw: 0 },
    { x: 0, y: 8, z: 0 },
    [enemy(0, 1)],
  );
  assert.equal(close.vx, 0);
  assert.ok(close.vy < 0 && close.vz > 0);
  assert.ok(Math.abs(Math.hypot(close.vx, close.vy, close.vz) - 170) < 1e-8);
});
test('gunVelocity a quemarropa acierta: un tanque a 3 u muere de un cargador', () => {
  const s = state();
  const tank = { x: 0, y: 0, z: 3, k: 'tank', hp: 8, r: 3.5, p: 30, cd: 999 };
  s.E = [tank];
  const b = { x: 0, y: 7.7, z: 2, vx: 0, vy: 0, vz: 0, l: 0.85 };
  s.BL = [b];
  const combat = Combat.create({
    ...s,
    state: s,
    ToyMissions: Missions,
    groundAt: () => 0,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    sfx: {},
    buzz: () => {},
    cover: { trace: () => null },
    hurt: () => {},
    P: s.P,
    st: 'play',
  });
  for (let i = 0; i < 30 && !tank.dead; i++) {
    const muzzle = { x: 0, y: 7.7, z: 2 };
    const v = Combat.gunVelocity({ x: 0, z: 0, yaw: 0 }, muzzle, [tank]);
    Object.assign(b, { x: muzzle.x, y: muzzle.y, z: muzzle.z, vx: v.vx, vy: v.vy, vz: v.vz, l: 0.85 });
    combat.stepProjectiles(0.05);
  }
  assert.equal(tank.dead, 1);
});
test('kill sin lista de paquetes no rompe: la baja se anota y no hay resto', () => {
  const s = state();
  delete s.PK;
  const e = enemy(0, 30, 'tank');
  assert.equal(Combat.kill(s, e, { random: () => 0.1 }), true);
  assert.equal(s.P.sc, 10);
});
test('gunVelocity selects nearest living enemy and converges from either muzzle', () => {
  const far = enemy(-5, 70),
    near = enemy(4, 40),
    dead = { ...enemy(-1, 20), dead: true };
  for (const x of [-1.2, 1.2]) {
    const v = Combat.gunVelocity({ x: 0, z: 0, yaw: 0 }, { x, y: 7.7, z: 2 }, [
        far,
        near,
        dead,
      ]),
      time = 38 / v.vz;
    assert.ok(Math.abs(x + v.vx * time - 4) < 1e-8);
    assert.ok(Math.abs(7.7 + v.vy * time - 1.5) < 1e-8);
  }
});
test('kill awards exactly once and releases each base once', () => {
  const s = state(),
    e = { ...enemy(10, 20, 'base'), p: 100, camp: 2 };
  let releases = 0,
    booms = 0;
  s.mission.release = (id) => {
    assert.equal(id, 2);
    releases++;
  };
  const effects = { random: () => 0, onBreak: () => booms++ };
  assert.equal(Combat.kill(s, e, effects), true);
  assert.equal(Combat.kill(s, e, effects), false);
  assert.equal(s.P.sc, 100);
  assert.equal(s.bd, 1);
  assert.equal(releases, 1);
  assert.equal(booms, 1);
  assert.equal(s.FX.length, 0);
  // Sin escombros: matar no deja ningún resto en el suelo.
  assert.equal(s.DB?.length || 0, 0);
  assert.equal(s.PK.length, 0);
});
test('hit only kills at zero HP; injected RNG controls loot', () => {
  const s = state(),
    e = enemy();
  let calls = 0;
  const effects = {
    random: () => {
      calls++;
      return 0.1;
    },
  };
  assert.equal(Combat.hit(s, e, 1, effects), false);
  assert.equal(e.hp, 1);
  assert.equal(e.fl, 0);
  assert.equal(e.chips, 1);
  // Un impacto que no mata tampoco deja restos (antes dejaba 4 cubitos).
  assert.equal(s.DB?.length || 0, 0);
  assert.equal(s.P.sc, 0);
  assert.equal(Combat.hit(s, e, 1, effects), true);
  assert.deepEqual(s.PK, [{ x: 0, z: 30, ty: 'a' }]);
  assert.equal(calls, 2);
  const other = state();
  Combat.kill(other, enemy(), { random: () => 0.9 });
  assert.equal(other.PK.length, 0);
});
test('swept bullets hit only the nearest intersection, independent of array order', () => {
  const s = state(),
    far = enemy(0, 12),
    near = enemy(0, 10);
  s.E = [far, near];
  s.BL = [{ x: 0, y: 1.5, z: 0, vx: 0, vy: 0, vz: 400, l: 1 }];
  const combat = Combat.create({
    ...s,
    state: s,
    ToyMissions: Missions,
    groundAt: () => 0,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    sfx: { boom() {} },
    buzz() {},
    hurt() {},
  });
  assert.equal(combat.stepProjectiles(0.05), true);
  assert.equal(near.hp, 1);
  assert.equal(far.hp, 2);
  assert.equal(s.BL[0].l, 0);
});
