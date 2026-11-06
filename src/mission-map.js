/* Compatibilidad: la generación de mapas vive en src/mapgen.js.
 * Esta fachada conserva la API anterior (generate con semilla) para
 * el juego y las pruebas antiguas; la semilla sola genera la misión
 * 1 y `generate(seed, mission)` la misión pedida. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./mapgen.js'));
  else root.ToyMissionMap = factory(root.ToyMapGen);
})(globalThis, function (MapGen) {
  'use strict';
  function generate(seed, mission = 1) {
    return MapGen.generate(mission, seed);
  }
  return {
    generate,
    generateCampaign: MapGen.generateCampaign,
    validate: MapGen.validate,
    seedForMission: MapGen.seedForMission,
  };
});
