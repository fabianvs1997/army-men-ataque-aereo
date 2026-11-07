# Tanque Tan en Blender

Modelo 3D original del tanque enemigo Tan, amarillo/tostado, de juguete
de plástico, hecho desde cero en Blender (no es un modelo del juego
original: es una recreación con las proporciones y los colores del
tanque Tan que hoy dibuja el juego en `src/toy-renderer.js` y
`src/debris.js`). No hay tanque verde del jugador en el juego (el
jugador es el helicóptero), así que solo se modela la variante Tan.

## Archivos

- `assets/blender/tanque.py` — el script que construye el modelo.
  Es la fuente de verdad: no hay un `.blend` guardado, el modelo se
  regenera entero corriendo el script.
- `assets/tanque-tan.glb` — el modelo exportado (glTF binario).
- `assets/tanque-tan.gltf` — el mismo modelo en glTF con el buffer
  embebido en base64. Es texto UTF-8 y es el archivo que se sube al
  repo, porque la API de GitHub no admite archivos binarios: el `.glb`
  se regenera en local con el script.
- `assets/blender/previews/tanque_{frontal,lateral,cenital,tres-cuartos}.png`
  — 4 vistas previas renderizadas con Cycles.
- `assets/blender/tanque-stats.json` — conteo de triángulos generado
  por el script.

## Cómo se regenera

Blender 4.2.0, en headless (este entorno no tiene EGL real, así que los
renders usan Cycles por CPU; EEVEE no arranca aquí):

```sh
blender --background --python assets/blender/tanque.py
```

El Blender de este entorno vive en `~/workspace/tools/blender-4.2.0-linux-x64/`
(descarga oficial 4.2.0 LTS, fuera del repo). Si Blender no arranca por
`libEGL.so.1`, hacen falta las librerías EGL del sistema (`libegl1`).

El script limpia la escena, construye el modelo, cuenta los triángulos,
renderiza las 4 vistas y exporta `.glb` + `.gltf` embebido.

## El modelo

Tanque de juguete Tan, en metros, morro hacia +Y en Blender (al
exportar a glTF el morro queda hacia +Z, adelante en glTF, y arriba es
+Y):

- Casco amarillo con placa frontal inclinada marrón oscuro, faros de
  marfil, ganchos de remolque, caja de pertrechos trasera y tubo de
  escape.
- Orugas marrón tostado a cada lado, con 5 ruedas de rodaje, rueda
  motriz trasera y tensora delantera visibles en la cara exterior, y
  guardabarros amarillos encima.
- Torreta giratoria: cuerpo achatado, anillo marrón sobre el casco,
  cañón largo y grueso con bocacha oscura en la punta, cúpula del jefe
  con banda rojiza y escotilla oscura, periscopio, antena y caja
  lateral. La torreta y sus piezas cuelgan del vacío `Torreta`, para
  poder girarla luego en el juego.
- Colores lineales del juego (`src/toy-renderer.js`): amarillo
  (0.95, 0.76, 0.2), marrón tostado (0.45, 0.32, 0.12), banda rojiza
  (0.55, 0.25, 0.1), marfil y metal oscuro. Los materiales son
  Principled BSDF con rugosidad de plástico (0.45–0.5).

Medidas: unos 6,5 m de largo (morro a escape, 8,5 m con el cañón),
5,2 m de ancho con orugas, 3,5 m de alto hasta la cúpula.
**1.796 triángulos** (límite: 3.000, para que corra en un iPhone), 37
objetos.

## Tres trampas de Blender que costaron una revisión

1. **Emparentar mueve las piezas**: al asignar `obj.parent = torreta`
   a secas, la posición pasa a ser relativa al padre y la torreta
   quedaba flotando 2,1 u sobre el casco. El script usa
   `parent_keep()`, que además pone
   `obj.matrix_parent_inverse = parent.matrix_world.inverted()`.
2. **Tapas planas con sombreado suave**: las tapas de un cilindro con
   `use_smooth` salen con un punto oscuro en el centro (las ruedas
   parecían donuts). Las ruedas, las motrices, las tensoras y la
   bocacha van sin suavizado (`smooth=False` en `add_cylinder`).
3. **El amarillo se apagaba**: con la transformada AgX por defecto, el
   amarillo vivo (0.95, 0.76, 0.2) salía crema pálido en las vistas.
   Las vistas usan `view_transform = "Standard"` para que el amarillo
   se vea como en el juego (el modelo no cambia: el color es el del
   juego).

## Qué falta para usarlo en el juego (siguiente paso, no en este PR)

El juego hoy dibuja el tanque Tan con piezas sueltas en
`src/toy-renderer.js`, no carga modelos. Para usar este modelo hace
falta:

1. Un cargador glTF mínimo en el juego (leer el JSON de
   `assets/tanque-tan.gltf`, sus buffers base64 y sus primitivas) o
   una librería pequeña de carga glTF, sin romper que el juego no tiene
   build y debe seguir funcionando desde `file://`. El cargador es el
   mismo que haría falta para el helicóptero (`assets/helicoptero.gltf`):
   un solo cargador para los dos modelos.
2. Sustituir el dibujado por piezas del tanque Tan por el modelo
   cargado, manteniendo la misma escala (1 unidad del juego ≈ 1 m del
   modelo), el giro de la torreta (`Torreta`, que hoy apunta al
   jugador) y el destello de daño (`e.fl`).
3. Que el modelo no se cargue si WebGL no está disponible, y que el
   juego siga funcionando sin él (modo invitado / sin red).
4. Medir el rendimiento en el iPhone: el modelo tiene 1.796 tris, pero
   hay que comprobar que cargarlo no añada tirones al arrancar la
   misión (hay hasta 9 tanques en la Misión 3).
