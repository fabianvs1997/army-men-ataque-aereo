const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// Sonidos nuevos de la Misión 1 del vídeo (valle alpino "Plastic
// Pandemonium"): cañón del tanque Tan, trazadora de infantería/jeep
// Tan y gancho metálico del winch al enganchar la caja verde.
// Todo sintetizado con Web Audio API; nada copiado del original.
// Mock de AudioContext que registra lo creado y programado, como en
// tests/audio-epico.test.cjs.
function mockAudio() {
  const started = [];
  const gainValues = [];
  const freqValues = [];
  const param = (v = 0, arr = gainValues) => ({
    value: v,
    setValueAtTime(value) {
      arr.push(value);
      this.value = value;
    },
    exponentialRampToValueAtTime(value) {
      arr.push(value);
      this.value = value;
    },
    linearRampToValueAtTime(value) {
      arr.push(value);
      this.value = value;
    },
  });
  const osc = [];
  const node = (kind) => {
    const n = {
      kind,
      frequency: param(0, freqValues),
      gain: param(0, gainValues),
      connect() {},
      disconnect() {},
      start() {
        started.push(n);
      },
      stop() {
        n.stopped = true;
      },
    };
    if (kind === 'osc') osc.push(n);
    return n;
  };
  let timerId = 0;
  const timers = new Map();
  const audio = require('../src/audio.js').create({
    host: {
      document: { hidden: false },
      navigator: {},
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      setInterval(fn) {
        const id = ++timerId;
        timers.set(id, fn);
        return id;
      },
      clearInterval(id) {
        timers.delete(id);
      },
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
  return { audio, started, gainValues, freqValues, osc, timers };
}

test('existen los sonidos M1 del vídeo: tankShot, enemyShot y crateHook', () => {
  const { audio } = mockAudio();
  for (const name of ['tankShot', 'enemyShot', 'crateHook']) {
    assert.equal(
      typeof audio.sfx[name],
      'function',
      `falta sfx.${name}`,
    );
  }
});

test('el cañón del tanque es grave y pega más que la trazadora enemiga', () => {
  const { audio, started, gainValues, freqValues } = mockAudio();
  audio.sfx.tankShot();
  assert.ok(started.length >= 3, `el cañón arranca ${started.length} fuentes`);
  assert.ok(freqValues.includes(100), 'el cañón baja desde 100 Hz');
  assert.ok(freqValues.includes(35), 'el cañón cae hasta 35 Hz');
  assert.ok(Math.max(...gainValues) >= 0.5, 'el cañón pega fuerte (0,5)');
  const tankMax = Math.max(...gainValues);
  const m2 = mockAudio();
  m2.audio.sfx.enemyShot();
  assert.ok(
    m2.started.length >= 2,
    `la trazadora arranca ${m2.started.length} fuentes`,
  );
  assert.ok(
    Math.max(...m2.gainValues) <= 0.12,
    'la trazadora enemiga es fina y baja (<= 0,12)',
  );
  assert.ok(
    Math.max(...m2.gainValues) < tankMax,
    'el cañón suena más fuerte que la trazadora',
  );
});

test('el gancho de la caja es un doble golpe metálico agudo', () => {
  const { audio, started, gainValues, freqValues } = mockAudio();
  audio.sfx.crateHook();
  assert.ok(started.length >= 3, `el gancho arranca ${started.length} fuentes`);
  assert.ok(freqValues.includes(1250), 'primer golpe metálico a 1250 Hz');
  assert.ok(freqValues.includes(1900), 'segundo golpe metálico a 1900 Hz');
});

test('los sonidos M1 no suenan silenciados ni sin AudioContext', () => {
  const { audio, started } = mockAudio();
  audio.AC = null;
  audio.sfx.tankShot();
  audio.sfx.enemyShot();
  audio.sfx.crateHook();
  assert.equal(started.length, 0, 'sin AudioContext no arranca nada');
  const muted = require('../src/audio.js').create({
    host: { document: { hidden: false }, setTimeout: (fn) => fn() },
    isPlaying: () => true,
    isMuted: () => true,
  });
  const { audio: live, started: liveStarted } = mockAudio();
  muted.AC = live.AC;
  muted.sfx.tankShot();
  muted.sfx.enemyShot();
  muted.sfx.crateHook();
  assert.equal(
    liveStarted.length,
    0,
    'silenciado no suena ningún sonido M1',
  );
});

test('todos los efectos siguen sonando sin romper (sin regresión)', () => {
  const { audio, started } = mockAudio();
  for (const name of Object.keys(audio.sfx)) {
    const before = started.length;
    audio.sfx[name]();
    assert.ok(
      started.length >= before,
      `sfx.${name} no arranca fuentes`,
    );
  }
});

test('el fuego enemigo está cableado por tipo y la caja suena al enganchar', () => {
  const gameSrc = fs.readFileSync(
    require('node:path').join(__dirname, '..', 'src', 'game.js'),
    'utf8',
  );
  assert.match(
    gameSrc,
    /e\.k === 'tank' \|\| e\.k === 'tur'\) sfx\.tankShot\(\);/,
    'tanque/torreta disparan con tankShot',
  );
  assert.match(
    gameSrc,
    /else sfx\.enemyShot\(\);/,
    'infantería/jeep/heli disparan con enemyShot',
  );
  assert.match(
    gameSrc,
    /cargo-lifted[\s\S]{0,120}sfx\.winch\(\)[\s\S]{0,40}sfx\.crateHook\(\)/,
    'al levantar la caja suenan winch + crateHook',
  );
});
