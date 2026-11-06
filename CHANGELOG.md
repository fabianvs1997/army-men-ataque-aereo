# Changelog

## Sin publicar — Supabase con variables de entorno (sin hardcodear)

- La URL y la clave ANON de Supabase ya no se pegan en ningún archivo del repositorio. `src/supabase-config.js` ya no contiene valores: lee la configuración inyectada en `globalThis.__SUPABASE_CONFIG__` y, sin ella, el juego va como invitado sin servidor, como hasta ahora.
- `scripts/generate-supabase-config.cjs` genera `src/supabase-env.js` (gitignorado, nunca en el repo) a partir de variables de entorno o de un `.env` local. Sin variables genera una configuración vacía (modo invitado); con una sola variable, con una URL que no sea `https://<proyecto>.supabase.co` o con una clave que parezca la secreta (`service_role`, `sb_secret_`, `sk-`), falla en vez de publicar algo roto. La clave nunca se imprime en la salida.
- `.github/workflows/deploy-pages.yml` (nuevo): al hacer push a `Master` corre los tests, genera la configuración desde los secretos de GitHub `SUPABASE_URL` y `SUPABASE_ANON_KEY` y publica en GitHub Pages. Para activarlo hay un paso manual único: Settings → Pages → Build and deployment → Source → GitHub Actions. Hasta ese cambio, Pages sigue publicando directo desde la rama sin configuración (modo invitado) y el juego no se rompe: `src/bootstrap.js` carga `supabase-env` como script opcional y tolera que no exista.
- `.env.example` con los nombres de las variables (sin valores reales) y `.gitignore` para `.env` y `src/supabase-env.js`.
- `docs/SUPABASE.md` reescrito con el flujo nuevo: secretos en GitHub, cambio de despliegue a Actions, prueba en local con `.env`, desactivación y solución de problemas. Sin cambios de jugabilidad.
- Pruebas nuevas en `tests/supabase-config.test.cjs` (inyección válida/inválida, lectura en el momento de uso) y `tests/generate-supabase-config.test.cjs` (variables, `.env`, casos de fallo). `VERSION` pasa a `supabase-env-1`.

## Sin publicar — registro de errores y Supabase (cuentas y puntuaciones)

- Registro de errores en el dispositivo (`src/logger.js`, `ToyLogger`): captura `console.error`, errores no controlados, rechazos de promesas y frames de más de 500 ms (como mucho un aviso cada 5 s), con versión, misión, fase, semilla, FPS/ms, nivel de degradado y dispositivo. Sin datos personales. Últimas 100 entradas en localStorage con rotación; si el almacenamiento falla, sigue en memoria y nunca rompe el juego. Se ve en Menú → Registro, se exporta como `army-men-logs.json` y el contador aparece en el HUD con `?logs=1`.
- Supabase opcional (`src/supabase.js`, `src/supabase-config.js`, `supabase/schema.sql`, `docs/SUPABASE.md`): cuentas por correo y contraseña con Supabase Auth, puntuaciones en línea y envío remoto de errores. Sin configuración (URL y clave ANON vacías) el juego sigue 100 % offline como invitado. La librería oficial se carga solo cuando hay configuración, desde el CDN; si no carga, no se rompe nada. Las contraseñas nunca se guardan en el juego y la clave secreta (service_role) no se usa nunca.
- Menú → Cuenta: crear cuenta, iniciar y cerrar sesión, ver las puntuaciones propias y el top 5 del ranking. Al completar una misión, la puntuación (puntos de campaña, estrellas y supervivientes) se guarda en `scores` si hay sesión; como invitado o sin red queda en cola local (máximo 20) y se envía al iniciar sesión. Los errores se envían en lotes a `error_logs` al completar una misión o al iniciar sesión.
- Esquema SQL con RLS: `profiles`, `scores` y `error_logs`, con políticas para que cada usuario inserte solo lo suyo, ranking de lectura pública y perfil automático al registrarse. Los pasos para Fabian (crear el proyecto, pegar el SQL, copiar URL y clave ANON) están en `docs/SUPABASE.md`; sin ese paso el servidor no está conectado.
- Sin cambios de jugabilidad: daño, velocidad, alcance, cadencia, misiones y controles intactos.
- Pruebas nuevas en `tests/logger.test.cjs`, `tests/supabase.test.cjs` (cliente simulado, sin red) y `tests/logging-integration.test.cjs` (el juego instala el logger y Supabase offline, y los paneles funcionan sin servidor).

