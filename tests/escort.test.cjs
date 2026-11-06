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
test('A guards and B squad are distinct and all enemies are predeclared outside A', () => {
  const c = require('../src/escort-config.js'),
    World = require('../src/toy-world.js');
  for (let n = 1; n <= 3; n++) {
    const m = new Mission(n);
    assert.equal(m.guards.length, 4);
    assert.equal(m.allies.filter((a) => a.wounded).length, 3);
    assert.ok(m.guards.every((a) => a.group === 'A'));
    assert.ok(m.allies.every((a) => a.group === 'B'));
    assert.equal(new Set(m.guards.concat(m.allies).map((a) => a.id)).size, 11);
    assert.equal(m.enemyPlan.filter((e) => e.k === 'heli').length, n);
    for (const e of m.enemyPlan) {
      assert.ok(Math.hypot(e.x, e.z) > c.safeRadius + 3);
      assert.ok(World.canTravel(e.x, e.z), e.id);
    }
  }
});
