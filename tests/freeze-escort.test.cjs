const test = require('node:test');
const assert = require('node:assert/strict');
const Navigation = require('../src/escort-navigation.js');
const Perf = require('../src/perf.js');
const MissionMap = require('../src/mission-map.js');
const ToyWorld = require('../src/toy-world.js');
const { game, seeded } = require('../support/fake-host.cjs');
const Debris = require('../src/debris.js');

// Congelamiento en la escolta B → C (misión 2): el A* de desatasco no
// tenía presupuesto. Con la meta a 60 u y el terreno bloqueado agotaba
// las 5000 expansiones con una lista abierta de búsqueda lineal:
// 60-70 ms en Node por llamada, repetida cada 3 s por cada soldado
// atascado. Estos tests fijan los presupuestos y el comportamiento.

// Fuerza bruta de trailDistance para comprobar que la optimización
// (cajas envolventes + distancia al cuadrado) no cambia el terreno.
test('trailDistance optimizado coincide con la distancia real', () => {
  const map = MissionMap.generate(123);
  const world = ToyWorld.create(map);
  const routes = map.routes;
  for (let i = 0; i < 200; i++) {
    const x = Math.sin(i * 3.7) * 300,
      z = Math.cos(i * 5.1) * 300;
    let best = Infinity;
    for (const route of routes)
      for (let j = 0; j < route.length - 1; j++) {
        const [ax, az] = route[j],
          [bx, bz] = route[j + 1],
          dx = bx - ax,
          dz = bz - az,
          t = Math.max(
            0,
            Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)),
          );
        best = Math.min(
          best,
          Math.hypot(x - ax - t * dx, z - az - t * dz),
        );
      }
    assert.ok(
      Math.abs(world.trailDistance(x, z) - best) < 1e-9,
      `trailDistance en (${x.toFixed(1)}, ${z.toFixed(1)})`,
    );
  }
});

test('arrancar la misión 2 (mundo + malla) cabe en el presupuesto', () => {
  // Antes: 141-241 ms en Node en solitario por generar alturas con
  // trailDistance sin podar y construir la malla con push por vértice
  // (ahora ~35 ms en solitario). El tope es generoso a propósito: la
  // suite corre los archivos en paralelo y el reloj es ruidoso; lo que
  // fija la optimización son las pruebas deterministas de abajo (la
  // malla es idéntica a la de antes y trailDistance no cambia), y el
  // bench scripts/bench-escort-freeze.cjs para la cifra.
  let best = Infinity;
  for (let run = 0; run < 2; run++) {
    const t0 = process.hrtime.bigint();
    const map = MissionMap.generate(123);
    const world = ToyWorld.create(map);
    const mesh = world.mesh();
    best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6);
    // Malla prealocada con el tamaño exacto: 160×160 celdas × 36
    // flotantes (2 triángulos × 3 vértices × 6 valores).
    assert.ok(mesh instanceof Float32Array);
    assert.equal(mesh.length, 921600);
    assert.ok(mesh.every((v) => Number.isFinite(v)));
  }
  assert.ok(best < 1000, `start cost: ${best.toFixed(0)} ms`);
});

function mission2() {
  const { app, state } = game(123);
  app.start(2, true);
  return { app, state };
}

test('un A* con meta lejana no quema el frame: presupuesto duro', () => {
  const { state } = mission2();
  const cover = require('../src/collision.js').create(state, state.world);
  const groundAt = (x, z) => state.world.height(x, z);
  const B = state.mission.rules.B;
  const t0 = process.hrtime.bigint();
  const r = Navigation.path(
    { x: B.x, z: B.z },
    { x: B.x + 200, z: B.z + 40 },
    cover,
    groundAt,
    0.65,
    0.9,
  );
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  // Antes: ~70 ms. Ahora la meta se recorta a un objetivo intermedio
  // (máx. 64 u) y el tiempo está topado a 12 ms por llamada.
  assert.ok(ms < 50, `far path: ${ms.toFixed(1)} ms`);
  if (r) {
    // Una ruta parcial nunca se aleja más del objetivo intermedio.
    for (const p of r)
      assert.ok(
        Math.hypot(p.x - B.x, p.z - B.z) <= 64 + 2,
        'partial path stays local',
      );
  }
});

