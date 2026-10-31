# Refactor por fases

Base: `1c59125bb925e7727cd265c64f1d2f5a2cb62a05`, etiqueta `v-pre-refactor`.
Rama: `refactor/classic-scripts`. Una fase = un commit. No mezclar cambios de jugabilidad.

## Puertas de validación

Antes de avanzar: `node --test` en verde y prueba rápida en navegador real,
con entrada `file://.../index.html`. Los scripts seguirán siendo clásicos/UMD.
La comprobación de escritorio no sustituye audio ni gestos en un iPhone físico.

## Cinco pasos manuales

1. Abrir `index.html` con doble clic, iniciar y completar una misión: destruir bases,
   rescatar a todos y extraer en H. Comprobar puntuación y Siguiente misión.
2. Pausar con botón y P/Esc; consultar ayuda/ajustes y continuar. Cambiar de pestaña
   y volver: sin movimiento ni disparo atascado, misión conservada.
3. Girar vertical/horizontal mientras se mueve/dispara: controles accesibles,
   entradas liberadas, menú desplazable, sin solapamientos nuevos.
4. Silenciar/activar sonido y cambiar calidad en menú y partida. Recargar y verificar
   preferencias. En iPhone, verificar sonido después de un pointerdown real y después
   de volver de otra aplicación.
5. Perder en misión 2 y reintentar: misma misión, recursos reiniciados y puntuación
   previa a la misión. Cancelar abandonar conserva partida; confirmar vuelve al menú.

## Orden

0. Base etiquetada, rama y esta red de seguridad.
1. Extraer CSS conservando estilos efectivos y responsive.
2. Extraer prefs, audio, input, combat, render2d, ui y game con scripts clásicos.
3. Unificar estado y transiciones.
4. Pruebas directas y aleatoriedad inyectable.
5. Documentación, Issues de iPhone, entrada única y versión centralizada.

La rotura de juguetes queda pendiente para una entrega funcional posterior.

## Evidencia fase 0

- 49 pruebas Node aprobadas.
- Chromium headless real: entrada file://, inicio/disparo, pausa, ayuda, ajustes,
  continuación, vertical/horizontal y salida/cancelación; sin errores JavaScript.
- Los cinco pasos manuales completos en iPhone siguen pendientes.

## Evidencia fase 1

- 49 pruebas Node aprobadas; smoke Chromium file:// aprobado.
- Comparados todos los estilos calculados de menú, ayuda, ajustes y pausa,
  en 390×844 y 844×390: idénticos antes/después (excepto transformaciones animadas,
  excluidas del comparador). Sin cambios de JavaScript.
- GitHub Actions no inició los jobs de la fase 0: cuenta bloqueada por facturación.
  La etiqueta local v-pre-refactor existe; su publicación por el workflow queda
  pendiente de desbloquear Actions. No se ha confundido ese fallo con pruebas rojas.

## Evidencia fase 2

- Scripts clásicos en src/, con APIs CommonJS para pruebas y sin import/export ES.
- 51 pruebas Node aprobadas; smoke Chromium real con entrada file:// aprobado.
- Audio recibe isPlaying/isMuted y conserva desbloqueo síncrono en pointerdown;
  se cachean buffers de ruido. Input expone read()/clear(); render2d recibe scene
  y cachea decoración por misión/recuento de rescates.
- No se realizó prueba física de audio en iPhone; sigue siendo una validación
  de aceptación pendiente, no una equivalencia garantizada por Chromium.

## Evidencia fase 3

- Estado de partida único (incluye st, P, E, BL, EB, MS, FX, PK y mission).
- setState valida la tabla y centraliza audio, limpieza de entrada y presentación.
  La tabla incluye over→play (reintentar), win→play (siguiente) y campaign→play
  (jugar de nuevo), necesarios para conservar las acciones existentes.
- 53 pruebas Node aprobadas; smoke Chromium file:// aprobado.

## Evidencia fase 4

- 44 pruebas Node aprobadas: combate y transiciones directos, ocho integraciones
  con host simulado y generador aleatorio inyectado/reproducible.
- Las pruebas de juego ya no evalúan el HTML; los módulos exportan APIs CommonJS.
- Smoke Chromium real file:// aprobado: jugar/disparar, pausar, menús, ajustes,
  continuar, girar y abandonar; sin errores JavaScript.
