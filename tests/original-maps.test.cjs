const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Maps = require('../src/original-maps.js');
const MissionMap = require('../src/mission-map.js');
const World = require('../src/toy-world.js');
const Collision = require('../src/collision.js');
const Escort = require('../src/escort-mission.js');

test('cada misión tiene un mapa fijo: siempre el mismo, distinto de las otras dos', () => {
  assert.deepEqual(Maps.generate(1), Maps.generate(1));
  assert.deepEqual(MissionMap.generate(999, 1), MissionMap.generate(1, 1));
  assert.deepEqual(MissionMap.generate(123), MissionMap.generate(456));
  const maps = [1, 2, 3].map((n) => Maps.generate(n));
  assert.deepEqual(
    maps.map((m) => [m.name, m.scenario, m.seed]),
    [
      ['Pandemonio de Plástico', 'Alpine', 101],
      ['Locura de coches', 'Road', 202],
      ['El tren que pudo', 'Rail', 303],
    ],
  );
  assert.notDeepEqual(maps[0].rules.A, maps[1].rules.A);
  assert.notDeepEqual(maps[0].rules.B, maps[1].rules.B);
  assert.notDeepEqual(maps[0].rules.C, maps[2].rules.C);
  assert.notDeepEqual(maps[0].routes, maps[1].routes);
  assert.notDeepEqual(maps[1].routes, maps[2].routes);
  assert.notDeepEqual(maps[0].terrain, maps[2].terrain);
  assert.notDeepEqual(maps[0].landmarks, maps[1].landmarks);
  assert.notDeepEqual(maps[0].rules.enemies, maps[1].rules.enemies);
  // La campaña son los tres mapas fijos, sin semillas de campaña.
  const campaign = Maps.generateCampaign();
  assert.deepEqual(
    campaign.maps.map((m) => m.name),
    ['Pandemonio de Plástico', 'Locura de coches', 'El tren que pudo'],
  );
  assert.deepEqual(campaign.seeds, [101, 202, 303]);
  assert.ok(campaign.maps.every((m) => Maps.validate(m).length === 0));
  assert.throws(() => Maps.generate(0), RangeError);
  assert.throws(() => Maps.generate(4), RangeError);
});

test('la dificultad crece con la misión: más vida y más tanques en la 3 que en la 1', () => {
  const totals = [1, 2, 3].map((mission) => {
    const map = Maps.generate(mission);
    return {
      hp: map.rules.enemies.reduce((sum, e) => sum + e.hp, 0),
      tanks: map.rules.enemies.filter((e) => e.k === 'tank').length,
      turrets: map.rules.enemies.filter((e) => e.k === 'tur').length,
      air: map.rules.extraAir.length,
    };
  });
  assert.deepEqual(totals, [
    // Misión 1 del vídeo: sin helicóptero Tan, 3 tanques guardando
    // la caja, 1 jeep al norte y 7 de infantería en grupos (147 HP).
    { hp: 147, tanks: 6, turrets: 4, air: 0 },
    // Misión 2: 132 + 30 de los 3 garajes Tan (10 HP cada uno).
    { hp: 162, tanks: 6, turrets: 4, air: 1 },
    // Misión 3: 156 + 8 del helicóptero Tan que robó la batería.
    { hp: 164, tanks: 9, turrets: 7, air: 2 },
  ]);
  assert.ok(totals[2].hp > totals[1].hp && totals[1].hp > totals[0].hp);
});

test('validate rechaza mapas imposibles: objetivos juntos, ruta rota, enemigos duplicados o en la salida', () => {
  const good = Maps.generate(1);
  assert.deepEqual(Maps.validate(good), []);
  const close = JSON.parse(JSON.stringify(good));
  close.rules.B = { x: close.rules.A.x + 10, z: close.rules.A.z };
  assert.ok(Maps.validate(close).length > 0);
  const broken = JSON.parse(JSON.stringify(good));
  broken.routes[0][2] = [broken.routes[0][2][0] + 500, broken.routes[0][2][1]];
  assert.ok(Maps.validate(broken).length > 0);
  const dup = JSON.parse(JSON.stringify(good));
  dup.rules.enemies.push({ ...dup.rules.enemies[0] });
  assert.ok(Maps.validate(dup).length > 0);
  const atA = JSON.parse(JSON.stringify(good));
  atA.rules.enemies[0].x = atA.rules.A.x;
  atA.rules.enemies[0].z = atA.rules.A.z;
  assert.ok(Maps.validate(atA).length > 0);
});

