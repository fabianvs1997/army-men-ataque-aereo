const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const gltfPath = path.join(root, 'assets', 'tanque-tan.gltf');
const glbPath = path.join(root, 'assets', 'tanque-tan.glb');
const scriptPath = path.join(root, 'assets', 'blender', 'tanque.py');
const statsPath = path.join(root, 'assets', 'blender', 'tanque-stats.json');
const previewsDir = path.join(root, 'assets', 'blender', 'previews');

// Límite del modelo para que corra en un iPhone (docs/TANQUE-BLENDER.md).
const MAX_TRIS = 3000;

function readGltfJson() {
  return JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
}

// Cuenta los triángulos de un glTF leyendo sus primitivas: con índices,
// índices/3; sin índices, posiciones/3.
function countTris(gltf) {
  const accessors = gltf.accessors || [];
  let tris = 0;
  for (const mesh of gltf.meshes || []) {
    for (const prim of mesh.primitives || []) {
      if (prim.indices !== undefined) tris += accessors[prim.indices].count / 3;
      else tris += accessors[prim.attributes.POSITION].count / 3;
    }
  }
  return tris;
}

test('el script de Blender existe y construye y exporta el modelo', () => {
  const script = fs.readFileSync(scriptPath, 'utf8');
  assert.match(script, /import bpy/);
  assert.match(script, /export_scene\.gltf/);
  assert.match(script, /TorretaCuerpo/);
  assert.match(script, /MAX_TRIS = 3000/);
});

test('el .gltf existe, es texto UTF-8 válido y es glTF 2.0 de Blender', () => {
  const gltf = readGltfJson();
  assert.equal(gltf.asset.version, '2.0');
  assert.match(gltf.asset.generator, /Blender/);
  assert.ok(Array.isArray(gltf.meshes) && gltf.meshes.length > 0);
  assert.ok(Array.isArray(gltf.nodes) && gltf.nodes.length > 0);
  assert.ok(Array.isArray(gltf.materials) && gltf.materials.length > 0);
  assert.ok(Array.isArray(gltf.scenes) && gltf.scenes.length > 0);
});

test('el .gltf lleva el buffer embebido en base64 y se puede decodificar', () => {
  const gltf = readGltfJson();
  assert.equal(gltf.buffers.length, 1);
  const uri = gltf.buffers[0].uri;
  assert.match(uri, /^data:application\/octet-stream;base64,/);
  const bin = Buffer.from(uri.split(',')[1], 'base64');
  assert.equal(bin.length, gltf.buffers[0].byteLength);
  assert.ok(bin.length > 0);
});

test('el .glb local existe y es un GLB válido (magic glTF, versión 2)', (t) => {
  // El .glb no se sube al repo (la API de GitHub no admite binarios):
  // en un checkout limpio (CI) no existe y el test se salta; en local
  // se regenera con el script y entonces sí se comprueba.
  if (!fs.existsSync(glbPath)) {
    t.skip('sin .glb en este checkout (binario, no se sube al repo)');
    return;
  }
  const buf = fs.readFileSync(glbPath);
  assert.equal(buf.toString('ascii', 0, 4), 'glTF');
  assert.equal(buf.readUInt32LE(4), 2);
  assert.equal(buf.readUInt32LE(8), buf.length);
});

test('el modelo tiene menos de 3.000 triángulos y más de 100', () => {
  const gltf = readGltfJson();
  const tris = countTris(gltf);
  assert.ok(tris > 100, `muy pocos triángulos: ${tris}`);
  assert.ok(tris <= MAX_TRIS, `demasiados triángulos: ${tris} > ${MAX_TRIS}`);
  const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  assert.equal(stats.tris, tris);
  assert.equal(stats.limite, MAX_TRIS);
});

test('el modelo trae las piezas del tanque: casco, orugas, torreta y cañón', () => {
  const gltf = readGltfJson();
  const names = (gltf.nodes || []).map((n) => n.name || '');
  for (const needed of [
    'CascoInferior',
    'CascoSuperior',
    'Oruga_Izq',
    'Oruga_Der',
    'PlacaFrontal',
    'Torreta',
    'TorretaCuerpo',
    'Canon',
    'Bocacha',
    'AroEscotilla',
    'Escotilla',
    'Faro_Izq',
    'Faro_Der',
    'RejillaTrasera',
  ]) {
    assert.ok(names.includes(needed), `falta el nodo ${needed}`);
  }
  const torreta = gltf.nodes.find((n) => n.name === 'Torreta');
  const piezasIdx = gltf.nodes
    .map((n, i) =>
      ['TorretaCuerpo', 'Canon', 'Bocacha', 'AroEscotilla', 'Escotilla'].includes(n.name || '')
        ? i
        : -1,
    )
    .filter((i) => i >= 0);
  assert.ok(piezasIdx.length >= 5);
  assert.ok(Array.isArray(torreta.children));
  for (const i of piezasIdx) {
    assert.ok(torreta.children.includes(i), 'la pieza debe colgar del vacío Torreta');
  }
});

