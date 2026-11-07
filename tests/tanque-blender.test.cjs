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

test('el .glb local existe y es un GLB válido (magic glTF, versión 2)', () => {
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
    'Cupula',
  ]) {
    assert.ok(names.includes(needed), `falta el nodo ${needed}`);
  }
  const torreta = gltf.nodes.find((n) => n.name === 'Torreta');
  const piezasIdx = gltf.nodes
    .map((n, i) =>
      ['TorretaCuerpo', 'Canon', 'Bocacha', 'Cupula'].includes(n.name || '')
        ? i
        : -1,
    )
    .filter((i) => i >= 0);
  assert.ok(piezasIdx.length >= 4);
  assert.ok(Array.isArray(torreta.children));
  for (const i of piezasIdx) {
    assert.ok(torreta.children.includes(i), 'la pieza debe colgar del vacío Torreta');
  }
});

test('el modelo usa los colores del tanque Tan del vídeo original', () => {
  const gltf = readGltfJson();
  const colors = (gltf.materials || []).map((m) => m.pbrMetallicRoughness.baseColorFactor);
  // Amarillo paja pálido del vídeo (PS1, 1999), no el amarillo vivo
  // del juego (0.95, 0.76, 0.2): en el vídeo el tanque es un mostaza
  // paja claro, menos naranja y saturado.
  const amarillo = colors.find(
    (c) => c && Math.abs(c[0] - 0.88) < 0.01 && Math.abs(c[1] - 0.74) < 0.01,
  );
  assert.ok(amarillo, 'falta el amarillo paja del vídeo (0.88, 0.74, 0.30)');
  const marron = colors.find(
    (c) => c && Math.abs(c[0] - 0.34) < 0.01 && Math.abs(c[1] - 0.29) < 0.01,
  );
  assert.ok(marron, 'falta el marrón oliva de las orugas (0.34, 0.29, 0.12)');
});

test('correcciones del vídeo: sin antena ni banda ni faros, con tacos y torreta baja', () => {
  const gltf = readGltfJson();
  const names = (gltf.nodes || []).map((n) => n.name || '');
  // En el vídeo no se ven: antena, banda rojiza en la torreta, faros
  // de marfil ni guardabarros amarillos sobre las orugas.
  for (const ausente of ['Antena', 'BandaCupula', 'Faro_Izq', 'Faro_Der',
    'Guardabarros_Izq', 'Guardabarros_Der', 'CajaTorreta']) {
    assert.ok(!names.includes(ausente), `sobra el nodo ${ausente}`);
  }
  // Tacos rectangulares sobre las orugas (9 por lado), visibles desde
  // arriba como en el vídeo.
  const tacos = names.filter((n) => n.startsWith('Taco_'));
  assert.equal(tacos.length, 18, `tacos: ${tacos.length}`);
  // Torreta baja y pequeña: elipsoide achatado (en glTF el eje plano
  // es la Y, escala 0,45) y más estrecha que el casco (X 0,85).
  const cuerpo = gltf.nodes.find((n) => n.name === 'TorretaCuerpo');
  assert.ok(cuerpo && Array.isArray(cuerpo.scale));
  assert.ok(cuerpo.scale[1] < 0.6, `torreta poco achatada: ${cuerpo.scale}`);
  assert.ok(cuerpo.scale[0] <= 1.0, `torreta demasiado ancha: ${cuerpo.scale}`);
  // Bocacha en forma de bloque y cruceta en X sobre la cubierta trasera.
  assert.ok(names.includes('Bocacha'));
  assert.ok(names.includes('Mantelete'));
  assert.ok(names.includes('Cruceta_0') && names.includes('Cruceta_1'));
});

test('las 4 vistas previas existen y son PNG válidos', () => {
  for (const name of ['frontal', 'lateral', 'cenital', 'tres-cuartos']) {
    const file = path.join(previewsDir, `tanque_${name}.png`);
    const buf = fs.readFileSync(file);
    assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(buf.length > 10000, `${name}: PNG demasiado pequeño`);
  }
});