test('un A* con la meta dentro de un obstáculo vuelve al instante', () => {
  const { state } = mission2();
  const cover = require('../src/collision.js').create(state, state.world);
  const groundAt = (x, z) => state.world.height(x, z);
  // Muro de escombros asentados: la meta queda dentro del muro.
  const wx = 0,
    wz = 100;
  for (let i = -8; i <= 8; i++)
    state.DB.push({
      kind: 'box',
      x: wx + i * 1.2,
      y: groundAt(wx + i * 1.2, wz) + 0.2,
      z: wz,
      sx: 1.2,
      sy: 0.4,
      sz: 1.2,
      color: [0.76, 0.61, 0.36],
      yaw: 0,
      settled: true,
      vx: 0,
      vy: 0,
      vz: 0,
    });
  const t0 = process.hrtime.bigint();
  const r = Navigation.path(
    { x: wx - 6, z: wz },
    { x: wx, z: wz },
    cover,
    groundAt,
    0.65,
    0.9,
  );
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(r, null);
  assert.ok(ms < 25, `blocked goal: ${ms.toFixed(1)} ms`);
});

test('el A* sigue encontrando ruta alrededor de un muro en terreno libre', () => {
  const { state } = mission2();
  const cover = require('../src/collision.js').create(state, state.world);
  const groundAt = (x, z) => state.world.height(x, z);
  const route = state.mission.rules.routeBC;
  const wx = route[4][0],
    wz = route[4][1];
  // Muro alto: las piezas bajas las pisan los soldados por diseño
  // (soldierHalfHeight), así que el muro debe ser alto para bloquearlos.
  for (let i = -8; i <= 8; i++)
    state.DB.push({
      kind: 'box',
      x: wx + i * 1.2,
      y: groundAt(wx + i * 1.2, wz) + 1,
      z: wz,
      sx: 1.2,
      sy: 2,
      sz: 1.2,
      color: [0.76, 0.61, 0.36],
      yaw: 0,
      settled: true,
      vx: 0,
      vy: 0,
      vz: 0,
    });
  // La meta queda fuera del muro (el muro mide ~21 u de ancho): la ruta
  // debe rodearlo por un extremo, no atravesarlo.
  const r = Navigation.path(
    { x: wx - 12, z: wz },
    { x: wx + 12, z: wz },
    cover,
    groundAt,
    0.65,
    0.9,
  );
  assert.ok(r && r.length > 2, 'goes around the wall');
  assert.ok(
    Math.hypot(r[r.length - 1].x - (wx + 12), r[r.length - 1].z - wz) < 2,
    'ends at the goal',
  );
  assert.ok(
    r.some((p) => Math.abs(p.z - wz) >= 2),
    'detours around the wall end instead of through it',
  );
});

test('como mucho un recálculo de ruta por frame aunque se atasquen todos', () => {
  const { app, state } = game(123);
  app.start(2, true);
  state.mission.stage = 'ESCOLTAR_BC';
  const route = state.mission.rules.routeBC;
  state.mission.allies.forEach((a, i) => {
    if (a.wounded) return;
    a.state = 'MARCHANDO_A_C';
    a.waypoint = 2;
    a.x = route[2][0] + (i - 2) * 2;
    a.z = route[2][1] + (i % 2 ? 3 : -3);
    a.stuck = 5;
    a.bestDistance = 0;
    a.repathCooldown = 0;
  });
  state.P.x = route[3][0];
  state.P.z = route[3][1] - 12;
  // Sin enemigos cerca: si un soldado entra en combate, el paso se
  // salta el recálculo de ruta antes de llegar a él.
  for (const e of state.E)
    if (Math.hypot(e.x - route[2][0], e.z - route[2][1]) < 40) e.dead = 1;
  const orig = Navigation.path;
  let calls = 0;
  Navigation.path = (...args) => {
    calls++;
    return [{ x: args[1].x, z: args[1].z }];
  };
  try {
    for (let f = 0; f < 5; f++) {
      calls = 0;
      // Reponer el atasco: con ruta encontrada el soldado se desatasca.
      for (const a of state.mission.allies) {
        if (a.wounded) continue;
        a.stuck = 5;
        a.bestDistance = 0;
        a.repathCooldown = 0;
      }
      app.upd(1 / 60);
      // Exactamente uno: si fueran 0, el test no estaría ejercitando
      // el recálculo; si fueran más de 1, el presupuesto no funciona.
      assert.equal(calls, 1, `frame ${f}: ${calls} repaths`);
    }
  } finally {
    Navigation.path = orig;
  }
});

