const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { game } = require('../support/fake-host.cjs');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
const uiSrc = fs.readFileSync(path.join(__dirname, '../src/ui.js'), 'utf8');
// Solo el HUD, no el menú de ajustes ni los comentarios del código.
const hud = html.slice(html.indexOf('<div id="hud">'), html.indexOf('</div>\n</div>\n<script'));

// El HUD ya no trae la insignia «3D · Plástico» ni el botón de
// gráficos, y las barras de arriba quedan ocultas.
test('el HUD limpio no trae insignia 3D ni botón de gráficos y oculta las barras de arriba', () => {
  assert.ok(!hud.includes('renderMode'), 'sin #renderMode en el HUD');
  assert.ok(!hud.includes('id="quality"'), 'sin #quality en el HUD');
  assert.ok(!hud.includes('3D · Plástico'), 'sin insignia 3D en el HUD');
  assert.ok(!hud.includes('Gráficos'), 'sin etiqueta de gráficos en el HUD');
  assert.ok(hud.includes('id="missionBtn"'), 'con botón Misión');
  assert.ok(hud.includes('id="missionPanel"'), 'con panel de Misión');
  assert.ok(hud.includes('id="missionClose"'), 'con botón Cerrar');
  // Las barras siguen en el DOM pero ocultas por defecto.
  assert.ok(
    hud.includes('<div id="objective" role="status" style="display:none">'),
    '#objective oculta',
  );
  assert.ok(
    hud.includes('<div id="inf" style="display:none">'),
    '#inf oculta',
  );
  assert.ok(!uiSrc.includes("$('renderMode')"), 'ui.js ya no toca renderMode');
  assert.ok(!uiSrc.includes("$('quality')"), 'ui.js ya no toca #quality');
  assert.ok(css.includes('#missionBtn'), 'CSS del botón Misión');
  assert.ok(css.includes('#missionPanel'), 'CSS del panel de Misión');
  assert.ok(!css.includes('#renderMode'), 'sin CSS de renderMode');
  assert.ok(!css.includes('#quality {'), 'sin CSS del botón de gráficos');
});

// El panel muestra los detalles de la misión en curso y se cierra
// con el mismo botón o con Cerrar; sin partida no se abre.
test('el panel de Misión muestra nombre, objetivo, progreso y puntos, y se abre y se cierra', () => {
  const g = game();
  // Sin partida (menú), el botón no abre nada.
  g.element('missionBtn').onclick();
  assert.equal(g.element('missionPanel').style.display, 'none');
  g.element('go').onclick();
  assert.equal(g.state.st, 'play');
  g.element('missionBtn').onclick();
  assert.equal(g.element('missionPanel').style.display, 'block');
  assert.match(g.element('missionTitle').textContent, /Misión 1\/3 · Pandemonio de Plástico/);
  assert.ok(g.element('missionObjective').textContent.length > 0);
  assert.match(g.element('missionSummary').textContent, /Heridos 0\/\d+ · A salvo 0\/\d+ · Bajas 0/);
  assert.match(g.element('missionSummary').textContent, /Caja en tierra · Portal/);
  assert.match(g.element('missionPoints').textContent, /Puntos: \d+/);
  // Cerrar con el botón Cerrar.
  g.element('missionClose').onclick();
  assert.equal(g.element('missionPanel').style.display, 'none');
  // Reabrir y cerrar con el mismo botón Misión.
  g.element('missionBtn').onclick();
  assert.equal(g.element('missionPanel').style.display, 'block');
  g.element('missionBtn').onclick();
  assert.equal(g.element('missionPanel').style.display, 'none');
});

// El resumen del panel es genérico: garajes y coches en la 2,
// batería y tren en la 3.
test('el panel muestra el resumen propio de las misiones 2 y 3', () => {
  const g2 = game();
  g2.app.start(2, true);
  g2.element('missionBtn').onclick();
  assert.match(g2.element('missionTitle').textContent, /Misión 2\/3 · Locura de coches/);
  assert.match(g2.element('missionSummary').textContent, /Garajes 0\/3 · Coches 0\/15/);
  g2.element('missionClose').onclick();

  const g3 = game();
  g3.app.start(3, true);
  g3.element('missionBtn').onclick();
  assert.match(g3.element('missionTitle').textContent, /Misión 3\/3 · El tren que pudo/);
  assert.match(g3.element('missionSummary').textContent, /Batería en el helicóptero · Tren en la base/);
  g3.element('missionClose').onclick();
});

// Con el panel abierto la simulación se congela y al cerrarlo avanza.
test('el panel de Misión congela la simulación y al cerrarlo se reanuda', () => {
  const g = game(),
    s = g.state;
  g.app.start(1, true);
  // Unos frames con el juego en marcha: el tiempo avanza.
  for (let i = 1; i <= 30; i++) g.app.loop((i * 1000) / 60);
  const t0 = s.t;
  assert.ok(t0 > 0);
  g.element('missionBtn').onclick();
  assert.equal(g.element('missionPanel').style.display, 'block');
  for (let i = 31; i <= 90; i++) g.app.loop((i * 1000) / 60);
  assert.equal(s.t, t0, 'el tiempo no avanza con el panel abierto');
  assert.equal(s.st, 'play', 'el estado sigue en play, solo se congela upd');
  g.element('missionClose').onclick();
  assert.equal(g.element('missionPanel').style.display, 'none');
  for (let i = 91; i <= 120; i++) g.app.loop((i * 1000) / 60);
  assert.ok(s.t > t0, 'el tiempo avanza al cerrar el panel');
});

// La calidad sigue cambiándose desde Ajustes (y el degradado
// automático sigue vivo), aunque ya no haya botón en el HUD.
test('la calidad se cambia desde Ajustes y se guarda, sin botón en el HUD', () => {
  const g = game();
  g.element('menuSettings').onclick();
  assert.equal(g.element('menuQuality').textContent, 'Calidad: completa');
  g.element('menuQuality').onclick();
  assert.equal(g.saved.get('toy-quality'), 'low');
  assert.equal(g.element('menuQuality').textContent, 'Calidad: ahorro');
  g.element('menuQuality').onclick();
  assert.equal(g.saved.get('toy-quality'), 'detail');
  assert.equal(g.element('menuQuality').textContent, 'Calidad: completa');
});

// Al abrir un menú con el panel abierto, el panel se cierra.
test('al pausar con el panel abierto, el panel se cierra y la pausa manda', () => {
  const g = game();
  g.app.start(1, true);
  g.element('missionBtn').onclick();
  assert.equal(g.element('missionPanel').style.display, 'block');
  g.app.pauseGame();
  assert.equal(g.state.st, 'paused');
  assert.equal(g.element('missionPanel').style.display, 'none');
  assert.equal(g.state.missionPanelOpen, false);
});
