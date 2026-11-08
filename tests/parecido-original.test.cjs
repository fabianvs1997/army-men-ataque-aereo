const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Compass = require('../src/compass.js');
const Combat = require('../src/combat.js');
const Renderer = require('../src/toy-renderer.js');
const { game, seeded } = require('../support/fake-host.cjs');
const bootstrap = require('../src/bootstrap.js');

// Brújula: rumbo, puntos y marca del objetivo.
test('la brújula etiqueta el rumbo: N con yaw 0, E a 90°, S a 180°, W a 270°', () => {
  assert.equal(Compass.headingLabel(0), 'N');
  assert.equal(Compass.headingLabel(Math.PI / 2), 'E');
  assert.equal(Compass.headingLabel(Math.PI), 'S');
  assert.equal(Compass.headingLabel(-Math.PI / 2), 'W');
  assert.equal(Compass.headingLabel(Math.PI / 4), 'NE');
  assert.equal(Compass.headingLabel((3 * Math.PI) / 4), 'SE');
  assert.equal(Compass.headingDeg(0), 0);
  assert.equal(Compass.headingDeg(Math.PI / 2), 90);
  assert.equal(Compass.headingDeg(-Math.PI), 180);
});

test('la tira de la brújula se desplaza con el rumbo y marca el rumbo actual en el centro', () => {
  const strip = Compass.strip(0, 90);
  // Rumbo N: N en el centro (50 %), E a la derecha (100 %), W a la
  // izquierda (0 %); el resto queda fuera de la ventana de ±90°.
  const at = (label) => strip.labels.find((l) => l.label === label);
  assert.equal(at('N').at, 50);
  assert.equal(at('N').current, true);
  assert.equal(at('E').at, 100);
  assert.equal(at('W').at, 0);
  assert.equal(at('S').visible, false);
  assert.equal(at('NE').at, 75);
  // El objetivo al E (rumbo 90°) queda en el extremo derecho.
  assert.equal(strip.target.at, 100);
  assert.equal(strip.target.visible, true);
  // Girando a E, el E pasa al centro y el objetivo queda centrado.
  const turned = Compass.strip(90, 90);
  assert.equal(turned.labels.find((l) => l.label === 'E').current, true);
  assert.equal(turned.labels.find((l) => l.label === 'E').at, 50);
  assert.equal(turned.target.at, 50);
  // Objetivo por detrás (180° del rumbo): la marca se esconde, no
  // salta al otro extremo.
  assert.equal(Compass.strip(0, 180).target.visible, false);
  assert.equal(Compass.strip(0, -90).target.at, 0);
});

test('el rumbo hacia el objetivo se calcula en coordenadas del mundo', () => {
  assert.equal(Compass.bearingDeg(0, 0, 0, 100), 0);
  assert.equal(Compass.bearingDeg(0, 0, 100, 0), 90);
  assert.equal(Compass.bearingDeg(0, 0, 0, -100), 180);
  assert.equal(Compass.bearingDeg(0, 0, -100, 0), -90);
});

// HUD: munición, salud, brújula y resumen genérico de la misión.
function hudEnv(mission) {
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id))
      elements.set(id, { style: {}, textContent: '' });
    return elements.get(id);
  };
  return {
    env: {
      $: el,
      P: { x: 0, y: 8, z: 0, yaw: 0, arm: 7, mi: 4, sc: 120 },
      mission,
      t: 0,
      logsVisible: false,
      perfVisible: false,
    },
    el,
  };
}
const rescueMission = () => ({
  config: { name: 'Rescate A → B → C' },
  message: 'Recoge a los heridos',
  rescued: 1,
  delivered: 0,
  allies: [
    { wounded: true, state: 'waiting' },
    { wounded: true, state: 'waiting' },
    { wounded: false, state: 'waiting' },
  ],
  target: () => ({ x: 0, z: 100 }),
  hudSummary() {
    return 'Misión 1/3 · Heridos 1/2 · A salvo 0/3 · Bajas 0';
  },
});

