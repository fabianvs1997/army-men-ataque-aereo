const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const uiSrc = fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8');

test('menú principal conserva ids, textos y enlaces del menú actual', () => {
  assert.ok(html.includes('<div id="ov" class="menu-main"'), 'overlay arranca como menú principal');
  for (const id of [
    'ti',
    'tx',
    'go',
    'menuNav',
    'menuHelp',
    'menuSettings',
    'menuAccount',
    'menuLogs',
    'menuCredits',
    'helpPane',
    'settingsPane',
    'accountPane',
    'logsPane',
    'creditsPane',
    'confirmPane',
    'back',
    'menuExit',
  ])
    assert.ok(html.includes('id="' + id + '"'), id);
  assert.ok(html.includes('href="original/index.html"'), 'enlace Volar en Alpina 1');
  assert.ok(html.includes('Volar en Alpina 1'));
  assert.ok(html.includes('Iniciar campaña'), 'botón principal en español');
  assert.ok(html.includes('OPERACIÓN PATIO TRASERO') || html.includes('Operación patio trasero'));
});

test('el menú principal deja ver el lienzo 3D con placa metálica y animación CSS', () => {
  assert.ok(css.includes('#ov.menu-main'), 'regla del overlay del menú principal');
  assert.ok(!css.includes('backdrop-filter: blur(8px)'), 'sin desenfoque caro sobre el 3D');
  assert.ok(css.includes('.menu-card::before'), 'tornillos de la placa');
  assert.ok(css.includes('radial-gradient(circle'), 'tornillos dibujados con CSS');
  assert.ok(css.includes('@keyframes menuCardIn'), 'entrada del panel');
  assert.ok(css.includes('@keyframes menuGoPulse'), 'brillo animado del botón principal');
  assert.ok(css.includes('#go::after'), 'recuadro verde animado de Iniciar campaña');
  assert.ok(css.includes('prefers-reduced-motion'), 'respeta movimiento reducido');
  assert.ok(css.includes('focus-visible') || css.includes(':focus-visible'), 'foco visible conservado');
});

test('ui.js marca el overlay como menú principal solo en la página main', () => {
  assert.ok(
    uiSrc.includes("classList.toggle('menu-main', page === 'main')"),
    'toggle de menu-main en menuLayout',
  );
  assert.ok(
    uiSrc.includes('if (ovEl.classList && ovEl.classList.toggle)'),
    'toggle protegido para el host de pruebas sin classList',
  );
});

test('sin assets binarios nuevos del menú (ni MP4 ni imagen del mockup)', () => {
  const assets = fs.readdirSync(path.join(root, 'assets'));
  assert.ok(
    !assets.some((f) => /menu.*\.(mp4|webp|png|jpg|jpeg)$/i.test(f)),
    'el menú usa el lienzo 3D en vivo, no un vídeo ni la imagen generada',
  );
});
