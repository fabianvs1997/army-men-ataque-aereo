/* Three short rescue missions. No renderer or browser dependencies. */
(function (root) {
  'use strict';
  const layout = {
    start: { x: 0, z: 0 },
    finish: { x: 155, z: 125 },
    camps: [
      [-90, 100],
      [0, 125],
      [90, 110],
    ],
    route: [
      [0, 0],
      [0, 30],
      [-35, 45],
      [-90, 5],
      [-145, -60],
      [-160, 40],
      [-130, 100],
      [-90, 100],
      [0, 125],
      [90, 110],
      [155, 125],
    ],
    minRescueDistance: 100,
  };
  const configs = [
    {
      name: 'Primer rescate',
      bases: [layout.camps[2]],
      tanks: 1,
      turrets: 1,
      infantry: 3,
      air: 1,
    },
    {
      name: 'Dos campamentos',
      bases: [layout.camps[0], layout.camps[2]],
      tanks: 2,
      turrets: 2,
      infantry: 5,
      air: 2,
    },
    {
      name: 'Última extracción',
      bases: layout.camps,
      tanks: 3,
      turrets: 3,
      infantry: 7,
      air: 3,
    },
  ];
  class Mission {
    constructor(number) {
      if (!Number.isInteger(number) || number < 1 || number > configs.length)
        throw new RangeError('Misión fuera de campaña');
      this.number = number;
      this.config = configs[number - 1];
      this.start = layout.start;
      this.finish = layout.finish;
      this.allies = this.config.bases.flatMap(([x, z], camp) =>
        [-1, 1].map((side) => ({
          x: x + side * 3,
          z: z + 11,
          camp,
          state: 'locked',
        })),
      );
      this.freed = new Set();
      this.rescued = 0;
      this.hold = 0;
      this.active = null;
      this.complete = false;
      this.message =
        'Destruye las bases beige para liberar a los soldados verdes.';
    }
    release(camp) {
      if (
        !Number.isInteger(camp) ||
        camp < 0 ||
        camp >= this.config.bases.length ||
        this.freed.has(camp)
      )
        return;
      this.freed.add(camp);
      for (const a of this.allies) if (a.camp === camp) a.state = 'waiting';
    }
    target(player) {
      const waiting = this.allies.filter((a) => a.state === 'waiting');
      if (waiting.length)
        return waiting.reduce((a, b) =>
          Math.hypot(a.x - player.x, a.z - player.z) <
          Math.hypot(b.x - player.x, b.z - player.z)
            ? a
            : b,
        );
      const bases = this.config.bases
        .map(([x, z], camp) => ({ x, z, camp }))
        .filter((b) => !this.freed.has(b.camp));
      if (bases.length)
        return bases.reduce((a, b) =>
          Math.hypot(a.x - player.x, a.z - player.z) <
          Math.hypot(b.x - player.x, b.z - player.z)
            ? a
            : b,
        );
      return this.finish;
    }
    update(
      dt,
      player,
      { moving = false, firing = false, damaged = false } = {},
    ) {
      if (this.complete) return null;
      const stable = !moving && !firing && !damaged;
      const remaining = this.allies.filter((a) => a.state === 'waiting');
      const nearby = remaining.find(
        (a) => Math.hypot(a.x - player.x, a.z - player.z) <= 6,
      );
      const extracting =
        this.rescued === this.allies.length &&
        this.freed.size === this.config.bases.length;
      const candidate =
        extracting &&
        Math.hypot(player.x - this.finish.x, player.z - this.finish.z) <= 7
          ? 'finish'
          : nearby || null;
      if (!stable || !candidate) {
        this.hold = 0;
        this.active = null;
      } else {
        if (this.active !== candidate) this.hold = 0;
        this.active = candidate;
        this.hold += Math.max(0, Math.min(dt, 0.1));
      }
      if (this.active === 'finish') {
        this.message =
          'Extrayendo: ' +
          Math.min(100, Math.round((this.hold / 2) * 100)) +
          '% · Mantén la posición.';
        if (this.hold >= 2 - 1e-9) {
          this.complete = true;
          return 'complete';
        }
      } else if (this.active) {
        this.message =
          'Rescatando: ' +
          Math.min(100, Math.round((this.hold / 1.5) * 100)) +
          '% · Suelta los controles.';
        if (this.hold >= 1.5 - 1e-9) {
          this.active.state = 'rescued';
          this.rescued++;
          this.active = null;
          this.hold = 0;
          this.message = 'Soldado a bordo. Sigue la flecha.';
          return 'rescued';
        }
      } else
        this.message = extracting
          ? 'Avanza al helipuerto final verde y permanece quieto 2 s.'
          : nearby
            ? 'Suelta movimiento y fuego para rescatar (1.5 s).'
            : remaining.length
              ? 'Recoge a los soldados verdes: acércate y permanece quieto.'
              : 'Destruye las bases beige para liberar a los soldados verdes.';
      return null;
    }
  }
  // Earliest point where a finite segment enters a sphere; prevents fast shots skipping targets.
  function segmentHit(a, b, c, r) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      dz = b.z - a.z,
      ox = a.x - c.x,
      oy = a.y - c.y,
      oz = a.z - c.z,
      A = dx * dx + dy * dy + dz * dz,
      C = ox * ox + oy * oy + oz * oz - r * r;
    if (C <= 0) return 0;
    if (A === 0) return null;
    const B = 2 * (ox * dx + oy * dy + oz * dz),
      D = B * B - 4 * A * C;
    if (D < 0) return null;
    const t = (-B - Math.sqrt(D)) / (2 * A);
    return t >= 0 && t <= 1 ? t : null;
  }
  const api = { Mission, configs, layout, segmentHit };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyMissions = api;
})(globalThis);
