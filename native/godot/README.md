# Army Men: Ataque Aéreo — versión nativa (Godot 4)

Fase 1 — Vuelo, puntería y cobertura. Escena jugable para evaluar si es
divertido pilotar y combatir con mouse. La versión web (`index.html` en la
raíz del repo) se conserva intacta; esto es un proyecto aparte.

## Motor

Godot **4.4.1 stable** (probado con `Godot_v4.4.1-stable_linux.x86_64`).
Abrir `native/godot/project.godot` con esa versión. No usar Godot 3 ni 4.3:
el formato de escena y del mapa de entradas es de 4.4.

## Ejecutar

- Abrir el proyecto en el editor de Godot 4.4.1.
- **F6**: ejecutar solo la escena principal (`scenes/main.tscn`).
- **F5**: ejecutar el proyecto (la escena principal es la misma).
- En Windows, el ejecutable exportado se arranca con doble clic; no
  necesita instalación.

## Controles

| Acción | Entrada |
|---|---|
| Mover (relativo a cámara, que nunca gira) | W A S D |
| Apuntar | Mouse (la mira naranja marca el punto del plano de vuelo) |
| Disparar (mantener) | Clic izquierdo |
| Reiniciar la prueba | R |

W avanza siempre hacia la parte superior de la pantalla y D hacia la
derecha, aunque el morro apunte en otra dirección. El morro gira hacia
la mira con velocidad limitada, y el disparo sale en la dirección actual
del morro, no instantáneamente hacia el cursor.

## La arena

- Base de salida (helipuerto con H) en el sur, en `(0, 16)`.
- Dos obstáculos sólidos grises en `(-7, 2)` y `(7, 2)`: bloquean el
  movimiento y los disparos. Desde la base tapan el blanco izquierdo y
  el derecho; el central queda en el hueco entre ambos.
- Tres blancos Tan (amarillo mostaza) en `(-16, -14)`, `(0, -17)` y
  `(16, -14)`. Son torres de 3,6 m para que el disparo horizontal, a la
  altura de vuelo (3 m), las alcance; los obstáculos miden 5 m y tapan
  la bala. Cada blanco aguanta 3 impactos y al destruirse solo deja
  una explosión breve, sin restos.
- El HUD muestra `Blancos: X / 3`. Al destruir los tres aparece
  `¡Arena despejada! Pulsa R para reiniciar`.

## Ajustes (sin tocar código de la escena)

En el inspector del nodo `Helicopter` (`scenes/helicopter.tscn`):

- `flight_height` (3.0), `move_speed` (14.0), `acceleration` (40.0)
- `turn_speed` (6.0 rad/s), `fire_interval` (0.12 s)
- `tilt_amount` (0.012), `bullet_scene`

En `scenes/bullet.tscn`: `speed` (55.0), `max_range` (70.0).
En `scenes/target.tscn`: `max_health` (3).

Las acciones están en el mapa de entradas de `project.godot`:
`move_forward`, `move_back`, `move_left`, `move_right`, `shoot`, `restart`.

## Estructura (reutilizable en ambas modalidades)

- `scripts/helicopter.gd` — control del helicóptero, independiente de la
  escena. Lo reutilizan el rescate A–B–C y el Battle Royale.
- `scripts/bullet.gd` — proyectil con raycast por segmento.
- `scripts/target.gd` — blanco destructible.
- `scripts/arena.gd` — solo lo propio de esta escena: cámara, mira,
  contador y reinicio.
- `scenes/main.tscn` — escena principal (arena).
- `scenes/helicopter.tscn`, `scenes/target.tscn`, `scenes/bullet.tscn`.

Capas de colisión: 1 = suelo, 2 = obstáculo, 4 = blanco, 8 = jugador.
La bala solo comprueba obstáculo + blanco (máscara 6).

## Exportar a Windows x86_64

1. En Godot: **Proyecto → Exportar… → Windows Desktop**.
   El preset ya está en `export_presets.cfg` y apunta a
   `export/windows/army-men-ataque-aereo.exe`.
2. Si falta la plantilla, Godot pedirá instalarla:
   **Editor → Manage Export Templates → Download and Install**
   (plantillas 4.4.1 stable, la misma versión del motor).
3. Alternativa por línea de comandos (con las plantillas instaladas):
   `godot --headless --export-release "Windows Desktop" export/windows/army-men-ataque-aereo.exe`
4. Entregar juntos `army-men-ataque-aereo.exe` y
   `army-men-ataque-aereo.pck` (el `.pck` va junto al `.exe`).

## Qué queda fuera (siguientes fases)

Bots, red/servidor, cuentas, puntajes y el rescate completo A–B–C.
