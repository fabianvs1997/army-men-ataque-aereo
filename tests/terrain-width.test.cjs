const { test } = require('node:test');
const assert = require('node:assert/strict');
const Maps = require('../src/original-maps.js');
const World = require('../src/toy-world.js');

// Todo el terreno es más ancho, no solo el camino: el límite pasa
// de 320 a 480 u (terreno de 960 × 960 u, 1,5x de ancho y 2,25x
// de área). Las posiciones de A, B y C no se mueven: la misión
// dura lo mismo, lo que crece es el patio alrededor.
const OLD_LIMIT = 320;
const NEW_LIMIT = 480;

test('el terreno es 1,5x más ancho: límite 480, patio de 960 × 960', () => {
  assert.equal(Maps.LIMIT, NEW_LIMIT);
  assert.equal(NEW_LIMIT, OLD_LIMIT * 1.5);
  for (const mission of [1, 2, 3]) {
    const map = Maps.generate(mission);
    assert.equal(map.limit, NEW_LIMIT);
    assert.equal(map.limit * 2, 960);
    const world = World.create(map);
    assert.equal(world.limit, NEW_LIMIT);
    // La malla crece con el cuadrado del límite: 240 × 240 celdas
    // de 4 u (2 073 600 valores, ~8 MB), finita y sin huecos.
    const mesh = world.mesh();
    assert.equal(mesh.length, 240 * 240 * 36);
    assert.ok(mesh.every(Number.isFinite));
  }
});

test('A, B y C no se mueven: las distancias de misión son las mismas', () => {
  assert.deepEqual(
    [1, 2, 3].map((n) => {
      const m = Maps.generate(n);
      return [m.rules.A, m.rules.B, m.rules.C];
    }),
    [
      [
        { x: 0, z: 0 },
        { x: -150, z: 170 },
        { x: 180, z: 190 },
      ],
      [
        { x: -30, z: -80 },
        { x: 85, z: 175 },
        { x: 240, z: 40 },
      ],
      [
        { x: 60, z: -40 },
        { x: -180, z: 120 },
        { x: 120, z: 220 },
      ],
    ],
  );
  for (const mission of [1, 2, 3]) {
    const { A, B, C } = Maps.generate(mission).rules;
    // Dentro del patio ampliado con margen, y lejos de los bordes.
    for (const p of [A, B, C]) {
      assert.ok(Math.abs(p.x) < NEW_LIMIT - 100);
      assert.ok(Math.abs(p.z) < NEW_LIMIT - 100);
    }
    assert.ok(Math.hypot(B.x - A.x, B.z - A.z) >= 200);
    assert.ok(Math.hypot(C.x - B.x, C.z - B.z) >= 190);
  }
});

test('la vegetación llena el patio ampliado sin salir de los límites', () => {
  // Densidad como antes del ensanche (área 2,25x): los conteos
  // suben en la misma proporción para no dejar zonas vacías.
  const minimums = [
    { shrubs: 400, rocks: 250 },
    { shrubs: 300, rocks: 180 },
    { shrubs: 150, rocks: 350 },
  ];
  for (const mission of [1, 2, 3]) {
    const map = Maps.generate(mission);
    const { shrubs, rocks } = map.scenery;
    assert.ok(shrubs.length >= minimums[mission - 1].shrubs);
    assert.ok(rocks.length >= minimums[mission - 1].rocks);
    for (const s of [...shrubs, ...rocks]) {
      assert.ok(Math.abs(s.x) < NEW_LIMIT - 10, `m${mission} fuera del patio`);
      assert.ok(Math.abs(s.z) < NEW_LIMIT - 10, `m${mission} fuera del patio`);
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z));
    }
    // El mundo hereda la vegetación del mapa y la valla y la casa
    // quedan en el borde del patio ampliado, no en el centro.
    const world = World.create(map);
    assert.deepEqual(world.shrubs, shrubs);
    assert.deepEqual(world.rocks, rocks);
    const yardZ = world.yard.map((p) => Math.abs(p.z));
    assert.ok(Math.max(...yardZ) <= NEW_LIMIT + 20);
    assert.ok(Math.max(...world.yard.map((p) => Math.abs(p.x))) <= NEW_LIMIT + 1);
  }
});

test('las rutas siguen transitables en el patio ampliado', () => {
  for (const mission of [1, 2, 3]) {
    const map = Maps.generate(mission);
    const world = World.create(map);
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
    // El helicóptero puede maniobrar lejos del camino, dentro del
    // patio ampliado: el suelo ahí es colina (altura finita y
    // acotada), no un vacío fuera del mundo. El pelotón camina por
    // las rutas llanas; las colinas no son transitables a pie.
    for (const [x, z] of [
      [350, -350],
      [-350, 350],
    ]) {
      const h = world.height(x, z);
      assert.ok(Number.isFinite(h) && h >= 0 && h < 30);
      assert.ok(Math.abs(x) < world.limit && Math.abs(z) < world.limit);
    }
  }
});
