(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyLogger = api;
})(globalThis, function () {
  'use strict';
  // Registro de errores en el propio dispositivo: captura errores de
  // consola, rechazos no controlados y congelamientos largos, con el
  // contexto de la partida (versión, misión, fase, semilla, rendimiento).
  // No guarda datos personales. Todo va a localStorage con rotación
  // (últimas 100 entradas) y nunca rompe el juego si el almacenamiento
  // falla: en ese caso conserva las entradas solo en memoria.
  const STORAGE_KEY = 'toy-logs-v1';
  const MAX_ENTRIES = 100;
  const FREEZE_MS = 500;
  const FREEZE_COOLDOWN_MS = 5000;
  function truncate(value, limit) {
    const text = value == null ? '' : String(value);
    return text.length > limit ? text.slice(0, limit) + '…' : text;
  }
  function create(options = {}) {
    const getStorage =
      options.getStorage ||
      (() => {
        throw new Error('no storage');
      });
    const version = options.version || 'dev';
    const device = truncate(options.device || '', 160);
    let getContext =
      options.getContext ||
      (() => ({
        mission: null,
        phase: '',
        seed: null,
        fps: null,
        ms: null,
        level: 0,
      }));
    let entries = [];
    let installed = false;
    let lastFreezeNote = -Infinity;
    function readStored() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (!raw) return [];
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      } catch (_) {
        return [];
      }
    }
    function persist() {
      try {
        getStorage().setItem(STORAGE_KEY, JSON.stringify(entries));
      } catch (_) {
        // Sin almacenamiento: las entradas siguen en memoria.
      }
    }
    entries = readStored().slice(-MAX_ENTRIES);
    function record(type, message, stack) {
      const context = (() => {
        try {
          return getContext() || {};
        } catch (_) {
          return {};
        }
      })();
      const entry = {
        ts: new Date().toISOString(),
        type,
        message: truncate(message, 500),
        stack: truncate(stack || '', 2000),
        version,
        mission:
          context.mission == null ? null : Number(context.mission) || null,
        phase: truncate(context.phase || '', 60),
        seed: context.seed == null ? null : context.seed,
        fps: context.fps == null ? null : context.fps,
        ms: context.ms == null ? null : context.ms,
        level: context.level == null ? 0 : context.level,
        device,
      };
      entries.push(entry);
      if (entries.length > MAX_ENTRIES)
        entries = entries.slice(entries.length - MAX_ENTRIES);
      persist();
      return entry;
    }
    function error(value) {
      if (value instanceof Error)
        return record('error', value.message, value.stack);
      return record('error', value);
    }
    // Un frame que tarda más de FREEZE_MS es un congelamiento: se anota
    // como mucho una vez cada 5 s para no inundar el registro.
    function noteFrame(frameMs, nowMs) {
      if (!(frameMs > FREEZE_MS)) return null;
      const now = nowMs == null ? Date.now() : nowMs;
      if (now - lastFreezeNote < FREEZE_COOLDOWN_MS) return null;
      lastFreezeNote = now;
      return record(
        'freeze',
        'Frame de ' + Math.round(frameMs) + ' ms durante la partida',
      );
    }
    function list() {
      return entries.slice();
    }
    function clear() {
      entries = [];
      persist();
    }
    function exportText() {
      return JSON.stringify(entries, null, 2);
    }
    function install(host, consoleObj) {
      if (installed || !host) return false;
      installed = true;
      try {
        if (typeof host.addEventListener === 'function') {
          host.addEventListener('error', (event) => {
            error(
              (event && event.error) ||
                (event && event.message) ||
                'Error desconocido',
            );
          });
          host.addEventListener('unhandledrejection', (event) => {
            const reason =
              event && event.reason != null ? event.reason : 'Rechazo sin motivo';
            if (reason instanceof Error) error(reason);
            else record('rejection', reason);
          });
        } else {
          if (typeof host.onerror !== 'undefined' || !host.onerror)
            host.onerror = (message, _source, _line, _col, err) => {
              error(err || message);
              return false;
            };
        }
      } catch (_) {}
      try {
        const target = consoleObj || (typeof console !== 'undefined' ? console : null);
        if (target && typeof target.error === 'function' && !target.error.__toyLogger) {
          const original = target.error;
          const wrapped = function (...args) {
            try {
              record(
                'console',
                args
                  .map((a) =>
                    a instanceof Error ? a.message : String(a),
                  )
                  .join(' '),
                args.find((a) => a instanceof Error)?.stack,
              );
            } catch (_) {}
            return original.apply(target, args);
          };
          wrapped.__toyLogger = true;
          target.error = wrapped;
        }
      } catch (_) {}
      return true;
    }
    return {
      STORAGE_KEY,
      MAX_ENTRIES,
      FREEZE_MS,
      record,
      error,
      noteFrame,
      list,
      clear,
      exportText,
      install,
      setContext(fn) {
        if (typeof fn === 'function') getContext = fn;
      },
      get count() {
        return entries.length;
      },
    };
  }
  return { create };
});
