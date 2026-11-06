const test = require('node:test'),
  assert = require('node:assert/strict');
const { Mission, objectives } = require('../src/escort-mission.js');
test('escort transitions reject skips and emit each authorized transition once', () => {
  const m = new Mission();
  assert.equal(m.transition('COMPLETADA'), false);
  for (const next of [
    'COMBATE_RUTA_AB',
    'DESPEJAR_B',
    'EMBARCAR_HERIDOS',
    'ESCOLTAR_BC',
    'ENTREGA_C',
    'COMPLETADA',
  ]) {
    assert.equal(m.transition(next), true);
    assert.equal(m.message, objectives[next]);
    assert.equal(m.transition(next), false);
  }
  assert.equal(m.drainEvents().length, 6);
  assert.equal(m.drainEvents().length, 0);
  assert.equal(m.transition('FRACASADA'), false);
});
