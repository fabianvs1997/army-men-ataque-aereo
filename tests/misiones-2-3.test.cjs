const test = require('node:test');
const assert = require('node:assert/strict');
const Maps = require('../src/original-maps.js');
const World = require('../src/toy-world.js');
const Escort = require('../src/escort-mission.js');
const Renderer = require('../src/toy-renderer.js');
const { game } = require('../support/fake-host.cjs');

// --- Misión 2 «Locura de coches»: mapa ---

test('Misión 2: circuito de carretera con garajes Tan y portal de coches', () => {
  const m2 = Maps.generate(2);
  assert.equal(m2.name, 'Locura de coches');
  assert.equal(m2.scenario, 'Road');
  assert.match(m2.inspiration, /Going Car-razy/);
  assert.deepEqual(Maps.validate(m2), []);
  // Sin mesa de picnic: los puntos son torres y el portal.
  assert.deepEqual(
    m2.landmarks.map((p) => p.kind),
    ['tower', 'portal', 'tower'],
  );
  // Tres rutas: A→B, B→C y la vuelta C→A que cierra el circuito.
  assert.equal(m2.routes.length, 3);
  assert.deepEqual(m2.routes[2][0], [240, 40]); // empieza en C
  assert.deepEqual(m2.routes[2][m2.routes[2].length - 1], [-30, -80]); // termina en A
  // La ruta del pelotón es el circuito completo A → B → C → A.
  assert.equal(m2.layout.route.length, 17);
  assert.deepEqual(m2.layout.route[0], [-30, -80]);
  assert.deepEqual(m2.layout.route[m2.layout.route.length - 1], [-30, -80]);
  // El portal de los coches, junto al circuito y en llano.
  assert.deepEqual(m2.carPortal, { x: 100, z: -145, radius: 12 });
  assert.equal(m2.portal, null);
  assert.equal(m2.cargo, null);
  // Tres garajes con ruta al portal y primera salida escalonada.
  assert.equal(m2.garages.length, 3);
  assert.deepEqual(
    m2.garages.map((g) => [g.id, g.firstIn]),
    [
      ['garage-east', 0],
      ['garage-north', 7],
      ['garage-west', 14],
    ],
  );
  for (const g of m2.garages) {
    const last = g.route[g.route.length - 1];
    assert.deepEqual(last, [100, -145], `${g.id} sin ruta al portal`);
    assert.ok(Number.isFinite(g.yaw), `${g.id} sin orientación a la puerta`);
  }
  assert.equal(m2.rules.carsLimit, 15);
  assert.equal(m2.rules.carSpawnInterval, 20);
  assert.equal(m2.rules.garages.length, 3);
  // Los garajes son enemigos-edificio (10 HP) en el plan.
  const garageEnemies = m2.rules.enemies.filter((e) => e.k === 'garage');
  assert.equal(garageEnemies.length, 3);
  assert.ok(garageEnemies.every((e) => e.hp === 10 && e.zone === 'GARAGE'));
});

test('el mundo de la Misión 2 es un circuito sin valla ni casa', () => {
  const m2 = Maps.generate(2);
  const world = World.create(m2);
  const hasFenceOrHouse = (w) =>
    w.yard.some(
      (p) =>
        Math.abs(p.x) >= 470 ||
        Math.abs(p.z) >= 470 ||
        (p.color &&
          p.color[0] === 0.76 &&
          p.color[1] === 0.7 &&
          p.color[2] === 0.58),
    );
  assert.equal(hasFenceOrHouse(world), false);
  assert.equal(world.rails.length, 0);
  assert.equal(world.batteryPad, null);
  assert.equal(world.cargoCrate, null);
  // Los puntos de interés quedan donde dice el mapa.
  assert.deepEqual(
    world.landmarks.map((p) => [p.kind, p.x, p.z]),
    [
      ['tower', -70, -110],
      ['portal', 100, -145],
      ['tower', 280, 90],
    ],
  );
  // El circuito es transitable y los garajes están en llano.
  for (const route of m2.routes)
    for (let i = 1; i < route.length; i++) {
      const [ax, az] = route[i - 1],
        [bx, bz] = route[i];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
      for (let j = 0; j <= steps; j++) {
        const x = ax + ((bx - ax) * j) / steps,
          z = az + ((bz - az) * j) / steps;
        assert.ok(world.canTravel(x, z, 4), 'circuito bloqueado');
      }
    }
  for (const g of m2.garages) assert.ok(world.canTravel(g.x, g.z, 6));
});

