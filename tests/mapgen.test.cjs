const test = require('node:test');
const assert = require('node:assert/strict');
const MapGen = require('../src/mapgen.js');
const Maps = require('../src/mission-map.js');
const World = require('../src/toy-world.js');
const Collision = require('../src/collision.js');
const Escort = require('../src/escort-mission.js');
const { game } = require('../support/fake-host.cjs');

test('la misma (misión, semilla) da el mismo mapa; semillas distintas dan mapas distintos', () => {
  assert.deepEqual(MapGen.generate(2, 42), MapGen.generate(2, 42));
  assert.deepEqual(Maps.generate(123), Maps.generate(123));
  const a = MapGen.generate(1, 7),
    b = MapGen.generate(1, 8);
  assert.notDeepEqual(a.rules.A, b.rules.A);
  assert.notDeepEqual(a.rules.B, b.rules.B);
  assert.notDeepEqual(a.rules.C, b.rules.C);
  assert.notDeepEqual(a.routes, b.routes);
  assert.notDeepEqual(a.terrain, b.terrain);
  assert.notDeepEqual(a.scenery.shrubs, b.scenery.shrubs);
  assert.notDeepEqual(a.scenery.rocks, b.scenery.rocks);
  assert.notDeepEqual(a.landmarks, b.landmarks);
  assert.notDeepEqual(a.rules.enemies, b.rules.enemies);
});

test('una campaña genera tres mapas distintos con semillas distintas', () => {
  for (const campaignSeed of [1, 123, 99999, 0xffffffff]) {
    const campaign = MapGen.generateCampaign(campaignSeed);
    assert.equal(campaign.maps.length, 3);
    assert.equal(new Set(campaign.seeds).size, 3);
    const keys = campaign.maps.map((m) =>
      JSON.stringify([m.rules.A, m.rules.B, m.rules.C, m.routes]),
    );
    assert.equal(new Set(keys).size, 3);
    assert.deepEqual(
      campaign.maps.map((m) => m.mission),
      [1, 2, 3],
    );
    assert.ok(campaign.maps.every((m) => MapGen.validate(m).length === 0));
  }
  // La semilla de cada misión deriva de la de campaña, no es azar.
  assert.equal(
    MapGen.seedForMission(77, 2),
    MapGen.seedForMission(77, 2),
  );
  assert.notEqual(MapGen.seedForMission(77, 1), MapGen.seedForMission(77, 2));
});

test('la dificultad crece con la misión: más blindados y más vida enemiga en la 3 que en la 1', () => {
  const totals = [1, 2, 3].map((mission) => {
    let hp = 0,
      tanks = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const map = MapGen.generate(mission, seed * 31 + 7);
      hp += map.rules.enemies.reduce((sum, e) => sum + e.hp, 0);
      tanks += map.rules.enemies.filter((e) => e.k === 'tank').length;
    }
    return { hp: hp / 20, tanks: tanks / 20 };
  });
  assert.ok(totals[2].hp > totals[0].hp + 10, JSON.stringify(totals));
  assert.ok(totals[2].tanks > totals[0].tanks, JSON.stringify(totals));
  assert.ok(totals[1].hp >= totals[0].hp, JSON.stringify(totals));
});

test('validate rechaza mapas imposibles: objetivos juntos, ruta rota, enemigos duplicados o en la salida', () => {
  const good = MapGen.generate(1, 5);
  assert.deepEqual(MapGen.validate(good), []);
  const close = JSON.parse(JSON.stringify(good));
  close.rules.B = { x: close.rules.A.x + 10, z: close.rules.A.z };
  assert.ok(MapGen.validate(close).length > 0);
  const broken = JSON.parse(JSON.stringify(good));
  broken.routes[0][2] = [broken.routes[0][2][0] + 500, broken.routes[0][2][1]];
  assert.ok(MapGen.validate(broken).length > 0);
  const dup = JSON.parse(JSON.stringify(good));
  dup.rules.enemies.push({ ...dup.rules.enemies[0] });
  assert.ok(MapGen.validate(dup).length > 0);
  const atA = JSON.parse(JSON.stringify(good));
  atA.rules.enemies[0].x = atA.rules.A.x;
  atA.rules.enemies[0].z = atA.rules.A.z;
  assert.ok(MapGen.validate(atA).length > 0);
  assert.throws(() => MapGen.generate(0, 1), RangeError);
  assert.throws(() => MapGen.generate(4, 1), RangeError);
});

