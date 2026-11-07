# Arquitectura

`index.html` contiene el DOM y `styles.css` su presentación. `src/bootstrap.js`
carga los scripts clásicos en orden y centraliza su versión de caché. La entrada
antigua solo redirige. No se necesita bundler, fetch ni servidor local.

| Módulo | Responsabilidad |
| --- | --- |
| prefs | Lectura y escritura de preferencias con almacenamiento opcional |
| audio | AudioContext, tonos, ruido cacheado, zumbido; callbacks isPlaying/isMuted |
| input | Teclado y punteros; read() y clear() |
| collision | Volúmenes del escenario, índice espacial, barrido de proyectiles y movimiento |
| debris | Componentes de juguetes, astillas, gravedad, rebotes y límite de restos |
| combat | Velocidad de disparo, impactos, bajas, proyectiles y humo de misil (`state.SM`, separado de las explosiones de `FX`). Cada bala lleva su origen (`b.kind`: `soldier` \| `heli` \| `tank`; las torretas cuentan como tanque) y el renderizador dibuja la trazadora proporcional al arma |
| projection | Proyección de cámara ortográfica oblicua (mundo → pantalla); la usa el HUD (brújula) y las pruebas. No dibuja nada |
| draw3d | Dibujo solo WebGL: si el renderizador dibuja, muestra `world3d`; si WebGL no inicia o se pierde, muestra `#webglRequired` en vez de un respaldo 2D |
| ui | Menús, HUD y textos |
| game | Estado, transiciones, simulación y bucle |
| toy-world | Geometría y decoración compartidas |
| toy-missions | Geometría de campaña y utilidades de impactos; API anterior conservada para regresión |
| original-maps | Los tres mapas fijos del original: A/B/C, trazado de rutas, composición enemiga por misión, vegetación, puntos de interés y relieve, escritos a mano, con validación de jugabilidad (ver [MAPAS-ORIGINALES.md](MAPAS-ORIGINALES.md)) |
| mission-map | Fachada de compatibilidad sobre `original-maps`: genera el mapa fijo de una misión y expone `generateCampaign` y `validate` |
| escort-config | Reglas y constantes A/B/C, fuerzas iniciales y ruta terrestre |
| escort-mission | Estados, eventos, combate aliado, abordaje, escolta y resultado |
| escort-navigation | Desvíos locales con búsqueda de ruta y colisiones barridas. A* con montón binario y presupuestos duros: meta recortada a 64 u, inicio y meta saneados al punto libre más cercano, como mucho 1200 expansiones o 12 ms por llamada; si no encuentra ruta devuelve null y el soldado espera. |
| perf | Monitor de rendimiento: EMA del tiempo real por frame y degradado automático en 3 niveles (tope de DPR 1.75 → 1.25 → 1, dibujo a 30 fps y mitad de escombros/humo en el nivel 2) con recuperación gradual. |
| logger | Registro de errores en el dispositivo: `console.error`, errores no controlados, rechazos y frames de más de 500 ms, con versión, misión, fase, semilla y rendimiento; últimas 100 entradas en localStorage con rotación, nunca rompe el juego. |
| supabase-env | Archivo generado en el despliegue (o en local) desde variables de entorno; define `__SUPABASE_CONFIG__`. Gitignorado, nunca en el repo. |
| supabase-config | Lee la configuración inyectada (`__SUPABASE_CONFIG__`); sin ella, modo invitado offline. Ningún valor va pegado en el código. La clave secreta no se usa nunca. |
| supabase | Cliente opcional de Supabase: Auth por correo, puntuaciones y envío de errores. Carga perezosa del CDN; sin configuración o sin red, todo queda en local. |
| escort-progress | Mejores resultados con esquema versionado y almacenamiento opcional |
| toy-helicopter | Modelo plástico del jugador para el renderizador WebGL |
| toy-renderer | Renderizado WebGL y detección de disponibilidad. La sombra del helicóptero se apoya en `surfaceTop(x, z)` (terreno, camino o helipuerto) para no quedar enterrada bajo el camino; se encoge con la altitud |

Game.create(host, options) permite inyectar random y Renderer. El objeto state
posee los datos de partida; view es una vista de acceso a ese mismo estado para
los módulos, no una segunda copia. Input y audio conservan sus recursos propios.
setState valida la transición y concentra limpieza de entrada, audio y overlay.

Las funciones públicas de combate y transition se prueban sin navegador ni HTML.
El generador por defecto sigue siendo Math.random; las pruebas inyectan semillas.

Los restos viven en state.DB. Combat emite fragmentos y Game los actualiza solo
durante play. No tienen colisión jugable ni alteran daño, puntuación o suministros.
Game.create permite visualRandom independiente de random para pruebas de efectos.

