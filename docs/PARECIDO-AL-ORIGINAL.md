# Más parecido al original (3/3): misiones 2 y 3 fieles al original

Parte 3 de 3 para acercar el juego al Army Men: Air Attack original
(PS1, 1999). Las partes 1 (brújula, explosiones y tanques Tan) y 2
(defensas, winch y reglas de la Misión 1) están más abajo en este
mismo documento. **Esta parte rehace los mapas 2 y 3 con sus reglas
del original**; la Misión 1 solo cambia en un detalle de coherencia
(el portal dibujado, ver abajo). Todo recreado con el código del
juego; ningún asset del video ni del original se copia.

Referencias: briefings de las misiones 2 y 3 en
`workspace/research_notes/army-men-air-attack-first-map-20261107-0130/report.md`
y la guía de Vettz en GameFAQs («Going Car-razy»: destruir los
garajes Tan antes de que 15 coches lleven los suministros por el
portal; «The Train That Could»: destruir el helicóptero Tan, devolver
la batería al tren, escoltar el tren a la base verde y salir por el
portal).

## Misión 2 «Locura de coches» (Going Car-razy)

**Mapa**: el picnic desaparece (sin mesa, sin macetero ni regadera).
El mapa es un circuito de carretera A → B → C → A: las rutas A→B y
B→C no se tocan y la vuelta C→A cierra el anillo por el sur. Tres
garajes Tan junto al circuito (este, norte y oeste), cada uno a 20 u
del camino —en llano, fuera de la ruta y fuera del perímetro de B—,
con la puerta hacia el vértice del circuito al que se incorporan sus
coches. El portal de los coches está 25 u al sur del circuito, en
llano. Puntos de interés: dos torres verdes de guardia y el portal.
Sin valla ni casa: el circuito no tiene jardín que vallar.

**Reglas** (fieles al original, con el rescate como primera mitad,
como en la Misión 1):

1. **Rescate como siempre**: A → B, despejar B, embarcar a los 3
   heridos, escoltar al pelotón hasta C y entregarlos en C. Los
   coches empiezan a salir desde el principio de la misión.
2. **Cada garaje vivo suelta un coche de suministros cada 20 s**
   (la primera salida, escalonada: este a los 0 s, norte a los 7 s,
   oeste a los 14 s). Los coches avanzan por el circuito a 10 u/s
   hacia el portal, sin disparar; al llegar, desaparecen sin
   explosión ni puntos. Los coches no cuentan como amenaza: no
   bloquean el embarque de heridos.
3. **Si pasan 15 coches por el portal (como en el original), la
   misión fracasa.** El contador está en el HUD en todas las fases
   («Garajes a/3 · Coches n/15»).
4. **Tras la entrega en C, si queda algún garaje, la misión pasa a
   la fase nueva `GARAJES`** («Destruye los garajes Tan», brújula al
   garaje vivo más cercano); al destruir el último, la misión se
   completa con las estrellas del rescate. Si los garajes ya están
   destruidos al entregar, la misión cierra en C como siempre.

**Ajuste documentado (15 coches)**: el límite es el del original
(15), no un número adaptado. El motor lo aguanta: los coches son
vehículos simples (un punto por waypoint, sin A* ni disparos) y solo
hay uno por garaje cada 20 s. La tensión viene del tiempo: sin
destruir ningún garaje ni disparar a ningún coche, el 15.º pasa por
el portal a los ~135 s (el garaje-este deja a sus coches a 16 s del
portal; el oeste, a 64 s). Destruyendo los garajes progresivamente en
los primeros ~90 s, pasan unos 8 coches. Los coches azules del
original (el bucle de coches azules de la guía) no se recrean: son
decoración del original, no parte del objetivo.

## Misión 3 «El tren que pudo» (The Train That Could)

