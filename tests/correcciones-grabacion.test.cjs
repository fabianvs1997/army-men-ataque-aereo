const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Combat = require('../src/combat.js');
const Collision = require('../src/collision.js');
const Renderer = require('../src/toy-renderer.js');
const Maps = require('../src/original-maps.js');
const World = require('../src/toy-world.js');
const { game, seeded } = require('../support/fake-host.cjs');

// Correcciones de la grabación de Fabian (104 s, Misión 1, iPhone):
// explosiones como globos opacos, portal como huevo frito, camino
// como damero, escombros permanentes, "Bajas 0" con 490 puntos,
// panel confuso, barra naranja sin etiqueta, brújula tapada por el
// joystick y misión que no se cierra sin avisar.

function glFixture(capture) {
  const listeners = {};
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
      uniform3f: (name, ...values) => {
        if (name === 'size' && capture.sizes) capture.sizes.push(values[0]);
      },
      uniform3fv: (name, values) => {
        if (name === 'color' && capture.colors) capture.colors.push([...values]);
      },
      uniform2f: () => {},
      uniform1f: (name, value) => {
        if (name === 'alpha' && capture.alphas) capture.alphas.push(value);
      },
      bufferData: () => {},
      drawArrays: () => {},
      compileShader: () => {},
      viewport: () => {},
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
    addEventListener: (type, fn) => (listeners[type] = fn),
  };
  return new Renderer(canvas, () => {}, () => {});
}

function scene(fx = [], world) {
  const r = glFixture({ colors: [], sizes: [], alphas: [] });
  if (world) {
    r.world = world;
    r.setWorld(world);
  }
  return {
    r,
    s: {
      W: 390,
      H: 844,
      F: 390 / 105,
      HY: 844 * 0.52,
      cam: { x: 0, z: 0, yaw: Math.PI / 5 },
      PITCH: Math.PI / 3,
      P: { x: 0, y: 8, z: 0, yaw: 0, inv: 0 },
      E: [],
      DC: [],
      BL: [],
      EB: [],
      MS: [],
      SM: [],
      FX: fx,
      allies: [],
      PK: [],
      rot: 1,
      t: 0,
    },
  };
}

test('las explosiones son pequeñas, se encogen y se apagan con alfa', () => {
  assert.equal(Combat.EXPLOSION_LIFE, 0.55);
  assert.ok(Combat.EXPLOSION_SIZE.tank <= 4, 'tanque ya no es un globo de 22 u');
  assert.ok(Combat.EXPLOSION_SIZE.base <= 5);
  const capture = { colors: [], sizes: [], alphas: [] };
  const r = glFixture(capture);
  const { s } = scene([], null);
  // Reutiliza el renderer del fixture con captura.
  const young = [{ x: 0, y: 2, z: 8, l: 0.5, max: 0.55, s: 4 }];
  assert.equal(r.render({ ...s, FX: young }), true);
  // Bola joven: casi su tamaño completo (4 u de radio, no 7) y alfa < 1.
  assert.ok(
    capture.sizes.some((v) => Math.abs(v - 4 * (1 - (1 - 0.5 / 0.55) * 0.55)) < 1e-9),
    'la bola joven mide ~s y se encoge, no crece',
  );
  assert.ok(capture.alphas.length > 0, 'el renderer pasa alfa');
  assert.ok(capture.alphas.every((a) => a <= 1), 'alfa acotado');
  assert.ok(capture.alphas.some((a) => a < 1), 'la bola se apaga');
  // Bola vieja (l 0,05): casi invisible.
  capture.sizes.length = 0;
  capture.alphas.length = 0;
  const old = [{ x: 0, y: 2, z: 8, l: 0.05, max: 0.55, s: 4 }];
  assert.equal(r.render({ ...s, FX: old }), true);
  assert.ok(capture.alphas.some((a) => a < 0.15), 'la bola vieja casi no se ve');
  assert.ok(
    capture.sizes.some((v) => Math.abs(v - 2) < 1e-9),
    'la bola vieja se encogió a la mitad (~2 u)',
  );
});

