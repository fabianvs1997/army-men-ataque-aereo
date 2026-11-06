(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToySupabase = api;
})(globalThis, function () {
  'use strict';
  // Cliente opcional de Supabase: cuentas (Auth), puntuaciones y registro
  // remoto de errores. Sin configuración (ver src/supabase-config.js) el
  // juego sigue 100 % offline y todos los métodos devuelven
  // { ok: false, reason: 'not-configured' } sin lanzar errores.
  //
  // La librería oficial (@supabase/supabase-js, UMD) se carga solo cuando
  // hay configuración, desde el CDN de jsDelivr; si el CDN no carga
  // (sin red, file:// sin conexión), el juego sigue como invitado y las
  // puntuaciones quedan en cola local para reintentarlo luego. Las
  // contraseñas nunca se guardan en el juego: solo pasan por Supabase Auth.
  // La clave secreta (service_role) no se usa nunca aquí.
  const CDN_URL =
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  const PENDING_KEY = 'toy-pending-scores-v1';
  const MAX_PENDING = 20;
  const LOG_BATCH = 25;
  function configured(config) {
    if (!config) return false;
    if (typeof config.isConfigured === 'function') return config.isConfigured();
    return (
      typeof config.url === 'string' &&
      config.url.indexOf('https://') === 0 &&
      typeof config.anonKey === 'string' &&
      config.anonKey.length > 20
    );
  }
  function create(options = {}) {
    const config = options.config || {};
    const logger = options.logger || null;
    const host = options.host || (typeof globalThis !== 'undefined' ? globalThis : null);
    const getStorage =
      options.getStorage ||
      (() => {
        throw new Error('no storage');
      });
    const clientFactory = options.clientFactory || null;
    let client = null;
    let user = null;
    let initPromise = null;
    const authCallbacks = [];
    function logWarning(message) {
      try {
        if (logger) logger.record('console', message);
      } catch (_) {}
    }
    function readPending() {
      try {
        const raw = getStorage().getItem(PENDING_KEY);
        const data = raw ? JSON.parse(raw) : [];
        return Array.isArray(data) ? data : [];
      } catch (_) {
        return [];
      }
    }
    function writePending(rows) {
      try {
        getStorage().setItem(PENDING_KEY, JSON.stringify(rows.slice(-MAX_PENDING)));
      } catch (_) {}
    }
    function loadScript(url) {
      return new Promise((resolve, reject) => {
        try {
          const doc = host && host.document;
          if (!doc || typeof doc.createElement !== 'function')
            return reject(new Error('No se puede cargar el CDN sin documento'));
          const script = doc.createElement('script');
          const timer = setTimeout(
            () => reject(new Error('Tiempo agotado al cargar Supabase')),
            8000,
          );
          script.onload = () => {
            clearTimeout(timer);
            resolve();
          };
          script.onerror = () => {
            clearTimeout(timer);
            reject(new Error('No se pudo cargar Supabase desde el CDN'));
          };
          script.src = url;
          (doc.body || doc.head || doc).appendChild(script);
        } catch (error) {
          reject(error);
        }
      });
    }
    async function createClient() {
      if (clientFactory) return clientFactory(config.url, config.anonKey);
      if (host && host.supabase && typeof host.supabase.createClient === 'function')
        return host.supabase.createClient(config.url, config.anonKey);
      await loadScript(CDN_URL);
      if (!host.supabase || typeof host.supabase.createClient !== 'function')
        throw new Error('La librería de Supabase no dejó el cliente global');
      return host.supabase.createClient(config.url, config.anonKey);
    }
    function setUser(next) {
      user = next || null;
      for (const cb of authCallbacks) {
        try {
          cb(user);
        } catch (_) {}
      }
    }
    async function init() {
      if (initPromise) return initPromise;
      initPromise = (async () => {
        if (!configured(config)) return { ok: false, reason: 'not-configured' };
        if (client) return { ok: true, user };
        try {
          client = await createClient();
          if (client.auth && typeof client.auth.onAuthStateChange === 'function')
            client.auth.onAuthStateChange((_event, session) => {
              setUser(session ? session.user : null);
            });
          if (client.auth && typeof client.auth.getSession === 'function') {
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            setUser(data && data.session ? data.session.user : null);
          }
          return { ok: true, user };
        } catch (error) {
          client = null;
          logWarning('Supabase no disponible: ' + (error && error.message));
          return { ok: false, reason: 'offline', error: String(error && error.message) };
        }
      })();
      return initPromise;
    }
    function validScore(record) {
      return (
        record &&
        Number.isInteger(record.mission) &&
        record.mission >= 1 &&
        record.mission <= 3 &&
        Number.isFinite(record.score) &&
        record.score >= 0 &&
        Number.isInteger(record.stars || 1)
      );
    }
    function queuePending(record) {
      const rows = readPending();
      rows.push({
        mission: record.mission,
        score: record.score,
        stars: record.stars || 1,
        survivors: record.survivors || 0,
        created_at: new Date().toISOString(),
      });
      writePending(rows);
      return rows.length;
    }
    async function saveScore(record) {
      if (!validScore(record)) return { ok: false, reason: 'invalid-score' };
      if (!configured(config)) {
        queuePending(record);
        return { ok: false, reason: 'not-configured', queued: true };
      }
      await init();
      if (!client || !user) {
        queuePending(record);
        return { ok: false, reason: user ? 'offline' : 'guest', queued: true };
      }
      try {
        const { error } = await client
          .from('scores')
          .insert({
            user_id: user.id,
            mission: record.mission,
            score: record.score,
            stars: record.stars || 1,
            survivors: record.survivors || 0,
          });
        if (error) throw error;
        return { ok: true };
      } catch (error) {
        queuePending(record);
        return { ok: false, reason: 'offline', queued: true, error: String(error && error.message) };
      }
    }
    async function flushPendingScores() {
      const pending = readPending();
      if (!pending.length) return { ok: true, sent: 0 };
      if (!configured(config)) return { ok: false, reason: 'not-configured', sent: 0 };
      await init();
      if (!client || !user) return { ok: false, reason: 'guest', sent: 0 };
      try {
        const rows = pending.map((r) => ({
          user_id: user.id,
          mission: r.mission,
          score: r.score,
          stars: r.stars || 1,
          survivors: r.survivors || 0,
        }));
        const { error } = await client.from('scores').insert(rows);
        if (error) throw error;
        writePending([]);
        return { ok: true, sent: rows.length };
      } catch (error) {
        return { ok: false, reason: 'offline', sent: 0, error: String(error && error.message) };
      }
    }
    async function fetchTopScores(mission, limit = 5) {
      if (!configured(config)) return { ok: false, reason: 'not-configured', rows: [] };
      await init();
      if (!client) return { ok: false, reason: 'offline', rows: [] };
      try {
        let query = client
          .from('scores')
          .select('score, stars, survivors, created_at, profiles(display_name)');
        if (mission) query = query.eq('mission', mission);
        const { data, error } = await query
          .order('score', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return { ok: true, rows: (data || []).map(normalizeScoreRow) };
      } catch (_) {
        try {
          let query = client.from('scores').select('score, stars, survivors, created_at');
          if (mission) query = query.eq('mission', mission);
          const { data, error } = await query
            .order('score', { ascending: false })
            .limit(limit);
          if (error) throw error;
          return { ok: true, rows: (data || []).map(normalizeScoreRow) };
        } catch (error) {
          return { ok: false, reason: 'offline', rows: [], error: String(error && error.message) };
        }
      }
    }
    function normalizeScoreRow(row) {
      return {
        score: row.score,
        stars: row.stars,
        survivors: row.survivors,
        created_at: row.created_at,
        display_name:
          (row.profiles && row.profiles.display_name) || row.display_name || null,
      };
    }
    async function fetchMyScores(limit = 10) {
      if (!configured(config)) return { ok: false, reason: 'not-configured', rows: [] };
      await init();
      if (!client || !user) return { ok: false, reason: 'guest', rows: [] };
      try {
        const { data, error } = await client
          .from('scores')
          .select('mission, score, stars, survivors, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return { ok: true, rows: data || [] };
      } catch (error) {
        return { ok: false, reason: 'offline', rows: [], error: String(error && error.message) };
      }
    }
    async function flushLogs(entries) {
      if (!entries || !entries.length) return { ok: true, sent: 0 };
      if (!configured(config)) return { ok: false, reason: 'not-configured', sent: 0 };
      await init();
      if (!client) return { ok: false, reason: 'offline', sent: 0 };
      let sent = 0;
      try {
        for (let i = 0; i < entries.length; i += LOG_BATCH) {
          const batch = entries.slice(i, i + LOG_BATCH).map((e) => ({
            user_id: user ? user.id : null,
            message: e.message,
            stack: e.stack || null,
            version: e.version || null,
            mission: e.mission,
            phase: e.phase || null,
            seed: e.seed,
            fps_ms: e.ms,
            device: e.device || null,
          }));
          const { error } = await client.from('error_logs').insert(batch);
          if (error) throw error;
          sent += batch.length;
        }
        return { ok: true, sent };
      } catch (error) {
        return { ok: false, reason: 'offline', sent, error: String(error && error.message) };
      }
    }
    async function signUp(email, displayName, password) {
      if (!configured(config)) return { ok: false, reason: 'not-configured' };
      await init();
      if (!client) return { ok: false, reason: 'offline' };
      try {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || '' } },
        });
        if (error) throw error;
        if (data && data.session && data.session.user) {
          setUser(data.session.user);
          try {
            await client.from('profiles').upsert({
              id: data.session.user.id,
              display_name: displayName || '',
            });
          } catch (_) {}
          return { ok: true, user: data.session.user };
        }
        return { ok: true, needsConfirmation: true };
      } catch (error) {
        return { ok: false, reason: 'auth', error: String(error && error.message) };
      }
    }
    async function signIn(email, password) {
      if (!configured(config)) return { ok: false, reason: 'not-configured' };
      await init();
      if (!client) return { ok: false, reason: 'offline' };
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data && data.session) setUser(data.session.user);
        return { ok: true, user: user };
      } catch (error) {
        return { ok: false, reason: 'auth', error: String(error && error.message) };
      }
    }
    async function signOut() {
      if (client && client.auth) {
        try {
          await client.auth.signOut();
        } catch (_) {}
      }
      setUser(null);
      return { ok: true };
    }
    return {
      CDN_URL,
      PENDING_KEY,
      configured: () => configured(config),
      init,
      getUser: () => user,
      onAuthChange(cb) {
        if (typeof cb === 'function') authCallbacks.push(cb);
      },
      signUp,
      signIn,
      signOut,
      saveScore,
      flushPendingScores,
      fetchTopScores,
      fetchMyScores,
      flushLogs,
      pendingCount: () => readPending().length,
    };
  }
  return { create };
});
