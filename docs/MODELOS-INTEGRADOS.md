# Modelos de Blender integrados en el juego

El helicóptero del jugador y los tanques Tan ya no se dibujan con
piezas procedurales: usan los modelos de Blender
(`assets/helicoptero.gltf`, rev. 3, 3.540 tris;
`assets/tanque-tan.gltf`, rev. 3, 1.680 tris). Todo lo demás sigue
igual (reglas, misiones, HUD, sonidos): solo cambia CÓMO se dibujan
esos dos.

## Piezas

- `src/gltf-loader.js` — cargador glTF 2.0 mínimo, sin dependencias,
  en UMD clásico como los demás módulos. Parsea el JSON (buffer
  base64 → bytes; accessors POSITION/NORMAL/índices con componentType
  5123/5125/5126 y byteStride), construye por primitiva Float32Array
  de posiciones/normales e índices, lee materiales (`baseColorFactor`,
  `alphaMode`) y reconstruye la jerarquía de nodos (TRS con cuaternión
  o matriz). Expone `parse`, `countTris`, `findNode`,
  `modelExtents` y `nodeWorldMatrices(model, {rotorAngle,
  turretAngle})`, además de matemática mat4/cuaternión sin librerías.
  Sin texturas, skins, animaciones ni extensiones KHR: lo no
  soportado se ignora (la primitiva se salta) sin romper el modelo.
- `src/modelo-helicoptero.js` y `src/modelo-tanque.js` — los dos
  `.gltf` embebidos como datos JS (`globalThis.ToyModeloHelicoptero`
  / `ToyModeloTanque`). Se generan con `scripts/embed-gltf.cjs` (ver
  abajo). Sin ellos el juego no puede leer los `.gltf` con `fetch`
  desde `file://` en Chrome.
- `src/toy-renderer.js` — segundo programa de shader que comparte el
  fragment shader (misma luz y niebla) con un vertex shader que
  recibe `uniform mat4 uModel` (matriz modelo completa). `drawModel`
  recorre los nodos, compone matrices y dibuja cada primitiva con el
  color de su material (gloss plástico 0,6; `flash` → blanco, como el
  destello procedural). `helicopter()` usa el modelo para el jugador
  (`tan=false`) con `rotorAngle = rot`; el bucle de enemigos usa el
  modelo para `e.k === 'tank'`.
- `src/bootstrap.js` — carga `gltf-loader`, `modelo-helicoptero` y
  `modelo-tanque` ANTES de `toy-renderer`. `VERSION`:
  `integrar-modelos-1`.

## Orientación y escala

- Los DOS modelos llevan el morro a **-Z** en espacio glTF (cabina
  delantera del helicóptero en z=-2,8; placa frontal y cañón del
  tanque en z=-2,45/-3,95) y el morro procedural del juego apunta a
  **+Z** local. Cada modelo se dibuja con yaw de juego + π
  (`MODEL_NOSE_YAW_OFFSET`, verificado con test: el punto del morro
  transformado por Ry(yaw + π) cae en (sin yaw, cos yaw), la
  dirección del morro procedural).
- Escala 1:1 (1 unidad del juego ≈ 1 m del modelo), sin factor de
  escala: rotor de ~15 u de diámetro (como el procedural, ~16 u),
  tanque de 5,6 u de largo y 2,4 u de alto, con la base en y≈0.
- Helicóptero: la matriz raíz es traslación + tilt (rotación `pitch`
  alrededor del eje de `yaw`, con pivote en el centro, igual que el
  shader principal) + yaw + π. Se conservan la sombra de contacto y
  el winch/cable/caja (que dibuja el renderer aparte desde `cargo`).
  El rotor gira componiendo una rotación Y adicional sobre el nodo
  vacío `Rotor` (conmuta con su rotación base, también Y, de 45°).
- Tanque: matriz raíz con posición sobre el suelo y yaw + π; la
  torreta gira 0 respecto al casco porque el `yaw` del tanque ya es
  la dirección de puntería (hacia el jugador). El cargador acepta
  igual un `turretAngle` independiente (el mecanismo existe y se
  prueba). Se conserva la elipse oscura del suelo bajo el tanque.
- El helicóptero enemigo Tan (`tan=true`) SIGUE procedural: no hay
  modelo Tan del helicóptero enemigo. Los tanques destruidos ya no dejan pecio ni restos: solo explosión y humo.