**Mapa**: la playa desaparece (sin castillos de arena ni cangrejos).
Las vías cruzan el mapa de oeste a este, 8 u al sur del camino, desde
la base del tren (al oeste de B) hasta C. La plataforma de energía
está detrás del tren. El helicóptero Tan que robó la batería vuela
junto a la ruta a B. El portal de salida está pasado C, 25 u en la
dirección del camino. Puntos de interés: dos torres verdes de guardia
y el portal. Sin valla ni casa.

**Reglas** (fieles al original, con el rescate como primera mitad):

1. **Rescate como siempre**, con el helicóptero Tan abatible en ruta
   a B.
2. **Al morir el helicóptero Tan, la batería cae donde muere** (el
   juego la acerca a un punto volable si cae sobre el camino o un
   obstáculo). Se levanta con el winch como la caja de la Misión 1
   (quieto 1,5 s sobre ella, a menos de 8 u), en cualquier fase, y
   vale 50 puntos como un rescate.
3. **La batería se entrega en la plataforma detrás del tren** (no en
   el portal): al dejarla, el tren arranca a 6 u/s —más lento que los
   soldados (7 u/s), para no adelantar al pelotón— y para en la base
   verde de C.
4. **Tras la entrega en C, la misión espera al tren en `ENTREGA_C`**
   (el HUD dice qué falta: «Batería en el helicóptero/caída/
   colgando/en el tren · Tren en la base/en camino/en C», y la
   brújula apunta a la batería, a la plataforma, al helicóptero o al
   tren según lo que falte). Cuando el tren llega a C, la misión pasa
   a la fase nueva `PORTAL` («Sal por el portal», brújula al portal);
   volar por el portal cierra la misión con las estrellas del rescate.

**Adaptaciones documentadas**:

- **El tren es invulnerable y ningún enemigo lo ataca**. En el
  original el tren avanza solo una vez con energía; aquí la escolta
  es proteger al pelotón y despejar las vías, y el tren no bloquea
  al pelotón porque la vía corre 8 u al sur del camino. Añadir vida
  al tren y que los enemigos lo atacaran sería una mecánica nueva (y
  un modo de fracasar nuevo) fuera del alcance de esta parte.
- **La batería cae donde muere el helicóptero** (como en el original,
  que la suelta al morir) y el juego la acerca al punto volable más
  cercano (anillos de 0 a 30 u) para que el winch siempre sea posible.

## El portal de la Misión 1 ya no se desplaza (205, 192)

`placeLandmark` movía el portal dibujado de la Misión 1 de (205,192)
a (217,192) porque pedía 35 u libres alrededor de C (pad 23 + portal
4 + 8) y el portal está a 25 u de C. El portal es un halo en el suelo,
no un obstáculo: ahora pide 24 u (radio 4 + 20) y queda donde dice el
mapa. El portal dibujado coincide con el funcional (205,192) y el de
la Misión 3 (145,224, también a 25 u de C) tampoco se mueve. Ningún
test afirmaba la posición vieja.

## Dificultad

La 1 sigue siendo la más fácil y la 3 la más dura: vida total 117 <
162 < 164 (Misión 2: 132 + 30 de los 3 garajes; Misión 3: 156 + 8 del
helicóptero Tan), tanques 3 < 6 < 9, helicópteros en el plan 1 < 2 < 4.
El guardado de puntuaciones y el menú no se tocan; la escolta sigue
llegando a C en las 3 misiones y el rendimiento no cambia (los coches
no usan A*, el tren es una posición sobre una polilínea, y los traces
siguen limitados).

## Pruebas

