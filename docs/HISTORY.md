# Historial anterior al refactor

Documento archivado: los nombres de archivos y pendientes de abajo pueden ser históricos. Para instrucciones vigentes consulta el README y TESTING.

# Army Men: Ataque aéreo

Juego arcade de helicópteros de juguete con WebGL 3D y respaldo Canvas 2D. Sin dependencias, instalación ni compilación.

## Jugar

Abre `index.html` o `army-men-ataque-aereo.html` en un navegador moderno. Para servirlo localmente:

```sh
python3 -m http.server 8000
```

Visita http://localhost:8000. GitHub Pages puede servir estos mismos archivos desde la raíz de `Master`.

## Controles

| Acción | Teclado | Pantalla táctil |
| --- | --- | --- |
| Desplazarse izquierda/derecha | A/D o flechas izquierda/derecha | Arrastrar horizontalmente |
| Desplazarse arriba/abajo | W/S o flechas arriba/abajo | Arrastrar verticalmente |
| Disparar | Mantener Espacio | Mantener Fuego |
| Misil | M o Mayús | Pulsar Misil |
| Pausar/continuar | P | Pausa / Continuar |
| Sonido | Botón Silenciar | Botón Silenciar |

Para completar una misión, destruye las bases beige, recoge a todos los soldados verdes y vuelve al helipuerto. Quédate quieto y sin disparar 1.5 segundos junto a cada soldado y 2 segundos en el helipuerto. La flecha indica el siguiente objetivo de rescate, una base pendiente o el regreso al helipuerto. Cada misión completada repara hasta tres puntos de blindaje y añade cuatro misiles. La partida se pausa al cambiar de ventana o esconder la pestaña; continuar requiere una acción del jugador.

## Validación

Con Node.js 22 o posterior:

```sh
node --test
```

Las pruebas cubren pausa, pérdida de foco, multitáctil, reinicio, puntuación y repetición de la tecla de misiles. GitHub Actions las ejecuta en pushes y pull requests. Son pruebas de lógica con DOM simulado: la apariencia y el audio requieren comprobación manual en navegador, especialmente Safari/iOS.

## Estructura

- `index.html`: entrada al juego.
- `army-men-ataque-aereo.html`: interfaz, motor, renderizado y audio sintetizado.
- `tests/game.test.cjs`: regresiones sin paquetes externos.

El progreso vive en memoria y se pierde al recargar la página. El audio depende de la compatibilidad del navegador y comienza tras una interacción.

## Etapa 1: cámara y escala

Cámara ortográfica elevada 60 grados con orientación diagonal fija y seguimiento suave. Los controles desplazan el helicóptero respecto a la pantalla; al soltar se mantiene en posición. El morro apunta al último desplazamiento y los disparos siguen esa dirección. Se conserva Canvas 2D; modelos 3D y relieve quedan para la etapa siguiente. La escala se adapta a pantallas verticales y horizontales. Pendiente validar comodidad y rendimiento en un iPhone real.

## Etapa 2: base gráfica 3D

`toy-renderer.js` añade un renderizador WebGL 1 sin dependencias ni descargas externas. Usa geometría compartida (cajas y esferas), iluminación direccional, reflejos y un búfer de profundidad. El helicóptero tiene fuselaje, cabina, cola, patines y rotor animado. Enemigos y decoraciones también tienen volumen. La cámara y las coordenadas coinciden con la etapa 1.

El escenario incluye una explanada con caminos y helipuerto. El suelo sigue siendo plano y los obstáculos decorativos no tienen colisiones; relieve y ambientación detallada quedan fuera de esta etapa. Las sombras de helicópteros son elipses de contacto aproximadas, no sombras dinámicas calculadas por luz.

Se reutilizan tres mallas y se descartan entidades alejadas del encuadre; la resolución interna está limitada a 1.75 veces el tamaño CSS. Esto limita trabajo gráfico, pero no equivale a un rendimiento medido en iPhone.

Si WebGL no inicia, se mantiene la vista Canvas 2D. Si se pierde el contexto durante la partida, se pausa y muestra la vista 2D; al restaurarse se reconstruye el renderizador. El jugador debe continuar la partida explícitamente.

