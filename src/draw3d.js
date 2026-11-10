/* Dibujo 3D (solo WebGL, sin respaldo Canvas 2D).

Si WebGL renderiza, se muestra el canvas `world3d` y se oculta el
mensaje de WebGL requerido. Si WebGL no inicia o se pierde, NO se
dibuja nada en 2D: se muestra `#webglRequired`, un mensaje claro de
que el juego necesita WebGL 3D. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyDraw3D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create(scene) {
    function draw(nextScene) {
      if (nextScene) scene = nextScene;
      scene.HY =
        (scene.cameraCenterY ??
          scene.H * 0.64 + 8 * Math.cos(scene.PITCH) * scene.F) +
        (scene.shk > 0 && typeof scene.R === 'function' ? scene.R(-2, 2) : 0);
      const message = scene.$ ? scene.$('webglRequired') : null;
      // En el menú principal se dibuja el diorama de portada por
      // separado (sin mundo de campaña detrás); en cualquier otro
      // estado sigue el render de campaña de siempre.
      let reducedMotion = false;
      try {
        reducedMotion = !!scene.host?.matchMedia?.(
          '(prefers-reduced-motion: reduce)',
        ).matches;
      } catch (_) {}
      const useDiorama =
        scene.st === 'menu' &&
        scene.diorama &&
        scene.renderer3d &&
        typeof scene.renderer3d.renderDiorama === 'function';
      if (
        scene.renderer3d &&
        (useDiorama
          ? scene.renderer3d.renderDiorama({
              pixelRatio: scene.lowQuality ? 1 : scene.pixelRatioCap || 1.75,
              perfLevel: scene.perfLevel || 0,
              W: scene.W,
              H: scene.H,
              t: scene.t,
              diorama: scene.diorama,
              dioramaCam: scene.dioramaCam,
              swayYaw: scene.swayYaw,
              reducedMotion,
            })
          : scene.renderer3d.render({
          pixelRatio: scene.lowQuality ? 1 : scene.pixelRatioCap || 1.75,
          perfLevel: scene.perfLevel || 0,
          W: scene.W,
          H: scene.H,
          F: scene.F,
          HY: scene.HY,
          cam: scene.cam,
          PITCH: scene.PITCH,
          P: scene.P,
          E: scene.E,
          DC: scene.DC,
          BL: scene.BL,
          EB: scene.EB,
          MS: scene.MS,
          FX: scene.FX,
          SM: scene.SM,
          DB: scene.DB,
          PK: scene.PK,
          rot: scene.rot,
          t: scene.t,
          allies: scene.mission
            ? (scene.mission.guards || []).concat(scene.mission.allies)
            : [],
          // Winch de la carga: el renderizador dibuja el cable y la
          // carga colgando desde esta vista (null sin carga); la
          // batería de la Misión 3 va con `kind: 'battery'`.
          cargo:
            scene.mission && typeof scene.mission.cargoView === 'function'
              ? scene.mission.cargoView()
              : null,
          // Tren Prego (Misión 3): el renderizador lo dibuja sobre la
          // vía desde esta vista (null sin tren).
          train:
            scene.mission && typeof scene.mission.trainView === 'function'
              ? scene.mission.trainView()
              : null,
        }))
      ) {
        scene.$('world3d').style.display = 'block';
        if (message) message.style.display = 'none';
        return true;
      }
      scene.$('world3d').style.display = 'none';
      if (message) message.style.display = 'flex';
      return false;
    }
    return { draw };
  }
  return { create };
});
