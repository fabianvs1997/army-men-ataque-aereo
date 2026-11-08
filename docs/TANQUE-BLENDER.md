# Tanque Tan en Blender

Modelo 3D original del tanque enemigo Tan, amarillo/tostado, de juguete
de plástico, hecho desde cero en Blender (no es un modelo del juego
original: es una recreación guiada por cómo se ve el tanque Tan en el
vídeo del original, PS1 1999). Los dos vídeos que compartió Fabian
mandan: el gameplay de Betão Play (61,9 s) y el montaje (125,5 s).
Los dos muestran el MISMO tanque: largo y estrecho, bajo, de
amarillo mostaza vivo con un toque verde, orugas de un oliva muy
oscuro con ruedas claras, torreta GRANDE en cúpula redondeada con
escotilla plana y circular, cañón largo y fino con bocacha
cilíndrica, glacis amarillo, dos faros redondos en la cubierta
delantera y rejilla oscura en la trasera. No es lo que hoy dibuja
el juego en `src/toy-renderer.js` (que es más
ancho que largo y lleva cúpula alta con banda rojiza y antena). No
hay tanque verde del jugador en el juego (el jugador es el
helicóptero), así que solo se modela la variante Tan.

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

- Casco amarillo mostaza con placa frontal inclinada amarilla, dos
  faros redondos en la cubierta delantera, rejilla oscura y plana
  sobre la cubierta trasera, caja de pertrechos trasera amarilla y
  tubo de escape pequeño y oscuro. Sin ganchos negros ni cruceta en
  X: en los vídeos no se ven.
- Orugas de un oliva muy oscuro a cada lado, con 9 tacos
  rectangulares encima de un amarillo oliva oscuro, casi a ras
  (visibles desde arriba, como en el vídeo), 5 ruedas de rodaje
  claras, rueda motriz trasera y tensora delantera amarillas
  visibles en la cara exterior. Sin guardabarros amarillos: en el
  vídeo no se ven.
- Torreta giratoria: cúpula redondeada GRANDE (~57% del ancho del
  casco), anillo oscuro sobre el casco, cañón largo y fino con
  bocacha cilíndrica un poco más ancha y oscura en la punta,
  mantelete cilíndrico pequeño en el morro de la torreta, escotilla
  plana y circular amarilla con un aro fino oscuro alrededor (no un
  disco negro). Sin banda rojiza, sin antena ni periscopio: en los
  vídeos no se ven. La torreta y sus piezas cuelgan del vacío
  `Torreta`, para poder girarla luego en el juego.
- Colores muestreados con herramientas de los fotogramas claros (no
  a ojo): amarillo mostaza (0.85, 0.72, 0.06) — la torreta
  iluminada en el vídeo 1 (~51 s) es sRGB #F4E34B y el costado en
  el vídeo 2 (~66 s) es sRGB #E1D921 —, oliva oscuro de las orugas
  (0.18, 0.16, 0.04), amarillo oliva oscuro (0.45, 0.40, 0.05) y
  metal oscuro. Los materiales son Principled BSDF con rugosidad de
  plástico (0.45–0.5). El amarillo vivo del juego (0.95, 0.76, 0.2)
  es más naranja que el de los vídeos; el paja pálido de la
  revisión 2 (0.88, 0.74, 0.30) salía crema/beige en el render.

Medidas: unos 5,6 m de largo de orugas (7,2 m con el cañón), 3,85 m de
ancho con orugas, 2,4 m de alto hasta la escotilla. **1.680
triángulos** (límite: 3.000, para que corra en un iPhone), 49 objetos.

## Diferencias con los vídeos que se corrigieron (2026-11-07)

Se vieron los fotogramas de LOS DOS vídeos antes de tocar el modelo
(1 cada 3 s, y 1 cada 1 s donde los tanques se ven grandes y claros).
La revisión 2 solo usó el segundo vídeo; esta revisión corrige lo
que la 2 dejó mal. Los dos vídeos muestran el MISMO tanque (el de
Betão Play apenas tiene tanques grandes — su mejor vista es la
lateral de ~50–52 s — y el montaje aporta la cenital de ~63–67 s y
~111 s); no hay conflicto entre ellos, así que el modelo se ajusta
a las vistas más claras de los dos.

Revisión 2 (solo con el segundo vídeo):

