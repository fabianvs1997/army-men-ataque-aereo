/* Shared deterministic terrain for the WebGL renderer. */
(function (root) {
  'use strict';
  function create(map) {
    const LIMIT = map?.limit || 200,
      STEP = 4,
      COUNT = (LIMIT * 2) / STEP + 1;
    // Valle alpino (Misión 1, «Plastic Pandemonium»): sin valla de
    // jardín, sin casa y sin macetero/regadera/banco; el borde del
    // mapa son las montañas y los puntos de interés son la caja de
    // suministros, el portal y las torres de guardia.
    const alpine = map?.scenario === 'Alpine';
    // El camino del original es ANCHO y oscuro y cruza el mapa: medio
    // ancho 15 u (30 u en total, 3x el anterior de 10 u). Es la única
    // fuente de verdad del ancho: el renderizador dibuja la caja con
    // este medio ancho, la sombra lo usa en surfaceTop y los mapas
    // fijos mantienen la vegetación y las patrullas fuera de él.
    const ROAD_HALF_WIDTH = 15;
    const missions =
      typeof module === 'object' && module.exports
        ? require('./toy-missions.js')
        : root.ToyMissions;
    const { start, finish, camps, route } = map?.layout || missions.layout;
    // One open route: safe departure, distant camps, then a separate extraction pad.
    const routes = map?.routes || [route];
    const escortConfig =
      map?.rules ||
      (typeof module === 'object' && module.exports
        ? require('./escort-config.js')
        : root.ToyEscortConfig);
    const pads = [
      { ...escortConfig.B, final: false, rescue: true, label: 'B' },
      { ...start, final: false, label: 'A' },
      { ...finish, final: true, label: 'C' },
    ];
    const glyphs = {
      A: ['01110', '10001', '11111', '10001', '10001'],
      B: ['11110', '10001', '11110', '10001', '11110'],
      C: ['01111', '10000', '10000', '10000', '01111'],
    };
    const padMarks = pads.flatMap((p) =>
      glyphs[p.label].flatMap((row, j) =>
        [...row].flatMap((bit, i) =>
          bit === '1'
            ? [{ x: p.x + (i - 2) * 1.2, z: p.z + (2 - j) * 1.2 }]
            : [],
        ),
      ),
    );
    const clearings = [
      [start.x, start.z, 23],
      [finish.x, finish.z, 23],
      ...camps.map(([x, z]) => [x, z + 5, 24]),
    ];
    function smooth(route) {
      for (let pass = 0; pass < 2; pass++) {
        const next = [route[0]];
        for (let i = 0; i < route.length - 1; i++) {
          const a = route[i],
            b = route[i + 1];
          next.push(
            [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
            [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
          );
        }
        next.push(route[route.length - 1]);
        route = next;
      }
      return route;
    }
    const trails = map ? routes : routes.map(smooth);    const segments = trails.flatMap((route) =>
      route.slice(1).map((b, i) => [route[i], b]),
    );
    // Tramos con su caja envolvente: trailDistance es el bucle caliente
    // de la generación del mundo (se llama ~26 000 veces al crear las
    // alturas) y antes recorría todos los tramos con Math.hypot. Con la
    // caja se descartan los lejanos sin trigonometría y la distancia se
    // compara al cuadrado; solo se hace la raíz al final.
    const segData = segments.map(([[ax, az], [bx, bz]]) => {
      const dx = bx - ax,
        dz = bz - az;
      return {
        ax,
        az,
        dx,
        dz,
        len2: dx * dx + dz * dz,
        minX: Math.min(ax, bx),
        maxX: Math.max(ax, bx),
        minZ: Math.min(az, bz),
        maxZ: Math.max(az, bz),
      };
    });
    function trailDistance(x, z) {
      let best2 = Infinity;
      for (const s of segData) {
        let dx = 0,
          dz = 0;
        if (x < s.minX) dx = s.minX - x;
        else if (x > s.maxX) dx = x - s.maxX;
        if (z < s.minZ) dz = s.minZ - z;
        else if (z > s.maxZ) dz = z - s.maxZ;
        if (dx * dx + dz * dz >= best2) continue;
        const t =
          s.len2 === 0
            ? 0
            : Math.max(
                0,
                Math.min(1, ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.len2),
              ),
          ex = x - (s.ax + t * s.dx),
          ez = z - (s.az + t * s.dz),
          d2 = ex * ex + ez * ez;
        if (d2 < best2) best2 = d2;
      }
      return Math.sqrt(best2);
    }
    function rawHeight(x, z) {
      // El terreno es llano bajo todo el ancho del camino y 10 u más
      // de arcén a cada lado (25 u desde la línea central): ahí van
      // las patrullas que flanquean la ruta (±19 u) y `canTravel`
      // las necesita en suelo llano. A partir de ahí sube suavemente.
      let distance = trailDistance(x, z) - (ROAD_HALF_WIDTH + 10);
      for (const [cx, cz, radius] of clearings)
        distance = Math.min(distance, Math.hypot(x - cx, z - cz) - radius);
      // Valle alpino: la ladera sube más lejos y más suave que en los
      // otros mapas (rampa de 28 u en vez de 16), para que las colinas
      // no se levanten como muros junto al camino; y el borde del
      // mapa sube hasta +20 u, como paredes del valle.
      const ramp = map?.scenario === 'Alpine' ? 28 : 16;
      const t = Math.max(0, Math.min(1, distance / ramp));
      // Relieve de cada mapa fijo (src/original-maps.js): cada mapa
      // tiene su amplitud y frecuencias; sin mapa, el relieve clásico.
      const terrain = map?.terrain;
      const ridge = terrain
        ? terrain.amp +
          4 *
            Math.sin(x / terrain.freqX + terrain.phase) *
            Math.cos(z / terrain.freqZ + terrain.phase)
        : 22 + 4 * Math.sin(x / 31 + (map?.seed || 0)) * Math.cos(z / 37);
      let h = t * t * (3 - 2 * t) * ridge;
      if (map?.scenario === 'Alpine') {
        const edge = Math.max(Math.abs(x), Math.abs(z)),
          w = Math.max(0, Math.min(1, (edge - 300) / 150));
        h += w * w * 20;
      }
      return h;
    }
    const heights = new Float32Array(COUNT * COUNT);
    for (let z = 0; z < COUNT; z++)
      for (let x = 0; x < COUNT; x++)
        heights[z * COUNT + x] = rawHeight(x * STEP - LIMIT, z * STEP - LIMIT);
    function height(x, z) {
      const gx = (Math.max(-LIMIT, Math.min(LIMIT, x)) + LIMIT) / STEP,
        gz = (Math.max(-LIMIT, Math.min(LIMIT, z)) + LIMIT) / STEP;
      const ix = Math.min(COUNT - 2, Math.floor(gx)),
        iz = Math.min(COUNT - 2, Math.floor(gz)),
        u = gx - ix,
        v = gz - iz;
      const a = heights[iz * COUNT + ix],
        b = heights[iz * COUNT + ix + 1],
        c = heights[(iz + 1) * COUNT + ix + 1],
        d = heights[(iz + 1) * COUNT + ix];
      return u >= v
        ? a + (b - a) * u + (c - b) * v
        : a + (c - d) * u + (d - a) * v;
    }
    function mesh() {
      // Malla prealocada: antes se construía con push(...p, ...n) por
      // vértice (~1,8 millones de push en un mapa de 640 u), que era la
      // mitad del coste de entrar en una misión. El contenido es el
      // mismo: mismos triángulos, mismas normales.
      const cells = (LIMIT * 2) / STEP,
        data = new Float32Array(cells * cells * 36);
      let at = 0;
      for (let z = -LIMIT; z < LIMIT; z += STEP)
        for (let x = -LIMIT; x < LIMIT; x += STEP) {
          const a = [x, height(x, z), z],
            b = [x + STEP, height(x + STEP, z), z],
            c = [x + STEP, height(x + STEP, z + STEP), z + STEP],
            d = [x, height(x, z + STEP), z + STEP];
          for (const tri of [
            [a, c, b],
            [a, d, c],
          ]) {
            const u = tri[1].map((v, i) => v - tri[0][i]),
              v = tri[2].map((v, i) => v - tri[0][i]);
            const n = [
                u[1] * v[2] - u[2] * v[1],
                u[2] * v[0] - u[0] * v[2],
                u[0] * v[1] - u[1] * v[0],
              ],
              length = Math.hypot(...n);
            for (const p of tri) {
              data[at++] = p[0];
              data[at++] = p[1];
              data[at++] = p[2];
              data[at++] = n[0] / length;
              data[at++] = n[1] / length;
              data[at++] = n[2] / length;
            }
          }
        }
      return data;
    }
    const roads = [];
    for (const [[ax, az], [bx, bz]] of segments) {
      const length = Math.hypot(bx - ax, bz - az),
        count = Math.ceil(length / 6);
      for (let i = 0; i < count; i++)
        roads.push({
          x: ax + ((bx - ax) * (i + 0.5)) / count,
          z: az + ((bz - az) * (i + 0.5)) / count,
          y: 0.1,
          yaw: Math.atan2(bx - ax, bz - az),
          length: length / count / 2 + 0.25,
          halfWidth: ROAD_HALF_WIDTH,
        });
    }
    function canTravel(x, z, radius = 0) {
      return [
        [0, 0],
        [radius, 0],
        [-radius, 0],
        [0, radius],
        [0, -radius],
      ].every(
        ([dx, dz]) =>
          Math.abs(x + dx) < LIMIT - 6 &&
          Math.abs(z + dz) < LIMIT - 6 &&
          height(x + dx, z + dz) < 2,
      );
    }
    // Household props share footprints and geometry between both renderers.
    // El motor de mapas puede mover los puntos de interés; sin mapa,
    // quedan en su sitio clásico.
    const landmarks = (map?.landmarks || [
      { kind: 'planter', x: 34, z: 26, radius: 21, yaw: 0 },
      { kind: 'watering', x: -45, z: -33, radius: 10, yaw: 0 },
      { kind: 'bench', x: 70, z: -48, radius: 12, yaw: 0 },
    ]).map((p) => ({ ...p }));
    const yard = [];
    let offset = { x: 0, y: 0, z: 0 };
    const placements = new Map();
    // Las piezas del patio se dibujan en estas coordenadas fijas y
    // `placeLandmark` las desplaza con `offset`. El motor de mapas
    // puede proponer otra posición inicial, pero el desplazamiento
    // siempre se mide contra la base fija: si se midiera contra la
    // posición propuesta, un punto ya libre quedaría con offset 0 y
    // las piezas se dibujarían en el sitio viejo, sobre la ruta.
    const landmarkHome = [
      { x: 34, z: 26 },
      { x: -45, z: -33 },
      { x: 70, z: -48 },
    ];
    function placeLandmark(index) {
      if (!map) return;
      if (placements.has(index)) {
        offset = placements.get(index);
        return;
      }
      const p = landmarks[index],
        home = landmarkHome[index],
        original = { ...p };
      const free = (x, z) =>
        Math.abs(x) < LIMIT - 65 &&
        Math.abs(z) < LIMIT - 65 &&
        trailDistance(x, z) > p.radius + 20 &&
        clearings.every(
          ([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r + p.radius + 8,
        );
      search: for (let radius = 0; radius <= 240; radius += 12)
        for (let i = 0; i < 16; i++) {
          const x = original.x + Math.cos((i * Math.PI) / 8) * radius,
            z = original.z + Math.sin((i * Math.PI) / 8) * radius;
          if (free(x, z)) {
            p.x = x;
            p.z = z;
            break search;
          }
        }
      offset = {
        x: p.x - home.x,
        z: p.z - home.z,
        y: height(p.x, p.z) - height(home.x, home.z),
      };
      placements.set(index, offset);
    }
    function part(kind, x, y, z, sx, sy, sz, color, yaw = 0) {
      yard.push({
        kind,
        x: x + offset.x,
        y: y + offset.y,
        z: z + offset.z,
        sx,
        sy,
        sz,
        color,
        yaw,
      });
    }
    const wood = [0.43, 0.29, 0.17],
      clay = [0.65, 0.29, 0.16],
      leaf = [0.24, 0.39, 0.12];
    // Individual weathered fence boards and horizontal rails surround the lawn.
    // En el valle alpino no hay valla de jardín: el borde son las montañas.
    if (!alpine) {
    for (let q = -LIMIT + 4; q <= LIMIT - 4; q += 8)
      for (const side of [-1, 1]) {
        if (side < 0 || Math.abs(q) > 112)
          part('box', q, 10, side * LIMIT, 3.8, 10, 0.7, [
            0.46 + (q % 3) * 0.015,
            0.33,
            0.21,
          ]);
        part('box', side * LIMIT, 10, q, 0.7, 10, 3.8, wood);
      }
    for (const side of [-1, 1])
      for (const y of [5, 14]) {
        for (const x of [-(LIMIT + 112) / 2, (LIMIT + 112) / 2])
          part(
            'box',
            x,
            y,
            side * (LIMIT - 2),
            (LIMIT - 112) / 2,
            0.6,
            0.8,
            wood,
          );
        if (side < 0)
          part('box', 0, y, side * (LIMIT - 2), 112, 0.6, 0.8, wood);
        part('box', side * (LIMIT - 2), y, 0, 0.8, 0.6, LIMIT, wood);
      }
    }
    // House wall, back door, windows and a paved terrace at the far end.
    if (!alpine) {
    const houseStart = yard.length;
    part('box', 0, 24, 214, 110, 24, 12, [0.76, 0.7, 0.58]);
    part('box', 0, 2, 180, 104, 2, 18, [0.6, 0.59, 0.53]);
    for (let x = -96; x <= 96; x += 16)
      part('box', x, 4.03, 180, 0.1, 0.025, 18, [0.4, 0.4, 0.36]);
    for (const z of [190, 178, 166])
      part('box', 0, 4.04, z, 104, 0.025, 0.1, [0.4, 0.4, 0.36]);
    part('box', -12, 17, 201.5, 10, 17, 0.35, [0.31, 0.37, 0.32]);
    part('box', -12, 23, 201, 7, 9, 0.15, [0.31, 0.48, 0.49]);
    for (const x of [-60, 48]) {
      part('box', x, 28, 201, 18, 12, 0.5, [0.89, 0.86, 0.76]);
      part('box', x, 28, 200.3, 15, 9, 0.2, [0.32, 0.48, 0.5]);
      part('box', x, 28, 199.9, 0.5, 9, 0.2, [0.85, 0.83, 0.73]);
      part('box', x, 28, 199.8, 15, 0.5, 0.2, [0.85, 0.83, 0.73]);
    }
    part('box', 0, 47, 200, 112, 1.1, 2, [0.39, 0.34, 0.28]);
    for (const p of yard.slice(houseStart)) p.z += LIMIT - 200;
    }
    // Torre de guardia verde: patas finas, plataforma pequeña y
    // tejado en punta con bandera, para que desde la cámara cenital
    // se lea como torre y no como una mesa de techo plano que tapa
    // el helipuerto. `draw` es `part` para el punto de interés (con
    // su offset) o `fixedPart` para las torres fijas de la base.
    function towerAt(draw, x, z) {
      const y = height(x, z);
      for (const [lx, lz] of [
        [-2.2, -2.2],
        [2.2, -2.2],
        [-2.2, 2.2],
        [2.2, 2.2],
      ])
        draw('box', x + lx, y + 4, z + lz, 0.55, 8, 0.55, wood);
      draw('box', x, y + 8.5, z, 6, 1, 6, wood);
      draw('box', x, y + 10.5, z, 6, 0.5, 0.5, wood);
      draw('box', x, y + 10.5, z, 0.5, 0.5, 6, wood);
      draw('box', x, y + 12.5, z, 6.5, 1, 6.5, [0.3, 0.35, 0.25]);
      draw('sphere', x, y + 14.5, z, 3, 2.2, 3, [0.24, 0.3, 0.2]);
      draw('box', x, y + 17, z, 0.25, 3, 0.25, [0.2, 0.2, 0.18]);
      draw('box', x + 1, y + 17.8, z, 2, 1.1, 0.15, [0.2, 0.72, 0.2]);
    }
    // Piezas fijas alpinas: se escriben directas en `yard`, sin el
    // `offset` de los puntos de interés, para que no se desplacen.
    function fixedPart(kind, x, y, z, sx, sy, sz, color, yaw = 0) {
      yard.push({ kind, x, y, z, sx, sy, sz, color, yaw });
    }
    // Rectangular terracotta planter: rim, soil and low leafy plants.
    // En el valle alpino, la caja verde de suministros de plástico:
    // más grande y con una segunda caja al lado, para que destaque
    // junto al puesto (B) sin tapar la ruta.
    placeLandmark(0);
    let h = height(34, 26);
    if (alpine) {
      part('box', 34, h + 1.8, 26, 6, 3.6, 6, [0.13, 0.42, 0.14]);
      part('box', 34, h + 3.9, 26, 6.5, 0.7, 6.5, [0.18, 0.52, 0.18]);
      part('box', 34, h + 4.3, 26, 0.7, 0.3, 6.5, [0.1, 0.1, 0.1]);
      part('box', 34, h + 4.3, 26, 6.5, 0.3, 0.7, [0.1, 0.1, 0.1]);
      part('box', 41, h + 1.2, 31, 3.5, 2.4, 3.5, [0.11, 0.36, 0.12]);
      part('box', 41, h + 2.6, 31, 3.8, 0.5, 3.8, [0.16, 0.48, 0.16]);
    } else {
    part('box', 34, h + 3, 26, 15, 3, 7, clay);
    part('box', 34, h + 6, 26, 16, 0.8, 8, [0.73, 0.37, 0.22]);
    part('box', 34, h + 6.85, 26, 14, 0.08, 6, [0.2, 0.16, 0.1]);
    for (let i = 0; i < 5; i++) {
      const x = 23 + i * 5;
      part('sphere', x, h + 8, 26, 3, 2.8, 3, leaf);
      part('sphere', x - 1, h + 10, 25, 1.8, 1.7, 1.8, [0.37, 0.49, 0.18]);
    }
    }
    // Galvanized watering can with raised loop handle and a long spout.
    // En el valle alpino, el portal brillante: halo en el suelo,
    // círculo luminoso, orbe en 3 capas (exterior, medio y núcleo
    // casi blanco) y una columna de luz alta, para que brille de
    // verdad y se vea desde lejos como faro al final del camino.
    // Solo decoración: no cambia las reglas (la entrega sigue en C).
    placeLandmark(1);
    h = height(-45, -33);
    if (alpine) {
      part('sphere', -45, h + 0.4, -33, 14, 0.3, 14, [0.98, 0.88, 0.55]);
      part('sphere', -45, h + 0.4, -33, 7, 0.35, 7, [0.95, 0.8, 0.35]);
      part('sphere', -45, h + 9, -33, 6.5, 7.5, 6.5, [1.0, 0.55, 0.1]);
      part('sphere', -45, h + 9, -33, 5, 6, 5, [1.0, 0.75, 0.25]);
      part('sphere', -45, h + 9, -33, 3.2, 4.2, 3.2, [1.0, 0.95, 0.62]);
      part('sphere', -45, h + 22, -33, 2.5, 18, 2.5, [1.0, 0.9, 0.55]);
    } else {
    part('rounded', -45, h + 4, -33, 5, 4, 4, [0.44, 0.54, 0.48]);
    part('box', -45, h + 8.2, -33, 4, 0.4, 3, [0.62, 0.67, 0.58]);
    for (const x of [-49, -41])
      part('box', x, h + 11, -33, 0.45, 3, 0.45, [0.38, 0.46, 0.4]);
    part('box', -45, h + 14, -33, 4, 0.45, 0.45, [0.38, 0.46, 0.4]);
    part('box', -39, h + 4, -29, 0.65, 0.65, 5, [0.48, 0.56, 0.48], 0.8);
    part('sphere', -35, h + 4, -25, 1.6, 1, 1.6, [0.61, 0.64, 0.54]);
    }
    // Garden bench with separate wooden slats and dark metal legs.
    // En el valle alpino, una torre de guardia junto a la base.
    placeLandmark(2);
    h = height(70, -48);
    if (alpine) {
      towerAt(part, 70, -48);
    } else {
    for (const x of [62, 78])
      for (const z of [-51, -45])
        part('box', x, h + 3, z, 0.6, 3, 0.6, [0.19, 0.23, 0.2]);
    for (const z of [-51, -48, -45])
      part('box', 70, h + 6.4, z, 11, 0.6, 1.2, [0.55, 0.37, 0.2]);
    for (const y of [9, 12])
      part('box', 70, h + y, -52, 11, 1, 0.5, [0.52, 0.34, 0.18]);
    }
    // A hose winds beside the can; stone slabs break up the dirt path.
    if (!alpine) {
    placeLandmark(1);
    for (let i = 0; i < 36; i++) {
      const a = i * 0.18,
        b = (i + 1) * 0.18,
        x = -45 + Math.cos(a) * 16,
        z = -33 + Math.sin(a) * 14,
        nx = -45 + Math.cos(b) * 16,
        nz = -33 + Math.sin(b) * 14;
      part(
        'box',
        (x + nx) / 2,
        height(x, z) + 0.3,
        (z + nz) / 2,
        0.4,
        0.3,
        Math.hypot(nx - x, nz - z) / 2 + 0.15,
        [0.19, 0.31, 0.19],
        Math.atan2(nx - x, nz - z),
      );
    }
    }
    if (alpine) {
      // Las otras 3 torres de guardia de la base de salida (la 4ª es
      // el punto de interés `tower`): a ~50 u de A, fuera del camino
      // y sin tapar el helipuerto desde la cámara.
      for (const [tx, tz] of [
        [40, 28],
        [12, -50],
        [-46, -22],
      ])
        towerAt(fixedPart, tx, tz);
    }
    // Deterministic natural shrubs replace the scattered toy building blocks.
    // Con mapa del motor, la vegetación viene ya generada (posiciones
    // con semilla, fuera de pads y rutas); sin mapa, la clásica.
    const shrubs = map?.scenery
      ? map.scenery.shrubs.map((s) => ({ ...s }))
      : [];
    if (!map?.scenery)
      for (let i = 0; i < (map ? 230 : 90); i++) {
        const x = Math.sin(i * 7.12 + (map?.seed || 0)) * (LIMIT - 18),
          z = Math.cos(i * 11.79 + (map?.seed || 0)) * (LIMIT - 20);
        if (
          Math.hypot(x, z) < 24 ||
          clearings.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + 7) ||
          !clearOfLandmarks(x, z, 7) ||
          trailDistance(x, z) < ROAD_HALF_WIDTH + 6 ||
          z > LIMIT - 44
        )
          continue;
        shrubs.push({ t: 'shrub', x, z, s: 2 + (i % 4) * 0.6 });
      }
    const rocks = map?.scenery ? map.scenery.rocks.map((r) => ({ ...r })) : [];
    if (!map?.scenery)
      for (let i = 0; i < (map ? 165 : 65); i++) {
        const x = Math.sin(i * 12.989 + (map?.seed || 0)) * (LIMIT - 19),
          z = Math.cos(i * 7.713 + (map?.seed || 0)) * (LIMIT - 19);
        if (
          Math.hypot(x, z) < 24 ||
          trailDistance(x, z) < ROAD_HALF_WIDTH + 6 ||
          clearings.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + 5) ||
          landmarks.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + 5)
        )
          continue;
        rocks.push({ x, z, s: 1.1 + (i % 4) * 0.4 });
      }
    // Montañas del valle alpino (solo la Misión 1): rocas grandes
    // como borde del mapa; las dibuja el renderizador con cima nevada.
    const mountains = map?.scenery?.mountains
      ? map.scenery.mountains.map((m) => ({ ...m }))
      : [];
    function clearOfLandmarks(x, z, margin = 8) {
      return (
        z < LIMIT - 44 - margin &&
        landmarks.every((p) => Math.hypot(x - p.x, z - p.z) > p.radius + margin)
      );
    }
    const api = {
      limit: LIMIT,
      seed: map?.seed,
      alpine,
      height,
      pads,
      padMarks,
      routes,
      clearings,
      trailDistance,
      canTravel,
      mesh,
      roads,
      roadHalfWidth: ROAD_HALF_WIDTH,
      rocks,
      mountains,
      landmarks,
      yard,
      shrubs,
      clearOfLandmarks,
    };
    return api;
  }
  const api = Object.assign(create(), { create });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyWorld = api;
})(globalThis);