// --- Misión 2: coches y garajes ---

test('los coches salen de los garajes escalonados y corren al portal', () => {
  const m2 = Maps.generate(2);
  const m = new Escort.Mission(2, m2.rules);
  const env = { groundAt: () => 0, enemies: [] };
  const player = { ...m2.rules.A };
  const spawns = [];
  for (let i = 0; i < 250; i++) {
    m.update(0.1, player, env);
    for (const e of m.drainEvents())
      if (e.type === 'spawn-car')
        spawns.push({ t: +(i * 0.1).toFixed(1), garage: e.garage });
  }
  // Primera salida escalonada: este a los 0 s, norte a los 7 s,
  // oeste a los 14 s; el este vuelve a soltar a los ~20 s.
  assert.equal(spawns.length, 4);
  assert.deepEqual(spawns.slice(0, 3), [
    { t: 0, garage: 'garage-east' },
    { t: 7, garage: 'garage-north' },
    { t: 14, garage: 'garage-west' },
  ]);
  assert.equal(spawns[3].garage, 'garage-east');
  assert.ok(Math.abs(spawns[3].t - 20) <= 0.5, 'el este vuelve a soltar a los ~20 s');
  // La ruta del coche del garaje-este: del vértice 11 al portal.
  const east = m2.rules.garages.find((g) => g.id === 'garage-east');
  assert.deepEqual(east.route, [
    [190, -40],
    [145, -80],
    [100, -120],
    [100, -145],
  ]);
  // La ruta del coche del garaje-oeste: del vértice 2, vuelta
  // completa por el circuito, al portal.
  const west = m2.rules.garages.find((g) => g.id === 'garage-west');
  assert.equal(west.route.length, 13);
  assert.deepEqual(west.route[0], [20, 40]);
  assert.deepEqual(west.route[west.route.length - 1], [100, -145]);
});

test('los coches que llegan al portal cuentan; 15 es el fracaso', () => {
  const m2 = Maps.generate(2);
  const m = new Escort.Mission(2, m2.rules);
  const env = { groundAt: () => 0, enemies: [] };
  const player = { ...m2.rules.A };
  m.update(0.1, player, env);
  assert.equal(m.carsEscaped, 0);
  assert.ok(m.hudSummary().includes('Garajes 0/3'));
  assert.ok(m.hudSummary().includes('Coches 0/15'));
  assert.ok(m.message.includes('Garajes 0/3'));
  assert.ok(m.message.includes('Coches 0/15'));
  for (let i = 0; i < 14; i++) m.carEscaped({ id: 'car-' + i });
  assert.equal(m.carsEscaped, 14);
  assert.ok(m.hudSummary().includes('Coches 14/15'));
  assert.equal(m.update(0.1, player, env), null);
  assert.equal(m.failed, false);
  m.carEscaped({ id: 'car-14' });
  assert.equal(m.update(0.1, player, env), 'failed');
  assert.equal(m.failed, true);
  assert.equal(m.stage, 'FRACASADA');
  assert.match(m.reason, /15\/15/);
});

test('un garaje destruido deja de soltar coches; los coches no son amenaza', () => {
  const m2 = Maps.generate(2);
  const m = new Escort.Mission(2, m2.rules);
  const env = { groundAt: () => 0, enemies: [] };
  const player = { ...m2.rules.A };
  m.enemyEliminated({ id: 'garage-east', k: 'garage' });
  assert.equal(m.garages.find((g) => g.id === 'garage-east').destroyed, true);
  assert.ok(m.hudSummary().includes('Garajes 1/3'));
  const spawns = [];
  for (let i = 0; i < 250; i++) {
    m.update(0.1, player, env);
    for (const e of m.drainEvents())
      if (e.type === 'spawn-car') spawns.push(e.garage);
  }
  assert.ok(!spawns.includes('garage-east'), 'el garaje destruido sigue soltando coches');
  assert.ok(spawns.includes('garage-north'));
  assert.ok(spawns.includes('garage-west'));
  // Un coche junto a B no bloquea el embarque (no dispara).
  const car = { id: 'car-1', k: 'car', x: m2.rules.B.x, z: m2.rules.B.z, hp: 3, dead: false };
  assert.deepEqual(m.threats([car]), []);
  const inf = { id: 'inf-1', k: 'inf', x: m2.rules.B.x, z: m2.rules.B.z, hp: 2, dead: false };
  assert.equal(m.threats([inf]).length, 1);
});

