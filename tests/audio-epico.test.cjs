const { test } = require('node:test');
const assert = require('node:assert/strict');

// Mock de AudioContext que registra todo lo que se crea y se programa,
// para probar el rotor, los disparos y la música sin sonido real.
function mockAudio() {
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
  const osc = [];
  const gains = [];
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
    if (kind === 'osc') osc.push(n);
    if (kind === 'gain') gains.push(n);
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
  return { audio, started, gainValues, osc, gains, timers };
}

test('la partitura épica es determinista y el bucle cierra sin huecos', () => {
  const { audio } = mockAudio();
  const loop = audio.MUSIC_LOOP;
  assert.ok(Math.abs(loop - (8 * 4 * 60) / 92) < 0.001);
  const score = audio.musicScore();
  assert.deepEqual(score, audio.musicScore());
  assert.equal(score.filter((e) => e.kind === 'drum').length, 16);
  assert.equal(score.filter((e) => e.kind === 'snare').length, 16);
  assert.equal(score.filter((e) => e.kind === 'drone').length, 8);
  assert.equal(score.filter((e) => e.kind === 'brass').length, 48);
  assert.equal(score.filter((e) => e.kind === 'horn').length, 6);
  for (const e of score) {
    assert.ok(e.at >= 0 && e.at + e.dur <= loop + 0.001, JSON.stringify(e));
    assert.ok(e.vol > 0 && e.vol <= 0.5);
  }
  // El evento que más tarde termina (la trompa del compás 8) cierra
  // justo al final del bucle: al repetirse, no hay hueco ni solape.
  const latestEnd = Math.max(...score.map((e) => e.at + e.dur));
  assert.ok(Math.abs(latestEnd - loop) < 0.01);
});

test('musicOn programa la música en bucle y musicOff la para', () => {
  const { audio, started, timers } = mockAudio();
  audio.musicOn(1);
  assert.equal(audio.musicActive, true);
  assert.equal(timers.size, 1);
  const scheduled = started.length;
  assert.ok(scheduled > 10, `se programaron ${scheduled} notas`);
  audio.musicOn(1);
  assert.equal(timers.size, 1, 'un segundo musicOn no duplica el programador');
  // Avanza el reloj: el programador sigue el bucle sin recrear el bus.
  audio.AC.currentTime = 5;
  for (const fn of [...timers.values()]) fn();
  assert.ok(started.length > scheduled, 'el programador sigue programando');
  audio.musicOff();
  assert.equal(audio.musicActive, false);
  assert.equal(timers.size, 0);
  const afterOff = started.length;
  audio.AC.currentTime = 30;
  assert.equal(started.length, afterOff, 'tras musicOff no se programa nada');
});

test('la música no arranca sin AudioContext ni con el sonido silenciado', () => {
  const { audio, timers } = mockAudio();
  audio.AC = null;
  audio.musicOn(1);
  assert.equal(audio.musicActive, false);
  assert.equal(timers.size, 0);
  const muted = require('../src/audio.js').create({
    host: { document: { hidden: false } },
    isPlaying: () => true,
    isMuted: () => true,
  });
  muted.AC = mockAudio().audio.AC;
  muted.musicOn(1);
  assert.equal(muted.musicActive, false);
});

test('el rotor tiene chop de ~11 Hz y sube con la velocidad', () => {
  const { audio, osc } = mockAudio();
  audio.humOn();
  assert.ok(audio.hum, 'el rotor arranca');
  const lfo = osc.find((o) => o.type === 'sine');
  const low = osc.find((o) => o.frequency.value === 55);
  assert.ok(lfo, 'hay un LFO de chop');
  assert.equal(lfo.frequency.value, 11);
  assert.ok(low, 'hay una sierra grave de 55 Hz');
  audio.rotorSet(1, 0);
  assert.equal(lfo.frequency.value, 15);
  assert.ok(audio.hum.g.gain.value > 0.06, 'el rotor suena más fuerte a fondo');
  audio.rotorSet(0, 0);
  assert.equal(lfo.frequency.value, 11);
  audio.humOff();
  assert.equal(audio.hum, null);
  assert.ok(osc.every((o) => o.stopped), 'humOff para todos los osciladores');
});

test('el disparo tiene tres capas y el silencio lo apaga', () => {
  const { audio, started, gainValues } = mockAudio();
  audio.sfx.shot();
  assert.ok(started.length >= 3, `el disparo arranca ${started.length} fuentes`);
  assert.ok(Math.max(...gainValues) >= 0.3, 'el disparo pega más que antes');
  const before = started.length;
  const muted = require('../src/audio.js').create({
    host: { document: { hidden: false } },
    isPlaying: () => true,
    isMuted: () => true,
  });
  muted.AC = audio.AC;
  muted.sfx.shot();
  assert.equal(started.length, before, 'silenciado no suena ningún disparo');
});

test('la música suena por debajo de los efectos y suspend la para', () => {
  const { audio, gains, timers } = mockAudio();
  audio.musicOn(1);
  const bus = gains.find((g) => g.gain.value === 0.12);
  assert.ok(bus, 'el bus de música queda a 0,12, por debajo del disparo (0,30)');
  audio.suspend();
  assert.equal(audio.musicActive, false);
  assert.equal(timers.size, 0);
  assert.equal(audio.hum, null);
});
