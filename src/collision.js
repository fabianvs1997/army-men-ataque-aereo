(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ToyCollision = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Geometry uses the same world-space half extents and yaw as the renderers.
  // Camino caliente sin allocations: segment() se llama ~230 veces por
  // frame en la Misión 1 (30 enemigos × move + trazadoras) y la versión
  // anterior creaba 4 arrays por llamada (local ×2, u, v) más 3 reduce;
  // eso son ~1.000 objetos efímeros por frame solo aquí y las pausas
  // de GC que se ven en el bench (frames de 45-65 ms cada ~100-150
  // frames). La matemática es la misma, con escalares en vez de
  // arrays; los tests de colisión y los benches de congelamiento la
  // cubren.
  function segment(a, b, o, r = 0, halfY = r) {
    const c = Math.cos(o.yaw || 0),
      s = Math.sin(o.yaw || 0);
    const ax = a.x - o.x,
      az = a.z - o.z,
      bx = b.x - o.x,
      bz = b.z - o.z;
    const px = ax * c - az * s,
      py = a.y - o.y,
      pz = ax * s + az * c;
    const qx = bx * c - bz * s,
      qy = b.y - o.y,
      qz = bx * s + bz * c;
    const ex = o.sx + r,
      ey = o.sy + halfY,
      ez = o.sz + r;
    if (o.kind === 'sphere') {
      const ux = px / ex,
        uy = py / ey,
        uz = pz / ez,
        vx = (qx - px) / ex,
        vy = (qy - py) / ey,
        vz = (qz - pz) / ez;
      const A = vx * vx + vy * vy + vz * vz,
        B = 2 * (ux * vx + uy * vy + uz * vz),
        C = ux * ux + uy * uy + uz * uz - 1;
      if (C <= 0) return 0;
      if (A < 1e-12) return null;
      const d = B * B - 4 * A * C;
      if (d < 0) return null;
      const t = (-B - Math.sqrt(d)) / (2 * A);
      return t >= 0 && t <= 1 ? t : null;
    }
    let lo = 0,
      hi = 1;
    // Test de losas (slab) por eje, desenrollado para no crear arrays.
    let d = qx - px;
    if (Math.abs(d) < 1e-10) {
      if (Math.abs(px) > ex) return null;
    } else {
      let t1 = (-ex - px) / d,
        t2 = (ex - px) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > lo) lo = t1;
      if (t2 < hi) hi = t2;
      if (lo > hi) return null;
    }
    d = qy - py;
    if (Math.abs(d) < 1e-10) {
      if (Math.abs(py) > ey) return null;
    } else {
      let t1 = (-ey - py) / d,
        t2 = (ey - py) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > lo) lo = t1;
      if (t2 < hi) hi = t2;
      if (lo > hi) return null;
    }
    d = qz - pz;
    if (Math.abs(d) < 1e-10) {
      if (Math.abs(pz) > ez) return null;
    } else {
      let t1 = (-ez - pz) / d,
        t2 = (ez - pz) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > lo) lo = t1;
      if (t2 < hi) hi = t2;
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
    // Sin escombros: los enemigos destruidos no dejan restos (ver
    // src/combat.js) y state.DB solo guarda las marcas de aliado
    // caído, diminutas y estáticas, que no bloquean el paso ni las
    // balas. Antes los escombros asentados iban a su propio índice
    // espacial (320 piezas con un segment() con trigonometría por
    // trazado); al no haber escombros, el índice sobra y cada
    // trace/move solo recorre los sólidos del mundo.
    const CELL = 24;
    function indexInto(map, o) {
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
          if (!map.has(key)) map.set(key, []);
          map.get(key).push(o);
        }
    }
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
        } else if (d.t === 't' || d.t === 'pine') {
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
      for (const o of solids) indexInto(grid, o);
    }
    // Conjunto reutilizado por candidates(): antes se creaba un Set
    // nuevo en cada llamada (~72 llamadas por frame en la Misión 1)
    // y cada uno era basura para el GC. Se vacía al empezar cada
    // llamada y nadie lo guarda: trace/move lo recorren en el acto
    // y segment/height/canTravel nunca vuelven a llamar a candidates,
    // así que no hay reentrancia.
    const scratchFound = new Set();
    function candidates(a, b, r) {
      rebuild();
      const found = scratchFound;
      found.clear();
      for (
        let x = Math.floor((Math.min(a.x, b.x) - r) / CELL);
        x <= Math.floor((Math.max(a.x, b.x) + r) / CELL);
        x++
      )
        for (
          let z = Math.floor((Math.min(a.z, b.z) - r) / CELL);
          z <= Math.floor((Math.max(a.z, b.z) + r) / CELL);
          z++
        ) {
          for (const o of grid.get(x + ',' + z) || []) found.add(o);
        }
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
    // Puntos reutilizados por move(): antes se copiaba el punto con
    // spread 3 veces por llamada (30 llamadas por frame en M1).
    // segment/candidates solo leen estos puntos y move nunca se
    // llama a sí mismo, así que reutilizarlos es seguro.
    const tmpP = { x: 0, y: 0, z: 0 },
      tmpQ = { x: 0, y: 0, z: 0 };
    function move(a, b, r = 1.8, halfY = 1.3) {
      let px = a.x,
        pz = a.z;
      const py = a.y;
      // Sweep each axis and slide along a contacted face instead of teleporting through it.
      for (let axis = 0; axis < 2; axis++) {
        const target = axis === 0 ? b.x : b.z,
          from = axis === 0 ? px : pz;
        tmpP.x = px;
        tmpP.y = py;
        tmpP.z = pz;
        tmpQ.x = axis === 0 ? target : px;
        tmpQ.y = py;
        tmpQ.z = axis === 0 ? pz : target;
        let t = 1;
        for (const o of candidates(tmpP, tmpQ, r)) {
          const f = segment(tmpP, tmpQ, o, r, halfY);
          if (f === 0) {
            // Spawn overlap may escape outward; never move farther into the obstacle.
            const c = Math.cos(o.yaw || 0),
              s = Math.sin(o.yaw || 0);
            const x = (tmpP.x - o.x) * c - (tmpP.z - o.z) * s,
              z = (tmpP.x - o.x) * s + (tmpP.z - o.z) * c;
            const dx = (tmpQ.x - tmpP.x) * c - (tmpQ.z - tmpP.z) * s,
              dz = (tmpQ.x - tmpP.x) * s + (tmpQ.z - tmpP.z) * c;
            const outward =
              (x * dx) / (o.sx + r) ** 2 + (z * dz) / (o.sz + r) ** 2;
            if (outward > 0 || Math.abs(x) + Math.abs(z) < 1e-9) continue;
          }
          if (f !== null) t = Math.min(t, Math.max(0, f - 0.001));
        }
        if (world && world.canTravel) {
          const count = Math.max(1, Math.ceil(Math.abs(target - from) * 2));
          for (let i = 1; i <= count; i++) {
            const f = i / count;
            if (f > t) break;
            const x = axis === 0 ? from + (target - from) * f : px,
              z = axis === 0 ? pz : from + (target - from) * f;
            if (!world.canTravel(x, z, r)) {
              t = Math.min(t, (i - 1) / count);
              break;
            }
          }
        }
        if (axis === 0) px += (target - px) * t;
        else pz += (target - pz) * t;
      }
      return { x: px, y: py, z: pz };
    }
    return {
      trace,
      move,
      overlaps: (p, r = 1.8, halfY = 1.3) => !!trace(p, p, r, halfY),
    };
  }
  return { create, segment };
});
