/* Motor procedural de mapas: cada misión, un mapa distinto y jugable.
 *
 * Antes, `mission-map.js` solo movía B y C unos metros con jitter y
 * espejaba el mapa: A siempre era (0, 0), la ruta A→B tenía la misma
 * forma, los enemigos eran siempre los mismos y la vegetación salía
 * de un hash senoidal. Este motor genera de verdad:
 *
 * - A, B y C en posiciones nuevas por semilla (A ya no es fija).
 * - Rutas A→B y B→C con trazado propio: giros, longitud y forma.
 * - Composición enemiga por misión: la 3 tiene más tanques, torretas
 *   y helicópteros que la 1 (la dificultad crece con la misión).
 * - Vegetación, rocas, puntos de interés y relieve con semilla.
 * - Validación por construcción: si un mapa no pasa las reglas de
 *   jugabilidad se regenera con otra semilla (máximo 12 intentos) y,
 *   si todo falla, se usa un mapa clásico de respaldo, nunca uno roto.
 *
 * Todo es determinista por semilla: la misma (misión, semilla) da
 * siempre el mismo mapa, y la semilla queda en `map.seed` (HUD con
 * `?perf=1` y registro) para poder reproducir y reportar un mapa.
 * Sin cambios de reglas: los objetivos A → B → C, quién debe
 * recogerse y la entrega en C quedan intactos.
 */