test('el HUD muestra munición y salud, y la brújula sigue al rumbo y al objetivo de la misión', () => {
  const { env, el } = hudEnv(rescueMission());
  require('../src/ui.js').create(env).updateHUD();
  assert.equal(el('ammoNum').textContent, '4');
  assert.equal(el('mi').textContent, 'Misil');
  assert.equal(el('ai').style.width, '70%');
  assert.equal(el('objective').textContent, 'Rescate A → B → C · Recoge a los heridos');
  assert.equal(el('inf').textContent, 'Misión 1/3 · Heridos 1/2 · A salvo 0/3 · Bajas 0');
  // Rumbo N y objetivo al N (B está en +z): N resaltada en el centro
  // y marca morada visible en el centro.
  assert.equal(el('cl0').textContent, 'N');
  assert.equal(el('cl0').style.color, '#ffd94d');
  assert.equal(el('cl0').style.left, '50%');
  assert.equal(el('compassTarget').style.display, 'block');
  assert.equal(el('compassTarget').style.left, '50%');
  // Sin munición, el número se pone rojo.
  env.P.mi = 0;
  require('../src/ui.js').create(env).updateHUD();
  assert.equal(el('ammoNum').style.color, '#ff6b5e');
});

test('el HUD es genérico: el resumen y la marca de la brújula vienen de la misión, no del rescate', () => {
  // Misión futura (caja de plástico y portal): otro resumen, otro
  // objetivo y otra marca, sin tocar ui.js.
  const future = {
    config: { name: 'Plastic Pandemonium' },
    message: 'Lleva la caja de plástico por el portal',
    target: () => ({ x: 100, z: 0 }),
    hudSummary: () => 'Plástico 1/1 · Portal al E',
  };
  const { env, el } = hudEnv(future);
  require('../src/ui.js').create(env).updateHUD();
  assert.equal(el('inf').textContent, 'Plástico 1/1 · Portal al E');
  assert.equal(
    el('objective').textContent,
    'Plastic Pandemonium · Lleva la caja de plástico por el portal',
  );
  // Objetivo al E con rumbo N: marca en el extremo derecho.
  assert.equal(el('compassTarget').style.left, '100%');
  assert.equal(el('compassTarget').style.display, 'block');
});

test('el HUD del juego real actualiza munición, salud y brújula al jugar', () => {
  const g = game();
  g.app.start(1, true);
  g.app.upd(0.05);
  const s = g.state;
  assert.equal(g.element('ammoNum').textContent, String(s.P.mi));
  assert.equal(g.element('ai').style.width, s.P.arm * 10 + '%');
  assert.equal(g.element('inf').textContent, s.mission.hudSummary());
  assert.equal(g.element('cl0').style.color, '#ffd94d');
  // Girando 180°, el rumbo actual pasa a ser S.
  s.P.yaw = Math.PI;
  g.app.upd(0.05);
  assert.equal(g.element('cl4').textContent, 'S');
  assert.equal(g.element('cl4').style.color, '#ffd94d');
  assert.equal(g.element('cl0').style.color, '');
});

// Explosiones: tamaño por tipo, humo y paleta del original.
test('las explosiones tienen tamaño por tipo y vida de 0,55 s, sin cambiar el daño', () => {
  assert.equal(Combat.EXPLOSION_LIFE, 0.55);
  assert.ok(Combat.EXPLOSION_SIZE.tank > Combat.EXPLOSION_SIZE.inf);
  assert.equal(Combat.EXPLOSION_SIZE.base, 5);
  assert.equal(Combat.EXPLOSION_SIZE.missile, 3);
  const s = {
      P: { x: 0, y: 8, z: 0, sc: 0 },
      FX: [],
      SM: [],
      PK: [],
      E: [],
      bd: 0,
      mission: { release() {} },
    },
    combat = Combat.create({
      ...s,
      state: s,
      ToyMissions: require('../src/toy-missions.js'),
      groundAt: () => 0,
      clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
      sfx: {},
      buzz() {},
      hurt() {},
      visualRandom: seeded(7),
    });
  const tank = { x: 10, y: 0, z: 20, k: 'tank', hp: 1, r: 3.5, p: 30, cd: 99 };
  assert.equal(combat.kill(tank), true);
  assert.equal(s.FX.length, 1);
  assert.equal(s.FX[0].s, Combat.EXPLOSION_SIZE.tank);
  assert.equal(s.FX[0].l, 0.55);
  assert.equal(s.FX[0].max, 0.55);
  // Humo oscuro de la explosión; sin restos en el suelo.
  assert.ok(s.SM.filter((p) => p.dark).length >= 3);
  assert.equal(s.DB?.length || 0, 0);
  const inf = { x: -10, y: 0, z: 20, k: 'inf', hp: 1, r: 1.5, p: 10, cd: 99 };
  combat.kill(inf);
  assert.equal(s.FX[1].s, Combat.EXPLOSION_SIZE.inf);
  // El daño no cambia: el misil sigue haciendo 6 y el tanque tiene 6 HP.
  const g = game();
  g.app.start(1, true);
  const e = g.app.spawnE('tank', 0, 0);
  assert.equal(e.hp, 6);
  assert.equal(e.r, 3.5);
});

