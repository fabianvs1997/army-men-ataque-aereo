# Jeep y caja de la Misión 1, modelados en Blender

Dos modelos nuevos para la Misión 1 «Plastic Pandemonium», según el
vídeo de 125,5 s del Army Men: Air Attack original (1999), catalogado
fotograma a fotograma en
`departamento-videojuegos/catalogo-mision-video-m1.md`.

- `assets/blender/jeep.py` — jeep/camión ligero Tan amarillo mostaza,
  el único vehículo Tan del vídeo además de los tanques (zona norte
  del valle). Chasis bajo y largo (~4,4 m), capó, cabina abierta con
  parabrisas, caja trasera con lona, 4 ruedas con bujes amarillos y
  rueda de repuesto. **1.084 triángulos** (límite 3.000), 34 objetos,
  6 materiales.
- `assets/blender/caja.py` — caja de suministros verde brillante con
  flecha blanca, la carga que se levanta con el winch. Cuerpo verde
  brillante, tapa más clara, flecha blanca en la cara superior y en
  las cuatro laterales. **172 triángulos** (límite 1.000), 16 objetos,
  4 materiales.

## Archivos

- `assets/blender/jeep.py`, `assets/blender/caja.py` — scripts que
  construyen los modelos (la fuente de verdad, no hay `.blend`).
- `assets/jeep-tan.glb`, `assets/caja-suministros.glb` — solo en
  local (la API de GitHub no admite binarios, no van en el PR).
- `assets/jeep-tan.gltf`, `assets/caja-suministros.gltf` — glTF con
  el buffer embebido en base64, los que se suben al repo.
- `src/modelo-jeep.js`, `src/modelo-caja.js` — datos embebidos como
  JS, generados con `node scripts/embed-gltf.cjs` (no se editan a mano).
- `assets/blender/previews/jeep_{frontal,lateral,cenital,tres-cuartos}.png`
  y `caja_{frontal,lateral,cenital,tres-cuartos}.png` — vistas
  previas renderizadas con Cycles por CPU (no van en el PR).
- `assets/blender/jeep-stats.json`, `assets/blender/caja-stats.json`
  — conteo de triángulos por objeto.

## Cómo se regeneran

```sh
blender --background --python assets/blender/jeep.py
blender --background --python assets/blender/caja.py
node scripts/embed-gltf.cjs
```

Blender 4.2.0 en `~/workspace/tools/blender-4.2.0-linux-x64/`, renders
con Cycles por CPU. El morro apunta a +Y en Blender (+Z en glTF).

## Integración en el juego

`src/toy-renderer.js` los carga desde los datos embebidos
(`initModels`, como el helicóptero y el tanque) y los dibuja con
`tryDrawJeepModel` (enemigo `jeep`) y `tryDrawCrateModel` (caja en el
suelo y colgando del winch). Sin datos embebidos o si el parseo
falla, el juego sigue con el dibujado procedural de antes y
`?modelos=1` dice qué se dibuja y por qué. Pruebas en
`tests/mision1-video.test.cjs`.

## Sin verificar

Sin navegador real ni iPhone en este entorno: los modelos en WebGL
real en el iPhone y su rendimiento los confirma Fabian.
