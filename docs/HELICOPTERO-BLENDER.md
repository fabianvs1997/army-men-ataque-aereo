# Helicóptero en Blender

Modelo 3D original del helicóptero verde del juego, hecho desde cero en
Blender (no es un modelo del juego original: es una recreación guiada
por cómo se ve el helicóptero en los videos del original, PS1 1999).

## Revisión 3: ajuste a LOS DOS videos del original (2026-11-07)

La revisión 2 solo usó el segundo video (el montaje de 125,5 s) y ese
fue el error: Fabian dijo que el modelo no se veía igual que en los
dos primeros videos. Esta vez se vieron los dos antes de tocar código:
el video 1 (Betão Play Oficial, 61,9 s, gameplay; 21 fotogramas 1/3 s
+ denso 1 fps en 10-20 s y 42-60 s) y el video 2 (montaje, 125,5 s;
42 fotogramas). Los dos muestran el mismo helicóptero verde, así que
se ajusta a los dos: el video 1 manda en proporciones (se ve más
grande y claro, sobre todo ~12 s en vista cenital y ~3 s por detrás)
y el video 2 en el frontal (portada del juego, ~57 s) y el lateral
(gameplay ~57 s, cabina de lado con patines).

Diferencias corregidas (rev. 2 -> rev. 3):

- **Cabina corta y cuadrada**: el fuselaje pasa de 7,4 m a 5,2 m de
  largo (2,7 de ancho, 2,3 de alto). En el video 1 ~12 s la cabina
  mide ~2,2 veces su alto y el botalón ~lo mismo que la cabina; el
  elipsoide largo de la rev. 2 no se parecía.
- **Botalón largo y fino**: de 3,6 m a 5,7 m (radio 0,26 -> 0,12),
  hasta la deriva en y=-7,5. En el video el botalón es tan largo como
  la cabina; antes era la mitad de corto.
- **Rotor más corto y palas más anchas**: envergadura 17 m -> 14,8 m
  (en el video el disco mide ~1,3-1,5 veces la cabina, no 2,3) y
  cuerda 0,32 -> 0,50, con puntas amarillas del 15 %; el mástil baja
  (buje a z=2,1) y se mueve a y=-1,2, sobre la cabina. Las palas
  quedan en diagonal (45°) en reposo: en la vista lateral una pala
  apuntando a la cámara se veía como una paleta flotante.
- **Parabrisas como banda, no como óvalo**: banda ancha y baja
  (0,72 x 0,30, arriba en el frontal) que de frente se lee como la
  banda oscura de la portada del video 2 con el morro verde debajo,
  y desde arriba apenas asoma una pestaña fina en la punta del
  morro. En la rev. 2 el parabrisas se veía como un óvalo negro
  enorme en mitad del morro (frontal) y un "bigote" negro en la
  cenital.
- **Sin insignias blancas**: en ninguno de los dos videos se ve un
  círculo blanco/marfil en el fuselaje ni en las alas (la cabina es
  verde lisa); se quitan las 8 insignias. El juego hoy sí dibuja
  una insignia en el ala (`src/toy-helicopter.js`), pero los videos
  mandan para el modelo.
- **Estabilizador con puntas amarillas**: verde en el centro y
  amarillo en los extremos (`EstabPunta_Izq/Der`), como se ve claro
  en el video 1 ~12 s.
- **Sin rojo en el modelo**: se quitan la baliza roja con su mástil,
  las luces rojas de las puntas del estabilizador y el tapón rojo
  del buje (en la cenital se veía un punto rojo en el centro del
  rotor que no existe en los videos). La barra roja vertical que se
  ve en el video 1 ~3 s y ~15 s sobre el eje del helicóptero son
  trazadoras disparadas por los cañones del morro, no parte del
  helicóptero: en el mismo fotograma hay varias estelas iguales
  sueltas por el camino.
- **Motores pegados al fuselaje**: antes eran dos bultos enormes que
  dominaban la vista trasera y lateral; en el video los lados de la
  cabina son casi lisos. Ahora van donde la cabina es ancha y
  apenas asoman.
- **Patines metidos bajo la panza**: x ±1,35 -> ±0,95 y más cortos;
  desde arriba no se veían en el video y sus extremos asomaban por
  los lados del morro en la cenital. De lado se ven finos y oscuros
  bajo la panza (video 2 ~57 s).
- **Puntas de los cohetes verdes, no marfil**, y cohetes más finos
  (radio 0,19): en los videos no hay nada blanco en el helicóptero
  y en la vista lateral se veían como un bloque enorme bajo el ala.
