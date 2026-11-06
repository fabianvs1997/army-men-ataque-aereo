(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToySupabaseConfig = api;
})(globalThis, function (root) {
  'use strict';
  // Configuración de Supabase para cuentas, puntuaciones y registro
  // remoto de errores. En este archivo NO hay ningún valor pegado:
  // la URL y la clave ANON llegan inyectadas en tiempo de ejecución
  // en `root.__SUPABASE_CONFIG__` (ver docs/SUPABASE.md).
  //
  // Cómo llega la configuración:
  // - En producción (GitHub Pages), el workflow `.github/workflows/
  //   deploy-pages.yml` genera `src/supabase-env.js` a partir de los
  //   secretos de GitHub SUPABASE_URL y SUPABASE_ANON_KEY, y ese archivo
  //   generado (gitignorado, nunca en el repo) define
  //   `__SUPABASE_CONFIG__` antes de cargar este módulo.
  // - En local, `node scripts/generate-supabase-config.cjs` genera ese
  //   mismo archivo a partir de variables de entorno o de un `.env`
  //   (también gitignorado).
  // - Sin inyección, los dos campos quedan vacíos y el juego funciona
  //   100 % sin servidor: se juega como invitado y las puntuaciones y
  //   los errores se guardan solo en este dispositivo, como hasta ahora.
  //
  // La clave ANON es pública por diseño: con Row Level Security activado
  // solo permite lo que permiten las políticas (cada usuario guarda lo
  // suyo; el ranking es de lectura pública). NUNCA va aquí la clave
  // secreta (service_role): esa clave salta todas las reglas y no debe
  // estar nunca en el juego ni en el repositorio. El generador la
  // rechaza si alguien intenta inyectarla.
  function readInjected() {
    const injected = root && root.__SUPABASE_CONFIG__;
    if (!injected || typeof injected !== 'object')
      return { url: '', anonKey: '' };
    return {
      url: typeof injected.url === 'string' ? injected.url : '',
      anonKey: typeof injected.anonKey === 'string' ? injected.anonKey : '',
    };
  }
  function isConfigured() {
    const config = readInjected();
    return (
      typeof config.url === 'string' &&
      config.url.indexOf('https://') === 0 &&
      config.url.indexOf('.supabase.co') > 0 &&
      typeof config.anonKey === 'string' &&
      config.anonKey.length > 20
    );
  }
  return {
    get url() {
      return readInjected().url;
    },
    get anonKey() {
      return readInjected().anonKey;
    },
    // 'injected' cuando la configuración llegó por variables de entorno,
    // 'none' cuando el juego va como invitado sin servidor.
    get source() {
      return isConfigured() ? 'injected' : 'none';
    },
    isConfigured,
  };
});
