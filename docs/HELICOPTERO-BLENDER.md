# Helicóptero en Blender

Modelo 3D original del helicóptero verde del juego, hecho desde cero en
Blender (no es un modelo del juego original: es una recreación guiada
por cómo se ve el helicóptero en el video del original, PS1 1999).

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
  ventanilla lateral trasera, motores laterales con escapes, insignias
  redondas de marfil con centro verde en el fuselaje y en las alas.
- Cola: botalón cónico con banda amarilla, estabilizador horizontal,
  deriva clara con baliza roja y rotor de cola de 2 palas amarillas.
- Rotor principal de 2 palas con puntas amarillas, sobre mástil con base
  abombada. Las palas cuelgan del vacío `Rotor`, para poder girarlas
  luego en el juego.
- Alas cortas con lanzacohetes (2 filas x 3 cohetes por ala, con punta
  marfil), cañones en el morro y patines de aterrizaje con soportes.
- Colores lineales ajustados al video del original: verde
  (0.05, 0.52, 0.02), verde claro, verde oscuro, cristal oscuro,
  marfil, amarillo, rojo y metal oscuro. Los materiales son Principled
  BSDF con rugosidad de plástico (0.42–0.5).

Medidas: unos 11 m de largo (morro a deriva), 17 m de envergadura del
rotor, 3 m de alto hasta el buje. **4.512 triángulos** (límite: 5.000,
para que corra en un iPhone), 75 objetos.

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
4. Medir el rendimiento en el iPhone: el modelo tiene 4.512 tris, pero
   hay que comprobar que cargarlo no añada tirones al arrancar la misión.
