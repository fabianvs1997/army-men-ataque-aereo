(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports
      ? require('./escort-config.js')
      : root.ToyEscortConfig,
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyEscort = api;
})(globalThis, function (Config) {
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
        state: wounded ? 'HERIDO_ESPERANDO' : 'DEFENDIENDO_B',
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
      for (const a of this.activeSoldiers()) this.defend(a, dt, env);
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
    target() {
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
