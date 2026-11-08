(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyCombat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const GUN_ASSIST_ANGLE = (12 * Math.PI) / 180,
    GUN_ASSIST_RANGE = 130,
    // Velocidad del cañón del jugador: 170 u/s con vida 0,85 s en game.js
    // (antes 130 u/s y 1,1 s): mismo alcance efectivo (~143 u) y mismo
    // daño, pero las trazadoras se ven rápidas en vez de flotar.
    BULLET_SPEED = 170;
  const MAX_SMOKE = 160,
    SMOKE_TRAIL_INTERVAL = 0.05,
    SMOKE_TRAIL_LIFE = 0.9,
    SMOKE_IMPACT_LIFE = 0.9,
    // Explosiones como las del original, pero sin tapar la pantalla:
    // en la grabación de Fabian las bolas se veían como globos
    // opacos gigantes (un tanque llegaba a 22 u de diámetro y crecía
    // durante su vida). Ahora son bolas de fuego más pequeñas que se
    // encogen y se apagan con la edad (el renderizador les da alfa),
    // con humo. El tamaño es solo visual: el daño y el balance no
    // cambian (el misil sigue haciendo 6 y la muerte del enemigo no
    // daña a nadie más). La vida es el tiempo que la bola tarda en
    // consumirse. No quedan escombros: al destruir un enemigo solo
    // quedan la bola de fuego y el humo, que desaparecen solos; nada
    // sólido queda en el suelo (los restos saturaban el juego y
    // cerraban el camino al pelotón).
    EXPLOSION_LIFE = 0.55,
    EXPLOSION_SIZE = Object.freeze({
      inf: 2.5,
      tank: 4,
      tur: 3.5,
      heli: 3.5,
      base: 5,
      missile: 3,
    });
  function pushSmoke(list, puff) {
    if (!list) return;
    list.push(puff);
    if (list.length > MAX_SMOKE)
      list.splice(0, list.length - MAX_SMOKE);
  }
  function mk(arr, x, y, z, vx, vy, vz, l, kind) {
    const o = { x, y, z, vx, vy, vz, l };
    // Origen explícito del disparo: los renderizadores eligen la
    // trazadora (grosor, longitud, color) según el arma, no por la
    // velocidad o el daño. 'soldier' | 'heli' | 'tank'.
    if (kind) o.kind = kind;
    arr.push(o);
    return o;
  }
  // Clasificación visual de las balas enemigas por tipo de enemigo.
  // Las torretas ('tur') son cañones pesados fijos: se dibujan como
  // tanque. Las bases ('base') no disparan.
  function bulletKindFor(enemyKind) {
    return enemyKind === 'tank' || enemyKind === 'tur'
      ? 'tank'
      : enemyKind === 'heli'
        ? 'heli'
        : 'soldier';
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
      // Sin zona muerta a quemarropa: antes se ignoraba a los
      // enemigos a menos de 4 u y el cañón disparaba recto sin
      // apuntarles; parado encima de un tanque, el jugador vaciaba
      // el cargador sin tocarlo mientras el tanque le disparaba.
      // Solo se descarta el caso degenerado (enemigo encima del
      // jugador, sin dirección a la que apuntar).
      if (e.dead || e.hp <= 0 || d < 0.5 || d > nearest) continue;
      if ((dx * fx + dz * fz) / d >= Math.cos(GUN_ASSIST_ANGLE)) {
        target = e;
        nearest = d;
      }
    }
    if (!target) return { vx: fx * BULLET_SPEED, vy: -16, vz: fz * BULLET_SPEED };
    const dx = target.x - muzzle.x,
      dz = target.z - muzzle.z;
    const targetY =
      target.y + (target.k === 'heli' ? 0 : target.k === 'base' ? 3 : 1.5);
    // Dirección 3D hacia el centro del objetivo, a 170 u/s exactos:
    // antes la velocidad vertical se calculaba como dy / (d / 170) y
    // a quemarropa se disparaba (a 3 u, vy ≈ -240 u/s, la bala se
    // clavaba en el suelo en un paso). Lejos el resultado es el
    // mismo (dy es pequeño frente a d); cerca, la bala va al
    // objetivo en vez de picar.
    const dy = targetY - muzzle.y,
      len = Math.hypot(dx, dy, dz) || 1;
    return {
      vx: (dx / len) * BULLET_SPEED,
      vy: (dy / len) * BULLET_SPEED,
      vz: (dz / len) * BULLET_SPEED,
    };
  }
  function kill(
    state,
    e,
    {
      random = Math.random,
      onBreak = () => {},
      onBuzz = () => {},
    } = {},
  ) {
    if (e.dead) return false;
    e.dead = 1;
    state.mission?.enemyEliminated?.(e);
    // Sin escombros: la explosión (bola de fuego + humo) la pone
    // hitEnemy/killEnemy; aquí no queda ningún resto en el suelo.
    onBreak(true);
    onBuzz(30);
    state.P.sc += e.p;
    if (e.k === 'base') {
      state.bd++;
      state.mission.release?.(e.camp);
    }
    if (e.k !== 'base' && state.PK && random() < 0.25)
      state.PK.push({ x: e.x, z: e.z, ty: random() < 0.5 ? 'a' : 'm' });
    return true;
  }
  function hit(state, e, damage, effects = {}, point) {
    if (e.dead) return false;
    e.hp -= damage;
    e.fl = 0;
    e.chips = Math.min(6, (e.chips || 0) + 1);
    if (e.hp <= 0) return kill(state, e, effects);
    // Daño visible sin restos: al llegar al umbral el enemigo pierde
    // la pieza que el renderizador dibujaba como desprendida (rotor
    // del helicóptero, techo de la base), pero la pieza no cae al
    // suelo ni deja cubitos: antes cada impacto dejaba 4 cubitos que
    // alfombraban el camino. Umbrales iguales que antes (base 4,
    // resto con pieza desprendible 2).
    if (
      !e.detached &&
      (e.k === 'heli' ? e.chips >= 2 : e.k === 'base' ? e.chips >= 4 : false)
    )
      e.detached = true;
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
    // Matar con un impacto (bala o misil) también explota: hit()
    // devuelve true solo cuando el enemigo muere, y ahí se añade
    // la bola de fuego y el humo. El `kill` de nivel de módulo (sin
    // entorno) no explota: no tiene acceso a FX ni a SM.
    const hitEnemy = (e, d, point) => {
        const killed = hit(context, e, d, effects, point);
        if (killed) boom(e.x, (e.y || 0) + 2, e.z, EXPLOSION_SIZE[e.k] || 4);
        return killed;
      },
      // Matar a un enemigo es una explosión: la bola de fuego (FX, la
      // dibuja el renderer con los colores del original) más varias
      // bocanadas de humo oscuro que suben. No quedan escombros: ni
      // pecio ni cubitos (ver kill()).
      killEnemy = (e) => {
        if (e.dead) return false;
        const ok = kill(context, e, effects);
        if (ok)
          boom(e.x, (e.y || 0) + 2, e.z, EXPLOSION_SIZE[e.k] || 4);
        return ok;
      };

    function boom(x, y, z, s) {
      env.FX.push({ x, y, z, l: EXPLOSION_LIFE, max: EXPLOSION_LIFE, s });
      // Humo de la explosión: 3 bocanadas oscuras que suben y crecen
      // mientras la bola de fuego se apaga. Acotado por MAX_SMOKE
      // como el resto del humo.
      const r = effects.visualRandom;
      for (let i = 0; i < 3; i++)
        pushSmoke(env.SM, {
          x: x + (r() - 0.5) * s * 0.6,
          y: y + (r() - 0.5) * s * 0.3,
          z: z + (r() - 0.5) * s * 0.6,
          l: SMOKE_IMPACT_LIFE,
          max: SMOKE_IMPACT_LIFE,
          s: s * (0.35 + r() * 0.25),
          dark: true,
          dx: (r() - 0.5) * 0.8,
          dy: 1.1 + r() * 0.7,
          dz: (r() - 0.5) * 0.8,
        });
    }

    function stepProjectiles(dt) {
      // Soldados activos del paso: se calcula una vez y la reutilizan
      // todas las balas enemigas, en vez de reconstruir la lista por bala.
      const soldiers = context.mission?.activeSoldiers?.() || [];
      // Centros de los enemigos: se calculan una vez por paso. Antes,
      // cada bala volvía a construir el centro de cada enemigo (una
      // asignación por bala × enemigo en cada frame, presión al GC).
      const center = (e) => ({
        x: e.x,
        y: e.y + (e.k === 'heli' ? 0 : e.k === 'base' ? 3 : 1.5),
        z: e.z,
      });
      const centers = env.E.map(center);
      const soldierPoints = soldiers.map((a) => ({
        x: a.x,
        y: env.groundAt(a.x, a.z) + 1.5,
        z: a.z,
      }));
      for (const b of env.BL) {
        const previous = { x: b.x, y: b.y, z: b.z };
        b.l -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        let target = null,
          nearest = Infinity;
        for (let i = 0; i < env.E.length; i++) {
          const e = env.E[i];
          if (e.dead) continue;
          const fraction = env.ToyMissions.segmentHit(
            previous,
            b,
            centers[i],
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
        for (let i = 0; i < env.E.length; i++) {
          const e = env.E[i];
          if (!e.dead) {
            const fraction = env.ToyMissions.segmentHit(
              previous,
              o,
              centers[i],
              e.r + 1,
            );
            if (fraction !== null && fraction < nearest) nearest = fraction;
          }
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
          // Impacto: bola de fuego además de la bocanada oscura. El
          // daño sigue siendo el de antes (6 a las víctimas en radio).
          boom(o.x, o.y, o.z, EXPLOSION_SIZE.missile);
          pushSmoke(env.SM, {
            x: o.x,
            y: o.y,
            z: o.z,
            l: SMOKE_IMPACT_LIFE,
            max: SMOKE_IMPACT_LIFE,
            s: 3,
            dark: true,
            dx: 0,
            dy: 0.7,
            dz: 0,
          });
        } else {
          // Estela: bocanadas blancas detrás del misil, como en la referencia.
          o.smoke = (o.smoke ?? 0) - dt;
          if (o.smoke <= 0) {
            o.smoke = SMOKE_TRAIL_INTERVAL;
            const r = effects.visualRandom;
            pushSmoke(env.SM, {
              x: o.x - o.vx * 0.02 + (r() - 0.5) * 0.8,
              y: o.y + (r() - 0.5) * 0.6,
              z: o.z - o.vz * 0.02 + (r() - 0.5) * 0.8,
              l: SMOKE_TRAIL_LIFE,
              max: SMOKE_TRAIL_LIFE,
              s: 1.2 + r() * 0.7,
              dark: false,
              dx: (r() - 0.5) * 0.6,
              dy: 0.5 + r() * 0.5,
              dz: (r() - 0.5) * 0.6,
            });
          }
        }
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
            (e, i) =>
              !e.dead &&
              Math.hypot(e.x - o.x, centers[i].y - o.y, e.z - o.z) < e.r + 8 &&
              !env.cover?.trace(blast, centers[i]),
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
        let nearest = playerHit ?? Infinity,
          soldier = null;
        // Los soldados activos son los mismos para todas las balas
        // enemigas de este paso: no se reconstruye la lista por bala.
        for (let i = 0; i < soldiers.length; i++) {
          const a = soldiers[i];
          const fraction = env.ToyMissions.segmentHit(
            previous,
            b,
            soldierPoints[i],
            0.9,
          );
          if (fraction !== null && fraction < nearest) {
            nearest = fraction;
            soldier = a;
          }
        }
        const obstruction = env.cover?.trace(previous, b);
        if (obstruction && obstruction.t <= nearest) {
          b.l = 0;
          continue;
        }
        if (soldier) {
          context.mission.damageSoldier(soldier, 1);
          b.l = 0;
        } else if (playerHit !== null) {
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
      bulletKindFor,
      stepProjectiles,
    };
  }
  return {
    create,
    gunVelocity,
    bulletKindFor,
    hit,
    kill,
    mk,
    GUN_ASSIST_ANGLE,
    GUN_ASSIST_RANGE,
    BULLET_SPEED,
    MAX_SMOKE,
    EXPLOSION_LIFE,
    EXPLOSION_SIZE,
  };
});
