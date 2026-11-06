/* Compatibilidad: los mapas de las misiones son fijos y viven en
 * src/original-maps.js (recrean los escenarios del Army Men: Air
 * Attack original). Esta fachada conserva la API anterior (generate
 * con semilla) para el juego y las pruebas antiguas; la semilla se
 * ignora a propósito: cada misión tiene un solo mapa, siempre el
 * mismo. `generate(seed, mission)` devuelve el mapa fijo de la
 * misión pedida. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./original-maps.js'));
  else root.ToyMissionMap = factory(root.ToyOriginalMaps);
})(globalThis, function (OriginalMaps) {
  'use strict';
  function generate(seed, mission = 1) {
    return OriginalMaps.generate(mission);
  }
  return {
    generate,
    generateCampaign: OriginalMaps.generateCampaign,
    validate: OriginalMaps.validate,
  };
});
