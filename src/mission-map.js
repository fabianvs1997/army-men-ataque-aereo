/* Seeded mission geometry. Gameplay and terrain consume the same coordinates. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./escort-config.js'));
  else root.ToyMissionMap = factory(root.ToyEscortConfig);
})(globalThis, function (defaults) {
  'use strict';
  function generate(seed) {
    let value = seed >>> 0;
    const random = () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
    const jitter = (n) => (random() - 0.5) * n;
    const mirror = random() < 0.5 ? -1 : 1;
    const A = { x: 0, z: 0 };
    const B = { x: -175 + jitter(50), z: 155 + jitter(45) };
    const C = { x: 235 + jitter(35), z: 185 + jitter(65) };
    const routeAB = [
      [0, 0],
      [-15 + jitter(20), 45],
      [-90 + jitter(25), 10],
      [-170 + jitter(25), -70 + jitter(40)],
      [-240 + jitter(25), 15],
      [-245 + jitter(20), 100],
      [B.x, B.z],
    ];
    const routeBC = Array.from({ length: 15 }, (_, i) => {
      const t = i / 14;
      return [
        B.x + (C.x - B.x) * t,
        B.z +
          (C.z - B.z) * t +
          (i === 0 || i === 14
            ? 0
            : Math.sin(t * Math.PI * 2) * 23 + jitter(12)),
      ];
    });
    const enemies = defaults.enemies.map((e) => ({ ...e }));
    Object.assign(enemies[0], { x: routeAB[3][0], z: routeAB[3][1] });
    Object.assign(enemies[1], { x: routeAB[5][0], z: routeAB[5][1] });
    for (const e of enemies.filter((e) => e.zone === 'B')) {
      e.x = B.x + e.x - defaults.B.x;
      e.z = B.z + e.z - defaults.B.z;
    }
    for (const [i, e] of enemies.filter((e) => e.zone === 'BC').entries()) {
      const p = routeBC[i === 0 ? 5 : 10];
      e.x = p[0];
      e.z = p[1] + 3;
    }
    for (const [zone, route] of [
      ['AB', routeAB],
      ['BC', routeBC],
    ]) {
      defaults.routePatrols[zone].forEach((patrol, i) => {
        const segment = Math.floor(patrol.at),
          t = patrol.at - segment;
        const a = route[segment],
          b = route[segment + 1];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const side = i % 2 ? 9 : -9;
        enemies.push({
          id: `patrol-${zone.toLowerCase()}-${i}`,
          zone,
          k: patrol.k,
          hp: patrol.hp,
          x: a[0] + (b[0] - a[0]) * t - ((b[1] - a[1]) / length) * side,
          z: a[1] + (b[1] - a[1]) * t + ((b[0] - a[0]) / length) * side,
        });
      });
    }
    const extraAir = defaults.extraAir.map((e, i) => ({
      ...e,
      x: routeBC[7 + i * 4][0],
      z: routeBC[7 + i * 4][1] - 3,
    }));
    // Mirror the entire layout, including troops, so the mission stays coherent.
    B.x *= mirror;
    C.x *= mirror;
    for (const p of [...routeAB, ...routeBC]) p[0] *= mirror;
    for (const e of [...enemies, ...extraAir]) e.x *= mirror;
    const rules = { ...defaults, A, B, C, routeBC, enemies, extraAir };
    return {
      seed: seed >>> 0,
      limit: 320,
      rules,
      layout: {
        start: A,
        finish: C,
        camps: [[B.x, B.z]],
        route: routeAB.concat(routeBC.slice(1)),
      },
      routes: [routeAB, routeBC],
    };
  }
  return { generate };
});