`tests/misiones-2-3.test.cjs` (18): mapa 2 (circuito, garajes con
ruta al portal, portal de coches, mundo sin valla ni casa), coches
(salidas escalonadas 0/7/14 s, ruta del garaje-este y del oeste,
contador y fracaso a los 15, garaje destruido que deja de soltar,
coches que no son amenaza), partida completa de la Misión 2 en el
juego real (garajes destruidos y rescate, y rescate primero con fase
`GARAJES` después), coches que avanzan por el circuito y desaparecen
en el portal sin puntos, mapa 3 (vías, tren, plataforma, helicóptero
Tan, portal, mundo con 112 piezas de vía), batería (caída del
helicóptero, winch, entrega en la plataforma, tren que arranca y
llega a C), partida completa de la Misión 3 en el juego real
(batería, tren y portal), dificultad creciente (117/162/164 HP,
3/6/9 tanques, 1/2/4 helicópteros), `positionAlong` y renderer
(garaje, coche, tren, vías, batería en el suelo y colgando). Las
partidas completas no exigen los 7 entregados: un soldado ya no
puede morir de atasco por escombros, porque al destruir un enemigo
no queda ningún resto en el suelo y el camino queda libre (antes
los restos le cerraban el camino y el A* se cortaba por presupuesto);
si un soldado cayera por otra causa, la misión sigue adelante con
los supervivientes (es el comportamiento del juego, no de esta parte);
lo que comprueban es que todos queden contabilizados (a salvo o
caídos) y que la fase avance. Los
tests de mapas, escolta, juego y HUD (`tests/original-maps.test.cjs`,
`tests/mission-map.test.cjs`, `tests/game.test.cjs`,
`tests/parecido-original.test.cjs`, `tests/defensas-winch-m1.test.cjs`,
`tests/alpine-mission1.test.cjs`, `tests/initial-air.test.cjs`,
`tests/safe-spawns.test.cjs`, `tests/terrain-width.test.cjs`) se
actualizan a los nombres, las reglas y las fases nuevas. `node
--test`: 228/228. `VERSION` sigue en `parecido-original-1` (misma
entrega).

## Sin verificar (sin navegador real ni iPhone en este entorno)

- Cómo se ven los garajes, los coches, el tren, la batería y las vías
  en un iPhone real en WebGL (los tests usan un WebGL simulado y
  miden posiciones y colores, no la imagen).
- Las partidas completas de las misiones 2 y 3 jugadas a mano en el
  navegador, con enemigos vivos durante la escolta.
- El portal de la Misión 1 en su sitio nuevo (205,192) visto en
  pantalla, y el portal de salida de la Misión 3 (145,224).

---

# Más parecido al original (2/3): defensas, winch y reglas de la Misión 1

Parte 2 de 3 para acercar el juego al Army Men: Air Attack original
(PS1, 1999). La parte 1 (brújula, explosiones y tanques Tan) está
abajo en este mismo documento; la parte 3 (mapas 2 y 3) está arriba.
**Esta parte sí toca las reglas, solo de la Misión 1**:
las misiones 2 y 3 siguen siendo A → B → C con rescate de heridos y
entrega en C. Todo recreado con el código del juego; ningún asset del
video ni del original se copia.

Referencia visual: video de 125,5 s con gameplay del original
(Misión 1, «Plastic Pandemonium») y la investigación en
`workspace/research_notes/army-men-air-attack-first-map-20261107-0130/report.md`
(briefing del original: «Find our Green base, pick up the plastic
supplies, and fly them through the portal»; defensas de la base verde
según la guía de Vettz en GameFAQs: 4 torres de guardia en la base de
salida y un puesto con 2 bazookas y 3 fusileros defendido de 2 tanques
Tan; el winch levanta objetos del mundo —cajas, piñas, manzanas— y el
portal es la salida de la misión).

## Decisión: cómo se integra la carga con el rescate (Misión 1)

El original es solo buscar la caja y llevarla por el portal; este
juego es un rescate A → B → C. La integración elegida mantiene el
rescate como primera mitad y la carga como cierre, sin alargar la
misión con un viaje de vuelta innecesario:

1. **Rescate como siempre**: A → B, despejar B, embarcar a los 3
   heridos, escoltar al pelotón hasta C y entregarlos en C.
2. **El winch se abre al salir de B**: en cuanto el pelotón empieza a
   marchar (`ESCOLTAR_BC`), la caja verde junto a B se puede levantar
   con el cable —el jugador ya está allí— y llevar colgando durante
   la escolta y la entrega en C. También se puede levantar después,
   en la fase final. Levantarla suma 50 puntos, como un rescate.