test('el portal es pequeño y translúcido, no un huevo frito gigante', () => {
  const world = World.create(Maps.generate(1));
  const color = (c) => (p) => JSON.stringify(p.color) === JSON.stringify(c);
  const halo = world.yard.find(color([0.98, 0.88, 0.55]));
  assert.ok(halo, 'hay halo del portal');
  assert.ok(halo.sx <= 8, `halo de ${halo.sx * 2} u de diámetro, antes 28 u`);
  assert.ok(halo.alpha < 0.5, 'halo translúcido');
  const column = world.yard.find(color([1, 0.9, 0.55]));
  assert.ok(column, 'hay columna de luz');
  assert.ok(column.sx <= 1.5, 'columna fina, antes 5 u de diámetro');
  assert.ok(column.alpha < 0.5, 'columna translúcida');
  const orb = world.yard.find(color([1, 0.55, 0.1]));
  assert.ok(orb, 'hay orbe');
  assert.ok(orb.sx <= 4, 'orbe de 8 u de diámetro, antes 13 u');
  assert.ok(orb.alpha < 1, 'orbe con algo de transparencia');
});

test('el camino tiene un solo tono de tierra, sin damero', () => {
  const capture = { colors: [], sizes: [], alphas: [] };
  const r = glFixture(capture);
  const world = World.create(Maps.generate(1));
  r.world = world;
  r.setWorld(world);
  const { s } = scene([], null);
  assert.equal(r.render({ ...s }), true);
  const has = (c) =>
    capture.colors.some((v) => v.every((n, i) => Math.abs(n - c[i]) < 1e-9));
  assert.ok(has([0.6, 0.48, 0.3]), 'tono único de tierra');
  assert.ok(!has([0.63, 0.51, 0.32]), 'sin tono claro alterno');
  assert.ok(!has([0.56, 0.44, 0.27]), 'sin tono oscuro alterno');
  assert.ok(!has([0.66, 0.54, 0.34]), 'sin franja central invertida');
});

test('la letra del helipuerto se dibuja con trazos continuos, no cubitos sueltos', () => {
  const world = World.create(Maps.generate(1));
  const runs = Renderer.padLetterRuns(world.padMarks);
  assert.ok(runs.length > 0, 'hay trazos');
  assert.ok(
    runs.length < world.padMarks.length,
    'los píxeles contiguos se agrupan en barras',
  );
  assert.ok(
    runs.some((r) => r.sx > 1.5),
    'hay barras largas (trazos enteros de la letra)',
  );
  // Una fila de 3 píxeles contiguos forma una barra de 2,95 u.
  const three = Renderer.padLetterRuns([
    { x: -1.2, z: 0 },
    { x: 0, z: 0 },
    { x: 1.2, z: 0 },
    { x: 5, z: 0 },
  ]);
  assert.equal(three.length, 2);
  assert.ok(Math.abs(three[0].sx - 2.95) < 1e-9);
  assert.ok(Math.abs(three[0].x - 0) < 1e-9);
});

// Sin escombros (2026-11-07, pedido de Fabian): cada baja ya no deja
// cubitos ni pecio; solo quedan la bola de fuego y el humo, que se
// apagan solos. El test viejo de "4 cubitos que caducan" se sustituye
// por este: matar deja DB vacío y la explosión sigue existiendo.
test('cada baja no deja ningún resto, solo explosión y humo', () => {
  const s = {
    P: { x: 0, z: 0, sc: 0 },
    DB: [],
    FX: [],
    SM: [],
    mission: { enemyEliminated() {} },
  };
  const env = {
    state: s,
    FX: s.FX,
    SM: s.SM,
    E: [],
    BL: [],
    EB: [],
    MS: [],
    groundAt: () => 0,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    sfx: {},
    buzz: () => {},
    ToyMissions: require('../src/toy-missions.js'),
    cover: { trace: () => null },
    hurt: () => {},
    P: s.P,
    st: 'play',
  };
  const combat = Combat.create(env);
  for (const k of ['inf', 'tank', 'tur', 'heli', 'base']) {
    const e = { x: 0, y: 0, z: 0, k, hp: 1, r: 2, p: 10, cd: 999 };
    assert.equal(combat.kill(e), true);
  }
  assert.equal(s.DB.length, 0);
  assert.equal(s.FX.length, 5, 'una bola de fuego por baja');
  assert.ok(s.SM.length > 0, 'humo de las explosiones');
});