## Sin publicar — congelamiento en la escolta a C (misión 2, segunda parte)

- Qué se comprobó del PR #35: la optimización de escombros funciona (la simulación con el campo saturado sigue en ~1,3 ms/frame en Node), pero el congelamiento persistía durante la escolta B → C. La causa siguiente era el A* del pelotón (`src/escort-navigation.js`): lista abierta lineal (mínimo en O(n) por expansión) y sin ningún presupuesto; una meta lejana o inalcanzable quemaba ~70 ms por llamada en Node (B → C completa: 70 ms sin encontrar ruta), y hasta 4 soldados atascados podían dispararla en el mismo frame. En iPhone eso son varios cientos de ms de bloqueo por frame.
- El A* ahora usa un montón binario, sanea inicio y meta al punto libre más cercano (null inmediato si no hay), recorta la meta lejana a un objetivo intermedio a 64 u, y tiene presupuestos duros: como mucho 1200 expansiones o 12 ms por llamada, con paso de rejilla de 2 u. Si no encuentra ruta, devuelve null y el soldado espera en vez de agotar el frame. B → C: 70 → 9 ms; peor llamada en el escenario con muro: 32,3 → 4,9 ms; y el rodeo alrededor de un muro sigue encontrándose.
- Como mucho un recálculo de ruta por frame en toda la escolta (antes uno por soldado), y si falla el enfriamiento es de 6 s en vez de 3 s.
- Arrancar la misión 2 también se abarató: `trailDistance` poda los segmentos por caja envolvente (resultado idéntico, diff 1e-13) y `mesh()` escribe en un `Float32Array` prealocado (malla idéntica, diff 0). Peor caso medido: 241 → 109 ms en Node; la mayoría de semillas quedan en 30–48 ms.
- Válvula de seguridad (`src/perf.js`, `ToyPerf`): monitor de la EMA del tiempo real por frame; si los frames se alargan, degrada en 3 niveles — tope de DPR 1,75 → 1,25 → 1, dibujo a 30 fps y mitad de escombros/humo en el nivel 2 — y recupera un nivel tras 600 frames rápidos. No cambia la jugabilidad: solo resolución y cantidad de decoración dibujada.
- HUD opcional de rendimiento con `?perf=1`: FPS, ms por frame, peor frame, nivel y fase de la misión, para diagnosticar en el iPhone si el congelamiento persiste.
- Menos asignaciones en los bucles calientes: los centros de enemigos y puntos de puntería de soldados se calculan una vez por frame/paso en vez de por bala × enemigo.
- Sin cambios de jugabilidad: daño, velocidad, alcance, cadencia, misiones y controles intactos.
- Pruebas nuevas en `tests/freeze-escort.test.cjs` (8 pruebas: distancia al sendero, coste de arranque, presupuestos del A*, rodeo de muro, un recálculo por frame, monitor de rendimiento, dibujo en nivel 2) y `scripts/bench-escort-freeze.cjs` para reproducir la medición con un muro de escombros en la ruta.

## Sin publicar — optimización de la misión 2 (congelamiento)