test('el renderer dibuja la explosión grande con naranja, rosa y núcleo amarillo', () => {
  const listeners = {},
    colors = [],
    sizes = [];
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
        if (name === 'size') sizes.push(values[0]);
      },
      uniform3fv: (name, values) => {
        if (name === 'color') colors.push([...values]);
      },
      uniform2f: () => {},
      uniform1f: () => {},
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
  const r = new Renderer(canvas, () => {}, () => {});
  const scene = (fx) => ({
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
  });
  // Explosión joven (l 0,85 de 0,9): naranja, rosa y núcleo amarillo.
  assert.equal(r.render(scene([{ x: 0, y: 2, z: 8, l: 0.85, max: 0.9, s: 7 }])), true);
  const has = (c) => colors.some((v) => v.every((n, i) => Math.abs(n - c[i]) < 1e-9));
  assert.ok(has(Renderer.EXPLOSION_COLORS.orange), 'naranja');
  assert.ok(has([1, 0.35, 0.55]), 'rosa');
  assert.ok(has(Renderer.EXPLOSION_COLORS.core), 'núcleo amarillo');
  // La bola joven ya mide casi su tamaño completo y se encoge con
  // la edad (antes crecía un 60 % y tapaba la pantalla).
  const age = 1 - 0.85 / 0.9,
    expected = 7 * (1 - age * 0.55);
  assert.ok(sizes.some((v) => Math.abs(v - expected) < 1e-9), 'bola grande');
  // Explosión vieja (l 0,2): humo gris, sin núcleo.
  colors.length = 0;
  assert.equal(r.render(scene([{ x: 0, y: 2, z: 8, l: 0.2, max: 0.9, s: 7 }])), true);
  assert.ok(has(Renderer.EXPLOSION_COLORS.smoke), 'humo gris final');
});

// Tanques Tan: color y silueta propios, sin cambiar vida ni daño.
test('el tanque Tan es amarillo vivo, distinto del verde del jugador y del caqui de infantería', () => {
  const body = Renderer.TAN_TANK.body;
  assert.deepEqual(body, [0.95, 0.76, 0.2]);
  const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  // Lejos del verde del helicóptero del jugador y del caqui Tan.
  assert.ok(dist(body, [0.22, 0.59, 0.13]) > 0.7);
  assert.ok(dist(body, [0.77, 0.62, 0.36]) > 0.15);
  assert.deepEqual(Renderer.TAN_TANK.dark, [0.45, 0.32, 0.12]);
});

