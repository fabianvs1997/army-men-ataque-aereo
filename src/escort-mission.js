(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports
      ? require('./escort-config.js')
      : root.ToyEscortConfig,
    typeof module === 'object' && module.exports
      ? require('./escort-navigation.js')
      : root.ToyEscortNavigation,
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyEscort = api;
})(globalThis, function (Config, Navigation) {
  'use strict';
  const transitions = {
    INICIO_A: ['COMBATE_RUTA_AB'],
    COMBATE_RUTA_AB: ['DESPEJAR_B'],
    DESPEJAR_B: ['EMBARCAR_HERIDOS'],
    EMBARCAR_HERIDOS: ['ESCOLTAR_BC'],
    ESCOLTAR_BC: ['ENTREGA_C'],
    // Misiones con carga (Misión 1): la entrega en C no cierra la
    // misión; abre la fase de la carga. Las demás cierran en C.
    // Misión 2: si quedan garajes Tan al entregar en C, abre la fase
    // de los garajes. Misión 3: si el tren no ha llegado o la
    // batería no está en el tren al entregar en C, la misión se
    // queda esperando en ENTREGA_C hasta que el tren llegue; al
    // completarse, abre la salida por el portal.
    ENTREGA_C: ['COMPLETADA', 'CARGA_PORTAL', 'GARAJES', 'PORTAL'],
    CARGA_PORTAL: ['COMPLETADA'],
    GARAJES: ['COMPLETADA'],
    PORTAL: ['COMPLETADA'],
    COMPLETADA: [],
    FRACASADA: [],
  };
  const objectives = {
    INICIO_A: 'Dirígete a la base B',
    COMBATE_RUTA_AB: 'Dirígete a la base B',
    DESPEJAR_B: 'Elimina la amenaza alrededor de B',
    EMBARCAR_HERIDOS: 'Recoge a los heridos',
    ESCOLTAR_BC: 'Protege al pelotón hasta la base C',
    ENTREGA_C: 'Entrega a los heridos y espera al pelotón en C',
    CARGA_PORTAL: 'Levanta la caja de plástico y llévala por el portal',
    GARAJES: 'Destruye los garajes Tan',
    PORTAL: 'Sal por el portal',
    COMPLETADA: 'Pelotón a salvo en C',
    FRACASADA: 'Misión fallida',
  };
  class Mission {
    constructor(number = 1, config = Config) {
      this.number = number;
      this.rules = config;
      this.start = config.A;
      this.finish = config.C;
      this.stage = 'INICIO_A';
      this.events = [];
      this.complete = false;
      this.failed = false;
      this.message = objectives[this.stage];
      this.enemyPlan = config.enemies
        .concat(config.extraAir.slice(0, number - 1))
        .map((e) => ({ ...e }));
      this.config = {
        // El nombre del mapa fijo (Misión 1: «Pandemonio de
        // Plástico»); sin él, el nombre clásico del rescate.
        name: config.missionName || 'Rescate A → B → C',
        bases: [],
        // Aire: los helicópteros del plan (el de B, los de escolta y,
        // en la Misión 3, el Tan que robó la batería).
        air: this.enemyPlan.filter((e) => e.k === 'heli').length,
        tanks: this.enemyPlan.filter((e) => e.k === 'tank').length,
        turrets: this.enemyPlan.filter((e) => e.k === 'tur').length,
        infantry: this.enemyPlan.filter((e) => e.k === 'inf').length,
        // Garajes: los edificios Tan de la Misión 2.
        garages: this.enemyPlan.filter((e) => e.k === 'garage').length,
      };
      // Carga del original: la caja verde de la Misión 1 junto a B y
      // el portal al final del camino; la batería robada de la
      // Misión 3, escondida en el helicóptero Tan hasta que este
      // cae. Sin `cargo` en la configuración, la misión es el
      // rescate clásico (Misión 2: garajes y coches en vez de
      // carga). `kind` es 'crate' o 'battery'; `winchFrom` dice en
      // qué fases se puede levantar ('ESCOLTAR_BC' en la Misión 1,
      // 'any' en la 3: la batería se levanta cuando cae, sea cual sea
      // la fase); `deliverAt` es la plataforma donde se entrega
      // (Misión 3); sin `deliverAt`, la entrega es en el portal
      // (Misión 1). `hidden` significa que la carga aún no existe
      // en el mapa: aparece al morir el helicóptero Tan.
      this.cargo = config.cargo
        ? {
            kind: config.cargo.kind || 'crate',
            x: config.cargo.x,
            z: config.cargo.z,
            state: config.cargo.hidden ? 'hidden' : 'waiting',
            hold: 0,
            winchFrom: config.cargo.winchFrom || 'ESCOLTAR_BC',
            deliverAt: config.cargo.deliverAt
              ? { ...config.cargo.deliverAt }
              : null,
          }
        : null;
      this.portal = config.portal
        ? {
            x: config.portal.x,
            z: config.portal.z,
            radius: config.portal.radius || 12,
          }
        : null;
      // Garajes y coches (Misión 2): cada garaje vivo suelta un
      // coche de suministros cada `carSpawnInterval` segundos (el
      // primero, a los `firstIn` segundos de empezar la misión: el
      // temporizador arranca en `firstIn`). Los coches recorren el
      // circuito hasta el portal de los coches; si pasan `carsLimit`
      // (15, como en el original), la misión fracasa. El contador y
      // el límite se muestran en el HUD en todas las fases, para que
      // el jugador siempre sepa dónde está.
      this.garages = (config.garages || []).map((g) => ({
        id: g.id,
        x: g.x,
        z: g.z,
        route: g.route.map((p) => [...p]),
        destroyed: false,
        timer: g.firstIn || 0,
      }));
      this.carsEscaped = 0;
      this.carsDestroyed = 0;
      // Enemigos destruidos por el jugador (tanques, infantería,
      // helicópteros, torretas, garajes y coches): el "Bajas" del
      // HUD contaba solo aliados caídos y en la grabación decía 0
      // con 490 puntos y varios tanques destruidos.
      this.kills = 0;
      this.carsLimit = config.carsLimit || 15;
      this.carSpawnInterval = config.carSpawnInterval || 20;
      // Tren y batería (Misión 3): el tren Prego espera en su base
      // (inicio de la vía) hasta que la batería llega a su
      // plataforma; entonces arranca a 6 u/s —más lento que los
      // soldados (7 u/s), para no adelantar al pelotón— y para en
      // la base verde de C. El tren es invulnerable y ningún enemigo
      // lo ataca (la escolta es proteger al pelotón y despejar las
      // vías); el tren no bloquea al pelotón porque la vía corre 8 u
      // al sur del camino. `tanHeliId` es el helicóptero Tan que
      // robó la batería; su posición se anota en cada update para
      // que la brújula pueda apuntar a él.
      this.train = config.train
        ? {
            route: config.train.route.map((p) => [...p]),
            speed: config.train.speed || 6,
            s: 0,
            state: 'waiting',
            ...positionAlong(
              config.train.route,
              0,
            ),
          }
        : null;
      this.batteryPad = config.batteryPad
        ? { ...config.batteryPad }
        : null;
      this.tanHeliId = config.tanHeliId || null;
      this.tanHeliPos = null;
      // Winch: hay que quedarse quieto sobre la caja 1,5 s (como el
      // embarque de heridos) y a menos de 8 u de ella. El cable es
      // visual: el helicóptero vuela siempre a 8 u de altura.
      this.winchRadius = config.winchRadius || 8;
      this.winchSeconds = config.winchSeconds || 1.5;
      const soldier = (id, x, z, group, wounded = false) => ({
        id,
        x,
        z,
        group,
        wounded,
        hp: group === 'A' ? config.guardHP : config.soldierHP,
        state: wounded
          ? 'HERIDO_ESPERANDO'
          : group === 'A'
            ? 'DEFENDIENDO_A'
            : 'DEFENDIENDO_B',
        waypoint: 0,
        cooldown: 0,
        stuck: 0,
        hold: 0,
        yaw: 0,
      });
      this.guards = Array.from({ length: config.guards }, (_, i) =>
        soldier(
          'guard-' + i,
          config.A.x + (i % 2 ? 9 : -9),
          config.A.z + (i < 2 ? 8 : -8),
          'A',
        ),
      );
      this.allies = Array.from({ length: config.healthy }, (_, i) =>
        soldier('squad-' + i, config.B.x + (i - 1.5) * 3, config.B.z + 3, 'B'),
      ).concat(
        Array.from(
          { length: Math.min(config.capacity, config.wounded) },
          (_, i) =>
            soldier(
              'wounded-' + i,
              config.B.x + (i - 1) * 3,
              config.B.z + 9,
              'B',
              true,
            ),
        ),
      );
      this.rescued = 0;
      this.delivered = 0;
      this.stars = 0;
      this.deliveryHold = 0;
      this.reason = '';
      // Pertenencia O(1) sin reconstruir la lista de activos en cada daño.
      this._soldiers = new Set(this.guards.concat(this.allies));
    }
    activeSoldiers() {
      return this.guards
        .concat(this.allies)
        .filter((a) => !['A_BORDO', 'SEGURO_EN_C', 'CAIDO'].includes(a.state));
    }
    damageSoldier(a, damage = 1, reason = 'combate') {
      // Misma condición que activeSoldiers(), sin reconstruir la lista:
      // pertenencia a la misión y estado aún activo.
      if (
        !this._soldiers.has(a) ||
        ['A_BORDO', 'SEGURO_EN_C', 'CAIDO'].includes(a.state)
      )
        return false;
      if (
        a.wounded &&
        ['INICIO_A', 'COMBATE_RUTA_AB', 'DESPEJAR_B'].includes(this.stage)
      )
        return false;
      a.hp -= damage;
      if (a.hp <= 0) {
        a.hp = 0;
        a.state = 'CAIDO';
        a.cause = reason;
        a.hold = 0;
        this.events.push({ type: 'soldier-fallen', id: a.id, reason });
        return true;
      }
      return false;
    }
    threats(enemies = []) {
      // Los coches de la Misión 2 no cuentan como amenaza: son
      // vehículos de suministros sin armas que pasan por el circuito
      // hacia el portal; si bloquearan el embarque, el jugador
      // tendría que cazar cada coche que pasa para poder embarcar.
      return enemies.filter(
        (e) =>
          !e.dead &&
          e.hp > 0 &&
          e.k !== 'car' &&
          Math.hypot(e.x - this.rules.B.x, e.z - this.rules.B.z) <=
            this.rules.perimeter,
      );
    }
    defend(a, dt, env) {
      a.cooldown = Math.max(0, a.cooldown - dt);
      if (a.wounded || a.state === 'CAIDO' || a.state === 'SEGURO_EN_C')
        return null;
      const origin = { x: a.x, y: env.groundAt(a.x, a.z) + 1.5, z: a.z };
      let target = null,
        range = this.rules.allyRange;
      for (const e of env.enemies || []) {
        const distance = Math.hypot(e.x - a.x, e.z - a.z);
        const aim = { x: e.x, y: e.y + (e.k === 'heli' ? 0 : 1.5), z: e.z };
        if (
          e.dead ||
          e.hp <= 0 ||
          distance > range ||
          env.cover?.trace(origin, aim)
        )
          continue;
        target = e;
        range = distance;
      }
      if (target) {
        a.yaw = Math.atan2(target.x - a.x, target.z - a.z);
        if (a.cooldown <= 0) {
          a.cooldown = this.rules.allyCooldown;
          env.fireAlly?.(
            origin,
            {
              x: target.x,
              y: target.y + (target.k === 'heli' ? 0 : 1.5),
              z: target.z,
            },
            a,
          );
        }
      }
      return target;
    }
    stepSoldiers(dt, env) {
      // Presupuesto de rutas por frame: un A* es el trabajo más caro del
      // paso (hasta decenas de ms si la meta está bloqueada). Si varios
      // soldados se atascan a la vez, solo uno recalcula por frame; los
      // demás reintentan en el siguiente sin perder su turno (su
      // repathCooldown sigue a 0).
      let repaths = 0;
      for (const a of this.activeSoldiers()) {
        const enemy = this.defend(a, dt, env);
        if (
          a.group === 'A' ||
          a.wounded ||
          !['ESCOLTAR_BC', 'ENTREGA_C'].includes(this.stage)
        )
          continue;
        a.state = enemy ? 'EN_COMBATE' : 'MARCHANDO_A_C';
        a.combatTime = enemy ? (a.combatTime || 0) + dt : 0;
        if (enemy && a.combatTime < this.rules.combatPause) continue;
        const route = this.rules.routeBC,
          i = Math.min(a.waypoint, route.length - 1),
          before = route[Math.max(0, i - 1)],
          after = route[Math.min(route.length - 1, i + 1)],
          length = Math.hypot(after[0] - before[0], after[1] - before[1]) || 1,
          lane =
            (Number(a.id.split('-')[1]) - (this.rules.healthy - 1) / 2) *
            this.rules.separation,
          target = {
            x: route[i][0] - ((after[1] - before[1]) / length) * lane,
            z: route[i][1] + ((after[0] - before[0]) / length) * lane,
          };
        a.repathCooldown = Math.max(0, (a.repathCooldown || 0) - dt);
        const direct = { ...target };
        if (
          !a.detour?.length &&
          env.cover?.overlaps?.(
            {
              x: target.x,
              y: env.groundAt(target.x, target.z) + 1.5,
              z: target.z,
            },
            this.rules.soldierRadius,
            this.rules.soldierHalfHeight,
          ) &&
          a.waypoint < route.length - 1
        ) {
          a.waypoint++;
          a.bestDistance = Infinity;
          continue;
        }
        if (a.detour?.length) Object.assign(target, a.detour[0]);
        const dx = target.x - a.x,
          dz = target.z - a.z,
          d = Math.hypot(dx, dz),
          step = Math.min(d, this.rules.soldierSpeed * dt);
        if (d < 0.8) {
          if (a.detour?.length) {
            a.detour.shift();
            a.bestDistance = Infinity;
            a.stuck = 0;
            continue;
          }
          a.waypoint++;
          a.stuck = 0;
          a.bestDistance = Infinity;
          if (a.waypoint >= route.length) {
            a.state = 'SEGURO_EN_C';
            this.delivered++;
            this.events.push({ type: 'arrived', id: a.id });
          }
          continue;
        }
        const origin = { x: a.x, y: env.groundAt(a.x, a.z) + 1.5, z: a.z };
        let goal = {
          x: a.x + (dx / d) * step,
          y: origin.y,
          z: a.z + (dz / d) * step,
        };
        let next = env.cover
          ? env.cover.move(
              origin,
              goal,
              this.rules.soldierRadius,
              this.rules.soldierHalfHeight,
            )
          : goal;
        // Small local detours use the same swept collision query and speed limit.
        if (Math.hypot(next.x - a.x, next.z - a.z) < step * 0.2 && env.cover) {
          for (const turn of [
            -Math.PI / 4,
            Math.PI / 4,
            -Math.PI / 2,
            Math.PI / 2,
          ]) {
            const yaw = Math.atan2(dx, dz) + turn;
            const q = env.cover.move(
              origin,
              {
                x: a.x + Math.sin(yaw) * step,
                y: origin.y,
                z: a.z + Math.cos(yaw) * step,
              },
              this.rules.soldierRadius,
              this.rules.soldierHalfHeight,
            );
            if (
              Math.hypot(q.x - a.x, q.z - a.z) >
              Math.hypot(next.x - a.x, next.z - a.z)
            )
              next = q;
          }
        }
        a.yaw = Math.atan2(next.x - a.x, next.z - a.z);
        a.x = next.x;
        a.z = next.z;
        const remaining = Math.hypot(target.x - a.x, target.z - a.z);
        if (remaining < (a.bestDistance ?? Infinity) - 0.05) {
          a.bestDistance = remaining;
          a.stuck = 0;
        } else a.stuck += dt;
        if (a.stuck > 0.8 && a.repathCooldown <= 0 && env.cover) {
          if (repaths < 1) {
            repaths++;
            a.repathCooldown = 3;
            const path = Navigation.path(
              a,
              direct,
              env.cover,
              env.groundAt,
              this.rules.soldierRadius,
              this.rules.soldierHalfHeight,
            );
            if (path) {
              a.detour = path;
              a.bestDistance = Infinity;
              a.stuck = 0;
            } else {
              // Sin ruta dentro del presupuesto: no insistir cada 3 s.
              // El soldado sigue deslizándose por el obstáculo y el
              // próximo intento espera 6 s.
              a.repathCooldown = 6;
            }
          }
        }
        if (a.stuck >= this.rules.stuckSeconds)
          this.damageSoldier(a, a.hp, 'atasco');
      }
    }
    update(dt, player, env = {}) {
      if (this.complete || this.failed) return null;
      dt = Math.max(0, Math.min(dt, 0.1));
      env.groundAt = env.groundAt || (() => 0);
      this.stepSoldiers(dt, env);
      if (this.allies.every((a) => a.state === 'CAIDO')) {
        this.reason = 'Todo el pelotón ha caído';
        this.transition('FRACASADA');
        return 'failed';
      }
      // Garajes y coches (Misión 2): cada garaje vivo suelta un
      // coche cada 20 s; el evento 'spawn-car' lo crea el juego con
      // la ruta del garaje. Si han pasado 15 coches por el portal
      // (como en el original), la misión fracasa. El fallo se
      // comprueba aquí, una vez por frame, para que no dependa de
      // que el juego drene los eventos en ese mismo frame.
      for (const g of this.garages) {
        if (g.destroyed) continue;
        g.timer -= dt;
        if (g.timer <= 0) {
          g.timer += this.carSpawnInterval;
          this.events.push({
            type: 'spawn-car',
            garage: g.id,
            x: g.x,
            z: g.z,
            route: g.route.map((p) => [...p]),
          });
        }
      }
      if (this.carsEscaped >= this.carsLimit) {
        this.reason =
          'Demasiados coches pasaron por el portal (' +
          this.carsEscaped +
          '/' +
          this.carsLimit +
          ')';
        this.transition('FRACASADA');
        return 'failed';
      }
      // Helicóptero Tan (Misión 3): anotar dónde está para que la
      // brújula apunte a él mientras la batería sigue escondida.
      if (this.tanHeliId) {
        const heli = (env.enemies || []).find(
          (e) => e.id === this.tanHeliId && !e.dead && e.hp > 0,
        );
        this.tanHeliPos = heli ? { x: heli.x, z: heli.z } : null;
      }
      // Tren (Misión 3): en marcha, avanza por la vía a 6 u/s y se
      // detiene al llegar a la base verde de C.
      if (this.train && this.train.state === 'moving') {
        this.train.s = Math.min(
          this.train.length,
          this.train.s + this.train.speed * dt,
        );
        Object.assign(this.train, positionAlong(this.train.route, this.train.s));
        if (this.train.s >= this.train.length) this.train.state = 'arrived';
      }
      if (
        this.stage === 'INICIO_A' &&
        Math.hypot(player.x - this.start.x, player.z - this.start.z) > 12
      )
        this.transition('COMBATE_RUTA_AB');
      if (
        this.stage === 'COMBATE_RUTA_AB' &&
        Math.hypot(player.x - this.rules.B.x, player.z - this.rules.B.z) <=
          this.rules.arrivalB
      )
        this.transition('DESPEJAR_B');
      const threats = this.threats(env.enemies);
      if (this.stage === 'DESPEJAR_B' && !threats.length)
        this.transition('EMBARCAR_HERIDOS');
      this.message = objectives[this.stage];
      if (this.stage === 'EMBARCAR_HERIDOS') {
        const stable = !env.moving && !env.firing && !env.damaged;
        const waiting = this.allies.filter(
          (a) =>
            a.wounded && ['HERIDO_ESPERANDO', 'ABORDANDO'].includes(a.state),
        );
        const candidate =
          stable && !threats.length
            ? waiting.find(
                (a) =>
                  Math.hypot(a.x - player.x, a.z - player.z) <=
                  this.rules.pickupRadius,
              )
            : null;
        for (const a of waiting) {
          if (a !== candidate) {
            a.hold = 0;
            a.state = 'HERIDO_ESPERANDO';
          }
        }
        if (threats.length)
          this.message =
            'Elimina la amenaza alrededor de B · Abordaje bloqueado';
        if (
          candidate &&
          this.allies.filter((a) => a.state === 'A_BORDO').length <
            this.rules.capacity
        ) {
          candidate.state = 'ABORDANDO';
          candidate.hold += dt;
          this.message =
            'Recoge a los heridos · ' +
            Math.min(
              100,
              Math.round((candidate.hold / this.rules.pickupSeconds) * 100),
            ) +
            '%';
          if (candidate.hold >= this.rules.pickupSeconds - 1e-9) {
            candidate.state = 'A_BORDO';
            candidate.hold = 0;
            this.rescued++;
            this.events.push({ type: 'boarded', id: candidate.id });
          }
        }
        if (
          !this.allies.some(
            (a) =>
              a.wounded && ['HERIDO_ESPERANDO', 'ABORDANDO'].includes(a.state),
          )
        ) {
          this.transition('ESCOLTAR_BC');
          for (const a of this.allies)
            if (!a.wounded && a.state !== 'CAIDO') a.state = 'MARCHANDO_A_C';
        }
      }
      const atC =
        Math.hypot(player.x - this.finish.x, player.z - this.finish.z) <=
        this.rules.deliveryRadius;
      const walking = this.allies.filter(
        (a) => !a.wounded && a.state !== 'CAIDO',
      );
      if (
        this.stage === 'ESCOLTAR_BC' &&
        (atC || walking.every((a) => a.state === 'SEGURO_EN_C'))
      )
        this.transition('ENTREGA_C');
      if (this.stage === 'ENTREGA_C') {
        const stable = atC && !env.moving && !env.firing && !env.damaged;
        this.deliveryHold = stable ? this.deliveryHold + dt : 0;
        if (this.deliveryHold >= this.rules.deliverySeconds - 1e-9) {
          for (const a of this.allies)
            if (a.state === 'A_BORDO') {
              a.x = this.finish.x + (Number(a.id.split('-')[1]) - 1) * 2;
              a.z = this.finish.z + 4;
              a.state = 'SEGURO_EN_C';
              this.delivered++;
              this.events.push({ type: 'delivered', id: a.id });
            }
        }
        const survivors = this.allies.filter((a) => a.state !== 'CAIDO');
        if (
          survivors.length &&
          survivors.every((a) => a.state === 'SEGURO_EN_C')
        ) {
          // Misión 3: el tren aún no ha llegado a C; la misión se
          // queda esperando en ENTREGA_C (el mensaje dice qué falta:
          // la batería o el tren).
          if (this.train && this.train.state !== 'arrived') {
            // Sigue en ENTREGA_C.
          } else if (this.cargo && this.cargo.state !== 'delivered') {
            // Misión con carga (Misión 1): la entrega en C no
            // cierra la misión; queda la caja y el portal.
            this.transition('CARGA_PORTAL');
          } else if (this.garages.some((g) => !g.destroyed)) {
            // Misión 2: quedan garajes Tan por destruir.
            this.transition('GARAJES');
          } else if (this.train) {
            // Misión 3: tren en C y batería entregada; queda salir
            // por el portal.
            this.transition('PORTAL');
          } else {
            this.stars = this.computeStars();
            this.transition('COMPLETADA');
            return 'complete';
          }
        }
      }
      // Winch de la carga: la caja de la Misión 1 se puede levantar
      // desde que el pelotón empieza a marchar (y en la fase final,
      // por si no se levantó antes); la batería de la Misión 3, en
      // cualquier fase una vez caída. Como el embarque de heridos:
      // quieto, sin disparar y sin daño, 1,5 s sobre la carga. La
      // carga colgando no impide escoltar ni entregar en C; el
      // portal de la Misión 1 solo cierra la misión en CARGA_PORTAL,
      // tras la entrega en C; la batería se entrega en la plataforma
      // del tren, en cualquier fase, y al entregarla el tren arranca.
      if (
        this.cargo &&
        (this.cargo.winchFrom === 'any' ||
          ['ESCOLTAR_BC', 'ENTREGA_C', 'CARGA_PORTAL'].includes(
            this.stage,
          ))
      ) {
        const c = this.cargo;
        const label =
          c.kind === 'battery' ? 'la batería' : 'la caja de plástico';
        if (c.state === 'waiting') {
          const distance = Math.hypot(player.x - c.x, player.z - c.z),
            stable = !env.moving && !env.firing && !env.damaged,
            // El consejo del winch se muestra en la fase final de la
            // Misión 1 (la caja es el objetivo) y siempre que el
            // jugador esté sobre la carga (sea cual sea la fase).
            showWinch =
              this.stage === 'CARGA_PORTAL' ||
              distance <= this.winchRadius;
          if (distance <= this.winchRadius && stable) {
            c.hold += dt;
            if (showWinch)
              this.message =
                'Levanta ' +
                label +
                ' con el cable · ' +
                Math.min(
                  100,
                  Math.round((c.hold / this.winchSeconds) * 100),
                ) +
                '%';
            if (c.hold >= this.winchSeconds - 1e-9) {
              c.state = 'carried';
              c.hold = 0;
              this.events.push({ type: 'cargo-lifted' });
              if (this.stage === 'CARGA_PORTAL')
                this.message = 'Lleva la caja por el portal';
            }
          } else {
            c.hold = 0;
            if (showWinch)
              this.message =
                distance <= this.winchRadius
                  ? 'Quédate quieto para enganchar ' + label
                  : 'Vuela hasta ' + label;
          }
        } else if (c.state === 'carried') {
          if (c.deliverAt) {
            // Misión 3: la batería se entrega en la plataforma del
            // tren; al entregarla, el tren arranca.
            const distance = Math.hypot(
              player.x - c.deliverAt.x,
              player.z - c.deliverAt.z,
            );
            if (distance <= c.deliverAt.radius) {
              c.state = 'delivered';
              this.events.push({ type: 'cargo-delivered' });
              if (this.train && this.train.state === 'waiting') {
                this.train.state = 'moving';
                this.events.push({ type: 'train-started' });
              }
            }
          } else if (this.stage === 'CARGA_PORTAL') {
            // Misión 1: la caja se entrega en el portal, en la fase
            // final; al pasar por él, la misión se completa.
            const distance = Math.hypot(
              player.x - this.portal.x,
              player.z - this.portal.z,
            );
            this.message = 'Lleva la caja por el portal';
            if (distance <= this.portal.radius) {
              c.state = 'delivered';
              this.events.push({ type: 'cargo-delivered' });
              this.stars = this.computeStars();
              this.transition('COMPLETADA');
              this.message =
                'Caja entregada por el portal · Misión completa';
              return 'complete';
            }
          }
        }
      }
      // Volar sobre el portal sin la caja, en la fase final, antes
      // no hacía nada en absoluto: en la grabación el jugador daba
      // vueltas sobre el portal sin saber qué faltaba. Ahora avisa
      // (limitado a una vez cada 5 s) en vez de quedarse en silencio.
      if (
        this.stage === 'CARGA_PORTAL' &&
        this.cargo &&
        this.cargo.state === 'waiting' &&
        this.portal &&
        Math.hypot(player.x - this.portal.x, player.z - this.portal.z) <=
          this.portal.radius
      ) {
        this._portalHintSecs = (this._portalHintSecs || 0) + dt;
        if (this._portalHintSecs >= 5) {
          this._portalHintSecs = 0;
          this.events.push({ type: 'portal-without-cargo' });
        }
      } else {
        this._portalHintSecs = 0;
      }
      // Fase de los garajes (Misión 2): al destruir el último
      // garaje, la misión se completa (el rescate ya está hecho).
      if (this.stage === 'GARAJES' && !this.garages.some((g) => !g.destroyed)) {
        this.stars = this.computeStars();
        this.transition('COMPLETADA');
        return 'complete';
      }
      // Salida por el portal (Misión 3): al volar por el portal, la
      // misión se completa (el tren ya está en C).
      if (this.stage === 'PORTAL' && this.portal) {
        const distance = Math.hypot(
          player.x - this.portal.x,
          player.z - this.portal.z,
        );
        if (distance <= this.portal.radius) {
          this.stars = this.computeStars();
          this.transition('COMPLETADA');
          return 'complete';
        }
      }
      const marching = this.allies.filter(
        (a) => !a.wounded && !['CAIDO', 'SEGURO_EN_C'].includes(a.state),
      );
      this.remaining = marching.length;
      this.lagDistance = Math.round(
        Math.max(
          0,
          ...marching.map((a) => Math.hypot(a.x - player.x, a.z - player.z)),
        ),
      );
      if (['ESCOLTAR_BC', 'ENTREGA_C'].includes(this.stage)) {
        // "En marcha" son los sanos que caminan hacia C y "Más
        // rezagado" es la distancia en unidades al soldado más
        // alejado del helicóptero: en la grabación el panel decía
        // "En camino: 4 · Distancia: 100" sin explicar ni qué ni en qué.
        this.message +=
          ' · En marcha: ' +
          this.remaining +
          ' · Más rezagado: ' +
          this.lagDistance +
          ' u';
        // La caja sigue pendiente: que el HUD recuerde que hay que
        // levantarla en B (se puede hacer ya, el jugador está allí).
        // Solo la caja de la Misión 1: la batería de la Misión 3 va
        // con su propio sufijo, más abajo.
        if (this.cargo && this.cargo.kind === 'crate') {
          if (this.cargo.state === 'waiting')
            this.message += ' · Caja en B por levantar';
          else if (this.cargo.state === 'carried')
            this.message += ' · Caja colgando';
        }
      }
      // Misión 2: garajes y coches en el HUD en todas las fases (los
      // coches empiezan a salir desde el principio y el jugador
      // siempre debe saber cuántos han pasado del portal).
      if (this.garages.length) {
        const destroyed = this.garages.filter((g) => g.destroyed).length;
        this.message +=
          ' · Garajes ' +
          destroyed +
          '/' +
          this.garages.length +
          ' · Coches ' +
          this.carsEscaped +
          '/' +
          this.carsLimit;
      }
      // Misión 3: batería y tren en el HUD en todas las fases.
      if (this.train && this.cargo) {
        const batteryWord =
          this.cargo.state === 'hidden'
            ? 'en el helicóptero'
            : this.cargo.state === 'waiting'
              ? 'caída'
              : this.cargo.state === 'carried'
                ? 'colgando'
                : 'en el tren';
        const trainWord =
          this.train.state === 'waiting'
            ? 'en la base'
            : this.train.state === 'moving'
              ? 'en camino'
              : 'en C';
        this.message +=
          ' · Batería ' + batteryWord + ' · Tren ' + trainWord;
      }
      const blocked = this.allies.filter((a) => a.cause === 'atasco').length;
      if (blocked) this.message += ' · Atascados: ' + blocked;
      return null;
    }
    // Estrellas por supervivientes del pelotón (3 si sobrevive al
    // menos el 85 %, 2 si al menos la mitad, 1 en otro caso).
    computeStars() {
      const survivors = this.allies.filter((a) => a.state !== 'CAIDO');
      const ratio = survivors.length / this.allies.length;
      return ratio >= 0.85 ? 3 : ratio >= 0.5 ? 2 : 1;
    }
    transition(next) {
      if (this.complete || this.failed || next === this.stage) return false;
      if (next !== 'FRACASADA' && !transitions[this.stage].includes(next))
        return false;
      const previous = this.stage;
      this.stage = next;
      this.message = objectives[next];
      this.complete = next === 'COMPLETADA';
      this.failed = next === 'FRACASADA';
      this.events.push({ type: 'stage', previous, next });
      return true;
    }
    drainEvents() {
      return this.events.splice(0);
    }
    enemyEliminated(enemy) {
      this.events.push({ type: 'enemy-eliminated', id: enemy.id });
      this.kills++;
      // Garaje Tan (Misión 2): deja de soltar coches.
      const garage = this.garages.find((g) => g.id === enemy.id);
      if (garage && !garage.destroyed) {
        garage.destroyed = true;
        this.events.push({ type: 'garage-destroyed', id: garage.id });
      }
      // Coche de suministros (Misión 2): abatido antes del portal.
      if (enemy.k === 'car') {
        this.carsDestroyed++;
        this.events.push({ type: 'car-destroyed', id: enemy.id });
      }
      // Helicóptero Tan (Misión 3): al morir, suelta la batería
      // donde cae; el juego puede acercarla a un punto volable.
      if (
        this.tanHeliId &&
        enemy.id === this.tanHeliId &&
        this.cargo &&
        this.cargo.state === 'hidden'
      ) {
        this.cargo.x = enemy.x;
        this.cargo.z = enemy.z;
        this.cargo.state = 'waiting';
        this.events.push({ type: 'battery-dropped', x: enemy.x, z: enemy.z });
      }
    }
    // Un coche llegó al portal de los coches (Misión 2): cuenta para
    // el límite de 15; el fallo se detecta en el siguiente update.
    carEscaped(car) {
      this.carsEscaped++;
      this.events.push({ type: 'car-escaped', id: car.id });
    }
    // La batería, caída donde murió el helicóptero Tan, se acerca a
    // un punto volable (Misión 3): el juego la coloca donde el
    // helicóptero puede llegar con el winch.
    placeBattery(x, z) {
      if (this.cargo && this.cargo.state === 'waiting') {
        this.cargo.x = x;
        this.cargo.z = z;
      }
    }
    target(player = this.rules.B) {
      // Fase de la carga: la brújula apunta a la caja y luego al
      // portal. Antes, la escolta manda: el objetivo sigue siendo C
      // (la caja se menciona en el mensaje, sin desviar la brújula).
      if (this.stage === 'CARGA_PORTAL' && this.cargo) {
        return this.cargo.state === 'carried'
          ? this.portal
          : { x: this.cargo.x, z: this.cargo.z };
      }
      // Fase de los garajes (Misión 2): la brújula apunta al garaje
      // vivo más cercano.
      if (this.stage === 'GARAJES') {
        const alive = this.garages.filter((g) => !g.destroyed);
        if (alive.length)
          return alive.reduce((a, b) =>
            Math.hypot(a.x - player.x, a.z - player.z) <
            Math.hypot(b.x - player.x, b.z - player.z)
              ? a
              : b,
          );
      }
      // Salida por el portal (Misión 3): la brújula apunta al portal.
      if (this.stage === 'PORTAL' && this.portal) return this.portal;
      // Misión 3, esperando al tren en C: la brújula apunta a lo que
      // falta —la batería caída, la plataforma si la llevas colgando,
      // el helicóptero Tan si aún la tiene, o el tren si va en camino.
      if (this.stage === 'ENTREGA_C' && this.train) {
        if (this.cargo && this.cargo.state === 'waiting')
          return { x: this.cargo.x, z: this.cargo.z };
        if (this.cargo && this.cargo.state === 'carried' && this.batteryPad)
          return this.batteryPad;
        if (this.cargo && this.cargo.state === 'hidden' && this.tanHeliPos)
          return this.tanHeliPos;
        if (this.train.state === 'moving')
          return { x: this.train.x, z: this.train.z };
      }
      if (this.stage === 'EMBARCAR_HERIDOS') {
        const waiting = this.allies.filter(
          (a) =>
            a.wounded && ['HERIDO_ESPERANDO', 'ABORDANDO'].includes(a.state),
        );
        if (waiting.length)
          return waiting.reduce((a, b) =>
            Math.hypot(a.x - player.x, a.z - player.z) <
            Math.hypot(b.x - player.x, b.z - player.z)
              ? a
              : b,
          );
      }
      return this.stage === 'INICIO_A' ||
        this.stage === 'COMBATE_RUTA_AB' ||
        this.stage === 'DESPEJAR_B' ||
        this.stage === 'EMBARCAR_HERIDOS'
        ? this.rules.B
        : this.finish;
    }
    // Resumen de estado para el HUD (línea #inf). Hoy es el rescate
    // A → B → C; las misiones con objetivos nuevos (caja de plástico
    // y portal en la Misión 1, garajes y coches en la 2, tren y
    // batería en la 3) lo redefinen con sus propios contadores, sin
    // tocar ui.js. El texto de objetivo (`message`) y la marca de la
    // brújula (`target(jugador)`) ya vienen del estado de la misión.
    // Sin el prefijo "Misión X/3 ·": el panel ya lo pone en el
    // título y se duplicaba. "Bajas" era solo aliados caídos (en la
    // grabación decía 0 con varios tanques destruidos), así que se
    // llama "Caídos" y se añade el contador real de enemigos.
    hudSummary() {
      const base =
        'Heridos ' +
        this.rescued +
        '/' +
        this.allies.filter((a) => a.wounded).length +
        ' · A salvo ' +
        this.delivered +
        '/' +
        this.allies.length +
        ' · Caídos ' +
        this.allies.filter((a) => a.state === 'CAIDO').length +
        ' · Enemigos ' +
        this.kills;
      // Misión 2: garajes destruidos y coches que pasaron del portal.
      if (this.garages.length) {
        const destroyed = this.garages.filter((g) => g.destroyed).length;
        return (
          base +
          ' · Garajes ' +
          destroyed +
          '/' +
          this.garages.length +
          ' · Coches ' +
          this.carsEscaped +
          '/' +
          this.carsLimit
        );
      }
      // Misión 3: batería y tren.
      if (this.train && this.cargo) {
        const batteryWord =
          this.cargo.state === 'hidden'
            ? 'en el helicóptero'
            : this.cargo.state === 'waiting'
              ? 'caída'
              : this.cargo.state === 'carried'
                ? 'colgando'
                : 'en el tren';
        const trainWord =
          this.train.state === 'waiting'
            ? 'en la base'
            : this.train.state === 'moving'
              ? 'en camino'
              : 'en C';
        return base + ' · Batería ' + batteryWord + ' · Tren ' + trainWord;
      }
      // Misión 1: el estado de la caja y el portal, junto al rescate.
      if (!this.cargo) return base;
      const cargoLabel =
        this.cargo.state === 'carried'
          ? 'colgando'
          : this.cargo.state === 'delivered'
            ? 'entregada'
            : 'en B, por levantar';
      return base + ' · Caja ' + cargoLabel + ' · Portal';
    }
    // Vista de la carga para el renderizador (cable y caja colgando):
    // null en misiones sin carga. `progress` es 0–1 mientras el cable
    // engancha la carga; el estado es hidden/waiting/carried/
    // delivered; `kind` es 'crate' o 'battery'.
    cargoView() {
      if (!this.cargo) return null;
      return {
        kind: this.cargo.kind,
        state: this.cargo.state,
        x: this.cargo.x,
        z: this.cargo.z,
        progress: Math.min(1, this.cargo.hold / this.winchSeconds),
      };
    }
    // Vista del tren para el renderizador: null en misiones sin
    // tren. `x`, `z` e `yaw` son la posición actual sobre la vía;
    // `state` es waiting/moving/arrived.
    trainView() {
      if (!this.train) return null;
      return {
        x: this.train.x,
        z: this.train.z,
        yaw: this.train.yaw,
        state: this.train.state,
      };
    }
  }
  // Posición sobre una polilínea a la distancia `s` del inicio:
  // devuelve {x, z, yaw, s, length} (yaw, hacia dónde apunta el
  // tramo; `length`, la longitud total de la polilínea). Se usa para
  // el tren de la Misión 3, que avanza por la vía a velocidad
  // constante sin depender de los vértices.
  function positionAlong(route, s) {
    const segments = [];
    let length = 0;
    for (let i = 1; i < route.length; i++) {
      const [ax, az] = route[i - 1],
        [bx, bz] = route[i],
        len = Math.hypot(bx - ax, bz - az);
      segments.push({ ax, az, bx, bz, len, start: length });
      length += len;
    }
    s = Math.max(0, Math.min(length, s));
    let seg = segments[segments.length - 1];
    for (const candidate of segments) {
      if (s <= candidate.start + candidate.len) {
        seg = candidate;
        break;
      }
    }
    const t = seg.len ? (s - seg.start) / seg.len : 0;
    return {
      x: seg.ax + (seg.bx - seg.ax) * t,
      z: seg.az + (seg.bz - seg.az) * t,
      yaw: Math.atan2(seg.bx - seg.ax, seg.bz - seg.az),
      s,
      length,
    };
  }
  return { Mission, transitions, objectives, positionAlong };
});