- Causa: en la fase de escolta B → C, cada trazado de colisión recorría los 320 escombros del campo (un `segment()` con trigonometría por pieza) y la partida hacía ~80 trazados y ~22 movimientos por frame. Con el campo saturado, la simulación pasaba de 2,1 a 8,2 ms/frame en Node; en iPhone eso se convierte en tirones y congelamiento.
- Los escombros asentados (la gran mayoría) ahora van a un índice espacial por celdas, como los sólidos; solo las piezas aún en el aire se revisan directas. El campo saturado vuelve a costar lo mismo que el vacío: 1,3 ms/frame en Node (6× menos que antes).
- Los restos siguen siendo cobertura sólida: un muro de escombros sigue parando balas y movimiento, y los soldados siguen pisando los fragmentos bajos. Solo cambia cómo se buscan, no qué bloquean.
- WebGL: las piezas consecutivas del mismo tipo reutilizan el buffer ya enlazado (de 948 a 97 llamadas `bindBuffer` y de 3792 a 388 configuraciones de atributos por frame en la escena de referencia) y las carreteras fuera de pantalla ya no se dibujan (de 948 a 881 dibujos por frame). Sin cambios visuales.
- La lista de soldados activos se calcula una vez por frame/paso en vez de reconstruirla por cada enemigo y cada bala enemiga; `damageSoldier` usa pertenencia O(1).
- Sin cambios de jugabilidad: daño, velocidad, alcance, cadencia, misiones y controles intactos.
- Supabase evaluado y descartado para este problema: el congelamiento es CPU del cliente (colisiones y dibujo por frame), no red ni servidor; el juego es estático y sin assets pesados. Un backend no arregla el bucle de juego. Ver el PR para el detalle.
- Pruebas nuevas en `tests/perf-mission2.test.cjs` (presupuesto de frame con campo saturado, cobertura de escombros, pertenencia de soldados, caché de mallas WebGL) y `scripts/bench-mission2.cjs` para reproducir la medición.

## Sin publicar — balas por tipo de arma

- Cada disparo lleva su origen explícito (`b.kind`: `soldier` | `heli` | `tank`) y la trazadora es proporcional al arma: soldados con destello muy fino y corto en amarillo pálido, helicópteros con la trazadora media del afinado anterior, tanques con trazadora claramente más gruesa y larga, con halo naranja/rojo mayor y punta más visible.
- Las torretas (`tur`) se dibujan como tanque: son cañones pesados fijos. Las bases no disparan.
- El estilo de destello con gradiente y cola que se desvanece se mantiene en WebGL y Canvas 2D, así que ni las de tanque vuelven a parecer barras sólidas.
- Sin cambios de jugabilidad: daño, velocidad, alcance, cadencia y colisiones intactos.
- Pruebas de clasificación por tipo, etiquetado en misión real y dibujo por tipo en ambos renderizadores.

## Sin publicar — trazadoras y humo de misiles

- Balas propias y enemigas como trazadoras en ambos renderizadores: halo naranja/rojo con núcleo blanco-amarillo caliente, alargadas en la dirección del disparo.
- Misiles con cuerpo oscuro, punta roja y llama naranja parpadeante en la parte trasera, más estela de bocanadas blancas que crecen y se desvanecen; al impactar queda una bocanada de humo oscuro.
- El humo vive en `state.SM`, separado de las explosiones (`FX`): no cambia daño, velocidad, alcance ni cadencia, y los misiles siguen sin generar bolas de fuego.
- Pruebas de estela, impacto, envejecimiento del humo y dibujo en WebGL.
- Afinado de las trazadoras: la mitad de gruesas, con punta brillante y cola en gradiente (aditiva en Canvas 2D; oscurecida hacia la cola en WebGL) para que se lean como destellos rápidos y no como barras sólidas. Balas un 30 % más rápidas con la vida recortada en la misma proporción: mismo alcance, daño y cadencia (jugador 170 u/s y 0,85 s; aliadas 85 u/s y 1,15 s; enemigas 55 u/s y 3,05 s).

## Sin publicar — patrullas en los trayectos

- A–B y B–C pasan de 2 a 8 enemigos terrestres cada uno: infantería, tanques y torretas distribuidos por la vereda.
- Las 12 unidades adicionales se cargan al comenzar y mantienen libres el inicio, el perímetro de rescate de B y la llegada a C.


## Sin publicar — mapas grandes y aleatorios