test('los tres mapas fijos son jugables: ruta transitable y escolta completa', () => {
  for (const mission of [1, 2, 3]) {
    const map = Maps.generate(mission);
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
          assert.ok(world.canTravel(x, z, 4), `m${mission} ruta bloqueada`);
        }
      }
    const env = { groundAt: world.height, cover, enemies: [] };
    for (const a of m.allies.filter((a) => a.wounded))
      for (let i = 0; i < 40; i++) m.update(0.05, a, env);
    // Fases finales por misión: la caja y el portal (Misión 1), los
    // garajes Tan (Misión 2) y la batería, el tren y el portal
    // (Misión 3). El tren tarda ~67 s en llegar a C, así que el
    // tope es generoso (150 s de juego).
    const player = mission === 1 ? { ...m.rules.B } : { ...m.finish };
    // Misión 1 del vídeo: sin escolta, el jugador va a B y, sin
    // amenazas, pasa directo a la caja y el portal (la rama de
    // CARGA_PORTAL del bucle lo lleva de la caja al portal).
    const tanHeli = map.rules.enemies.find((e) => e.id === 'tan-heli');
    for (let i = 0; i < 3000 && m.stage !== 'COMPLETADA'; i++) {
      if (m.stage === 'CARGA_PORTAL' && m.cargo) {
        const target = m.cargo.state === 'carried' ? m.portal : m.cargo;
        player.x = target.x;
        player.z = target.z;
      } else if (m.stage === 'GARAJES') {
        // Misión 2: destruir los garajes Tan tras la entrega en C.
        for (const g of m.garages)
          m.enemyEliminated({ id: g.id, k: 'garage' });
      } else if (m.stage === 'ENTREGA_C' && m.train) {
        // Misión 3: si la batería sigue en el helicóptero Tan,
        // derribarlo; si está caída, levantarla con el winch; si
        // cuelga, llevarla a la plataforma; si el tren va en camino,
        // esperar en C.
        if (m.cargo.state === 'hidden' && tanHeli)
          m.enemyEliminated({
            id: 'tan-heli',
            k: 'heli',
            x: tanHeli.x,
            z: tanHeli.z,
          });
        else if (m.cargo.state === 'waiting') {
          player.x = m.cargo.x;
          player.z = m.cargo.z;
        } else if (m.cargo.state === 'carried' && m.batteryPad) {
          player.x = m.batteryPad.x;
          player.z = m.batteryPad.z;
        }
        if (m.train.state !== 'waiting') {
          player.x = m.finish.x;
          player.z = m.finish.z;
        }
      } else if (m.stage === 'PORTAL' && m.portal) {
        player.x = m.portal.x;
        player.z = m.portal.z;
      }
      m.update(0.05, player, env);
    }
    // Misión 1 del vídeo: sin pelotón, nadie que entregar (0); las
    // misiones 2 y 3 entregan a los 7.
    assert.equal(m.delivered, mission === 1 ? 0 : 7, `m${mission}: ${m.stage}`);
    assert.equal(m.stage, 'COMPLETADA');
  }
});

test('el mundo usa la vegetación, los puntos de interés y el relieve de cada mapa fijo', () => {
  const maps = [1, 2, 3].map((n) => Maps.generate(n));
  const worlds = maps.map((m) => World.create(m));
  assert.deepEqual(worlds[0].shrubs, maps[0].scenery.shrubs);
  assert.deepEqual(worlds[0].rocks, maps[0].scenery.rocks);
  assert.deepEqual(
    worlds[1].landmarks.map((p) => [p.x, p.z]),
    maps[1].landmarks.map((p) => [p.x, p.z]),
  );
  assert.notDeepEqual(worlds[0].shrubs, worlds[2].shrubs);
  assert.notDeepEqual(worlds[0].landmarks, worlds[2].landmarks);
  // El patio de vías es llano y abierto; el valle alpino, el más arbolado.
  assert.ok(maps[2].terrain.amp < maps[0].terrain.amp);
  assert.ok(maps[0].scenery.shrubs.length > maps[2].scenery.shrubs.length);
  // La Misión 3 ya no es playa: sin castillos de arena (menos rocas
  // que el valle) y con vías de tren que cruzan el mapa.
  assert.ok(maps[2].scenery.rocks.length < maps[0].scenery.rocks.length);
  assert.ok(maps[2].tracks.length >= 2);
  assert.ok(maps[2].rules.train);
  for (const [i, world] of worlds.entries()) {
    assert.ok(world.mesh().every(Number.isFinite));
    for (const p of world.landmarks) {
      assert.ok(
        world.trailDistance(p.x, p.z) > p.radius + 20,
        `m${i + 1} punto de interés sobre la ruta`,
      );
      for (const pad of world.pads)
        assert.ok(
          Math.hypot(p.x - pad.x, p.z - pad.z) > p.radius + 8,
          `m${i + 1} punto de interés sobre un helipuerto`,
        );
    }
  }
});

test('no queda rastro del motor random: ni mapgen, ni Mapa nuevo, ni semillas de campaña', () => {
  const root = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
  for (const file of [
    '../src/bootstrap.js',
    '../src/game.js',
    '../src/mission-map.js',
    '../src/ui.js',
    '../index.html',
  ])
    assert.ok(!root(file).includes('mapgen'), `${file} aún menciona mapgen`);
  assert.ok(!root('../index.html').includes('menuNewMap'));
  assert.ok(!root('../index.html').includes('Mapa nuevo'));
  assert.ok(!root('../src/ui.js').includes('menuNewMap'));
  assert.ok(!root('../src/game.js').includes('campaignSeed'));
  assert.ok(!fs.existsSync(path.join(__dirname, '../src/mapgen.js')));
  assert.ok(!fs.existsSync(path.join(__dirname, '../tests/mapgen.test.cjs')));
  assert.ok(!fs.existsSync(path.join(__dirname, '../docs/MAPGEN.md')));
  const bootstrap = require('../src/bootstrap.js');
  assert.ok(bootstrap.scripts.includes('original-maps'));
  assert.ok(!bootstrap.scripts.includes('mapgen'));
  assert.equal(bootstrap.VERSION, 'mapa-m1-video-1');
});