function renderColors(enemies) {
  const colors = [];
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
        if (name === 'color') colors.push(values);
      },
      uniform3fv: (name, values) => {
        if (name === 'color') colors.push([...values]);
      },
      uniform2f: () => {},
      uniform1f: () => {},
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
    addEventListener: () => {},
  };
  const r = new Renderer(canvas, () => {}, () => {});
  r.render({
    W: 390,
    H: 844,
    F: 390 / 105,
    HY: 844 * 0.52,
    cam: { x: 0, z: 0, yaw: Math.PI / 5 },
    PITCH: Math.PI / 3,
    P: { x: 0, y: 8, z: 0, yaw: 0, inv: 0 },
    E: enemies,
    DC: [],
    BL: [],
    EB: [],
    MS: [],
    SM: [],
    FX: [],
    allies: [],
    PK: [],
    rot: 1,
    t: 0,
  });
  return colors;
}
test('el renderer pinta el tanque Tan de amarillo y la torreta sigue de caqui', () => {
  const has = (colors, c) =>
    colors.some((v) => v.every((n, i) => Math.abs(n - c[i]) < 1e-9));
  const tankColors = renderColors([
    { k: 'tank', x: 0, y: 0, z: 15, fl: 0 },
  ]);
  assert.ok(has(tankColors, Renderer.TAN_TANK.body), 'tanque amarillo');
  assert.ok(has(tankColors, Renderer.TAN_TANK.dark), 'orugas tostadas');
  const turretColors = renderColors([
    { k: 'tur', x: 0, y: 0, z: 15, fl: 0 },
  ]);
  assert.ok(!has(turretColors, Renderer.TAN_TANK.body), 'torreta sin amarillo');
  assert.ok(has(turretColors, [0.76, 0.61, 0.36]), 'torreta caqui');
});

test('destruir un tanque Tan o un soldado no deja restos amarillos ni de ningún color', () => {
  // Antes el tanque destruido dejaba un pecio amarillo y la
  // infantería piezas caqui; ahora ningún enemigo deja restos.
  const state = { P: { x: 0, z: 0, sc: 0 }, DB: [], FX: [], PK: [] };
  for (const k of ['tank', 'inf']) {
    const e = { x: 0, y: 0, z: 0, k, hp: 1, r: 2, p: 10, cd: 999 };
    assert.equal(Combat.kill(state, e, { random: () => 0.9 }), true);
  }
  assert.equal(state.DB.length, 0);
});

// Estructura: el HUD nuevo existe en HTML/CSS y la brújula se carga.
test('el HUD nuevo existe: brújula y contador de munición en HTML, CSS y bootstrap', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '../index.html'),
    'utf8',
  );
  for (const id of ['compass', 'compassTarget', 'ammo', 'ammoNum', 'cl0', 'cl7'])
    assert.ok(html.includes('id="' + id + '"'), id);
  assert.ok(!html.includes('id="cmp"'), 'la flecha vieja ya no existe');
  const css = fs.readFileSync(
    path.join(__dirname, '../styles.css'),
    'utf8',
  );
  assert.ok(css.includes('#compass'));
  assert.ok(css.includes('#ammo'));
  assert.ok(!css.includes('#cmp {'), 'sin CSS de la flecha vieja');
  assert.ok(bootstrap.scripts.includes('compass'), 'bootstrap carga compass');
  assert.equal(bootstrap.VERSION, 'mapa-m1-video-1');
});

