const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const Diorama = require('../src/menu-diorama.js');
const Renderer = require('../src/toy-renderer.js');

test('el diorama es determinista y trae la composición de la portada', () => {
  const a = Diorama.build(),
    b = Diorama.build();
  assert.deepEqual(a, b, 'dos construcciones idénticas, sin azar por frame');
  const byTag = {};
  for (const p of a) byTag[p.tag] = (byTag[p.tag] || 0) + 1;
  assert.equal(byTag.trunk, 9, '3 troncos (cilindro, raíz y corte)');
  assert.equal(byTag.canopy, 12, 'copas de los 3 troncos');
  assert.ok(byTag.tower >= 30, '2 torres con riostras');
  assert.equal(byTag.soldier, 5, 'soldado de guardia en una torre');
  assert.ok(byTag.tank >= 30, 'tanque de juguete completo');
  assert.equal(byTag.tent, 6, 'tienda con puerta y faldones');
  assert.equal(byTag.crate, 8, 'caja con centro hundido y nervaduras');
  assert.equal(byTag.ground, 2, 'suelo y camino');
  assert.ok(byTag.blade >= 40, 'hierba desproporcionada');
  for (const p of a) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), p.tag);
    assert.ok(p.sx > 0 && p.sy > 0 && p.sz > 0, p.tag);
    assert.equal(p.color.length, 3, p.tag);
    assert.ok(p.color.every((v) => v >= 0 && v <= 1), p.tag);
    assert.ok(['box', 'sphere', 'rounded', 'cylinder', 'cone'].includes(p.kind), p.kind);
  }
});

test('la cámara encuadra igual a 4:3 y 16:9 sin estirar (misma escala, pitch bajo)', () => {
  const c43 = Diorama.cameraFor(1440, 1080),
    c169 = Diorama.cameraFor(1920, 1080);
  assert.equal(c43.scale, Math.min(1440 / 72, 1080 / 50));
  assert.equal(c169.scale, Math.min(1920 / 72, 1080 / 50));
  assert.equal(c43.pitch, c169.pitch);
  assert.ok(c43.pitch < Math.PI / 4, 'cámara a ras de suelo, no picada');
  assert.ok(Number.isFinite(c43.centerY) && Number.isFinite(c169.centerY));
  const movil = Diorama.cameraFor(390, 844);
  assert.ok(movil.scale > 0 && Number.isFinite(movil.centerY), 'móvil en vertical');
});

test('el vaivén solo mece hierba, hojas, copas y soldados', () => {
  const parts = Diorama.build();
  const blade = parts.find((p) => p.tag === 'blade');
  assert.notEqual(Diorama.swayYaw(blade, 0), Diorama.swayYaw(blade, 2.5));
  const tankPart = parts.find((p) => p.tag === 'tank');
  assert.equal(Diorama.swayYaw(tankPart, 0), Diorama.swayYaw(tankPart, 2.5));
  assert.equal(Diorama.swayYaw(tankPart, 2.5), tankPart.yaw);
});

test('geometrías cilindro y cono del renderizador son finitas y dibujables', () => {
  for (const kind of ['cylinder', 'cone']) {
    const data = Renderer.geometry(kind);
    assert.ok(data.length > 0, kind);
    assert.equal(data.length % 6, 0, kind + ' con vértice+normal por vértice');
    assert.ok(data.every(Number.isFinite), kind);
  }
});

function glFixture() {
  const counts = { draw: 0, clearColor: 0 };
  const gl = new Proxy(
    {
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => ({}),
      getUniformLocation: (_, name) => name,
      getAttribLocation: (_, name) => (name === 'position' ? 0 : 1),
      bufferData: (_, data) => assert.ok(data.every(Number.isFinite)),
      drawArrays: (_, first, count) => {
        assert.equal(first, 0);
        assert.ok(count > 0);
        counts.draw++;
      },
      clearColor: () => counts.clearColor++,
    },
    {
      get: (obj, key) =>
        key in obj ? obj[key] : key.toUpperCase() === key ? 1 : () => {},
    },
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => gl,
    addEventListener: () => {},
  };
  return { canvas, counts };
}

test('renderDiorama dibuja las piezas, restaura groundOffset y el color de campaña', () => {
  const { canvas, counts } = glFixture();
  const renderer = new Renderer(canvas, () => {}, () => {});
  renderer.groundOffset = 7;
  const parts = Diorama.build().slice(0, 12);
  const ok = renderer.renderDiorama({
    W: 1440,
    H: 1080,
    t: 1,
    pixelRatio: 1,
    perfLevel: 0,
    diorama: parts,
    dioramaCam: Diorama.cameraFor(1440, 1080),
    swayYaw: Diorama.swayYaw,
  });
  assert.equal(ok, true);
  assert.equal(renderer.drawCalls, parts.length + 3, 'piezas + 3 nubes');
  assert.equal(counts.draw, parts.length + 3);
  assert.equal(renderer.groundOffset, 7, 'groundOffset de campaña intacto');
  assert.ok(counts.clearColor >= 2, 'cielo de diorama y restauración');
});

test('renderDiorama con movimiento reducido congela el vaivén y omite nubes', () => {
  const { canvas } = glFixture();
  const renderer = new Renderer(canvas, () => {}, () => {});
  const parts = Diorama.build().slice(0, 8);
  renderer.renderDiorama({
    W: 1920,
    H: 1080,
    t: 9,
    pixelRatio: 1,
    perfLevel: 0,
    reducedMotion: true,
    diorama: parts,
    dioramaCam: Diorama.cameraFor(1920, 1080),
    swayYaw: Diorama.swayYaw,
  });
  assert.equal(renderer.drawCalls, parts.length, 'sin nubes con movimiento reducido');
});

test('la portada expone JUGAR, Cargar partida deshabilitado, Opciones y Salir', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const uiSrc = fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8');
  const drawSrc = fs.readFileSync(path.join(root, 'src/draw3d.js'), 'utf8');
  const bootstrap = require('../src/bootstrap.js');
  assert.ok(html.includes('>JUGAR<'));
  assert.ok(html.includes('>Opciones<'));
  assert.ok(html.includes('>Salir<'));
  assert.match(html, /id="menuLoad"[^>]*disabled/, 'Cargar partida deshabilitado');
  assert.ok(html.includes('no hay guardado de campaña'), 'explicación breve visible');
  assert.ok(uiSrc.includes('menuQuit'), 'Salir con acción compatible explicada');
  assert.ok(uiSrc.includes("'JUGAR'"), 'showMain rotula JUGAR');
  assert.ok(drawSrc.includes('renderDiorama'), 'draw3d usa el diorama en menú');
  assert.ok(drawSrc.includes("st === 'menu'"), 'solo en estado de menú');
  assert.ok(
    bootstrap.scripts.indexOf('menu-diorama') < bootstrap.scripts.indexOf('game'),
    'el módulo del diorama carga antes del juego',
  );
  assert.ok(css.includes('.menu-primary-nav'));
  assert.ok(css.includes('.menu-note'));
  assert.ok(css.includes('button:disabled'), 'estado deshabilitado visible');
});