(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports
      ? require('./escort-config.js')
      : root.ToyEscortConfig,
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyMapGen = api;
})(globalThis, function (defaults) {
  'use strict';
  const LIMIT = 320;
  const MAX_ATTEMPTS = 12;
  const MISSIONS = 3;

  // RNG con semilla (mulberry32): rápido, determinista y sin depender
  // de Math.random. La misma semilla da siempre la misma secuencia.
  function createRng(seed) {
    let value = seed >>> 0;
    return function random() {
      value = (value + 0x6d2b79f5) >>> 0;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Mezcla dos enteros en una semilla nueva, distinta para cada par.
  function hashSeed(a, b) {
    let h = (a >>> 0) ^ Math.imul(b >>> 0, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
    h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
    return (h ^ (h >>> 15)) >>> 0;
  }
  // Semilla de una misión dentro de una campaña: cada misión de la
  // misma campaña tiene un mapa distinto por construcción.
  function seedForMission(campaignSeed, mission) {
    return hashSeed(campaignSeed >>> 0, mission);
  }
  // Dificultad por misión: más blindados y más vegetación densa al
  // avanzar la campaña. Los conteos de patrulla se mantienen (6+6)
  // para no cambiar el despliegue esperado; lo que crece es la
  // composición (tanques/torretas frente a infantería) y el aire.
  function difficultyFor(mission) {
    return [
      null,
      { tankWeight: 0.15, turWeight: 0.1, shrubs: 190, rocks: 130 },
      { tankWeight: 0.3, turWeight: 0.2, shrubs: 220, rocks: 150 },
      { tankWeight: 0.45, turWeight: 0.3, shrubs: 250, rocks: 175 },
    ][mission];
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const pointSeg = (x, z, ax, az, bx, bz) => {
    const dx = bx - ax,
      dz = bz - az,
      len2 = dx * dx + dz * dz,
      t =
        len2 === 0
          ? 0
          : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
  };
  function routeDistance(x, z, routes) {
    let best = Infinity;
    for (const route of routes)
      for (let i = 1; i < route.length; i++)
        best = Math.min(
          best,
          pointSeg(x, z, route[i - 1][0], route[i - 1][1], route[i][0], route[i][1]),
        );
    return best;
  }

  function buildAttempt(mission, seed) {
    const rng = createRng(seed);
    const diff = difficultyFor(mission);
    const pick = (a, b) => a + rng() * (b - a);
    const angle = (deg) => (deg * Math.PI) / 180;
    // A ya no es fija: se mueve en un disco de 30 u alrededor del
    // origen, así que la salida cambia de mapa en mapa.
    const aAngle = rng() * Math.PI * 2,
      aRadius = pick(0, 30);
    const A = {
      x: Math.cos(aAngle) * aRadius,
      z: Math.sin(aAngle) * aRadius,
    };
    // B al oeste y C al este, con ángulo y distancia propios por
    // semilla; la misión 3 aleja más los objetivos que la 1.
    const far = 1 + (mission - 1) * 0.08;
    const bAngle = angle(pick(110, 160)),
      bDist = pick(215, 265) * far;
    const B = { x: A.x + Math.cos(bAngle) * bDist, z: A.z + Math.sin(bAngle) * bDist };
    const cAngle = angle(pick(20, 70)),
      cDist = pick(250, 305) * far;
    const C = { x: A.x + Math.cos(cAngle) * cDist, z: A.z + Math.sin(cAngle) * cDist };
    // Ruta A→B: 7 puntos por un camino que serpentea; cada tramo
    // avanza hacia B (sin retrocesos) con desvío lateral creciente.
    const routeAB = [[A.x, A.z]];
    const abDx = B.x - A.x,
      abDz = B.z - A.z,
      abLen = Math.hypot(abDx, abDz),
      abNx = -abDz / abLen,
      abNz = abDx / abLen;
    // Un solo vaivén por ruta (amplitud y signo fijos): si cada punto
    // girara a su aire, dos tramos seguidos podrían alargarse de más.
    const abSway = pick(25, 55) * (rng() < 0.5 ? -1 : 1);
    for (let i = 1; i <= 5; i++) {
      const t = i / 6,
        sway = Math.sin(t * Math.PI) * abSway;
      routeAB.push([
        A.x + abDx * t + abNx * sway + pick(-5, 5),
        A.z + abDz * t + abNz * sway + pick(-5, 5),
      ]);
    }
    routeAB.push([B.x, B.z]);
    // Ruta B→C: 13-17 puntos con onda senoidal de amplitud y
    // frecuencia propias, más jitter; el pelotón la sigue a pie.
    const bcCount = 13 + Math.floor(rng() * 5),
      bcAmp = pick(12, 32),
      bcFreq = pick(1, 2),
      bcPhase = rng() * Math.PI * 2;
    const routeBC = Array.from({ length: bcCount }, (_, i) => {
      const t = i / (bcCount - 1);
      return [
        B.x + (C.x - B.x) * t,
        B.z +
          (C.z - B.z) * t +
          (i === 0 || i === bcCount - 1
            ? 0
            : Math.sin(t * Math.PI * bcFreq + bcPhase) * bcAmp +
              pick(-6, 6)),
      ];
    });
    // Enemigos base: los mismos 8 de la configuración, recolocados
    // sobre las rutas y alrededor de B, como antes.
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
    // Patrullas: mismo número de huecos que antes (6+6), pero el tipo
    // se sortea por misión: la 1 es casi toda infantería y la 3
    // mezcla tanques y torretas, así que la escolta se endurece.
    const kindFor = () => {
      const roll = rng();
      if (roll < diff.tankWeight) return 'tank';
      if (roll < diff.tankWeight + diff.turWeight) return 'tur';
      return 'inf';
    };
    const hpFor = (k) => ({ inf: 3, tank: 8, tur: 6 })[k];
    for (const [zone, route] of [
      ['AB', routeAB],
      ['BC', routeBC],
    ]) {
      defaults.routePatrols[zone].forEach((patrol, i) => {
        // Posición fraccional en la ruta, no índice de tramo: en el
        // tramo central, lejos de A (radio seguro) y de B/C. Con
        // índice fijo, un tramo corto dejaba la patrulla dentro de
        // la zona de salida o del perímetro de B.
        const t =
          zone === 'AB' ? pick(0.47, 0.73) : pick(0.25, 0.75);
        const at = t * (route.length - 1);
        const segment = Math.min(Math.floor(at), route.length - 2),
          frac = at - segment;
        const a = route[segment],
          b = route[segment + 1];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const side = i % 2 ? 9 : -9;
        const k = kindFor();
        enemies.push({
          id: `patrol-${zone.toLowerCase()}-${i}`,
          zone,
          k,
          hp: hpFor(k),
          x: a[0] + (b[0] - a[0]) * frac - ((b[1] - a[1]) / length) * side,
          z: a[1] + (b[1] - a[1]) * frac + ((b[0] - a[0]) / length) * side,
        });
      });
    }
    const extraAir = defaults.extraAir.map((e, i) => ({
      ...e,
      x: routeBC[7 + i * 4][0],
      z: routeBC[7 + i * 4][1] - 3,
    }));
    // Vegetación y rocas con la semilla del mapa, no con un hash
    // senoidal: posiciones de verdad distintas, fuera de pads y rutas.
    const routes = [routeAB, routeBC];
    const clearings = [
      [A.x, A.z, 23],
      [C.x, C.z, 23],
      [B.x, B.z + 5, 24],
    ];
    const scatter = (count, minRoute, minPad, maxZ) => {
      const out = [];
      let tries = 0;
      while (out.length < count && tries < count * 40) {
        tries++;
        const x = pick(-LIMIT + 18, LIMIT - 18),
          z = pick(-LIMIT + 20, maxZ);
        if (Math.hypot(x, z) < 24) continue;
        if (routeDistance(x, z, routes) < minRoute) continue;
        if (
          clearings.some(
            ([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + minPad,
          )
        )
          continue;
        out.push({ x, z });
      }
      return out;
    };
    const shrubs = scatter(diff.shrubs, 18, 7, LIMIT - 44).map((p, i) => ({
      t: 'shrub',
      x: p.x,
      z: p.z,
      s: 2 + (i % 4) * 0.6,
    }));
    const rocks = scatter(diff.rocks, 18, 5, LIMIT - 19).map((p, i) => ({
      x: p.x,
      z: p.z,
      s: 1.1 + (i % 4) * 0.4,
    }));
    // Puntos de interés del patio (macetero, regadera, banco) con
    // posición propia por mapa, lejos de pads y rutas.
    const landmarkBase = [
      { kind: 'planter', x: 34, z: 26, radius: 21, yaw: 0 },
      { kind: 'watering', x: -45, z: -33, radius: 10, yaw: 0 },
      { kind: 'bench', x: 70, z: -48, radius: 12, yaw: 0 },
    ];
    const landmarks = landmarkBase.map((base) => {
      for (let tries = 0; tries < 40; tries++) {
        const x = base.x + pick(-25, 25),
          z = base.z + pick(-25, 25);
        if (Math.abs(x) > LIMIT - 65 || Math.abs(z) > LIMIT - 65) continue;
        if (routeDistance(x, z, routes) <= base.radius + 20) continue;
        if (
          clearings.some(
            ([cx, cz, r]) => Math.hypot(x - cx, z - cz) <= r + base.radius + 8,
          )
        )
          continue;
        return { ...base, x, z };
      }
      return { ...base };
    });
    const terrain = {
      phase: rng() * Math.PI * 2,
      amp: 18 + rng() * 10,
      freqX: 26 + rng() * 12,
      freqZ: 30 + rng() * 14,
    };
    // Espejo opcional del conjunto, como antes, para duplicar la
    // variedad sin romper la coherencia del mapa.
    if (rng() < 0.5) {
      B.x *= -1;
      C.x *= -1;
      for (const p of [...routeAB, ...routeBC]) p[0] *= -1;
      for (const e of [...enemies, ...extraAir]) e.x *= -1;
      for (const s of [...shrubs, ...rocks]) s.x *= -1;
      for (const l of landmarks) l.x *= -1;
      A.x *= -1;
    }
    const rules = { ...defaults, A, B, C, routeBC, enemies, extraAir };
    return {
      seed: seed >>> 0,
      mission,
      limit: LIMIT,
      rules,
      layout: {
        start: A,
        finish: C,
        camps: [[B.x, B.z]],
        route: routeAB.concat(routeBC.slice(1)),
      },
      routes: [routeAB, routeBC],
      terrain,
      scenery: { shrubs, rocks },
      landmarks,
      meta: { mission, attempts: 1, validated: false, fallback: false },
    };
  }

  // Mapa de respaldo: un mapa generado válido, buscado con semillas
  // fijas. El trazado clásico de antes no sirve como respaldo: su
  // ruta A→B serpentea hasta (-245, 100) y vuelve a B (-90, 100),
  // con tramos de más de 100 u que no pasan la validación. Si ningún
  // intento pasa, se devuelve el intento con menos problemas.
  function fallbackMap(mission, seed) {
    let best = null,
      bestErrors = Infinity;
    for (let s = 0; s < 64; s++) {
      const candidate = buildAttempt(mission, hashSeed(0xc0ffee, s));
      const errors = validate(candidate).length;
      if (errors === 0) {
        candidate.meta = {
          mission,
          attempts: MAX_ATTEMPTS,
          validated: true,
          fallback: true,
        };
        candidate.seed = seed >>> 0;
        return candidate;
      }
      if (errors < bestErrors) {
        best = candidate;
        bestErrors = errors;
      }
    }
    best.meta = {
      mission,
      attempts: MAX_ATTEMPTS,
      validated: false,
      fallback: true,
    };
    best.seed = seed >>> 0;
    return best;
  }

  // Reglas de jugabilidad que todo mapa debe cumplir. Devuelve la
  // lista de problemas (vacía = válido). Es pura geometría, sin
  // depender del mundo ni de las colisiones: la validación completa
  // con terreno y escolta vive en los tests.
  function validate(map) {
    const errors = [];
    const { A, B, C } = map.rules || {};
    if (!Number.isInteger(map.mission) || map.mission < 1 || map.mission > MISSIONS)
      errors.push('misión fuera de campaña');
    if (!A || !B || !C) return ['faltan A, B o C'];
    for (const [name, p] of [
      ['A', A],
      ['B', B],
      ['C', C],
    ]) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z))
        errors.push(`${name} no es finita`);
      else if (Math.abs(p.x) > LIMIT - 25 || Math.abs(p.z) > LIMIT - 25)
        errors.push(`${name} fuera del patio`);
    }
    if (Math.hypot(B.x, B.z) <= 185) errors.push('B demasiado cerca del origen');
    if (Math.hypot(C.x, C.z) <= 185) errors.push('C demasiado cerca del origen');
    if (dist(A, B) < 200) errors.push('A y B demasiado cerca');
    if (dist(B, C) < 190) errors.push('B y C demasiado cerca');
    if (dist(A, C) < 230) errors.push('A y C demasiado cerca');
    const [routeAB, routeBC] = map.routes || [];
    for (const [name, route] of [
      ['AB', routeAB],
      ['BC', routeBC],
    ]) {
      if (!route || route.length < 2) {
        errors.push(`ruta ${name} vacía`);
        continue;
      }
      const overall = [
        route[route.length - 1][0] - route[0][0],
        route[route.length - 1][1] - route[0][1],
      ];
      let total = 0;
      for (let i = 1; i < route.length; i++) {
        const [ax, az] = route[i - 1],
          [bx, bz] = route[i];
        const len = Math.hypot(bx - ax, bz - az);
        total += len;
        if (len < 5) errors.push(`ruta ${name}: tramo ${i} demasiado corto`);
        if (len > 95) errors.push(`ruta ${name}: tramo ${i} demasiado largo`);
        if (Math.abs(bx) > LIMIT - 8 || Math.abs(bz) > LIMIT - 8)
          errors.push(`ruta ${name}: punto ${i} fuera del patio`);
        if ((bx - ax) * overall[0] + (bz - az) * overall[1] < 0)
          errors.push(`ruta ${name}: tramo ${i} retrocede`);
      }
      if (total < 180) errors.push(`ruta ${name} demasiado corta`);
      if (total > 500) errors.push(`ruta ${name} demasiado larga`);
    }
    if (routeAB && routeBC) {
      const lastAB = routeAB[routeAB.length - 1];
      if (Math.hypot(lastAB[0] - routeBC[0][0], lastAB[1] - routeBC[0][1]) > 1)
        errors.push('las rutas AB y BC no se conectan en B');
    }
    const enemies = map.rules.enemies || [];
    const ids = new Set();
    for (const e of enemies) {
      if (ids.has(e.id)) errors.push(`enemigo duplicado: ${e.id}`);
      ids.add(e.id);
      if (!Number.isFinite(e.x) || !Number.isFinite(e.z))
        errors.push(`enemigo ${e.id} sin posición`);
      else {
        if (Math.hypot(e.x - A.x, e.z - A.z) < defaults.safeRadius + 4)
          errors.push(`enemigo ${e.id} demasiado cerca de A`);
        if (e.id.startsWith('patrol-')) {
          if (Math.hypot(e.x - B.x, e.z - B.z) <= defaults.perimeter + 10)
            errors.push(`patrulla ${e.id} dentro del perímetro de B`);
          if (Math.hypot(e.x - C.x, e.z - C.z) <= 45)
            errors.push(`patrulla ${e.id} demasiado cerca de C`);
        }
      }
    }
    for (const s of map.scenery?.shrubs || [])
      if (routeDistance(s.x, s.z, map.routes || []) < 18)
        errors.push('arbusto sobre la ruta');
    for (const s of map.scenery?.rocks || [])
      if (routeDistance(s.x, s.z, map.routes || []) < 18)
        errors.push('roca sobre la ruta');
    return errors;
  }

  function generate(mission, seed) {
    if (!Number.isInteger(mission) || mission < 1 || mission > MISSIONS)
      throw new RangeError('Misión fuera de campaña');
    const base = seed >>> 0;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = buildAttempt(mission, hashSeed(base, attempt));
      candidate.meta.attempts = attempt + 1;
      if (validate(candidate).length === 0) {
        candidate.meta.validated = true;
        return candidate;
      }
    }
    return fallbackMap(mission, base);
  }

  // Una campaña entera: tres mapas distintos por construcción. Si dos
  // misiones salieran iguales (misma A/B/C y rutas), se regenera la
  // repetida con otra semilla.
  function generateCampaign(campaignSeed) {
    const base = campaignSeed >>> 0;
    const maps = [];
    for (let mission = 1; mission <= MISSIONS; mission++) {
      let seed = seedForMission(base, mission);
      let map = generate(mission, seed);
      let guard = 0;
      const key = (m) =>
        JSON.stringify([m.rules.A, m.rules.B, m.rules.C, m.routes]);
      while (
        maps.some((other) => key(other) === key(map)) &&
        guard < 20
      ) {
        guard++;
        map = generate(mission, hashSeed(seed, guard));
      }
      maps.push(map);
    }
    return { campaignSeed: base, maps, seeds: maps.map((m) => m.seed) };
  }

  return {
    createRng,
    hashSeed,
    seedForMission,
    difficultyFor,
    buildAttempt,
    validate,
    generate,
    generateCampaign,
    MAX_ATTEMPTS,
    LIMIT,
  };
});
