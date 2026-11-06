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