3. **El portal solo cierra tras la entrega en C**: cuando todos los
   supervivientes están a salvo en C, la misión pasa a la fase nueva
   `CARGA_PORTAL` en vez de completarse. Si la caja ya cuelga, la
   brújula apunta al portal; si no, apunta primero a la caja y luego
   al portal. Pasar por el portal con la caja cierra la misión (con
   las estrellas del rescate). Pasar sin la caja no hace nada.
4. **Sin la caja no hay victoria en C**: quedarse en C tras la entrega
   no completa la Misión 1; el HUD lo dice en cada paso («Caja en B
   por levantar», «Caja colgando», «Vuela hasta la caja de
   plástico», «Lleva la caja por el portal»).

Durante la escolta la brújula sigue apuntando a C, no a la caja: el
pelotón manda y la caja solo se recuerda en el mensaje y en el resumen
del HUD. La dificultad no sube: la Misión 1 sigue siendo la más fácil
(mismos 117 HP y 3 tanques), y el winch pide lo mismo que el embarque
de heridos —quedarse quieto 1,5 s sin disparar ni recibir daño— a
menos de 8 u de la caja.

## Defensas de la Misión 1 (`src/original-maps.js`, `src/toy-world.js`)

- **3 filas de sacos de arena** (5 sacos cada una, con segunda capa
  en sacos alternos): al sur del puesto B, antes de C y al este de A.
- **Valla de alambre al sur de A**: 13 postes de madera con 2 raíles
  de alambre por tramo, siguiendo la ladera (cada tramo va a la altura
  local de sus dos postes, no a una altura única).
- **2 tiendas verdes de campaña** del puesto (una al este de B, otra
  al oeste) y **2 cajas verdes de suministros** fijas (una junto a B
  y otra junto a A), además de la caja grande de la carga.
- **1 torre de vigilancia al este de B**, que se suma a las 4 de la
  base de salida (3 fijas + el punto de interés).
- **Cobertura real, no solo decoración**: las defensas van directas al
  patio (`world.yard`), que es lo que revisan las colisiones, así que
  paran balas enemigas y aliadas y bloquean el movimiento a la altura
  de un soldado; por encima de ellas (sacos ~1,9 u) los disparos
  pasan, como debe ser. La valla solo cubre en sus postes y raíles:
  entre raíles (a ~2,3 u) pasa la bala, como en una valla de verdad.
- **Sin bloquear nada**: cada huella está a ≥18 u de las rutas (el
  camino mide 15 u de medio ancho) y a ≥25 u de A/B/C, sin solapar a
  ningún enemigo; `validate()` lo comprueba y la vegetación también
  las esquiva. La ruta del pelotón sigue libre y la escolta llega a C.

## Winch de objetos (`src/escort-mission.js`, `src/toy-renderer.js`, `src/draw3d.js`, `src/game.js`)

- **La misma mecánica que el rescate, extendida a objetos**: el winch
  ya existía como embarque de heridos (quieto 1,5 s sobre el objetivo);
  ahora la Misión 1 tiene `cargo` (la caja en −170, 140) y `portal`
  (205, 192, radio 12). `mission.cargoView()` devuelve el estado
  (`waiting`/`carried`/`delivered`), la posición y el progreso del
  enganche (0–1) para el renderizador.
- **Cable y caja colgando**: `draw3d` pasa `cargo` al renderizador,
  que dibuja el cable oscuro bajo el helicóptero mientras engancha
  (vertical hasta el suelo) y, con la caja levantada, un cable corto
  (2,5 u) con la caja verde colgando bajo la panza. Cable corto a
  propósito: el helicóptero vuela a 8 u y una caja a 8,3 u rozaría el
  suelo; así queda a ~1,6 u del suelo en llano. La caja del suelo
  desaparece al levantarla: ya no va en el patio, la dibuja el
  renderizador desde `world.cargoCrate`.
