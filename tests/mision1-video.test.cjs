// Misión 1 «Plastic Pandemonium» del vídeo del original (125,5 s):
// catálogo fotograma a fotograma en
// departamento-videojuegos/catalogo-mision-video-m1.md. Modelos
// Blender nuevos (jeep/camión Tan y caja verde brillante con flecha
// blanca), su integración en el juego y las reglas de la misión
// según el vídeo (sin escolta, sin heridos, sin helicóptero Tan).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const Loader = require('../src/gltf-loader.js');
const Renderer = require('../src/toy-renderer.js');
const Maps = require('../src/original-maps.js');
const Escort = require('../src/escort-mission.js');
const Combat = require('../src/combat.js');
const World = require('../src/toy-world.js');

function readGltf(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'assets', name), 'utf8'));
}
function pngOk(name) {
  const buf = fs.readFileSync(
    path.join(root, 'assets', 'blender', 'previews', name),
  );
  assert.ok(buf.length > 1000, name + ' vacío');
  assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], name + ' no es PNG');
}
function clearEmbedded() {
  delete globalThis.ToyModeloHelicoptero;
  delete globalThis.ToyModeloTanque;
  delete globalThis.ToyModeloJeep;
  delete globalThis.ToyModeloCaja;
}
function loadEmbedded() {
  for (const name of [
    'modelo-helicoptero',
    'modelo-tanque',
    'modelo-jeep',
    'modelo-caja',
  ]) {
    delete require.cache[require.resolve('../src/' + name + '.js')];
    require('../src/' + name + '.js');
  }
}

