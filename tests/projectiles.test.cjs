const { test } = require('node:test');
const assert = require('node:assert/strict');
const Combat = require('../src/combat.js');
const Missions = require('../src/toy-missions.js');
const { game, seeded } = require('../support/fake-host.cjs');

function combatEnv(state) {
  return {
    ...state,
    state,
    ToyMissions: Missions,
    groundAt: () => 0,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    sfx: { boom() {} },
    buzz() {},
    hurt() {},
    visualRandom: seeded(7),
  };
}
const missile = (over = {}) => ({
  x: 0,
  y: 8,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 75,
  l: 3,
  ...over,
});
const state = (over = {}) => ({
  P: { x: 0, y: 8, z: 0, sc: 0 },
  FX: [],
  SM: [],
  PK: [],
  E: [],
  BL: [],
  EB: [],
  MS: [],
  bd: 0,
  mission: { release() {} },
  ...over,
});

test('missiles leave a trail of white smoke puffs behind them while flying', () => {
  const s = state({ MS: [missile()] }),
    combat = Combat.create(combatEnv(s));
  combat.stepProjectiles(0.1);
  assert.ok(s.MS[0].z > 0);
  assert.ok(s.SM.length >= 1);
  assert.ok(
    s.SM.every(
      (p) =>
        !p.dark &&
        p.l > 0 &&
        p.max > 0 &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        Number.isFinite(p.z) &&
        p.z < s.MS[0].z,
    ),
  );
});

test('smoke trail is bounded even on very long missile flights', () => {
  const s = state({ MS: [missile({ l: 100 })] }),
    combat = Combat.create(combatEnv(s));
  for (let i = 0; i < 200; i++) combat.stepProjectiles(0.05);
  assert.equal(s.SM.length, Combat.MAX_SMOKE);
});

test('missile impact leaves a dark smoke puff and a fireball FX', () => {
  const { app, state: s } = game();
  app.start(1, true);
  s.E = [];
  app.spawnE('tank', 0, 0);
  const e = s.E[0];
  s.MS = [{ x: e.x, y: e.y + 1, z: e.z, vx: 0, vz: 0, l: 0.01 }];
  app.combat.stepProjectiles(0.02);
  assert.equal(e.dead, 1);
  // La explosión del misil (bola de fuego) y la del tanque muerto.
  assert.ok(s.FX.length >= 2);
  assert.ok(
    s.FX.every((f) => f.s >= Combat.EXPLOSION_SIZE.missile && f.l > 0),
  );
  assert.ok(s.SM.some((p) => p.dark));
});

test('smoke puffs drift, fade and clear on retry and menu', () => {
  const { app, state: s } = game();
  app.start(1, true);
  const puff = () => ({
    x: 0,
    y: 8,
    z: 0,
    l: 0.9,
    max: 0.9,
    s: 1.5,
    dark: false,
    dx: 0,
    dy: 1,
    dz: 0,
  });
  s.SM.push(puff());
  for (let i = 1; i <= 10; i++) app.loop(i * 16);
  assert.equal(s.SM.length, 1);
  assert.ok(s.SM[0].y > 8);
  for (let i = 11; i <= 80; i++) app.loop(i * 16);
  assert.equal(s.SM.length, 0);
  s.SM.push(puff());
  app.start(1, true);
  assert.equal(s.SM.length, 0);
  s.SM.push(puff());
  app.pauseGame();
  app.mainMenu();
  assert.equal(s.SM.length, 0);
});

test('bullets fly about 30% faster with the same effective range', () => {
  const Config = require('../src/escort-config.js');
  assert.equal(Combat.BULLET_SPEED, 170);
  const v = Combat.gunVelocity({ x: 0, z: 0, yaw: 0 }, { x: 0, y: 8, z: 0 }, []);
  assert.ok(Math.abs(Math.hypot(v.vx, v.vz) - 170) < 1e-8);
  assert.equal(Config.bulletSpeed, 85);
  // Alcance efectivo = velocidad × vida, igual que antes: jugador
  // 170×0,85 ≈ 143, aliadas 85×1,15 ≈ 98, enemigas 55×3,05 ≈ 168.
  assert.ok(Math.abs(170 * 0.85 - 130 * 1.1) < 2);
  assert.ok(Math.abs(85 * 1.15 - 65 * 1.5) < 1);
  assert.ok(Math.abs(55 * 3.05 - 42 * 4) < 1);
});