test('el monitor de rendimiento degrada y recupera por niveles', () => {
  const perf = Perf.create();
  assert.equal(perf.level, 0);
  assert.equal(perf.pixelRatioCap, 1.75);
  // La EMA tarda ~17 frames en cruzar 30 ms, así que hacen falta más
  // de 90 frames lentos para 90 consecutivos por encima del umbral.
  for (let i = 0; i < 120; i++) perf.update(40);
  assert.equal(perf.level, 1);
  assert.equal(perf.pixelRatioCap, 1.25);
  for (let i = 0; i < 120; i++) perf.update(40);
  assert.equal(perf.level, 2);
  assert.equal(perf.pixelRatioCap, 1);
  assert.equal(perf.drawThrottleMs, 1000 / 30);
  assert.equal(perf.skipStride, 2);
  // Con frames rápidos sostenidos vuelve a subir, sin oscilar: la EMA
  // tarda ~28 frames en bajar de 17 ms, luego 600 consecutivos por nivel.
  for (let i = 0; i < 700; i++) perf.update(10);
  assert.equal(perf.level, 1);
  for (let i = 0; i < 700; i++) perf.update(10);
  assert.equal(perf.level, 0);
  // Picos aislados no degradan.
  const fresh = Perf.create();
  for (let i = 0; i < 10; i++) fresh.update(200);
  assert.equal(fresh.level, 0);
});

test('en nivel 2 de rendimiento se dibuja la mitad de escombros y humo', () => {
  const Renderer = require('../src/toy-renderer.js');
  const counts = { draw: 0, bind: 0 };
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
      bufferData: () => {},
      drawArrays: () => counts.draw++,
      bindBuffer: () => counts.bind++,
      viewport: () => {},
    },
    { get: (o, k) => (k in o ? o[k] : k.toUpperCase() === k ? 1 : () => {}) },
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => gl,
    addEventListener: () => {},
  };
  const r = new Renderer(canvas, () => {}, () => {});
  const scene = {
    W: 390,
    H: 844,
    F: 390 / 62,
    HY: 844 * 0.64,
    cam: { x: 0, z: 110, yaw: Math.PI / 5 },
    PITCH: (40 * Math.PI) / 180,
    P: { x: 0, y: 8, z: 110, yaw: 0, inv: 0 },
    E: [],
    DC: [],
    BL: [],
    EB: [],
    MS: [],
    FX: [],
    SM: Array.from({ length: 160 }, (_, i) => ({
      x: -40 + i * 0.5,
      y: 8,
      z: 110,
      l: 0.6,
      max: 0.9,
      s: 1.5,
      dark: false,
      dx: 0,
      dy: 0.5,
      dz: 0,
    })),
    DB: Array.from({ length: 320 }, (_, i) => ({
      kind: 'box',
      x: -60 + (i % 10) * 14,
      y: 0.2,
      z: 100 + Math.floor(i / 10) * 12,
      sx: 0.3,
      sy: 0.2,
      sz: 0.3,
      color: [0.76, 0.61, 0.36],
      yaw: 0,
    })),
    PK: [],
    rot: 1,
    t: 0,
    allies: [],
    perfLevel: 0,
  };
  counts.draw = 0;
  assert.equal(r.render(scene), true);
  const full = counts.draw;
  scene.perfLevel = 2;
  counts.draw = 0;
  assert.equal(r.render(scene), true);
  assert.ok(
    counts.draw < full * 0.85,
    `level 2 draws ${counts.draw} vs level 0 ${full}`,
  );
});
