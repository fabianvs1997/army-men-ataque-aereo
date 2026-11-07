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
| 2 | Locura de coches | Road | 202 | «Going Car-razy», segunda misión del original: garajes Tan, coches de suministros y un portal |
| 3 | El tren que pudo | Rail | 303 | «The Train That Could», tercera misión del original: el tren Prego, la batería robada y el helicóptero Tan |

- **Misión 1, Pandemonio de Plástico** — A (0, 0), B (-150, 170), C (180, 190).
  Valle alpino del mundo de plástico, como el original: pasto verde,
  camino de tierra, pinos altos, montañas con cima nevada como borde
  (sobre todo a la derecha del camino, cerca del portal), base verde
  de salida con 4 torres de guardia, caja verde de suministros junto
  a B y portal brillante al final del camino, pasado C. Sin casa, sin
  valla y sin props de jardín (macetero, regadera, banco). Casi toda
  infantería, 117 HP enemigos en total, 3 tanques.
  - **Pulido (capturas de Fabian en iPhone):** el pasto es verde vivo
    y saturado con manchas de tierra y barro, roca en las laderas y
    nieve en lo alto; el camino alterna de tono y lleva una franja de
    desgaste; los pinos forman bosquetes altos (hasta ~21 u); las
    montañas varían en silueta y su nieve se ve; el portal tiene halo,
    orbe en 3 capas y columna de luz; las torres son esbeltas, con
    punta y bandera, a ~50 u de A; la caja de suministros es más
    grande y está al oeste de B.
  - **Terreno replicado del video (solo terreno):** 25 fotogramas del
    gameplay original de PS1 (1 cada 5 s) muestran el valle
    ondulado: el suelo sube y baja en todo el terreno jugable
    (colinas de 12–23 u a 40–150 u del camino), con manchas grandes
    de tierra color canela sobre las lomas y pasto moteado de verde
    claro/oscuro. Tres crestas rocosas grises cruzan el valle —norte
    (z ~300), este a la derecha del camino cerca del portal
    (x ~300) y oeste (x ~-370)—, con la cima nevada. El camino, los
    helipuertos y las patrullas siguen en llano; la escolta llega a
    C. Solo terreno: sacos, vallas, tiendas, cajas, HUD y sonidos
    quedan para después.
- **Misión 2, Locura de coches** — A (-30, -80), B (85, 175), C (240, 40).
  Circuito de carretera A → B → C → A: la vuelta C→A cierra el
  anillo por el sur. Tres garajes Tan (este, norte y oeste) junto al
  circuito, con la puerta hacia el vértice al que se incorporan sus
  coches; el portal de los coches está 25 u al sur del circuito.
  Sin mesa de picnic, sin macetero ni regadera. Más blindados que la
  1 (162 HP, 6 tanques, 3 garajes de 10 HP) y un helicóptero enemigo
  patrullando. Reglas del original: cada garaje suelta un coche de
  suministros cada 20 s (escalonados 0/7/14 s) que avanza por el
  circuito hasta el portal; si pasan 15 coches, la misión fracasa;
  tras la entrega en C, si queda algún garaje, hay que destruirlo
  para cerrar la misión.
- **Misión 3, El tren que pudo** — A (60, -40), B (-180, 120), C (120, 220).
  Vías de tren que cruzan el mapa de oeste a este, 8 u al sur del
  camino, desde la base del tren (al oeste de B) hasta C, con la
  plataforma de energía detrás del tren; el helicóptero Tan que robó
  la batería vuela junto a la ruta a B y el portal de salida está
  pasado C. Sin playa ni castillos de arena. La más dura: 164 HP,
  9 tanques y 4 helicópteros en el plan. Reglas del original: el
  helicóptero Tan deja caer la batería al morir, se lleva con el
  winch a la plataforma, el tren arranca y la misión se cierra
  saliendo por el portal tras su llegada a C.

## Qué es recreación y qué es adaptación

No hay un plano exacto público de los mapas del original para
copiarlos 1:1. Las tres primeras misiones tenían sus propios objetivos
(«Plastic Pandemonium»: recoger suministros de plástico y volar por
un portal; «Going Car-razy»: parar 15 coches y destruir garajes;
«The Train That Could»: devolver una batería a un tren y
escoltarlo). Lo que se recrea fielmente en espíritu es el escenario
de cada misión —su ambiente, sus puntos y su dificultad— y, desde la
parte 3, también sus objetivos, integrados tras el rescate A → B → C
de este juego (caja y portal en la 1, garajes y coches en la 2,
batería, tren y portal en la 3), con assets propios: no se copia arte,
música ni texto del original. El nombre y la semilla de cada mapa se
muestran en el HUD con `?perf=1` («Pandemonio de Plástico ·
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
son los de antes. El portal de la Misión 1 dejó de ser solo
decoración en la parte 2: la caja de plástico se lleva por el portal
(205, 192) tras la entrega en C para cerrar la misión
(`docs/PARECIDO-AL-ORIGINAL.md`).

## Cómo está construido cada mapa

- **Trazado fijo, escrito a mano:** A, B y C, las rutas A→B y B→C
  (con sus puntos intermedios), los enemigos (base, patrullas y
  aire extra por misión) y los puntos de interés están en `SPECS`,
  en `src/original-maps.js`. La Misión 2 añade la vuelta C→A que
  cierra el circuito, los 3 garajes (con su ruta de coches al portal)
  y el portal de los coches; la Misión 3 añade las vías del tren, la
  plataforma de la batería, el helicóptero Tan y el portal de salida.
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
- **Dificultad creciente:** la vida enemiga total es 117, 162 y 164
  HP en las misiones 1, 2 y 3, y los tanques 3, 6 y 9. Los objetivos
  A → B → C, quién debe recogerse y la entrega en C no cambian;
  tampoco el balance de armas. Cada misión añade su cierre del
  original tras la entrega en C (portal con la caja, garajes, tren
  y portal).

## Jugabilidad garantizada

`validate(map)` comprueba por geometría: A, B y C dentro del patio
y separados entre sí, rutas conectadas y sin tramos imposibles
(5–95 u por tramo, sin retrocesos), enemigos fuera del radio seguro
de A y de los perímetros de B y C, vegetación fuera de las rutas e
identificadores únicos. La validación completa con terreno y escolta
(la ruta es transitable y el pelotón llega a C) vive en
`tests/original-maps.test.cjs` y `tests/mission-map.test.cjs`.
