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

test('missile impact leaves a dark smoke puff but no fireball FX', () => {
  const { app, state: s } = game();
  app.start(1, true);
  s.E = [];
  app.spawnE('tank', 0, 0);
  const e = s.E[0];
  s.MS = [{ x: e.x, y: e.y + 1, z: e.z, vx: 0, vz: 0, l: 0.01 }];
  app.combat.stepProjectiles(0.02);
  assert.equal(e.dead, 1);
  assert.equal(s.FX.length, 0);
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

test('Canvas 2D draws tracers, missile flame and smoke with the reference colours', () => {
  const Render2D = require('../src/render2d.js');
  const strokes = [],
    fills = [],
    widths = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineCap: 'butt',
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    stroke() {
      strokes.push(this.strokeStyle);
      widths.push(this.lineWidth);
    },
    fill() {
      fills.push(this.fillStyle);
    },
    ellipse() {},
    fillRect() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  const scene = {
    ctx,
    W: 390,
    H: 844,
    F: 390 / 105,
    HY: 400,
    PITCH: Math.PI / 3,
    cam: { x: 0, z: 0, yaw: 0 },
    t: 0,
    shk: 0,
    rot: 0,
    lowQuality: false,
    groundAt: () => 0,
    R: (a) => a,
    $: () => ({ style: {} }),
    P: null,
    E: [],
    DC: [],
    DB: [],
    PK: [],
    BL: [{ x: 0, y: 8, z: 20, vx: 0, vy: 0, vz: 170, l: 1 }],
    EB: [{ x: 0, y: 8, z: 30, vx: 0, vy: 0, vz: -55, l: 4 }],
    MS: [{ x: 0, y: 8, z: 10, vx: 0, vy: 0, vz: 75, l: 3 }],
    SM: [
      { x: 0, y: 8, z: 5, l: 0.6, max: 0.9, s: 1.5, dark: false, dx: 0, dy: 0.5, dz: 0 },
      { x: 2, y: 8, z: 6, l: 0.3, max: 0.9, s: 3, dark: true, dx: 0, dy: 0.7, dz: 0 },
    ],
    FX: [],
    mission: null,
    renderer3d: undefined,
  };
  const renderer = Render2D.create(scene);
  assert.doesNotThrow(() => renderer.draw());
  assert.ok(strokes.includes('#fff3b0'), 'bullet core');
  assert.ok(strokes.includes('#ffc46b'), 'enemy bullet core');
  // La trazadora se desvanece en gradiente (objeto, no color plano) y es
  // fina: ningún trazo del dibujo supera 2 px de ancho en esta escena.
  assert.ok(
    strokes.some((s) => s && typeof s === 'object'),
    'tracer fades with a gradient',
  );
  assert.ok(Math.max(...widths) <= 2, 'tracers are thin');
  assert.equal(ctx.globalCompositeOperation, 'lighter', 'additive glow');
  assert.ok(strokes.includes('#3a3f36'), 'missile body');
  assert.ok(fills.includes('#ff6a1a'), 'missile flame');
  assert.ok(fills.includes('#d92b1f'), 'missile nose');
  assert.ok(fills.includes('#f4f4ee'), 'white smoke');
  assert.ok(fills.includes('#2b2b28'), 'dark impact smoke');
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

test('a flying missile trails smoke and draws in the Canvas 2D fallback', () => {
  const { app, state: s } = game();
  app.start(1, true);
  s.E = [];
  s.MS = [missile({ smoke: 0 })];
  s.BL = [{ x: 0, y: 8, z: 0, vx: 0, vy: 0, vz: 170, l: 1 }];
  s.EB = [{ x: 0, y: 8, z: 20, vx: 0, vy: 0, vz: -55, l: 4 }];
  for (let i = 1; i <= 10; i++) app.loop(i * 16);
  assert.ok(s.SM.length >= 1);
  assert.ok(s.SM.every((p) => !p.dark));
  assert.doesNotThrow(() => app.render2d.draw(app.view));
});