- **El HUD genérico de la parte 1 no se toca** (`src/ui.js`,
  `src/compass.js`): el texto viene de `mission.config.name` —ahora el
  nombre del mapa fijo («Pandemonio de Plástico»)— + `mission.message`,
  el resumen de `mission.hudSummary()` (ahora con «Caja en
  tierra/colgando/entregada · Portal») y la marca de la brújula de
  `mission.target(jugador)`, que en `CARGA_PORTAL` apunta a la caja y
  luego al portal. La ayuda del menú explica la caja y el portal
  (punto 05).

## El portal tuvo que moverse (205, 192)

En su sitio anterior (225, 200) el suelo ya mide 13,5 u de altura y el
helicóptero no puede volar sobre terreno de más de 2 u (`canTravel`,
que también limita su movimiento): el punto llano más cercano quedaba
a 16 u, fuera del radio del portal (12). El portal nuevo está al final
del camino, pasado C, en suelo llano (0,13 u) con el camino desde C
transitable, a 25 u de C (su radio de 12 no se solapa con el de entrega
de 9). El orbe y la columna de luz no cambian; solo su posición y el
radio del punto de interés (4: el orbe es decoración plana; el radio
de disparo del portal vive en `rules.portal`). La caja está a 2 u del
suelo llano más cercano, dentro del radio del winch (8 u).

## Rendimiento

Sin cambios de fondo: las defensas son 86 piezas fijas más en el
patio (de 52 a 138; índice espacial de colisiones, como el resto del patio); el
cable y la caja colgando son 3 piezas; la brújula y el HUD no crean
nada por frame. La escolta sigue llegando a C en las 3 misiones (ver
pruebas) y no hay trazados nuevos por frame.

## Pruebas

`tests/defensas-winch-m1.test.cjs` (9): defensas presentes solo en la
Misión 1 con caja y portal, huellas fuera de rutas y helipuertos con
caja y portal alcanzables, defensas como cobertura real (balas paradas
a la altura del soldado y por encima no, ruta libre), winch bloqueado
antes de la escolta y abierto al salir de B, enganche que se reinicia
al moverse o disparar y portal que cierra con estrellas, transiciones
de la carga (sin carga no existe), partida completa en el juego real
(rescate + winch en B + escolta a C + portal, +50 puntos), Misión 1
sin victoria en C sin la caja (y portal sin caja que no cierra), y
renderer con la caja en el suelo, el cable al enganchar y la caja
colgando (por posición, no solo por color). Los tests que completaban
la Misión 1 (`tests/game.test.cjs`, `tests/escort-integration.test.cjs`,
`tests/freeze-regreso-a.test.cjs`, `tests/mission-map.test.cjs`,
`tests/original-maps.test.cjs`, `tests/parecido-original.test.cjs`) y el
de la caja en el patio (`tests/alpine-mission1.test.cjs`) se actualizan
a la fase de la carga. `node --test`: 210/210 en tres ejecuciones
seguidas. `VERSION` sigue en `parecido-original-1` (misma entrega).

## Sin verificar (sin navegador real ni iPhone en este entorno)

- Cómo se ven las defensas, el cable y la caja colgando en un iPhone
  real en WebGL (los tests usan un WebGL simulado y miden posiciones
  y colores, no la imagen).
- El aspecto en movimiento del winch (cable bajando, caja colgando
  bajo la panza) y del portal desde C.
- La partida completa de la Misión 1 jugada a mano en el navegador,
  con enemigos vivos durante la escolta con la caja colgando.

---

# Más parecido al original (1/3): brújula, explosiones y tanques Tan

Parte 1 de 3 para acercar el juego al Army Men: Air Attack original
(PS1, 1999). Las partes 2 (defensas/winch) y 3 (mapas 2 y 3) están
arriba en este mismo documento. **Las reglas no cambian en esta parte**: las
misiones siguen siendo A → B → C con rescate de heridos y entrega en
C. Lo que cambia es el HUD, las explosiones y el aspecto de los
tanques Tan. Todo recreado con el código del juego; ningún asset del
video ni del original se copia.