Collision.create(scene, world) toma las piezas del patio directamente de ToyWorld,
con cajas orientadas y elipsoides para vegetación/rocas. Cachea un índice espacial
para objetos fijos; los restos usan su posición actual. Los escombros asentados
van a su propio índice por celdas (se reconstruye solo cuando cambia el conjunto
asentado) y las piezas aún en el aire se revisan directas: con el campo saturado
(320 piezas) un trazado ya no recorre todos los escombros. La selección de vegetación
excluye las piezas ocultas alrededor de rescates. trace devuelve el primer contacto;
move barre ambos ejes para detener y deslizar cuerpos. Combat compara el contacto
con el del objetivo y comprueba la visibilidad de las víctimas antes del daño de misil.
Los obstáculos del patio son sólidos pero no destructibles en esta entrega.

### Mapas por misión

Los tres mapas son fijos y están escritos a mano en
`src/original-maps.js` (ver [MAPAS-ORIGINALES.md](MAPAS-ORIGINALES.md)):
recrean los escenarios del Army Men: Air Attack original —el valle alpino,
el picnic y la playa— con límites de 480 (patio de 960 × 960 u), posición de A/B/C, rutas
A–B y B–C, composición enemiga por misión, vegetación, puntos de
interés y relieve propios de cada escenario. La misma misión siempre
da el mismo mapa; `validate` comprueba por geometría que cada mapa
es jugable. `mission-map.js` es solo una fachada de compatibilidad
sobre los mapas fijos. `ToyWorld.create(map)` construye una instancia
independiente, compartida por física y renderizado de esa partida.
`start(n, full, retry)` conserva el mapa al reintentar. `Renderer.setWorld`
reemplaza el buffer de terreno y libera el anterior; la restauración
WebGL reutiliza el mapa activo. El mundo fijo exportado por defecto
se conserva para la vista de menú y pruebas de regresión.

### Congelamiento en la escolta a C (misión 2)

El A* del pelotón (`escort-navigation.path`) era el principal sospechoso del
congelamiento que persistía tras la optimización de escombros: con lista
abierta lineal y sin presupuesto, una meta lejana o inalcanzable quemaba
~70 ms por llamada en Node (varios cientos de ms en iPhone), y podían
dispararse hasta 4 llamadas en un mismo frame (un soldado atascado cada
3 s). La versión actual lo limita a una llamada por frame como mucho, con
enfriamiento de 6 s si falla, y devuelve null en vez de agotar el frame.
`ToyWorld.trailDistance` poda los segmentos por caja envolvente antes de
medir, y `mesh()` escribe en un `Float32Array` prealocado en vez de
`push(...)` por vértice: arrancar la misión 2 pasó de 141–241 ms a
~35 ms en Node (peor caso medido 109 ms).

El bucle principal alimenta `perf.update` con el dt real de cada frame; si
la EMA supera 30 ms durante 90 frames seguidos, `ToyPerf` baja el nivel de
detalle (tope de `devicePixelRatio`, dibujo a 30 fps y mitad de
escombros/humo en el nivel 2) y lo recupera tras 600 frames rápidos por
nivel. Con `?perf=1` el HUD muestra FPS, ms por frame, peor frame, nivel
y fase de la misión, para diagnosticar en el iPhone si el congelamiento
persiste.

### Registro de errores y Supabase (opcional)

`src/logger.js` (`ToyLogger`) captura errores de consola, errores no
controlados, rechazos de promesas y frames de más de 500 ms (con
enfriamiento de 5 s entre avisos de congelamiento). Cada entrada lleva
fecha, tipo, mensaje, pila, versión del juego, misión, fase, semilla,
FPS/ms, nivel de degradado y dispositivo; nunca datos personales. Se
guarda en localStorage con rotación (últimas 100) y se puede ver en
Menú → Registro, exportar como JSON o ver el contador con `?logs=1`.

`src/supabase.js` (`ToySupabase`) es un cliente opcional: sin
configuración inyectada todos sus métodos son no-op offline y el juego
sigue como invitado. La configuración no vive en el repositorio: en
producción, el workflow `.github/workflows/deploy-pages.yml` genera
`src/supabase-env.js` a partir de los secretos de GitHub
`SUPABASE_URL` y `SUPABASE_ANON_KEY`, y en local se genera igual con
`node scripts/generate-supabase-config.cjs` desde variables de entorno
o un `.env` (ambos gitignorados; ver `.env.example`). `src/bootstrap.js`
carga `supabase-env` como script opcional: si el archivo no existe
(despliegue desde la rama, `file://` sin generar), se tolera el 404 y
el juego sigue como invitado. Con URL y clave ANON, carga la librería
oficial desde el CDN solo cuando hace falta; si el CDN no carga, sigue
offline. Auth por correo y contraseña (las contraseñas solo pasan por
Supabase Auth), puntuaciones en `scores` al completar cada misión
(como invitado o sin red quedan en cola local, máximo 20, y se envían
al iniciar sesión) y envío de errores en lotes a `error_logs`. El
esquema y las políticas RLS están en `supabase/schema.sql`; los pasos
para activarlo, en `docs/SUPABASE.md`. La clave secreta (service_role)
no se usa nunca en el juego: el generador la rechaza.
