# Changelog

## Sin publicar — rotura de juguetes

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