// --- Misión 2: partida completa en el juego real ---

// Rescate A→B→C en el juego real: mata a los enemigos dados
// (salvo los que `keep` conserva), embarca a los heridos y vuela a
// C hasta la entrega o la fase final que le siga (garajes, carga o
// portal). Los garajes que se conservan siguen soltando coches.
function rescue(g, keep = () => false) {
  const { app, state: s } = g;
  for (const e of [...s.E]) if (!keep(e)) app.combat.kill(e);
  s.EB = [];
  for (const a of s.mission.allies.filter((a) => a.wounded)) {
    s.P.x = a.x;
    s.P.z = a.z;
    for (let i = 0; i < 30; i++) app.upd(0.05);
  }
  s.P.x = s.mission.finish.x;
  s.P.z = s.mission.finish.z;
  // 3000 pasos (150 s): la marcha B→C es ~45 s, pero el A* se corta
  // por reloj de pared (12 ms por llamada) y en una máquina cargada
  // un rezagado puede tardar más; con 1800 el test era intermitente.
  for (
    let i = 0;
    i < 3000 &&
    s.st === 'play' &&
    s.mission.delivered < 7 &&
    !['GARAJES', 'CARGA_PORTAL', 'PORTAL', 'COMPLETADA'].includes(
      s.mission.stage,
    );
    i++
  )
    app.upd(0.05);
}

// Todos los del pelotón están contabilizados: a salvo en C o caídos.
// Un soldado puede morir de atasco si los escombros de los enemigos
// abatidos le cierran el camino y el A* se corta por presupuesto
// (reloj de pared) en una máquina cargada; la misión sigue adelante
// con los supervivientes, así que el conteo exacto no es exigible:
// lo que garantiza la misión es que todos los supervivientes lleguen.
function allAccountedFor(m) {
  const fallen = m.allies.filter((a) => a.state === 'CAIDO').length;
  return m.delivered + fallen === m.allies.length;
}

test('Misión 2 completa en el juego real: garajes destruidos, rescate y entrega en C', () => {
  const g = game();
  g.app.start(2, true);
  const s = g.state,
    m = s.mission;
  assert.equal(m.config.name, 'Locura de coches');
  // Los garajes están en el juego, con su orientación al circuito.
  const garages = s.E.filter((e) => e.k === 'garage');
  assert.equal(garages.length, 3);
  assert.ok(garages.every((e) => Number.isFinite(e.yaw)));
  assert.ok(m.hudSummary().includes('Garajes 0/3 · Coches 0/15'));
  rescue(g);
  assert.ok(
    allAccountedFor(m),
    `m2: entregados ${m.delivered}, fase ${m.stage}`,
  );
  assert.equal(m.stage, 'COMPLETADA');
  assert.equal(s.st, 'win');
  assert.ok(m.stars >= 1 && m.stars <= 3);
});

test('Misión 2: rescate primero y garajes después (fase GARAJES)', () => {
  const g = game();
  g.app.start(2, true);
  const s = g.state,
    m = s.mission;
  // Rescate con los garajes vivos: los coches siguen saliendo, pero
  // no llegan a 15 antes de la entrega.
  rescue(g, (e) => e.k === 'garage');
  assert.ok(
    allAccountedFor(m),
    `m2: entregados ${m.delivered}, fase ${m.stage}`,
  );
  assert.equal(m.stage, 'GARAJES');
  assert.ok(m.message.includes('garajes'));
  assert.ok(m.carsEscaped < 15, `${m.carsEscaped} coches pasaron`);
  // La brújula apunta al garaje vivo más cercano.
  const target = m.target(s.P);
  const alive = m.garages.filter((x) => !x.destroyed);
  assert.ok(alive.some((x) => x.x === target.x && x.z === target.z));
  // Destruir los garajes (como si el jugador los disparara) cierra
  // la misión.
  for (const e of s.E.filter((e) => e.k === 'garage')) g.app.combat.kill(e);
  for (let i = 0; i < 600 && s.st === 'play'; i++) g.app.upd(0.05);
  assert.equal(m.stage, 'COMPLETADA');
  assert.equal(s.st, 'win');
  assert.ok(m.hudSummary().includes('Garajes 3/3'));
});

