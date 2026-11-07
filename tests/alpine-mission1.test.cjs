const test = require('node:test');
const assert = require('node:assert/strict');
const Maps = require('../src/original-maps.js');
const World = require('../src/toy-world.js');

// La Misión 1 es el valle alpino de «Plastic Pandemonium», no el
// jardín de una casa: la corrección investigada en
// workspace/research_notes/army-men-air-attack-first-map-20261107-0130/report.md.
// Solo el mapa cambia: A, B, C, rutas y enemigos son los de antes.
test('la Misión 1 es alpina: nombre, escenario y puntos alpinos, sin props de jardín', () => {
  const m1 = Maps.generate(1);
  assert.equal(m1.name, 'Pandemonio de Plástico');
  assert.equal(m1.scenario, 'Alpine');
  assert.match(m1.inspiration, /Plastic Pandemonium/);
  assert.deepEqual(
    m1.landmarks.map((p) => p.kind),
    ['crate', 'portal', 'tower'],
  );
  for (const kind of ['planter', 'watering', 'bench'])
    assert.ok(
      !m1.landmarks.some((p) => p.kind === kind),
      `la Misión 1 aún tiene ${kind}`,
    );
  // Las misiones 2 y 3 no se tocan: siguen con sus puntos de jardín.
  for (const mission of [2, 3]) {
    const map = Maps.generate(mission);
    assert.deepEqual(
      map.landmarks.map((p) => p.kind),
      ['planter', 'watering', 'bench'],
    );
    assert.equal(map.scenery.mountains.length, 0);
  }
});

test('la Misión 1 conserva su trazado y su dificultad: A, B, C, rutas y enemigos intactos', () => {
  const m1 = Maps.generate(1);
  assert.deepEqual(m1.rules.A, { x: 0, z: 0 });
  assert.deepEqual(m1.rules.B, { x: -150, z: 170 });
  assert.deepEqual(m1.rules.C, { x: 180, z: 190 });
  assert.deepEqual(m1.routes, [
    [
      [0, 0],
      [-40, 30],
      [-80, 70],
      [-110, 110],
      [-135, 145],
      [-150, 170],
    ],
    [
      [-150, 170],
      [-90, 185],
      [-30, 200],
      [30, 195],
      [90, 185],
      [140, 185],
      [180, 190],
    ],
  ]);
  const enemies = m1.rules.enemies;
  assert.equal(
    enemies.reduce((sum, e) => sum + e.hp, 0),
    117,
  );
  assert.equal(enemies.filter((e) => e.k === 'tank').length, 3);
  assert.equal(enemies.filter((e) => e.k === 'tur').length, 4);
  assert.equal(m1.rules.extraAir.length, 0);
  assert.deepEqual(Maps.validate(m1), []);
});

test('el mundo alpino no tiene valla ni casa, y sus puntos están junto a A, B y C', () => {
  const m1 = Maps.generate(1);
  const world = World.create(m1);
  assert.equal(world.alpine, true);
  assert.equal(World.create(Maps.generate(2)).alpine, false);
  assert.equal(World.create(Maps.generate(3)).alpine, false);
  // Sin valla ni casa: el patio alpino tiene muchas menos piezas que
  // el jardín (valla + casa + macetero + regadera + banco + manguera).
  assert.ok(
    world.yard.length < World.create(Maps.generate(2)).yard.length,
    `patio alpino con ${world.yard.length} piezas`,
  );
  // La caja de suministros junto al puesto (B), el portal pasado C
  // y la torre junto a la base (A).
  const [crate, portal, tower] = world.landmarks;
  assert.ok(Math.hypot(crate.x - -150, crate.z - 170) < 80, 'caja lejos de B');
  assert.ok(Math.hypot(portal.x - 180, portal.z - 190) < 80, 'portal lejos de C');
  assert.ok(Math.hypot(tower.x - 0, tower.z - 0) < 60, 'torre lejos de A');
  // Las 4 torres de la base de salida: el punto `tower` más 3 fijas.
  // Cada torre son 4 patas + plataforma + 2 barandillas + tejado.
  assert.ok(world.yard.length >= 4 * 8, 'faltan torres de guardia');
  for (const p of world.landmarks) {
    assert.ok(world.trailDistance(p.x, p.z) > p.radius + 20, 'punto sobre la ruta');
    for (const pad of world.pads)
      assert.ok(
        Math.hypot(p.x - pad.x, p.z - pad.z) > p.radius + 8,
        'punto sobre un helipuerto',
      );
  }
});

test('la Misión 1 es un bosque de pinos con montañas de borde, fuera de las rutas', () => {
  const m1 = Maps.generate(1);
  assert.ok(m1.scenery.shrubs.length > 400, 'pocos pinos');
  assert.ok(m1.scenery.shrubs.every((s) => s.t === 'pine'), 'arbusto que no es pino');
  assert.ok(
    Maps.generate(2).scenery.shrubs.every((s) => s.t === 'shrub'),
    'la Misión 2 también se volvió pino',
  );
  const mountains = m1.scenery.mountains;
  assert.ok(mountains.length >= 10, 'pocas montañas');
  const dist = (x, z, routes) => {
    let best = Infinity;
    for (const route of routes)
      for (let i = 1; i < route.length; i++) {
        const [ax, az] = route[i - 1],
          [bx, bz] = route[i],
          dx = bx - ax,
          dz = bz - az,
          len2 = dx * dx + dz * dz,
          t =
            len2 === 0
              ? 0
              : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
        best = Math.min(
          best,
          Math.hypot(x - (ax + t * dx), z - (az + t * dz)),
        );
      }
    return best;
  };
  for (const m of mountains) {
    assert.ok(m.s >= 14, 'montaña demasiado pequeña');
    assert.ok(dist(m.x, m.z, m1.routes) >= 40, 'montaña sobre la ruta');
    for (const p of [m1.rules.A, m1.rules.B, m1.rules.C])
      assert.ok(Math.hypot(m.x - p.x, m.z - p.z) >= 40, 'montaña sobre un helipuerto');
  }
  // Montañas a la derecha del camino cerca del portal (guía del
  // original: desvío a la derecha, junto a las montañas) y en los bordes.
  assert.ok(
    mountains.some((m) => m.x > 150 && m.z > 240),
    'sin montañas junto al portal',
  );
  const world = World.create(m1);
  assert.deepEqual(world.mountains, mountains);
  assert.ok(world.mesh().every(Number.isFinite));
  for (const route of m1.routes)
    for (let i = 1; i < route.length; i++) {
      const [ax, az] = route[i - 1],
        [bx, bz] = route[i];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
      for (let j = 0; j <= steps; j++) {
        const x = ax + ((bx - ax) * j) / steps,
          z = az + ((bz - az) * j) / steps;
        assert.ok(world.canTravel(x, z, 4), 'ruta alpina bloqueada');
      }
    }
});
