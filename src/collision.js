(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ToyCollision = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Geometry uses the same world-space half extents and yaw as the renderers.
  function segment(a, b, o, r = 0, halfY = r) {
    const c = Math.cos(o.yaw || 0),
      s = Math.sin(o.yaw || 0);
    const local = (p) => [
      (p.x - o.x) * c - (p.z - o.z) * s,
      p.y - o.y,
      (p.x - o.x) * s + (p.z - o.z) * c,
    ];
    const p = local(a),
      q = local(b),
      ext = [o.sx + r, o.sy + halfY, o.sz + r];
    if (o.kind === 'sphere') {
      const u = p.map((v, i) => v / ext[i]),
        v = q.map((n, i) => (n - p[i]) / ext[i]);
      const A = v.reduce((t, n) => t + n * n, 0),
        B = 2 * u.reduce((t, n, i) => t + n * v[i], 0),
        C = u.reduce((t, n) => t + n * n, 0) - 1;
      if (C <= 0) return 0;
      if (A < 1e-12) return null;
      const d = B * B - 4 * A * C;
      if (d < 0) return null;
      const t = (-B - Math.sqrt(d)) / (2 * A);
      return t >= 0 && t <= 1 ? t : null;
    }
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 3; i++) {
      const d = q[i] - p[i];
      if (Math.abs(d) < 1e-10) {
        if (Math.abs(p[i]) > ext[i]) return null;
        continue;
      }
      let t1 = (-ext[i] - p[i]) / d,
        t2 = (ext[i] - p[i]) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      lo = Math.max(lo, t1);
      hi = Math.min(hi, t2);
      if (lo > hi) return null;
    }
    return lo;
  }
  function create(scene, world) {
    let dc,
      mission,
      rescued,
      grid = new Map(),
      solids = [];
    const CELL = 24;
    function rebuild() {
      if (
        dc === scene.DC &&
        mission === scene.mission &&
        rescued === (scene.mission?.rescued || 0)
      )
        return;
      dc = scene.DC;
      mission = scene.mission;
      rescued = mission?.rescued || 0;
      solids = [...(world?.yard || [])];
      const sphere = (x, y, z, sx, sy, sz, yaw = 0) =>
        solids.push({ kind: 'sphere', x, y, z, sx, sy, sz, yaw });
      for (const r of world?.rocks || []) {
        const h = world.height(r.x, r.z);
        sphere(r.x, h + r.s * 0.45, r.z, r.s, r.s * 0.65, r.s * 0.85, r.x);
        sphere(r.x + 2, h + 0.45, r.z + 1, 1.3, 0.6, 1);
      }
      for (const d of dc || []) {
        if (world && !world.clearOfLandmarks(d.x, d.z, 3)) continue;
        if (
          mission?.allies.some(
            (a) =>
              a.state !== 'rescued' && Math.hypot(a.x - d.x, a.z - d.z) < 7,
          )
        )
          continue;
        const h = world ? world.height(d.x, d.z) : 0;
        if (d.t === 'shrub') {
          sphere(d.x, h + d.s * 0.65, d.z, d.s, d.s * 0.8, d.s * 0.85);
          sphere(
            d.x - d.s * 0.4,
            h + d.s * 1.2,
            d.z,
            d.s * 0.65,
            d.s * 0.65,
            d.s * 0.6,
          );
        } else if (d.t === 't') {
          solids.push({
            kind: 'box',
            x: d.x,
            y: h + 2,
            z: d.z,
            sx: 0.5,
            sy: 2,
            sz: 0.5,
          });
          sphere(d.x, h + 5, d.z, 2.7, 3.7, 2.7);
          sphere(d.x - 0.4, h + 7.5, d.z, 1.9, 2.8, 1.9);
        } else
          solids.push({
            kind: 'box',
            x: d.x,
            y: h + d.s / 2,
            z: d.z,
            sx: d.s / 2,
            sy: d.s / 2,
            sz: d.s / 2,
          });
      }
      grid = new Map();
      for (const o of solids) {
        const c = Math.abs(Math.cos(o.yaw || 0)),
          s = Math.abs(Math.sin(o.yaw || 0)),
          rx = o.sx * c + o.sz * s,
          rz = o.sx * s + o.sz * c;
        for (
          let x = Math.floor((o.x - rx) / CELL);
          x <= Math.floor((o.x + rx) / CELL);
          x++
        )
          for (
            let z = Math.floor((o.z - rz) / CELL);
            z <= Math.floor((o.z + rz) / CELL);
            z++
          ) {
            const key = x + ',' + z;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(o);
          }
      }
    }
    function candidates(a, b, r) {
      rebuild();
      const found = new Set();
      for (
        let x = Math.floor((Math.min(a.x, b.x) - r) / CELL);
        x <= Math.floor((Math.max(a.x, b.x) + r) / CELL);
        x++
      )
        for (
          let z = Math.floor((Math.min(a.z, b.z) - r) / CELL);
          z <= Math.floor((Math.max(a.z, b.z) + r) / CELL);
          z++
        )
          for (const o of grid.get(x + ',' + z) || []) found.add(o);
      for (const p of scene.DB || []) found.add(p);
      return found;
    }
    function trace(a, b, r = 0, halfY = r) {
      let result = null;
      for (const o of candidates(a, b, r)) {
        const t = segment(a, b, o, r, halfY);
        if (t !== null && (!result || t < result.t)) result = { t, object: o };
      }
      // Stop rounds at terrain before a target behind a mound, too.
      if (world && r === 0) {
        const n = Math.max(
          1,
          Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)),
        );
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          if (result && t >= result.t) break;
          const x = a.x + (b.x - a.x) * t,
            z = a.z + (b.z - a.z) * t,
            y = a.y + (b.y - a.y) * t;
          if (y < world.height(x, z)) {
            result = { t, object: null };
            break;
          }
        }
      }
      return result;
    }
    function move(a, b, r = 1.8, halfY = 1.3) {
      let p = { ...a };
      // Sweep each axis and slide along a contacted face instead of teleporting through it.
      for (const axis of ['x', 'z']) {
        const q = { ...p, [axis]: b[axis] };
        let t = 1;
        for (const o of candidates(p, q, r)) {
          const f = segment(p, q, o, r, halfY);
          if (f === 0) {
            // Spawn overlap may escape outward; never move farther into the obstacle.
            const c = Math.cos(o.yaw || 0),
              s = Math.sin(o.yaw || 0);
            const x = (p.x - o.x) * c - (p.z - o.z) * s,
              z = (p.x - o.x) * s + (p.z - o.z) * c;
            const dx = (q.x - p.x) * c - (q.z - p.z) * s,
              dz = (q.x - p.x) * s + (q.z - p.z) * c;
            const outward =
              (x * dx) / (o.sx + r) ** 2 + (z * dz) / (o.sz + r) ** 2;
            if (outward > 0 || Math.abs(x) + Math.abs(z) < 1e-9) continue;
          }
          if (f !== null) t = Math.min(t, Math.max(0, f - 0.001));
        }
        if (world && world.canTravel) {
          const count = Math.max(1, Math.ceil(Math.abs(q[axis] - p[axis]) * 2));
          for (let i = 1; i <= count; i++) {
            const f = i / count;
            if (f > t) break;
            const x = p.x + (q.x - p.x) * f,
              z = p.z + (q.z - p.z) * f;
            if (!world.canTravel(x, z, r)) {
              t = Math.min(t, (i - 1) / count);
              break;
            }
          }
        }
        p[axis] += (q[axis] - p[axis]) * t;
      }
      return p;
    }
    return {
      trace,
      move,
      overlaps: (p, r = 1.8, halfY = 1.3) => !!trace(p, p, r, halfY),
    };
  }
  return { create, segment };
});
