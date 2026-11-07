# Mapas fijos del original (`src/original-maps.js`)

Cada misión tiene un solo mapa, fijo y escrito a mano en
`src/original-maps.js` (`ToyOriginalMaps`); `src/mission-map.js` es
solo una fachada que conserva la API anterior para el juego y las
pruebas. No hay motor aleatorio: el antiguo `src/mapgen.js` se
eliminó, no hay botón «Mapa nuevo» y la misma misión siempre da el
mismo mapa. Reintentar conserva el mapa, como siempre.

## Los tres mapas

| Misión | Mapa | Escenario | Semilla | Inspiración en el original |
| --- | --- | --- | --- | --- |
| 1 | Pandemonio de Plástico | Alpine | 101 | «Plastic Pandemonium», primera misión del original: base secreta alpina, suministros de plástico y un portal |
| 2 | El picnic | Picnic | 202 | «Picnic Panic», el picnic del original: comida por todas partes y hormigas |
| 3 | La playa | Beach | 303 | «Don't Feed The Crabs» y «Tide Pool Terror», los rescates de la playa del original: castillos de arena y libélulas |

- **Misión 1, Pandemonio de Plástico** — A (0, 0), B (-150, 170), C (180, 190).
  Valle alpino del mundo de plástico, como el original: pasto verde,
  camino de tierra, pinos altos, montañas con cima nevada como borde
  (sobre todo a la derecha del camino, cerca del portal), base verde
  de salida con 4 torres de guardia, caja verde de suministros junto
  a B y portal brillante al final del camino, pasado C. Sin casa, sin
  valla y sin props de jardín (macetero, regadera, banco). Casi toda
  infantería, 117 HP enemigos en total, 3 tanques.
- **Misión 2, El picnic** — A (-30, -80), B (85, 175), C (240, 40).
  El mantel del picnic: banco, macetero y regadera juntos junto a la
  ruta B→C, como mesa y comida del picnic; relieve más suave y
  menos rocas. Más blindados que la 1 (132 HP, 6 tanques) y un
  helicóptero enemigo patrullando, como los insectos del picnic.
- **Misión 3, La playa** — A (60, -40), B (-180, 120), C (120, 220).
  Arena abierta y llana, pocos pinos, muchas rocas (castillos de
  arena) junto a C y dos helicópteros enemigos (libélulas) sobre la
  playa. La más dura: 156 HP, 9 tanques.

## Qué es recreación y qué es adaptación

No hay un plano exacto público de los mapas del original para
copiarlos 1:1, y sus tres primeras misiones tenían otros objetivos
(«Plastic Pandemonium»: recoger suministros de plástico y volar por
un portal; «Going Car-razy»: parar 15 coches y destruir garajes;
«The Train That Could»: devolver una batería a un tren y
escoltarlo). Lo que se recrea fielmente en espíritu es el escenario
de cada misión —su ambiente, sus puntos y su dificultad— dentro del
sistema de rescate A → B → C de este juego, con assets propios: no
se copia arte, música ni texto del original. El nombre y la semilla
de cada mapa se muestran en el HUD con `?perf=1` («Pandemonio de Plástico ·
semilla 101») y en el registro de errores, para reportarlo.

## Corrección: la Misión 1 es alpina, no un jardín

La Misión 1 del original es «Plastic Pandemonium»: el informe
(«Green Intelligence reports… the Tan Army is closing in on our
secret Alpine base») la sitúa en una base secreta alpina del mundo
de plástico, y las guías reconstruyen su ruta —base verde de salida,
puesto de suministros atacado por 2 tanques Tan, desvío a la derecha
junto a las montañas y portal al final— sin casa, valla, macetero,
regadera ni banco, que son de otras misiones. El mapa anterior («El
jardín») era un error de ambientación, no del original. La recreación
sigue sin plano público exacto: el trazado es una reconstrucción de
las guías (GameFAQs, General Eric) y del gameplay (Jack's Arcade
Vault, PS1, 3:34–6:55); las dimensiones exactas y la posición de
cada pino y roca no se pudieron verificar. Solo cambia el mapa: las
reglas A → B → C, los enemigos (117 HP, 3 tanques) y la dificultad
son los de antes, y el portal es solo decoración —la entrega sigue
siendo en C, no hay mecánica nueva de portal ni de suministros.

## Cómo está construido cada mapa

- **Trazado fijo, escrito a mano:** A, B y C, las rutas A→B y B→C
  (con sus puntos intermedios), los enemigos (base, patrullas y
  aire extra por misión) y los puntos de interés están en `SPECS`,
  en `src/original-maps.js`.
- **Terreno ancho, no solo el camino:** el patio mide 960 × 960 u
  (límite 480, 1,5x el anterior de 640 × 640 u y 2,25x de área).
  A, B y C no se mueven —la misión dura lo mismo—; lo que crece es
  el terreno alrededor, con más sitio para maniobrar con el
  helicóptero y para el pelotón. La vegetación escala con el área
  (2,25x) para mantener la densidad y no dejar zonas vacías. No se
  llega a 640 de límite (2x) a propósito: la malla del terreno crece
  con el cuadrado del límite y a 640 serían ~3,7 millones de valores
  (~15 MB) en cada carga de misión; a 480 son ~2,1 millones (~8 MB).
- **Camino ancho, como en el original:** el camino de tierra mide
  30 u en total (medio ancho 15 u, 3x el anterior de 10 u), en los
  3 mapas. La única fuente de verdad es `ToyWorld.roadHalfWidth`
  (`src/toy-world.js`); el terreno es llano bajo el camino y 10 u
  más de arcén a cada lado, la vegetación queda a 28 u de la ruta y
  las patrullas flanquean a ±19 u, fuera del camino. Los enemigos
  que guardan la ruta siguen sobre ella, como un bloqueo.
- **Vegetación determinista:** arbustos y rocas se rellenan con un
  RNG de semilla fija por misión (mulberry32, sin `Math.random`),
  fuera de helipuertos y rutas; el mapa resultante es idéntico en
  cada partida.
- **Dificultad creciente:** la vida enemiga total es 117, 132 y 156
  HP en las misiones 1, 2 y 3, y los tanques 3, 6 y 9. Los objetivos
  A → B → C, quién debe recogerse y la entrega en C no cambian;
  tampoco el balance de armas.

## Jugabilidad garantizada

`validate(map)` comprueba por geometría: A, B y C dentro del patio
y separados entre sí, rutas conectadas y sin tramos imposibles
(5–95 u por tramo, sin retrocesos), enemigos fuera del radio seguro
de A y de los perímetros de B y C, vegetación fuera de las rutas e
identificadores únicos. La validación completa con terreno y escolta
(la ruta es transitable y el pelotón llega a C) vive en
`tests/original-maps.test.cjs` y `tests/mission-map.test.cjs`.