- Patio de 640 × 640 unidades, con veredas, cerros, vegetación y objetivos generados por semilla para cada misión nueva.
- Reintentar mantiene el mismo terreno y despliegue; otra partida o la misión siguiente genera un mapa nuevo.
- A/B/C, escolta, enemigos, límites, colisiones y ambos renderizadores comparten el mismo mapa.
- WebGL renueva su malla al cambiar de mapa y conserva el terreno al restaurar el contexto.
- Pruebas de conexión de rutas, distancia de objetivos, despliegue seguro y llegada de toda la escolta con múltiples semillas.

## Sin publicar — misión arcade A → B → C (#27)

- Guardia de infantería en A, pelotón sano y heridos en B, extracción en C; marcadores A/B/C en ambos renderizadores.
- Enemigos predefinidos desde el inicio en la ruta y alrededor de B. Aliados y enemigos combaten entre sí con línea de visión y colisión de proyectiles.
- B debe estar despejada para recoger heridos. Capacidad 4, carga inicial 3; los sanos nunca abordan.
- Escolta por waypoints, carriles y desvíos alrededor de restos grandes; los soldados pisan fragmentos bajos. Sin teletransporte, con bajas explícitas por bloqueo prolongado.
- Victoria solo al entregar heridos y llegar todos los supervivientes a C. Fracaso por pérdida total o destrucción del helicóptero.
- Estrellas 1–3 y mejores resultados en almacenamiento local versionado, tolerante a ausencia, bloqueo y corrupción.
- Reinicio de misión idempotente; HUD, ayuda y flecha actualizados.

## Sin publicar — helicópteros presentes desde el inicio

- Todas las aeronaves enemigas se crean al cargar cada misión: 1, 2 y 3 según el nivel.
- Eliminado el temporizador que generaba refuerzos durante la partida. Los helicópteros destruidos no reaparecen.
- Se conserva la distancia de seguridad del punto de partida y la validación del terreno.
- Las pruebas comprueban presencia inicial, reintentos y ausencia de nuevas aeronaves durante 105 segundos simulados.

## Sin publicar — salida sin apariciones enemigas

- Zona de exclusión de 90 unidades alrededor del inicio, más el radio del enemigo.
- La misma validación cubre enemigos iniciales, reintentos y refuerzos aéreos.
- Si no existe una posición válida, se cancela la aparición; los refuerzos fallidos quedan disponibles para reintentarse.
- Pruebas con 30 semillas en las tres misiones, solicitudes junto al inicio y terreno completamente bloqueado.

## Sin publicar — recorrido con inicio y final

- Una sola vereda abierta conecta la salida, los campamentos lejanos y la extracción final.
- Bases y soldados de las tres misiones permanecen a más de 100 unidades del inicio.
- Helipuerto final verde independiente: solo permite ganar con todos los soldados a bordo, manteniendo posición durante 2 segundos.
- Flecha, ayuda y mensajes apuntan a la extracción final; regresar al inicio ya no completa la misión.
- Pruebas de distancia, accesibilidad del final y rechazo de extracciones prematuras.

## Sin publicar — veredas entre cerros

- Recorrido sinuoso conectado con desvíos y claros para las bases y los rescates.
- Cerros elevados y oscuros, con laderas rocosas, compartidos por WebGL y Canvas.
- Las laderas limitan el movimiento; el terreno intercepta los disparos.
- Apariciones de enemigos ajustadas al suelo transitable. Se mantienen las tres misiones.
- Pruebas de accesibilidad de todos los rescates, colisión y apariciones deterministas.

## Sin publicar — helicóptero de referencia

- Nuevo fuselaje verde alargado, cabina negra, motores gemelos y alas con cohetes de puntas claras.
- Rotor de dos palas con bandas blancas, extremos redondeados y luces rojas en la cola.
- Geometría compartida entre WebGL y Canvas, con sombreado de plástico e inclinación al pilotar.
- Se conservan los controles, la cámara y las colisiones.

## Sin publicar — controles para cámara de seguimiento

