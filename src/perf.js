(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyPerf = api;
})(globalThis, function () {
  'use strict';
  // Válvula de seguridad de rendimiento: si los frames se alargan de
  // forma sostenida, el juego baja solo de detalle en pasos (resolución
  // y cadencia de dibujo, luego también humo dibujado) en vez de
  // quedarse congelado. Si vuelve a ir fluido, sube de nivel con
  // histéresis para no oscilar. No toca la simulación ni la jugabilidad.
  // Niveles: 0 detalle completo, 1 resolución 1.25, 2 resolución 1 +
  // dibujo a 30 fps + la mitad de humo dibujado.
  const CAPS = [1.75, 1.25, 1];
  function create() {
    const state = {
      level: 0,
      ema: 16,
      worst: 0,
      frames: 0,
      slowFrames: 0,
      fastFrames: 0,
    };
    function update(frameMs) {
      state.frames++;
      state.ema = state.ema * 0.95 + frameMs * 0.05;
      if (frameMs > state.worst) state.worst = frameMs;
      if (state.ema > 30) {
        state.slowFrames++;
        state.fastFrames = 0;
      } else if (state.ema < 17) {
        state.fastFrames++;
        state.slowFrames = 0;
      } else {
        state.slowFrames = 0;
        state.fastFrames = 0;
      }
      if (state.slowFrames >= 90 && state.level < 2) {
        state.level++;
        state.slowFrames = 0;
        state.fastFrames = 0;
      }
      if (state.fastFrames >= 600 && state.level > 0) {
        state.level--;
        state.fastFrames = 0;
        state.slowFrames = 0;
      }
      return state.level;
    }
    return {
      get level() {
        return state.level;
      },
      get ema() {
        return state.ema;
      },
      get worst() {
        return state.worst;
      },
      get frames() {
        return state.frames;
      },
      get pixelRatioCap() {
        return CAPS[state.level];
      },
      get drawThrottleMs() {
        return state.level >= 2 ? 1000 / 30 : 0;
      },
      get skipStride() {
        return state.level >= 2 ? 2 : 1;
      },
      update,
    };
  }
  return { create };
});
