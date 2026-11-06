# Motor de mapas (`src/mapgen.js`)

Cada misión genera un mapa distinto con una semilla. El motor es
`ToyMapGen` (`src/mapgen.js`); `src/mission-map.js` es solo una
fachada que conserva la API anterior para el juego y las pruebas.

## Cómo funciona

- **Semillas.** Una campaña tiene una semilla propia
  (`state.campaignSeed`) y cada misión deriva la suya con
  `seedForMission(campaña, misión)`. La misma (misión, semilla) da
  siempre el mismo mapa; semillas distintas dan mapas distintos.
  Reintentar una misión conserva su mapa; el botón **Mapa nuevo**
  del menú empieza otra campaña con otros tres mapas.
- **RNG con semilla.** `createRng` es un mulberry32 propio: rápido,
  determinista y sin depender de `Math.random`.
- **Qué varía de mapa en mapa.**
  - Posición de A (ya no es fija en (0, 0)), de B y de C, con
    distancias y ángulos propios; el mapa puede espejarse.
  - Trazado de las rutas A→B (con vaivén) y B→C (con onda senoidal
    de amplitud y frecuencia propias).
  - Composición enemiga: las patrullas sortean su tipo por misión
    (la 1 es casi toda infantería; la 3 mezcla tanques y torretas) y
    el aire extra crece con la misión.
  - Vegetación, rocas y puntos de interés (macetero, regadera,
    banco) con posiciones de semilla, fuera de pads y rutas.
  - Relieve: amplitud y frecuencias propias por mapa.
- **Dificultad creciente.** La misión 3 aleja más los objetivos y
  tiene más vida enemiga total que la 1 (en 20 semillas, ~155 HP
  frente a ~119 HP de media). Los objetivos A → B → C, quién debe
  recogerse y la entrega en C no cambian; tampoco el balance de
  armas.
- **Generación rápida.** Generar un mapa cuesta ~1,5 ms de media en
  Node (300 mapas medidos); no toca los bucles calientes del juego.

## Jugabilidad garantizada

`validate(map)` comprueba por geometría: A, B y C dentro del patio
y separados entre sí, rutas conectadas y sin tramos imposibles,
enemigos fuera del radio seguro de A y de los perímetros de B y C,
vegetación fuera de las rutas e identificadores únicos.
`generate` reintenta con otra semilla hasta 12 veces si un mapa no
pasa; si todo falla, usa un mapa de respaldo generado con semillas
fijas (nunca uno roto). La validación completa con terreno y escolta
(la ruta es transitable y el pelotón llega a C) vive en
`tests/mapgen.test.cjs` y `tests/mission-map.test.cjs`.

## Reproducir un mapa

La semilla del mapa activo está en el HUD con `?perf=1`
(`· semilla <n>`) y en el registro de errores (Menú → Registro).
Con ella, `ToyMapGen.generate(misión, semilla)` en la consola o en
Node reproduce el mapa exacto. `generateCampaign(semilla)` devuelve
los tres mapas de una campaña, distintos por construcción.
