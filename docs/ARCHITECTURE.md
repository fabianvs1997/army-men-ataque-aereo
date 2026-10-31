# Arquitectura

`index.html` contiene el DOM y `styles.css` su presentación. `src/bootstrap.js`
carga los scripts clásicos en orden y centraliza su versión de caché. La entrada
antigua solo redirige. No se necesita bundler, fetch ni servidor local.

| Módulo | Responsabilidad |
| --- | --- |
| prefs | Lectura y escritura de preferencias con almacenamiento opcional |
| audio | AudioContext, tonos, ruido cacheado, zumbido; callbacks isPlaying/isMuted |
| input | Teclado y punteros; read() y clear() |
| debris | Componentes de juguetes, astillas, gravedad, rebotes y límite de restos |
| combat | Velocidad de disparo, impactos, bajas y proyectiles |
| render2d | Sprites y dibujo a partir de scene; caché de decoración |
| ui | Menús, HUD y textos |
| game | Estado, transiciones, simulación y bucle |
| toy-world | Geometría y decoración compartidas |
| toy-missions | Reglas de rescate y campaña |
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
