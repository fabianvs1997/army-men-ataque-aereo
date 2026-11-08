const test = require('node:test'),
  assert = require('node:assert/strict');
const { game } = require('../support/fake-host.cjs');
const World = require('../src/toy-world.js'),
  Config = require('../src/escort-config.js');
const listeners = (g) =>
  [
    g.host,
    g.host.document,
    ...['go', 'c', 'fu', 'mi', 'pause', 'sound'].map(g.element),
  ].map((o) => Object.values(o.listeners).reduce((n, a) => n + a.length, 0));
test('five resets recreate exact forces, reset events and retain saved campaign results and listeners', () => {
  const g = game();
  g.app.start(2, true);
  const counts = {
    enemies: g.state.E.length,
    guards: g.state.mission.guards.length,
    squad: g.state.mission.allies.length,
  };
  const handlers = listeners(g),
    positions = g.state.E.map((e) => [e.id, e.x, e.z]);
  const saved = JSON.stringify({
    version: Config.progressVersion,
    missions: { 1: { stars: 3, saved: 7 } },
  });
  g.host.localStorage.setItem(Config.progressKey, saved);
  for (let i = 0; i < 5; i++) {
    g.state.mission.damageSoldier(g.state.mission.allies[0], 100);
    g.app.start(2, true, true);
    assert.deepEqual(
      {
        enemies: g.state.E.length,
        guards: g.state.mission.guards.length,
        squad: g.state.mission.allies.length,
      },
      counts,
    );
    assert.deepEqual(
      g.state.E.map((e) => [e.id, e.x, e.z]),
      positions,
    );
    assert.deepEqual(listeners(g), handlers);
    assert.deepEqual(g.state.mission.events, []);
    assert.equal(g.state.mission.stage, 'INICIO_A');
    assert.equal(g.host.localStorage.getItem(Config.progressKey), saved);
  }
});
test('enemy projectiles hit healthy soldiers while wounded remain protected during B clearance', () => {
  // La mecánica es de la escolta: desde la Misión 1 del vídeo (sin
  // pelotón ni heridos) se juega en la Misión 2, que la conserva.
  const { app, state: s } = game();
  app.start(2, true);
  s.E = [];
  s.BL = [];
  const healthy = s.mission.allies[0],
    wounded = s.mission.allies.find((a) => a.wounded);
  s.mission.transition('COMBATE_RUTA_AB');
  s.mission.transition('DESPEJAR_B');
  const shoot = (a) => {
    s.EB = [
      {
        x: a.x,
        y: s.world.height(a.x, a.z) + 1.5,
        z: a.z + 4,
        vx: 0,
        vy: 0,
        vz: -60,
        l: 1,
      },
    ];
    app.combat.stepProjectiles(0.08);
  };
  const before = healthy.hp;
  shoot(healthy);
  assert.equal(healthy.hp, before - 1);
  const protectedHP = wounded.hp;
  shoot(wounded);
  assert.equal(wounded.hp, protectedHP);
});
test('helicopter destruction marks mission failed and initial HUD names B', () => {
  const g = game();
  g.app.start(1, true);
  g.app.upd(0.01);
  assert.match(g.element('objective').textContent, /Dirígete a la base B/);
  g.state.P.arm = 1;
  g.app.hurt();
  assert.equal(g.state.st, 'over');
  assert.equal(g.state.mission.stage, 'FRACASADA');
  assert.match(g.element('tx').textContent, /Helicóptero destruido/);
});
test('guard and squad autonomous fire damages enemies without player firing', () => {
  // La escolta vive en la Misión 2 desde la Misión 1 del vídeo.
  const g = game();
  g.app.start(2, true);
  const s = g.state;
  const before = s.E.filter((e) => e.zone === 'B').reduce(
    (n, e) => n + e.hp,
    0,
  );
  for (let i = 0; i < 200; i++) g.app.upd(0.05);
  assert.ok(
    s.E.filter((e) => e.zone === 'B').reduce((n, e) => n + e.hp, 0) < before,
  );
  assert.ok(
    s.mission.allies.some((a) => !a.wounded && a.hp < Config.soldierHP),
    'B should be under enemy attack',
  );
});
test('squad navigates the actual plastic wreckage left by combat across visual seeds', () => {
  // La escolta vive en la Misión 2 desde la Misión 1 del vídeo (sin
  // pelotón ni heridos): el pelotón marcha a C y se entrega allí.
  const { fakeHost, seeded } = require('../support/fake-host.cjs'),
    Game = require('../src/game.js');
  for (const seed of [1, 123, 999]) {
    const f = fakeHost(),
      app = Game.create(f.host, {
        Renderer: null,
        random: seeded(1),
        visualRandom: seeded(seed),
      });
    app.start(2, true);
    const s = app.state,
      m = s.mission;
    for (const e of s.E) app.combat.kill(e);
    s.EB = [];
    for (const a of m.allies.filter((a) => a.wounded)) {
      s.P.x = a.x;
      s.P.z = a.z;
      for (let i = 0; i < 35; i++) app.upd(0.05);
    }
    s.P.x = m.finish.x;
    s.P.z = m.finish.z;
    for (let i = 0; i < 1800 && s.st === 'play'; i++) app.upd(0.05);
    // Misión 1: tras la entrega en C queda la caja y el portal.
    if (m.stage === 'CARGA_PORTAL') {
      s.P.x = m.cargo.x;
      s.P.z = m.cargo.z;
      for (let i = 0; i < 200 && m.cargo.state === 'waiting'; i++)
        app.upd(0.05);
      s.P.x = m.portal.x;
      s.P.z = m.portal.z;
      for (let i = 0; i < 600 && s.st === 'play'; i++) app.upd(0.05);
    }
    assert.equal(s.st, 'win');
    assert.equal(
      m.delivered,
      7,
      JSON.stringify({
        seed,
        squad: m.allies.map((a) => ({
          id: a.id,
          cause: a.cause,
          x: a.x,
          z: a.z,
        })),
      }),
    );
  }
});
