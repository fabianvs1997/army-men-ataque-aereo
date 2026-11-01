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
| combat | Velocidad de disparo, impactos, bajas y proyectiles |
| render2d | Sprites y dibujo a partir de scene; caché de decoración |
| ui | Menús, HUD y textos |
| game | Estado, transiciones, simulación y bucle |
| toy-world | Geometría y decoración compartidas |
| toy-missions | Reglas de rescate y campaña |
| toy-helicopter | Modelo plástico del jugador compartido por WebGL y Canvas |
| toy-renderer | Renderizado WebGL y detección de disponibilidad |

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
para objetos fijos; los restos usan su posición actual. La selección de vegetación
excluye las piezas ocultas alrededor de rescates. trace devuelve el primer contacto;
move barre ambos ejes para detener y deslizar cuerpos. Combat compara el contacto
con el del objetivo y comprueba la visibilidad de las víctimas antes del daño de misil.
Los obstáculos del patio son sólidos pero no destructibles en esta entrega.
