const test = require('node:test');
const assert = require('node:assert/strict');
const Collision = require('../src/collision.js');
const Debris = require('../src/debris.js');
const Renderer = require('../src/toy-renderer.js');
const { game, seeded } = require('../support/fake-host.cjs');

// Rendimiento de la misión 2 (congelamiento en iPhone): con el campo de
// escombros saturado (320 piezas), cada trace/move recorría todos los
// escombros. Ahora los asentados van a un índice espacial y solo las piezas
// en el aire se revisan directas. Estos tests fijan el comportamiento y el
// presupuesto de la simulación.

function wallAt(x) {
  return { kind: 'box', x, y: 5, z: 0, sx: 0.25, sy: 5, sz: 8, yaw: 0 };
}

test('settled wreckage still blocks shots through the spatial grid', () => {
  const state = { DC: [], DB: [] };
  const world = {
    yard: [],
    rocks: [],
    height: () => 0,
    clearOfLandmarks: () => true,
  };
  const cover = Collision.create(state, world);
  // 320 piezas asentadas lejos del disparo, más un muro de escombros en medio.
  const rand = seeded(5);
  for (let i = 0; i < 319; i++)
    state.DB.push({
      kind: 'box',
      x: 200 + rand() * 50,
      y: 0.2,
      z: 200 + rand() * 50,
      sx: 0.3,
      sy: 0.2,
      sz: 0.3,
      settled: true,
    });
  state.DB.push({ ...wallAt(5), settled: true });
  assert.ok(cover.trace({ x: 0, y: 5, z: 0 }, { x: 10, y: 5, z: 0 }));
  // Sin nada en el camino, el mismo campo de escombros no da falsos positivos.
  assert.equal(
    cover.trace({ x: 0, y: 5, z: 100 }, { x: 10, y: 5, z: 100 }),
    null,
  );
  // Mover no se atasca en escombros lejanos.
  assert.equal(
    cover.move({ x: 0, y: 5, z: 100 }, { x: 10, y: 5, z: 100 }, 1, 1).x,
    10,
  );
});

test('airborne debris still blocks until it settles', () => {
  const state = { DC: [], DB: [] };
  const world = {
    yard: [],
    rocks: [],
    height: () => 0,
    clearOfLandmarks: () => true,
  };
  const cover = Collision.create(state, world);
  const piece = { ...wallAt(5), settled: false };
  state.DB.push(piece);
  assert.ok(cover.trace({ x: 0, y: 5, z: 0 }, { x: 10, y: 5, z: 0 }));
  piece.settled = true;
  assert.ok(cover.trace({ x: 0, y: 5, z: 0 }, { x: 10, y: 5, z: 0 }));
  state.DB.length = 0;
  assert.equal(
    cover.trace({ x: 0, y: 5, z: 0 }, { x: 10, y: 5, z: 0 }),
    null,
  );
});

test('damageSoldier ignores soldiers that are not part of the mission', () => {
  const { app, state } = game();
  app.start(1, true);
  assert.equal(
    state.mission.damageSoldier({ state: 'MARCHANDO_A_C', hp: 5 }, 100),
    false,
  );
  assert.equal(
    state.mission.damageSoldier(state.mission.allies[0], 100),
    true,
  );
});

function mission2Setup(saturate) {
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
  });
  state.P.x = route[3][0];
  state.P.z = route[3][1] - 12;
  for (const e of state.E) e.cd = 0;
  if (saturate) {
    const rand = seeded(7);
    const kinds = ['tank', 'tur', 'heli', 'inf', 'base'];
    for (let i = 0; i < 30; i++)
      Debris.emit(
        state,
        {
          k: kinds[i % kinds.length],
          x: -60 + (i % 10) * 14,
          y: 2,
          z: 100 + Math.floor(i / 10) * 12,
        },
        true,
        rand,
      );
    const groundAt = (x, z) => state.world.height(x, z);
    for (let i = 0; i < 600; i++) Debris.step(state, 1 / 60, groundAt);
  }
  return { app, state };
}

function timeFrames(app, frames) {
  // Mínimo de dos pasadas: filtra picos de GC y calentamiento.
  let best = Infinity;
  for (let run = 0; run < 2; run++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < frames; i++) app.upd(1 / 60);
    best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return best / frames;
}

test('mission 2 escort phase stays fast with a saturated debris field', () => {
  const FRAMES = 240;
  const empty = mission2Setup(false);
  const emptyMs = timeFrames(empty.app, FRAMES);
  const full = mission2Setup(true);
  assert.equal(full.state.DB.length, Debris.MAX_PIECES);
  const fullMs = timeFrames(full.app, FRAMES);
  // Antes del índice espacial, el campo saturado costaba ~4x el vacío
  // (8,2 ms/frame frente a 2,1 ms/frame en Node); ahora debe costar
  // prácticamente lo mismo. El margen 2,5x absorbe el ruido de la máquina.
  assert.ok(
    fullMs < emptyMs * 2.5,
    `saturated ${fullMs.toFixed(2)} ms/frame vs empty ${emptyMs.toFixed(2)} ms/frame`,
  );
  assert.ok(fullMs < 10, `saturated frame budget: ${fullMs.toFixed(2)} ms`);
  assert.ok(full.state.DB.length <= Debris.MAX_PIECES);
  assert.ok(full.state.SM.length <= 160);
});

function glFixture() {
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
  return { canvas, counts };
}

test('WebGL reuses mesh bindings and culls off-screen roads', () => {
  const f = glFixture();
  const r = new Renderer(f.canvas, () => {}, () => {});
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
  };
  f.counts.draw = 0;
  f.counts.bind = 0;
  assert.equal(r.render(scene), true);
  // Sin caché, cada pieza reenlazaba su buffer: un bind por dibujo.
  assert.ok(
    f.counts.bind < f.counts.draw / 3,
    `bindBuffer ${f.counts.bind} of ${f.counts.draw} draws`,
  );
  const near = f.counts.draw;
  // Cámara lejos del mapa: carreteras y objetos fuera de vista no se dibujan.
  scene.cam = { x: 2000, z: 2000, yaw: Math.PI / 5 };
  scene.P = { x: 2000, y: 8, z: 2000, yaw: 0, inv: 0 };
  scene.DB = [];
  scene.SM = [];
  f.counts.draw = 0;
  assert.equal(r.render(scene), true);
  assert.ok(
    f.counts.draw < near / 2,
    `far camera draws ${f.counts.draw} vs near ${near}`,
  );
});
