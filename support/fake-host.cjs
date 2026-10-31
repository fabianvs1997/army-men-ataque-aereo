function fakeHost() {
  const elements = new Map(),
    listeners = new Map(),
    saved = new Map();
  const target = () => ({
    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    },
    listeners: {},
    emit(type, e = {}) {
      for (const fn of this.listeners[type] || []) fn(e);
    },
  });
  const element = (id) => {
    if (!elements.has(id))
      elements.set(
        id,
        Object.assign(target(), {
          style: {},
          textContent: '',
          getContext: (type) =>
            type === '2d'
              ? new Proxy(
                  { createLinearGradient: () => ({ addColorStop() {} }) },
                  { get: (o, k) => o[k] || (() => {}) },
                )
              : null,
          getBoundingClientRect: () => ({
            width: 390,
            height: 844,
            left: 0,
            top: 0,
          }),
          setPointerCapture() {},
          setAttribute() {},
          focus() {},
        }),
      );
    return elements.get(id);
  };
  const host = Object.assign(target(), {
    document: Object.assign(target(), {
      getElementById: element,
      hidden: false,
    }),
    navigator: {},
    devicePixelRatio: 1,
    performance: { now: () => 0 },
    requestAnimationFrame() {},
    setTimeout,
    localStorage: {
      getItem: (k) => saved.get(k),
      setItem: (k, v) => saved.set(k, v),
    },
  });
  return { host, element, saved };
}
function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function game(seed = 123) {
  const f = fakeHost(),
    app = require('../src/game.js').create(f.host, {
      random: seeded(seed),
      Renderer: null,
    });
  return { ...f, app, state: app.state };
}
module.exports = { fakeHost, seeded, game };
