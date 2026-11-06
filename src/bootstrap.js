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
  const VERSION = 'supabase-logs-1';
  const scripts = Object.freeze([
    'escort-config',
    'toy-missions',
    'mission-map',
    'escort-navigation',
    'escort-mission',
    'escort-progress',
    'toy-world',
    'toy-helicopter',
    'toy-renderer',
    'collision',
    'prefs',
    'audio',
    'input',
    'debris',
    'combat',
    'render2d',
    'ui',
    'perf',
    'logger',
    'supabase-config',
    'supabase',
    'game',
  ]);
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
        script.onerror = () => reject(new Error('Could not load ' + name));
        script.src = asset('src/' + name + '.js');
        document.body.appendChild(script);
      });
    }
    return host.ToyGame.create();
  }
  return { VERSION, scripts, asset, start };
});
