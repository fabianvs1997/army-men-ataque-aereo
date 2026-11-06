/* Shared deterministic terrain for WebGL and the Canvas fallback. */
(function (root) {
  'use strict';
  function create(map) {
    const LIMIT = map?.limit || 200,
      STEP = 4,
      COUNT = (LIMIT * 2) / STEP + 1;
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
    const trails = map ? routes : routes.map(smooth);
    const segments = trails.flatMap((route) =>
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
      let distance = trailDistance(x, z) - 14;
      for (const [cx, cz, radius] of clearings)
        distance = Math.min(distance, Math.hypot(x - cx, z - cz) - radius);
      const t = Math.max(0, Math.min(1, distance / 16));
      const ridge =
        22 + 4 * Math.sin(x / 31 + (map?.seed || 0)) * Math.cos(z / 37);
      return t * t * (3 - 2 * t) * ridge;
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
    const landmarks = [
      { kind: 'planter', x: 34, z: 26, radius: 21, yaw: 0 },
      { kind: 'watering', x: -45, z: -33, radius: 10, yaw: 0 },
      { kind: 'bench', x: 70, z: -48, radius: 12, yaw: 0 },
    ];
    const yard = [];
    let offset = { x: 0, y: 0, z: 0 };
    const placements = new Map();
    function placeLandmark(index) {
      if (!map) return;
      if (placements.has(index)) {
        offset = placements.get(index);
        return;
      }
      const p = landmarks[index],
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
        x: p.x - original.x,
        z: p.z - original.z,
        y: height(p.x, p.z) - height(original.x, original.z),
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
    // House wall, back door, windows and a paved terrace at the far end.
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
    // Rectangular terracotta planter: rim, soil and low leafy plants.
    placeLandmark(0);
    let h = height(34, 26);
    part('box', 34, h + 3, 26, 15, 3, 7, clay);
    part('box', 34, h + 6, 26, 16, 0.8, 8, [0.73, 0.37, 0.22]);
    part('box', 34, h + 6.85, 26, 14, 0.08, 6, [0.2, 0.16, 0.1]);
    for (let i = 0; i < 5; i++) {
      const x = 23 + i * 5;
      part('sphere', x, h + 8, 26, 3, 2.8, 3, leaf);
      part('sphere', x - 1, h + 10, 25, 1.8, 1.7, 1.8, [0.37, 0.49, 0.18]);
    }
    // Galvanized watering can with raised loop handle and a long spout.
    placeLandmark(1);
    h = height(-45, -33);
    part('rounded', -45, h + 4, -33, 5, 4, 4, [0.44, 0.54, 0.48]);
    part('box', -45, h + 8.2, -33, 4, 0.4, 3, [0.62, 0.67, 0.58]);
    for (const x of [-49, -41])
      part('box', x, h + 11, -33, 0.45, 3, 0.45, [0.38, 0.46, 0.4]);
    part('box', -45, h + 14, -33, 4, 0.45, 0.45, [0.38, 0.46, 0.4]);
    part('box', -39, h + 4, -29, 0.65, 0.65, 5, [0.48, 0.56, 0.48], 0.8);
    part('sphere', -35, h + 4, -25, 1.6, 1, 1.6, [0.61, 0.64, 0.54]);
    // Garden bench with separate wooden slats and dark metal legs.
    placeLandmark(2);
    h = height(70, -48);
    for (const x of [62, 78])
      for (const z of [-51, -45])
        part('box', x, h + 3, z, 0.6, 3, 0.6, [0.19, 0.23, 0.2]);
    for (const z of [-51, -48, -45])
      part('box', 70, h + 6.4, z, 11, 0.6, 1.2, [0.55, 0.37, 0.2]);
    for (const y of [9, 12])
      part('box', 70, h + y, -52, 11, 1, 0.5, [0.52, 0.34, 0.18]);
    // A hose winds beside the can; stone slabs break up the dirt path.
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
    // Deterministic natural shrubs replace the scattered toy building blocks.
    const shrubs = [];
    for (let i = 0; i < (map ? 230 : 90); i++) {
      const x = Math.sin(i * 7.12 + (map?.seed || 0)) * (LIMIT - 18),
        z = Math.cos(i * 11.79 + (map?.seed || 0)) * (LIMIT - 20);
      if (
        Math.hypot(x, z) < 24 ||
        clearings.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + 7) ||
        !clearOfLandmarks(x, z, 7) ||
        trailDistance(x, z) < 18 ||
        z > LIMIT - 44
      )
        continue;
      shrubs.push({ t: 'shrub', x, z, s: 2 + (i % 4) * 0.6 });
    }
    const rocks = [];
    for (let i = 0; i < (map ? 165 : 65); i++) {
      const x = Math.sin(i * 12.989 + (map?.seed || 0)) * (LIMIT - 19),
        z = Math.cos(i * 7.713 + (map?.seed || 0)) * (LIMIT - 19);
      if (
        Math.hypot(x, z) < 24 ||
        trailDistance(x, z) < 18 ||
        clearings.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + 5) ||
        landmarks.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + 5)
      )
        continue;
      rocks.push({ x, z, s: 1.1 + (i % 4) * 0.4 });
    }
    function clearOfLandmarks(x, z, margin = 8) {
      return (
        z < LIMIT - 44 - margin &&
        landmarks.every((p) => Math.hypot(x - p.x, z - p.z) > p.radius + margin)
      );
    }
    // A lightweight terrain view for devices without WebGL. Same height field and roads.
    function grassColor(x, z) {
      const patch =
          Math.sin(x * 0.047 + Math.sin(z * 0.031)) * Math.cos(z * 0.061),
        h = height(x, z),
        t = Math.min(1, h / 18),
        shade = 8 * patch;
      const color = `rgb(${Math.round(99 - 60 * t + shade)},${Math.round(123 - 64 * t + shade)},${Math.round(61 - 31 * t + shade)})`;
      return color;
    }

    function drawGround(ctx, project, cam, W, H, F) {
      const range = (Math.hypot(W, H) / F) * 0.65 + 50,
        faces = [],
        step = STEP;
      const add = (vertices, color, terrain = false) => {
        const points = vertices.map((p) => project(...p));
        if (points.some((p) => !p)) return;
        const depth =
          vertices.reduce(
            (d, [x, y, z]) =>
              d +
              (x * Math.sin(cam.yaw || 0) + z * Math.cos(cam.yaw || 0)) *
                0.766 -
              y * 0.643,
            0,
          ) / vertices.length;
        faces.push({
          points,
          color,
          depth:
            depth + (terrain && vertices.every((p) => p[1] < 0.2) ? 1000 : 0),
        });
      };
      for (
        let z = Math.max(-LIMIT, Math.floor((cam.z - range) / step) * step);
        z < Math.min(LIMIT, cam.z + range);
        z += step
      )
        for (
          let x = Math.max(-LIMIT, Math.floor((cam.x - range) / step) * step);
          x < Math.min(LIMIT, cam.x + range);
          x += step
        ) {
          const a = [x, height(x, z), z],
            b = [x + step, height(x + step, z), z],
            c = [x + step, height(x + step, z + step), z + step],
            d = [x, height(x, z + step), z + step];
          add([a, c, b], grassColor(x + step * 0.66, z + step * 0.33), true);
          add([a, d, c], grassColor(x + step * 0.33, z + step * 0.66), true);
        }
      for (const road of roads) {
        if (Math.hypot(road.x - cam.x, road.z - cam.z) > range) continue;
        const c = Math.cos(road.yaw),
          s = Math.sin(road.yaw);
        add(
          [
            [-5, -road.length],
            [5, -road.length],
            [5, road.length],
            [-5, road.length],
          ].map(([x, z]) => [
            road.x + x * c + z * s,
            0.12,
            road.z - x * s + z * c,
          ]),
          '#aa9162',
        );
      }
      for (const site of pads) {
        const pad = (corners, color, y) =>
          add(
            corners.map(([x, z]) => [x + site.x, y, z + site.z]),
            color,
          );
        pad(
          [
            [-8, -8],
            [8, -8],
            [8, 8],
            [-8, 8],
          ],
          site.rescue ? '#f5ad40' : site.final ? '#93e29b' : '#dfd39e',
          0.24,
        );
        pad(
          [
            [-7, -7],
            [7, -7],
            [7, 7],
            [-7, 7],
          ],
          site.final ? '#2a6547' : '#566449',
          0.27,
        );
      }
      for (const p of padMarks)
        add(
          [
            [p.x - 0.55, 0.36, p.z - 0.55],
            [p.x + 0.55, 0.36, p.z - 0.55],
            [p.x + 0.55, 0.36, p.z + 0.55],
            [p.x - 0.55, 0.36, p.z + 0.55],
          ],
          '#dfd39e',
        );
      faces.sort((a, b) => b.depth - a.depth);
      if (ctx.save) ctx.save();
      for (const f of faces) {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        f.points.forEach((p, i) =>
          i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
        );
        ctx.closePath();
        ctx.fill();
        if (ctx.stroke) {
          ctx.strokeStyle = f.color;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
      if (ctx.restore) ctx.restore();
    }
    const api = {
      limit: LIMIT,
      seed: map?.seed,
      height,
      pads,
      padMarks,
      routes,
      clearings,
      trailDistance,
      canTravel,
      mesh,
      roads,
      rocks,
      landmarks,
      yard,
      shrubs,
      clearOfLandmarks,
      drawGround,
    };
    return api;
  }
  const api = Object.assign(create(), { create });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyWorld = api;
})(globalThis);
