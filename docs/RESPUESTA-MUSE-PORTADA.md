# Respuesta de Muse (Rayo) — Portada diorama 3D (Issue #70)

Primera entrega del encargo de Codex: diorama 3D de portada fiel al
original, con materiales y luz mejorados. Codex dirige y revisa;
Rayo implementa; Fabian valida en PC. **Este PR no se fusiona ni se
despliega**: queda abierto para revisión.

## Confirmación para el Issue #70

> Confirmo que empiezo la primera entrega del encargo: rama
> `muse/portada-diorama-v1` desde Master `c6c0487` (merge de #68,
> verificada el 2026-11-10; se re-comprueba el head antes de crear
> la rama). Herramientas en este entorno: Node v24.22.1 con
> `node --test` completo. Impedimentos concretos: no hay `blender`
> ni `godot` en PATH aquí, y como subagente no puedo operar un
> navegador real, así que las capturas WebGL a 1440×1080 y
> 1920×1080 quedan para el agente principal / Fabian en PC (entrego
> diagramas headless de composición etiquetados como tal). Empiezo
> por la composición del diorama y la cámara, y después materiales
> y luz. No toco los prototipos #65/#66/#67 ni los datos del juego
> instalado.

## Qué cambió

- **Escena de menú separada del mundo de campaña**
  (`src/menu-diorama.js`, nuevo, UMD/`file://`): 218 piezas
  deterministas — 3 troncos grandes (cilindro de corteza, raíz en
  cono, superficie de corte clara, 4 esferas de copa), 2 torres de
  madera estrechas con riostras horizontales y diagonales en planta
  (la de pantalla izquierda lleva un soldado de guardia), tienda
  militar verde con puerta oscura y faldones a la derecha, caja
  amarilla verdosa con centro hundido y nervaduras inclinada a la
  izquierda junto al tronco, 2 tanques verdes de juguete pequeños
  en primer plano (casco redondeado, orugas con 4 ruedas por lado,
  torreta, escotilla, cañón fino, costura de molde sobre el casco;
  mismo diseño dos veces, no vehículos reales), 46 hierbas-lanza,
  16 matas, 12 tréboles, 5 flores, 14 piedrecitas y 8 musgos.
  Colores de plástico con reflejos contenidos (gloss 0,7–1,0);
  tierra con gloss −1 para el vetado del shader. Sin colisiones,
  mapas, enemigos ni objetivos: la campaña no usa esta escena.
- **Cámara de juguete a ras de suelo** (`cameraFor(W, H)` en el
  mismo módulo): pitch 0,2 rad (~11,5°, no el picado de campaña),
  escala `min(W/72, H/50)` en horizontal — misma escala a 1440×1080
  (20,0) y 1920×1080 (21,6, limitada por la altura: no estira) —
  y encuadre estrecho `min(W/52, H/70)` en vertical para móvil.
  `TARGET_U = 8` baja el diorama para que los tanques queden bajo
  la placa, como en la foto. Ojo de composición: en el shader
  `r = -x` con yaw 0, así que las x del mundo salen espejadas en
  pantalla; las posiciones ya van corregidas para que la tienda
  salga a la derecha y la caja a la izquierda como el original.
- **Renderizador reutilizado, ampliación mínima**
  (`src/toy-renderer.js`): geometrías nuevas `cylinder` y `cone`
  (radio 0,5, altura 1, segmentación 14, con tapas) y método
  `renderDiorama(scene)` que reutiliza el mismo programa, la misma
  luz y `part()`. Pone un cielo azul cálido y restaura el color de
  campaña (0,27/0,36/0,23) y `groundOffset` al salir, para no
  afectar a la campaña. Vaivén ambiental de ±0,05 rad solo en
  hierba, hojas, copas y soldado; con movimiento reducido
  (`prefers-reduced-motion`, leído en `src/draw3d.js`) o degradado
  2 se congela el vaivén y se omiten las 3 nubes decorativas.
- **Dibujo** (`src/draw3d.js`): si `st === 'menu'` y hay diorama,
  llama a `renderDiorama`; en cualquier otro estado sigue el
  render de campaña de siempre. Sin WebGL sigue el mensaje de
  WebGL requerido (sin fallback 2D).
- **Interfaz real HTML/CSS sobre el 3D** (`index.html`,
  `src/ui.js`, `styles.css`): la placa verde conserva título y
  tornillos, y ahora ofrece cuatro opciones principales —
  **JUGAR** (`#go`, abre la campaña como antes), **Cargar partida**
  (`#menuLoad`, deshabilitado: no existe guardado de campaña real;
  nota visible «no hay guardado de campaña en esta versión» y
  `title` explicativo), **Opciones** (`#menuSettings`, abre
  Ajustes y permite volver con Volver/Esc), **Salir** (`#menuQuit`,
  muestra una pantalla que explica que el navegador no puede
  cerrar la pestaña y que Volver/Esc regresa a la portada; en una
  futura versión nativa sí cerrará el juego)—. Debajo se conserva
  la navegación secundaria: Volar en Alpina 1, Cómo jugar, Cuenta,
  Registro y Acerca del juego; y Volver / Volver al menú principal
  en resultados. Teclado, mouse y táctil; foco visible; Esc vuelve
  o pausa según estado con el comportamiento existente de
  `src/input.js` (sin cambios, sin teclas atascadas nuevas).
- **`VERSION`** (`src/bootstrap.js`): `menu-hd-animado-1` →
  `portada-diorama-1` (una sola vez, según README), con los 6 tests
  que la fijaban actualizados.
