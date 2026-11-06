const { test } = require('node:test');
const assert = require('node:assert/strict');

// La configuración ya no vive en el archivo: llega inyectada en
// `globalThis.__SUPABASE_CONFIG__` (generada en el despliegue o en
// local desde variables de entorno). Sin inyección, modo invitado.
const config = require('../src/supabase-config.js');

function setInjected(value) {
  if (value === undefined) delete globalThis.__SUPABASE_CONFIG__;
  else globalThis.__SUPABASE_CONFIG__ = value;
}

test('sin inyección no hay configuración: modo invitado', () => {
  setInjected(undefined);
  assert.equal(config.url, '');
  assert.equal(config.anonKey, '');
  assert.equal(config.isConfigured(), false);
  assert.equal(config.source, 'none');
});

test('con inyección válida la configuración está activa', () => {
  setInjected({
    url: 'https://xyz.supabase.co',
    anonKey: 'sb_publishable_0123456789abcdefghij',
  });
  assert.equal(config.url, 'https://xyz.supabase.co');
  assert.equal(config.anonKey, 'sb_publishable_0123456789abcdefghij');
  assert.equal(config.isConfigured(), true);
  assert.equal(config.source, 'injected');
  setInjected(undefined);
});

test('la configuración se lee en el momento de usarla, no al cargar', () => {
  setInjected(undefined);
  assert.equal(config.isConfigured(), false);
  // La inyección llega después de haber cargado el módulo (el archivo
  // generado se carga antes en el navegador, pero el lector no depende
  // del orden de carga).
  setInjected({ url: 'https://xyz.supabase.co', anonKey: 'a'.repeat(30) });
  assert.equal(config.isConfigured(), true);
  setInjected(undefined);
  assert.equal(config.isConfigured(), false);
});

test('una URL que no sea de Supabase no activa el servidor', () => {
  setInjected({ url: 'https://evil.example.com', anonKey: 'a'.repeat(30) });
  assert.equal(config.isConfigured(), false);
  setInjected({ url: 'http://xyz.supabase.co', anonKey: 'a'.repeat(30) });
  assert.equal(config.isConfigured(), false);
  setInjected(undefined);
});

test('una clave corta no activa el servidor', () => {
  setInjected({ url: 'https://xyz.supabase.co', anonKey: 'corta' });
  assert.equal(config.isConfigured(), false);
  setInjected(undefined);
});

test('una inyección con forma incorrecta no rompe el juego', () => {
  setInjected('https://xyz.supabase.co');
  assert.equal(config.isConfigured(), false);
  assert.equal(config.url, '');
  setInjected({ url: 123, anonKey: null });
  assert.equal(config.isConfigured(), false);
  setInjected(undefined);
});