- Arriba/W avanza y abajo/S retrocede conservando el rumbo, sin giro de 180°.
- Izquierda/A y derecha/D giran progresivamente, también combinados con avance o retroceso.
- Eliminada la referencia fija por gesto: se puede cambiar de maniobra sin levantar el dedo.
- Zona muerta radial del 12 %, respuesta proporcional y diagonales sin velocidad extra.
- Teclas opuestas se cancelan; disparo y pilotaje mantienen propietarios táctiles independientes.
- Ayuda actualizada con el esquema de conducción.


## Sin publicar — cámara alineada con el helicóptero

- La cámara sigue posición y rumbo del jugador: la vista permanece detrás, mirando hacia la nariz.
- Se conserva el zoom y el encuadre bajo; desaparece el ángulo diagonal fijo al jugar.
- Cada gesto mantiene su referencia inicial para evitar giros continuos por realimentación de la cámara. Al soltar, el siguiente gesto toma el nuevo rumbo.
- Ayuda de controles actualizada.


## Sin publicar — cámara cercana y vista oblicua

- Zoom aproximado de 1.7×: helicóptero y escenario más grandes en pantalla.
- Ángulo de elevación de cámara de 60° a 40° para mostrar más los laterales.
- Helicóptero en torno al 64 % de la altura de pantalla, dejando terreno por delante.
- Escala adaptada a vertical/horizontal y mismo encuadre en WebGL/Canvas.
- Ajustada la distancia de dibujo para que la vista oblicua no recorte objetos visibles.
- Sin cambios de tamaño físico, controles, apuntado o colisiones.

## Inclinación del helicóptero

- El helicóptero inclina la nariz al desplazarse y cabecea hacia atrás al frenar,
  regresando suavemente a nivel al detenerse.
- La pose depende del movimiento efectivo: no permanece inclinado si un obstáculo
  impide avanzar. Se reinicia al comenzar/reintentar una misión.
- Fuselaje, rotor y patines se inclinan juntos en WebGL; proyección equivalente
  en Canvas. La sombra permanece sobre el suelo.
- Animación visual sin cambios de velocidad, controles, apuntado o colisiones.

## Objetos sólidos y cobertura

- Los elementos del patio, rocas, vegetación y restos de plástico bloquean
  proyectiles de ambos bandos según su volumen y altura.
- Los misiles impactan contra los obstáculos y su daño no atraviesa cobertura.
- El helicóptero y los enemigos móviles se detienen/deslizan al tocar obstáculos;
  los elementos bajos se pueden sobrevolar.
- Se buscan posiciones libres al generar enemigos. Colisiones barridas evitan
  atravesar objetos delgados entre frames; índice espacial para elementos fijos.
- Corregida la desaparición de rocas al acercarse un enemigo para evitar cobertura
  invisible; ambos renderers comparten la selección de vegetación visible.

## Rotura de juguetes

- Los impactos desprenden astillas y dejan marcas de plástico roto.
- Bases y helicópteros pierden cubierta/cabina tras varios impactos.
- Las bajas se desarman en componentes propios del juguete, sin bolas de fuego.
- Restos con gravedad, rebotes y apoyo sobre el terreno en WebGL y Canvas.
- Hasta 320 piezas persistentes por misión; se retiran primero astillas antiguas
  al llegar al límite y se limpian al reintentar, cambiar misión o volver al menú.
- Sonidos cortos de rotura; azar visual separado del azar de suministros.

## Refactor de scripts clásicos

- Separados CSS y módulos UMD/CommonJS manteniendo apertura por file://.
- Unificado el estado de partida y centralizados los efectos de las transiciones.
- Añadidas pruebas directas, aleatoriedad inyectable y smoke en navegador.
- Cacheados buffers de ruido y selección de decoración.
- Unificada la entrada en index.html, con redirección desde la dirección anterior.
- Centralizada la versión de recursos en src/bootstrap.js y dividida la documentación.

El refactor no añadió mecánicas de juego. La rotura de plástico se implementa
en una entrega independiente sobre esa estructura.

El historial previo se conserva en [docs/HISTORY.md](docs/HISTORY.md).
