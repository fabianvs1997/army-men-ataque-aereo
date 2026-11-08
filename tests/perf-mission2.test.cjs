const test = require('node:test');
const assert = require('node:assert/strict');
const Collision = require('../src/collision.js');
const Renderer = require('../src/toy-renderer.js');
const { game } = require('../support/fake-host.cjs');

// Rendimiento de la misión 2 (congelamiento en iPhone): antes cada baja
// dejaba escombros (hasta 320 piezas) y cada trace/move los recorría
// todos; el índice espacial lo mitigaba, pero los restos seguían
// cerrando el camino al pelotón. Ahora no hay escombros: destruir un
// enemigo solo deja explosión y humo, y state.DB solo guarda las
// marcas de aliado caído (2 cajitas por baja, estáticas, que no
// bloquean). Estos tests fijan el comportamiento y el presupuesto de
// la simulación.

function wallAt(x) {
  return { kind: 'box', x, y: 5, z: 0, sx: 0.25, sy: 5, sz: 8, yaw: 0 };
}

test('world solids still block shots; fallen-ally markers never do', () => {
  const state = { DC: [], DB: [] };
  const world = {
    yard: [wallAt(5)],
    rocks: [],
    height: () => 0,
    clearOfLandmarks: () => true,
  };
  const cover = Collision.create(state, world);
  // El muro del mundo sí bloquea el disparo.
  assert.ok(cover.trace({ x: 0, y: 5, z: 0 }, { x: 10, y: 5, z: 0 }));
  // Sin nada en el camino, no hay falsos positivos.
  assert.equal(
    cover.trace({ x: 0, y: 5, z: 100 }, { x: 10, y: 5, z: 100 }),
    null,
  );
  // Las marcas de aliado caído no bloquean ni el disparo ni el paso,
  // aunque estén justo en medio del camino (aquí, en la ruta libre).
  state.DB.push({
    kind: 'box',
    x: 5,
    y: 0.2,
    z: 100,
    sx: 0.3,
    sy: 0.2,
    sz: 0.65,
    settled: true,
  });
  assert.equal(
    cover.trace({ x: 0, y: 1, z: 100 }, { x: 10, y: 1, z: 100 }),
    null,
  );
  assert.equal(
    cover.move({ x: 0, y: 1, z: 100 }, { x: 10, y: 1, z: 100 }, 1, 1).x,
    10,
  );
});

test('damageSoldier ignores soldiers that are not part of the mission', () => {
  // La escolta vive en la Misión 2 desde la Misión 1 del vídeo.
  const { app, state } = game();
  app.start(2, true);
  assert.equal(
    state.mission.damageSoldier({ state: 'MARCHANDO_A_C', hp: 5 }, 100),
    false,
  );
  assert.equal(
    state.mission.damageSoldier(state.mission.allies[0], 100),
    true,
  );
});

function mission2Setup(withKills) {
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
  if (withKills) {
    // Matar a todos los enemigos presentes: antes cada baja dejaba
    // piezas que se acumulaban en el camino; ahora no queda nada.
    for (const e of [...state.E]) app.combat.kill(e);
    state.E = state.E.filter((e) => !e.dead);
    assert.equal(state.DB.length, 0, 'matar enemigos no deja restos');
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

test('mission 2 escort phase stays fast after many kills leave no debris', () => {
  const FRAMES = 240;
  const empty = mission2Setup(false);
  const emptyMs = timeFrames(empty.app, FRAMES);
  const afterKills = mission2Setup(true);
  const killsMs = timeFrames(afterKills.app, FRAMES);
  // Sin escombros que acumular ni índice que mantener, matar no debe
  // costar más que no matar. El margen 2,5x absorbe el ruido de la máquina.
  assert.ok(
    killsMs < emptyMs * 2.5,
    `after kills ${killsMs.toFixed(2)} ms/frame vs empty ${emptyMs.toFixed(2)} ms/frame`,
  );
  assert.ok(killsMs < 10, `frame budget: ${killsMs.toFixed(2)} ms`);
  assert.equal(afterKills.state.DB.length, 0);
  assert.ok(afterKills.state.SM.length <= 160);
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
    // Sin escombros, DB solo lleva marcas de aliado caído: pocas.
    DB: Array.from({ length: 6 }, (_, i) => ({
      kind: 'box',
      x: -60 + i * 14,
      y: 0.2,
      z: 100,
      sx: 0.3,
      sy: 0.2,
      sz: 0.65,
      color: [0.24, 0.65, 0.16],
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
