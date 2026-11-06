/* Proyección de cámara ortográfica oblicua (solo 3D).

Extraída del antiguo renderizador Canvas 2D: la proyección no dibuja
nada, solo convierte coordenadas del mundo a pantalla, y la siguen
usando el juego (env.P3, para la brújula del HUD) y las pruebas.
No hay dibujo 2D aquí: el único renderizador es WebGL. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyProjection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create(scene) {
    function cs(x, y, z) {
      const dx = x - scene.cam.x,
        dz = z - scene.cam.z,
        s = Math.sin(scene.cam.yaw),
        c = Math.cos(scene.cam.yaw),
        forward = dx * s + dz * c;
      return [
        -dx * c + dz * s,
        y * Math.cos(scene.PITCH) + forward * Math.sin(scene.PITCH),
        300 + forward * Math.cos(scene.PITCH) - y * Math.sin(scene.PITCH),
      ];
    }
    function pj(a) {
      return [
        scene.W / 2 + a[0] * scene.F,
        scene.HY - a[1] * scene.F,
        scene.F,
        a[2],
      ];
    }
    function headingAngle(yaw) {
      const dx = Math.sin(yaw),
        dz = Math.cos(yaw),
        right = -dx * Math.cos(scene.cam.yaw) + dz * Math.sin(scene.cam.yaw),
        down =
          -(dx * Math.sin(scene.cam.yaw) + dz * Math.cos(scene.cam.yaw)) *
          Math.sin(scene.PITCH);
      return Math.atan2(-right, down);
    }
    function P3(x, y, z) {
      const a = cs(x, y, z);
      return a[2] < 1 ? null : pj(a);
    }
    function clip(a, b) {
      if (a[2] < 1 && b[2] < 1) return null;
      if (a[2] < 1) {
        const t = (1 - a[2]) / (b[2] - a[2]);
        a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 1];
      } else if (b[2] < 1) {
        const t = (1 - b[2]) / (a[2] - b[2]);
        b = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - a[1]) * t, 1];
      }
      return [a, b];
    }
    return { cs, pj, headingAngle, P3, clip };
  }
  return { create };
});