## Respaldo procedural (nunca en negro, nunca roto)

1. Datos embebidos (`ToyModeloHelicoptero` / `ToyModeloTanque`) si
   existen y el parseo funciona.
2. Si no, `fetch('assets/helicoptero.gltf')` /
   `fetch('assets/tanque-tan.gltf')` (GitHub Pages), una sola vez por
   sesión; los fallos se tragan.
3. Si eso también falla (o no hay cargador, o no hay WebGL), el juego
   sigue con los modelos procedurales de antes. Los tests cubren los
   tres casos: sin datos y con datos corruptos el helicóptero dibuja
   procedural y `render()` sigue devolviendo `true`.

## Rendimiento (medido con el mock de WebGL de los tests)

- Tris por cuadro con 9 tanques + helicóptero del jugador:
  3.540 + 9 × 1.680 = **18.660 tris** de modelos
  (55.980 índices en 501 `drawElements`: 60 primitivas del
  helicóptero + 441 del tanque).
- Buffers GPU: cada modelo fusiona todas sus primitivas en UN buffer
  de posiciones, UNO de normales y UNO de índices (**3 buffers por
  modelo, 6 en total**), creados una sola vez y compartidos entre
  todas las instancias. Un segundo render completo con 9 tanques no
  crea ningún buffer nuevo (0 `createBuffer`).
- `bindBuffer`: 10 dibujos seguidos (9 tanques + helicóptero) enlazan
  **6 veces** (3 por modelo), no por pieza (501 primitivas) ni por
  tanque: los 9 tanques seguidos reutilizan los mismos punteros.
- Sin verificar (sin navegador real ni iPhone en este entorno): cómo
  se ven los modelos en WebGL real ni los FPS en el iPhone con 9
  tanques en la Misión 3.

## Regenerar los datos embebidos

Tras regenerar un modelo en Blender (`assets/blender/*.py`) y
reexportar su `.gltf`, hay que regenerar los datos embebidos:

```sh
node scripts/embed-gltf.cjs
```

El script lee `assets/helicoptero.gltf` y `assets/tanque-tan.gltf` y
escribe `src/modelo-helicoptero.js` y `src/modelo-tanque.js` con el
JSON como literal (`globalThis.ToyModeloHelicoptero = {...}` /
`ToyModeloTanque`). Los archivos generados no se editan a mano. El
test `scripts/embed-gltf.cjs regenera los datos embebidos iguales a
los .gltf` lo comprueba corriendo el script y comparando con los
`.gltf` del repo.

## HUD: botón Misión y SALUD ya no se solapan

Captura de Fabian (2026-11-07, 18:00): el botón «Misión»
(`#missionBtn`, arriba en el centro, top 12, 44 de alto) y la
etiqueta «SALUD» (`#armLabel`) con su barra (`#arm`) se solapaban
arriba en el centro en pantallas estrechas (la salud iba en top
36-37, dentro de la franja 12-56 del botón). Ahora la salud va en su
propia fila (top 60-61 para la barra y la etiqueta, a la derecha),
entre el botón Misión (que termina en 56) y los botones
Pausa/Silenciar (que empiezan en 76), y el aviso `#toast` baja de
top 64 a 124 para no tapar esa fila al aparecer. Nada más del HUD
cambia. El test del CSS lo fija: `#arm` y `#armLabel` empiezan por
debajo de donde termina `#missionBtn`.

## Pruebas

`tests/integracion-modelos.test.cjs` (16): el cargador parsea los dos
`.gltf` (tris 3.540 y 1.680), nodos `Rotor` (palas) y `Torreta`
(cañón) presentes, orientación del morro (test de yaw + π), rotor y
torreta que giran (matrices y posiciones mundo), respaldo procedural
sin datos y con datos corruptos, tris por cuadro y buffers GPU
creados una sola vez (mock de WebGL), helicóptero Tan enemigo
procedural, regeneración de los datos embebidos, orden del bootstrap
y separación del CSS. Se actualizan 2 tests de
`tests/renderer.test.cjs` (el segundo programa compila un shader más:
6 compilaciones tras restaurar el contexto en vez de 4; el varying
`surfaceNormal` se declara 3 veces: 2 vertex + 1 fragment) y la
VERSION en 3 tests (`integrar-modelos-1`).