// Las marcas de aliado caído (state.DB) no bloquean: son 2 cajitas
// diminutas por baja, y el camino queda libre aunque haya caídos.
test('las marcas de aliado caído no bloquean el camino', () => {
  const state = { DC: [], DB: [] };
  const world = { yard: [], rocks: [], height: () => 0, clearOfLandmarks: () => true };
  const cover = Collision.create(state, world);
  state.DB.push({
    kind: 'box', x: 5, y: 0.2, z: 0, sx: 0.3, sy: 0.2, sz: 0.65, settled: true,
  });
  assert.equal(cover.trace({ x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 }), null);
  assert.equal(cover.move({ x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 }, 1, 1).x, 10);
});

test('Bajas cuenta enemigos de verdad y el resumen no se duplica', () => {
  const g = game();
  g.app.start(1, true);
  const m = g.state.mission;
  assert.equal(m.kills, 0);
  m.enemyEliminated({ id: 't1', k: 'tank' });
  m.enemyEliminated({ id: 'i1', k: 'inf' });
  assert.equal(m.kills, 2);
  const summary = m.hudSummary();
  assert.ok(summary.includes('Enemigos 2'), summary);
  assert.ok(!summary.includes('Bajas'), summary);
  assert.ok(!summary.includes('Misión 1/3'), 'sin "Misión 1/3" en el resumen');
  // Misión 1 del vídeo, sin pelotón: el resumen cuenta tanques
  // guardando la caja, no heridos ni caídos.
  assert.ok(summary.includes('Tanques 1/6'), summary);
  assert.ok(summary.includes('Caja en B, por levantar'), summary);
});

test('el panel tiene etiquetas y no repite el título', () => {
  const g = game();
  g.app.start(1, true);
  g.element('missionBtn').onclick();
  assert.match(g.element('missionTitle').textContent, /Misión 1\/3 · Pandemonio de Plástico/);
  assert.ok(g.element('missionObjective').textContent.startsWith('Objetivo: '));
  assert.ok(g.element('missionSummary').textContent.startsWith('Progreso: '));
  assert.equal(
    (g.element('missionTitle').textContent.match(/Misión 1\/3/g) || []).length +
      (g.element('missionSummary').textContent.match(/Misión 1\/3/g) || []).length,
    1,
    'Misión 1/3 aparece una sola vez entre título y resumen',
  );
  // En marcha con unidad: "En marcha: N · Más rezagado: N u".
  g.element('missionClose').onclick();
  g.state.mission.stage = 'ESCOLTAR_BC';
  for (let i = 0; i < 3; i++) g.app.upd(0.05);
  g.element('missionBtn').onclick();
  assert.match(
    g.element('missionObjective').textContent,
    /En marcha: \d+ · Más rezagado: \d+ u/,
  );
});

test('la barra de salud tiene etiqueta y el botón de misil no duplica el contador', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(html.includes('id="armLabel"'), 'etiqueta SALUD en el HUD');
  assert.ok(html.includes('>SALUD<'), 'la etiqueta dice SALUD');
  assert.ok(html.includes('id="compassLegend"'), 'leyenda de la brújula');
  assert.ok(html.includes('▲ Tú · ◆ Objetivo'), 'la leyenda explica los marcadores');
  assert.ok(html.includes('id="toast"'), 'hay elemento toast');
  const g = game();
  g.app.start(1, true);
  g.app.upd(0.05);
  assert.equal(g.element('mi').textContent, 'Misil');
  assert.equal(g.element('ammoNum').textContent, String(g.state.P.mi));
});

