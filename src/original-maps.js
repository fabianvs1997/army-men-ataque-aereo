/* Mapas fijos de las misiones originales (`src/original-maps.js`).
 *
 * Fabian revive Army Men: Air Attack (PlayStation, 1999, 3DO):
 * 16 misiones en escenarios como el jardín, el picnic, la playa y el
 * ártico, con el capitán William Blade. Este juego tiene solo 3
 * misiones de rescate A → B → C, así que los mapas recrean los tres
 * escenarios más icónicos del original, adaptados a ese sistema:
 *
 * - Misión 1, «El jardín»: el patio trasero del original, con pinos,
 *   camino de tierra y los puntos de interés del patio (macetero,
 *   regadera, banco). Homenaje a «Plastic Pandemonium», la primera
 *   misión del original (base secreta, suministros de plástico).
 * - Misión 2, «El picnic»: el mantel del picnic, con la mesa y la
 *   comida como puntos de interés y hormigas (infantería) por todas
 *   partes. Homenaje a «Picnic Panic», el picnic del original.
 * - Misión 3, «La playa»: arena abierta y llana, castillos de arena
 *   (rocas) junto a C y libélulas (helicópteros enemigos) patrullando.
 *   Homenaje a «Don't Feed The Crabs» y «Tide Pool Terror», los
 *   rescates de la playa del original.
 *
 * Honestidad sobre la recreación: no hay un plano exacto público de
 * los mapas del original para copiarlos 1:1, y sus tres primeras
 * misiones tenían otros objetivos (suministros y un portal, coches y
 * garajes, un tren y una batería). Lo que se recrea fielmente en
 * espíritu es el escenario de cada misión —su ambiente, sus puntos y
 * su dificultad— dentro del sistema de rescate A → B → C de este
 * juego, con assets propios (nada de arte, música ni texto del
 * original). Por eso cada mapa lleva su nombre, su escenario y su
 * inspiración documentados en `docs/MAPAS-ORIGINALES.md`.
 *
 * Los mapas son FIJOS: el trazado (A, B, C, rutas, enemigos, puntos
 * de interés y relieve) está escrito a mano en este archivo y la
 * misma misión siempre da el mismo mapa. La vegetación se rellena
 * con un RNG de semilla fija por misión (mulberry32, sin
 * Math.random), así que también es idéntica siempre. No hay motor
 * aleatorio: el antiguo `src/mapgen.js` se eliminó y no hay botón
 * «Mapa nuevo»; reintentar conserva el mapa, como siempre.
 *
 * Jugabilidad garantizada por construcción + validación: `validate`
 * comprueba por geometría que A, B y C están dentro del patio y
 * separados, que las rutas están conectadas y sin tramos imposibles,
 * que los enemigos están fuera del radio seguro de A y de los
 * perímetros de B y C, y que la vegetación no tapa las rutas. La
 * validación completa con terreno y escolta (la ruta es transitable
 * y el pelotón llega a C) vive en `tests/original-maps.test.cjs`.
 */
