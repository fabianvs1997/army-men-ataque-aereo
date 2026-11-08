const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const Loader = require('../src/gltf-loader.js');
const Renderer = require('../src/toy-renderer.js');
const { fakeHost, seeded } = require('../support/fake-host.cjs');

function readGltf(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'assets', name), 'utf8'));
}
function clearEmbedded() {
  delete globalThis.ToyModeloHelicoptero;
  delete globalThis.ToyModeloTanque;
}
function loadEmbedded() {
  // Sin borrar la caché, el segundo require no reejecutaría el
  // archivo y los globales seguirían borrados por clearEmbedded().
  delete require.cache[require.resolve('../src/modelo-helicoptero.js')];
  delete require.cache[require.resolve('../src/modelo-tanque.js')];
  require('../src/modelo-helicoptero.js');
  require('../src/modelo-tanque.js');
}

// --- La ruta real de carga, como en Safari (sin Buffer) ---

function browserLikeContext() {
  // Como en el navegador: sin Buffer y con un atob estricto (lanza
  // con caracteres inválidos, como el del navegador). El cargador
  // debe usar root.atob; si el factory no recibe root, parse() rompe
  // con «root is not defined» y el juego cae en silencio al
  // procedural. Eso es justo lo que pasaba en el iPhone de Fabian:
  // en Node existe Buffer y la rama de atob nunca se ejecutaba, así
  // que los tests antiguos no lo veían.
  const sandbox = {
    atob(b64) {
      if (
        typeof b64 !== 'string' ||
        /[^A-Za-z0-9+/=]/.test(b64) ||
        b64.length % 4 !== 0
      )
        throw new Error('InvalidCharacterError');
      return Buffer.from(b64, 'base64').toString('latin1');
    },
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  // Los archivos reales tal cual los sirve la web, en el mismo orden
  // que bootstrap: el cargador y luego los datos embebidos.
  for (const file of [
    'src/gltf-loader.js',
    'src/modelo-helicoptero.js',
    'src/modelo-tanque.js',
  ])
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, {
      filename: file,
    });
  return { ctx, sandbox };
}

test('el cargador parsea los datos embebidos reales sin Buffer (como Safari)', () => {
  const { ctx } = browserLikeContext();
  assert.equal(vm.runInContext('typeof Buffer', ctx), 'undefined');
  assert.equal(vm.runInContext('typeof ToyGltfLoader', ctx), 'object');
  assert.equal(vm.runInContext('typeof ToyModeloHelicoptero', ctx), 'object');
  assert.equal(vm.runInContext('typeof ToyModeloTanque', ctx), 'object');
  const result = vm.runInContext(
    `({
      heliTris: ToyGltfLoader.countTris(ToyGltfLoader.parse(ToyModeloHelicoptero)),
      tankTris: ToyGltfLoader.countTris(ToyGltfLoader.parse(ToyModeloTanque)),
      heliPrims: ToyGltfLoader.parse(ToyModeloHelicoptero).drawList.length,
      tankPrims: ToyGltfLoader.parse(ToyModeloTanque).drawList.length,
    })`,
    ctx,
  );
  assert.equal(result.heliTris, 3540);
  assert.equal(result.tankTris, 1680);
  assert.equal(result.heliPrims, 60);
  assert.equal(result.tankPrims, 49);
});

// --- Renderer: estado de los modelos ---

