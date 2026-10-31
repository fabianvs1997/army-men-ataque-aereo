# Army Men: Ataque aéreo

Juego de helicópteros de juguete con campaña de rescate, escenario de patio trasero,
renderizado WebGL y alternativa Canvas 2D.

## Jugar

Abre `index.html` con doble clic o visita [el juego](https://fabianvs1997.github.io/army-men-ataque-aereo/).
No necesita servidor ni compilación. La dirección antigua `army-men-ataque-aereo.html`
redirige a la entrada principal. El menú incluye controles, ayuda y ajustes.
Las preferencias se conservan cuando el navegador permite almacenamiento; la campaña no se guarda.

## Desarrollar

Ejecuta `node --test` (CI usa Node 22). Los scripts son clásicos con exportación UMD/CommonJS;
no convertirlos a módulos ES sin resolver primero la compatibilidad con `file://`.
Para publicar cambios de recursos, actualiza **VERSION en `src/bootstrap.js`** una sola vez.
El cargador aplica esa versión a CSS y a todos los módulos, respetando su orden.

- [Arquitectura](docs/ARCHITECTURE.md)
- [Pruebas y pendientes de iPhone](docs/TESTING.md)
- [Plan y evidencias del refactor](docs/REFACTOR.md)
- [Cambios](CHANGELOG.md)
- [Historial anterior](docs/HISTORY.md)