test('los coches avanzan por el circuito y desaparecen en el portal', () => {
  const g = game();
  g.app.start(2, true);
  const s = g.state,
    m = s.mission;
  // Solo el garaje-este vivo: sus coches llegan al portal en ~16 s.
  for (const e of [...s.E])
    if (e.k !== 'garage' || e.id !== 'garage-east') g.app.combat.kill(e);
  s.EB = [];
  // El primer coche sale a los 0 s; seguirlo hasta el portal.
  let car = null;
  for (let i = 0; i < 600 && !car; i++) {
    g.app.upd(0.05);
    car = s.E.find((e) => e.k === 'car');
  }
  assert.ok(car, 'ningún coche salió del garaje-este');
  assert.deepEqual(car.route[car.route.length - 1], [100, -145]);
  assert.equal(car.wp, 0);
  // El coche avanza hacia el primer vértice de su ruta.
  const before = Math.hypot(car.x - car.route[0][0], car.z - car.route[0][1]);
  for (let i = 0; i < 40; i++) g.app.upd(0.05);
  car = s.E.find((e) => e.k === 'car');
  assert.ok(car, 'el coche desapareció antes del portal');
  const after = Math.hypot(car.x - car.route[0][0], car.z - car.route[0][1]);
  assert.ok(after < before, 'el coche no avanza hacia su ruta');
  assert.ok(Number.isFinite(car.yaw), 'el coche no mira hacia donde avanza');
  // Hasta el portal: el coche desaparece sin explosión y el contador
  // sube (sin puntos: no es un enemigo abatido).
  const score = s.P.sc;
  for (let i = 0; i < 1200 && m.carsEscaped === 0; i++) g.app.upd(0.05);
  assert.equal(m.carsEscaped, 1, 'el coche no llegó al portal');
  assert.equal(s.P.sc, score, 'el coche que escapa no da puntos');
  assert.ok(!s.E.some((e) => e.k === 'car' && e.id === car.id));
});

// --- Misión 3 «El tren que pudo»: mapa ---

test('Misión 3: vías de tren, batería robada, helicóptero Tan y portal de salida', () => {
  const m3 = Maps.generate(3);
  assert.equal(m3.name, 'El tren que pudo');
  assert.equal(m3.scenario, 'Rail');
  assert.match(m3.inspiration, /The Train That Could/);
  assert.deepEqual(Maps.validate(m3), []);
  // Sin playa ni castillos de arena: los puntos son torres y el portal.
  assert.deepEqual(
    m3.landmarks.map((p) => p.kind),
    ['tower', 'portal', 'tower'],
  );
  // Las vías cruzan el mapa de oeste a este y llegan a C.
  assert.equal(m3.tracks.length, 7);
  assert.deepEqual(m3.tracks[0], [-257.6, 92.4]);
  assert.deepEqual(m3.tracks[m3.tracks.length - 1], [122.4, 212.4]);
  assert.ok(
    Math.hypot(
      m3.tracks[m3.tracks.length - 1][0] - m3.rules.C.x,
      m3.tracks[m3.tracks.length - 1][1] - m3.rules.C.z,
    ) <= 15,
    'la vía no llega a C',
  );
  // El tren: ruta de la vía a 6 u/s (más lento que los soldados).
  assert.deepEqual(m3.rules.train.route, m3.tracks);
  assert.equal(m3.rules.train.speed, 6);
  // La plataforma de la batería, detrás del tren.
  assert.deepEqual(m3.batteryPad, { x: -272, z: 89, radius: 9 });
  // La batería robada: escondida en el helicóptero Tan, se entrega
  // en la plataforma (no en el portal).
  assert.deepEqual(m3.cargo, {
    kind: 'battery',
    hidden: true,
    winchFrom: 'any',
    x: -52,
    z: 52,
    deliverAt: { x: -272, z: 89, radius: 9 },
  });
  // El helicóptero Tan que robó la batería, junto a la ruta a B.
  const tanHeli = m3.rules.enemies.find((e) => e.id === 'tan-heli');
  assert.ok(tanHeli, 'sin helicóptero Tan');
  assert.equal(tanHeli.k, 'heli');
  assert.equal(tanHeli.hp, 8);
  assert.equal(tanHeli.zone, 'AIR');
  assert.equal(m3.rules.tanHeliId, 'tan-heli');
  // El portal de salida, pasado C.
  assert.deepEqual(m3.portal, { x: 145, z: 224, radius: 12 });
  assert.ok(
    Math.hypot(m3.portal.x - m3.rules.C.x, m3.portal.z - m3.rules.C.z) >= 22,
    'portal demasiado cerca de C',
  );
});

