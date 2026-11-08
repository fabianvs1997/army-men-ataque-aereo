const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Maps = require('../src/original-maps.js');
const World = require('../src/toy-world.js');
const Renderer = require('../src/toy-renderer.js');

// Mapa de la Misión 1 según el vídeo del original (125,5 s,
// catalogado en departamento-videojuegos/catalogo-mision-video-m1.md):
// camino de tierra marrón oscuro y estrecho (f006), césped liso sin
// damero, parches grandes de tierra canela (f060), colinas que ondulan
// por todo el valle, rocas grises claras (f060, f074), crestas con
// nieve que cierran el mapa (f045) y pinos en bosquecillos (f010).
// Solo se toca la Misión 1: ni reglas, ni enemigos, ni HUD, ni sonido,
// ni M2/M3. El ancho jugable del camino no cambia (medio ancho 15 en
// el mundo); solo cambia lo que se dibuja.

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Espejo en JS de la tierra del shader alpino (rama gloss < -2.5 en
// src/toy-renderer.js): dos senos de baja frecuencia, parches de
// decenas de unidades, no el seno fino de antes.
const dirtMix = (x, z) =>
  smoothstep(
    0.2,
    0.6,
    Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.013 + 0.7) +
      0.5 * Math.sin(x * 0.023 + 4.0) * Math.cos(z * 0.019 + 2.0),
  ) * 0.8;
const baseDirtMix = (x, z) => smoothstep(70, 25, Math.hypot(x, z)) * 0.55;

const m1 = () => Maps.generate(1);
const world1 = () => World.create(m1());

test('el camino se dibuja oscuro y estrecho en M1, pero el mundo sigue con medio ancho 15', () => {
  const world = world1();
  assert.equal(world.roadHalfWidth, 15);
  assert.ok(world.roads.every((r) => r.halfWidth === 15));
  // La sombra sigue apoyándose en el camino ancho (surfaceTop).
  const parts = drawParts(world, { x: 0, z: 0 });
  const roadBoxes = parts.filter((p) => p.size[1] === 0.04);
  assert.ok(roadBoxes.length > 0, 'sin cajas de camino dibujadas');
  const main = roadBoxes.filter(
    (p) => p.color[0] === 0.25 && p.color[1] === 0.2 && p.color[2] === 0.12,
  );
  assert.ok(main.length > 0, 'sin camino marrón oscuro');
  assert.ok(
    main.every((p) => p.size[0] === 8),
    'el camino dibujado no tiene medio ancho visual 8',
  );
  const stripe = roadBoxes.filter(
    (p) => p.color[0] === 0.22 && p.color[1] === 0.17 && p.color[2] === 0.1,
  );
  assert.ok(stripe.length > 0, 'sin franja central oscura');
  assert.ok(stripe.every((p) => Math.abs(p.size[0] - 4.4) < 1e-9));
  // Nada de la banda canela clara de antes en M1.
  assert.ok(
    !roadBoxes.some((p) => p.color[0] === 0.6 && p.color[1] === 0.48),
    'sigue la banda canela clara',
  );
});

test('en M2/M3 el camino conserva su aspecto claro y ancho', () => {
  for (const mission of [2, 3]) {
    const world = World.create(Maps.generate(mission));
    const parts = drawParts(world, { x: 0, z: 0 });
    const roadBoxes = parts.filter((p) => p.size[1] === 0.04);
    assert.ok(roadBoxes.length > 0, `m${mission} sin camino`);
    assert.ok(
      roadBoxes.some((p) => p.color[0] === 0.6 && p.size[0] === 15),
      `m${mission} con camino cambiado`,
    );
    assert.ok(
      !roadBoxes.some((p) => p.color[0] === 0.25),
      `m${mission} con camino oscuro de M1`,
    );
  }
});

