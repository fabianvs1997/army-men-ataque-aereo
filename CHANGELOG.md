# Changelog

## Sin publicar — refactor de scripts clásicos

- Separados CSS y módulos UMD/CommonJS manteniendo apertura por file://.
- Unificado el estado de partida y centralizados los efectos de las transiciones.
- Añadidas pruebas directas, aleatoriedad inyectable y smoke en navegador.
- Cacheados buffers de ruido y selección de decoración.
- Unificada la entrada en index.html, con redirección desde la dirección anterior.
- Centralizada la versión de recursos en src/bootstrap.js y dividida la documentación.

No se añaden mecánicas de juego en este refactor. Los fragmentos de plástico
persistentes quedan para una entrega posterior.

El historial previo se conserva en [docs/HISTORY.md](docs/HISTORY.md).