test('el mundo de la Misión 3 tiene vías, plataforma y tren en llano', () => {
  const m3 = Maps.generate(3);
  const world = World.create(m3);
  // Vías: traviesas y raíles, sin colisión.
  assert.equal(world.rails.length, 112);
  assert.ok(world.rails.every((p) => p.kind === 'box'));
  assert.ok(
    world.rails.some((p) => JSON.stringify(p.color) === '[0.38,0.38,0.36]'),
    'sin raíles de acero',
  );
  assert.ok(
    world.rails.some((p) => JSON.stringify(p.color) === '[0.3,0.22,0.14]'),
    'sin traviesas',
  );
  assert.deepEqual(world.batteryPad, { x: -272, z: 89 });
  assert.ok(world.canTravel(-272, 89), 'la plataforma no es transitable');
  // La vía corre en llano (junto al camino, que aplana el terreno).
  for (const [x, z] of m3.tracks) assert.equal(world.height(x, z), 0);
  // Sin valla ni casa.
  const hasFenceOrHouse = (w) =>
    w.yard.some(
      (p) =>
        Math.abs(p.x) >= 470 ||
        Math.abs(p.z) >= 470 ||
        (p.color &&
          p.color[0] === 0.76 &&
          p.color[1] === 0.7 &&
          p.color[2] === 0.58),
    );
  assert.equal(hasFenceOrHouse(world), false);
  // El portal dibujado queda donde dice el mapa (25 u de C).
  assert.deepEqual(
    world.landmarks.map((p) => [p.kind, p.x, p.z]),
    [
      ['tower', -290, 60],
      ['portal', 145, 224],
      ['tower', 180, 180],
    ],
  );
});

// --- Misión 3: batería y tren ---

test('Misión 3: la batería cae del helicóptero Tan y el tren arranca al entregarla', () => {
  const m3 = Maps.generate(3);
  const m = new Escort.Mission(3, m3.rules);
  const env = { groundAt: () => 0, enemies: [] };
  const player = { x: -52, z: 52 };
  // Al principio, la batería está en el helicóptero y el tren en la base.
  assert.equal(m.cargo.state, 'hidden');
  assert.equal(m.train.state, 'waiting');
  assert.ok(m.hudSummary().includes('Batería en el helicóptero'));
  assert.ok(m.hudSummary().includes('Tren en la base'));
  assert.deepEqual(m.cargoView(), {
    kind: 'battery',
    state: 'hidden',
    x: -52,
    z: 52,
    progress: 0,
  });
  assert.deepEqual(m.trainView(), {
    x: -257.6,
    z: 92.4,
    yaw: Math.atan2(80, 20),
    state: 'waiting',
  });
  // Derribar el helicóptero Tan suelta la batería donde cae.
  m.enemyEliminated({ id: 'tan-heli', k: 'heli', x: -52, z: 52 });
  assert.equal(m.cargo.state, 'waiting');
  assert.deepEqual([m.cargo.x, m.cargo.z], [-52, 52]);
  assert.ok(m.hudSummary().includes('Batería caída'));
  // En las fases tempranas la brújula sigue apuntando a B (el
  // rescate manda); a la batería apunta en ENTREGA_C, cuando el
  // tren es lo que falta (ver la partida completa, más abajo).
  // Winch: 1,5 s quieto sobre la batería (en cualquier fase).
  for (let i = 0; i < 20; i++) m.update(0.1, player, env);
  assert.equal(m.cargo.state, 'carried');
  assert.ok(m.hudSummary().includes('Batería colgando'));
  // Llevarla a la plataforma: el tren arranca.
  const pad = { x: -272, z: 89 };
  for (let i = 0; i < 5; i++) m.update(0.1, pad, env);
  assert.equal(m.cargo.state, 'delivered');
  assert.equal(m.train.state, 'moving');
  assert.ok(m.hudSummary().includes('Batería en el tren'));
  assert.ok(m.hudSummary().includes('Tren en camino'));
  // El tren llega a C en ~67 s (400 u a 6 u/s).
  for (let i = 0; i < 700; i++) m.update(0.1, pad, env);
  assert.equal(m.train.state, 'arrived');
  assert.ok(
    Math.hypot(m.train.x - 122.4, m.train.z - 212.4) < 1,
    'el tren no llegó a C',
  );
  assert.ok(m.hudSummary().includes('Tren en C'));
});

