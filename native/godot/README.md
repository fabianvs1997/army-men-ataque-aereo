# Rescate nativo en Godot 4.4.1

La escena inicial es `res://scenes/suministros.tscn`. Recrea los dos objetivos de la primera misión alpina del disco: recoger suministros de la base secreta y llevarlos al portal. E o clic central opera el gancho. F3 pasa de suministros a rescate, entrenamiento y de vuelta a suministros. Clic derecho mantenido vuela hacia el cursor; WASD permite desplazarse mientras se apunta en otra dirección. El clic izquierdo dispara hacia el morro. R reinicia.

Despeja las tres defensas de B, mantente sobre la base durante 1,5 s para recoger los tres heridos y acompaña a los cuatro soldados hasta C. Espera allí dos segundos para entregarlos. El juego guarda el número de rescates completos en `user://rescate.cfg`. Los enemigos atacan al helicóptero y al pelotón; los aliados responden al fuego.

## Alcance de la migración

| Sistema de referencia | Estado nativo |
| --- | --- |
| Vuelo, puntería, disparos y cobertura | Implementados. El mouse funciona sin programas externos. |
| Reglas de rescate de `src/escort-config.js` | Misión fija con tres heridos, cuatro escoltas, recogida, entrega, combate y resultado. |
| Progreso de `src/escort-progress.js` | Contador local de rescates completados. Sin importador del progreso web ni guardado en mitad de misión. |
| Mapas, patrullas, vehículos y campaña | Pendientes la generación por misión, los helicópteros enemigos y el resto de misiones y armas. |
| Audio y preferencias | Pendientes de portar. |
| Perfiles y puntajes del servidor | Pendientes de integración. |
| Battle Royale | Pendiente: primero bots en una arena, luego servidor autoritativo y ocho participantes. |

Desde esta carpeta, ejecutar `godot --headless --import`, `godot --headless -s checks/rescate.gd`, `godot --headless -s checks/suministros.gd` y abrir el proyecto con F5. El chequeo escribe en el mismo directorio de datos que el juego; usar una carpeta de datos de prueba. Para Windows, exportar con la plantilla 4.4.1 y el preset Windows Desktop.