Pruebas: `node --test` cubre lógica de juego, geometría, parámetros finitos, cambio de tamaño, descarte fuera de vista, errores de inicialización y pérdida/restauración del contexto con una API simulada. Además, se compilaron y enlazaron los mismos shaders en un contexto OpenGL ES/Mesa y se inspeccionó una escena renderizada sin errores GL. Esto no sustituye la validación del contexto WebGL en navegador: integración visual y FPS en Safari/iPhone siguen pendientes.

Comprobación manual pendiente en Safari/iPhone:

1. Despegar y comprobar volumen, rotor y orientación al moverse en cuatro direcciones.
2. Pasar por delante y detrás de edificios/árboles y comprobar la profundidad.
3. Disparar, lanzar misiles, recoger suministros y completar/reintentar una misión.
4. Girar el teléfono, pausar, cambiar de aplicación y volver.
5. Confirmar que el modo 2D permite jugar cuando WebGL no está disponible.

## Etapa 3: plástico moldeado y estado gráfico

Los modelos incorporan una tercera malla de caja con bordes redondeados, brillo especular más definido, junta central y tornillos en el helicóptero, rejillas de motor, bandas de oruga y peanas para figuras terrestres. Conservan el verde y el beige de los equipos. La lectura del detalle depende de la escala en pantalla; no se ha cambiado el zoom de la etapa 1.

El HUD organiza vida y modo gráfico, misión y botones en filas separadas. La esquina superior indica `3D · Plástico` cuando está activo WebGL o `2D · 3D no disponible` cuando se usa el respaldo. En caso de pérdida de contexto, la etiqueta cambia junto con la vista.

Compatibilidad: los shaders declaran explícitamente la misma precisión en sus variables compartidas; se elimina la preferencia de GPU de bajo consumo y se intenta el alias `experimental-webgl` si el contexto estándar no está disponible. El archivo del renderizador lleva versión en la URL para evitar reutilizar su copia anterior en caché. Estos cambios no garantizan que un dispositivo sin contexto WebGL pueda activarlo.

Diagnóstico: la página publicada de la etapa 2 se comprobó en el navegador remoto y registró `WebGL no disponible`, activando el respaldo 2D. Esto no identifica por sí solo la causa en el iPhone del usuario. Pendiente comprobar allí el indicador de modo y el renderizado. Validación de etapa 3: 15 pruebas automatizadas y shaders/escena en OpenGL ES/Mesa sin errores.

## Etapa 4: terreno y ambientación

`toy-world.js` define un terreno determinista compartido por ambos modos. La malla usa celdas de 4 unidades y 60 000 vértices; se crea al iniciar/restaurar el renderizador, no en cada fotograma. La consulta de altura interpola los mismos triángulos que se dibujan. Las elevaciones permanecen por debajo de 5 unidades y el vuelo sigue a unas 8 unidades; caminos y helipuerto tienen áreas despejadas.

Se añaden caminos curvos, variaciones de color procedurales para hierba/tierra, rocas y arbustos. Un lápiz, un carrete de hilo y una ficha de dominó grandes funcionan como referencias de escala. Los enemigos aparecen fuera del espacio reservado a estos objetos; las unidades terrestres se ajustan al suelo. La búsqueda de posiciones tiene un máximo de intentos y una ubicación de respaldo libre de estos objetos.

El modo Canvas 2D también dibuja terreno, caminos, rocas y referencias de escala. Su representación del relieve es aproximada y no ofrece el búfer de profundidad del modo WebGL. Los objetos decorativos todavía no bloquean movimiento ni disparos; las sombras de contacto siguen siendo aproximadas. No se han añadido misiones nuevas.

Validación: 21 pruebas aprobadas de controles, renderizador, elevaciones, normales, continuidad, posiciones iniciales y dibujo Canvas vertical/horizontal. Se compilaron shaders y se inspeccionó la escena de prueba con OpenGL ES/Mesa sin errores GL. Se corrigió la superposición de profundidad entre caminos y helipuerto. Pendiente comprobar distribución real y FPS en Safari/iPhone, tanto con indicador 3D como con respaldo 2D.


## Etapa 5: campaña de rescate

