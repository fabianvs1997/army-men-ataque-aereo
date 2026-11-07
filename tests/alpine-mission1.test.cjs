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
  // Las misiones 2 y 3 también tienen sus puntos propios del
  // original (torres y portal, sin props de jardín): el circuito de
  // carretera y el patio de vías.
  for (const mission of [2, 3]) {
    const map = Maps.generate(mission);
    assert.deepEqual(
      map.landmarks.map((p) => p.kind),
      ['tower', 'portal', 'tower'],
    );
    for (const kind of ['planter', 'watering', 'bench'])
      assert.ok(
        !map.landmarks.some((p) => p.kind === kind),
        `la Misión ${mission} aún tiene ${kind}`,
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
  // Sin valla ni casa en ningún mapa fijo: el patio alpino, el
  // circuito y las vías no tienen jardín que vallar ni casa al fondo
  // (la valla vive en el borde, a |x| o |z| ≥ 470, y la casa es la
  // pieza color [0.76, 0.7, 0.58]).
  const hasFenceOrHouse = (world) =>
    world.yard.some(
      (p) =>
        Math.abs(p.x) >= 470 ||
        Math.abs(p.z) >= 470 ||
        (p.color &&
          p.color[0] === 0.76 &&
          p.color[1] === 0.7 &&
          p.color[2] === 0.58),
    );
  assert.equal(hasFenceOrHouse(world), false, 'el valle alpino tiene valla o casa');
  assert.equal(hasFenceOrHouse(World.create(Maps.generate(2))), false);
  assert.equal(hasFenceOrHouse(World.create(Maps.generate(3))), false);
  // La caja de suministros junto al puesto (B), el portal pasado C
  // y la torre junto a la base (A).
  const [crate, portal, tower] = world.landmarks;
  assert.ok(Math.hypot(crate.x - -150, crate.z - 170) < 80, 'caja lejos de B');
  assert.ok(Math.hypot(portal.x - 180, portal.z - 190) < 80, 'portal lejos de C');
  assert.ok(Math.hypot(tower.x - 0, tower.z - 0) < 60, 'torre lejos de A');
  // Las 4 torres de la base de salida: el punto `tower` más 3 fijas.
  // Cada torre son 4 patas + plataforma + 2 barandillas + tejado en
  // punta + mástil + bandera (11 piezas).
  assert.ok(world.yard.length >= 4 * 11, 'faltan torres de guardia');
  for (const p of world.landmarks) {
    assert.ok(world.trailDistance(p.x, p.z) > p.radius + 20, 'punto sobre la ruta');
    for (const pad of world.pads)
      assert.ok(
        Math.hypot(p.x - pad.x, p.z - pad.z) > p.radius + 8,
        'punto sobre un helipuerto',
      );
  }
});

test('pulido: pinos altos y en bosquetes, no sueltos y diminutos', () => {
  const m1 = Maps.generate(1);
  const pines = m1.scenery.shrubs;
  assert.equal(pines.length, 428);
  const sizes = pines.map((p) => p.s);
  assert.ok(Math.max(...sizes) >= 6, 'ningún pino alto');
  assert.ok(
    sizes.reduce((a, b) => a + b, 0) / sizes.length > 4,
    'pinos demasiado pequeños de media',
  );
  // Bosque agrupado: casi todos los pinos tienen otro pino cerca.
  let grouped = 0;
  for (const p of pines) {
    if (
      pines.some(
        (q) => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 25,
      )
    )
      grouped++;
  }
  assert.ok(
    grouped / pines.length >= 0.8,
    `pinos sueltos: solo ${grouped}/${pines.length} agrupados`,
  );
  assert.deepEqual(Maps.validate(m1), []);
});

test('pulido: valle con laderas suaves y bordes altos, portal brillante y torres sin tapar A', () => {
  const m1 = Maps.generate(1);
  const world = World.create(m1);
  // El terreno es llano en A y junto a la ruta, y sube en los bordes.
  assert.ok(world.height(0, 0) < 1, 'A no está en llano');
  assert.ok(world.height(420, 0) > 15, 'el borde este no sube como valle');
  assert.ok(world.height(0, 420) > 20, 'el borde norte no sube como valle');
  // Portal: halo en el suelo y columna de luz alta, visibles de lejos.
  const yard = world.yard;
  const color = (c) => (p) => JSON.stringify(p.color) === JSON.stringify(c);
  assert.ok(yard.some(color([0.98, 0.88, 0.55])), 'sin halo del portal');
  assert.ok(
    yard.some((p) => p.sy >= 15 && color([1, 0.9, 0.55])(p)),
    'sin columna de luz del portal',
  );
  // La caja grande de suministros ya no va en el patio: es la carga del
  // winch y la dibuja el renderizador desde `cargoCrate` (su dibujo se
  // comprueba en tests/defensas-winch-m1.test.cjs). En el patio queda
  // la segunda caja pequeña junto al puesto.
  assert.deepEqual(world.cargoCrate, { x: -170, z: 140 });
  assert.ok(
    yard.some((p) => p.sx === 3.5 && color([0.11, 0.36, 0.12])(p)),
    'sin segunda caja de suministros',
  );
  // Las 4 torres llevan bandera verde y están a ~50 u de A, sin
  // rodear ni tapar el helipuerto desde la cámara.
  assert.ok(
    yard.filter(color([0.2, 0.72, 0.2])).length >= 4,
    'faltan banderas en las torres',
  );
  const [, , tower] = world.landmarks;
  assert.ok(
    Math.hypot(tower.x, tower.z) >= 45,
    'la torre de la base sigue pegada a A',
  );
  // Montañas: 14 con afloramientos cerca del portal, todas fuera de
  // las rutas y de los helipuertos.
  assert.equal(m1.scenery.mountains.length, 14);
  assert.ok(
    m1.scenery.mountains.some((m) => m.x > 250 && m.z > 220 && m.s <= 18),
    'sin afloramientos junto al portal',
  );
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
