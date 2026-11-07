# Sonido: rotor, disparos y música épica de guerra

Todo el sonido del juego es **original y sintetizado con Web Audio API** en
`src/audio.js`. No hay archivos de audio en el repo y no se usa nada del
video de referencia de Fabian (gameplay del Army Men: Air Attack original
de PS1, material con derechos): ese video solo sirvió para medir el
ambiente —energía continua que crece, graves dominantes en torno a
88–112 Hz y un pulso grave de ~11 Hz, el chop del rotor— y componer algo
en ese espíritu.

## Rotor del helicóptero (`humOn` / `humOff` / `rotorSet`)

- Dos osciladores de sierra a 55 y 110 Hz por un filtro pasa-bajos (~420 Hz).
- El chop: un LFO senoidal de 11 Hz modula la ganancia (0,045), el mismo
  pulso grave del original.
- Viento: ruido blanco en bucle por un pasa-banda de 300 Hz, muy bajo (0,02).
- `rotorSet(velocidad 0–1, altitud 0–1)`, llamado en cada frame desde
  `upd()` en `src/game.js`, sube el chop a ~15 Hz y el volumen de 0,06 a
  0,11 con la velocidad. No recrea nodos, solo ajusta parámetros.

## Disparos y efectos (`sfx`)

| Sonido | Capas |
|---|---|
| `shot()` (ametralladora) | Ruido 0,07 s a 0,30 (chasquido) + cuadrada 1400→350 Hz a 0,10 + triángulo 160→60 Hz a 0,15 (cuerpo). Tres capas cortas para que la ráfaga (un tiro cada 0,09 s) no se embarre. |
| `miss()` (misil) | Ruido 0,5 s + sierra 300→900 Hz (subida) + seno 120→45 Hz (ignición). |
| `boom()` | Ruido 0,5 s a 0,80 + sierra 160→40 Hz. |
| `snap()`, `hurt()`, `pick()`, `over()` | Sin cambios. |

## Música de fondo (`musicOn` / `musicOff` / `musicScore`)

Marcha marcial original en **re menor, 92 BPM, 8 compases, bucle exacto
de ~20,9 s**: Dm – Dm – Bb – Bb – F – F – C – C.

- Tambor grave (seno 130→42 Hz) en los tiempos 1 y 3; redoble de ruido
  (pasa-banda 1800 Hz) en 2 y 4.
- Bordón grave (tónica + quinta) todo el compás; acordes de metal
  (sierra por pasa-bajos de 1100 Hz) en los tiempos 1 y 3.
- Llamada de trompa en los compases 5–8 (la, do, re, do, la, fa).
- `musicScore()` es una función pura y determinista: devuelve todos los
  eventos del bucle con su instante en segundos. El programador agenda
  compás a compás con 0,6 s de antelación (`setInterval` de 200 ms), así
  el bucle no tiene huecos ni cortes audibles.
- Mezcla: bus de música a 0,12 (nivel 1 en misión, 0,45 en menú), por
  debajo de los efectos.

## Arranque y silencio

- **iOS / autoplay:** el audio solo arranca tras un toque del usuario.
  `musicOn()` no hace nada sin `AudioContext`, y el contexto se crea en
  `audio()`, llamado desde los gestos (botones del menú y HUD, canvas).
  La música suena en misión (nivel 1) y en menú (nivel 0,45), siempre
  después del primer toque. Si el navegador bloquea el audio, no hay
  errores: los SFX comprueban `isMuted()`, `isPlaying()` y `document.hidden`.
- **Silenciar:** el botón «Silenciar» del HUD y del menú pone
  `state.muted`; `syncAudio()` en `src/game.js` llama a `suspend()`, que
  para el rotor, la música y el contexto. La preferencia se guarda como
  antes (`muted` en preferencias).

## Pruebas

`tests/audio-epico.test.cjs` (6 tests, con un mock de `AudioContext` que
registra osciladores, ganancias e intervalos): partitura determinista que
cierra el bucle, programador que arranca y para, música que no arranca
sin contexto ni silenciada, rotor con chop de 11 Hz, disparo de tres
capas, y mezcla por debajo de los efectos.
