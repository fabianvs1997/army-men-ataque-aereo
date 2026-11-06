# Changelog

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
