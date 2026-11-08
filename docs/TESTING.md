# Pruebas

## Automatizadas

Desde la raíz, con Node 22:

```sh
node --test
```

No requieren instalar dependencias. Combate, preferencias, entrada, audio,
transiciones, mundo, misiones y renderer tienen pruebas directas; ocho integraciones
usan `support/fake-host.cjs`. Game.create acepta `{random}` para reproducir resultados.

## Navegador real

El smoke de desarrollo requiere Playwright y Chromium disponibles en el entorno
(no son dependencias del juego). Con Playwright resoluble por Node:

```sh
BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-browser.cjs
SMOKE_ENTRY=army-men-ataque-aereo.html BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-browser.cjs
BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-helicopter.cjs
BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-trails.cjs
BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-route.cjs
BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-initial-air.cjs
BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-escort.cjs
```

Abre file://, inicia, dispara, pausa, navega ayuda/ajustes, silencia, continúa,
gira el viewport y vuelve al menú; exige cero errores JavaScript. Si WebGL no está disponible, los smoke comprueban que aparece el mensaje de WebGL requerido, sin respaldo 2D. No sustituye
una partida manual completa ni las restricciones reales de Safari/iOS.

## Cinco pasos manuales por entrega

1. Jugar una misión: destruir bases, rescatar aliados y extraerlos; pasar a la siguiente.
2. Pausar y continuar: el mundo se detiene y el audio no queda sonando en pausa.
3. Girar vertical/horizontal: controles visibles, sin entrada retenida ni saltos de estado.
4. Silenciar/reactivar y probar primer toque y regreso desde segundo plano.
5. Perder y reintentar: misión correcta, HUD reiniciado y preferencias conservadas.

## Pendientes en iPhone físico

