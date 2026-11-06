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
