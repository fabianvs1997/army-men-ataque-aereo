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

Se reutilizan dos mallas y se descartan entidades alejadas del encuadre; la resolución interna está limitada a 1.75 veces el tamaño CSS. Esto limita trabajo gráfico, pero no equivale a un rendimiento medido en iPhone.

Si WebGL no inicia, se mantiene la vista Canvas 2D. Si se pierde el contexto durante la partida, se pausa y muestra la vista 2D; al restaurarse se reconstruye el renderizador. El jugador debe continuar la partida explícitamente.

Pruebas: `node --test` cubre lógica de juego, geometría, parámetros finitos, cambio de tamaño, descarte fuera de vista, errores de inicialización y pérdida/restauración del contexto con una API simulada. Además, se compilaron y enlazaron los mismos shaders en un contexto OpenGL ES/Mesa y se inspeccionó una escena renderizada sin errores GL. Esto no sustituye la validación del contexto WebGL en navegador: integración visual y FPS en Safari/iPhone siguen pendientes.

Comprobación manual pendiente en Safari/iPhone:

1. Despegar y comprobar volumen, rotor y orientación al moverse en cuatro direcciones.
2. Pasar por delante y detrás de edificios/árboles y comprobar la profundidad.
3. Disparar, lanzar misiles, recoger suministros y completar/reintentar una misión.
4. Girar el teléfono, pausar, cambiar de aplicación y volver.
5. Confirmar que el modo 2D permite jugar cuando WebGL no está disponible.
