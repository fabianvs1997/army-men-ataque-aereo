const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const Loader = require('../src/gltf-loader.js');
const Renderer = require('../src/toy-renderer.js');

function readGltf(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'assets', name), 'utf8'));
}
function clearEmbedded() {
  delete globalThis.ToyModeloHelicoptero;
  delete globalThis.ToyModeloTanque;
}
function loadEmbedded() {
  // Sin borrar la caché, el segundo require no reejecutaría el
  // archivo y los globales seguirían borrados por clearEmbedded().
  delete require.cache[require.resolve('../src/modelo-helicoptero.js')];
  delete require.cache[require.resolve('../src/modelo-tanque.js')];
  require('../src/modelo-helicoptero.js');
  require('../src/modelo-tanque.js');
}

// Mock de WebGL con contadores (patrón de tests/renderer.test.cjs):
// createBuffer/bindBuffer/drawElements cuentan de verdad, para probar
// que los buffers del modelo se crean una sola vez y se comparten.
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
  // Mundo plano y vacío: solo importan el helicóptero y los tanques.
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
function sceneWithTanks(n) {
  return {
    W: 390,
    H: 844,
    F: 390 / 105,
    HY: 844 * 0.52,
    cam: { x: 0, z: 0, yaw: Math.PI / 5 },
    PITCH: Math.PI / 3,
    P: { x: 0, y: 8, z: 0, yaw: 0, inv: 0 },
    E: Array.from({ length: n }, (_, i) => ({
      k: 'tank',
      x: i * 8,
      y: 0,
      z: 15,
      fl: 0,
    })),
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

test('el cargador parsea el helicóptero: 3.540 tris, 60 primitivas, 5 materiales', () => {
  const model = Loader.parse(readGltf('helicoptero.gltf'));
  assert.equal(Loader.countTris(model), 3540);
  assert.equal(model.drawList.length, 60);
  assert.equal(model.nodes.length, 61);
  assert.equal(model.materials.length, 5);
  for (const m of model.materials) {
    assert.equal(m.color.length, 3);
    assert.ok(m.color.every((v) => v >= 0 && v <= 1));
  }
  for (const p of model.drawList) {
    assert.ok(p.positions.every(Number.isFinite));
    assert.ok(p.normals.every(Number.isFinite));
    assert.equal(p.indices.length % 3, 0);
  }
});

test('el cargador parsea el tanque: 1.680 tris, 49 primitivas, 4 materiales', () => {
  const model = Loader.parse(readGltf('tanque-tan.gltf'));
  assert.equal(Loader.countTris(model), 1680);
  assert.equal(model.drawList.length, 49);
  assert.equal(model.nodes.length, 50);
  assert.equal(model.materials.length, 4);
  // Amarillo mostaza del tanque (rev. 3, muestreado de los vídeos).
  const yellow = model.materials.find((m) => m.name === 'AmarilloTan');
  assert.ok(yellow);
  assert.ok(Math.abs(yellow.color[0] - 0.85) < 0.01);
  assert.ok(Math.abs(yellow.color[1] - 0.72) < 0.01);
});

test('nodos Rotor y Torreta presentes con sus hijos (palas y cañón)', () => {
  const heli = Loader.parse(readGltf('helicoptero.gltf'));
  const rotor = Loader.findNode(heli, 'Rotor');
  assert.ok(rotor);
  assert.equal(rotor.children.length, 6);
  const bladeNames = rotor.children.map((i) => heli.nodes[i].name);
  assert.ok(bladeNames.some((n) => n.startsWith('RotorBlade')));
  assert.ok(bladeNames.some((n) => n.startsWith('RotorPunta')));
  const tank = Loader.parse(readGltf('tanque-tan.gltf'));
  const turret = Loader.findNode(tank, 'Torreta');
  assert.ok(turret);
  assert.equal(turret.children.length, 7);
  const turretNames = turret.children.map((i) => tank.nodes[i].name);
  assert.ok(turretNames.includes('Canon'));
  assert.ok(turretNames.includes('TorretaCuerpo'));
  assert.equal(Loader.findNode(heli, 'NoExiste'), null);
});

test('el cargador rechaza glTF inválido o con buffer externo sin romper', () => {
  assert.throws(() => Loader.parse(null), /glTF inválido/);
  assert.throws(() => Loader.parse('no es json'), /Unexpected token/);
  assert.throws(() => Loader.parse({ asset: { version: '2.0' } }), /sin buffers/);
  assert.throws(
    () => Loader.parse({ asset: { version: '1.0' }, buffers: [] }),
    /2\.x/,
  );
  assert.equal(Loader.countTris(null), 0);
  assert.equal(Loader.findNode(null, 'Rotor'), null);
});

test('la escala es 1:1 y el tanque apoya en el suelo', () => {
  const heli = Loader.parse(readGltf('helicoptero.gltf'));
  const extH = Loader.modelExtents(heli);
  // Rotor de ~15 u de diámetro y fuselaje de ~11 u de largo.
  assert.ok(extH.size[0] > 10 && extH.size[0] < 17);
  assert.ok(extH.size[2] > 10 && extH.size[2] < 13);
  // Base (patines) por debajo del centro, rotor por encima.
  assert.ok(extH.min[1] < -1.5 && extH.max[1] > 2);
  const tank = Loader.parse(readGltf('tanque-tan.gltf'));
  const extT = Loader.modelExtents(tank);
  assert.ok(extT.size[0] > 3.8 && extT.size[0] < 4.2);
  assert.ok(extT.size[2] > 7 && extT.size[2] < 7.4);
  assert.ok(extT.min[1] >= -0.01, 'el tanque apoya en y≈0');
  assert.ok(extT.max[1] > 2.3 && extT.max[1] < 2.5);
});

test('orientación: el morro del modelo (-Z) con yaw+π apunta como el procedural (+Z)', () => {
  // El morro procedural apunta a +Z local, que con yaw de juego es la
  // dirección (sin yaw, cos yaw). El modelo lleva el morro a -Z, así
  // que su matriz raíz es Ry(yaw + π).
  for (const yaw of [0, 0.3, -1.2, Math.PI / 2, Math.PI]) {
    const rootMat = Loader.mat4RotationY(yaw + Loader.NOSE_YAW_OFFSET);
    const dir = Loader.transformDirection(rootMat, Loader.MODEL_NOSE);
    assert.ok(Math.abs(dir[0] - Math.sin(yaw)) < 1e-6, `yaw ${yaw}`);
    assert.ok(Math.abs(dir[1]) < 1e-6);
    assert.ok(Math.abs(dir[2] - Math.cos(yaw)) < 1e-6, `yaw ${yaw}`);
  }
  // Sin el +π el morro apuntaría al revés.
  const flipped = Loader.transformDirection(Loader.mat4RotationY(0), Loader.MODEL_NOSE);
  assert.deepEqual(flipped.map((v) => Math.round(v)), [0, 0, -1]);
  // Y los extents lo confirman: el morro (cabina, z<0) está delante
  // del centro y la cola (z>0) detrás.
  const heli = Loader.parse(readGltf('helicoptero.gltf'));
  const ext = Loader.modelExtents(heli);
  assert.ok(ext.min[2] < -3 && ext.max[2] > 7);
});

test('el rotor gira: la matriz del nodo Rotor cambia y las palas se mueven en Y', () => {
  const heli = Loader.parse(readGltf('helicoptero.gltf'));
  const blade = Loader.findNode(heli, 'RotorBlade_Der');
  const m0 = Loader.nodeWorldMatrices(heli, { rotorAngle: 0 });
  const m1 = Loader.nodeWorldMatrices(heli, { rotorAngle: 0.7 });
  const rotor = Loader.findNode(heli, 'Rotor');
  assert.notDeepEqual([...m0[rotor.index]], [...m1[rotor.index]]);
  const p0 = Loader.transformPoint(m0[blade.index], [0, 0, 0]);
  const p1 = Loader.transformPoint(m1[blade.index], [0, 0, 0]);
  // Giro sobre Y: la pala se desplaza en el plano XZ, no en altura.
  assert.ok(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 1);
  assert.ok(Math.abs(p1[1] - p0[1]) < 1e-6);
  // Con ángulo 0 las matrices son las del modelo en reposo.
  const mBase = Loader.nodeWorldMatrices(heli, {});
  assert.deepEqual([...m0[rotor.index]], [...mBase[rotor.index]]);
});

test('la torreta gira: la matriz del nodo Torreta cambia y el cañón se mueve', () => {
  const tank = Loader.parse(readGltf('tanque-tan.gltf'));
  const canon = Loader.findNode(tank, 'Canon');
  const m0 = Loader.nodeWorldMatrices(tank, { turretAngle: 0 });
  const m1 = Loader.nodeWorldMatrices(tank, { turretAngle: 0.5 });
  const turret = Loader.findNode(tank, 'Torreta');
  assert.notDeepEqual([...m0[turret.index]], [...m1[turret.index]]);
  const tip0 = Loader.transformPoint(m0[canon.index], [0, 0, -1]);
  const tip1 = Loader.transformPoint(m1[canon.index], [0, 0, -1]);
  assert.ok(Math.hypot(tip1[0] - tip0[0], tip1[2] - tip0[2]) > 0.5);
  // El casco no se mueve con la torreta.
  const hull = Loader.findNode(tank, 'Oruga_Izq');
  assert.deepEqual([...m0[hull.index]], [...m1[hull.index]]);
});

test('sin datos embebidos el helicóptero del jugador sigue procedural y el juego arranca', () => {
  clearEmbedded();
  const { counts, renderer } = fixture();
  assert.equal(renderer.modelHeli, null);
  assert.equal(renderer.modelTank, null);
  assert.equal(renderer.tryDrawHeliModel(0, 8, 0, 0, 0, 0, false), false);
  counts.drawArrays = 0;
  counts.drawElements = 0;
  renderer.helicopter(0, 8, 0, 0, 0);
  // Sombra (1) + piezas procedurales del jugador: todo drawArrays.
  assert.ok(counts.drawArrays > 40, `procedural dibujado: ${counts.drawArrays}`);
  assert.equal(counts.drawElements, 0);
  assert.equal(renderer.render(sceneWithTanks(9)), true);
});

test('con datos embebidos corruptos el juego cae al procedural sin romperse', () => {
  clearEmbedded();
  globalThis.ToyModeloHelicoptero = { asset: { version: '2.0' } };
  globalThis.ToyModeloTanque = 'no es json';
  const { counts, renderer } = fixture();
  assert.equal(renderer.modelHeli, null);
  assert.equal(renderer.modelTank, null);
  counts.drawArrays = 0;
  counts.drawElements = 0;
  renderer.helicopter(0, 8, 0, 0, 0);
  assert.ok(counts.drawArrays > 40);
  assert.equal(counts.drawElements, 0);
  assert.equal(renderer.render(sceneWithTanks(9)), true);
  clearEmbedded();
});

test('con modelos, el jugador y los 9 tanques se dibujan con drawElements (tris medidos)', () => {
  clearEmbedded();
  loadEmbedded();
  const { counts, colors, renderer } = fixture();
  assert.ok(renderer.modelHeli);
  assert.ok(renderer.modelTank);
  counts.drawElements = 0;
  counts.indices = 0;
  counts.drawArrays = 0;
  assert.equal(renderer.render(sceneWithTanks(9)), true);
  // 60 primitivas del helicóptero + 9 × 49 del tanque.
  assert.equal(counts.drawElements, 60 + 9 * 49);
  // (3.540 + 9 × 1.680) tris × 3 índices por triángulo.
  assert.equal(counts.indices, (3540 + 9 * 1680) * 3);
  // El helicóptero del jugador ya no dibuja piezas procedurales:
  // solo quedan drawArrays del terreno (1), la elipse oscura bajo
  // cada tanque (9, se conserva) y la sombra del helicóptero (1).
  assert.equal(counts.drawArrays, 11);
  // El destello de daño pinta el modelo de blanco.
  colors.length = 0;
  const L = Loader;
  assert.equal(
    renderer.drawModel(
      renderer.modelTank,
      L.mat4Translation(0, 0, 0),
      { flash: true },
    ),
    true,
  );
  assert.ok(colors.length > 0);
  assert.ok(colors.every((c) => c[0] === 1 && c[1] === 1 && c[2] === 1));
  clearEmbedded();
});

test('los buffers GPU se crean una sola vez por modelo aunque se dibuje 9 veces', () => {
  clearEmbedded();
  loadEmbedded();
  const { counts, renderer } = fixture();
  const L = Loader;
  const rootMat = L.mat4Translation(0, 0, 0);
  // Creación: un dibujo de cada modelo crea sus 3 buffers fusionados.
  counts.createBuffer = 0;
  assert.equal(renderer.drawModel(renderer.modelTank, rootMat, {}), true);
  assert.equal(renderer.drawModel(renderer.modelHeli, rootMat, { rotorAngle: 1 }), true);
  assert.equal(counts.createBuffer, 6);
  // Reutilización: 9 tanques + 1 helicóptero enlazan 3 buffers por
  // modelo, no por pieza (501 primitivas) ni por tanque.
  counts.createBuffer = 0;
  counts.bindBuffer = 0;
  for (let i = 0; i < 9; i++)
    assert.equal(renderer.drawModel(renderer.modelTank, rootMat, {}), true);
  assert.equal(renderer.drawModel(renderer.modelHeli, rootMat, { rotorAngle: 1 }), true);
  assert.equal(counts.createBuffer, 0);
  assert.ok(counts.bindBuffer <= 6, `bindBuffer: ${counts.bindBuffer}`);
  // Segunda ronda igual: ni un buffer nuevo ni enlaces de más.
  counts.createBuffer = 0;
  counts.bindBuffer = 0;
  for (let i = 0; i < 9; i++)
    renderer.drawModel(renderer.modelTank, rootMat, {});
  renderer.drawModel(renderer.modelHeli, rootMat, { rotorAngle: 2 });
  assert.equal(counts.createBuffer, 0);
  assert.ok(counts.bindBuffer <= 6, `bindBuffer: ${counts.bindBuffer}`);
  // Y en un render completo con 9 tanques tampoco se crea nada nuevo.
  counts.createBuffer = 0;
  assert.equal(renderer.render(sceneWithTanks(9)), true);
  assert.equal(counts.createBuffer, 0);
  assert.equal(renderer.render(sceneWithTanks(9)), true);
  assert.equal(counts.createBuffer, 0);
  clearEmbedded();
});

test('el helicóptero enemigo Tan sigue procedural (no hay modelo Tan de helicóptero)', () => {
  clearEmbedded();
  loadEmbedded();
  const { counts, renderer } = fixture();
  counts.drawArrays = 0;
  counts.drawElements = 0;
  renderer.helicopter(0, 8, 0, 0, 0, true);
  assert.ok(counts.drawArrays > 10, 'helicóptero Tan procedural');
  assert.equal(counts.drawElements, 0);
  clearEmbedded();
});

test('scripts/embed-gltf.cjs regenera los datos embebidos iguales a los .gltf', () => {
  execFileSync(process.execPath, ['scripts/embed-gltf.cjs'], { cwd: root });
  loadEmbedded();
  assert.deepEqual(globalThis.ToyModeloHelicoptero, readGltf('helicoptero.gltf'));
  assert.deepEqual(globalThis.ToyModeloTanque, readGltf('tanque-tan.gltf'));
  const heliSrc = fs.readFileSync(path.join(root, 'src', 'modelo-helicoptero.js'), 'utf8');
  assert.match(heliSrc, /ToyModeloHelicoptero = \{/);
  assert.match(heliSrc, /Generado por `node scripts\/embed-gltf\.cjs`/);
  clearEmbedded();
});

test('bootstrap carga el cargador y los modelos antes del renderer', () => {
  const bootstrap = require('../src/bootstrap.js');
  assert.equal(bootstrap.VERSION, 'sin-escombros-1');
  const order = bootstrap.scripts;
  assert.ok(order.indexOf('gltf-loader') < order.indexOf('toy-renderer'));
  assert.ok(order.indexOf('modelo-helicoptero') < order.indexOf('toy-renderer'));
  assert.ok(order.indexOf('modelo-tanque') < order.indexOf('toy-renderer'));
  assert.ok(order.indexOf('gltf-loader') < order.indexOf('modelo-helicoptero'));
});

test('el CSS separa el botón Misión de la etiqueta SALUD y la barra', () => {
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  // Primera aparición de cada regla = la regla principal (las del
  // @media (max-height: 500px) van después y son para paisaje).
  const rule = (selector) => {
    const m = css.match(new RegExp(selector + '\\s*\\{([^}]*)\\}'));
    assert.ok(m, selector + ' sin regla');
    return m[1];
  };
  const top = (text) => {
    const m = text.match(/top:\s*(\d+)px/);
    assert.ok(m, 'sin top en ' + text.slice(0, 40));
    return Number(m[1]);
  };
  const mission = rule('#missionBtn');
  assert.match(mission, /left:\s*50%/);
  assert.match(mission, /translateX\(-50%\)/);
  const missionBottom = top(mission) + Number(mission.match(/min-height:\s*(\d+)px/)[1]);
  // La salud empieza por debajo de donde termina el botón Misión.
  assert.ok(top(rule('#arm')) >= missionBottom, '#arm invade #missionBtn');
  assert.ok(top(rule('#armLabel')) >= missionBottom, '#armLabel invade #missionBtn');
  // La salud sigue a la derecha y el aviso ya no tapa su fila.
  assert.match(rule('#arm'), /right:\s*12px/);
  assert.ok(top(rule('#toast')) >= top(rule('#arm')) + 12, '#toast tapa la salud');
});
