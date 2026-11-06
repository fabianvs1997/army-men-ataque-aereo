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
    soldierHalfHeight: 0.9, // feet clear low plastic chips; larger wreckage remains solid
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
    enemies: [
      { id: 'route-tank', k: 'tank', x: -100, z: -8, zone: 'AB', hp: 8 },
      { id: 'route-infantry', k: 'inf', x: -153, z: 32, zone: 'AB', hp: 3 },
      { id: 'b-west', k: 'tank', x: -109, z: 100, zone: 'B', hp: 16 },
      { id: 'b-north', k: 'tur', x: -87, z: 119, zone: 'B', hp: 16 },
      { id: 'b-east', k: 'inf', x: -72, z: 100, zone: 'B', hp: 10 },
      { id: 'b-air', k: 'heli', x: -104, z: 89, zone: 'B', hp: 8 },
      { id: 'escort-turret', k: 'tur', x: 35, z: 120, zone: 'BC', hp: 8 },
      { id: 'escort-infantry', k: 'inf', x: 85, z: 112, zone: 'BC', hp: 4 },
    ],
    extraAir: [
      { id: 'escort-air-2', k: 'heli', x: 65, z: 115, zone: 'BC', hp: 6 },
      { id: 'escort-air-3', k: 'heli', x: 120, z: 117, zone: 'BC', hp: 6 },
    ],
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