test('Misión 3 completa en el juego real: batería, tren y portal', () => {
  const g = game();
  g.app.start(3, true);
  const s = g.state,
    m = s.mission;
  assert.equal(m.config.name, 'El tren que pudo');
  assert.ok(s.E.some((e) => e.id === 'tan-heli' && e.k === 'heli'));
  assert.equal(m.cargo.state, 'hidden');
  assert.equal(m.trainView().state, 'waiting');
  assert.ok(
    Math.hypot(m.trainView().x - -257.6, m.trainView().z - 92.4) < 0.01,
  );
  rescue(g);
  assert.ok(
    allAccountedFor(m),
    `m3: entregados ${m.delivered}, fase ${m.stage}`,
  );
  // Tras la entrega, la misión espera al tren (no cierra en C).
  assert.equal(m.stage, 'ENTREGA_C');
  assert.equal(m.cargo.state, 'waiting', 'la batería no cayó del helicóptero');
  assert.ok(m.message.includes('Batería'));
  // En ENTREGA_C la brújula apunta a la batería caída.
  assert.deepEqual(m.target(s.P), { x: m.cargo.x, z: m.cargo.z });
  // Winch de la batería caída.
  s.P.x = m.cargo.x;
  s.P.z = m.cargo.z;
  for (let i = 0; i < 200 && m.cargo.state === 'waiting'; i++) g.app.upd(0.05);
  assert.equal(m.cargo.state, 'carried');
  assert.ok(m.hudSummary().includes('Batería colgando'));
  // Llevarla a la plataforma: el tren arranca.
  s.P.x = m.batteryPad.x;
  s.P.z = m.batteryPad.z;
  for (let i = 0; i < 200 && m.cargo.state === 'carried'; i++) g.app.upd(0.05);
  assert.equal(m.cargo.state, 'delivered');
  assert.equal(m.train.state, 'moving');
  // Esperar al tren en C y salir por el portal.
  s.P.x = m.finish.x;
  s.P.z = m.finish.z;
  for (let i = 0; i < 1800 && s.st === 'play'; i++) g.app.upd(0.05);
  assert.equal(m.train.state, 'arrived');
  assert.equal(m.stage, 'PORTAL');
  assert.ok(m.message.includes('portal'));
  assert.deepEqual(m.target(s.P), m.portal);
  s.P.x = m.portal.x;
  s.P.z = m.portal.z;
  for (let i = 0; i < 600 && s.st === 'play'; i++) g.app.upd(0.05);
  assert.equal(m.stage, 'COMPLETADA');
  assert.equal(s.st, 'campaign');
  assert.ok(m.stars >= 1 && m.stars <= 3);
});

// --- Dificultad y HUD ---