test('la malla tiene normales suavizadas: sin damero de triángulos', () => {
  const world = world1();
  const mesh = world.mesh();
  assert.equal(mesh.length % 36, 0);
  // Cada celda son 2 triángulos x 3 vértices x 6 flotantes; la esquina
  // compartida lleva la MISMA normal en los dos triángulos (con
  // normales por cara serían distintas) y todas son unitarias.
  const cellsPerRow = 240;
  for (let cell = 0; cell < 200; cell++) {
    const base = cell * 36;
    // Vértice a: primero del triángulo 1 y primero del triángulo 2.
    const n1 = mesh.slice(base + 3, base + 6),
      n2 = mesh.slice(base + 18 + 3, base + 18 + 6);
    assert.deepEqual([...n1], [...n2], `celda ${cell} con normal por cara`);
    for (let v = 0; v < 6; v++) {
      const n = mesh.slice(base + v * 6 + 3, base + v * 6 + 6);
      assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-5, 'normal no unitaria');
      assert.ok(n[1] > 0, 'normal apuntando hacia abajo');
    }
  }
  // La normal es el gradiente del heightfield, no un valor fijo.
  const at = (x, z) => {
    const gx = (world.height(x + 4, z) - world.height(x - 4, z)) / 8,
      gz = (world.height(x, z + 4) - world.height(x, z - 4)) / 8,
      l = Math.hypot(gx, 1, gz);
    return [-gx / l, 1 / l, -gz / l];
  };
  // Primer vértice de la celda (0,0): esquina interior, donde el
  // gradiente simétrico del test coincide con el de la malla.
  const cell00 = (120 * 240 + 120) * 36,
    n0 = [...mesh.slice(cell00 + 3, cell00 + 6)],
    expect = at(0, 0);
  for (let i = 0; i < 3; i++)
    assert.ok(Math.abs(n0[i] - expect[i]) < 0.05, 'normal distinta del gradiente');
  // Y varía por el mapa: no es una normal constante.
  const seen = new Set();
  for (let i = 0; i < mesh.length; i += 6 * 997)
    seen.add(mesh[i + 4].toFixed(3));
  assert.ok(seen.size > 10, 'normales casi constantes');
  assert.ok(cellsPerRow > 0);
});

test('los parches de tierra son grandes: cobertura 25–40% del valle, no 12%', () => {
  const world = world1();
  let n = 0,
    visible = 0,
    strong = 0;
  for (let z = -440; z <= 440; z += 4)
    for (let x = -440; x <= 440; x += 4) {
      if (world.height(x, z) >= 12) continue;
      n++;
      const d = dirtMix(x, z);
      if (d > 0.15) visible++;
      if (d > 0.4) strong++;
    }
  assert.ok(n > 5000, 'pocas celdas de valle');
  assert.ok(
    visible / n > 0.25 && visible / n < 0.4,
    `tierra visible ${(100 * visible / n).toFixed(1)}%`,
  );
  assert.ok(
    strong / n > 0.15 && strong / n < 0.35,
    `tierra fuerte ${(100 * strong / n).toFixed(1)}%`,
  );
  // El shader lleva la fórmula nueva (baja frecuencia) y la mancha
  // de tierra de la base, solo en la rama alpina (gloss < -2.5).
  const src = fs.readFileSync(
    path.join(__dirname, '../src/toy-renderer.js'),
    'utf8',
  );
  assert.ok(src.includes('worldPosition.x*.011'), 'sin seno de baja frecuencia');
  assert.ok(src.includes('baseDirt'), 'sin mancha de tierra en la base');
  // Mancha de la base (f006: la base es mayormente tierra canela):
  // fuerte en A, inexistente a 100 u.
  assert.ok(baseDirtMix(0, 0) > 0.5, 'sin tierra bajo la base');
  assert.equal(baseDirtMix(100, 0), 0);
});

