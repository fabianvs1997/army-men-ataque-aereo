const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Maps = require('../src/original-maps.js');
const World = require('../src/toy-world.js');

// Solo el terreno de la Misión 1, replicado del video de Fabian
// (125,5 s de gameplay del Army Men: Air Attack original de PS1,
// fotogramas f001–f025, 1 cada 5 s): colinas verdes onduladas con
// manchas de tierra en todo el valle, crestas rocosas grises y
// pinos en grupos. El video es la Misión 1, «Plastic Pandemonium»
// (Huey verde, caja verde con el winch, tanques Tan, portal al
// final): no hay plano público del original, así que el trazado es
// reconstrucción a partir de los fotogramas y de la investigación en
// workspace/research_notes/army-men-air-attack-first-map-20261107-0130/report.md.
// Solo terreno: no se añaden sacos, vallas, tiendas, cajas, torres,
// enemigos, HUD ni sonidos; las misiones 2 y 3 no se tocan.

test('la Misión 1 define las crestas rocosas del video: norte, este junto al portal y oeste', () => {
  const m1 = Maps.generate(1);
  const ridges = m1.terrain.ridges;
  assert.equal(ridges.length, 3);
  for (const ridge of ridges) {
    // Alturas 18/16/16 desde el mapa de la Misión 1 según el vídeo
    // (antes 14/12/12): la cámara mira 40° hacia abajo y las crestas
    // tienen que subir para leerse con roca y nieve desde la ruta.
    assert.ok(ridge.h >= 12 && ridge.h <= 18, 'cresta demasiado alta o baja');
    assert.ok(ridge.points.length >= 3, 'cresta sin forma');
  }
  // Norte (z ~300), este a la derecha del camino cerca del portal
  // (x ~300) y oeste (x ~-370), como en los fotogramas f011–f023.
  assert.ok(ridges.some((r) => r.points.every(([, z]) => z >= 280)), 'sin cresta norte');
  assert.ok(ridges.some((r) => r.points.every(([x]) => x >= 300)), 'sin cresta este');
  assert.ok(ridges.some((r) => r.points.every(([x]) => x <= -340)), 'sin cresta oeste');
  assert.deepEqual(Maps.validate(m1), []);
  // Las misiones 2 y 3 no tienen crestas: su relieve no se toca.
  assert.equal(Maps.generate(2).terrain.ridges, undefined);
  assert.equal(Maps.generate(3).terrain.ridges, undefined);
});

test('el terreno ondula en todo el valle: colinas verdes, no llano ni muro', () => {
  const m1 = Maps.generate(1);
  const world = World.create(m1);
  // El camino y los helipuertos siguen en llano.
  for (const [x, z] of [
    [0, 0],
    [-150, 170],
    [180, 190],
  ])
    assert.ok(world.height(x, z) < 1, `helipuerto (${x}, ${z}) no está en llano`);
  // A 40–150 u del camino el suelo ya es colina: ni llano (0) ni
  // muro de borde (>30). La muestra cubre los dos lados del camino.
  const samples = [
    [-60, 120],
    [60, 120],
    [-220, 60],
    [100, 80],
    [-60, -120],
    [-300, -100],
    [150, -150],
  ];
  const heights = samples.map(([x, z]) => world.height(x, z));
  for (const h of heights) assert.ok(h > 8 && h < 30, `colina fuera de rango: ${h}`);
  assert.ok(
    Math.max(...heights) - Math.min(...heights) >= 8,
    `terreno sin ondulación: ${heights.map((h) => h.toFixed(1)).join(', ')}`,
  );
  // Las crestas se leen como roca alta: por encima de las colinas.
  for (const [x, z] of [
    [0, 330],
    [320, 160],
    [-370, 60],
  ])
    assert.ok(world.height(x, z) > 20, `cresta (${x}, ${z}) demasiado baja`);
  // Acotado: las esquinas del patio ampliado siguen por debajo de
  // 30 u, como exige el test de terreno ancho.
  for (const [x, z] of [
    [350, -350],
    [-350, 350],
  ])
    assert.ok(world.height(x, z) < 30, `esquina (${x}, ${z}) demasiado alta`);
  // Determinista: dos mundos dan la misma altura.
  const again = World.create(Maps.generate(1));
  assert.equal(world.height(123, -234), again.height(123, -234));
});

test('la ruta del pelotón sigue llana y transitable con el relieve nuevo', () => {
  const m1 = Maps.generate(1);
  const world = World.create(m1);
  for (const route of m1.routes)
    for (let i = 1; i < route.length; i++) {
      const [ax, az] = route[i - 1],
        [bx, bz] = route[i];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
      for (let j = 0; j <= steps; j++) {
        const x = ax + ((bx - ax) * j) / steps,
          z = az + ((bz - az) * j) / steps;
        assert.ok(world.height(x, z) < 1, `ruta con relieve en (${x.toFixed(0)}, ${z.toFixed(0)})`);
        assert.ok(world.canTravel(x, z, 4), 'ruta alpina bloqueada');
      }
    }
});

test('el shader alpino pinta manchas de tierra grandes y pasto moteado, como el video', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../src/toy-renderer.js'),
    'utf8',
  );
  // Manchas de tierra a mitad de frecuencia que antes (parches
  // grandes color canela sobre las lomas, fotogramas f014/f024) y
  // moteado grande de verde claro/oscuro en todo el pasto.
  assert.ok(src.includes('.055'), 'manchas de tierra sin agrandar');
  assert.ok(src.includes('mottle'), 'sin moteado grande del pasto');
  assert.ok(src.includes('.021'), 'moteado sin escala grande');
});