// La escolta sigue llegando a C en las misiones 2 y 3 (reglas sin
// tocar); la Misión 1 del vídeo no tiene escolta: se completa con
// la caja y el portal.
test('la escolta llega a C en las misiones 2 y 3, y la Misión 1 cierra con la caja y el portal', () => {
  const g = game();
  g.element('go').onclick();
  for (let n = 1; n <= 3; n++) {
    assert.equal(g.state.mis, n);
    const { app, state: s } = g;
    for (const e of s.E) app.combat.kill(e);
    s.E = [];
    s.EB = [];
    // Misión 1 del vídeo: sin heridos ni pelotón; a B y, sin
    // amenazas, directo a la caja y el portal.
    if (n === 1) {
      assert.equal(s.mission.allies.length, 0);
      s.P.x = s.mission.rules.B.x;
      s.P.z = s.mission.rules.B.z;
      for (let i = 0; i < 200 && s.mission.stage !== 'CARGA_PORTAL'; i++)
        app.upd(0.05);
      assert.equal(s.mission.stage, 'CARGA_PORTAL');
      s.P.x = s.mission.cargo.x;
      s.P.z = s.mission.cargo.z;
      for (let i = 0; i < 200 && s.mission.cargo.state === 'waiting'; i++)
        app.upd(0.05);
      assert.equal(s.mission.cargo.state, 'carried');
      s.P.x = s.mission.portal.x;
      s.P.z = s.mission.portal.z;
      for (let i = 0; i < 600 && s.st === 'play'; i++) app.upd(0.05);
      assert.equal(s.st, 'win');
      assert.equal(s.mission.delivered, 0);
      g.app.upd(0.05);
      g.element('go').onclick();
      continue;
    }
    for (const a of s.mission.allies.filter((a) => a.wounded)) {
      s.P.x = a.x;
      s.P.z = a.z;
      for (let i = 0; i < 30; i++) app.upd(0.05);
    }
    s.P.x = s.mission.finish.x;
    s.P.z = s.mission.finish.z;
    // Margen amplio (180 s simulados): con la suite en paralelo el
    // A* de la escolta puede degradar su calidad por su presupuesto
    // de reloj y tardar más en llegar, como ya pasa con los tests de
    // tiempo de `freeze-escort.test.cjs`.
    for (let i = 0; i < 3600 && s.st === 'play'; i++) app.upd(0.05);
    // Misión 1: tras la entrega en C queda la caja y el portal.
    if (s.mission.stage === 'CARGA_PORTAL') {
      s.P.x = s.mission.cargo.x;
      s.P.z = s.mission.cargo.z;
      for (let i = 0; i < 200 && s.mission.cargo.state === 'waiting'; i++)
        app.upd(0.05);
      assert.equal(s.mission.cargo.state, 'carried');
      s.P.x = s.mission.portal.x;
      s.P.z = s.mission.portal.z;
      for (let i = 0; i < 600 && s.st === 'play'; i++) app.upd(0.05);
    }
    // Misión 2: si queda algún garaje tras la entrega en C, destruirlo
    // (aquí ya murieron todos al principio, pero el test cubre la fase).
    if (s.mission.stage === 'GARAJES') {
      for (const g of s.mission.garages)
        s.mission.enemyEliminated({ id: g.id, k: 'garage' });
      for (let i = 0; i < 600 && s.st === 'play'; i++) app.upd(0.05);
    }
    // Misión 3: tras la entrega en C queda la batería, el tren y el
    // portal. El helicóptero Tan ya murió al principio (la batería
    // cayó donde murió); levantarla con el winch, dejarla en la
    // plataforma y esperar al tren en C.
    if (s.mission.stage === 'ENTREGA_C' && s.mission.train) {
      if (s.mission.cargo.state === 'waiting') {
        s.P.x = s.mission.cargo.x;
        s.P.z = s.mission.cargo.z;
        for (let i = 0; i < 200 && s.mission.cargo.state === 'waiting'; i++)
          app.upd(0.05);
        assert.equal(s.mission.cargo.state, 'carried');
      }
      if (s.mission.cargo.state === 'carried') {
        s.P.x = s.mission.batteryPad.x;
        s.P.z = s.mission.batteryPad.z;
        for (let i = 0; i < 200 && s.mission.cargo.state === 'carried'; i++)
          app.upd(0.05);
        assert.equal(s.mission.cargo.state, 'delivered');
        assert.equal(s.mission.train.state, 'moving');
      }
      s.P.x = s.mission.finish.x;
      s.P.z = s.mission.finish.z;
      for (let i = 0; i < 1800 && s.st === 'play'; i++) app.upd(0.05);
      assert.equal(s.mission.train.state, 'arrived');
      if (s.mission.stage === 'PORTAL') {
        s.P.x = s.mission.portal.x;
        s.P.z = s.mission.portal.z;
        for (let i = 0; i < 600 && s.st === 'play'; i++) app.upd(0.05);
      }
    }
    assert.equal(s.st, n === 3 ? 'campaign' : 'win');
    // Todos los supervivientes llegan a C: la victoria no exige a
    // los caídos (las oleadas temporizadas pueden matar a un
    // soldado después de limpiar el mapa), pero sí a todos los que
    // quedan en pie.
    assert.equal(
      s.mission.delivered,
      s.mission.allies.filter((a) => a.state !== 'CAIDO').length,
    );
    g.app.upd(0.05);
    g.element('go').onclick();
  }
  assert.equal(g.state.mis, 1);
});
