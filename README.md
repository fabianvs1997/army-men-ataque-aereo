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
| Girar | A/D o flechas izquierda/derecha | Arrastrar horizontalmente |
| Acelerar/frenar | W/S o flechas arriba/abajo | Arrastrar verticalmente |
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
