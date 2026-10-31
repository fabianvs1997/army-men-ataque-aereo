(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports
      ? require('./debris.js')
      : root.ToyDebris,
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyCombat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Debris) {
  'use strict';
  const GUN_ASSIST_ANGLE = (12 * Math.PI) / 180,
    GUN_ASSIST_RANGE = 130;
  function mk(arr, x, y, z, vx, vy, vz, l) {
    const o = { x, y, z, vx, vy, vz, l };
    arr.push(o);
    return o;
  }
  function gunVelocity(player, muzzle, enemies) {
    const fx = Math.sin(player.yaw),
      fz = Math.cos(player.yaw);
    let target = null,
      nearest = GUN_ASSIST_RANGE;
    for (const e of enemies) {
      const dx = e.x - player.x,
        dz = e.z - player.z,
        d = Math.hypot(dx, dz);
      if (e.dead || e.hp <= 0 || d < 4 || d > nearest) continue;
      if ((dx * fx + dz * fz) / d >= Math.cos(GUN_ASSIST_ANGLE)) {
        target = e;
        nearest = d;
      }
    }
    if (!target) return { vx: fx * 130, vy: -16, vz: fz * 130 };
    const dx = target.x - muzzle.x,
      dz = target.z - muzzle.z,
      d = Math.hypot(dx, dz);
    const targetY =
      target.y + (target.k === 'heli' ? 0 : target.k === 'base' ? 3 : 1.5);
    return {
      vx: (dx / d) * 130,
      vy: (targetY - muzzle.y) / Math.max(0.01, d / 130),
      vz: (dz / d) * 130,
    };
  }
  function kill(
    state,
    e,
    {
      random = Math.random,
      visualRandom = Math.random,
      onBreak = () => {},
      onBuzz = () => {},
    } = {},
  ) {
    if (e.dead) return false;
    e.dead = 1;
    Debris.emit(state, e, true, visualRandom);
    onBreak(true);
    onBuzz(30);
    state.P.sc += e.p;
    if (e.k === 'base') {
      state.bd++;
      state.mission.release(e.camp);
    }
    if (e.k !== 'base' && random() < 0.25)
      state.PK.push({ x: e.x, z: e.z, ty: random() < 0.5 ? 'a' : 'm' });
    return true;
  }
  function hit(state, e, damage, effects = {}, point) {
    if (e.dead) return false;
    e.hp -= damage;
    e.fl = 0;
    e.chips = Math.min(6, (e.chips || 0) + 1);
    if (e.hp <= 0) return kill(state, e, effects);
    Debris.emit(state, e, false, effects.visualRandom, point);
    if (effects.onBreak) effects.onBreak(false);
    return false;
  }

  function create(env) {
    const context = env.state || env,
      effects = {
        random: env.random || Math.random,
        visualRandom: env.visualRandom || Math.random,
        onBreak: (broken) => env.sfx.snap && env.sfx.snap(broken),
        onBuzz: (p) => env.buzz(p),
      };
    const hitEnemy = (e, d, point) => hit(context, e, d, effects, point),
      killEnemy = (e) => kill(context, e, effects);

    function boom(x, y, z, s) {
      env.FX.push({ x, y, z, l: 0.5, s });
    }

    function stepProjectiles(dt) {
      const center = (e) => ({
        x: e.x,
        y: e.y + (e.k === 'heli' ? 0 : e.k === 'base' ? 3 : 1.5),
        z: e.z,
      });
      for (const b of env.BL) {
        const previous = { x: b.x, y: b.y, z: b.z };
        b.l -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        let target = null,
          nearest = Infinity;
        for (const e of env.E) {
          if (e.dead) continue;
          const fraction = env.ToyMissions.segmentHit(
            previous,
            b,
            center(e),
            e.r,
          );
          if (fraction !== null && fraction < nearest) {
            nearest = fraction;
            target = e;
          }
        }
        const obstruction = env.cover?.trace(previous, b);
        if (obstruction && obstruction.t <= nearest) {
          b.l = 0;
          target = null;
        }
        if (target) {
          hitEnemy(target, 1, {
            x: previous.x + (b.x - previous.x) * nearest,
            y: previous.y + (b.y - previous.y) * nearest,
            z: previous.z + (b.z - previous.z) * nearest,
          });
          b.l = 0;
        }
        if (b.y < env.groundAt(b.x, b.z)) b.l = 0;
      }
      for (const o of env.MS) {
        const previous = { x: o.x, y: o.y, z: o.z };
        o.l -= dt;
        if (o.tg && !o.tg.dead) {
          const c = Math.atan2(o.vx, o.vz);
          let q = Math.atan2(o.tg.x - o.x, o.tg.z - o.z) - c;
          q = Math.atan2(Math.sin(q), Math.cos(q));
          const n2 = c + env.clamp(q, -3 * dt, 3 * dt);
          o.vx = Math.sin(n2) * 75;
          o.vz = Math.cos(n2) * 75;
          o.y += (o.tg.y + 1 - o.y) * dt * 1.5;
        }
        o.x += o.vx * dt;
        o.z += o.vz * dt;
        let ex = o.l <= 0;
        let nearest = Infinity;
        for (const e of env.E)
          if (!e.dead) {
            const fraction = env.ToyMissions.segmentHit(
              previous,
              o,
              center(e),
              e.r + 1,
            );
            if (fraction !== null && fraction < nearest) nearest = fraction;
          }
        const obstruction = env.cover?.trace(previous, o);
        if (obstruction) nearest = Math.min(nearest, obstruction.t);
        if (nearest !== Infinity) {
          o.x = previous.x + (o.x - previous.x) * nearest;
          o.y = previous.y + (o.y - previous.y) * nearest;
          o.z = previous.z + (o.z - previous.z) * nearest;
          ex = true;
        }
        if (o.y < env.groundAt(o.x, o.z)) ex = true;
        if (ex) {
          o.l = 0;
          // Resolve on the incident side so splash cannot leak through a solid wall.
          const length = Math.hypot(
            o.x - previous.x,
            o.y - previous.y,
            o.z - previous.z,
          );
          const blast =
            length > 0
              ? {
                  x: o.x - ((o.x - previous.x) / length) * 0.03,
                  y: o.y - ((o.y - previous.y) / length) * 0.03,
                  z: o.z - ((o.z - previous.z) / length) * 0.03,
                }
              : o;
          // Snapshot visibility before this blast creates new wreckage.
          const victims = env.E.filter(
            (e) =>
              !e.dead &&
              Math.hypot(e.x - o.x, center(e).y - o.y, e.z - o.z) < e.r + 8 &&
              !env.cover?.trace(blast, center(e)),
          );
          for (const e of victims) hitEnemy(e, 6);
        }
      }
      for (const b of env.EB) {
        const previous = { x: b.x, y: b.y, z: b.z };
        b.l -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        const playerHit = env.ToyMissions.segmentHit(previous, b, env.P, 3);
        const obstruction = env.cover?.trace(previous, b);
        if (obstruction && (playerHit === null || obstruction.t <= playerHit)) {
          b.l = 0;
          continue;
        }
        if (playerHit !== null) {
          env.hurt();
          b.l = 0;
          if (env.st === 'over') return false;
        }
        if (b.y < env.groundAt(b.x, b.z)) b.l = 0;
      }

      return true;
    }
    return {
      mk,
      boom,
      hit: hitEnemy,
      kill: killEnemy,
      gunVelocity,
      stepProjectiles,
      stepDebris: (dt) => Debris.step(context, dt, env.groundAt),
    };
  }
  return {
    create,
    gunVelocity,
    hit,
    kill,
    mk,
    GUN_ASSIST_ANGLE,
    GUN_ASSIST_RANGE,
  };
});
