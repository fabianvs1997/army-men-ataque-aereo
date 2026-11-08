const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { game } = require('../support/fake-host.cjs');
const Renderer = require('../src/toy-renderer.js');

// Mock de AudioContext (como tests/audio-epico.test.cjs): registra
// las fuentes que arrancan y los valores programados, sin sonido.
function mockAudio(muted = false) {
  const started = [];
  const gainValues = [];
  const param = (v = 0) => ({
    value: v,
    setValueAtTime(value) {
      gainValues.push(value);
      this.value = value;
    },
    exponentialRampToValueAtTime(value) {
      gainValues.push(value);
      this.value = value;
    },
    linearRampToValueAtTime(value) {
      gainValues.push(value);
      this.value = value;
    },
  });
  const node = (kind) => ({
    kind,
    frequency: param(0),
    gain: param(0),
    connect() {},
    disconnect() {},
    start() {
      started.push(this);
    },
    stop() {
      this.stopped = true;
    },
  });
  const audio = require('../src/audio.js').create({
    host: {
      document: { hidden: false },
      navigator: {},
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      setTimeout: (fn) => fn(),
    },
    isPlaying: () => true,
    isMuted: () => muted,
  });
  audio.AC = {
    sampleRate: 100,
    currentTime: 0,
    destination: {},
    createBuffer(_, length) {
      return { getChannelData: () => new Float32Array(length) };
    },
    createBufferSource: () => node('src'),
    createBiquadFilter: () => node('filter'),
    createOscillator: () => node('osc'),
    createGain: () => node('gain'),
    suspend: () => Promise.resolve(),
  };
  return { audio, started, gainValues };
}

// Sonido: winch, portal, alarma y fanfarria son sintetizados y suenan.
test('los nuevos efectos (winch, portal, alarma, fanfarria) arrancan fuentes', () => {
  const { audio, started } = mockAudio();
  for (const name of ['winch', 'portal', 'alarm', 'fanfare']) {
    const before = started.length;
    audio.sfx[name]();
    assert.ok(
      started.length > before,
      `${name} arranca al menos una fuente`,
    );
  }
});

test('la fanfarria toca cuatro notas en re mayor (D–F#–A–D)', () => {
  const { audio, started, gainValues } = mockAudio();
  const before = started.length;
  audio.sfx.fanfare();
  assert.ok(
    started.length - before >= 4,
    `la fanfarria arranca ${started.length - before} fuentes`,
  );
  for (const f of [293.66, 369.99, 440.0, 587.33])
    assert.ok(
      gainValues.some((v) => Math.abs(v - f) < 0.01),
      `la fanfarria incluye la nota ${f} Hz`,
    );
});

test('los nuevos efectos no suenan silenciados', () => {
  const { audio, started } = mockAudio();
  const live = mockAudio(true);
  live.audio.AC = audio.AC;
  for (const name of ['winch', 'portal', 'alarm', 'fanfare'])
    live.audio.sfx[name]();
  assert.equal(started.length, 0, 'silenciado no arranca ninguna fuente');
});

test('el juego real expone los cuatro efectos nuevos', () => {
  const g = game();
  for (const name of ['winch', 'portal', 'alarm', 'fanfare'])
    assert.equal(
      typeof g.app.audio.sfx[name],
      'function',
      `sfx.${name} existe`,
    );
});

// Presentación: al arrancar una misión se anuncia su nombre y objetivo.
test('al arrancar se anuncia la misión con su nombre y objetivo', () => {
  const g = game();
  g.element('go').onclick();
  assert.equal(g.state.st, 'play');
  assert.equal(g.element('toast').style.display, 'block');
  assert.match(
    g.element('toast').textContent,
    /Misión 1\/3 · Pandemonio de Plástico/,
  );
  assert.ok(g.element('toast').textContent.length > 30);
  clearTimeout(g.app.view._toastTimer);
});

// Presentación: los avisos van en cola y se leen en orden, sin pisarse.
test('los toasts se muestran en cola, en orden, y luego se esconden', async () => {
  const g = game();
  g.app.ui.showToast('uno', 15);
  g.app.ui.showToast('dos', 15);
  assert.equal(g.element('toast').textContent, 'uno');
  assert.equal(g.element('toast').style.display, 'block');
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(g.element('toast').textContent, 'dos');
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(g.element('toast').style.display, 'none');
});

// Presentación: con salud baja la barra y SALUD se ponen en rojo.
test('con salud 3 o menos la barra de salud se pone en rojo y se recupera al curarse', () => {
  const g = game();
  g.element('go').onclick();
  g.state.P.arm = 3;
  g.app.ui.updateHUD();
  assert.equal(g.element('armLabel').style.color, '#ff6b5e');
  assert.equal(g.element('ai').style.background, '#ff6b5e');
  g.state.P.arm = 10;
  g.app.ui.updateHUD();
  assert.equal(g.element('armLabel').style.color, '');
  assert.equal(g.element('ai').style.background, '');
});

