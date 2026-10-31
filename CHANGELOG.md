# Changelog

## Sin publicar — objetos sólidos y cobertura

- Los elementos del patio, rocas, vegetación y restos de plástico bloquean
  proyectiles de ambos bandos según su volumen y altura.
- Los misiles impactan contra los obstáculos y su daño no atraviesa cobertura.
- El helicóptero y los enemigos móviles se detienen/deslizan al tocar obstáculos;
  los elementos bajos se pueden sobrevolar.
- Se buscan posiciones libres al generar enemigos. Colisiones barridas evitan
  atravesar objetos delgados entre frames; índice espacial para elementos fijos.
- Corregida la desaparición de rocas al acercarse un enemigo para evitar cobertura
  invisible; ambos renderers comparten la selección de vegetación visible.

## Rotura de juguetes

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
