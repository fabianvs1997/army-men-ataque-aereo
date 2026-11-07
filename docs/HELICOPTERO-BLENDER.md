# Helicóptero en Blender

Modelo 3D original del helicóptero verde del juego, hecho desde cero en
Blender (no es un modelo del juego original: es una recreación con las
proporciones y los colores del helicóptero que hoy dibuja el juego en
`src/toy-helicopter.js`).

## Archivos

- `assets/blender/helicoptero.py` — el script que construye el modelo.
  Es la fuente de verdad: no hay un `.blend` guardado, el modelo se
  regenera entero corriendo el script.
- `assets/helicoptero.glb` — el modelo exportado (glTF binario).
- `assets/helicoptero.gltf` — el mismo modelo en glTF con el buffer
  embebido en base64. Es texto UTF-8 y es el archivo que se sube al
  repo, porque la API de GitHub no admite archivos binarios: el `.glb`
  se regenera en local con el script.
- `assets/blender/previews/helicoptero_{frontal,lateral,cenital,tres-cuartos}.png`
  — 4 vistas previas renderizadas con Cycles.
- `assets/blender/helicoptero-stats.json` — conteo de triángulos
  generado por el script.

## Cómo se regenera

Blender 4.2.0, en headless (este entorno no tiene EGL real, así que los
renders usan Cycles por CPU; EEVEE no arranca aquí):

```sh
blender --background --python assets/blender/helicoptero.py
```

El Blender de este entorno vive en `~/workspace/tools/blender-4.2.0-linux-x64/`
(descarga oficial 4.2.0 LTS, fuera del repo). Si Blender no arranca por
`libEGL.so.1`, hacen falta las librerías EGL del sistema (`libegl1`).

El script limpia la escena, construye el modelo, cuenta los triángulos,
renderiza las 4 vistas y exporta `.glb` + `.gltf` embebido.

## El modelo

Helicóptero de juguete verde estilo Huey, en metros, morro hacia +Y en
Blender (al exportar a glTF el morro queda hacia +Z, adelante en glTF,
y arriba es +Y):

- Fuselaje verde alargado con cabina de cristal oscuro en dos secciones,
  motores laterales con escapes, insignias redondas de marfil con centro
  verde en el fuselaje y en las alas.
- Cola: botalón cónico, estabilizador horizontal, deriva clara con baliza
  roja y rotor de cola de 2 palas.
- Rotor principal de 2 palas con puntas marfil, sobre mástil con base
  abombada. Las palas cuelgan del vacío `Rotor`, para poder girarlas
  luego en el juego.
- Alas cortas con lanzacohetes (2 filas x 3 cohetes por ala, con punta
  marfil), cañones en el morro y patines de aterrizaje con soportes.
- Colores lineales del juego (`src/toy-helicopter.js`): verde
  (0.17, 0.53, 0.035), verde claro, verde oscuro, cristal oscuro,
  marfil, rojo y metal oscuro. Los materiales son Principled BSDF con
  rugosidad de plástico (0.42–0.5).

Medidas: unos 11 m de largo (morro a deriva), 17 m de envergadura del
rotor, 3 m de alto hasta el buje. **4.516 triángulos** (límite: 5.000,
para que corra en un iPhone), 78 objetos.

## Qué falta para usarlo en el juego (siguiente paso, no en este PR)

El juego hoy dibuja el helicóptero con piezas sueltas en
`src/toy-helicopter.js` / `src/toy-renderer.js`, no carga modelos. Para
usar este modelo hace falta:

1. Un cargador glTF mínimo en el juego (leer el JSON de
   `assets/helicoptero.gltf`, sus buffers base64 y sus primitivas) o
   una librería pequeña de carga glTF, sin romper que el juego no tiene
   build y debe seguir funcionando desde `file://`.
2. Sustituir el dibujado por piezas del helicóptero del jugador por el
   modelo cargado, manteniendo la misma escala (1 unidad del juego ≈
   1 m del modelo), el giro del rotor (`Rotor`) y el destello de daño.
3. Que el modelo no se cargue si WebGL no está disponible, y que el
   juego siga funcionando sin él (modo invitado / sin red).
4. Medir el rendimiento en el iPhone: el modelo tiene 4.516 tris, pero
   hay que comprobar que cargarlo no añada tirones al arrancar la misión.