Referencia visual: video de 125,5 s con gameplay del original
(Misión 1, «Plastic Pandemonium») y la investigación en
`workspace/research_notes/army-men-air-attack-first-map-20261107-0130/report.md`
(HUD del manual de PS1: brújula con marcas moradas de objetivo,
contador de munición, barra de salud; explosiones naranja/rosa/
moradas exageradas; tanques Tan amarillos frente a unidades verdes).

## Brújula y HUD (`src/compass.js`, `src/ui.js`, `index.html`, `styles.css`)

- **Brújula abajo en el centro**, como en el video: tira con los 8
  puntos (N, NE, E, SE, S, SW, W, NW) que se desplaza con el rumbo
  del helicóptero; el rumbo actual queda resaltado en amarillo en el
  centro y una marca morada ◆ señala la dirección del objetivo. La
  flecha amarilla ▲ de antes queda integrada como aguja central de
  la tira, no se pierde.
- **Rumbo**: `yaw` 0° = N, 90° = E, 180° = S, 270° = W
  (`ToyCompass.headingDeg` / `headingLabel`). La tira muestra una
  ventana de ±90° alrededor del rumbo; la marca del objetivo se
  esconde cuando el objetivo queda por detrás, en vez de saltar al
  otro extremo.
- **Munición a la izquierda**: número grande amarillo con los
  misiles (`P.mi`, el arma secundaria; la ametralladora no gasta
  munición). En vacío se pone rojo. El botón «Misil» sigue
  mostrando el mismo número.
- **Salud amarilla a la derecha**: la barra `#arm` (`P.arm`, 10)
  pasa de arriba a la izquierda a arriba a la derecha, bajo el modo
  de render; en horizontal vuelve arriba a la izquierda para no
  chocar con el botón de sonido.
- **Sin tapar los botones**: la brújula va por encima de
  Fuego/Misil (a 132 px del borde inferior en vertical, 104 px en
  horizontal) y la munición por encima del botón de gráficos. La
  tira mide como mucho 200 px de ancho (46 vw en pantallas
  estrechas).

## HUD genérico: preparado para los objetivos nuevos (partes 2 y 3)

El HUD no sabe nada de «rescatar heridos»: todo el contenido de
objetivos viene del estado de la misión, así que las partes 2 y 3
enchufan ahí sus objetivos sin tocar `ui.js` ni `compass.js`:

| Pieza del HUD | Origen (estado de la misión) |
| --- | --- |
| Texto de objetivo (`#objective`) | `mission.config.name` + `mission.message` |
| Marca morada de la brújula | `mission.target(jugador)` → rumbo con `ToyCompass.bearingDeg` |
| Resumen de estado (`#inf`) | `mission.hudSummary()` (nuevo en `src/escort-mission.js`) |

Hoy `hudSummary()` devuelve el resumen de rescate
(«Heridos x/y · A salvo x/y · Caídos n · Enemigos n», sin el prefijo
«Misión n/3 ·», que ya va en el título del panel) y `target()`
apunta a B o a C (o al herido más cercano al embarcar). Cuando una
misión cambie de objetivo, basta con que esa misión redefina
`message`, `target()` y `hudSummary()`:

- **Misión 1 «Plastic Pandemonium»**: `message` = buscar la base
  verde / levantar la caja / llevarla por el portal; `target()` = el
  puesto del plástico (B) y luego el portal (C); `hudSummary()` con
  el estado de la caja y el portal.
- **Misión 2 «Going Car-razy»**: `target()` = garajes Tan y luego
  el portal; `hudSummary()` con garajes destruidos y coches
  interceptados (de 15).
- **Misión 3 «The Train That Could»**: `target()` = helicóptero
  Tan, batería, tren y portal según la fase; `hudSummary()` con el
  estado de la batería y el tren.

`ToyCompass` es un módulo puro (sin DOM) con sus propias pruebas;
`ui.js` solo coloca las etiquetas que le devuelve `strip()`.