// Mock de WebGL con contadores (patrón de tests/integracion-modelos.test.cjs).
function fixture() {
  const counts = {
    createBuffer: 0,
    bindBuffer: 0,
    drawElements: 0,
    drawArrays: 0,
    indices: 0,
    compile: 0,
  };
  const colors = [];
  const gl = new Proxy(
    {
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => {
        counts.createBuffer++;
        return {};
      },
      bindBuffer: () => counts.bindBuffer++,
      getUniformLocation: (_, name) => name,
      getAttribLocation: (_, name) => (name === 'position' ? 0 : 1),
      uniform3f: () => {},
      uniform3fv: (name, values) => {
        if (name === 'color') colors.push([...values]);
      },
      uniform2f: () => {},
      uniform1f: () => {},
      uniformMatrix4fv: () => {},
      bufferData: (_, data) => assert.ok(data.every(Number.isFinite)),
      drawArrays: () => counts.drawArrays++,
      drawElements: (_, count) => {
        counts.drawElements++;
        counts.indices += count;
      },
      compileShader: () => counts.compile++,
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
  const renderer = new Renderer(canvas, () => {}, () => {});
  renderer.world = {
    height: () => 0,
    roads: [],
    pads: [],
    rocks: [],
    yard: [],
    rails: [],
    mountains: [],
    padMarks: [],
    clearOfLandmarks: () => true,
  };
  return { gl, canvas, counts, colors, renderer };
}
function sceneWithJeepAndCargo() {
  return {
    W: 390,
    H: 844,
    F: 390 / 105,
    HY: 844 * 0.52,
    cam: { x: 0, z: 0, yaw: Math.PI / 5 },
    PITCH: Math.PI / 3,
    P: { x: 0, y: 8, z: 0, yaw: 0, inv: 0 },
    E: [{ k: 'jeep', x: 8, y: 0, z: 15, fl: 0 }],
    cargo: { kind: 'crate', state: 'waiting', x: -8, z: 15, progress: 0 },
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
  };
}

// --- Modelos Blender: jeep/camión Tan ---

test('el jeep Tan es glTF 2.0 de Blender, 1.084 tris y amarillo mostaza del vídeo', () => {
  assert.ok(
    fs.existsSync(path.join(root, 'assets', 'blender', 'jeep.py')),
    'falta assets/blender/jeep.py',
  );
  const model = Loader.parse(readGltf('jeep-tan.gltf'));
  assert.equal(Loader.countTris(model), 1084);
  assert.ok(Loader.countTris(model) <= 3000, 'el jeep supera el límite para el iPhone');
  assert.equal(model.drawList.length, 34);
  assert.equal(model.nodes.length, 34);
  const yellow = model.materials.find((m) => m.name === 'AmarilloTan');
  assert.ok(yellow, 'sin material AmarilloTan');
  assert.ok(Math.abs(yellow.color[0] - 0.85) < 0.01);
  assert.ok(Math.abs(yellow.color[1] - 0.72) < 0.01);
  // Ruedas, lona, parabrisas y faros: el jeep no es solo una caja amarilla.
  for (const name of ['RuedaOscura', 'LonaCaqui', 'CristalAhumado', 'FaroClaro'])
    assert.ok(model.materials.some((m) => m.name === name), 'sin material ' + name);
  for (const p of model.drawList) {
    assert.ok(p.positions.every(Number.isFinite));
    assert.equal(p.indices.length % 3, 0);
  }
  const stats = JSON.parse(
    fs.readFileSync(path.join(root, 'assets', 'blender', 'jeep-stats.json'), 'utf8'),
  );
  assert.equal(stats.tris, 1084);
  assert.equal(stats.limite, 3000);
  // Las vistas previas son PNG (binarios) y no se suben al repo:
  // en un checkout limpio solo se comprueban si existen.
  for (const view of ['frontal', 'lateral', 'cenital', 'tres-cuartos']) {
    const p = path.join(
      root,
      'assets',
      'blender',
      'previews',
      'jeep_' + view + '.png',
    );
    if (fs.existsSync(p)) pngOk('jeep_' + view + '.png');
  }
});

test('la caja es glTF 2.0 de Blender, 172 tris, verde brillante con flecha blanca', () => {
  assert.ok(
    fs.existsSync(path.join(root, 'assets', 'blender', 'caja.py')),
    'falta assets/blender/caja.py',
  );
  const model = Loader.parse(readGltf('caja-suministros.gltf'));
  assert.equal(Loader.countTris(model), 172);
  assert.ok(Loader.countTris(model) <= 1000);
  assert.equal(model.drawList.length, 16);
  const green = model.materials.find((m) => m.name === 'VerdeBrillante');
  assert.ok(green, 'sin material VerdeBrillante');
  assert.ok(Math.abs(green.color[1] - 0.75) < 0.01, 'el verde no es brillante');
  const white = model.materials.find((m) => m.name === 'BlancoFlecha');
  assert.ok(white, 'sin material BlancoFlecha para la flecha');
  assert.ok(white.color.every((v) => v > 0.9), 'la flecha no es blanca');
  const stats = JSON.parse(
    fs.readFileSync(path.join(root, 'assets', 'blender', 'caja-stats.json'), 'utf8'),
  );
  assert.equal(stats.tris, 172);
  // Las vistas previas son PNG (binarios) y no se suben al repo:
  // en un checkout limpio solo se comprueban si existen.
  for (const view of ['frontal', 'lateral', 'cenital', 'tres-cuartos']) {
    const p = path.join(
      root,
      'assets',
      'blender',
      'previews',
      'caja_' + view + '.png',
    );
    if (fs.existsSync(p)) pngOk('caja_' + view + '.png');
  }
});

// --- Integración: modelos embebidos y renderer ---

test('los modelos embebidos jeep y caja se cargan y ?modelos=1 los nombra', () => {
  clearEmbedded();
  loadEmbedded();
  const { renderer } = fixture();
  assert.ok(renderer.modelJeep, 'jeep sin cargar');
  assert.ok(renderer.modelCaja, 'caja sin cargar');
  assert.equal(renderer.modelStatus.jeep.source, 'blender');
  assert.equal(renderer.modelStatus.caja.source, 'blender');
  assert.equal(
    renderer.modelStatusText(),
    'Modelos · helicóptero: Blender · tanques: Blender · jeep: Blender · caja: Blender',
  );
  clearEmbedded();
});

test('el jeep y la caja se dibujan con el modelo Blender (drawElements medidos)', () => {
  clearEmbedded();
  loadEmbedded();
  const { counts, colors, renderer } = fixture();
  counts.drawElements = 0;
  counts.indices = 0;
  counts.drawArrays = 0;
  assert.equal(renderer.render(sceneWithJeepAndCargo()), true);
  // 60 primitivas del helicóptero + 34 del jeep + 16 de la caja.
  assert.equal(counts.drawElements, 60 + 34 + 16);
  assert.equal(counts.indices, (3540 + 1084 + 172) * 3);
  // El amarillo mostaza del jeep y el verde brillante + blanco de la caja.
  const has = (r, g, b) =>
    colors.some(
      (c) => Math.abs(c[0] - r) < 0.02 && Math.abs(c[1] - g) < 0.02 && Math.abs(c[2] - b) < 0.02,
    );
  assert.ok(has(0.85, 0.72, 0.06), 'sin amarillo del jeep');
  assert.ok(has(0.05, 0.75, 0.1), 'sin verde brillante de la caja');
  assert.ok(has(0.95, 0.95, 0.92), 'sin blanco de la flecha');
  clearEmbedded();
});

test('sin modelos embebidos el jeep y la caja siguen procedurales (respaldo visible)', () => {
  clearEmbedded();
  const { counts, colors, renderer } = fixture();
  assert.equal(renderer.modelJeep, null);
  assert.equal(renderer.modelCaja, null);
  assert.equal(renderer.tryDrawJeepModel({ x: 0, z: 0, fl: 0 }, 0), false);
  assert.equal(renderer.tryDrawCrateModel(0, 0, 0, 0), false);
  counts.drawArrays = 0;
  counts.drawElements = 0;
  assert.equal(renderer.render(sceneWithJeepAndCargo()), true);
  assert.equal(counts.drawElements, 0, 'sin modelo, nada usa drawElements');
  assert.ok(counts.drawArrays > 10, 'el jeep y la caja procedurales no se dibujaron');
  // Caja procedural: verde brillante con flecha blanca, no el verde oscuro de antes.
  const has = (r, g, b) =>
    colors.some(
      (c) => Math.abs(c[0] - r) < 0.02 && Math.abs(c[1] - g) < 0.02 && Math.abs(c[2] - b) < 0.02,
    );
  assert.ok(has(0.08, 0.68, 0.12), 'la caja procedural no es verde brillante');
  assert.ok(has(0.95, 0.95, 0.9), 'la caja procedural no lleva flecha blanca');
  assert.ok(!has(0.13, 0.42, 0.14), 'queda el verde oscuro viejo de la caja');
  clearEmbedded();
});

test('bootstrap carga los dos modelos nuevos antes del renderer', () => {
  const bootstrap = require('../src/bootstrap.js');
  assert.equal(bootstrap.VERSION, 'portada-diorama-1');
  assert.ok(bootstrap.scripts.includes('modelo-jeep'));
  assert.ok(bootstrap.scripts.includes('modelo-caja'));
  assert.ok(bootstrap.scripts.indexOf('modelo-jeep') < bootstrap.scripts.indexOf('toy-renderer'));
  assert.ok(bootstrap.scripts.indexOf('modelo-caja') < bootstrap.scripts.indexOf('toy-renderer'));
});

// --- Mapa M1 según el vídeo ---

test('M1 del vídeo: jeep al norte, 3 tanques guardando la caja, sin helicóptero Tan', () => {
  const map = Maps.generate(1);
  assert.equal(map.rules.noEscort, true);
  const enemies = map.rules.enemies;
  const jeeps = enemies.filter((e) => e.k === 'jeep');
  assert.equal(jeeps.length, 1);
  assert.equal(jeeps[0].id, 'jeep-norte');
  assert.equal(jeeps[0].zone, 'BC');
  assert.ok(jeeps[0].z > 200, 'el jeep no está al norte del valle');
  assert.equal(enemies.filter((e) => e.k === 'heli').length, 0, 'en M1 no hay helicóptero Tan');
  const nearCrate = enemies.filter(
    (e) =>
      e.k === 'tank' &&
      Math.hypot(e.x - map.rules.cargo.x, e.z - map.rules.cargo.z) <= 45,
  );
  assert.ok(nearCrate.length >= 3, 'tanques guardando la caja: ' + nearCrate.length);
  // Infantería en grupos de 2-3 junto al camino y al puesto.
  const squads = enemies.filter((e) => e.id.startsWith('squad-'));
  assert.ok(squads.length >= 6, 'infantería en grupos: ' + squads.length);
  assert.ok(squads.every((e) => e.k === 'inf'));
});

test('M2 y M3 no traen jeep ni pierden su helicóptero Tan: quedan intactas', () => {
  for (const n of [2, 3]) {
    const map = Maps.generate(n);
    assert.equal(map.rules.noEscort, undefined);
    assert.equal(map.rules.enemies.filter((e) => e.k === 'jeep').length, 0);
  }
  assert.equal(Maps.generate(2).rules.enemies.filter((e) => e.k === 'heli').length, 1);
  assert.ok(Maps.generate(3).rules.enemies.some((e) => e.id === 'tan-heli'));
});

// --- Reglas M1 según el vídeo: sin escolta ni heridos ---

test('M1 no tiene pelotón ni heridos y se completa con caja + portal', () => {
  const map = Maps.generate(1);
  const m = new Escort.Mission(1, map.rules);
  assert.equal(m.noEscort, true);
  assert.deepEqual(m.allies, []);
  assert.deepEqual(m.guards, []);
  assert.equal(m.cargo.kind, 'crate');
  assert.equal(m.hudSummary(), 'Tanques 0/6 · Enemigos 0 · Caja en B, por levantar · Portal');
  const env = { groundAt: () => 0, enemies: [] };
  const player = { x: 0, z: 0 };
  // Salir de la base: con una amenaza en B, la fase es DESPEJAR_B.
  player.x = map.rules.B.x;
  player.z = map.rules.B.z;
  env.enemies = [{ x: map.rules.B.x, z: map.rules.B.z, hp: 5, k: 'tank', dead: false }];
  m.update(0.05, player, env);
  assert.equal(m.stage, 'DESPEJAR_B');
  // Sin amenazas, directo a la caja y el portal (sin embarcar ni escoltar).
  env.enemies = [];
  m.update(0.05, player, env);
  assert.equal(m.stage, 'CARGA_PORTAL');
  // En la fase final, sin estar sobre la caja, el mensaje guía hasta ella.
  assert.equal(m.message, 'Vuela hasta la caja de plástico');
  // Levantar la caja con el winch: quieto 1,5 s sobre ella.
  player.x = map.rules.cargo.x;
  player.z = map.rules.cargo.z;
  for (let i = 0; i < 40; i++) m.update(0.05, player, env);
  assert.equal(m.cargo.state, 'carried');
  assert.equal(m.message, 'Lleva la caja por el portal');
  // Llevarla al portal: la misión se completa.
  player.x = map.rules.portal.x;
  player.z = map.rules.portal.z;
  const result = m.update(0.05, player, env);
  assert.equal(result, 'complete');
  assert.equal(m.stage, 'COMPLETADA');
  assert.equal(m.complete, true);
});

test('M2 sigue con pelotón y heridos: la regla sin escolta es solo de M1', () => {
  const m = new Escort.Mission(2, Maps.generate(2).rules);
  assert.equal(m.noEscort, false);
  assert.ok(m.allies.length > 0);
  assert.ok(m.allies.some((a) => a.wounded));
  assert.ok(m.guards.length > 0);
});

// --- Combate y patio ---

test('el jeep dispara como un tanque (trazadora pesada)', () => {
  assert.equal(Combat.bulletKindFor('jeep'), 'tank');
  assert.equal(Combat.bulletKindFor('tank'), 'tank');
  assert.equal(Combat.bulletKindFor('inf'), 'soldier');
});

test('las cajas del patio son verde brillante con flecha blanca', () => {
  const world = World.create(Maps.generate(1));
  const bright = world.yard.filter(
    (p) =>
      p.color &&
      Math.abs(p.color[0] - 0.08) < 0.01 &&
      Math.abs(p.color[1] - 0.68) < 0.01,
  );
  assert.ok(bright.length >= 2, 'cajas verde brillante en el patio: ' + bright.length);
  const white = world.yard.filter(
    (p) => p.color && p.color.every((v) => v >= 0.9),
  );
  assert.ok(white.length >= 1, 'sin flecha blanca en las cajas del patio');
  const darkOld = world.yard.filter(
    (p) =>
      p.color &&
      Math.abs(p.color[0] - 0.13) < 0.01 &&
      Math.abs(p.color[1] - 0.42) < 0.01,
  );
  assert.equal(darkOld.length, 0, 'queda el verde oscuro viejo en el patio');
});

// --- HUD como el original: salud abajo a la derecha con número ---

test('el HUD muestra el número de salud junto a la barra (abajo a la derecha)', () => {
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, { style: {}, textContent: '' });
    return elements.get(id);
  };
  const mission = {
    config: { name: 'Pandemonio de Plástico' },
    message: 'Destruye los tanques Tan que guardan la caja',
    target: () => ({ x: -170, z: 140 }),
    hudSummary: () => 'Tanques 0/6 · Enemigos 0 · Caja en B, por levantar · Portal',
  };
  const env = {
    $: el,
    P: { x: 0, y: 8, z: 0, yaw: 0, arm: 7, mi: 4, sc: 120 },
    mission,
    t: 0,
    logsVisible: false,
    perfVisible: false,
  };
  require('../src/ui.js').create(env).updateHUD();
  assert.equal(el('armNum').textContent, '7');
  assert.equal(el('ai').style.width, '70%');
  // Salud baja: número y barra en rojo.
  env.P.arm = 2;
  require('../src/ui.js').create(env).updateHUD();
  assert.equal(el('armNum').textContent, '2');
  assert.equal(el('armNum').style.color, '#ff6b5e');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('id="armNum"'), 'falta #armNum en el HUD');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.match(css, /#arm\s*\{[^}]*bottom:\s*132px/);
  assert.match(css, /#armNum\s*\{[^}]*bottom:\s*129px/);
});

// --- Añadido (niveles): A* , detalle de enemigos, amenazas y sonido ---

const Navigation = require('../src/escort-navigation.js');
const Collision = require('../src/collision.js');
const { game } = require('../support/fake-host.cjs');

test('M1: A, B y C alcanzables con A* (el pelotón no existe, pero la ruta sí)', () => {
  const map = Maps.generate(1);
  assert.deepEqual(Maps.validate(map), []);
  const world = World.create(map),
    mission = new Escort.Mission(1, map.rules),
    cover = Collision.create({ DC: world.shrubs, DB: [], mission }, world);
  // A* local (máx. 64 u por tramo, presupuesto de frame): se valida
  // por tramos de ≤50 u siguiendo el camino, con presupuesto amplio
  // porque aquí se valida el mapa, no un frame de juego.
  const budget = { maxExpansions: 5000, maxMs: 1000 };
  for (const route of map.routes.slice(0, 2)) {
    let prev = route[0];
    for (let i = 1; i < route.length; i++) {
      const [x, z] = route[i],
        steps = Math.max(1, Math.ceil(Math.hypot(x - prev[0], z - prev[1]) / 50));
      for (let j = 1; j <= steps; j++) {
        const next = [
          prev[0] + ((x - prev[0]) * j) / steps,
          prev[1] + ((z - prev[1]) * j) / steps,
        ];
        const path = Navigation.path(
          { x: prev[0], z: prev[1] },
          { x: next[0], z: next[1] },
          cover,
          world.height,
          0.65,
          0.9,
          budget,
        );
        assert.ok(
          path && path.length > 0,
          'sin ruta A* de ' + JSON.stringify(prev) + ' a ' + JSON.stringify(next),
        );
        prev = next;
      }
      prev = [x, z];
    }
  }
});

test('M1: 30 enemigos — 6 tanques, 19 de infantería en grupos de 2–3, 1 jeep y 0 helicópteros', () => {
  const map = Maps.generate(1),
    enemies = map.rules.enemies,
    byKind = (k) => enemies.filter((e) => e.k === k);
  assert.equal(enemies.length, 30);
  assert.equal(byKind('tank').length, 6);
  assert.equal(byKind('inf').length, 19);
  assert.equal(byKind('jeep').length, 1);
  assert.equal(byKind('heli').length, 0);
  // 3 tanques guardando la caja, a 25 u o menos de ella.
  const guards = enemies.filter((e) => e.id.startsWith('crate-tank'));
  assert.equal(guards.length, 3);
  for (const g of guards)
    assert.ok(
      Math.hypot(g.x - map.cargo.x, g.z - map.cargo.z) <= 25,
      g.id + ' lejos de la caja',
    );
  // Grupos de infantería: 3 + 2 + 2, cada uno cohesionado (≤6 u).
  for (const [group, count] of [
    ['squad-0', 3],
    ['squad-1', 2],
    ['squad-2', 2],
  ]) {
    const members = enemies.filter((e) => e.id.startsWith(group + '-'));
    assert.equal(members.length, count, group);
    const cx = members.reduce((s, e) => s + e.x, 0) / count,
      cz = members.reduce((s, e) => s + e.z, 0) / count;
    for (const e of members)
      assert.ok(Math.hypot(e.x - cx, e.z - cz) <= 6, e.id + ' fuera de su grupo');
  }
  assert.deepEqual([byKind('jeep')[0].x, byKind('jeep')[0].z], [60, 215]);
});

test('M1: los tanques de la caja son amenaza en CARGA_PORTAL, no en DESPEJAR_B, y el winch espera a despejar B', () => {
  const map = Maps.generate(1),
    m = new Escort.Mission(1, map.rules),
    env = {
      groundAt: () => 0,
      enemies: m.enemyPlan.map((e) => ({ ...e, dead: 0 })),
    };
  const atB = { x: map.rules.B.x, z: map.rules.B.z };
  for (let i = 0; i < 40; i++) m.update(0.05, atB, env);
  assert.equal(m.stage, 'DESPEJAR_B');
  // Despejar B es el puesto B: b-west, b-north, b-east y el tanque
  // de la caja que cae dentro del perímetro (crate-tank-2). Los
  // otros dos guardias de la caja aún no amenazan: si lo hicieran,
  // el jugador tendría que matar 7 enemigos a la vez en la primera
  // misión, sin aliados que repartan el fuego.
  const threats = m.threats(env.enemies);
  assert.equal(threats.length, 4, 'puesto B + crate-tank-2');
  assert.ok(threats.some((e) => e.id === 'crate-tank-2'));
  assert.ok(!threats.some((e) => e.id === 'crate-tank-0'));
  assert.ok(!threats.some((e) => e.id === 'crate-tank-1'));
  // La caja no se levanta con el puesto B sin despejar.
  for (let i = 0; i < 40; i++) m.update(0.05, m.cargo, env);
  assert.equal(m.cargo.state, 'waiting');
  for (const t of threats) {
    t.dead = 1;
    t.hp = 0;
    m.enemyEliminated(t);
  }
  m.update(0.05, m.cargo, env);
  assert.equal(m.stage, 'CARGA_PORTAL');
  assert.equal(m.tankKills, 2, 'tanque de B + crate-tank-2');
  // En la fase final, los dos guardias que quedan (y la
  // infantería junto a la caja) sí son amenaza y bloquean el
  // mensaje del winch hasta destruirlos.
  const guards = m.threats(env.enemies);
  assert.equal(guards.length, 3, '2 guardias + route-infantry');
  assert.ok(guards.some((e) => e.id === 'crate-tank-0'));
  assert.ok(guards.some((e) => e.id === 'crate-tank-1'));
  assert.equal(
    m.message,
    'Destruye los tanques Tan que guardan la caja',
  );
  for (const t of guards) {
    t.dead = 1;
    t.hp = 0;
    m.enemyEliminated(t);
  }
  m.update(0.05, m.cargo, env);
  assert.equal(m.tankKills, 4, '2 del puesto B + 2 de la caja');
  assert.ok(m.hudSummary().includes('Tanques 4/6'));
});

test('la flecha blanca de la caja se dibuja sobre la tapa (respaldo procedural)', () => {
  delete globalThis.ToyModeloCaja;
  delete globalThis.ToyModeloJeep;
  const parts = [];
  let lastOrigin = null;
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
        if (name === 'origin') lastOrigin = values;
      },
      uniform3fv: (name, values) => {
        if (name === 'color') parts.push({ origin: lastOrigin, color: [...values] });
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
  r.setWorld(World.create(Maps.generate(1)));
  r.render({
    W: 390,
    H: 844,
    F: 390 / 105,
    HY: 844 * 0.52,
    cam: { x: -170, z: 140, yaw: 0 },
    PITCH: Math.PI / 3,
    P: { x: -170, y: 8, z: 140, yaw: 0, inv: 0 },
    E: [],
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
    cargo: { state: 'waiting', x: -170, z: 140, progress: 0 },
  });
  // Flecha blanca sobre la tapa (y ≈ suelo 3,1 + 4,55) junto a la caja.
  const arrow = parts.filter(
    (p) =>
      p.color.every((n, i) => Math.abs(n - [0.95, 0.95, 0.9][i]) < 1e-9) &&
      Math.abs(p.origin[0] + 170) < 3 &&
      Math.abs(p.origin[2] - 140) < 3 &&
      Math.abs(p.origin[1] - 7.65) < 0.6,
  );
  assert.ok(arrow.length >= 1, 'sin flecha blanca sobre la caja de la carga');
});

test('el jeep existe en el juego real y al morir no deja restos', () => {
  const g = game();
  g.app.start(1, true);
  const s = g.state,
    jeep = s.E.find((e) => e.k === 'jeep');
  assert.ok(jeep, 'jeep en el despliegue de M1');
  assert.equal(jeep.hp, 6);
  assert.equal(jeep.r, 2.5);
  assert.equal(s.E.filter((e) => e.k === 'heli').length, 0);
  g.app.combat.kill(jeep);
  assert.equal(s.DB.length, 0, 'destruir el jeep no deja restos');
  assert.equal(s.mission.kills, 1);
});

test('el número de salud se actualiza jugando y se pone en rojo con salud baja', () => {
  const g = game();
  g.app.start(1, true);
  const s = g.state;
  s.P.arm = 7;
  g.app.upd(0.05);
  assert.equal(g.element('armNum').textContent, '7');
  assert.equal(g.element('ai').style.width, '70%');
  s.P.arm = 3;
  g.app.upd(0.05);
  assert.equal(g.element('armNum').textContent, '3');
  assert.equal(g.element('armNum').style.color, '#ff6b5e');
  s.P.arm = 8;
  g.app.upd(0.05);
  assert.equal(g.element('armNum').style.color, '');
});

test('sonidos del vídeo sintetizados con Web Audio API, sin audio copiado', () => {
  const src = fs.readFileSync(path.join(root, 'src/audio.js'), 'utf8');
  assert.ok(!src.includes('.mp3') && !src.includes('.wav'), 'sin archivos de audio');
  assert.ok(!src.includes('fetch('), 'sin descargas de audio');
  assert.ok(src.includes('createOscillator'), 'osciladores Web Audio');
  const started = [];
  const param = (v = 0) => ({
    value: v,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
  });
  const node = (kind) => ({
    kind,
    frequency: param(0),
    gain: param(0),
    connect() {},
    disconnect() {},
    start() {
      started.push(kind);
    },
    stop() {},
  });
  const audio = require('../src/audio.js').create({
    host: {
      document: { hidden: false },
      navigator: {},
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      setInterval: () => 1,
      clearInterval: () => {},
      setTimeout: (fn) => fn(),
    },
    isPlaying: () => true,
    isMuted: () => false,
  });
  audio.AC = {
    sampleRate: 100,
    currentTime: 0,
    destination: {},
    createBuffer: (_, length) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => node('src'),
    createBiquadFilter: () => node('filter'),
    createOscillator: () => node('osc'),
    createGain: () => node('gain'),
    suspend: () => Promise.resolve(),
  };
  for (const name of ['shot', 'boom', 'winch', 'portal']) {
    const before = started.length;
    audio.sfx[name]();
    assert.ok(started.length > before, name + ' arranca sonido');
  }
  assert.ok(started.includes('osc'), 'osciladores sintetizados');
});
