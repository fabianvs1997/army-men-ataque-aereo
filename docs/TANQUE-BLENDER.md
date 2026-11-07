# Tanque Tan en Blender

Modelo 3D original del tanque enemigo Tan, amarillo/tostado, de juguete
de plástico, hecho desde cero en Blender (no es un modelo del juego
original: es una recreación guiada por cómo se ve el tanque Tan en el
vídeo del original, PS1 1999). El vídeo manda: las proporciones y los
colores se ajustaron a lo que se ve en él (tanque largo y estrecho,
bajo, amarillo paja pálido, torreta baja con escotilla plana, cañón
largo y fino con bocacha en bloque, tacos en las orugas y cruceta en X
sobre la cubierta trasera), no a lo que hoy dibuja el juego en
`src/toy-renderer.js` y `src/debris.js` (que es más ancho que largo y
lleva cúpula alta con banda rojiza y antena). No hay tanque verde del
jugador en el juego (el jugador es el helicóptero), así que solo se
modela la variante Tan.

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

- Casco amarillo paja con placa frontal inclinada tostada, ganchos de
  remolque, cruceta en X sobre la cubierta trasera, caja de pertrechos
  trasera y tubo de escape.
- Orugas marrón oliva a cada lado, con 9 tacos rectangulares encima
  (visibles desde arriba, como en el vídeo), 5 ruedas de rodaje
  claras, rueda motriz trasera y tensora delantera visibles en la cara
  exterior. Sin guardabarros amarillos ni faros: en el vídeo no se ven.
- Torreta giratoria: cuerpo bajo y pequeño (poco más de la mitad del
  ancho del casco), anillo marrón sobre el casco, cañón largo y fino
  con bocacha en forma de bloque claro y anillo oscuro en su base,
  mantelete en el morro de la torreta, escotilla baja y plana con tapa
  oscura y periscopio bajo. Sin banda rojiza ni antena: en el vídeo no
  se ven. La torreta y sus piezas cuelgan del vacío `Torreta`, para
  poder girarla luego en el juego.
- Colores del vídeo original: amarillo paja (0.88, 0.74, 0.30), marrón
  oliva (0.34, 0.29, 0.12), tostado oscuro (0.66, 0.53, 0.16) y metal
  oscuro. Los materiales son Principled BSDF con rugosidad de
  plástico (0.45–0.5). El amarillo vivo del juego (0.95, 0.76, 0.2) y
  su marrón (0.45, 0.32, 0.12) se dejaron de usar: en el vídeo el
  tanque es un mostaza paja más claro y las orugas un oliva más oscuro.

Medidas: unos 5,6 m de largo de orugas (8,3 m con el cañón), 3,85 m de
ancho con orugas, 2,6 m de alto hasta la escotilla. **1.704
triángulos** (límite: 3.000, para que corra en un iPhone), 52 objetos.

## Diferencias con el vídeo que se corrigieron (2026-11-07)

Se vieron los fotogramas del vídeo original (1 cada 3 s, más densos
donde se ven bien los tanques: ~63–72 s y ~111–117 s) antes de tocar
el modelo:

1. **Proporciones**: el modelo era casi cuadrado (orugas de 3,7 de
   largo, 5,2 de ancho total) y alto (3,5 m hasta la cúpula); el del
   vídeo es largo y estrecho (largo/ancho ~1,5) y chato. Ahora: orugas
   de 5,6 x 3,85 y 2,6 m de alto.
2. **Torreta**: era una cúpula grande que tapaba el casco desde
   arriba; la del vídeo es baja y pequeña (poco más de la mitad del
   ancho del casco). Ahora es un elipsoide achatado con escotilla
   plana, sin cúpula alta.
3. **Cañón**: era grueso (radio 0,15) con bocacha cilíndrica oscura;
   el del vídeo es fino y largo, con bocacha en forma de bloque
   claro. Ahora: radio 0,11 y bocacha en caja.
4. **Color**: el amarillo vivo del juego es más naranja y saturado
   que el mostaza paja del vídeo; las orugas del vídeo son un oliva
   más oscuro. Ahora: amarillo (0.88, 0.74, 0.30), marrón
   (0.34, 0.29, 0.12).
5. **Detalles que sobraban**: banda rojiza en la torreta, antena,
   faros de marfil, guardabarros amarillos y caja lateral en la
   torreta; en el vídeo no se ven. Se quitaron.
6. **Detalles que faltaban**: tacos rectangulares sobre las orugas
   (visibles desde arriba), ruedas de rodaje claras en el lateral de
   la oruga (antes eran oscuras y se perdían en la banda) y cruceta
   en X sobre la cubierta trasera. Se añadieron.
7. **Glacis**: era una plancha marrón oscura grande; en el vídeo el
   morro es amarillo tostado. Ahora es tostado oscuro, más discreto.

Lo que no se pudo corregir: el vídeo es un montaje con la partida en
una ventana pequeña y muy comprimida, así que los detalles finos del
tanque (textura de la torreta, forma exacta de la escotilla, si lleva
algún detalle pequeño en la cubierta) no se distinguen; el modelo
mantiene formas lisas de juguete de plástico en esos puntos. El
tamaño exacto del tanque en el juego (escala 1 unidad ≈ 1 m) tampoco
se puede medir del vídeo: se mantuvo la escala del modelo anterior.

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
   amarillo paja (0.88, 0.74, 0.30) salía crema pálido en las vistas.
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
4. Medir el rendimiento en el iPhone: el modelo tiene 1.704 tris, pero
   hay que comprobar que cargarlo no añada tirones al arrancar la
   misión (hay hasta 9 tanques en la Misión 3).