- [Audio y segundo plano #13](https://github.com/fabianvs1997/army-men-ataque-aereo/issues/13)
- [Multitáctil y orientación #14](https://github.com/fabianvs1997/army-men-ataque-aereo/issues/14)
- [Campaña, WebGL y Canvas #15](https://github.com/fabianvs1997/army-men-ataque-aereo/issues/15)
- Congelamiento en la escolta a C (misión 2): jugar la escolta B → C y
  anotar el momento exacto, si el sonido sigue, si responde Pausa y si hay
  que cerrar Safari. Con `?perf=1` el HUD muestra FPS, ms por frame, peor
  frame, nivel de rendimiento y fase; esa lectura es el dato que falta para
  reproducir el problema si persiste.

Registrar modelo, iOS y resultados antes de cerrar cada Issue.

## Estado de CI y etiqueta

Durante el refactor, Actions no inició jobs por bloqueo de facturación de la cuenta.
Las pruebas locales sí se ejecutaron. `v-pre-refactor` apunta localmente a
`1c59125bb925e7727cd265c64f1d2f5a2cb62a05`; su publicación remota sigue pendiente.
Tras desbloquear Actions, volver a ejecutar el workflow Preserve pre-refactor baseline
y el de pruebas. El workflow se niega a mover una etiqueta existente a otro commit.

## Congelamiento en la escolta a C

`tests/freeze-escort.test.cjs` y `scripts/bench-escort-freeze.cjs` cubren
la causa encontrada tras el PR #35: el A* del pelotón sin presupuesto.
Las pruebas fijan que un A* con meta lejana no quema el frame, que una
meta dentro de un obstáculo vuelve al instante, que un muro alto tiene
rodeo, que como mucho hay un recálculo por frame aunque se atasquen los
4 soldados, y que el monitor de rendimiento degrada y recupera por
niveles. El bench simula la escolta con un muro de rocas en la ruta
y reporta peor frame, llamadas y coste máximo de `Navigation.path`.
Los picos de peor frame en Node están dominados por calentamiento del
JIT/GC en los primeros frames; el dato fiable es el coste máximo de
ruta (32,3 ms antes → 4,9 ms después) y el coste de arranque
(241 ms antes → 109 ms peor caso después).

## Congelamiento al regresar al punto A (misión 1)

`tests/freeze-regreso-a.test.cjs` y `scripts/bench-regreso-a.cjs` cubren
las dos variantes del reporte: volver a A sin haber recogido a los
heridos, y volver a A con los heridos a bordo sin entregarlos en C. La
causa era la línea de visión enemigo → soldado sin límite de distancia
en `upd()` (`src/game.js`); ahora solo se traza dentro del alcance de
disparo del enemigo. Las pruebas fijan que ningún trace supera 80 u en
el regreso a A (antes hasta 370 u), que la entrega en C sigue
completando la misión y que un tanque persigue al jugador (no a un
soldado fuera de su alcance) pero sigue apuntando a un soldado dentro
de él. El bench reporta por tramo peor frame, traces por frame y
segmento de trace más largo; los picos aislados de peor frame en Node
no se reproducen en el mismo frame ni desaparecen forzando GC (ruido
de GC/JIT), el dato fiable es el coste de trace por frame.

## Rotura de plástico

`BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-sin-escombros.cjs` comprueba
un impacto barrido, cinco tipos de enemigo, ausencia de bolas de fuego y de
restos tras las bajas, y ambos renderers en file://. Captura imágenes en /tmp.
Las pruebas Node cubren daño repetido, misiles, pausa y limpieza de misión. La
optimización de la misión 2 (`tests/perf-mission2.test.cjs`, `scripts/bench-mission2.cjs`)
fija el presupuesto de frame de la escolta: matar enemigos no deja restos ni
degrada el frame. Validación física de rendimiento en iPhone pendiente.

## Cobertura y objetos sólidos

`BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-cover.cjs` usa la regadera
real del mapa: detrás no se recibe daño; al salir se recibe el disparo. Comprueba
movimiento detenido, paso por encima y renderizado WebGL en ambas orientaciones.
Pruebas directas: cajas giradas, elipsoides, proyectiles rápidos, primer contacto,
misiles y cobertura frente a daño de área, deslizamiento, altura, restos, vegetación
oculta, terreno y prevención de atravesar un objeto desde su superficie.

## Inclinación del helicóptero

`BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-pitch.cjs` avanza frames
controlados con entrada de teclado real: nariz abajo durante movimiento, arriba
al soltar y regreso a nivel. Comprueba WebGL y ambas orientaciones, con
capturas en /tmp. Pruebas directas cubren límites, dirección, suavizado entre tasas
de frames, colisión, pausa/reinicio y restablecimiento de uniforms del renderer.

## Cámara cercana

`BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-camera.cjs` verifica
encuadre en vertical, horizontal y cuadrado, posición del helicóptero al 64 %,
controles dentro del viewport y WebGL. Guarda capturas en /tmp.

## Seguimiento de rumbo

`BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-follow.cjs` mantiene cada dirección con teclado real y comprueba rumbo estable, cámara alineada, proyección hacia delante, encuadre y controles en vertical/horizontal/cuadrado, con WebGL. Las pruebas Node también cubren un gesto táctil nuevo sin frame intermedio y pausa/reinicio.

## Controles con cámara de seguimiento

`BROWSER_EXECUTABLE=/ruta/a/chromium node scripts/smoke-controls.cjs` comprueba
W/S sin cambiar rumbo, A/D con giro progresivo, encuadre y controles visibles.
Incluye eventos multitáctiles reales de Chromium vía CDP: avance, retroceso sin
soltar, avance con giro y fuego, levantar solo el dedo de pilotaje conservando
fuego y liberación final. Espera la entrega de cada evento antes de simular frames.
Las pruebas Node cubren zona muerta, teclas opuestas, velocidad diagonal, consistencia
entre 30/120 Hz, cancelación táctil y pausa. Este esquema sustituye el rumbo fijo
por gesto de la primera cámara de seguimiento.

## Aceptación de #27

`escort.test.cjs` cubre estados, bloqueo de B, capacidad, abordaje selectivo, fuego aliado con visibilidad, marcha, atascos, entrega y guardado. `escort-integration.test.cjs` verifica daño real a soldados, combate autónomo, cinco reinicios con listeners y progreso intactos, y navegación entre restos con varias semillas.

`smoke-escort.cjs` ejecuta A→B→C en Chromium desde file://, verifica que llegar antes que la columna no gana, revisa estrellas guardadas y reinicios, y captura WebGL vertical y horizontal. Los enemigos de B y de la emboscada se eliminan mediante el API de combate para aislar el flujo de misión; la marcha del pelotón se simula fotograma a fotograma con colisiones reales.

### Mapas fijos del original

`original-maps.test.cjs` verifica los tres mapas fijos: misma misión da siempre el mismo mapa, las tres misiones tienen mapas distintos (nombre, escenario, semilla, A/B/C, rutas y enemigos), la dificultad crece por misión (117, 162 y 164 HP; 3, 6 y 9 tanques), la validación rechaza mapas manipulados, la escolta completa las tres misiones y el mundo usa la vegetación, los puntos de interés y el relieve de cada mapa; además comprueba que no queda rastro del motor random eliminado (ni `mapgen`, ni botón Mapa nuevo, ni semillas de campaña). `mission-map.test.cjs` verifica que las rutas fijas están conectadas, las bases distantes y la escolta completa sin teletransporte, y que reintentar conserva el mapa, otra misión cambia de mapa fijo y otra partida tiene el mismo mapa. Las pruebas de apariciones consultan el terreno activo de cada partida. `smoke-escort.cjs` también comprueba que reintentar conserva la semilla y que otra misión actualiza tanto el mapa como el buffer WebGL.

### Parecido al original (1/3): brújula, explosiones y tanques Tan

`parecido-original.test.cjs` verifica la brújula (rumbo, tira de 8 puntos y marca del objetivo), el HUD con munición/salud en el juego real, el HUD genérico con una misión ficticia (resumen y marca distintos sin tocar `ui.js`), las explosiones por tipo con humo y daño sin cambiar, la paleta y el tamaño de la explosión en el renderer, el color y la silueta del tanque Tan frente a la torreta, el pecio amarillo del tanque, la presencia del HUD nuevo en HTML/CSS/bootstrap y la escolta llegando a C en las 3 misiones.
`hud-limpio.test.cjs` verifica el HUD limpio: el HTML del HUD ya no trae la insignia de modo de render ni el botón de gráficos, las barras de resumen y objetivo quedan ocultas, el panel de Misión se abre y se cierra con el resumen correcto en las 3 misiones y congela la simulación mientras está abierto, y el cambio de calidad sigue funcionando desde Ajustes.

### Parecido al original (2/3): defensas, winch y reglas de la Misión 1

`defensas-winch-m1.test.cjs` verifica las defensas de la Misión 1 (sacos, valla, tiendas, torre, cajas) como cobertura real, el winch de la caja de plástico (bloqueos, reinicios y portal que cierra), la partida completa en el juego real y el renderer con la caja en el suelo, el cable y la caja colgando.

### Parecido al original (3/3): misiones 2 y 3 fieles al original

`misiones-2-3.test.cjs` verifica los mapas 2 y 3 con sus elementos (circuito y garajes con ruta al portal, vías y tren, plataforma, helicóptero Tan y portal), los coches (salidas escalonadas, ruta por el circuito, contador y fracaso a los 15, garaje destruido que deja de soltar), la batería (caída del helicóptero Tan, winch, entrega en la plataforma, tren que arranca y llega a C), las partidas completas de las misiones 2 y 3 en el juego real (con las fases `GARAJES` y `PORTAL`), la dificultad creciente y el renderer (garaje, coche, tren, vías y batería).

## Registro de errores y Supabase

- `tests/logger.test.cjs`: captura, contexto, rotación a 100 entradas,
  congelamientos con enfriamiento y tolerancia a almacenamiento roto.
- `tests/supabase.test.cjs`: cliente simulado; modo invitado con cola,
  guardado con sesión, lotes de errores y registro/inicio de sesión.
- `tests/supabase-config.test.cjs`: sin inyección, modo invitado; con
  `__SUPABASE_CONFIG__` válida, activo; URL o clave no válidas no lo
  activan y una inyección mal formada no rompe el juego.
- `tests/generate-supabase-config.test.cjs`: el generador escribe la
  configuración desde variables de entorno o `.env`, genera vacío sin
  variables, y falla si falta una variable, si la URL no es de
  Supabase o si la clave parece la secreta. Sin red ni secretos reales.
- `tests/logging-integration.test.cjs`: el juego instala el logger y
  Supabase offline, y los paneles de Cuenta y Registro funcionan sin
  servidor. Sin red: `node --test` no toca Supabase real.

Manual: con la configuración vacía, Menú → Cuenta dice "sin
configurar" y Menú → Registro muestra y exporta errores. Con Supabase
configurado (ver `docs/SUPABASE.md`), crea una cuenta, completa una
misión y comprueba la fila en Table Editor → scores y los errores en
Table Editor → error_logs. En local, genera la configuración con
`cp .env.example .env` y `node scripts/generate-supabase-config.cjs`;
`git status` debe seguir limpio (`.env` y `src/supabase-env.js` están
gitignorados).