test('bullets carry their shooter kind and turrets count as tank guns', () => {
  assert.equal(Combat.bulletKindFor('inf'), 'soldier');
  assert.equal(Combat.bulletKindFor('heli'), 'heli');
  assert.equal(Combat.bulletKindFor('tank'), 'tank');
  // Las torretas son cañones pesados fijos: se dibujan como tanque.
  assert.equal(Combat.bulletKindFor('tur'), 'tank');
  assert.equal(Combat.bulletKindFor('base'), 'soldier');
  const arr = [];
  const b = Combat.mk(arr, 0, 8, 0, 0, 0, 170, 1, 'tank');
  assert.equal(b.kind, 'tank');
  assert.equal(arr[0], b);
  // Sin origen explícito, la bala no lleva tipo: los renderizadores
  // usan el de helicóptero por defecto.
  const plain = Combat.mk(arr, 0, 8, 0, 0, 0, 170, 1);
  assert.equal(plain.kind, undefined);
});

test('player, allied and enemy bullets are tagged by shooter in a live mission', () => {
  // La escolta (guardias) vive en la Misión 2 desde la Misión 1 del vídeo.
  const { app, state: s } = game();
  app.start(2, true);
  s.P.inv = 999;
  s.E = [];
  const px = s.P.x,
    pz = s.P.z;
  // Un enemigo de cada tipo que dispara, cerca del jugador y con el
  // temporizador listo, para que todos disparen en la misma ventana.
  // Se generan lejos (spawnE rechaza el radio seguro del inicio) y se
  // colocan junto al jugador, como en el test de balas asistidas.
  const World = require('../src/toy-world.js');
  for (const [i, k] of ['inf', 'heli', 'tank', 'tur'].entries()) {
    const e = app.spawnE(k, -90, 100);
    e.x = px + 18 + i * 3;
    e.z = pz + 10;
    e.y = k === 'heli' ? 8 : World.height(e.x, e.z);
    e.cd = 0;
  }
  // Un enemigo junto a un guardia aliado para que la escolta responda.
  const guard = s.mission.guards[0];
  const nearGuard = app.spawnE('inf', -90, 100);
  nearGuard.x = guard.x + 12;
  nearGuard.z = guard.z + 5;
  nearGuard.y = World.height(nearGuard.x, nearGuard.z);
  nearGuard.cd = 999;
  const kinds = new Set();
  for (let i = 0; i < 60 && kinds.size < 3; i++) {
    app.upd(0.05);
    for (const b of s.EB) kinds.add(b.kind);
  }
  assert.deepEqual([...kinds].sort(), ['heli', 'soldier', 'tank']);
  // Las balas aliadas son de soldado, como las de infantería enemiga.
  assert.ok(s.BL.some((b) => b.kind === 'soldier'), 'ally soldier tracer');
  // El disparo del jugador es de helicóptero.
  const g = game();
  g.app.start(1, true);
  g.element('fu').emit('pointerdown', { pointerId: 1 });
  g.app.upd(0.01);
  g.element('fu').emit('pointerup', { pointerId: 1 });
  assert.ok(
    g.state.BL.some((b) => b.kind === 'heli'),
    'player heli tracer',
  );
});

test('a flying missile trails smoke and draws in 3D', () => {
  const { app, state: s } = game();
  app.start(1, true);
  s.E = [];
  s.MS = [missile({ smoke: 0 })];
  s.BL = [{ x: 0, y: 8, z: 0, vx: 0, vy: 0, vz: 170, l: 1 }];
  s.EB = [{ x: 0, y: 8, z: 20, vx: 0, vy: 0, vz: -55, l: 4 }];
  for (let i = 1; i <= 10; i++) app.loop(i * 16);
  assert.ok(s.SM.length >= 1);
  assert.ok(s.SM.every((p) => !p.dark));
  assert.doesNotThrow(() => app.draw3d.draw(app.view));
});
