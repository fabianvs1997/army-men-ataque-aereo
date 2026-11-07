(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else
    factory()
      .start(root)
      .catch(function (error) {
        console.error(error);
        var message = root.document.createElement('p');
        message.textContent = 'No se pudo cargar el juego. Recarga la página.';
        root.document.body.prepend(message);
      });
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Update only here when publishing changed assets.
  const VERSION = 'alpino-m1-1';
  const scripts = Object.freeze([
    'escort-config',
    'toy-missions',
    'original-maps',
    'mission-map',
    'escort-navigation',
    'escort-mission',
    'escort-progress',
    'toy-world',
    'toy-helicopter',
    'toy-renderer',
    'projection',
    'draw3d',
    'collision',
    'prefs',
    'audio',
    'input',
    'debris',
    'combat',
    'ui',
    'perf',
    'logger',
    'supabase-env',
    'supabase-config',
    'supabase',
    'game',
  ]);
  // Scripts opcionales: si faltan, el juego sigue sin ellos. `supabase-env`
  // es el archivo generado en el despliegue (o en local con
  // `scripts/generate-supabase-config.cjs`) que inyecta la configuración
  // de Supabase en `globalThis.__SUPABASE_CONFIG__`; sin él, el juego
  // va como invitado. Sin esta tolerancia, un despliegue sin secretos
  // (o abrir el juego desde la rama sin generar el archivo) rompería
  // la carga con un 404.
  const optionalScripts = Object.freeze(['supabase-env']);
  function asset(path) {
    return path + '?v=' + encodeURIComponent(VERSION);
  }
  async function start(host) {
    // El registro de errores etiqueta cada entrada con esta versión.
    host.ToyVersion = VERSION;
    const document = host.document;
    await new Promise((resolve, reject) => {
      const style = document.querySelector('link[rel="stylesheet"]');
      style.onload = resolve;
      style.onerror = () => reject(new Error('Could not load styles.css'));
      style.href = asset('styles.css');
    });
    for (const name of scripts) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.onload = resolve;
        script.onerror = () => {
          if (optionalScripts.includes(name)) resolve();
          else reject(new Error('Could not load ' + name));
        };
        script.src = asset('src/' + name + '.js');
        document.body.appendChild(script);
      });
    }
    return host.ToyGame.create();
  }
  return { VERSION, scripts, optionalScripts, asset, start };
});