test('el modelo usa los colores del tanque Tan de los dos vídeos del original', () => {
  const gltf = readGltfJson();
  const colors = (gltf.materials || []).map((m) => m.pbrMetallicRoughness.baseColorFactor);
  // Amarillo mostaza vivo con toque verde, muestreado de los
  // fotogramas claros (vídeo 1, ~51 s: sRGB #F4E34B; vídeo 2,
  // ~66 s: sRGB #E1D921): lineal (0.85, 0.72, 0.06). El paja
  // pálido de la revisión 2 (0.88, 0.74, 0.30) salía crema/beige.
  const amarillo = colors.find(
    (c) => c && Math.abs(c[0] - 0.85) < 0.01 && Math.abs(c[1] - 0.72) < 0.01,
  );
  assert.ok(amarillo, 'falta el amarillo mostaza de los vídeos (0.85, 0.72, 0.06)');
  // Orugas de un oliva muy oscuro (vídeo 1, ~51 s, cara en sombra:
  // sRGB #2A2803): lineal (0.18, 0.16, 0.04).
  const marron = colors.find(
    (c) => c && Math.abs(c[0] - 0.18) < 0.01 && Math.abs(c[1] - 0.16) < 0.01,
  );
  assert.ok(marron, 'falta el oliva oscuro de las orugas (0.18, 0.16, 0.04)');
});

test('correcciones de los dos vídeos: cúpula grande, sin X ni disco negro, con faros', () => {
  const gltf = readGltfJson();
  const names = (gltf.nodes || []).map((n) => n.name || '');
  // En los vídeos no se ven: antena, banda rojiza en la torreta,
  // guardabarros amarillos sobre las orugas, periscopio, ni cruceta
  // en X en la cubierta (la revisión 2 la inventó: en ningún
  // fotograma claro — vídeo 2, ~63 s y ~111 s — se ve una X).
  for (const ausente of ['Antena', 'BandaCupula', 'Guardabarros_Izq',
    'Guardabarros_Der', 'CajaTorreta', 'Cruceta_0', 'Cruceta_1',
    'Periscopio', 'Cupula']) {
    assert.ok(!names.includes(ausente), `sobra el nodo ${ausente}`);
  }
  // Faros redondos en la cubierta delantera y rejilla en la trasera
  // (vídeo 2, ~63 s), y escotilla plana con aro oscuro (no un disco
  // negro grande, que desde arriba se leía como un agujero).
  for (const presente of ['Faro_Izq', 'Faro_Der', 'RejillaTrasera',
    'AroEscotilla', 'Escotilla']) {
    assert.ok(names.includes(presente), `falta el nodo ${presente}`);
  }
  // Tacos rectangulares sobre las orugas (9 por lado), visibles desde
  // arriba como en el vídeo.
  const tacos = names.filter((n) => n.startsWith('Taco_'));
  assert.equal(tacos.length, 18, `tacos: ${tacos.length}`);
  // Torreta en cúpula GRANDE: en el vídeo 2 (~111 s) ocupa ~57% del
  // ancho del casco (elipsoide de 2,1 m de ancho; en glTF el eje
  // plano es la Y, escala 0,5). La revisión 2 la hizo pequeña
  // (1,7 m, 44% del casco) y era el fallo más visible desde arriba.
  const cuerpo = gltf.nodes.find((n) => n.name === 'TorretaCuerpo');
  assert.ok(cuerpo && Array.isArray(cuerpo.scale));
  assert.ok(cuerpo.scale[1] < 0.6, `torreta poco achatada: ${cuerpo.scale}`);
  assert.ok(cuerpo.scale[0] > 1.0 && cuerpo.scale[0] <= 1.2,
    `torreta demasiado pequeña o grande: ${cuerpo.scale}`);
  // Bocacha cilíndrica en la punta del cañón (no un bloque pálido) y
  // mantelete redondeado (no una caja).
  assert.ok(names.includes('Bocacha'));
  assert.ok(names.includes('Mantelete'));
});

test('las 4 vistas previas existen y son PNG válidos', (t) => {
  // Como el .glb, las vistas previas no se suben al repo (binarios):
  // en un checkout limpio (CI) no existen y el test se salta.
  const missing = ['frontal', 'lateral', 'cenital', 'tres-cuartos'].filter(
    (name) => !fs.existsSync(path.join(previewsDir, `tanque_${name}.png`)),
  );
  if (missing.length > 0) {
    t.skip(`sin vistas previas en este checkout (faltan: ${missing.join(', ')})`);
    return;
  }
  for (const name of ['frontal', 'lateral', 'cenital', 'tres-cuartos']) {
    const file = path.join(previewsDir, `tanque_${name}.png`);
    const buf = fs.readFileSync(file);
    assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(buf.length > 10000, `${name}: PNG demasiado pequeño`);
  }
});