test('el menú dice el objetivo de forma clara', () => {
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        style: {},
        textContent: '',
        innerHTML: '',
        scrollTop: 0,
        focus() {},
        setAttribute() {},
      });
    return elements.get(id);
  };
  const env = {
    $: el,
    cv: { tabIndex: -1, focus() {} },
    savedProgress: {},
    needsDraw: false,
  };
  require('../src/ui.js').create(env).showMain();
  assert.ok(
    el('tx').textContent.startsWith('Sal de A, limpia la base B'),
    el('tx').textContent,
  );
  assert.ok(!el('tx').textContent.includes('despega B'));
  assert.ok(!el('tx').textContent.includes('despeja B'));
});

test('los avisos en pantalla anuncian llegadas y el portal sin caja', () => {
  const g = game();
  g.app.start(1, true);
  // Al arrancar se anuncia la misión; los avisos que llegan después
  // esperan su turno en la cola de toasts en vez de pisar el anuncio.
  assert.match(
    g.element('toast').textContent,
    /Misión 1\/3 · Pandemonio de Plástico/,
  );
  const queued = () => (g.app.view._toastQueue || []).map((t) => t.text);
  // Llegada de un herido a C.
  g.state.mission.events.push({ type: 'delivered', id: 'a1' });
  g.app.upd(0.05);
  assert.ok(
    queued().some((t) => /Herido entregado en C/.test(t)),
    queued().join(' | '),
  );
  // Volar sobre el portal en la fase final sin la caja avisa.
  const m = g.state.mission;
  m.stage = 'CARGA_PORTAL';
  m.cargo.state = 'waiting';
  g.state.P.x = m.portal.x;
  g.state.P.z = m.portal.z;
  for (let i = 0; i < 120; i++) g.app.upd(0.05);
  assert.ok(
    queued().some((t) => /sin la caja/.test(t)),
    queued().join(' | '),
  );
  clearTimeout(g.app.view._toastTimer);
});

test('el joystick no se pone encima de la brújula', () => {
  const { fakeHost } = require('../support/fake-host.cjs');
  const Input = require('../src/input.js');
  const f = fakeHost();
  const env = {
    host: f.host,
    $: f.element,
    cv: f.element('world3d'),
    st: 'play',
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    audio() {},
    humOn() {},
  };
  // Brújula centrada abajo, como en el iPhone (x 95–295, y 678–712).
  f.element('compass').getBoundingClientRect = () => ({
    left: 95, right: 295, top: 678, bottom: 712, width: 200, height: 34,
  });
  const input = Input.create(env);
  input.bind();
  const c = f.element('world3d');
  // Toque encima de la brújula: a su izquierda no cabe el círculo
  // (el centro quedaría a 35 px del borde, menos que su radio 56),
  // así que el ancla baja por debajo de ella.
  c.emit('pointerdown', { pointerId: 1, clientX: 150, clientY: 700 });
  assert.equal(input.values.drag.sx, 150);
  assert.equal(input.values.drag.sy, 712 + 56 + 4);
  assert.equal(input.read().sx, 0, 'sin movimiento al tocar');
  c.emit('pointercancel', { pointerId: 1 });
  // Toque lejos de la brújula: el ancla queda donde tocó el dedo.
  c.emit('pointerdown', { pointerId: 2, clientX: 20, clientY: 200 });
  assert.equal(input.values.drag.sx, 20);
  c.emit('pointercancel', { pointerId: 2 });
});

test('la brújula no corta las letras de los extremos', () => {
  const Compass = require('../src/compass.js');
  const ui = require('../src/ui.js');
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, { style: {}, textContent: '' });
    return elements.get(id);
  };
  const env = {
    $: el,
    P: { x: 0, y: 8, z: 0, yaw: 0, arm: 7, mi: 4, sc: 0 },
    mission: {
      config: { name: 'Rescate A → B → C' },
      message: 'Recoge a los heridos',
      target: () => ({ x: 0, z: 100 }),
      hudSummary: () => 'Heridos 0/3',
    },
    t: 0,
    logsVisible: false,
    perfVisible: false,
  };
  ui.create(env).updateHUD();
  // Rumbo N: la W queda en el extremo izquierdo (0 %) y se limitaba.
  assert.equal(el('cl6').textContent, 'W');
  assert.equal(el('cl6').style.left, '6%');
  assert.equal(el('cl2').style.left, '94%', 'la E del extremo derecho también cabe');
  void Compass;
});
