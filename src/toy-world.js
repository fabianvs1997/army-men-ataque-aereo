/* Shared deterministic terrain for WebGL and the Canvas fallback. */
(function (root) {
  'use strict';
  const LIMIT = 200,
    STEP = 4,
    COUNT = 101;
  // Connected valley floor: a winding outer trail with a rescue spur.
  const routes = [
    [
      [0, 0],
      [0, -30],
      [40, -75],
      [120, -120],
      [155, -50],
      [140, 20],
      [110, 55],
      [85, 65],
      [60, 70],
      [10, 100],
      [-70, 110],
      [-135, 100],
      [-150, 20],
      [-130, -60],
      [-90, -80],
      [-35, -95],
      [0, -30],
    ],
    [
      [0, 0],
      [-20, 20],
      [-48, 52],
      [-55, 60],
      [-70, 110],
    ],
  ];
  const clearings = [
    [0, 0, 23],
    [-48, 58, 24],
    [60, 76, 23],
    [85, 71, 23],
    [-90, -74, 23],
    [-70, 116, 23],
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
  const trails = routes.map(smooth);
  const segments = trails.flatMap((route) =>
    route.slice(1).map((b, i) => [route[i], b]),
  );
  function trailDistance(x, z) {
    let distance = Infinity;
    for (const [[ax, az], [bx, bz]] of segments) {
      const dx = bx - ax,
        dz = bz - az;
      const t = Math.max(
        0,
        Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)),
      );
      distance = Math.min(
        distance,
        Math.hypot(x - ax - t * dx, z - az - t * dz),
      );
    }
    return distance;
  }
  function rawHeight(x, z) {
    let distance = trailDistance(x, z) - 14;
    for (const [cx, cz, radius] of clearings)
      distance = Math.min(distance, Math.hypot(x - cx, z - cz) - radius);
    const t = Math.max(0, Math.min(1, distance / 16));
    const ridge = 22 + 4 * Math.sin(x / 31) * Math.cos(z / 37);
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
    const data = [];
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
          for (const p of tri) data.push(...p, ...n.map((v) => v / length));
        }
      }
    return new Float32Array(data);
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
        Math.abs(x + dx) < 194 &&
        Math.abs(z + dz) < 194 &&
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
  function part(kind, x, y, z, sx, sy, sz, color, yaw = 0) {
    yard.push({ kind, x, y, z, sx, sy, sz, color, yaw });
  }
  const wood = [0.43, 0.29, 0.17],
    clay = [0.65, 0.29, 0.16],
    leaf = [0.24, 0.39, 0.12];
  // Individual weathered fence boards and horizontal rails surround the lawn.
  for (let q = -196; q <= 196; q += 8)
    for (const side of [-1, 1]) {
      if (side < 0 || Math.abs(q) > 112)
        part('box', q, 10, side * 200, 3.8, 10, 0.7, [
          0.46 + (q % 3) * 0.015,
          0.33,
          0.21,
        ]);
      part('box', side * 200, 10, q, 0.7, 10, 3.8, wood);
    }
  for (const side of [-1, 1])
    for (const y of [5, 14]) {
      for (const x of [-156, 156])
        part('box', x, y, side * 198, 44, 0.6, 0.8, wood);
      if (side < 0) part('box', 0, y, side * 198, 112, 0.6, 0.8, wood);
      part('box', side * 198, y, 0, 0.8, 0.6, 200, wood);
    }
  // House wall, back door, windows and a paved terrace at the far end.
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
  // Rectangular terracotta planter: rim, soil and low leafy plants.
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
  h = height(-45, -33);
  part('rounded', -45, h + 4, -33, 5, 4, 4, [0.44, 0.54, 0.48]);
  part('box', -45, h + 8.2, -33, 4, 0.4, 3, [0.62, 0.67, 0.58]);
  for (const x of [-49, -41])
    part('box', x, h + 11, -33, 0.45, 3, 0.45, [0.38, 0.46, 0.4]);
  part('box', -45, h + 14, -33, 4, 0.45, 0.45, [0.38, 0.46, 0.4]);
  part('box', -39, h + 4, -29, 0.65, 0.65, 5, [0.48, 0.56, 0.48], 0.8);
  part('sphere', -35, h + 4, -25, 1.6, 1, 1.6, [0.61, 0.64, 0.54]);
  // Garden bench with separate wooden slats and dark metal legs.
  h = height(70, -48);
  for (const x of [62, 78])
    for (const z of [-51, -45])
      part('box', x, h + 3, z, 0.6, 3, 0.6, [0.19, 0.23, 0.2]);
  for (const z of [-51, -48, -45])
    part('box', 70, h + 6.4, z, 11, 0.6, 1.2, [0.55, 0.37, 0.2]);
  for (const y of [9, 12])
    part('box', 70, h + y, -52, 11, 1, 0.5, [0.52, 0.34, 0.18]);
  // A hose winds beside the can; stone slabs break up the dirt path.
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
  for (let i = 0; i < 90; i++) {
    const x = Math.sin(i * 7.12) * 182,
      z = Math.cos(i * 11.79) * 180;
    if (
      Math.hypot(x, z) < 24 ||
      !clearOfLandmarks(x, z, 7) ||
      trailDistance(x, z) < 18 ||
      z > 156
    )
      continue;
    shrubs.push({ t: 'shrub', x, z, s: 2 + (i % 4) * 0.6 });
  }
  const rocks = [];
  for (let i = 0; i < 65; i++) {
    const x = Math.sin(i * 12.989) * 181,
      z = Math.cos(i * 7.713) * 181;
    if (
      Math.hypot(x, z) < 24 ||
      trailDistance(x, z) < 18 ||
      landmarks.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + 5)
    )
      continue;
    rocks.push({ x, z, s: 1.1 + (i % 4) * 0.4 });
  }
  function clearOfLandmarks(x, z, margin = 8) {
    return (
      z < 156 - margin &&
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
            (x * Math.sin(cam.yaw || 0) + z * Math.cos(cam.yaw || 0)) * 0.766 -
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
      let z = Math.max(-200, Math.floor((cam.z - range) / step) * step);
      z < Math.min(200, cam.z + range);
      z += step
    )
      for (
        let x = Math.max(-200, Math.floor((cam.x - range) / step) * step);
        x < Math.min(200, cam.x + range);
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
    const pad = (corners, color, y) =>
      add(
        corners.map(([x, z]) => [x, y, z]),
        color,
      );
    pad(
      [
        [-7, -7],
        [7, -7],
        [7, 7],
        [-7, 7],
      ],
      '#566449',
      0.27,
    );
    for (const side of [-1, 1])
      pad(
        [
          [side * 2 - 0.35, -3],
          [side * 2 + 0.35, -3],
          [side * 2 + 0.35, 3],
          [side * 2 - 0.35, 3],
        ],
        '#dfd39e',
        0.36,
      );
    pad(
      [
        [-2, -0.35],
        [2, -0.35],
        [2, 0.35],
        [-2, 0.35],
      ],
      '#dfd39e',
      0.36,
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
    height,
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
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyWorld = api;
})(globalThis);
