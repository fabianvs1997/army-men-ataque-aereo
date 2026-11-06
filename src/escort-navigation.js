(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyEscortNavigation = api;
})(globalThis, function () {
  'use strict';
  function path(start, goal, cover, groundAt, radius, halfHeight = 0.9) {
    const step = 1,
      limit = 20,
      minX = Math.min(start.x, goal.x) - limit,
      maxX = Math.max(start.x, goal.x) + limit,
      minZ = Math.min(start.z, goal.z) - limit,
      maxZ = Math.max(start.z, goal.z) + limit;
    const first = {
      x: start.x,
      z: start.z,
      g: 0,
      parent: null,
      key: '0,0',
      ix: 0,
      iz: 0,
    };
    first.f = Math.hypot(goal.x - first.x, goal.z - first.z);
    const open = [first],
      best = new Map([[first.key, 0]]);
    const clear = (a, b) => {
      const p = cover.move(
        { x: a.x, y: groundAt(a.x, a.z) + 1.5, z: a.z },
        { x: b.x, y: groundAt(a.x, a.z) + 1.5, z: b.z },
        radius,
        halfHeight,
      );
      return Math.hypot(p.x - b.x, p.z - b.z) < 0.01;
    };
    for (let count = 0; open.length && count < 5000; count++) {
      let index = 0;
      for (let i = 1; i < open.length; i++)
        if (open[i].f < open[index].f) index = i;
      const current = open.splice(index, 1)[0];
      if (current.g > best.get(current.key)) continue;
      if (
        Math.hypot(current.x - goal.x, current.z - goal.z) <= step * 1.5 &&
        clear(current, goal)
      ) {
        const points = [{ x: goal.x, z: goal.z }];
        for (let p = current; p.parent; p = p.parent)
          points.push({ x: p.x, z: p.z });
        return points.reverse();
      }
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        const ix = current.ix + dx,
          iz = current.iz + dz,
          key = ix + ',' + iz,
          x = start.x + ix * step,
          z = start.z + iz * step,
          g = current.g + step * Math.hypot(dx, dz);
        if (
          x < minX ||
          x > maxX ||
          z < minZ ||
          z > maxZ ||
          g >= (best.get(key) ?? Infinity)
        )
          continue;
        const next = {
          x,
          z,
          ix,
          iz,
          key,
          g,
          parent: current,
          f: g + Math.hypot(goal.x - x, goal.z - z),
        };
        if (!clear(current, next)) continue;
        best.set(key, g);
        open.push(next);
      }
    }
    return null;
  }
  return { path };
});