1. **Proporciones**: el modelo era casi cuadrado (orugas de 3,7 de
   largo, 5,2 de ancho total) y alto (3,5 m hasta la cúpula); el del
   vídeo es largo y estrecho (largo/ancho ~1,5) y chato. Ahora: orugas
   de 5,6 x 3,85 y 2,4 m de alto.
2. **Torreta**: era una cúpula grande que tapaba el casco desde
   arriba; la revisión 2 la hizo baja y pequeña (poco más de la
   mitad del ancho del casco). Ahora es un elipsoide achatado con escotilla
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

Revisión 3 (con los DOS vídeos; lo que la 2 dejó mal):

1. **Color (el fallo más visible)**: el paja pálido de la revisión
   2 (0.88, 0.74, 0.30) salía crema/beige en el render. Muestreado
   de los fotogramas claros, el tanque es un mostaza vivo con
   toque verde: torreta iluminada en el vídeo 1 (~51 s) sRGB
   #F4E34B, costado en el vídeo 2 (~66 s) sRGB #E1D921. Ahora:
   amarillo (0.85, 0.72, 0.06). Las orugas son un oliva casi
   negro en sombra (vídeo 1, ~51 s, sRGB #2A2803): ahora
   (0.18, 0.16, 0.04), antes (0.34, 0.29, 0.12).
2. **Torreta demasiado pequeña**: la revisión 2 la dejó en 1,7 m
   de ancho (44% del casco); en la cenital del vídeo 2 (~111 s)
   la cúpula ocupa ~57% del ancho del casco (~2,1 m) y es lo que
   más se ve desde arriba. Ahora la cúpula mide 2,1 m de ancho.
3. **Escotilla como agujero negro**: la revisión 2 puso un disco
   oscuro grande sobre la torreta que desde arriba se leía como un
   agujero. En los vídeos (~63 s y ~111 s) es un círculo plano
   amarillo con un aro fino oscuro. Ahora: disco amarillo con aro
   oscuro.
4. **Cruceta en X inventada**: en ningún fotograma claro (vídeo 2,
   ~63 s y ~111 s) se ve una X en la cubierta trasera. Se quitó;
   en su lugar hay una rejilla plana discreta, que sí se ve
   (~63 s), y dos faros redondos en la cubierta delantera.
5. **Cañón demasiado largo y bocacha en bloque**: la revisión 2 lo
   dejaba sobresalir ~3 m (53% del casco) con un bloque pálido.
   En el vídeo 2 (~66 s) sobresale ~1,8 m (~30% del casco) y la
   punta es un cilindro un poco más ancho y oscuro. Ahora: cañón
   radio 0,13, bocacha cilíndrica oscura, punta a 1,8 m del morro.
6. **Glacis y trasera**: la revisión 2 dejó el glacis tostado
   oscuro y la caja trasera marrón, con ganchos negros. En los
   vídeos el morro y la trasera son amarillos (vídeo 1, ~50–51 s).
   Ahora: glacis amarillo más inclinado, caja trasera amarilla,
   sin ganchos.
7. **Altura**: el modelo medía 2,6 m hasta la escotilla; en la
   vista lateral del vídeo 2 (~66 s) la altura total es ~0,4
   veces el largo del casco. Ahora: 2,4 m.
8. **Tacos y ruedas**: los tacos pálidos de la revisión 2 se leían
   como una escalera crema sobre la oruga; en el vídeo son de un
   amarillo oliva oscuro, casi a ras. Las motrices y tensoras
   oscuras se veían como dos círculos negros en los extremos; en
   el vídeo son amarillas como las de rodaje. Ahora: tacos
   (0.45, 0.40, 0.05) a ras, motrices y tensoras amarillas.

Lo que no se pudo corregir: los dos vídeos son montajes con la
partida en una ventana pequeña y muy comprimida, así que los
detalles finos del tanque (textura de la torreta, forma exacta de
la escotilla, si los dos círculos de la cubierta delantera son
faros o escotillas) no se distinguen; el modelo mantiene formas
lisas de juguete de plástico en esos puntos. El tamaño exacto del
tanque en el juego (escala 1 unidad ≈ 1 m) tampoco se puede medir
del vídeo: se mantuvo la escala del modelo anterior.

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
4. Medir el rendimiento en el iPhone: el modelo tiene 1.680 tris, pero
   hay que comprobar que cargarlo no añada tirones al arrancar la
   misión (hay hasta 9 tanques en la Misión 3).
