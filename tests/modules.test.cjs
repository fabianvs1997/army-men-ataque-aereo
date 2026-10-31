const { test } = require('node:test');
const assert = require('node:assert/strict');
test('classic modules expose usable CommonJS APIs without an HTML document', () => {
  for (const name of [
    'prefs',
    'audio',
    'input',
    'combat',
    'ui',
    'render2d',
    'game',
  ])
    assert.equal(typeof require('../src/' + name + '.js').create, 'function');
  assert.equal(typeof require('../src/toy-missions.js').Mission, 'function');
});
test('audio caches noise by sample length and obeys injected playing/mute flags', () => {
  let playing = true,
    muted = false,
    allocated = 0,
    started = 0;
  const node = () => ({
    frequency: { value: 0 },
    gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect() {},
    disconnect() {},
    start() {
      started++;
    },
  });
  const audio = require('../src/audio.js').create({
    host: { document: { hidden: false } },
    isPlaying: () => playing,
    isMuted: () => muted,
  });
  audio.AC = {
    sampleRate: 100,
    currentTime: 0,
    destination: {},
    createBuffer(_, length) {
      allocated++;
      return { getChannelData: () => new Float32Array(length) };
    },
    createBufferSource: node,
    createBiquadFilter: node,
    createGain: node,
  };
  audio.noise(0.5, 0.4, 2500);
  audio.noise(0.5, 0.4, 2500);
  assert.equal(allocated, 1);
  assert.equal(started, 2);
  audio.noise(0.25, 0.4, 2500);
  assert.equal(allocated, 2);
  playing = false;
  audio.noise(0.5, 0.4, 2500);
  muted = true;
  playing = true;
  audio.noise(0.5, 0.4, 2500);
  assert.equal(started, 3);
});

test('audio suspend releases rotor nodes and pauses its reusable silent element', () => {
  const a = require('../src/audio.js').create({
    host: {},
    isPlaying: () => true,
    isMuted: () => false,
  });
  let stopped = 0,
    disconnected = 0,
    paused = 0,
    suspended = 0;
  const node = () => ({
    stop() {
      stopped++;
    },
    disconnect() {
      disconnected++;
    },
  });
  a.hum = { o: node(), l: node(), lg: node(), g: node(), f: node() };
  const silent = {
    pause() {
      paused++;
    },
  };
  a.sil = silent;
  a.AC = {
    suspend() {
      suspended++;
      return Promise.resolve();
    },
  };
  a.suspend();
  assert.equal(stopped, 2);
  assert.equal(disconnected, 5);
  assert.equal(paused, 1);
  assert.equal(suspended, 1);
  assert.equal(a.sil, silent);
  assert.equal(a.hum, null);
});