// Presentación: recibir daño hasta salud 3 dispara la alarma sin romper.
test('recibir daño hasta salud 3 no rompe y deja la salud en 3', () => {
  const g = game();
  g.element('go').onclick();
  g.state.P.arm = 4;
  g.state.P.inv = 0;
  g.app.hurt();
  assert.equal(g.state.P.arm, 3);
  assert.equal(g.state.st, 'play');
});

// Cableado: los eventos de misión usan los efectos nuevos (no el pick genérico).
test('el winch, el portal y la fanfarria están cableados a sus eventos', () => {
  const gameSrc = fs.readFileSync(
    path.join(__dirname, '../src/game.js'),
    'utf8',
  );
  assert.match(gameSrc, /cargo-lifted[\s\S]{0,120}sfx\.winch\(\)/);
  assert.match(gameSrc, /cargo-delivered[\s\S]{0,120}sfx\.portal\(\)/);
  assert.match(gameSrc, /event === 'complete'[\s\S]{0,120}sfx\.fanfare\(\)/);
  assert.match(gameSrc, /state\.P\.arm === 3[\s\S]{0,80}sfx\.alarm\(\)/);
  const css = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
  assert.ok(css.includes('#arm.low'), 'CSS de salud baja');
  assert.ok(css.includes('@keyframes armLow'), 'animación de salud baja');
});

// Cielo: las nubes son deterministas, altas, con tamaño positivo y derivan.
test('las nubes son deterministas, están altas y derivan con el tiempo', () => {
  assert.deepEqual(
    Renderer.cloudPositions(10, 5, -7, 0.4),
    Renderer.cloudPositions(10, 5, -7, 0.4),
  );
  const clouds = Renderer.cloudPositions(0, 0, 0, 0);
  assert.equal(clouds.length, 6);
  for (const c of clouds) {
    assert.ok(c.y >= 55 && c.y <= 71, `nube a y=${c.y}`);
    assert.ok(Math.hypot(c.x, c.z) <= 130, 'nube cerca de la cámara');
    assert.ok(c.sx > 0 && c.sy > 0 && c.sz > 0);
  }
  const later = Renderer.cloudPositions(100, 0, 0, 0);
  assert.ok(
    later.some((c, i) => c.x !== clouds[i].x || c.z !== clouds[i].z),
    'las nubes se mueven con el tiempo',
  );
  assert.ok(
    later.every((c, i) => c.y === clouds[i].y),
    'las nubes no cambian de altura',
  );
  // Las nubes siguen a la cámara: con la cámara en otro punto, las
  // nubes se desplazan con ella en vez de quedarse fijas en el mundo.
  const moved = Renderer.cloudPositions(0, 200, -150, 0);
  assert.ok(
    moved.every(
      (c, i) =>
        Math.abs(c.x - clouds[i].x - 200) < 0.001 &&
        Math.abs(c.z - clouds[i].z + 150) < 0.001,
    ),
    'las nubes siguen a la cámara',
  );
});

// Cielo: el renderer dibuja las nubes con detalle completo y las omite en ahorro.
test('el renderer dibuja 12 piezas de nube con detalle completo y ninguna en ahorro', () => {
  const listeners = {},
    counts = { draw: 0, compile: 0, viewport: [] };
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
      uniform3f: () => {},
      uniform3fv: () => {},
      uniform2f: () => {},
      uniform1f: () => {},
      bufferData: () => {},
      drawArrays: () => {
        counts.draw++;
      },
      compileShader: () => counts.compile++,
      viewport: (...args) => counts.viewport.push(args),
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
    addEventListener: (type, fn) => (listeners[type] = fn),
  };
  const r = new Renderer(canvas, () => {}, () => {});
  const scene = (perfLevel) => ({
    W: 390,
    H: 844,
    F: 390 / 105,
    HY: 844 * 0.52,
    cam: { x: 0, z: 0, yaw: Math.PI / 5 },
    PITCH: Math.PI / 3,
    P: { x: 0, y: 8, z: 0, yaw: 0, inv: 0 },
    E: [],
    DC: [],
    BL: [],
    EB: [],
    MS: [],
    FX: [],
    SM: [
      { x: 0, y: 8, z: 0, l: 0.6, max: 0.9, s: 1.5, dark: false, dx: 0, dy: 0.5, dz: 0 },
      { x: 2, y: 8, z: 2, l: 0.3, max: 0.9, s: 3, dark: true, dx: 0, dy: 0.7, dz: 0 },
    ],
    DB: [],
    PK: [],
    rot: 1,
    t: 0,
    perfLevel,
  });
  assert.equal(r.render(scene(0)), true);
  const full = counts.draw;
  assert.equal(r.render(scene(2)), true);
  const saving = counts.draw - full;
  // 6 nubes × 2 piezas = 12 dibujos menos en ahorro (el humo aporta
  // como mucho 1 menos por el stride del nivel 2).
  assert.ok(full - saving >= 12, `detalle completo dibuja ${full}, ahorro ${saving}`);
});
