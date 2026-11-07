/* Brújula del HUD, como la del Army Men: Air Attack original.

Módulo puro, sin DOM: convierte el rumbo del helicóptero y la
dirección del objetivo en una tira de 8 puntos cardinales (N, NE, E,
SE, S, SW, W, NW) que se desplaza con el rumbo, con el rumbo actual
resaltado en el centro y una marca morada para el objetivo.

Convenio de rumbo (el mismo que el `yaw` del jugador): rumbo 0° = N,
90° = E, 180° = S, 270° = W. El avance del helicóptero es
(sin(yaw), cos(yaw)) en (x, z), así que el rumbo en grados es
directamente `yaw` en grados.

El objetivo NO está hardcodeado aquí: quien llama pasa el rumbo
hacia el objetivo que le da el estado de la misión
(`mission.target(jugador)`), así que cuando las misiones cambien de
objetivo (caja de plástico y portal en la Misión 1, garajes y coches
en la 2, tren y batería en la 3), la marca de la brújula seguirá
apuntando al objetivo vigente sin tocar este módulo. Lo mismo vale
para el texto de objetivo del HUD: viene de
`mission.config.name` + `mission.message` y del resumen
`mission.hudSummary()` (ver src/escort-mission.js), no de este
archivo. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyCompass = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
    // Media ventana visible de la tira: a ±90° del rumbo los puntos
    // salen por los extremos; el centro (0°) es el rumbo actual.
    HALF_WINDOW = 90;
  function wrapDeg(deg) {
    let d = deg % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
  }
  // Rumbo en grados (0 = N, 90 = E) a partir del yaw del jugador.
  function headingDeg(yaw) {
    return wrapDeg((yaw * 180) / Math.PI);
  }
  function headingLabel(yaw) {
    const deg = ((headingDeg(yaw) % 360) + 360) % 360;
    return LABELS[Math.round(deg / 45) % 8];
  }
  // Rumbo hacia un punto del mundo desde otro, en grados (0 = N).
  function bearingDeg(fromX, fromZ, toX, toZ) {
    return wrapDeg(
      (Math.atan2(toX - fromX, toZ - fromZ) * 180) / Math.PI,
    );
  }
  // Tira de brújula para un rumbo y un rumbo de objetivo (ambos en
  // grados, 0 = N). Cada punto trae su posición en la tira (0–100 %,
  // 50 % = centro) y si está visible; la marca del objetivo, igual.
  function strip(heading, targetBearing) {
    const labels = LABELS.map((label, i) => {
      const offset = wrapDeg(i * 45 - heading);
      return {
        label,
        deg: i * 45,
        offset,
        at: 50 + (offset / HALF_WINDOW) * 50,
        visible: Math.abs(offset) <= HALF_WINDOW,
        current: label === headingLabel((heading * Math.PI) / 180),
      };
    });
    const targetOffset =
      typeof targetBearing === 'number'
        ? wrapDeg(targetBearing - heading)
        : null;
    return {
      heading: headingLabel((heading * Math.PI) / 180),
      labels,
      target: {
        offset: targetOffset,
        at:
          targetOffset === null
            ? null
            : 50 + (targetOffset / HALF_WINDOW) * 50,
        visible:
          targetOffset !== null && Math.abs(targetOffset) <= HALF_WINDOW,
      },
    };
  }
  return { LABELS, HALF_WINDOW, wrapDeg, headingDeg, headingLabel, bearingDeg, strip };
});
