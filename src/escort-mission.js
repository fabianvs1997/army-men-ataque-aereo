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
    ENTREGA_C: ['COMPLETADA'],
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
        name: 'Rescate A → B → C',
        bases: [],
        air: number,
        tanks: this.enemyPlan.filter((e) => e.k === 'tank').length,
        turrets: this.enemyPlan.filter((e) => e.k === 'tur').length,
        infantry: this.enemyPlan.filter((e) => e.k === 'inf').length,
      };
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
    }
    activeSoldiers() {
      return this.guards
        .concat(this.allies)
        .filter((a) => !['A_BORDO', 'SEGURO_EN_C', 'CAIDO'].includes(a.state));
    }
    damageSoldier(a, damage = 1, reason = 'combate') {
      if (!this.activeSoldiers().includes(a)) return false;
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
      return enemies.filter(
        (e) =>
          !e.dead &&
          e.hp > 0 &&
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
          const ratio = survivors.length / this.allies.length;
          this.stars = ratio >= 0.85 ? 3 : ratio >= 0.5 ? 2 : 1;
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
      if (['ESCOLTAR_BC', 'ENTREGA_C'].includes(this.stage))
        this.message +=
          ' · En camino: ' +
          this.remaining +
          ' · Distancia: ' +
          this.lagDistance;
      const blocked = this.allies.filter((a) => a.cause === 'atasco').length;
      if (blocked) this.message += ' · Bajas por bloqueo: ' + blocked;
      return null;
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
    }
    target(player = this.rules.B) {
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
  }
  return { Mission, transitions, objectives };
});
