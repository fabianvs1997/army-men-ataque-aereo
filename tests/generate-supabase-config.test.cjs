const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'generate-supabase-config.cjs');
const URL = 'https://test-env.supabase.co';
const KEY = 'sb_publishable_0123456789abcdefghij';

function tmpdir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'supabase-gen-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function run(dir, env = {}, envFileContent = null) {
  const out = path.join(dir, 'supabase-env.js');
  const envFile = path.join(dir, '.env');
  if (envFileContent !== null) fs.writeFileSync(envFile, envFileContent);
  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--out', out, '--env-path', envFile],
    {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    },
  );
  return { result, out };
}

function readInjected(out) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(out, 'utf8'), context, { filename: out });
  return context.__SUPABASE_CONFIG__;
}

test('sin variables genera una configuración vacía (modo invitado)', (t) => {
  const dir = tmpdir(t);
  const { result, out } = run(dir, {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
  });
  assert.equal(result.status, 0, result.stderr);
  const config = readInjected(out);
  assert.equal(config.url, '');
  assert.equal(config.anonKey, '');
  assert.match(result.stdout, /invitado/);
});

test('con variables de entorno genera el archivo inyectable', (t) => {
  const dir = tmpdir(t);
  const { result, out } = run(dir, { SUPABASE_URL: URL, SUPABASE_ANON_KEY: KEY });
  assert.equal(result.status, 0, result.stderr);
  const config = readInjected(out);
  assert.equal(config.url, URL);
  assert.equal(config.anonKey, KEY);
  // La clave no se imprime en la salida del generador.
  assert.doesNotMatch(result.stdout + result.stderr, /sb_publishable_0123456789/);
});

test('lee los valores de un archivo .env y las variables mandan sobre él', (t) => {
  const dir = tmpdir(t);
  const { result, out } = run(
    dir,
    { SUPABASE_URL: URL, SUPABASE_ANON_KEY: KEY },
    '# comentario\nSUPABASE_URL="https://otro.supabase.co"\nSUPABASE_ANON_KEY="clave-de-ejemplo-larga-0123456789"\n',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readInjected(out).url, URL);
  const fromFile = run(dir, { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' }, 'SUPABASE_URL=https://otro.supabase.co\nSUPABASE_ANON_KEY=clave-de-ejemplo-larga-0123456789\n');
  assert.equal(fromFile.result.status, 0, fromFile.result.stderr);
  assert.equal(readInjected(fromFile.out).url, 'https://otro.supabase.co');
});

test('falla si falta una de las dos variables', (t) => {
  const dir = tmpdir(t);
  const onlyUrl = run(dir, { SUPABASE_URL: URL, SUPABASE_ANON_KEY: '' });
  assert.notEqual(onlyUrl.result.status, 0);
  assert.equal(fs.existsSync(onlyUrl.out), false);
  const onlyKey = run(dir, { SUPABASE_URL: '', SUPABASE_ANON_KEY: KEY });
  assert.notEqual(onlyKey.result.status, 0);
});

test('falla con una URL que no sea de Supabase', (t) => {
  const dir = tmpdir(t);
  const { result, out } = run(dir, {
    SUPABASE_URL: 'https://evil.example.com',
    SUPABASE_ANON_KEY: KEY,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /supabase\.co/);
  assert.equal(fs.existsSync(out), false);
});

test('falla si la clave parece la secreta (service_role)', (t) => {
  const dir = tmpdir(t);
  const { result, out } = run(dir, {
    SUPABASE_URL: URL,
    SUPABASE_ANON_KEY: 'service_role_0123456789abcdefghij',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /secreta/);
  assert.equal(fs.existsSync(out), false);
  const secret = run(dir, {
    SUPABASE_URL: URL,
    SUPABASE_ANON_KEY: 'sb_secret_0123456789abcdefghij',
  });
  assert.notEqual(secret.result.status, 0);
});
