/* Mapas fijos de las misiones originales (`src/original-maps.js`).
 *
 * Fabian revive Army Men: Air Attack (PlayStation, 1999, 3DO):
 * 16 misiones en escenarios como el jardín, el picnic, la playa y el
 * ártico, con el capitán William Blade. Este juego tiene solo 3
 * misiones de rescate A → B → C, así que los mapas recrean los tres
 * escenarios más icónicos del original, adaptados a ese sistema:
 *
 * - Misión 1, «Pandemonio de Plástico»: el valle alpino del original,
 *   no el patio de una casa. Corrección investigada (2026-11-06): la
 *   primera misión del original, «Plastic Pandemonium», es una base
 *   secreta alpina del mundo de plástico —pasto verde, camino de
 *   tierra, pinos altos y montañas— con suministros de plástico y un
 *   portal al final. Homenaje fiel solo en el mapa: las reglas del
 *   juego (A → B → C) no cambian.
 * - Misión 2, «Locura de coches»: el circuito de carretera del
 *   original («Going Car-razy»), con garajes Tan y coches que
 *   llevan los suministros por el portal. Sin mesa de picnic.
 * - Misión 3, «El tren que pudo»: las vías del tren del original
 *   («The Train That Could»), con el tren Prego, la batería robada
 *   por el helicóptero Tan y el portal de salida. Sin playa ni
 *   castillos de arena.
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
  // El patio es ANCHO, no solo el camino: el límite pasa de 320 a
  // 480 u (terreno de 960 × 960 u, 1,5x de ancho y 2,25x de área).
  // Las posiciones de A, B y C no se mueven: la misión dura lo
  // mismo, lo que crece es el terreno alrededor, con más sitio para
  // maniobrar con el helicóptero y para el pelotón. No se llega a
  // 640 (2x) a propósito: la malla del terreno crece con el cuadrado
  // del límite y a 640 serían ~3,7 millones de valores (~15 MB) en
  // cada carga de misión; a 480 son ~2,1 millones (~8 MB).
  const LIMIT = 480;
  const MISSIONS = 3;
  // El camino del original es ANCHO: medio ancho 15 u (30 u en total,
  // 3x el anterior de 10 u). Debe coincidir con el del mundo
  // (src/toy-world.js, ROAD_HALF_WIDTH): hay un test que lo comprueba.
  // La vegetación se mantiene fuera del camino con 13 u de margen
  // sobre el medio ancho: las patrullas flanquean a ±19 u y un
  // arbusto (radio ~3,8 u) no debe solaparlas (radio de patrulla
  // hasta 4,8 u), así que el despeje mínimo es 19 + 9 = 28 u.
  const ROAD_HALF_WIDTH = 15;
  const ROUTE_CLEARANCE = ROAD_HALF_WIDTH + 13;

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
  // Huellas de las defensas (Misión 1) como puntos con radio: cada
  // saco de una fila, cada poste de una valla, cada tienda, torre y
  // caja. Sirven para despejar la vegetación en `buildMap` y para
  // validar que nada bloquea rutas ni helipuertos.
  function defensePoints(defenses) {
    const points = [];
    for (const d of defenses || []) {
      if (d.kind === 'sandbags') {
        const count = d.count || 5,
          spacing = 3.2;
        for (let i = 0; i < count; i++) {
          const at = (i - (count - 1) / 2) * spacing;
          points.push([
            d.x + Math.cos(d.yaw || 0) * at,
            d.z + Math.sin(d.yaw || 0) * at,
            2,
          ]);
        }
      } else if (d.kind === 'fence') {
        const length = Math.hypot(d.x2 - d.x1, d.z2 - d.z1),
          count = Math.max(2, Math.floor(length / 7.5) + 1);
        for (let i = 0; i < count; i++) {
          const t = count === 1 ? 0 : i / (count - 1);
          points.push([
            d.x1 + (d.x2 - d.x1) * t,
            d.z1 + (d.z2 - d.z1) * t,
            1,
          ]);
        }
      } else if (d.kind === 'tent') points.push([d.x, d.z, 5]);
      else if (d.kind === 'tower') points.push([d.x, d.z, 4]);
      else if (d.kind === 'crate') points.push([d.x, d.z, 3]);
    }
    return points;
  }
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
      name: 'Pandemonio de Plástico',
      scenario: 'Alpine',
      inspiration:
        '«Plastic Pandemonium», primera misión del original: base secreta alpina del mundo de plástico, suministros de plástico y un portal. El mapa es una reconstrucción (no hay plano público del original): valle alpino con pinos, montañas y camino de tierra; sin props de jardín de casa.',
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
      terrain: {
        phase: 0,
        // El relieve del video (fotogramas f005–f025): colinas
        // onduladas en todo el terreno jugable, no solo en el borde.
        // `amp` es la altura base de las lomas (16, no 22: con la
        // ondulación añadida, las colinas se quedan verdes como en
        // el video en vez de nevarse) y `ridges` son las crestas
        // rocosas grises que cruzan el valle —norte, este junto al
        // portal y oeste—, fuera de rutas y helipuertos. El mundo
        // (src/toy-world.js) las levanta como lomos de roca.
        amp: 16,
        freqX: 31,
        freqZ: 37,
        ridges: [
          {
            points: [
              [-120, 300],
              [0, 330],
              [140, 310],
              [260, 280],
            ],
            h: 14,
          },
          {
            points: [
              [300, 60],
              [330, 160],
              [310, 260],
            ],
            h: 12,
          },
          {
            points: [
              [-360, -80],
              [-380, 60],
              [-350, 200],
            ],
            h: 12,
          },
        ],
      },
      // Puntos alpinos del original, en vez de los del jardín de casa:
      // la caja verde de suministros de plástico junto a B (el puesto),
      // el portal brillante al final del camino, pasado C, y una torre
      // de guardia junto a A (la base de salida tiene 4 torres: esta
      // más 3 fijas que dibuja el mundo). Las posiciones se eligieron
      // fuera de la ruta y de los helipuertos; `placeLandmark` en el
      // mundo las reubica si hiciera falta.
      landmarks: [
        // La caja va al oeste de B: en su sitio anterior (-110, 125)
        // `placeLandmark` la dejaba a 9 u de la patrulla `patrol-ab-4`
        // y su caja de colisión (6 u de medio lado) la solapaba.
        { kind: 'crate', x: -170, z: 140, radius: 8, yaw: 0 },
        // Portal al final del camino, pasado C, pero en suelo llano
        // (205, 192): el helicóptero no puede volar sobre terreno de
        // más de 2 u (`canTravel`) y en su sitio anterior (225, 200)
        // el suelo ya mide 13,5 u. A 25 u de C, sin solapar su radio
        // de entrega (12 + 9). El radio del punto es 4: el orbe es
        // decoración plana y el radio de disparo del portal (12) vive
        // en `portal`, no aquí.
        { kind: 'portal', x: 205, z: 192, radius: 4, yaw: 0 },
        // Torre de guardia junto a la base, a ~50 u de A: las torres
        // no deben rodear el helipuerto ni taparlo desde la cámara.
        { kind: 'tower', x: 48, z: -20, radius: 10, yaw: 0 },
      ],
      // Defensas de la base verde (ver docs/PARECIDO-AL-ORIGINAL.md):
      // 3 filas de sacos de arena (al sur de B, antes de C y al este
      // de A), una valla de alambre al sur de A, 2 tiendas de campaña
      // del puesto, 1 torre de vigilancia al este de B y 2 cajas de
      // suministros. Todas fuera del camino (≥18 u de las rutas) y de
      // los helipuertos (≥25 u de A/B/C); las comprueba `validate`.
      // La caja verde de la lista es la de suministros (`crate` de
      // arriba): es la carga que se levanta con el winch, no una
      // defensa más.
      defenses: [
        { kind: 'sandbags', x: -157, z: 125, yaw: 0, count: 5 },
        { kind: 'sandbags', x: 160, z: 163, yaw: 0, count: 5 },
        { kind: 'sandbags', x: 40, z: 32, yaw: 0, count: 5 },
        { kind: 'fence', x1: -45, z1: -35, x2: 45, z2: -35 },
        { kind: 'tent', x: -100, z: 140, yaw: 0.3 },
        { kind: 'tent', x: -185, z: 195, yaw: -0.4 },
        { kind: 'tower', x: -115, z: 205 },
        { kind: 'crate', x: -135, z: 200, yaw: 0.2 },
        { kind: 'crate', x: 25, z: -30, yaw: -0.3 },
      ],
      // Carga y portal del original: la caja de plástico junto a B se
      // levanta con el winch y se lleva por el portal, pasado C.
      cargo: { x: -170, z: 140 },
      portal: { x: 205, z: 192, radius: 12 },
      // Montañas y rocas grandes como borde del valle, sobre todo a
      // la derecha del camino cerca del portal (el desvío de la guía
      // del original) y en los bordes este y norte. Son decoración:
      // quedan a ≥60 u de las rutas y no tocan A, B ni C.
      mountains: [
        { x: 260, z: 260, s: 22 },
        { x: 330, z: 300, s: 26 },
        { x: 180, z: 320, s: 20 },
        { x: 60, z: 300, s: 18 },
        { x: -40, z: 290, s: 20 },
        { x: -140, z: 280, s: 16 },
        { x: 400, z: 100, s: 24 },
        { x: 420, z: 200, s: 20 },
        { x: 390, z: -60, s: 22 },
        { x: -380, z: -200, s: 20 },
        { x: 0, z: -380, s: 22 },
        { x: 300, z: -320, s: 18 },
        // Afloramientos rocosos más cercanos, a la derecha del camino
        // cerca del portal: que las montañas se lean también desde la
        // ruta, no solo en el borde lejano del mapa.
        { x: 300, z: 240, s: 18 },
        { x: 360, z: 320, s: 16 },
      ],
      scenerySeed: 101,
      // Vegetación escalada con el terreno (2,25x de área): 190 → 428
      // arbustos y 130 → 293 rocas, para mantener la misma densidad
      // y no dejar zonas vacías en el patio ampliado. En la Misión 1
      // los arbustos son pinos altos (`pineShrubs`), como en el valle
      // alpino del original.
      pineShrubs: true,
      shrubs: 428,
      rocks: 293,
      // Casi toda infantería: el valle alpino es la primera toma de contacto.
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
      name: 'Locura de coches',
      scenario: 'Road',
      inspiration:
        '«Going Car-razy», segunda misión del original: circuito de carretera con garajes Tan; los coches llevan los suministros por el portal y hay que pararlos antes de que pasen 15. Sin mesa de picnic.',
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
      // Circuito de carretera: la vuelta de C a A cierra el anillo
      // A → B → C → A por el que corren los coches de suministros.
      routeCA: [
        [240, 40],
        [190, -40],
        [145, -80],
        [100, -120],
        [50, -115],
        [0, -110],
        [-30, -80],
      ],
      terrain: { phase: 1.3, amp: 16, freqX: 34, freqZ: 40 },
      // El portal por el que escapan los coches: junto al circuito,
      // 25 u al sur del vértice (100, -120), en llano y fuera del
      // camino, para que los coches puedan llegar hasta él.
      carPortal: { x: 100, z: -145, radius: 12 },
      // Garajes Tan (ver docs/PARECIDO-AL-ORIGINAL.md): 3, junto al
      // circuito y a 20 u del camino (en llano, fuera de la ruta y
      // fuera del perímetro de B); cada uno suelta un coche cada
      // 20 s que recorre el circuito hasta el portal. `joinIndex` es
      // el vértice del circuito al que se incorporan sus coches y
      // `firstIn` escalona la primera salida (0, 7 y 14 s). El más
      // cercano al portal (garaje-este) deja a sus coches a 16 s del
      // portal; el más lejano (garaje-oeste), a 64 s. Si no se
      // destruye ningún garaje ni se dispara a ningún coche, el 15.º
      // pasa por el portal a los ~135 s.
      garages: [
        { id: 'garage-east', x: 203, z: -55, joinIndex: 11, firstIn: 0 },
        { id: 'garage-north', x: 88, z: 131, joinIndex: 4, firstIn: 7 },
        { id: 'garage-west', x: 29, z: 3.7, joinIndex: 2, firstIn: 14 },
      ],
      // Torres verdes de guardia (puntos de interés): una junto a A
      // y otra junto a C; el portal va en el hueco del medio.
      landmarks: [
        { kind: 'tower', x: -70, z: -110, radius: 10, yaw: 0 },
        { kind: 'portal', x: 100, z: -145, radius: 4, yaw: 0 },
        { kind: 'tower', x: 280, z: 90, radius: 10, yaw: 0 },
      ],
      scenerySeed: 202,
      shrubs: 338,
      rocks: 203,
      routeKinds: { inf: 'inf', tank: 'tank' },
      patrolKinds: {
        AB: ['inf', 'tank', 'inf', 'tur', 'inf', 'tank'],
        BC: ['tank', 'inf', 'tur', 'inf', 'tank', 'inf'],
      },
      bcKinds: { turret: 'tur', infantry: 'inf' },
      // Una libélula patrullando el circuito (en el original, los
      // insectos son la amenaza del picnic; aquí, del circuito).
      extraAir: [{ id: 'escort-air-2', k: 'heli', x: 150, z: 135, zone: 'BC', hp: 6 }],
    },
    {
      mission: 3,
      seed: 303,
      name: 'El tren que pudo',
      scenario: 'Rail',
      inspiration:
        '«The Train That Could», tercera misión del original: el tren Prego lleva el tanque de batalla, un helicóptero Tan robó la batería y hay que devolverla al tren, escoltarlo a la base verde y salir por el portal. Sin playa ni castillos de arena.',
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
      // La vía cruza el mapa de oeste a este: el tren sale de su
      // base (al oeste de B) y llega a C. Corre 8 u al sur del
      // camino, para que el pelotón marche por el camino sin
      // cruzarse con el tren. `trackExtension` es el tramo de vía
      // fuera de la ruta B→C: va en las rutas del mundo para que el
      // terreno quede llano bajo la base del tren.
      tracks: [
        [-257.6, 92.4],
        [-177.6, 112.4],
        [-97.6, 152.4],
        [-17.6, 182.4],
        [52.4, 197.4],
        [92.4, 207.4],
        [122.4, 212.4],
      ],
      trackExtension: [
        [-260, 100],
        [-180, 120],
      ],
      // La plataforma de energía, detrás del tren (al oeste de su
      // posición inicial): ahí se deja la batería con el winch.
      batteryPad: { x: -272, z: 89, radius: 9 },
      // El helicóptero Tan que robó la batería: huye por la ruta a
      // B (junto al tanque de la ruta, a 15 u de él) y al morir
      // suelta la batería donde cae.
      tanHeli: { x: -52, z: 52, hp: 8 },
      // Portal de salida, pasado C en la dirección del camino
      // (25 u): en llano, para que el helicóptero pueda volar por
      // él. El jugador sí vuela por este portal (playerPortal).
      portal: { x: 145, z: 224, radius: 12 },
      playerPortal: true,
      // La batería robada: empieza escondida en el helicóptero Tan
      // (su posición inicial es la del helicóptero) y solo se puede
      // levantar con el winch cuando cae al morir este. Se entrega
      // en la plataforma, no en el portal.
      cargo: {
        kind: 'battery',
        hidden: true,
        winchFrom: 'any',
        x: -52,
        z: 52,
        deliverAt: { x: -272, z: 89, radius: 9 },
      },
      // Torres verdes de guardia (puntos de interés): una en la base
      // del tren y otra en la base verde de C; el portal, en medio.
      landmarks: [
        { kind: 'tower', x: -290, z: 60, radius: 10, yaw: 0 },
        { kind: 'portal', x: 145, z: 224, radius: 4, yaw: 0 },
        { kind: 'tower', x: 180, z: 180, radius: 10, yaw: 0 },
      ],
      scenerySeed: 303,
      // Patio de vías, no playa: menos rocas que antes (los
      // castillos de arena) y vegetación moderada.
      shrubs: 220,
      rocks: 180,
      routeKinds: { inf: 'tur', tank: 'tank' },
      patrolKinds: {
        AB: ['tank', 'tur', 'tank', 'inf', 'tur', 'tank'],
        BC: ['tank', 'tur', 'tank', 'tur', 'inf', 'tank'],
      },
      bcKinds: { turret: 'tur', infantry: 'tank' },
      // Dos libélulas sobre las vías, como en los rescates de
      // «Tide Pool Terror».
      extraAir: [
        { id: 'escort-air-2', k: 'heli', x: -60, z: 175, zone: 'BC', hp: 6 },
        { id: 'escort-air-3', k: 'heli', x: 70, z: 210, zone: 'BC', hp: 6 },
      ],
    },
  ];

  function buildMap(spec) {
    const { A, B, C, routeAB, routeBC } = spec;
    // Rutas del mundo (carreteras y terreno llano): A→B, B→C y, si
    // el mapa las trae, la vuelta C→A que cierra el circuito
    // (Misión 2) y el tramo de vía a la base del tren (Misión 3).
    const routes = [routeAB, routeBC];
    if (spec.routeCA) routes.push(spec.routeCA);
    if (spec.trackExtension) routes.push(spec.trackExtension);
    // Circuito de la Misión 2: el anillo A → B → C → A por el que
    // corren los coches. La última entrada repite A (cierra el
    // anillo); los vértices únicos son todos menos esa última.
    const circuit =
      spec.routeCA && spec.carPortal
        ? routeAB
            .concat(routeBC.slice(1), spec.routeCA.slice(1))
            .slice(0, -1)
        : null;
    // Ruta de un garaje hasta el portal: del vértice al que se
    // incorporan sus coches, vuelta a vuelta por el circuito, y el
    // portal como última parada (fuera del camino, 25 u al sur del
    // último vértice). El índice del portal es el del vértice
    // (100, -120) en el circuito.
    const portalIndex = circuit
      ? circuit.findIndex(
          ([x, z]) =>
            Math.hypot(x - 100, z - -120) < 1,
        )
      : -1;
    const carRoute = (joinIndex) => {
      const route = [];
      let i = joinIndex;
      for (let guard = 0; guard <= circuit.length; guard++) {
        route.push([...circuit[i]]);
        if (i === portalIndex) break;
        i = (i + 1) % circuit.length;
      }
      route.push([spec.carPortal.x, spec.carPortal.z]);
      return route;
    };
    // Garajes Tan (Misión 2): enemigos-edificio (10 HP, como una
    // base) junto al circuito, con la puerta hacia el vértice al
    // que se incorporan sus coches.
    const garages = (spec.garages || []).map((g) => {
      const [jx, jz] = circuit[g.joinIndex];
      return {
        ...g,
        route: carRoute(g.joinIndex),
        yaw: Math.atan2(jx - g.x, jz - g.z),
      };
    });
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
      // Garajes Tan (Misión 2): edificios con 10 HP, como una base;
      // su `zone` propia no altera los conteos de patrullas AB/BC.
      ...garages.map((g) => ({
        id: g.id,
        k: 'garage',
        x: g.x,
        z: g.z,
        zone: 'GARAGE',
        hp: 10,
        yaw: g.yaw,
      })),
      // El helicóptero Tan que robó la batería (Misión 3): un Huey
      // más (8 HP, como el de B); su `zone` propia no altera los
      // conteos de patrullas AB/BC.
      ...(spec.tanHeli
        ? [
            {
              id: 'tan-heli',
              k: 'heli',
              x: spec.tanHeli.x,
              z: spec.tanHeli.z,
              zone: 'AIR',
              hp: spec.tanHeli.hp,
            },
          ]
        : []),
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
        // Fuera del camino ensanchado: antes bastaba ±9 porque el
        // camino tenía 5 u de medio ancho; ahora flanquean a ±19.
        const side = i % 2 ? ROAD_HALF_WIDTH + 4 : -(ROAD_HALF_WIDTH + 4);
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
    // `routes` ya trae las rutas extra (circuito y vía del tren):
    // la vegetación también se mantiene fuera de ellas.
    const clearings = [
      [A.x, A.z, 23],
      [C.x, C.z, 23],
      [B.x, B.z + 5, 24],
      // Las defensas también despejan vegetación: que ningún pino o
      // roca nazca encima de un saco, una tienda o una valla.
      ...defensePoints(spec.defenses || []).map(([x, z]) => [x, z, 10]),
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
    // Pinos en bosquetes, no sueltos y uniformes: ~26 grupos de 8–20
    // pinos en los bordes y laderas del valle, como el bosque del
    // original. Cada pino pasa los mismos despejes que el reparto
    // uniforme (fuera de rutas y helipuertos); si los bosquetes no
    // bastan, se completa con el reparto uniforme.
    const scatterPines = (count, minRoute, minPad, maxZ) => {
      const centers = [];
      let ctries = 0;
      while (centers.length < 26 && ctries < 600) {
        ctries++;
        const x = pick(-LIMIT + 40, LIMIT - 40),
          z = pick(-LIMIT + 40, maxZ);
        if (Math.hypot(x, z) < 24) continue;
        if (routeDistance(x, z, routes) < minRoute + 22) continue;
        if (
          clearings.some(
            ([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + 22,
          )
        )
          continue;
        centers.push([x, z]);
      }
      const out = [];
      let tries = 0;
      while (out.length < count && tries < count * 40) {
        tries++;
        const [cx, cz] =
          centers[Math.floor(rng() * centers.length)] || [0, 0];
        const a = rng() * Math.PI * 2,
          r = Math.sqrt(rng()) * 20,
          x = cx + Math.cos(a) * r,
          z = cz + Math.sin(a) * r;
        if (Math.abs(x) > LIMIT - 18 || Math.abs(z) > maxZ) continue;
        if (Math.hypot(x, z) < 24) continue;
        if (routeDistance(x, z, routes) < minRoute) continue;
        if (
          clearings.some(
            ([cx2, cz2, r2]) => Math.hypot(x - cx2, z - cz2) < r2 + minPad,
          )
        )
          continue;
        out.push({ x, z });
      }
      return out.concat(
        scatter(count - out.length, minRoute, minPad, maxZ),
      );
    };
    const shrubs = (spec.pineShrubs ? scatterPines : scatter)(
      spec.shrubs,
      ROUTE_CLEARANCE,
      7,
      LIMIT - 44,
    ).map((p, i) => ({
      t: spec.pineShrubs ? 'pine' : 'shrub',
      x: p.x,
      z: p.z,
      // Pinos altos: 2,6–6,2 u de escala (~9–21 u de alto con las
      // 4 copas del renderizador), varias veces el helicóptero.
      s: spec.pineShrubs ? 2.6 + (i % 5) * 0.9 : 2 + (i % 4) * 0.6,
    }));
    const rocks = scatter(spec.rocks, ROUTE_CLEARANCE, 5, LIMIT - 19).map((p, i) => ({
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
      missionName: spec.name,
      // Carga y portal: la Misión 1 trae la caja de plástico y el
      // portal por el que se vuela (`cargo` + `portal`); la Misión
      // 3 trae la batería robada (`cargo`, escondida en el
      // helicóptero Tan) y el portal de salida (`portal`, con
      // `playerPortal`); la Misión 2 no trae carga —su portal es el
      // de los coches (`carPortal`, solo en el mapa) y sus garajes
      // van en `garages`.
      ...(spec.cargo
        ? {
            cargo: { ...spec.cargo },
            ...(spec.portal && !spec.playerPortal
              ? { portal: { ...spec.portal } }
              : {}),
          }
        : {}),
      ...(spec.playerPortal && spec.portal
        ? { portal: { ...spec.portal } }
        : {}),
      ...(spec.garages
        ? {
            garages: garages.map((g) => ({ ...g })),
            carsLimit: 15,
            carSpawnInterval: 20,
          }
        : {}),
      ...(spec.tracks
        ? {
            train: {
              route: spec.tracks.map((p) => [...p]),
              speed: 6,
            },
            batteryPad: { ...spec.batteryPad },
            tanHeliId: 'tan-heli',
          }
        : {}),
    };
    return {
      seed: spec.seed,
      mission: spec.mission,
      name: spec.name,
      scenario: spec.scenario,
      inspiration: spec.inspiration,
      limit: LIMIT,
      rules,
      defenses: (spec.defenses || []).map((d) => ({ ...d })),
      cargo: spec.cargo ? { ...spec.cargo } : null,
      portal: spec.portal ? { ...spec.portal } : null,
      carPortal: spec.carPortal ? { ...spec.carPortal } : null,
      garages: garages.map((g) => ({ ...g })),
      tracks: spec.tracks ? spec.tracks.map((p) => [...p]) : null,
      batteryPad: spec.batteryPad ? { ...spec.batteryPad } : null,
      layout: {
        start: { ...A },
        finish: { ...C },
        camps: [[B.x, B.z]],
        // Misión 2: la ruta es el circuito completo A → B → C → A.
        // El tramo de vía de la Misión 3 no va aquí: es un ramal a
        // la base del tren, no parte de la ruta del pelotón.
        route: [routeAB, routeBC, ...(spec.routeCA ? [spec.routeCA] : [])]
          .reduce((acc, r, i) => acc.concat(i ? r.slice(1) : r), [])
          .map((p) => [...p]),
      },
      routes: routes.map((r) => r.map((p) => [...p])),
      terrain: { ...spec.terrain },
      scenery: {
        shrubs,
        rocks,
        mountains: (spec.mountains || []).map((m) => ({ ...m })),
      },
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
    // Rutas extra (índice ≥ 2): la vuelta C→A que cierra el circuito
    // de la Misión 2 y el tramo de vía a la base del tren de la
    // Misión 3. Mismas reglas de forma (tramos de 5–95 u, sin
    // retrocesos, puntos en el patio) pero sin mínimo de longitud:
    // el tramo de vía mide 82 u. El circuito empieza en C y termina
    // en A; el tramo de vía termina en B.
    const extraRoutes = (map.routes || []).slice(2);
    for (const [ri, route] of extraRoutes.entries()) {
      if (!route || route.length < 2) {
        errors.push(`ruta extra ${ri} vacía`);
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
        if (len < 5) errors.push(`ruta extra ${ri}: tramo ${i} demasiado corto`);
        if (len > 95) errors.push(`ruta extra ${ri}: tramo ${i} demasiado largo`);
        if (Math.abs(bx) > LIMIT - 8 || Math.abs(bz) > LIMIT - 8)
          errors.push(`ruta extra ${ri}: punto ${i} fuera del patio`);
        if ((bx - ax) * overall[0] + (bz - az) * overall[1] < 0)
          errors.push(`ruta extra ${ri}: tramo ${i} retrocede`);
      }
      if (total > 500) errors.push(`ruta extra ${ri} demasiado larga`);
    }
    if (extraRoutes[0] && (map.garages || []).length) {
      const first = extraRoutes[0][0],
        last = extraRoutes[0][extraRoutes[0].length - 1];
      if (Math.hypot(first[0] - C.x, first[1] - C.z) > 1)
        errors.push('el circuito no empieza en C');
      if (Math.hypot(last[0] - A.x, last[1] - A.z) > 1)
        errors.push('el circuito no termina en A');
    }
    if (extraRoutes[0] && map.tracks) {
      const last = extraRoutes[0][extraRoutes[0].length - 1];
      if (Math.hypot(last[0] - B.x, last[1] - B.z) > 1)
        errors.push('el tramo de vía no termina en B');
    }
    // Garajes Tan (Misión 2): junto al circuito (18–25 u del
    // camino: fuera del camino de 15 u de medio ancho, pero lo
    // bastante cerca para que sus coches se incorporen), lejos de
    // los helipuertos (≥94 u de A, ≥30 u de B, ≥20 u de C), sin
    // solapar a ningún enemigo, y con una ruta de coches que
    // termina en el portal de los coches.
    for (const g of map.garages || []) {
      if (Math.hypot(g.x - A.x, g.z - A.z) < defaults.safeRadius + 4)
        errors.push(`garaje ${g.id} demasiado cerca de A`);
      else if (Math.hypot(g.x - B.x, g.z - B.z) < 30)
        errors.push(`garaje ${g.id} demasiado cerca de B`);
      else if (Math.hypot(g.x - C.x, g.z - C.z) < 20)
        errors.push(`garaje ${g.id} demasiado cerca de C`);
      const rd = routeDistance(g.x, g.z, map.routes || []);
      if (rd < 18 || rd > 25)
        errors.push(`garaje ${g.id} ni junto ni fuera de la ruta`);
      if (
        (map.rules.enemies || []).some(
          (e) => e.id !== g.id && Math.hypot(g.x - e.x, g.z - e.z) < 8,
        )
      )
        errors.push(`garaje ${g.id} sobre un enemigo`);
      const last = g.route?.[g.route.length - 1];
      if (
        !last ||
        !map.carPortal ||
        Math.hypot(last[0] - map.carPortal.x, last[1] - map.carPortal.z) > 1
      )
        errors.push(`garaje ${g.id} sin ruta al portal`);
    }
    // Portal de los coches (Misión 2): en el patio, junto al
    // circuito (18–28 u del camino).
    if (map.carPortal) {
      const { x, z } = map.carPortal;
      if (Math.abs(x) > LIMIT - 25 || Math.abs(z) > LIMIT - 25)
        errors.push('portal de coches fuera del patio');
      else {
        const rd = routeDistance(x, z, map.routes || []);
        if (rd < 18 || rd > 28)
          errors.push('portal de coches ni junto ni fuera de la ruta');
      }
    }
    // Vías (Misión 3): puntos en el patio, junto a las rutas (el
    // tren corre al lado del camino) y el último junto a C.
    if (map.tracks) {
      map.tracks.forEach(([x, z], i) => {
        if (Math.abs(x) > LIMIT - 8 || Math.abs(z) > LIMIT - 8)
          errors.push(`vía ${i} fuera del patio`);
        else if (routeDistance(x, z, map.routes || []) > 12)
          errors.push(`vía ${i} demasiado lejos de la ruta`);
      });
      const last = map.tracks[map.tracks.length - 1];
      if (last && Math.hypot(last[0] - C.x, last[1] - C.z) > 15)
        errors.push('la vía no llega a C');
    }
    // Plataforma de batería (Misión 3): en el patio y detrás del
    // tren (a ≤25 u del primer punto de la vía).
    if (map.batteryPad) {
      const { x, z } = map.batteryPad;
      if (Math.abs(x) > LIMIT - 25 || Math.abs(z) > LIMIT - 25)
        errors.push('plataforma de batería fuera del patio');
      else if (
        !map.tracks ||
        Math.hypot(x - map.tracks[0][0], z - map.tracks[0][1]) > 25
      )
        errors.push('plataforma de batería lejos del tren');
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
      if (routeDistance(s.x, s.z, map.routes || []) < ROUTE_CLEARANCE)
        errors.push('arbusto sobre la ruta');
    for (const s of map.scenery?.rocks || [])
      if (routeDistance(s.x, s.z, map.routes || []) < ROUTE_CLEARANCE)
        errors.push('roca sobre la ruta');
    // Las montañas son el borde del valle: fuera de las rutas y del
    // patio, nunca un bloqueo. Solo la Misión 1 las tiene.
    for (const m of map.scenery?.mountains || []) {
      if (Math.abs(m.x) > LIMIT - 8 || Math.abs(m.z) > LIMIT - 8)
        errors.push('montaña fuera del patio');
      else if (routeDistance(m.x, m.z, map.routes || []) < 40)
        errors.push('montaña sobre la ruta');
      else if (
        [map.rules.A, map.rules.B, map.rules.C].some(
          (p) => Math.hypot(m.x - p.x, m.z - p.z) < 40,
        )
      )
        errors.push('montaña demasiado cerca de un helipuerto');
    }
    // Las crestas rocosas del terreno (solo la Misión 1): cada punto
    // de la cresta queda fuera de las rutas y de los helipuertos,
    // como las montañas; el relieve nunca bloquea la escolta.
    for (const ridge of map.terrain?.ridges || [])
      for (const [x, z] of ridge.points || []) {
        if (Math.abs(x) > LIMIT - 8 || Math.abs(z) > LIMIT - 8)
          errors.push('cresta rocosa fuera del patio');
        else if (routeDistance(x, z, map.routes || []) < 40)
          errors.push('cresta rocosa sobre la ruta');
        else if (
          [map.rules.A, map.rules.B, map.rules.C].some(
            (p) => Math.hypot(x - p.x, z - p.z) < 40,
          )
        )
          errors.push('cresta rocosa demasiado cerca de un helipuerto');
      }
    // Defensas (solo la Misión 1): cada huella queda dentro del patio,
    // fuera del camino (≥18 u de las rutas: el camino mide 15 u de
    // medio ancho) y lejos de los helipuertos (≥25 u de A/B/C), sin
    // solapar a ningún enemigo. La caja de la carga y el portal van
    // con las mismas reglas; el portal además queda a ≥22 u de C para
    // que su radio (12) no se solape con el de entrega (9).
    for (const [x, z, r] of defensePoints(map.defenses || [])) {
      if (Math.abs(x) > LIMIT - 25 || Math.abs(z) > LIMIT - 25)
        errors.push('defensa fuera del patio');
      else if (routeDistance(x, z, map.routes || []) < 18)
        errors.push('defensa sobre la ruta');
      else if (
        [map.rules.A, map.rules.B, map.rules.C].some(
          (p) => Math.hypot(x - p.x, z - p.z) < 25,
        )
      )
        errors.push('defensa demasiado cerca de un helipuerto');
      else if (
        (map.rules.enemies || []).some(
          (e) => Math.hypot(x - e.x, z - e.z) < r + 4,
        )
      )
        errors.push('defensa sobre un enemigo');
    }
    if (map.cargo) {
      const { x, z } = map.cargo;
      if (Math.abs(x) > LIMIT - 25 || Math.abs(z) > LIMIT - 25)
        errors.push('caja fuera del patio');
      // Solo la caja de plástico de la Misión 1 va fuera del camino
      // y junto al puesto B. La batería de la Misión 3 cae donde
      // muere el helicóptero Tan: junto a la ruta y lejos de B.
      else if (map.cargo.kind === 'crate') {
        if (routeDistance(x, z, map.routes || []) < 18)
          errors.push('caja sobre la ruta');
        else if (Math.hypot(x - map.rules.B.x, z - map.rules.B.z) > 60)
          errors.push('caja demasiado lejos del puesto B');
      }
    }
    if (map.portal) {
      const { x, z } = map.portal;
      if (Math.abs(x) > LIMIT - 25 || Math.abs(z) > LIMIT - 25)
        errors.push('portal fuera del patio');
      else if (routeDistance(x, z, map.routes || []) < 18)
        errors.push('portal sobre la ruta');
      else if (Math.hypot(x - map.rules.C.x, z - map.rules.C.z) < 22)
        errors.push('portal demasiado cerca de C');
    }
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
    defensePoints,
    validate,
    generate,
    generateCampaign,
    LIMIT,
    ROAD_HALF_WIDTH,
    ROUTE_CLEARANCE,
  };
});