test('el relieve ondula más fuera del camino y las crestas suben con nieve', () => {
  const world = world1();
  // Helipuertos y rutas siguen en llano.
  for (const [x, z] of [[0, 0], [-150, 170], [180, 190]])
    assert.ok(world.height(x, z) < 1, `helipuerto (${x}, ${z}) no está en llano`);
  let maxRoute = 0;
  for (const route of m1().routes)
    for (let i = 1; i < route.length; i++) {
      const [ax, az] = route[i - 1],
        [bx, bz] = route[i];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
      for (let j = 0; j <= steps; j++) {
        const x = ax + ((bx - ax) * j) / steps,
          z = az + ((bz - az) * j) / steps;
        maxRoute = Math.max(maxRoute, world.height(x, z));
        assert.ok(world.canTravel(x, z, 4), 'ruta bloqueada por el relieve');
      }
    }
  assert.ok(maxRoute < 1, `ruta con relieve: ${maxRoute}`);
  // Colinas del valle: 8–30 u, con más contraste que antes (±7 u de
  // ondulación en vez de ±5).
  const samples = [
    [-60, 120],
    [60, 120],
    [-220, 60],
    [100, 80],
    [-60, -120],
    [-300, -100],
    [150, -150],
  ].map(([x, z]) => world.height(x, z));
  for (const h of samples) assert.ok(h > 8 && h < 30, `colina fuera de rango: ${h}`);
  assert.ok(
    Math.max(...samples) - Math.min(...samples) >= 10,
    `poca ondulación: ${samples.map((h) => h.toFixed(1)).join(', ')}`,
  );
  // Crestas más altas (f045, f074): norte 18, este/oeste 16.
  assert.deepEqual(
    m1().terrain.ridges.map((r) => r.h),
    [18, 16, 16],
  );
  assert.ok(world.height(0, 330) > 30, 'cresta norte baja');
  assert.ok(world.height(320, 160) > 24, 'cresta este baja');
  assert.ok(world.height(-370, 60) > 26, 'cresta oeste baja');
  // Acotado: las esquinas siguen por debajo de 30 u.
  assert.ok(world.height(350, -350) < 30, 'esquina demasiado alta');
  assert.ok(world.height(-350, 350) < 30, 'esquina demasiado alta');
});

test('las rocas son grises claras y mayores en M1; en M2/M3 no cambian', () => {
  const rocks1 = m1().scenery.rocks;
  assert.equal(rocks1.length, 293);
  assert.ok(rocks1.every((r) => r.s >= 1.5 && r.s <= 3.0), 'roca fuera de 1,5–3,0 u');
  assert.ok(
    rocks1.reduce((a, r) => a + r.s, 0) / rocks1.length > 2,
    'rocas sin agrandar',
  );
  for (const mission of [2, 3]) {
    const rocks = Maps.generate(mission).scenery.rocks;
    assert.ok(rocks.every((r) => r.s >= 1.1 && r.s <= 2.31), `m${mission} con rocas de M1`);
  }
  const parts = drawParts(world1(), { x: 0, z: 0 });
  assert.ok(
    parts.some((p) => p.color[0] === 0.62 && p.color[1] === 0.62),
    'sin rocas gris claro dibujadas',
  );
  assert.ok(
    !parts.some((p) => p.color[0] === 0.38 && p.color[1] === 0.4),
    'siguen las rocas gris oscuro',
  );
  // Sin el matojo verde encima de la roca en M1.
  assert.ok(
    !parts.some((p) => p.color[0] === 0.28 && p.color[1] === 0.42),
    'sigue el matojo verde sobre las rocas',
  );
});

test('los pinos ya forman bosquecillos (f010): no se toca su distribución', () => {
  const pines = m1().scenery.shrubs;
  assert.equal(pines.length, 428);
  assert.ok(pines.every((s) => s.t === 'pine'));
  let grouped = 0;
  for (const p of pines) {
    let near = 0;
    for (const q of pines)
      if (q !== p && Math.hypot(p.x - q.x, p.z - q.z) < 20) near++;
    if (near >= 2) grouped++;
  }
  assert.ok(grouped / pines.length >= 0.95, 'pinos sueltos, no en bosquecillo');
});

