const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('../support/fake-host.cjs');
const bootstrap = require('../src/bootstrap.js');

test('el juego instala el logger y Supabase offline como invitado', async () => {
  const g = game();
  assert.equal(typeof g.app.view.logger.record, 'function');
  assert.equal(typeof g.app.view.online.saveScore, 'function');
  assert.equal(g.app.view.online.configured(), false);
  assert.equal(g.app.view.logsVisible, false);
  g.host.emit('error', { message: 'fallo en partida' });
  assert.equal(g.app.view.logger.count, 1);
  assert.equal(g.app.view.logger.list()[0].message, 'fallo en partida');
  // Un frame largo queda anotado como congelamiento.
  assert.equal(g.app.view.logger.noteFrame(600).type, 'freeze');
  // Como invitado, la puntuación queda en cola local, no se pierde.
  const saved = await g.app.view.online.saveScore({
    mission: 1,
    score: 100,
    stars: 2,
    survivors: 3,
  });
  assert.equal(saved.queued, true);
  assert.equal(g.app.view.online.pendingCount(), 1);
});

test('el menú de cuenta y registro funciona sin servidor', async () => {
  const g = game();
  g.app.ui.menuPage('account');
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(g.element('accountStatus').textContent, /invitado/i);
  assert.match(g.element('scoresList').textContent, /Sin conexión/i);
  g.app.view.logger.record('error', 'prueba de registro');
  g.app.ui.menuPage('logs');
  assert.match(g.element('logsText').textContent, /prueba de registro/);
  g.element('logsClear').onclick();
  assert.equal(g.app.view.logger.count, 0);
  assert.match(g.element('logsText').textContent, /Sin entradas/);
});

test('bootstrap carga logger y Supabase antes del juego', () => {
  assert.ok(bootstrap.scripts.includes('logger'));
  assert.ok(bootstrap.scripts.includes('supabase-env'));
  assert.ok(bootstrap.scripts.includes('supabase-config'));
  assert.ok(bootstrap.scripts.includes('supabase'));
  assert.ok(bootstrap.optionalScripts.includes('supabase-env'));
  assert.ok(
    bootstrap.scripts.indexOf('supabase-env') <
      bootstrap.scripts.indexOf('supabase-config'),
  );
  assert.ok(
    bootstrap.scripts.indexOf('supabase') < bootstrap.scripts.indexOf('game'),
  );
  assert.equal(bootstrap.VERSION, 'helicoptero-blender-3');
});
