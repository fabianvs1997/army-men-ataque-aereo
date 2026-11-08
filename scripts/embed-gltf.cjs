// Genera `src/modelo-helicoptero.js` y `src/modelo-tanque.js` a partir
// de `assets/helicoptero.gltf` y `assets/tanque-tan.gltf`.
//
// Los `.gltf` no se pueden leer con `fetch` desde `file://` en Chrome,
// así que el juego lleva los modelos embebidos como datos JS y los
// carga desde ahí sin red. Si los datos embebidos faltan o el parseo
// falla, el juego intenta `fetch('assets/*.gltf')` (GitHub Pages) y,
// si eso también falla, sigue con los modelos procedurales de antes.
//
// Uso:
//   node scripts/embed-gltf.cjs
//
// Tras regenerar un modelo en Blender (assets/blender/*.py) y
// reexportar su `.gltf`, hay que correr este script y subir los dos
// `src/modelo-*.js` generados. Los archivos generados no se editan
// a mano. Detalle en `docs/MODELOS-INTEGRADOS.md`.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const MODELS = [
  {
    gltf: path.join(ROOT, 'assets', 'helicoptero.gltf'),
    out: path.join(ROOT, 'src', 'modelo-helicoptero.js'),
    global: 'ToyModeloHelicoptero',
  },
  {
    gltf: path.join(ROOT, 'assets', 'tanque-tan.gltf'),
    out: path.join(ROOT, 'src', 'modelo-tanque.js'),
    global: 'ToyModeloTanque',
  },
];

function main() {
  for (const model of MODELS) {
    const raw = fs.readFileSync(model.gltf, 'utf8');
    const gltf = JSON.parse(raw);
    if (!gltf.asset || String(gltf.asset.version || '').indexOf('2.') !== 0)
      throw new Error(model.gltf + ': no es glTF 2.x');
    if (!Array.isArray(gltf.meshes) || gltf.meshes.length === 0)
      throw new Error(model.gltf + ': sin mallas');
    // JSON como literal JS; se escapa `<` para que el literal no pueda
    // cerrar un <script> si el archivo se incrusta en HTML.
    const literal = JSON.stringify(gltf).replace(/</g, '\\u003c');
    const content =
      '// Generado por `node scripts/embed-gltf.cjs` a partir de ' +
      path.relative(ROOT, model.gltf) +
      '.\n' +
      '// No editar a mano: regenera con el script (ver docs/MODELOS-INTEGRADOS.md).\n' +
      "(function (root) {\n  'use strict';\n  root." +
      model.global +
      ' = ' +
      literal +
      ';\n})(typeof globalThis !== \'undefined\' ? globalThis : this);\n';
    fs.writeFileSync(model.out, content);
    console.log(
      path.relative(ROOT, model.out) +
        ': ' +
        content.length +
        ' bytes (' +
        gltf.meshes.length +
        ' mallas, ' +
        (gltf.nodes || []).length +
        ' nodos)',
    );
  }
}

if (require.main === module) main();
module.exports = { main, MODELS };
