(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyCombat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create(env) {
    const GUN_ASSIST_ANGLE = (12 * Math.PI) / 180;
    const GUN_ASSIST_RANGE = 130;
    function mk(arr, x, y, z, vx, vy, vz, l) {
      const o = { x, y, z, vx, vy, vz, l };
      arr.push(o);
      return o;
    }
    function boom(x, y, z, s) {
      env.FX.push({ x, y, z, l: 0.5, s });
    }
    function hit(e, d) {
      e.hp -= d;
      e.fl = 0.08;
      if (e.hp <= 0) kill(e);
    }
    function kill(e) {
      if (e.dead) return;
      e.dead = 1;
      boom(e.x, e.y + 1, e.z, e.k === 'base' ? 9 : e.k === 'heli' ? 5 : 4);
      env.sfx.boom();
      env.buzz(30);
      env.P.sc += e.p;
      if (e.k === 'base') {
        env.bd++;
        env.mission.release(e.camp);
      }
      if (e.k !== 'base' && Math.random() < 0.25)
        env.PK.push({ x: e.x, z: e.z, ty: Math.random() < 0.5 ? 'a' : 'm' });
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
        if (target) {
          hit(target, 1);
          boom(
            previous.x + (b.x - previous.x) * nearest,
            previous.y + (b.y - previous.y) * nearest,
            previous.z + (b.z - previous.z) * nearest,
            0.65,
          );
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
        if (nearest !== Infinity) {
          o.x = previous.x + (o.x - previous.x) * nearest;
          o.y = previous.y + (o.y - previous.y) * nearest;
          o.z = previous.z + (o.z - previous.z) * nearest;
          ex = true;
        }
        if (o.y < env.groundAt(o.x, o.z)) ex = true;
        if (ex) {
          o.l = 0;
          boom(o.x, o.y, o.z, 6);
          env.sfx.boom();
          for (const e of env.E)
            if (
              !e.dead &&
              Math.hypot(e.x - o.x, center(e).y - o.y, e.z - o.z) < e.r + 8
            )
              hit(e, 6);
        }
      }
      for (const b of env.EB) {
        const previous = { x: b.x, y: b.y, z: b.z };
        b.l -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        if (env.ToyMissions.segmentHit(previous, b, env.P, 3) !== null) {
          env.hurt();
          b.l = 0;
          if (env.st === 'over') return false;
        }
        if (b.y < env.groundAt(b.x, b.z)) b.l = 0;
      }

      return true;
    }
    return { mk, boom, hit, kill, gunVelocity, stepProjectiles };
  }
  return { create };
});