(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports
      ? require('./escort-config.js')
      : root.ToyEscortConfig,
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyOriginalMaps = api;
})(globalThis, function (defaults) {
  'use strict';
  const LIMIT = 320;
  const MISSIONS = 3;

  // RNG con semilla (mulberry32) solo para el relleno determinista de
  // vegetación: la misma semilla da siempre la misma secuencia, así
  // que el mapa es idéntico en cada partida. El trazado no depende
  // de él: está escrito a mano en SPECS.
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
  // Punto a una fracción t del recorrido de una ruta (por longitud).
  function pointOnRoute(route, t) {
    const total = route.reduce(
      (sum, p, i) =>
        sum + (i ? Math.hypot(p[0] - route[i - 1][0], p[1] - route[i - 1][1]) : 0),
      0,
    );
    let at = t * total;
    for (let i = 1; i < route.length; i++) {
      const len = Math.hypot(
        route[i][0] - route[i - 1][0],
        route[i][1] - route[i - 1][1],
      );
      if (at <= len || i === route.length - 1) {
        const f = len === 0 ? 0 : Math.min(1, at / len);
        return [
          route[i - 1][0] + (route[i][0] - route[i - 1][0]) * f,
          route[i - 1][1] + (route[i][1] - route[i - 1][1]) * f,
        ];
      }
      at -= len;
    }
    return route[route.length - 1];
  }

  const hpFor = (k) => ({ inf: 3, tank: 8, tur: 6, heli: 6 })[k];
  // Enemigos de B con los desplazamientos clásicos respecto a B.
  const bZone = (B) => [
    { id: 'b-west', k: 'tank', x: B.x - 19, z: B.z, zone: 'B', hp: 16 },
    { id: 'b-north', k: 'tur', x: B.x + 3, z: B.z + 19, zone: 'B', hp: 16 },
    { id: 'b-east', k: 'inf', x: B.x + 18, z: B.z, zone: 'B', hp: 10 },
    { id: 'b-air', k: 'heli', x: B.x - 14, z: B.z - 11, zone: 'B', hp: 8 },
  ];

  // Los tres mapas fijos, escritos a mano. `seed` es el identificador
  // del mapa (se muestra en el HUD con `?perf=1` y en el registro).
  const SPECS = [
    {
      mission: 1,
      seed: 101,
      name: 'El jardín',
      scenario: 'Backyard',
      inspiration:
        '«Plastic Pandemonium», primera misión del original: el patio trasero, base secreta y suministros de plástico.',
      A: { x: 0, z: 0 },
      B: { x: -150, z: 170 },
      C: { x: 180, z: 190 },
      routeAB: [
        [0, 0],
        [-40, 30],
        [-80, 70],
        [-110, 110],
        [-135, 145],
        [-150, 170],
      ],
      routeBC: [
        [-150, 170],
        [-90, 185],
        [-30, 200],
        [30, 195],
        [90, 185],
        [140, 185],
        [180, 190],
      ],
      terrain: { phase: 0, amp: 22, freqX: 31, freqZ: 37 },
      landmarks: [
        { kind: 'planter', x: 34, z: 26, radius: 21, yaw: 0 },
        { kind: 'watering', x: -45, z: -33, radius: 10, yaw: 0 },
        { kind: 'bench', x: 70, z: -48, radius: 12, yaw: 0 },
      ],
      scenerySeed: 101,
      shrubs: 190,
      rocks: 130,
      // Casi toda infantería: el jardín es la primera toma de contacto.
      routeKinds: { inf: 'inf', tank: 'tank' },
      patrolKinds: {
        AB: ['inf', 'inf', 'tank', 'inf', 'inf', 'tur'],
        BC: ['inf', 'inf', 'inf', 'tur', 'inf', 'inf'],
      },
      bcKinds: { turret: 'tur', infantry: 'inf' },
      extraAir: [],
    },
    {
      mission: 2,
      seed: 202,
      name: 'El picnic',
      scenario: 'Picnic',
      inspiration:
        '«Picnic Panic», el picnic del original: comida por todas partes, hormigas (infantería) y la Máquina en el centro.',
      A: { x: -30, z: -80 },
      B: { x: 85, z: 175 },
      C: { x: 240, z: 40 },
      routeAB: [
        [-30, -80],
        [0, -20],
        [20, 40],
        [50, 100],
        [70, 140],
        [85, 175],
      ],
      routeBC: [
        [85, 175],
        [130, 150],
        [180, 120],
        [210, 90],
        [230, 60],
        [240, 40],
      ],
      terrain: { phase: 1.3, amp: 16, freqX: 34, freqZ: 40 },
      // El mantel del picnic: banco, macetero y regadera juntos junto
      // a la ruta B→C, como mesa y comida del picnic.
      landmarks: [
        { kind: 'planter', x: 180, z: 25, radius: 21, yaw: 0 },
        { kind: 'watering', x: 110, z: 90, radius: 10, yaw: 0 },
        { kind: 'bench', x: 150, z: 60, radius: 12, yaw: 0 },
      ],
      scenerySeed: 202,
      shrubs: 150,
      rocks: 90,
      routeKinds: { inf: 'inf', tank: 'tank' },
      patrolKinds: {
        AB: ['inf', 'tank', 'inf', 'tur', 'inf', 'tank'],
        BC: ['tank', 'inf', 'tur', 'inf', 'tank', 'inf'],
      },
      bcKinds: { turret: 'tur', infantry: 'inf' },
      // Una libélula patrullando el picnic (en el original, los
      // insectos son la amenaza del picnic).
      extraAir: [{ id: 'escort-air-2', k: 'heli', x: 150, z: 135, zone: 'BC', hp: 6 }],
    },
    {
      mission: 3,
      seed: 303,
      name: 'La playa',
      scenario: 'Beach',
      inspiration:
        '«Don\'t Feed The Crabs» y «Tide Pool Terror», los rescates de la playa del original: castillos de arena, cangrejos y libélulas.',
      A: { x: 60, z: -40 },
      B: { x: -180, z: 120 },
      C: { x: 120, z: 220 },
      routeAB: [
        [60, -40],
        [0, 0],
        [-60, 40],
        [-120, 80],
        [-160, 100],
        [-180, 120],
      ],
      routeBC: [
        [-180, 120],
        [-100, 160],
        [-20, 190],
        [50, 205],
        [90, 215],
        [120, 220],
      ],
      terrain: { phase: 2.6, amp: 9, freqX: 40, freqZ: 44 },
      // Arena abierta y llana: pocos pinos, muchas rocas (castillos
      // de arena) y los puntos de interés lejos, en la orilla.
      landmarks: [
        { kind: 'planter', x: -40, z: 250, radius: 21, yaw: 0 },
        { kind: 'watering', x: 200, z: -120, radius: 10, yaw: 0 },
        { kind: 'bench', x: 0, z: 240, radius: 12, yaw: 0 },
      ],
      scenerySeed: 303,
      shrubs: 80,
      rocks: 175,
      routeKinds: { inf: 'tur', tank: 'tank' },
      patrolKinds: {
        AB: ['tank', 'tur', 'tank', 'inf', 'tur', 'tank'],
        BC: ['tank', 'tur', 'tank', 'tur', 'inf', 'tank'],
      },
      bcKinds: { turret: 'tur', infantry: 'tank' },
      // Dos libélulas sobre la playa, como en los rescates de
      // «Tide Pool Terror».
      extraAir: [
        { id: 'escort-air-2', k: 'heli', x: -60, z: 175, zone: 'BC', hp: 6 },
        { id: 'escort-air-3', k: 'heli', x: 70, z: 210, zone: 'BC', hp: 6 },
      ],
    },
  ];

  function buildMap(spec) {
    const { A, B, C, routeAB, routeBC } = spec;
    const enemies = [
      {
        id: 'route-tank',
        k: 'tank',
        x: routeAB[2][0],
        z: routeAB[2][1],
        zone: 'AB',
        hp: 8,
      },
      {
        id: 'route-infantry',
        k: spec.routeKinds.inf,
        x: routeAB[4][0],
        z: routeAB[4][1],
        zone: 'AB',
        hp: hpFor(spec.routeKinds.inf),
      },
      ...bZone(B),
      {
        id: 'escort-turret',
        k: spec.bcKinds.turret,
        x: routeBC[2][0],
        z: routeBC[2][1],
        zone: 'BC',
        hp: hpFor(spec.bcKinds.turret),
      },
      {
        id: 'escort-infantry',
        k: spec.bcKinds.infantry,
        x: routeBC[Math.min(4, routeBC.length - 1)][0],
        z: routeBC[Math.min(4, routeBC.length - 1)][1],
        zone: 'BC',
        hp: hpFor(spec.bcKinds.infantry),
      },
    ];
    // Patrullas: mismo número de huecos que antes (6+6), con el tipo
    // fijo de cada mapa; la dificultad crece de la 1 a la 3.
    for (const [zone, route] of [
      ['AB', routeAB],
      ['BC', routeBC],
    ]) {
      spec.patrolKinds[zone].forEach((k, i) => {
        const t = zone === 'AB' ? 0.47 + (i * 0.05) : 0.25 + i * 0.1;
        const [px, pz] = pointOnRoute(route, Math.min(0.75, t));
        const [ax, az] = pointOnRoute(route, Math.max(0, t - 0.01));
        const length = Math.hypot(px - ax, pz - az) || 1;
        const side = i % 2 ? 9 : -9;
        enemies.push({
          id: `patrol-${zone.toLowerCase()}-${i}`,
          zone,
          k,
          hp: hpFor(k),
          x: px - ((pz - az) / length) * side,
          z: pz + ((px - ax) / length) * side,
        });
      });
    }
    // Vegetación con la semilla fija del mapa, fuera de pads y rutas.
    const routes = [routeAB, routeBC];
    const clearings = [
      [A.x, A.z, 23],
      [C.x, C.z, 23],
      [B.x, B.z + 5, 24],
    ];
    const rng = createRng(spec.scenerySeed);
    const pick = (a, b) => a + rng() * (b - a);
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
    const shrubs = scatter(spec.shrubs, 18, 7, LIMIT - 44).map((p, i) => ({
      t: 'shrub',
      x: p.x,
      z: p.z,
      s: 2 + (i % 4) * 0.6,
    }));
    const rocks = scatter(spec.rocks, 18, 5, LIMIT - 19).map((p, i) => ({
      x: p.x,
      z: p.z,
      s: 1.1 + (i % 4) * 0.4,
    }));
    const rules = {
      ...defaults,
      A: { ...A },
      B: { ...B },
      C: { ...C },
      routeBC: routeBC.map((p) => [...p]),
      enemies,
      extraAir: spec.extraAir.map((e) => ({ ...e })),
    };
    return {
      seed: spec.seed,
      mission: spec.mission,
      name: spec.name,
      scenario: spec.scenario,
      inspiration: spec.inspiration,
      limit: LIMIT,
      rules,
      layout: {
        start: { ...A },
        finish: { ...C },
        camps: [[B.x, B.z]],
        route: routeAB.concat(routeBC.slice(1)).map((p) => [...p]),
      },
      routes: [routeAB.map((p) => [...p]), routeBC.map((p) => [...p])],
      terrain: { ...spec.terrain },
      scenery: { shrubs, rocks },
      landmarks: spec.landmarks.map((p) => ({ ...p })),
      meta: { mission: spec.mission, fixed: true, validated: false },
    };
  }

  // Reglas de jugabilidad que todo mapa fijo debe cumplir. Devuelve
  // la lista de problemas (vacía = válido). Es pura geometría, sin
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

  // El mapa fijo de una misión. La semilla se ignora a propósito:
  // cada misión tiene un solo mapa, siempre el mismo. Se devuelve
  // una copia profunda para que el juego no pueda mutar el original.
  function generate(mission) {
    if (!Number.isInteger(mission) || mission < 1 || mission > MISSIONS)
      throw new RangeError('Misión fuera de campaña');
    const map = buildMap(SPECS[mission - 1]);
    map.meta.validated = validate(map).length === 0;
    return JSON.parse(JSON.stringify(map));
  }

  function generateCampaign() {
    const maps = [1, 2, 3].map((mission) => generate(mission));
    return { maps, seeds: maps.map((m) => m.seed) };
  }

  return {
    createRng,
    SPECS,
    buildMap,
    validate,
    generate,
    generateCampaign,
    LIMIT,
  };
});