Tres misiones: **Primer rescate** (un campamento, dos soldados), **Dos campamentos** (dos y cuatro) y **Última extracción** (tres y seis). Los vehículos y la nueva infantería beige defienden el mapa; los refuerzos aéreos tienen un presupuesto limitado por misión y dejan de aparecer al destruir las bases.

1. Sigue la flecha y destruye las bases beige para liberar a los soldados verdes.
2. Acércate a menos de 6 unidades y suelta movimiento y fuego durante 1.5 s. Un símbolo amarillo marca a los soldados disponibles. Moverte, disparar, recibir daño o salir del radio reinicia la recogida.
3. Con todos a bordo, vuelve al helipuerto marcado con H y mantén la posición durante 2 s. Solo entonces se completa la misión.

Los soldados aliados no reciben daño ni participan en el combate. Se otorgan 50 puntos por rescate y 250 por extracción. Tras una derrota, **Reintentar misión** reinicia la misión actual, sus rescates y recursos, conservando solamente la puntuación de las misiones anteriores; no obliga a regresar a la misión 1. Tras la tercera extracción aparece el final de campaña y **Jugar de nuevo** comienza desde cero. El progreso no se guarda al recargar.

La ametralladora ajusta su dirección hacia enemigos dentro de un pequeño cono frontal (ver asistencia de apuntado al final). Las balas y los misiles comprueban el recorrido entre fotogramas contra volúmenes de enemigos para evitar saltarse objetivos pequeños; una bala golpea al primer enemigo intersectado. Los impactos muestran un destello y las explosiones de misil afectan a enemigos cercanos en 3D. Los objetos decorativos siguen sin bloquear proyectiles o movimiento.

Los soldados, marcadores y helipuerto funcionan en WebGL y en el respaldo Canvas 2D. El HUD muestra nombre de misión, instrucciones, progreso de recogida y conteos. Se elimina decoración pegada a los soldados para mantenerlos visibles.

Validación de esta etapa: 32 pruebas automatizadas de controles, renderizadores y campaña, incluidos recorridos completos de victoria, derrota/reintento, pausa, final de campaña, reinicio de recogida y primer impacto de proyectiles. La validación de dibujo usa Canvas/WebGL simulados; queda pendiente una partida manual y la comprobación visual/rendimiento en Safari/iPhone para esta versión.


## Etapa 6: controles y ahorro en móvil

Un joystick flotante aparece al arrastrar el escenario, con recorrido visual limitado. Se puede mantener Fuego con otro dedo: solo el dedo que lo activó puede soltarlo. Cancelar el gesto, perder la captura, pausar o girar la pantalla limpia las entradas. El cambio de orientación detiene el movimiento hasta un nuevo gesto.

El botón **Gráficos: detalle / ahorro** cambia la resolución interna: detalle limita la densidad a 1.75 y ahorro a 1, en ambos renderizadores. Ahorro limita el dibujo a aproximadamente 30 cuadros por segundo, conservando la frecuencia de actualización de lógica y controles del navegador. No garantiza alcanzar 30 FPS. No se redibuja continuamente durante pausa, derrota o victoria, ni al ocultar la pestaña; los cambios de tamaño/contexto invalidan la imagen. El HUD actualiza los textos solo cuando cambian.

El diseño usa altura dinámica y zonas seguras, con distribución compacta en horizontal y menú desplazable. Sonido y calidad se guardan localmente cuando el navegador lo permite; el juego sigue funcionando si bloquea ese almacenamiento. Esto no guarda el progreso de campaña. El audio reutiliza el elemento auxiliar silencioso, desconecta nodos terminados y detiene ese elemento en las pantallas de pausa y resultado.

Validación: 39 pruebas automatizadas. Incluyen propiedad del dedo de disparo, cancelación del joystick, pausa/visibilidad, cadencia de dibujo separada de simulación, resolución de ambos modos, preferencias y limpieza del audio. DOM, Canvas, WebGL y audio se simulan: no son una medición de FPS ni una validación visual/sonora en Safari.

Comprobación manual pendiente en iPhone:

