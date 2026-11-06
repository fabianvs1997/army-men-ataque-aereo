const { test } = require('node:test');
const assert = require('node:assert/strict');
const Draw3D = require('../src/draw3d.js');
const Projection = require('../src/projection.js');

function scene(overrides = {}) {
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, { style: {} });
    return elements.get(id);
  };
  return {
    W: 390,
    H: 844,
    F: 390 / 105,
    HY: 400,
    PITCH: Math.PI / 3,
    cam: { x: 0, z: 0, yaw: 0 },
    t: 0,
    shk: 0,
    rot: 0,
    lowQuality: false,
    R: (a) => a,
    $: el,
    elements,
    P: null,
    E: [],
    DC: [],
    BL: [],
    EB: [],
    MS: [],
    FX: [],
    SM: [],
    DB: [],
    PK: [],
    mission: null,
    renderer3d: undefined,
    ...overrides,
  };
}

test('draw3d shows the WebGL canvas when the renderer draws', () => {
  const s = scene({ renderer3d: { render: () => true } });
  assert.equal(Draw3D.create(s).draw(), true);
  assert.equal(s.elements.get('world3d').style.display, 'block');
  assert.equal(s.elements.get('webglRequired').style.display, 'none');
});

test('draw3d without WebGL shows the required message instead of a 2D fallback', () => {
  const s = scene();
  assert.equal(Draw3D.create(s).draw(), false);
  assert.equal(s.elements.get('world3d').style.display, 'none');
  assert.equal(s.elements.get('webglRequired').style.display, 'flex');
  // Si el renderizador se pierde a mitad de partida, el mismo mensaje
  // aparece en el siguiente dibujo en vez de una vista 2D.
  s.renderer3d = { render: () => false };
  assert.equal(Draw3D.create(s).draw(), false);
  assert.equal(s.elements.get('webglRequired').style.display, 'flex');
});

test('game without WebGL reports WebGL unavailable and shows the message', () => {
  const { game } = require('../support/fake-host.cjs');
  const g = game();
  assert.equal(g.app.state.renderer3d, null);
  assert.equal(g.element('renderMode').textContent, 'WebGL no disponible');
  assert.equal(g.app.draw3d.draw(g.app.view), false);
  assert.equal(g.element('webglRequired').style.display, 'flex');
  assert.equal(g.element('world3d').style.display, 'none');
});

test('projection maps a point ahead of the camera to finite screen coordinates', () => {
  const s = scene();
  const projection = Projection.create(s);
  const p = projection.P3(0, 0, 20);
  assert.ok(p);
  assert.equal(p.length, 4);
  assert.ok(p.every(Number.isFinite));
  // Un punto muy detrás de la cámara no se proyecta.
  assert.equal(projection.P3(0, 0, -1200), null);
});