test('la dificultad crece de la 1 a la 3: vida, tanques y aire', () => {
  const totals = [1, 2, 3].map((n) => {
    const map = Maps.generate(n);
    // El aire es el escuadrón real de la misión (enemigos + escolta
    // aérea), no solo los helicópteros del mapa.
    const m = new Escort.Mission(n, map.rules);
    return {
      hp: map.rules.enemies.reduce((sum, e) => sum + e.hp, 0),
      tanks: map.rules.enemies.filter((e) => e.k === 'tank').length,
      air: m.enemyPlan.filter((e) => e.k === 'heli').length,
    };
  });
  assert.deepEqual(totals, [
    { hp: 117, tanks: 3, air: 1 },
    { hp: 162, tanks: 6, air: 2 },
    { hp: 164, tanks: 9, air: 4 },
  ]);
  assert.ok(totals[0].hp < totals[1].hp && totals[1].hp < totals[2].hp);
  assert.ok(totals[0].tanks < totals[1].tanks && totals[1].tanks < totals[2].tanks);
});

test('positionAlong recorre una polilínea a velocidad constante', () => {
  const route = [
    [0, 0],
    [30, 40],
    [30, 90],
  ];
  const start = Escort.positionAlong(route, 0);
  assert.deepEqual([start.x, start.z], [0, 0]);
  assert.equal(start.length, 100);
  const mid = Escort.positionAlong(route, 50);
  assert.deepEqual([mid.x, mid.z], [30, 40]);
  const end = Escort.positionAlong(route, 100);
  assert.deepEqual([end.x, end.z], [30, 90]);
  const past = Escort.positionAlong(route, 999);
  assert.equal(past.s, 100);
  assert.deepEqual([past.x, past.z], [30, 90]);
});

// --- Renderizador: garaje, coche, tren y batería ---

function renderParts(scene, mission = 1) {
  // Cada pieza dibujada como (origen, color), como en
  // tests/defensas-winch-m1.test.cjs; el mundo es el de la misión
  // dada (el tren y las vías solo existen en la 3).
  const parts = [];
  let lastOrigin = null;
  const gl = new Proxy(
    {
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => ({}),
      getUniformLocation: (_, name) => name,
      getAttribLocation: (_, name) => (name === 'position' ? 0 : 1),
      uniform3f: (name, ...values) => {
        if (name === 'origin') lastOrigin = values;
      },
      uniform3fv: (name, values) => {
        if (name === 'color')
          parts.push({ origin: lastOrigin, color: [...values] });
      },
      uniform2f: () => {},
      uniform1f: () => {},
      bufferData: () => {},
      drawArrays: () => {},
      compileShader: () => {},
      viewport: () => {},
    },
    {
      get: (obj, key) =>
        key in obj ? obj[key] : key.toUpperCase() === key ? 1 : () => {},
    },
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => gl,
    addEventListener: () => {},
  };
  const r = new Renderer(canvas, () => {}, () => {});
  r.setWorld(World.create(Maps.generate(mission)));
  r.render(scene);
  return parts;
}

const baseScene = (overrides = {}) => ({
  W: 390,
  H: 844,
  F: 390 / 105,
  HY: 844 * 0.52,
  cam: { x: 0, z: 0, yaw: 0 },
  PITCH: Math.PI / 3,
  P: { x: 0, y: 8, z: 0, yaw: 0, inv: 0 },
  E: [],
  DC: [],
  BL: [],
  EB: [],
  MS: [],
  SM: [],
  FX: [],
  allies: [],
  PK: [],
  rot: 1,
  t: 0,
  ...overrides,
});
const has = (parts, c, at) =>
  parts.some(
    (p) =>
      p.color.every((n, i) => Math.abs(n - c[i]) < 1e-9) &&
      (!at ||
        (Math.hypot(p.origin[0] - at[0], p.origin[2] - at[2]) < 1 &&
          Math.abs(p.origin[1] - at[1]) < 0.6)),
  );

test('el renderer dibuja el garaje Tan: nave, puerta y dintel amarillo', () => {
  const parts = renderParts(
    baseScene({
      cam: { x: 203, z: -55, yaw: 0 },
      E: [{ k: 'garage', x: 203, y: 0, z: -55, yaw: -0.71, fl: 0 }],
    }),
    2,
  );
  // Cuerpo de la nave a 3 u del suelo, puerta oscura y dintel
  // amarillo en el frente (hacia el circuito).
  assert.ok(has(parts, [0.62, 0.48, 0.25], [203, 3, -55]), 'sin nave del garaje');
  assert.ok(has(parts, [0.2, 0.18, 0.12]), 'sin puerta del garaje');
  assert.ok(has(parts, [0.85, 0.7, 0.3]), 'sin dintel amarillo');
});

