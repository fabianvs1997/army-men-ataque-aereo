# Army Men: Ataque aéreo

Juego de helicópteros de juguete con campaña de rescate, escenario de patio trasero,
solo renderizado WebGL 3D.

## Jugar

Abre `index.html` con doble clic o visita [el juego](https://fabianvs1997.github.io/army-men-ataque-aereo/).
No necesita servidor ni compilación. La dirección antigua `army-men-ataque-aereo.html`
redirige a la entrada principal. El menú incluye controles, ayuda y ajustes.
Las preferencias y los mejores resultados (estrellas y supervivientes por misión) se conservan cuando el navegador permite almacenamiento. La partida en curso se reinicia al cerrar. Con Supabase configurado con variables de entorno (opcional, ver [Supabase](docs/SUPABASE.md)), se puede crear una cuenta para guardar las puntuaciones en línea y enviar el registro de errores; sin él, se juega como invitado y todo queda en este dispositivo. El menú incluye controles, ayuda, ajustes, cuenta y registro de errores.

Cada misión sigue A → B → C: despega de A con guardias aliados, despeja el perímetro de B, recoge solo a los heridos y protege al pelotón que marcha por tierra. Entrega a los heridos en C y espera a los supervivientes para completar la misión.

El patio mide 960 × 960 unidades. Cada misión tiene su mapa fijo, recreado de los escenarios del Army Men: Air Attack original (1999): el valle alpino, el picnic y la playa, con sus posiciones de A, B y C, veredas, cerros, vegetación, puntos de interés y composición enemiga. Reintentar conserva el mapa de esa misión. Enemigos y objetivos se colocan al comenzar; la ruta terrestre permanece conectada.

## Desarrollar

Ejecuta `node --test` (CI usa Node 22). Los scripts son clásicos con exportación UMD/CommonJS;
no convertirlos a módulos ES sin resolver primero la compatibilidad con `file://`.
Para publicar cambios de recursos, actualiza **VERSION en `src/bootstrap.js`** una sola vez.
El cargador aplica esa versión a CSS y a todos los módulos, respetando su orden.

- [Arquitectura](docs/ARCHITECTURE.md)
- [Supabase: cuentas, puntuaciones y registro](docs/SUPABASE.md)
- [Pruebas y pendientes de iPhone](docs/TESTING.md)
- [Plan y evidencias del refactor](docs/REFACTOR.md)
- [Cambios](CHANGELOG.md)
- [Historial anterior](docs/HISTORY.md)

## Vuelo sobre datos del disco de PC

Desde el menú, abre **Volar en el mapa original (PAK)** y selecciona `Pak/ALPINE1.PAK` de tu instalación de Windows. La lectura y el renderizado WebGL ocurren en el navegador. WASD y Q/E controlan el helicóptero; también puedes mantener el clic derecho para seguir el cursor. Esta vista migra la inspección del relieve y el fuselaje, con el radar como color provisional. La campaña web se inicia por separado.