1. Mover, mantener Fuego con otro dedo y lanzar un misil; soltar cada dedo por separado.
2. Girar a horizontal y volver; comprobar que los controles quedan dentro de pantalla y no sigue moviéndose solo.
3. Alternar detalle/ahorro, silenciar y recargar para comprobar las preferencias.
4. Cambiar de aplicación, regresar y pulsar Continuar; comprobar pausa y audio.
5. Completar un rescate en ambos modos gráficos y comparar fluidez sin cambiar la velocidad de juego.

## Patio trasero residencial

El escenario compartido por las tres misiones ahora representa un jardín doméstico: cerca de tablones y travesaños, fachada con puerta y ventanas, terraza con juntas, sendero con losas, césped con variaciones de color y arbustos. Un macetero de terracota, una regadera con manguera y una banca sustituyen los objetos de escritorio. Los helicópteros y soldados conservan el acabado plástico y su escala pequeña respecto al entorno.

`ToyWorld.yard` describe las piezas domésticas una sola vez para WebGL y Canvas 2D. El renderizador 3D usa materiales mates en el jardín; el respaldo proyecta caras sombreadas y césped con gradientes y pequeñas marcas. Las piezas se descartan por distancia y reutilizan las mallas existentes. La generación es determinista y no requiere imágenes ni descargas externas.

Se reserva espacio alrededor de los objetos grandes y delante de la terraza para la aparición inicial de enemigos. Los campamentos y rescates existentes mantienen sus coordenadas. Es una ambientación estilizada, no fotorrealista: no incorpora colisiones con mobiliario, sombras solares calculadas ni un patio diferente por misión. La ordenación de caras del respaldo 2D es aproximada.

Validación: 41 pruebas de lógica, geometría, posiciones y renderizadores simulados. Además, se generaron e inspeccionaron vistas del centro del jardín y de la fachada con el renderizador Canvas real de `@napi-rs/canvas` (solo herramienta de revisión, sin dependencia nueva del juego). Pendiente comprobar el resultado WebGL y el rendimiento en Safari/iPhone.


## Asistencia de apuntado de ametralladora

Al mantener Fuego, cada bala busca al enemigo vivo más cercano dentro de **12 grados a cada lado del morro**, entre 4 y 130 unidades de distancia horizontal. Corrige dirección horizontal y altura desde la boca del cañón hacia el centro del enemigo. El helicóptero conserva su orientación; fuera del cono se mantiene el disparo frontal normal.

La asistencia se calcula al disparar: las balas no persiguen objetivos ni anticipan su movimiento, por lo que un enemigo móvil puede esquivarlas. No activa Fuego automáticamente ni cambia los misiles. Funciona igual con teclado, pantalla táctil, WebGL y Canvas.

Validación: 44 pruebas aprobadas, incluidos ambos lados del cono, exclusión por ángulo/distancia, selección del enemigo vivo más cercano, convergencia desde ambos cañones e impacto real de la simulación sobre infantería desplazada lateralmente. Pendiente ajustar la sensación jugando en iPhone.


## Menú principal

La entrada muestra un panel de estilo militar con **Iniciar campaña**, **Cómo jugar**, **Ajustes** y **Acerca del juego**. La guía explica movimiento, asistencia de apuntado, rescates, extracción y teclado. Ajustes permite cambiar sonido y detalle/ahorro antes de despegar; se sincroniza con los botones de la partida y conserva las preferencias existentes.

En pausa y resultados se puede consultar la guía o ajustar opciones sin perder el estado. **Continuar**, **Reintentar misión** y **Siguiente misión** mantienen su comportamiento. Volver al menú durante una campaña solicita confirmar la pérdida de progreso; cancelar conserva la partida. Salir después del final de campaña vuelve directamente al menú.

Esc pausa durante el juego, regresa desde un panel secundario o continúa desde la pantalla de pausa. P no reanuda accidentalmente mientras se consulta un panel. Los botones admiten navegación con teclado y los paneles largos permiten desplazamiento táctil. No se añade guardado de campaña ni selector de niveles.

Validación: 49 pruebas automatizadas aprobadas, incluyendo navegación, inicio, ajustes sincronizados, conservación de misión pausada, cancelación/confirmación de salida, resultados y teclado. No se realizó comprobación visual en navegador; pendiente revisar distribución y desplazamiento en Safari/iPhone, especialmente en horizontal.