## Explosiones (`src/combat.js`, `src/toy-renderer.js`)

- Antes, morir un enemigo solo dejaba escombros y el impacto de un
  misil solo una bocanada oscura: `boom()` (FX) existía pero nadie
  la llamaba. Ahora **cada baja explota** (por bala, por misil o por
  `kill`) y **cada impacto de misil** deja su bola de fuego además
  del humo oscuro.
- **Tamaño por tipo** (`Combat.EXPLOSION_SIZE`, solo visual):
  infantería 2,5, torreta 3,5, helicóptero 3,5, tanque 4, base 5,
  impacto de misil 3. Vida 0,55 s (`EXPLOSION_LIFE`).
- **Colores del original** (`ToyRenderer.EXPLOSION_COLORS`): la
  bola se encoge a la mitad y se apaga con alfa (antes crecía y era
  opaca, y en la grabación tapaba la pantalla), pasa de naranja a
  rosa y morado, con núcleo amarillo y humo gris al final. Cada
  explosión añade además 3 bocanadas de humo oscuro que suben
  (acotadas por `MAX_SMOKE`, 160, como el resto del humo).
- **Sin cambiar el daño ni el balance**: el misil sigue haciendo 6,
  la muerte de un enemigo no daña a nadie más, y la vida y el daño
  de cada tipo quedan intactos. Los tests que decían «sin bola de
  fuego» (`tests/projectiles.test.cjs`,
  `tests/sin-escombros.test.cjs`) se actualizan al comportamiento nuevo.

## Tanques Tan (`src/toy-renderer.js`)

- **Color propio**: amarillo vivo/tostado `[0.95, 0.76, 0.2]` con
  orugas marrón tostado oscuro `[0.45, 0.32, 0.12]`
  (`ToyRenderer.TAN_TANK`), distinto del verde del jugador
  `[0.22, 0.59, 0.13]` y del caqui de la infantería y las torretas
  Tan `[0.76, 0.61, 0.36]`. La torreta (`tur`) sigue de caqui: el
  amarillo es solo del tanque.
- **Silueta propia**: cañón más largo y grueso con bocacha oscura,
  cúpula del jefe con banda rojiza sobre la torreta y placa frontal
  oscura. Solo visual: el radio de colisión (`r = 3.5`), la vida
  (6 HP) y el daño no cambian.
- **Sin pecio**: el tanque destruido ya no deja restos en el suelo
  (como ningún enemigo): solo la explosión y el humo, que se apagan
  solos.

## Rendimiento

Sin cambios de fondo: por explosión hay 3 esferas de fuego (1 al
final) y 3 bocanadas de humo, acotadas por `MAX_SMOKE`; la brújula
reutiliza 8 etiquetas fijas en el DOM (no se crea nada por frame).
La escolta sigue llegando a C en las 3 misiones (ver pruebas).

## Pruebas

`tests/parecido-original.test.cjs` (13): rumbo y tira de la
brújula, rumbo al objetivo, HUD con munición/salud/brújula en el
juego real, HUD genérico con una misión ficticia (resumen y marca
distintos sin tocar `ui.js`), explosiones por tipo con humo y daño
sin cambiar, paleta y tamaño de la explosión en el renderer,
color/silueta del tanque Tan frente a la torreta, pecio amarillo
del tanque, presencia del HUD nuevo en HTML/CSS/bootstrap, y
escolta llegando a C en las 3 misiones. `node --test`: 201/201 en
tres ejecuciones seguidas. `VERSION` pasa a `parecido-original-1`.

## Sin verificar (sin navegador real ni iPhone en este entorno)

- Cómo se ve la brújula, la munición y la salud en un iPhone real
  (modo «3D · Plástico», «Gráficos: detalle»), en vertical y en
  horizontal, y que nada tape los botones Fuego/Misil al jugar.
- El aspecto en movimiento de las explosiones y de los tanques
  amarillos en WebGL real (los tests usan un WebGL simulado).
- La partida completa jugada a mano en el navegador.
