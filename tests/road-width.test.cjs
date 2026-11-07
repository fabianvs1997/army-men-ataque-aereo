const { test } = require('node:test');
const assert = require('node:assert/strict');
const Maps = require('../src/original-maps.js');
const World = require('../src/toy-world.js');

// El camino del original es ANCHO: 30 u en total (medio ancho 15),
// 3x el anterior de 10 u (medio ancho 5). La única fuente de verdad
// es el mundo (ToyWorld.roadHalfWidth); los mapas fijos usan el
// mismo valor y hay un test que comprueba que coinciden.
const OLD_FULL_WIDTH = 10;

test('el camino es mucho más ancho: 30 u en total, 3x el anterior', () => {
  assert.equal(World.roadHalfWidth, 15);
  assert.equal(Maps.ROAD_HALF_WIDTH, 15);
  assert.equal(Maps.ROAD_HALF_WIDTH, World.roadHalfWidth);
  assert.equal(Maps.ROAD_HALF_WIDTH * 2, 3 * OLD_FULL_WIDTH);
  const world = World.create();
  assert.equal(world.roadHalfWidth, 15);
  assert.ok(world.roads.length > 0);
  for (const road of world.roads) {
    assert.equal(road.halfWidth, 15);
    assert.ok(road.length > 0);
  }
  // En los 3 mapas fijos, el mundo hereda el mismo ancho.
  for (const mission of [1, 2, 3]) {
    const map = Maps.generate(mission);
    const w = World.create(map);
    assert.equal(w.roadHalfWidth, 15);
    assert.ok(w.roads.every((r) => r.halfWidth === 15));
  }
});

test('el terreno es llano bajo todo el ancho del camino', () => {
  for (const mission of [1, 2, 3]) {
    const map = Maps.generate(mission);
    const world = World.create(map);
    // Muestreo perpendicular al camino en cada tramo: a ±14 u de la
    // línea central el terreno sigue siendo llano (la caja del camino
    // no flota ni se hunde en las colinas), y el arcén llano llega
    // hasta ±24 u, donde van las patrullas que flanquean la ruta
    // (ahí la malla de alturas, de paso 4 u, puede interpolar hasta
    // ~1 u, que sigue siendo llano para canTravel).
    for (const road of world.roads) {
      const px = Math.cos(road.yaw),
        pz = -Math.sin(road.yaw);
      for (const off of [-14, -7, 0, 7, 14]) {
        const h = world.height(road.x + px * off, road.z + pz * off);
        assert.ok(
          h < 0.12,
          `m${mission} camino con colina a ${off} u: ${h}`,
        );
      }
      for (const off of [-24, 24]) {
        const h = world.height(road.x + px * off, road.z + pz * off);
        assert.ok(h < 1, `m${mission} arcén con colina a ${off} u: ${h}`);
      }
      assert.ok(world.height(road.x, road.z) < 0.12);
    }
  }
});

test('vegetación y patrullas quedan fuera del camino ensanchado', () => {
  for (const mission of [1, 2, 3]) {
    const map = Maps.generate(mission);
    assert.deepEqual(Maps.validate(map), []);
    const world = World.create(map);
    // Arbustos y rocas, al menos 28 u de la ruta (15 de medio camino
    // + 13 de margen): no invaden el camino ensanchado ni solapan a
    // las patrullas que lo flanquean a ±19 u.
    for (const s of world.shrubs)
      assert.ok(
        world.trailDistance(s.x, s.z) >= Maps.ROUTE_CLEARANCE,
        `m${mission} arbusto sobre el camino`,
      );
    for (const s of world.rocks)
      assert.ok(
        world.trailDistance(s.x, s.z) >= Maps.ROUTE_CLEARANCE,
        `m${mission} roca sobre el camino`,
      );
    // Las patrullas flanquean la ruta fuera del camino (±19 u): antes
    // bastaba ±9 porque el camino tenía 5 u de medio ancho.
    for (const e of map.rules.enemies.filter((e) =>
      e.id.startsWith('patrol-'),
    ))
      assert.ok(
        world.trailDistance(e.x, e.z) >= Maps.ROAD_HALF_WIDTH,
        `m${mission} patrulla ${e.id} sobre el camino`,
      );
  }
});
