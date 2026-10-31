(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ToyDebris = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_PIECES = 320;
  const tan = [0.76, 0.61, 0.36],
    dark = [0.39, 0.31, 0.17];
  // [local x, y, z, half-width, half-height, half-depth, mesh, color]
  const parts = {
    inf: [
      [0, 3, 0, 0.65, 0.35, 0.6, 'sphere'],
      [0, 1.8, 0, 0.65, 0.55, 0.4, 'rounded'],
      [-0.5, 0.6, 0, 0.25, 0.65, 0.25],
      [0.5, 0.6, 0, 0.25, 0.65, 0.25],
      [0.85, 1.9, 0, 0.2, 0.6, 0.2],
      [0, 0.1, 0, 1.2, 0.12, 0.9],
    ],
    tank: [
      [0, 1, 0, 2.5, 0.65, 2.4, 'rounded'],
      [0, 2.5, 0, 1.4, 0.7, 1.6, 'rounded'],
      [-2.4, 0.65, 0, 0.4, 0.65, 3.1, 'rounded', dark],
      [2.4, 0.65, 0, 0.4, 0.65, 3.1, 'rounded', dark],
      [0, 2.7, 2, 0.22, 0.22, 2],
    ],
    turret: [
      [0, 1, 0, 1.7, 0.65, 2, 'rounded'],
      [0, 2.5, 0, 1.4, 0.7, 1.6, 'rounded'],
      [0, 2.7, 2, 0.22, 0.22, 2],
    ],
    heli: [
      [0, 0, 0, 1.6, 0.9, 2, 'rounded'],
      [0, 0.3, 1.6, 1.2, 0.6, 0.55, 'rounded', [0.15, 0.27, 0.23]],
      [0, 0, -3, 0.35, 0.3, 2.2],
      [0, 1.5, 0, 5, 0.08, 0.25, 'box', dark],
      [-1.8, -1, 0, 0.15, 0.15, 2.2],
      [1.8, -1, 0, 0.15, 0.15, 2.2],
    ],
    base: [
      [0, 5.4, 0, 5.5, 0.4, 4.5],
      [0, 2.5, -3.8, 5, 2.5, 0.25],
      [-4.8, 2.5, 0, 0.25, 2.5, 4],
      [4.8, 2.5, 0, 0.25, 2.5, 4],
      [0, 2.5, 3.8, 3, 2.5, 0.25],
      [4, 9, 0, 0.13, 4, 0.13],
      [5, 14, 0, 1, 0.65, 0.1, 'box', [0.75, 0.22, 0.12]],
    ],
  };
  function emit(state, enemy, broken, random = Math.random, point) {
    const list = state.DB || (state.DB = []);
    const yaw = state.P
      ? Math.atan2(state.P.x - enemy.x, state.P.z - enemy.z)
      : 0;
    const source = parts[enemy.k] || parts.turret;
    const detachable = enemy.k === 'base' ? 0 : enemy.k === 'heli' ? 1 : -1;
    let templates = broken
      ? source.filter((p, i) => !enemy.detached || i !== detachable)
      : [];
    if (
      !broken &&
      !enemy.detached &&
      detachable >= 0 &&
      enemy.chips >= (enemy.k === 'base' ? 4 : 2)
    ) {
      enemy.detached = true;
      templates = [source[detachable]];
    }
    const add = (
      x,
      y,
      z,
      sx,
      sy,
      sz,
      kind = 'box',
      color = tan,
      large = false,
    ) => {
      const a = random() * Math.PI * 2,
        speed = (large ? 4 : 8) + random() * 8;
      list.push({
        x,
        y,
        z,
        sx,
        sy,
        sz,
        kind,
        color,
        large,
        yaw: yaw + random(),
        spin: (random() - 0.5) * 14,
        vx: Math.cos(a) * speed,
        vz: Math.sin(a) * speed,
        vy: 5 + random() * 9,
        age: 0,
        bounces: 0,
        settled: false,
      });
    };
    for (const [x, y, z, sx, sy, sz, kind, color] of templates)
      add(
        enemy.x + x * Math.cos(yaw) + z * Math.sin(yaw),
        enemy.y + y,
        enemy.z - x * Math.sin(yaw) + z * Math.cos(yaw),
        sx,
        sy,
        sz,
        kind,
        color,
        true,
      );
    const origin = point || {
      x: enemy.x,
      y: enemy.y + (enemy.k === 'heli' ? 0 : 2),
      z: enemy.z,
    };
    for (let i = 0; i < (broken ? 10 : 4); i++) {
      const size = 0.16 + random() * 0.34;
      add(
        origin.x,
        origin.y,
        origin.z,
        size,
        0.09 + random() * 0.12,
        size * (0.7 + random()),
        'box',
        i % 3 === 0 ? [0.9, 0.77, 0.51] : tan,
      );
    }
    // Keep recognizable wreckage preferentially; bounded memory and draw calls.
    while (list.length > MAX_PIECES) {
      const small = list.findIndex((p) => !p.large);
      list.splice(small < 0 ? 0 : small, 1);
    }
  }
  function step(state, dt, groundAt) {
    for (const p of state.DB || []) {
      if (p.settled) continue;
      // Substeps prevent fast pieces tunnelling through sloping terrain.
      const count = Math.max(1, Math.ceil(dt / 0.016)),
        h = dt / count;
      for (let i = 0; i < count && !p.settled; i++) {
        p.age += h;
        p.vy -= 26 * h;
        p.x += p.vx * h;
        p.y += p.vy * h;
        p.z += p.vz * h;
        p.yaw += p.spin * h;
        const floor = groundAt(p.x, p.z) + p.sy;
        if (p.y <= floor) {
          p.y = floor;
          p.bounces++;
          p.vy = Math.abs(p.vy) * 0.26;
          p.vx *= 0.45;
          p.vz *= 0.45;
          p.spin *= 0.4;
          if (p.bounces >= 3 || p.vy < 1.1) {
            // Lay the molded component on its thinnest side.
            if (p.sy > p.sx) [p.sy, p.sx] = [p.sx, p.sy];
            if (p.sy > p.sz) [p.sy, p.sz] = [p.sz, p.sy];
            p.y = groundAt(p.x, p.z) + p.sy;
            p.vx = p.vy = p.vz = p.spin = 0;
            p.settled = true;
          }
        }
      }
    }
  }
  return { emit, step, MAX_PIECES };
});