test('generar es rápido y nunca entrega un mapa inválido ni de respaldo en 300 semillas', () => {
  const t0 = performance.now();
  let total = 0;
  for (let mission = 1; mission <= 3; mission++)
    for (let seed = 0; seed < 100; seed++) {
      const map = MapGen.generate(mission, seed * 7919 + 13);
      assert.deepEqual(MapGen.validate(map), [], `misión ${mission} semilla ${seed}`);
      assert.equal(map.meta.fallback, false);
      assert.ok(map.meta.attempts >= 1 && map.meta.attempts <= MapGen.MAX_ATTEMPTS);
      total++;
    }
  const meanMs = (performance.now() - t0) / total;
  assert.ok(meanMs < 100, `generar tarda ${meanMs.toFixed(2)} ms de media`);
});

test('todos los mapas generados son jugables: ruta transitable y escolta completa', () => {
  for (const mission of [1, 2, 3])
    for (const seed of [0, 1, 7, 123, 999]) {
      const map = MapGen.generate(mission, seed);
      const world = World.create(map);
      const m = new Escort.Mission(mission, map.rules);
      const cover = Collision.create(
        { DC: world.shrubs, DB: [], mission: m },
        world,
      );
      for (const route of map.routes)
        for (let i = 1; i < route.length; i++) {
          const [ax, az] = route[i - 1],
            [bx, bz] = route[i];
          const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
          for (let j = 0; j <= steps; j++) {
            const x = ax + ((bx - ax) * j) / steps,
              z = az + ((bz - az) * j) / steps;
            assert.ok(world.canTravel(x, z, 4), `m${mission} s${seed} ruta bloqueada`);
          }
        }
      const env = { groundAt: world.height, cover, enemies: [] };
      for (const a of m.allies.filter((a) => a.wounded))
        for (let i = 0; i < 40; i++) m.update(0.05, a, env);
      for (let i = 0; i < 2000 && m.stage !== 'COMPLETADA'; i++)
        m.update(0.05, m.finish, env);
      assert.equal(m.delivered, 7, `m${mission} s${seed}: ${m.stage}`);
      assert.equal(m.stage, 'COMPLETADA');
    }
});

test('el mundo usa la vegetación, los puntos de interés y el relieve del motor', () => {
  const a = MapGen.generate(1, 11),
    b = MapGen.generate(1, 12);
  const wa = World.create(a),
    wb = World.create(b);
  assert.deepEqual(wa.shrubs, a.scenery.shrubs);
  assert.deepEqual(wa.rocks, a.scenery.rocks);
  assert.deepEqual(
    wa.landmarks.map((p) => [p.x, p.z]),
    a.landmarks.map((p) => [p.x, p.z]),
  );
  assert.notDeepEqual(wa.shrubs, wb.shrubs);
  assert.notDeepEqual(wa.landmarks, wb.landmarks);
  assert.ok(wa.mesh().every(Number.isFinite));
});

test('la campaña en el juego: cada misión un mapa distinto, reintentar conserva, Mapa nuevo cambia', () => {
  const g = game(12);
  const { app, state } = g;
  app.start(1, true);
  const first = state.mapSeed,
    campaign = state.campaignSeed,
    roads = JSON.stringify(state.world.roads);
  assert.equal(typeof campaign, 'number');
  app.start(1, true, true);
  assert.equal(state.mapSeed, first);
  assert.equal(state.campaignSeed, campaign);
  app.start(2, false);
  assert.equal(state.campaignSeed, campaign);
  assert.notEqual(state.mapSeed, first);
  assert.notEqual(JSON.stringify(state.world.roads), roads);
  const second = state.mapSeed;
  app.start(3, false);
  assert.equal(state.campaignSeed, campaign);
  assert.notEqual(state.mapSeed, second);
  app.start(1, true);
  assert.notEqual(state.campaignSeed, campaign);
  assert.notEqual(state.mapSeed, first);
  // Botón «Mapa nuevo» del menú: otra campaña desde la misión 1.
  const before = state.mapSeed;
  g.element('menuNewMap').onclick();
  assert.equal(state.mis, 1);
  assert.notEqual(state.mapSeed, before);
});
