const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../src/supabase.js');

const CONFIG = { url: 'https://xyz.supabase.co', anonKey: 'a'.repeat(30) };
function memoryStorage() {
  const saved = new Map();
  return {
    saved,
    getItem: (k) => saved.get(k),
    setItem: (k, v) => saved.set(k, v),
  };
}
function fakeClient() {
  const inserted = { scores: [], error_logs: [], profiles: [] };
  let sessionUser = null;
  const auth = {
    async getSession() {
      return { data: { session: sessionUser ? { user: sessionUser } : null } };
    },
    async signUp({ email }) {
      if (email.includes('bad')) return { data: {}, error: new Error('email no válido') };
      sessionUser = { id: 'u1', email };
      return { data: { user: sessionUser, session: { user: sessionUser } }, error: null };
    },
    async signInWithPassword({ email }) {
      sessionUser = { id: 'u1', email };
      return { data: { session: { user: sessionUser } }, error: null };
    },
    async signOut() {
      sessionUser = null;
      return { error: null };
    },
    onAuthStateChange() {},
  };
  const from = (table) => ({
    async insert(rows) {
      inserted[table].push(...(Array.isArray(rows) ? rows : [rows]));
      return { error: null };
    },
    async upsert(row) {
      inserted[table].push(row);
      return { error: null };
    },
    select() {
      const chain = {
        eq() {
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        then(resolve) {
          resolve({ data: inserted[table].slice(), error: null });
        },
      };
      return chain;
    },
  });
  return { auth, from, inserted, get sessionUser() { return sessionUser; } };
}
function online(options = {}) {
  const client = fakeClient();
  const api = create({
    config: CONFIG,
    getStorage: () => memoryStorage(),
    clientFactory: async () => client,
    ...options,
  });
  return { api, client };
}

test('sin configuración, Supabase es un no-op offline y pone en cola', async () => {
  const storage = memoryStorage();
  const api = create({
    config: { url: '', anonKey: '' },
    getStorage: () => storage,
  });
  assert.equal(api.configured(), false);
  assert.deepEqual(await api.init(), { ok: false, reason: 'not-configured' });
  const saved = await api.saveScore({ mission: 1, score: 100, stars: 2, survivors: 3 });
  assert.equal(saved.ok, false);
  assert.equal(saved.queued, true);
  assert.equal(api.pendingCount(), 1);
  assert.deepEqual((await api.fetchTopScores()).rows, []);
});

test('invitado: la puntuación queda en cola y se envía al iniciar sesión', async () => {
  const storage = memoryStorage();
  const { api, client } = online({ getStorage: () => storage });
  assert.equal(api.configured(), true);
  const guest = await api.saveScore({ mission: 2, score: 250, stars: 3, survivors: 7 });
  assert.equal(guest.reason, 'guest');
  assert.equal(api.pendingCount(), 1);
  await api.signIn('a@b.c', 'secreto');
  assert.equal(api.getUser().email, 'a@b.c');
  const flushed = await api.flushPendingScores();
  assert.equal(flushed.sent, 1);
  assert.equal(api.pendingCount(), 0);
  assert.equal(client.inserted.scores.length, 1);
  assert.equal(client.inserted.scores[0].user_id, 'u1');
  assert.equal(client.inserted.scores[0].mission, 2);
});

test('con sesión, la puntuación se guarda directa y se leen las propias', async () => {
  const { api, client } = online();
  await api.signIn('a@b.c', 'secreto');
  const saved = await api.saveScore({ mission: 1, score: 400, stars: 3, survivors: 7 });
  assert.equal(saved.ok, true);
  assert.equal(client.inserted.scores[0].score, 400);
  const mine = await api.fetchMyScores();
  assert.equal(mine.ok, true);
  assert.equal(mine.rows.length, 1);
  const top = await api.fetchTopScores(1, 5);
  assert.equal(top.ok, true);
  assert.equal(top.rows[0].score, 400);
});

test('puntuación inválida no se guarda ni se pone en cola', async () => {
  const { api } = online();
  const bad = await api.saveScore({ mission: 9, score: -1, stars: 2, survivors: 0 });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'invalid-score');
  assert.equal(api.pendingCount(), 0);
});

test('los errores locales se envían a error_logs en lotes', async () => {
  const { api, client } = online();
  await api.signIn('a@b.c', 'secreto');
  const entries = Array.from({ length: 30 }, (_, i) => ({
    message: 'e' + i,
    stack: '',
    version: 'test-1',
    mission: 2,
    phase: 'ESCOLTAR_BC',
    seed: 7,
    ms: 600,
    device: 'iPhone',
  }));
  const sent = await api.flushLogs(entries);
  assert.equal(sent.ok, true);
  assert.equal(sent.sent, 30);
  assert.equal(client.inserted.error_logs.length, 30);
  assert.equal(client.inserted.error_logs[0].user_id, 'u1');
  assert.equal(client.inserted.error_logs[0].mission, 2);
});

test('registro y cierre de sesión actualizan el usuario', async () => {
  const { api } = online();
  const bad = await api.signUp('bad@x.y', 'Malo', 'pw');
  assert.equal(bad.ok, false);
  const good = await api.signUp('nuevo@b.c', 'Nuevo', 'pw');
  assert.equal(good.ok, true);
  assert.equal(api.getUser().email, 'nuevo@b.c');
  await api.signOut();
  assert.equal(api.getUser(), null);
});
