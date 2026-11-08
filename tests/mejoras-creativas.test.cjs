const { test } = require('node:test');
const assert = require('node:assert/strict');
const Maps = require('../src/original-maps.js');
const World = require('../src/toy-world.js');
const Renderer = require('../src/toy-renderer.js');
const { game } = require('../support/fake-host.cjs');

// Mock de AudioContext que registra lo que se crea y se programa,
// copiado del patrón de tests/audio-epico.test.cjs.
function mockAudio() {
  const started = [];
  const param = (v = 0) => ({
    value: v,
    setValueAtTime(value) {
      this.value = value;
    },
    exponentialRampToValueAtTime(value) {
      this.value = value;
    },
    linearRampToValueAtTime(value) {
      this.value = value;
    },
  });
  const node = (kind) => {
    const n = {
      kind,
      frequency: param(0),
      gain: param(0),
      connect() {},
      disconnect() {},
      start() {
        started.push(n);
      },
      stop() {
        n.stopped = true;
      },
    };
    return n;
  };
  const audio = require('../src/audio.js').create({
    host: {
      document: { hidden: false },
      navigator: {},
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      setInterval: () => 1,
      clearInterval: () => {},
      setTimeout: (fn) => fn(),
    },
    isPlaying: () => true,
    isMuted: () => false,
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
  return { audio, started };
}

// --- Sonido: los efectos de Master (winch, portal, alarma, fanfarria) ---
// Esta rama traía sus propias variantes, pero Master ya trae esos
// sonidos (PR #60 y PR #61): al rebasar se descartan los duplicados
// y se quedan las versiones de Master, que son las que se prueban.

test('los efectos de Master (winch, portal, alarma, fanfarria) suenan y son distintos entre sí', () => {
  const { audio, started } = mockAudio();
  for (const name of ['winch', 'portal', 'alarm', 'fanfare']) {
    assert.equal(typeof audio.sfx[name], 'function', 'existe sfx.' + name);
    const before = started.length;
    audio.sfx[name]();
    assert.ok(started.length > before, 'sfx.' + name + ' programa sonido');
  }
  // La fanfarria de victoria son 4 notas ascendentes en re mayor más
  // un grave de apoyo en la última: 5 osciladores en total.
  const { audio: a2, started: s2 } = mockAudio();
  a2.sfx.fanfare();
  assert.equal(
    s2.filter((n) => n.kind === 'osc').length,
    5,
    'fanfare programa 5 osciladores',
  );
  // La alarma son 2 pitidos cortos.
  const { audio: a3, started: s3 } = mockAudio();
  a3.sfx.alarm();
  assert.equal(
    s3.filter((n) => n.kind === 'osc').length,
    2,
    'alarm programa 2 pitidos',
  );
});

test('la alarma de salud baja suena como mucho una vez cada 1,5 s', () => {
  const g = game();
  g.app.start(1, true);
  // Herir sin morir: arm baja a 3 y suena la alarma una vez.
  g.state.P.arm = 4;
  g.state.P.inv = 0;
  const calls = [];
  const sfx = g.app.audio.sfx;
  const origAlarm = sfx.alarm;
  sfx.alarm = () => calls.push(g.state.t);
  g.app.hurt();
  assert.equal(g.state.P.arm, 3);
  assert.equal(calls.length, 1, 'primera alarma');
  // Herir de nuevo enseguida: sin segunda alarma.
  g.state.P.inv = 0;
  g.state.t += 0.5;
  g.app.hurt();
  assert.equal(calls.length, 1, 'sin alarma repetida antes de 1,5 s');
  // Pasado el intervalo, vuelve a sonar.
  g.state.P.inv = 0;
  g.state.t += 1.5;
  g.app.hurt();
  assert.equal(calls.length, 2, 'alarma tras 1,5 s');
  sfx.alarm = origAlarm;
});

// --- Presentación: avisos inmediatos, salud baja, consejo y victoria ---

test('los avisos en pantalla sustituyen al visible de inmediato y el repetido se ignora', () => {
  const g = game();
  g.app.start(1, true);
  const ui = g.app.ui;
  ui.showToast('Primer aviso');
  assert.equal(g.element('toast').textContent, 'Primer aviso');
  assert.equal(g.element('toast').style.display, 'block');
  // El mismo texto repetido enseguida se ignora.
  ui.showToast('Primer aviso');
  assert.equal(g.element('toast').textContent, 'Primer aviso');
  // Un segundo aviso distinto sustituye al visible de inmediato,
  // sin esperar a que se esconda el primero.
  ui.showToast('Segundo aviso');
  assert.equal(g.element('toast').textContent, 'Segundo aviso');
  assert.equal(g.element('toast').style.display, 'block');
});

test('con salud baja la barra se pone roja y con salud normal vuelve al dorado', () => {
  const g = game();
  g.app.start(1, true);
  g.state.P.arm = 3;
  g.app.upd(0.05);
  assert.equal(g.element('ai').style.background, '#ff6b5e');
  assert.equal(g.element('armLabel').style.color, '#ff6b5e');
  g.state.P.arm = 8;
  g.app.upd(0.05);
  assert.equal(g.element('ai').style.background, '');
  assert.equal(g.element('armLabel').style.color, '');
});

test('el panel de Misión muestra el consejo propio de cada misión', () => {
  const tips = {
    1: /caja.*portal|portal.*caja/,
    2: /garajes/,
    3: /batería/,
  };
  for (const [n, re] of Object.entries(tips)) {
    const g = game();
    g.app.start(Number(n), true);
    g.element('missionBtn').onclick();
    assert.match(
      g.element('missionTip').textContent,
      /^Consejo: /,
      'M' + n + ' lleva Consejo:',
    );
    assert.match(g.element('missionTip').textContent, re, 'M' + n + ' consejo');
    g.element('missionClose').onclick();
  }
});

test('la pantalla de victoria desglosa estrellas, rescates y enemigos', () => {
  const g = game();
  g.app.start(1, true);
  g.state.mission.stars = 3;
  g.state.mission.delivered = 5;
  g.state.mission.kills = 20;
  g.state.P.sc = 1234;
  g.app.ui.presentState('win');
  assert.match(g.element('tx').textContent, /★★★/);
  assert.match(g.element('tx').textContent, /A salvo: 5\/\d+/);
  assert.match(g.element('tx').textContent, /Enemigos: 20/);
  assert.match(g.element('tx').textContent, /Puntos: 1234/);
});

// --- Terreno: detalle propio de cada misión ---

test('cada misión tiene su detalle propio, determinista y fuera de las rutas', () => {
  const expected = {
    1: { t: 'flower', count: 48 },
    2: { t: 'cone', count: 36 },
    3: { t: 'signal', count: 12 },
  };
  for (const [n, { t, count }] of Object.entries(expected)) {
    const map = Maps.generate(Number(n));
    assert.deepEqual(Maps.generate(Number(n)), map, 'M' + n + ' determinista');
    assert.equal(map.scenery.details.length, count, 'M' + n + ' detalles');
    for (const d of map.scenery.details) {
      assert.equal(d.t, t, 'M' + n + ' tipo ' + t);
      assert.ok(Number.isFinite(d.x) && Number.isFinite(d.z));
      assert.ok(Math.abs(d.x) < map.limit && Math.abs(d.z) < map.limit);
    }
    assert.deepEqual(Maps.validate(map), [], 'M' + n + ' válido');
  }
});

test('el mundo expone los detalles y el juego los añade a la decoración', () => {
  for (const n of [1, 2, 3]) {
    const map = Maps.generate(n);
    const world = World.create(map);
    assert.equal(
      world.details.length,
      map.scenery.details.length,
      'M' + n + ' detalles en el mundo',
    );
    const g = game();
    g.app.start(n, true);
    assert.ok(
      g.state.DC.length >=
        world.shrubs.length + world.details.length,
      'M' + n + ' DC incluye detalles',
    );
    assert.ok(
      g.state.DC.some((d) => d.t === map.scenery.details[0].t),
      'M' + n + ' detalle en DC',
    );
  }
});

test('el renderizador dibuja flores, conos y señales sin romper', () => {
  const counts = { draw: 0 };
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
        assert.ok(values.every(Number.isFinite), name);
        if (name === 'size') assert.ok(values.every((v) => v > 0));
      },
      uniform3fv: (name, values) =>
        assert.ok(values.every(Number.isFinite), name),
      uniform2f: () => {},
      uniform1f: (name, value) => assert.ok(Number.isFinite(value), name),
      bufferData: (_, data) => assert.ok(data.every(Number.isFinite)),
      drawArrays: () => {
        counts.draw++;
      },
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
  const scene = {
    W: 390,
    H: 844,
    F: 390 / 105,
    HY: 844 * 0.52,
    cam: { x: 0, z: 0, yaw: 0 },
    PITCH: Math.PI / 3,
    P: { x: 0, y: 8, z: 0, yaw: 0, inv: 0 },
    E: [],
    DC: [
      { t: 'flower', x: 5, z: 10, c: '#ffd94d' },
      { t: 'flower', x: -5, z: 12, c: '#f5f0dc' },
      { t: 'cone', x: 8, z: 10 },
      { t: 'signal', x: -8, z: 10 },
      { t: 'signal', x: -12, z: 14 },
    ],
    BL: [],
    EB: [],
    MS: [],
    FX: [],
    SM: [],
    PK: [],
    allies: [],
    rot: 0,
    t: 0,
  };
  const before = counts.draw;
  assert.equal(r.render(scene), true);
  // 2 piezas por flor, 3 por cono, 3 por señal: 13 dibujos nuevos.
  assert.ok(counts.draw - before >= 13, 'dibuja los 5 detalles');
});