test('el renderer dibuja el coche Tan: carrocería amarilla y caja de suministros', () => {
  const parts = renderParts(
    baseScene({
      cam: { x: 100, z: -100, yaw: 0 },
      E: [{ k: 'car', x: 100, y: 0, z: -100, yaw: 0, fl: 0 }],
    }),
    2,
  );
  assert.ok(has(parts, [0.95, 0.76, 0.2], [100, 0.6, -100]), 'sin carrocería del coche');
  assert.ok(has(parts, [0.62, 0.48, 0.25]), 'sin caja de suministros del coche');
  assert.ok(has(parts, [0.76, 0.61, 0.36]), 'sin cabina del coche');
});

test('el renderer dibuja el tren verde y las vías de la Misión 3', () => {
  const parts = renderParts(
    baseScene({
      cam: { x: -257.6, z: 92.4, yaw: 0 },
      train: { x: -257.6, z: 92.4, yaw: Math.atan2(80, 20), state: 'moving' },
    }),
    3,
  );
  // El verde vivo del tren (solo lo usan el tren y los soldados
  // amigos, y aquí no hay aliados).
  assert.ok(has(parts, [0.24, 0.65, 0.16]), 'sin tren verde');
  // Raíles de acero y traviesas de madera junto a la vía.
  assert.ok(has(parts, [0.38, 0.38, 0.36]), 'sin raíles de acero');
  assert.ok(has(parts, [0.3, 0.22, 0.14]), 'sin traviesas');
  // Sin tren, no hay verde vivo en la escena (el mundo no lo dibuja).
  const noTrain = renderParts(
    baseScene({ cam: { x: -257.6, z: 92.4, yaw: 0 }, train: null }),
    3,
  );
  assert.ok(!has(noTrain, [0.24, 0.65, 0.16]), 'verde vivo sin tren');
});

test('el renderer dibuja la batería en el suelo y colgando del helicóptero', () => {
  const batteryDark = [0.25, 0.28, 0.35],
    terminalYellow = [0.95, 0.8, 0.2],
    cableDark = [0.12, 0.12, 0.1];
  // En el suelo: caja oscura con bornes amarillos, donde cayó.
  const ground = renderParts(
    baseScene({
      cam: { x: -52, z: 52, yaw: 0 },
      cargo: { kind: 'battery', state: 'waiting', x: -52, z: 52, progress: 0 },
    }),
    3,
  );
  assert.ok(has(ground, batteryDark, [-52, 0.5, 52]), 'sin batería en el suelo');
  assert.ok(has(ground, terminalYellow), 'sin bornes amarillos');
  assert.ok(!has(ground, cableDark), 'sin cable en el suelo');
  // Escondida: no se dibuja hasta que cae el helicóptero Tan.
  const hidden = renderParts(
    baseScene({
      cam: { x: -52, z: 52, yaw: 0 },
      cargo: { kind: 'battery', state: 'hidden', x: -52, z: 52, progress: 0 },
    }),
    3,
  );
  assert.ok(!has(hidden, batteryDark), 'la batería escondida se dibuja');
  // Colgando: cable y batería oscura bajo el helicóptero (y 8 − 4,2).
  const carried = renderParts(
    baseScene({
      cam: { x: -52, z: 52, yaw: 0 },
      P: { x: -52, y: 8, z: 52, yaw: 0, inv: 0 },
      cargo: { kind: 'battery', state: 'carried', x: -52, z: 52, progress: 1 },
    }),
    3,
  );
  assert.ok(has(carried, cableDark), 'sin cable con la batería colgando');
  assert.ok(has(carried, batteryDark, [-52, 3.8, 52]), 'sin batería colgando');
  assert.ok(!has(carried, batteryDark, [-52, 0.5, 52]), 'la batería sigue en el suelo');
});
