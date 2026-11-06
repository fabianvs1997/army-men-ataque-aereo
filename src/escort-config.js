(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyEscortConfig = api;
})(globalThis, function () {
  'use strict';
  return Object.freeze({
    A: { x: 0, z: 0 },
    B: { x: -90, z: 100 },
    C: { x: 155, z: 125 },
    safeRadius: 90,
    perimeter: 28,
    arrivalB: 40,
    deliveryRadius: 9,
    pickupRadius: 6,
    capacity: 4,
    wounded: 3,
    healthy: 4,
    guards: 4,
    pickupSeconds: 1.5,
    deliverySeconds: 2,
    soldierSpeed: 7,
    soldierRadius: 0.65,
    soldierHP: 18,
    guardHP: 30,
    allyRange: 36,
    allyCooldown: 2.5,
    bulletSpeed: 65,
    stuckSeconds: 25,
    separation: 2.2,
    combatPause: 1.5,
    progressKey: 'toy-escort-progress',
    progressVersion: 1,
    routeBC: [
      [-90, 100],
      [-60, 108],
      [-30, 118],
      [0, 125],
      [30, 122],
      [60, 115],
      [90, 110],
      [120, 117],
      [155, 125],
    ],
  });
});
