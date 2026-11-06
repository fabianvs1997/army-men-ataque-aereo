const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../src/logger.js');

function memoryStorage() {
  const saved = new Map();
  return {
    saved,
    getItem: (k) => saved.get(k),
    setItem: (k, v) => saved.set(k, v),
  };
}
function logger(options = {}) {
  return create({
    getStorage: () => memoryStorage(),
    version: 'test-1',
    device: 'iPhone Safari',
    getContext: () => ({
      mission: 2,
      phase: 'ESCOLTAR_BC',
      seed: 123,
      fps: 30,
      ms: 33.3,
      level: 1,
    }),
    ...options,
  });
}

test('logger registra errores con el contexto de la partida', () => {
  const log = logger();
  const entry = log.error(new Error('boom'));
  assert.equal(entry.type, 'error');
  assert.equal(entry.message, 'boom');
  assert.match(entry.stack, /boom/);
  assert.equal(entry.version, 'test-1');
  assert.equal(entry.mission, 2);
  assert.equal(entry.phase, 'ESCOLTAR_BC');
  assert.equal(entry.seed, 123);
  assert.equal(entry.fps, 30);
  assert.equal(entry.device, 'iPhone Safari');
  assert.equal(log.count, 1);
  assert.equal(log.list()[0].message, 'boom');
});

test('logger rota a las últimas 100 entradas', () => {
  const log = logger();
  for (let i = 0; i < 105; i++) log.record('error', 'e' + i);
  assert.equal(log.count, 100);
  assert.equal(log.list()[0].message, 'e5');
  assert.equal(log.list()[99].message, 'e104');
});

test('logger anota congelamientos largos con enfriamiento', () => {
  const log = logger();
  assert.equal(log.noteFrame(100), null);
  assert.equal(log.noteFrame(600, 1000).type, 'freeze');
  assert.equal(log.noteFrame(700, 2000), null);
  assert.equal(log.noteFrame(800, 7000).type, 'freeze');
  assert.equal(log.count, 2);
});

test('logger captura errores del host y console.error', () => {
  const storage = memoryStorage();
  const log = create({
    getStorage: () => storage,
    version: 'test-1',
    getContext: () => ({}),
  });
  const listeners = {};
  const host = {
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
  };
  const seen = [];
  const fakeConsole = {
    error(...args) {
      seen.push(args.join(' '));
    },
  };
  assert.equal(log.install(host, fakeConsole), true);
  listeners.error({ message: 'fallo de host' });
  listeners.unhandledrejection({ reason: new Error('promesa rota') });
  fakeConsole.error('algo salió mal');
  assert.equal(log.count, 3);
  assert.equal(log.list()[0].message, 'fallo de host');
  assert.equal(log.list()[1].message, 'promesa rota');
  assert.equal(log.list()[2].type, 'console');
  assert.deepEqual(seen, ['algo salió mal']);
});

test('logger no rompe el juego si el almacenamiento falla', () => {
  const log = create({
    getStorage: () => {
      throw new Error('storage bloqueado');
    },
    version: 'test-1',
  });
  log.record('error', 'sin disco');
  assert.equal(log.count, 1);
  assert.equal(log.list()[0].message, 'sin disco');
  log.clear();
  assert.equal(log.count, 0);
});

test('logger exporta el registro como JSON', () => {
  const log = logger();
  log.record('error', 'a');
  log.record('freeze', 'b');
  const data = JSON.parse(log.exportText());
  assert.equal(data.length, 2);
  assert.equal(data[0].type, 'error');
  assert.equal(data[1].type, 'freeze');
});
