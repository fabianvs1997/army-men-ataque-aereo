const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const gltfPath = path.join(root, 'assets', 'helicoptero.gltf');
const glbPath = path.join(root, 'assets', 'helicoptero.glb');
const scriptPath = path.join(root, 'assets', 'blender', 'helicoptero.py');
const statsPath = path.join(root, 'assets', 'blender', 'helicoptero-stats.json');
const previewsDir = path.join(root, 'assets', 'blender', 'previews');

// Límite del modelo para que corra en un iPhone (docs/HELICOPTERO-BLENDER.md).
const MAX_TRIS = 5000;

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
  assert.match(script, /RotorBlade_/);
  assert.match(script, /MAX_TRIS = 5000/);
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

test('el modelo tiene menos de 5.000 triángulos y más de 100', () => {
  const gltf = readGltfJson();
  const tris = countTris(gltf);
  assert.ok(tris > 100, `muy pocos triángulos: ${tris}`);
  assert.ok(tris <= MAX_TRIS, `demasiados triángulos: ${tris} > ${MAX_TRIS}`);
  const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  assert.equal(stats.tris, tris);
  assert.equal(stats.limite, MAX_TRIS);
});

test('el modelo trae las piezas del helicóptero: rotor, cola, alas y patines', () => {
  const gltf = readGltfJson();
  const names = (gltf.nodes || []).map((n) => n.name || '');
  for (const needed of [
    'Fuselaje',
    'CabinaDelantera',
    'Rotor',
    'RotorBlade_Izq',
    'RotorBlade_Der',
    'BotalonCola',
    'Deriva',
    'Ala_Izq',
    'Ala_Der',
    'Patin_Izq',
    'Patin_Der',
  ]) {
    assert.ok(names.includes(needed), `falta el nodo ${needed}`);
  }
  const rotor = gltf.nodes.find((n) => n.name === 'Rotor');
  const bladeIdx = gltf.nodes
    .map((n, i) => ((n.name || '').startsWith('RotorBlade_') ? i : -1))
    .filter((i) => i >= 0);
  assert.ok(bladeIdx.length >= 2);
  assert.ok(Array.isArray(rotor.children));
  for (const i of bladeIdx) {
    assert.ok(rotor.children.includes(i), 'la pala debe colgar del vacío Rotor');
  }
  // Revisión 2 (video del original): puntas del rotor amarillas y
  // banda amarilla en la cola.
  for (const needed of ['RotorPunta_Izq', 'RotorPunta_Der', 'BandaCola']) {
    assert.ok(names.includes(needed), `falta el nodo ${needed}`);
  }
});

test('el modelo usa el verde saturado del video y las puntas amarillas', () => {
  const gltf = readGltfJson();
  const colors = (gltf.materials || []).map((m) => m.pbrMetallicRoughness.baseColorFactor);
  const green = colors.find(
    (c) => c && Math.abs(c[0] - 0.05) < 0.01 && Math.abs(c[1] - 0.52) < 0.01,
  );
  assert.ok(green, 'falta el verde saturado del video (0.05, 0.52, 0.02)');
  const yellow = colors.find(
    (c) => c && Math.abs(c[0] - 0.80) < 0.01 && Math.abs(c[1] - 0.55) < 0.01,
  );
  assert.ok(yellow, 'falta el amarillo de las puntas del rotor (0.80, 0.55, 0.03)');
});

test('las 4 vistas previas existen y son PNG válidos', (t) => {
  // Como el .glb, las vistas previas no se suben al repo (binarios):
  // en un checkout limpio (CI) no existen y el test se salta.
  const missing = ['frontal', 'lateral', 'cenital', 'tres-cuartos'].filter(
    (name) => !fs.existsSync(path.join(previewsDir, `helicoptero_${name}.png`)),
  );
  if (missing.length > 0) {
    t.skip(`sin vistas previas en este checkout (faltan: ${missing.join(', ')})`);
    return;
  }
  for (const name of ['frontal', 'lateral', 'cenital', 'tres-cuartos']) {
    const file = path.join(previewsDir, `helicoptero_${name}.png`);
    const buf = fs.readFileSync(file);
    assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(buf.length > 10000, `${name}: PNG demasiado pequeño`);
  }
});
