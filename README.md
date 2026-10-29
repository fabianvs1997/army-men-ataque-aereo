# Army Men: Ataque aéreo

Juego arcade de helicópteros de juguete con proyección 3D en Canvas 2D. Sin dependencias, instalación ni compilación.

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

Destruye todas las bases beige para avanzar. La flecha indica la base más cercana. Cada misión completada repara hasta tres puntos de blindaje y añade cuatro misiles. La partida se pausa al cambiar de ventana o esconder la pestaña; continuar requiere una acción del jugador.

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