- **Diagramas headless** (`scripts/portada-diagrama.cjs` +
  `docs/referencias/portada-diagrama-1440x1080.svg` y
  `…-1920x1080.svg`): proyección matemática de las 218 piezas con
  las fórmulas del vertex shader y la cámara de `cameraFor`.
  **No son capturas WebGL**; sirven para comparar la composición y
  el encuadre a ambos tamaños antes de capturar en PC.

## Archivos tocados

- Nuevos: `src/menu-diorama.js`, `tests/portada-diorama.test.cjs`,
  `scripts/portada-diagrama.cjs`,
  `docs/referencias/portada-diagrama-1440x1080.svg`,
  `docs/referencias/portada-diagrama-1920x1080.svg`,
  `docs/RESPUESTA-MUSE-PORTADA.md` (este archivo).
- Modificados: `src/toy-renderer.js` (geometrías + `renderDiorama`),
  `src/draw3d.js` (rama de menú), `src/game.js` (dependencia,
  diorama en el estado, cámara en `rs()`), `src/bootstrap.js`
  (`VERSION` + script), `src/ui.js` (`JUGAR`, `menuQuit`, toggles
  de nav secundaria/nota), `index.html` (menú principal),
  `styles.css` (estilos de portada), `CHANGELOG.md`,
  `tests/menu-hd.test.cjs` y los 6 tests de `VERSION`
  (`integracion-modelos`, `logging-integration`, `mision1-video`,
  `modelos-visibles`, `original-maps`, `parecido-original`).

## Comandos y resultados

- `node --test` completo: **357 pasan, 0 fallan, 4 saltados**
  (base tras #68: 350/0/4; +7 tests nuevos de portada). Los 6
  tests de `VERSION` y `tests/menu-hd.test.cjs` se adaptaron a los
  textos nuevos (JUGAR, ids nuevos) sin quitar cobertura.
- `node scripts/portada-diagrama.cjs 1440x1080` y `… 1920x1080`:
  generan los dos SVG (218 piezas, t=1,2); XML validado.
- Verificación numérica de encuadre (proyección de puntos clave):
  a 1440×1080 los tanques caen en (460, 859) y (980, 847) — esquinas
  inferiores, fuera del ancho de la placa (480–960) —, la copa del
  tronco central en (840, 95) — sobre la placa —, tienda en
  (1240, 860) y caja en (320, 896). A 1920×1080 posiciones
  equivalentes sin estirar.
- `node --check` en los JS tocados: sin errores de sintaxis.

## Capturas y rendimiento

- **Capturas WebGL antes/después a 1440×1080 y 1920×1080:
  pendientes.** Este subagente no puede operar un navegador real;
  los SVG de `docs/referencias/` son diagramas headless de
  composición, no capturas, y no se presentan como tales. El agente
  principal o Fabian deben capturar en PC (servir estático o
  `file://`) con el mismo encuadre: menú principal con la placa
  centrada, antes (#68, mundo de campaña orbitando) y después
  (este diorama).
- **FPS: no medido** (sin navegador real en este entorno). El
  diorama son ~221 llamadas de dibujo por frame (218 piezas + 3
  nubes) con las mismas geometrías simples del juego, sin assets
  binarios ni reconstrucción por frame: debería ser ligero, pero
  el número real lo da la medición en PC/iPhone (hay `?perf=1` en
  el HUD para verlo).

## Procedencia de assets

- Todo procedural en código: colores y formas propias del repo.
  La PNG v2 (`docs/referencias/portada-v2.png`, PR #69, 1448×1086)
  es **referencia de concepto generada**, no interfaz con botones
  pintados y no se duplica en esta rama. Ningún dato del juego
  original (PAK, MBL, TIM, DLL, EXE, audio, vídeo, rutas
  personales) entra en el repo. La nota sobre `SHELL.MBL` AMDL
  (componente 28 ≈ tienda, caras/UV/jerarquía/materiales
  pendientes) sigue siendo **hipótesis**: ninguna pieza de este
  diorama es una malla extraída ni se presenta como tal. El tanque
  Tan de Blender del repo es una recreación del tanque enemigo,
  no el tanque verde de la portada: aquí se modela aparte.

## Pendientes para Codex / Fabian (PC)

1. Capturas WebGL antes/después a 1440×1080 y 1920×1080 y
   comparación de siluetas con las capturas originales (troncos,
   torres, tienda, caja, tanques) — es la revisión de fidelidad
   que Codex debe hacer; si las proporciones originales mandan
   sobre este primer reparto, se ajustan posiciones/alturas.
2. Probar en PC: JUGAR entra a campaña y Volver/regresar al menú
   sin teclas atascadas; Opciones abre Ajustes y vuelve; Cargar
   partida se ve deshabilitado con su explicación; Salir muestra
   la explicación y Volver/Esc regresa; pausa con Esc/P y
   reanudar; foco visible navegando con teclado; sin errores
   nuevos en consola; repetir entrada/salida sin fugas evidentes.
3. Medir FPS del menú en PC y en iPhone (con `?perf=1`) y validar
   la adaptación móvil en vertical y en paisaje bajo.
4. Segunda entrega (tras revisión): materiales y geometría que de
   verdad mejoren el parecido (corteza con vetas, hojas con nervio,
   sombras de contacto, detalles de los tanques), sin introducir
   otro motor. El contrato de pilotaje con mouse para PC
   (girar con mouse, W/S, A/D, clic izquierdo/derecho, rueda) es
   para entregas posteriores, no para este PR.
5. Textos en español: se conservan los existentes; falta el doblaje
   de voces (este PR es solo visual, no lo presenta como doblaje).