test('las montañas se leen desde la ruta: cima nevada cerca de C', () => {
  const map = m1(),
    world = world1();
  assert.equal(map.scenery.mountains.length, 14);
  // La más cercana a C está a 130 u con la cima a ~45 u: desde la
  // cámara (40° hacia abajo) el relieve del borde es lo que se ve,
  // y el renderizador las dibuja un 35 % más altas.
  const nearC = map.scenery.mountains
    .map((m) => ({
      m,
      d: Math.hypot(m.x - 180, m.z - 190),
      top: world.height(m.x, m.z) + m.s,
    }))
    .sort((a, b) => a.d - b.d)[0];
  assert.ok(nearC.d <= 140, `montaña más cercana a C a ${nearC.d.toFixed(0)} u`);
  assert.ok(nearC.top >= 38, `cima demasiado baja: ${nearC.top.toFixed(0)} u`);
  const parts = drawParts(world, { x: 180, z: 190 });
  assert.ok(
    parts.some((p) => p.color[0] === 0.96 && p.color[1] === 0.97 && p.size[0] > 5),
    'sin cima nevada dibujada junto a C',
  );
  assert.ok(
    fs
      .readFileSync(path.join(__dirname, '../src/toy-renderer.js'), 'utf8')
      .includes('world.alpine ? 1.35 : 1'),
    'montañas sin el aumento alpino',
  );
});

test('M1 sigue validada y A/B/C alcanzables con el mapa nuevo', () => {
  const map = m1();
  assert.deepEqual(Maps.validate(map), []);
  const world = world1();
  for (const p of [map.rules.A, map.rules.B, map.rules.C])
    assert.ok(world.canTravel(p.x, p.z, 4), 'helipuerto no transitable');
  // M2/M3 no cambian: sin crestas ni pinos, y su relieve intacto.
  assert.equal(Maps.generate(2).terrain.ridges, undefined);
  assert.equal(Maps.generate(3).terrain.ridges, undefined);
  assert.ok(Maps.generate(2).scenery.shrubs.every((s) => s.t === 'shrub'));
});

// Dibuja el mundo con un GL falso y devuelve las piezas (tamaño y
// color) que el renderizador emite, en orden de dibujo.
function drawParts(world, cam) {
  const parts = [];
  let size = null,
    color = null;
  const gl = new Proxy(
    {
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => ({}),
      getUniformLocation: (_, name) => name,
      getAttribLocation: (_, name) => (name === 'position' ? 0 : 1),
      uniform3f: (name, ...values) => {
        if (name === 'size') size = [...values];
      },
      uniform3fv: (name, values) => {
        if (name === 'color') color = [...values];
      },
      uniform2f: () => {},
      uniform1f: () => {},
      bufferData: () => {},
      drawArrays: () => {
        if (size && color) parts.push({ size, color });
      },
      compileShader: () => {},
      viewport: () => {},
    },
    {
      get: (obj, key) =>
        key in obj ? obj[key] : key.toUpperCase() === key ? 1 : () => {},
    },
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => gl,
    addEventListener: () => {},
  };
  const r = new Renderer(canvas, () => {}, () => {});
  r.setWorld(world);
  r.render({
    W: 390,
    H: 844,
    F: 390 / 105,
    HY: 844 * 0.52,
    cam: { x: cam.x, z: cam.z, yaw: 0 },
    PITCH: Math.PI / 3,
    P: { x: 0, y: 8, z: 0, yaw: 0, inv: 0 },
    E: [],
    DC: [],
    BL: [],
    EB: [],
    MS: [],
    FX: [],
    SM: [],
    allies: [],
    PK: [],
    rot: 1,
    t: 0,
  });
  return parts;
}
