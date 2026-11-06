(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyEscortNavigation = api;
})(globalThis, function () {
  'use strict';
  // A* local para desatascar soldados. El problema que tenía: la lista
  // abierta era un array con búsqueda lineal del mínimo (O(n) por
  // expansión) y no había presupuesto: con la meta a 60 u y el terreno
  // bloqueado por cerros, agotaba las 5000 expansiones en 60-70 ms en
  // Node (varios cientos de ms en iPhone), y lo repetía cada 3 s por
  // cada soldado atascado, en plena escolta B → C. Ahora: montículo
  // binario, meta saneada (si la meta está dentro de un obstáculo se
  // busca un punto libre cercano y si no hay, se vuelve al instante),
  // meta lejana recortada a un objetivo intermedio (máx. 64 u) y
  // presupuestos duros de expansiones y de tiempo. Si no hay ruta
  // dentro del presupuesto, devuelve null y el soldado sigue
  // deslizándose por el obstáculo; nunca bloquea el frame.
  const DEFAULT_MAX_EXPANSIONS = 1200;
  const DEFAULT_MAX_MS = 12;
  const MAX_GOAL_DISTANCE = 64;
  const SEARCH_MARGIN = 20;

  function path(start, goal, cover, groundAt, radius, halfHeight = 0.9, budget = {}) {
    const maxExpansions = budget.maxExpansions ?? DEFAULT_MAX_EXPANSIONS;
    const maxMs = budget.maxMs ?? DEFAULT_MAX_MS;
    const now =
      budget.now ||
      (() =>
        typeof performance !== 'undefined' ? performance.now() : Date.now());
    const t0 = now();
    const point = (x, z) => ({
      x,
      y: groundAt(x, z) + 1.5,
      z,
    });
    const free = (x, z) =>
      !cover.overlaps?.(point(x, z), radius, halfHeight);
    // Punto libre más cercano: si el soldado está encajado dentro de un
    // escombro, ningún vecino es transitable y buscar sería inútil.
    const nearestFree = (x, z) => {
      if (free(x, z)) return { x, z };
      for (let r = 1; r <= 8; r++)
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4,
            nx = x + Math.cos(a) * r,
            nz = z + Math.sin(a) * r;
          if (free(nx, nz)) return { x: nx, z: nz };
        }
      return null;
    };
    const from = nearestFree(start.x, start.z);
    if (!from) return null;
    // Meta lejana: se avanza por tramos. Un A* a 400 u (B → C entera)
    // no cabe en un frame; el soldado vuelve a calcular al llegar al
    // objetivo intermedio.
    let gx = goal.x,
      gz = goal.z;
    const goalDistance = Math.hypot(gx - from.x, gz - from.z);
    if (goalDistance > MAX_GOAL_DISTANCE) {
      const k = MAX_GOAL_DISTANCE / goalDistance;
      gx = from.x + (gx - from.x) * k;
      gz = from.z + (gz - from.z) * k;
    }
    const to = nearestFree(gx, gz);
    if (!to) return null;
    // Paso de 2 u: con paso 1 el A* exploraba 4 veces más nodos para el
    // mismo rodeo y cada expansión cuesta varias cover.move; 2 u sigue
    // siendo seguro porque cover.move barre el segmento completo.
    const step = 2,
      minX = Math.min(from.x, to.x) - SEARCH_MARGIN,
      maxX = Math.max(from.x, to.x) + SEARCH_MARGIN,
      minZ = Math.min(from.z, to.z) - SEARCH_MARGIN,
      maxZ = Math.max(from.z, to.z) + SEARCH_MARGIN;
    const first = {
      x: from.x,
      z: from.z,
      g: 0,
      parent: null,
      key: '0,0',
      ix: 0,
      iz: 0,
      f: Math.hypot(to.x - from.x, to.z - from.z),
    };
    // Montículo binario por f: extraer el mínimo ya no recorre la lista.
    const heap = [first];
    const push = (node) => {
      heap.push(node);
      let i = heap.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heap[parent].f <= heap[i].f) break;
        [heap[parent], heap[i]] = [heap[i], heap[parent]];
        i = parent;
      }
    };
    const pop = () => {
      const top = heap[0],
        last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const left = i * 2 + 1,
            right = left + 1;
          let smallest = i;
          if (left < heap.length && heap[left].f < heap[smallest].f)
            smallest = left;
          if (right < heap.length && heap[right].f < heap[smallest].f)
            smallest = right;
          if (smallest === i) break;
          [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
          i = smallest;
        }
      }
      return top;
    };
    const best = new Map([[first.key, 0]]);
    const clear = (a, b) => {
      const p = cover.move(
        { x: a.x, y: groundAt(a.x, a.z) + 1.5, z: a.z },
        { x: b.x, y: groundAt(a.x, a.z) + 1.5, z: b.z },
        radius,
        halfHeight,
      );
      return Math.hypot(p.x - b.x, p.z - b.z) < 0.01;
    };
    for (let count = 0; heap.length && count < maxExpansions; count++) {
      // Presupuesto de tiempo: se comprueba cada 64 expansiones para no
      // pagar el reloj en cada una.
      if ((count & 63) === 0 && count > 0 && now() - t0 > maxMs) return null;
      const current = pop();
      if (current.g > best.get(current.key)) continue;
      if (
        Math.hypot(current.x - to.x, current.z - to.z) <= step * 1.5 &&
        clear(current, to)
      ) {
        const points = [{ x: to.x, z: to.z }];
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
          x = from.x + ix * step,
          z = from.z + iz * step,
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
          f: g + Math.hypot(to.x - x, to.z - z),
        };
        if (!clear(current, next)) continue;
        best.set(key, g);
        push(next);
      }
    }
    return null;
  }
  return { path, DEFAULT_MAX_EXPANSIONS, DEFAULT_MAX_MS, MAX_GOAL_DISTANCE };
});