// Mock de WebGL con contadores (patrón de tests/renderer.test.cjs y
// tests/integracion-modelos.test.cjs).
function fixture() {
  const counts = {
    createBuffer: 0,
    bindBuffer: 0,
    drawElements: 0,
    drawArrays: 0,
    indices: 0,
    compile: 0,
  };
  const gl = new Proxy(
    {
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => {
        counts.createBuffer++;
        return {};
      },
      bindBuffer: () => counts.bindBuffer++,
      getUniformLocation: (_, name) => name,
      getAttribLocation: (_, name) => (name === 'position' ? 0 : 1),
      uniform3f: () => {},
      uniform3fv: () => {},
      uniform2f: () => {},
      uniform1f: () => {},
      uniformMatrix4fv: () => {},
      bufferData: (_, data) => assert.ok(data.every(Number.isFinite)),
      drawArrays: () => counts.drawArrays++,
      drawElements: (_, count) => {
        counts.drawElements++;
        counts.indices += count;
      },
      compileShader: () => counts.compile++,
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
  const renderer = new Renderer(canvas, () => {}, () => {});
  // Mundo plano y vacío: solo importan el helicóptero y los tanques.
  renderer.world = {
    height: () => 0,
    roads: [],
    pads: [],
    rocks: [],
    yard: [],
    rails: [],
    mountains: [],
    padMarks: [],
    clearOfLandmarks: () => true,
  };
  return { gl, canvas, counts, renderer };
}
function sceneWithTanks(n) {
  return {
    W: 390,
    H: 844,
    F: 390 / 105,
    HY: 844 * 0.52,
    cam: { x: 0, z: 0, yaw: Math.PI / 5 },
    PITCH: Math.PI / 3,
    P: { x: 0, y: 8, z: 0, yaw: 0, inv: 0 },
    E: Array.from({ length: n }, (_, i) => ({
      k: 'tank',
      x: i * 8,
      y: 0,
      z: 15,
      fl: 0,
    })),
    DC: [],
    BL: [],
    EB: [],
    MS: [],
    SM: [],
    FX: [],
    allies: [],
    PK: [],
    rot: 1,
    t: 0,
  };
}
function captureConsoleError() {
  const lines = [];
  const original = console.error;
  console.error = (...args) => {
    lines.push(
      args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '),
    );
  };
  return { lines, restore() { console.error = original; } };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

test('con datos embebidos el estado es Blender y los modelos se dibujan', () => {
  clearEmbedded();
  loadEmbedded();
  const { counts, renderer } = fixture();
  assert.ok(renderer.modelHeli);
  assert.ok(renderer.modelTank);
  assert.deepEqual(renderer.modelStatus, {
    heli: { source: 'blender', reason: '' },
    tank: { source: 'blender', reason: '' },
    jeep: { source: 'procedural', reason: 'sin datos embebidos' },
    caja: { source: 'procedural', reason: 'sin datos embebidos' },
  });
  assert.equal(
    renderer.modelStatusText(),
    'Modelos · helicóptero: Blender · tanques: Blender · jeep: procedural (sin datos embebidos) · caja: procedural (sin datos embebidos)',
  );
  counts.drawElements = 0;
  counts.indices = 0;
  counts.drawArrays = 0;
  assert.equal(renderer.render(sceneWithTanks(9)), true);
  // 60 primitivas del helicóptero + 9 × 49 del tanque.
  assert.equal(counts.drawElements, 60 + 9 * 49);
  assert.equal(counts.indices, (3540 + 9 * 1680) * 3);
  // 11 de antes (terreno, elipses, sombra) + 12 piezas de las nubes.
  assert.equal(counts.drawArrays, 23);
  clearEmbedded();
});

test('sin datos embebidos el estado es procedural con el motivo', async () => {
  clearEmbedded();
  const cap = captureConsoleError();
  const { renderer } = fixture();
  assert.equal(renderer.modelHeli, null);
  assert.equal(renderer.modelTank, null);
  assert.deepEqual(renderer.modelStatus, {
    heli: { source: 'procedural', reason: 'sin datos embebidos' },
    tank: { source: 'procedural', reason: 'sin datos embebidos' },
    jeep: { source: 'procedural', reason: 'sin datos embebidos' },
    caja: { source: 'procedural', reason: 'sin datos embebidos' },
  });
  assert.equal(
    renderer.modelStatusText(),
    'Modelos · helicóptero: procedural (sin datos embebidos) · tanques: procedural (sin datos embebidos) · jeep: procedural (sin datos embebidos) · caja: procedural (sin datos embebidos)',
  );
  assert.equal(renderer.tryDrawHeliModel(0, 8, 0, 0, 0, 0, false), false);
  assert.equal(renderer.render(sceneWithTanks(9)), true);
  // El render dispara el respaldo por red: en Node el fetch de una
  // ruta relativa falla y el motivo queda registrado (no en silencio).
  await tick();
  cap.restore();
  assert.ok(
    cap.lines.some((l) => l.includes('assets/helicoptero.gltf')),
    'sin registro del fetch del helicóptero: ' + cap.lines.join(' | '),
  );
  assert.ok(
    cap.lines.some((l) => l.includes('assets/tanque-tan.gltf')),
    'sin registro del fetch del tanque: ' + cap.lines.join(' | '),
  );
  assert.match(renderer.modelStatus.heli.reason, /fetch falló/);
  assert.match(renderer.modelStatus.tank.reason, /fetch falló/);
  clearEmbedded();
});

test('con datos corruptos el respaldo queda registrado con el motivo', async () => {
  clearEmbedded();
  globalThis.ToyModeloHelicoptero = { asset: { version: '2.0' } };
  globalThis.ToyModeloTanque = 'no es json';
  const cap = captureConsoleError();
  const { renderer } = fixture();
  assert.equal(renderer.modelHeli, null);
  assert.equal(renderer.modelTank, null);
  assert.equal(renderer.modelStatus.heli.source, 'procedural');
  assert.equal(renderer.modelStatus.tank.source, 'procedural');
  assert.match(renderer.modelStatus.heli.reason, /sin buffers/);
  assert.match(renderer.modelStatus.tank.reason, /Unexpected token/);
  assert.ok(
    cap.lines.some((l) =>
      l.includes('[modelos] helicóptero Blender no disponible'),
    ),
    'sin registro del helicóptero: ' + cap.lines.join(' | '),
  );
  assert.ok(
    cap.lines.some((l) => l.includes('[modelos] tanque Blender no disponible')),
    'sin registro del tanque: ' + cap.lines.join(' | '),
  );
  assert.ok(
    cap.lines.some((l) => l.includes('sin buffers')),
    'el motivo del helicóptero no se registró',
  );
  assert.equal(renderer.render(sceneWithTanks(9)), true);
  await tick();
  cap.restore();
  clearEmbedded();
});

test('el respaldo por red actualiza el estado a Blender cuando descarga', async () => {
  clearEmbedded();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url) =>
    Promise.resolve({
      ok: true,
      json: async () =>
        readGltf(url.includes('helicoptero') ? 'helicoptero.gltf' : 'tanque-tan.gltf'),
    });
  try {
    const { renderer } = fixture();
    assert.equal(renderer.modelHeli, null);
    assert.equal(renderer.modelTank, null);
    assert.equal(renderer.render(sceneWithTanks(9)), true);
    await tick();
    assert.ok(renderer.modelHeli, 'el helicóptero no se cargó por red');
    assert.ok(renderer.modelTank, 'el tanque no se cargó por red');
    assert.deepEqual(renderer.modelStatus, {
      heli: { source: 'blender', reason: '' },
      tank: { source: 'blender', reason: '' },
      jeep: { source: 'blender', reason: '' },
      caja: { source: 'blender', reason: '' },
    });
    assert.equal(
      renderer.modelStatusText(),
      'Modelos · helicóptero: Blender · tanques: Blender · jeep: Blender · caja: Blender',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  clearEmbedded();
});

test('modelStatusText mezcla Blender y procedural con el motivo', () => {
  clearEmbedded();
  loadEmbedded();
  const { renderer } = fixture();
  renderer.modelStatus.tank = {
    source: 'procedural',
    reason: 'root is not defined',
  };
  assert.equal(
    renderer.modelStatusText(),
    'Modelos · helicóptero: Blender · tanques: procedural (root is not defined) · jeep: procedural (sin datos embebidos) · caja: procedural (sin datos embebidos)',
  );
  clearEmbedded();
});

// --- ?modelos=1 en el juego real ---

class FakeRenderer {
  constructor() {}
  setWorld() {}
  modelStatusText() {
    return 'Modelos · helicóptero: Blender · tanques: Blender';
  }
}
function startGame(search) {
  const f = fakeHost();
  if (search !== undefined) f.host.location = { search };
  const app = require('../src/game.js').create(f.host, {
    random: seeded(123),
    Renderer: FakeRenderer,
  });
  return { ...f, app, state: app.state };
}
function playFrames(g, n = 15) {
  g.element('go').onclick();
  for (let i = 0; i < n; i++) g.app.upd(0.05);
}

test('?modelos=1 muestra en pantalla qué modelos se dibujan', () => {
  const g = startGame('?modelos=1');
  assert.equal(g.state.modelosVisible, true);
  playFrames(g);
  const perf = g.element('perf');
  assert.equal(perf.style.display, 'block');
  assert.match(
    perf.textContent,
    /Modelos · helicóptero: Blender · tanques: Blender/,
  );
});

test('sin ?modelos=1 no se muestra la línea de modelos', () => {
  const g = startGame('');
  assert.equal(g.state.modelosVisible, false);
  playFrames(g);
  assert.doesNotMatch(g.element('perf').textContent, /Modelos/);
});

test('?perf=1&modelos=1 muestra FPS y modelos en la misma línea', () => {
  const g = startGame('?perf=1&modelos=1');
  assert.equal(g.state.modelosVisible, true);
  assert.equal(g.state.perfVisible, true);
  playFrames(g);
  const text = g.element('perf').textContent;
  assert.match(text, /FPS/);
  assert.match(text, /Modelos · helicóptero: Blender/);
});

test('bootstrap carga el cargador y los modelos antes del renderer', () => {
  const bootstrap = require('../src/bootstrap.js');
  assert.equal(bootstrap.VERSION, 'mision1-video-1');
  const order = bootstrap.scripts;
  assert.ok(order.indexOf('gltf-loader') < order.indexOf('toy-renderer'));
  assert.ok(order.indexOf('modelo-helicoptero') < order.indexOf('toy-renderer'));
  assert.ok(order.indexOf('modelo-tanque') < order.indexOf('toy-renderer'));
});