- **Verde ajustado al muestreo** de los fotogramas claros del
  video 1 (mediana sRGB ~52, 193, 51 al sol): `VerdePlastico` pasa
  a (0.04, 0.52, 0.04) lineal (antes 0.05, 0.52, 0.02).
- **Cámaras de las vistas alejadas** (~25 %): con el objetivo de
  50 mm las puntas del rotor quedaban cortadas en la cenital, la
  frontal y la lateral.

No corregido: el rotor girando en el video se ve como un disco
borroso translúcido con las puntas amarillas en arco; el modelo
estático lleva 2 palas, que es lo correcto para un modelo (el juego
las gira). El winch con su cable y la caja verde son lógica del
juego, no parte del modelo. No se ven marcas, números ni matrículas
en el helicóptero de los videos, así que no se añade ninguna.

**3.540 triángulos** (límite: 5.000), 60 objetos, 5 materiales.
`VERSION` pasa a `helicoptero-blender-3`.

## Revisión 2: ajuste al video del original (2026-11-07)

Se vieron los 42 fotogramas del video (1 cada 3 s, 125,5 s) antes de
tocar código. El video es un montaje (portada arriba, partida abajo);
el helicóptero se ve sobre todo en vista cenital/3-4 jugando, y de
frente en la portada. Diferencias corregidas:

- **Puntas del rotor amarillas**: en el video el rotor girando se ve
  con las puntas amarillas/doradas en todos los planos cenitales. Antes
  eran dos franjas finas marfil; ahora es una banda amarilla ancha
  (`RotorPunta_Izq/Der`, material `Amarillo`).
- **Parabrisas único en el frontal**: en la portada el parabrisas es
  una sola banda ancha oscura sobre el morro redondeado verde. Antes
  eran dos burbujas oscuras que desde arriba y de frente se veían como
  dos ojos; ahora el cristal delantero queda en la cara frontal y la
  cabina trasera es una ventanilla lateral baja, así que desde arriba
  el techo se ve verde liso, como en el juego.
- **Verde más saturado**: el verde del juego (0.17, 0.53, 0.035) salía
  pálido y amarillento en el render; el del video muestreado al sol es
  sRGB ~35, 180, 45. Ahora `VerdePlastico` es (0.05, 0.52, 0.02) y las
  vistas usan `view_transform = "Standard"` (con AgX los colores se
  apagaban; misma trampa que en el tanque).
- **Amarillo en la cola**: banda amarilla (`BandaCola`) en el botalón
  junto a la deriva y palas del rotor de cola amarillas, como las
  franjas que se ven en la cola en el video.
- **Motores más esbeltos** y sin franja en el lomo (techo verde liso).
- **Cámaras de las vistas alejadas** para que el rotor entero (17 m,
  con las puntas amarillas) quepa en el encuadre; antes las puntas
  quedaban cortadas.

No corregido: las insignias redondas de marfil no se distinguen en el
video (demasiado pequeñas a distancia de juego) y se mantienen porque
son del helicóptero que hoy dibuja el juego, sin contradicción con el
video. El winch con su cable y la caja verde son lógica del juego, no
parte del modelo. No se ven marcas, números ni matrículas en el
helicóptero del video, así que no se añade ninguna.

**4.512 triángulos** (límite: 5.000), 75 objetos, 8 materiales.
`VERSION` pasa a `helicoptero-blender-2`.

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

- Fuselaje verde alargado con parabrisas oscuro único en el frontal y
  ventanilla lateral trasera, motores laterales con escapes, cola con
  botalón cónico largo y fino, estabilizador con puntas amarillas,
  deriva verde y rotor de cola de 2 palas amarillas.
- Rotor principal de 2 palas con puntas amarillas, sobre mástil con base
  abombada. Las palas cuelgan del vacío `Rotor`, para poder girarlas
  luego en el juego.
- Alas cortas con lanzacohetes (2 filas x 3 cohetes por ala, con punta
  verde), cañones en el morro y patines de aterrizaje con soportes.
- Colores lineales ajustados a los videos del original: verde
  (0.04, 0.52, 0.04), verde claro, cristal oscuro, amarillo y metal
  oscuro. Los materiales son Principled BSDF con rugosidad de
  plástico (0.42–0.5).

Medidas: unos 11 m de largo (morro a deriva), 14,8 m de envergadura
del rotor, 3 m de alto hasta el buje. **3.540 triángulos** (límite:
5.000, para que corra en un iPhone), 60 objetos.

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
4. Medir el rendimiento en el iPhone: el modelo tiene 3.540 tris, pero
   hay que comprobar que cargarlo no añada tirones al arrancar la misión.
