const test = require('node:test');
const assert = require('node:assert/strict');
const Maps = require('../src/original-maps.js');
const World = require('../src/toy-world.js');
const Collision = require('../src/collision.js');
const Escort = require('../src/escort-mission.js');
const Renderer = require('../src/toy-renderer.js');
const { game } = require('../support/fake-host.cjs');

// --- Defensas de la Misión 1 ---

test('la Misión 1 tiene defensas y las 2 y 3 no: sacos, valla, tiendas, torre y cajas', () => {
  const m1 = Maps.generate(1);
  assert.deepEqual(Maps.validate(m1), []);
  const kinds = m1.defenses.map((d) => d.kind);
  assert.equal(kinds.filter((k) => k === 'sandbags').length, 3);
  assert.equal(kinds.filter((k) => k === 'fence').length, 1);
  assert.equal(kinds.filter((k) => k === 'tent').length, 2);
  assert.equal(kinds.filter((k) => k === 'tower').length, 1);
  assert.equal(kinds.filter((k) => k === 'crate').length, 2);
  assert.equal(m1.defenses.length, 9);
  assert.deepEqual(m1.cargo, { x: -170, z: 140 });
  assert.deepEqual(m1.portal, { x: 205, z: 192, radius: 12 });
  for (const n of [2, 3]) {
    const m = Maps.generate(n);
    assert.deepEqual(m.defenses, []);
    assert.deepEqual(Maps.validate(m), []);
  }
  // Misión 2: sin carga ni portal de salida (su portal es el de los
  // coches, en `carPortal`); Misión 3: la batería robada y el portal
  // de salida.
  assert.equal(Maps.generate(2).cargo, null);
  assert.equal(Maps.generate(2).portal, null);
  assert.deepEqual(Maps.generate(3).cargo, {
    kind: 'battery',
    hidden: true,
    winchFrom: 'any',
    x: -52,
    z: 52,
    deliverAt: { x: -272, z: 89, radius: 9 },
  });
  assert.deepEqual(Maps.generate(3).portal, { x: 145, z: 224, radius: 12 });
});

test('las defensas no bloquean rutas ni helipuertos: fuera del camino y lejos de A/B/C', () => {
  const m1 = Maps.generate(1);
  const routeDistance = (x, z) => {
    let best = Infinity;
    for (const route of m1.routes)
      for (let i = 1; i < route.length; i++) {
        const [ax, az] = route[i - 1],
          [bx, bz] = route[i],
          dx = bx - ax,
          dz = bz - az,
          len2 = dx * dx + dz * dz,
          t =
            len2 === 0
              ? 0
              : Math.max(
                  0,
                  Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2),
                );
        best = Math.min(
          best,
          Math.hypot(x - (ax + t * dx), z - (az + t * dz)),
        );
      }
    return best;
  };
  for (const [x, z] of Maps.defensePoints(m1.defenses)) {
    assert.ok(routeDistance(x, z) >= 18, `defensa a ${x},${z} sobre la ruta`);
    for (const p of [m1.rules.A, m1.rules.B, m1.rules.C])
      assert.ok(
        Math.hypot(x - p.x, z - p.z) >= 25,
        `defensa a ${x},${z} sobre un helipuerto`,
      );
  }
  // La caja está junto a B (el puesto del plástico) y el portal pasado
  // C, y el helicóptero puede llegar a ambos: hay suelo llano
  // (`canTravel`) dentro del radio del winch (8 u) y del portal (12 u).
  const world = World.create(m1);
  const reachable = (cx, cz, radius) => {
    for (let x = cx - radius; x <= cx + radius; x += 2)
      for (let z = cz - radius; z <= cz + radius; z += 2)
        if (
          Math.hypot(x - cx, z - cz) <= radius &&
          world.canTravel(x, z, 1.8)
        )
          return true;
    return false;
  };
  assert.ok(reachable(m1.cargo.x, m1.cargo.z, 8), 'la caja no es alcanzable');
  assert.ok(
    reachable(m1.portal.x, m1.portal.z, 12),
    'el portal no es alcanzable',
  );
  assert.ok(world.canTravel(m1.rules.C.x, m1.rules.C.z, 1.8));
});

test('las defensas son cobertura real: paran balas y movimiento, sin tapar la ruta', () => {
  const m1 = Maps.generate(1),
    world = World.create(m1),
    m = new Escort.Mission(1, m1.rules),
    cover = Collision.create({ DC: world.shrubs, DB: [], mission: m }, world);
  const g = (x, z) => world.height(x, z);
  // Sacos de arena: una bala a la altura de un soldado no pasa; por
  // encima, sí.
  assert.ok(
    cover.trace(
      { x: -157, y: g(-157, 125) + 0.8, z: 119 },
      { x: -157, y: g(-157, 125) + 0.8, z: 131 },
    ),
    'sacos paran la bala',
  );
  assert.equal(
    cover.trace(
      { x: -157, y: g(-157, 125) + 4, z: 119 },
      { x: -157, y: g(-157, 125) + 4, z: 131 },
    ),
    null,
    'por encima de los sacos pasa',
  );
  // Tienda de campaña y caja de suministros también paran balas.
  assert.ok(
    cover.trace(
      { x: -100, y: g(-100, 140) + 1, z: 132 },
      { x: -100, y: g(-100, 140) + 1, z: 148 },
    ),
    'tienda para la bala',
  );
  assert.ok(
    cover.trace(
      { x: -135, y: g(-135, 200) + 1.5, z: 192 },
      { x: -135, y: g(-135, 200) + 1.5, z: 208 },
    ),
    'caja para la bala',
  );
  // Valla de alambre: el poste para la bala a su altura.
  assert.ok(
    cover.trace(
      { x: 15, y: g(15, -35) + 2, z: -40 },
      { x: 15, y: g(15, -35) + 2, z: -30 },
    ),
    'poste de la valla para la bala',
  );
  // La ruta del pelotón sigue libre a la altura de un soldado.
  for (const route of m1.routes)
    for (let i = 1; i < route.length; i++) {
      const [ax, az] = route[i - 1],
        [bx, bz] = route[i];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
      for (let j = 0; j <= steps; j++) {
        const x = ax + ((bx - ax) * j) / steps,
          z = az + ((bz - az) * j) / steps;
        assert.equal(
          cover.overlaps({ x, y: g(x, z) + 1.5, z }, 0.65, 0.9),
          false,
          `defensa sobre la ruta en ${x.toFixed(0)},${z.toFixed(0)}`,
        );
      }
    }
  // El mundo dibuja las defensas: sacos caqui, tiendas verdes, postes.
  const has = (color) =>
    world.yard.some((p) =>
      p.color.every((v, i) => Math.abs(v - color[i]) < 1e-9),
    );
  assert.ok(has([0.62, 0.55, 0.38]), 'sacos de arena en el patio');
  assert.ok(has([0.2, 0.45, 0.18]), 'tiendas verdes en el patio');
  assert.deepEqual(world.cargoCrate, { x: -170, z: 140 });
  assert.equal(world.defenses.length, 9);
});

// --- Winch y reglas de la Misión 1 ---

function driveToCargoPhase(mission) {
  // Conduce una misión directa hasta CARGA_PORTAL (Misión 1) o hasta
  // COMPLETADA (misiones sin carga), como los tests de mapas.
  const map = Maps.generate(mission.number),
    world = World.create(map),
    cover = Collision.create({ DC: world.shrubs, DB: [], mission }, world),
    env = { groundAt: world.height, cover, enemies: [] };
  for (const a of mission.allies.filter((a) => a.wounded))
    for (let i = 0; i < 40; i++) mission.update(0.05, a, env);
  const player = { ...mission.finish };
  for (let i = 0; i < 2000 && mission.stage !== 'COMPLETADA'; i++) {
    if (mission.stage === 'CARGA_PORTAL' && mission.cargo) break;
    mission.update(0.05, player, env);
  }
  return { env, player };
}

test('la Misión 1 no se puede levantar la caja antes de escoltar: el winch espera a su fase', () => {
  const map = Maps.generate(1),
    m = new Escort.Mission(1, map.rules);
  assert.equal(m.cargo.state, 'waiting');
  assert.equal(m.cargoView().state, 'waiting');
  // Sobre la caja durante el embarque de heridos: no engancha.
  const env = { groundAt: () => 0, enemies: [] };
  for (const a of m.allies.filter((a) => a.wounded))
    for (let i = 0; i < 40; i++) m.update(0.05, a, env);
  assert.equal(m.stage, 'ESCOLTAR_BC');
  // En cuanto empieza la escolta, el winch ya funciona: el jugador
  // está en B, junto a la caja.
  for (let i = 0; i < 40; i++) m.update(0.05, m.cargo, env);
  assert.equal(m.cargo.state, 'carried');
  assert.equal(m.drainEvents().some((e) => e.type === 'cargo-lifted'), true);
  // Durante la escolta la brújula sigue apuntando a C, no a la caja:
  // el pelotón manda; la caja se recuerda en el mensaje.
  assert.deepEqual(m.target({ x: 0, z: 0 }), m.finish);
  assert.ok(m.message.includes('Caja colgando'));
  assert.ok(m.hudSummary().includes('Caja colgando'));
});

test('el winch exige quedarse quieto: moverse o disparar reinicia el enganche', () => {
  const map = Maps.generate(1),
    m = new Escort.Mission(1, map.rules),
    env = { groundAt: () => 0, enemies: [] };
  const { player } = driveToCargoPhase(m);
  assert.equal(m.stage, 'CARGA_PORTAL');
  assert.equal(m.cargo.state, 'waiting');
  // 1 s sobre la caja: enganche al 67 % aprox, sin levantar.
  for (let i = 0; i < 20; i++) m.update(0.05, m.cargo, env);
  assert.equal(m.cargo.state, 'waiting');
  assert.ok(m.cargo.hold > 0.5, 'el enganche avanza');
  assert.ok(m.message.includes('%'), 'el HUD muestra el % del winch');
  // Moverse reinicia el enganche.
  m.update(0.05, m.cargo, { groundAt: () => 0, enemies: [], moving: true });
  assert.equal(m.cargo.hold, 0);
  assert.equal(m.cargo.state, 'waiting');
  // Disparar también lo reinicia.
  for (let i = 0; i < 20; i++) m.update(0.05, m.cargo, env);
  m.update(0.05, m.cargo, { groundAt: () => 0, enemies: [], firing: true });
  assert.equal(m.cargo.hold, 0);
  // Quieto 1,5 s: la caja cuelga.
  for (let i = 0; i < 40; i++) m.update(0.05, m.cargo, env);
  assert.equal(m.cargo.state, 'carried');
  // La brújula apunta al portal con la caja colgando.
  assert.deepEqual(m.target(m.cargo), m.portal);
  assert.ok(m.message.includes('portal'));
  // Volar por el portal cierra la misión con estrellas.
  const result = m.update(0.05, m.portal, env);
  assert.equal(result, 'complete');
  assert.equal(m.stage, 'COMPLETADA');
  assert.equal(m.cargo.state, 'delivered');
  assert.ok(m.stars >= 1 && m.stars <= 3);
  assert.ok(m.message.includes('portal'));
  assert.ok(m.hudSummary().includes('Caja entregada'));
});

test('las transiciones de la carga: C abre la fase y el portal la cierra; sin carga no existe', () => {
  const withCargo = new Escort.Mission(1, Maps.generate(1).rules);
  assert.equal(withCargo.transition('CARGA_PORTAL'), false);
  const noCargo = new Escort.Mission(2, Maps.generate(2).rules);
  assert.equal(noCargo.cargo, null);
  assert.equal(noCargo.cargoView(), null);
  assert.equal(noCargo.transition('CARGA_PORTAL'), false);
  assert.ok(!noCargo.hudSummary().includes('Caja'));
  assert.equal(noCargo.config.name, 'Locura de coches');
  assert.equal(withCargo.config.name, 'Pandemonio de Plástico');
});

test('la Misión 1 completa en el juego real: rescate, winch en B, escolta a C y portal', () => {
  const g = game();
  g.app.start(1, true);
  const s = g.state,
    m = s.mission;
  assert.equal(m.config.name, 'Pandemonio de Plástico');
  for (const e of s.E) g.app.combat.kill(e);
  s.E = [];
  s.EB = [];
  for (const a of m.allies.filter((a) => a.wounded)) {
    s.P.x = a.x;
    s.P.z = a.z;
    for (let i = 0; i < 30; i++) g.app.upd(0.05);
  }
  assert.equal(m.rescued, 3);
  assert.equal(m.stage, 'ESCOLTAR_BC');
  // Winch nada más salir de B, con el pelotón en marcha.
  const scoreBefore = s.P.sc;
  s.P.x = m.cargo.x;
  s.P.z = m.cargo.z;
  for (let i = 0; i < 40 && m.cargo.state === 'waiting'; i++) g.app.upd(0.05);
  assert.equal(m.cargo.state, 'carried');
  assert.equal(s.P.sc, scoreBefore + 50, 'levantar la caja suma 50');
  assert.ok(m.hudSummary().includes('Caja colgando'));
  // Escolta a C con la caja colgando: el pelotón llega entero.
  s.P.x = m.finish.x;
  s.P.z = m.finish.z;
  for (let i = 0; i < 3600 && m.stage !== 'CARGA_PORTAL'; i++)
    g.app.upd(0.05);
  assert.equal(m.stage, 'CARGA_PORTAL');
  assert.equal(m.delivered, 7, 'toda la escolta llega a C');
  assert.equal(m.cargo.state, 'carried', 'la caja sigue colgando');
  // La brújula y el objetivo apuntan al portal, no a C.
  assert.deepEqual(m.target(s.P), m.portal);
  assert.ok(
    g.element('objective').textContent.includes('caja'),
    g.element('objective').textContent,
  );
  assert.ok(g.element('inf').textContent.includes('Caja colgando'));
  // Por el portal, con la caja: victoria.
  s.P.x = m.portal.x;
  s.P.z = m.portal.z;
  for (let i = 0; i < 600 && s.st === 'play'; i++) g.app.upd(0.05);
  assert.equal(s.st, 'win');
  assert.equal(m.stage, 'COMPLETADA');
  assert.equal(m.cargo.state, 'delivered');
  assert.ok(m.stars >= 1);
});

test('sin winch, la Misión 1 no cierra en C: espera la caja y el portal', () => {
  const g = game();
  g.app.start(1, true);
  const s = g.state,
    m = s.mission;
  for (const e of s.E) g.app.combat.kill(e);
  s.E = [];
  s.EB = [];
  for (const a of m.allies.filter((a) => a.wounded)) {
    s.P.x = a.x;
    s.P.z = a.z;
    for (let i = 0; i < 30; i++) g.app.upd(0.05);
  }
  s.P.x = m.finish.x;
  s.P.z = m.finish.z;
  for (let i = 0; i < 3600 && m.stage !== 'CARGA_PORTAL'; i++)
    g.app.upd(0.05);
  assert.equal(m.stage, 'CARGA_PORTAL');
  assert.equal(s.st, 'play', 'en C no hay victoria sin la caja');
  assert.equal(m.cargo.state, 'waiting');
  assert.ok(g.element('objective').textContent.includes('caja'));
  // El portal sin la caja no cierra la misión.
  s.P.x = m.portal.x;
  s.P.z = m.portal.z;
  for (let i = 0; i < 200; i++) g.app.upd(0.05);
  assert.equal(s.st, 'play');
  assert.equal(m.stage, 'CARGA_PORTAL');
});

// --- Renderizador: caja en el suelo, cable y caja colgando ---

function renderParts(scene) {
  // Cada pieza dibujada como (origen, color): el origen distingue la
  // caja del suelo (en la caja de la carga) de las cajas fijas de las
  // defensas y de la caja colgando bajo el helicóptero.
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
  r.setWorld(World.create(Maps.generate(1)));
  r.render(scene);
  return parts;
}

test('el renderer dibuja la caja en el suelo, el cable al enganchar y la caja colgando', () => {
  const has = (parts, c, at) =>
    parts.some(
      (p) =>
        p.color.every((n, i) => Math.abs(n - c[i]) < 1e-9) &&
        (!at ||
          Math.hypot(p.origin[0] - at[0], p.origin[2] - at[2]) < 1 &&
          Math.abs(p.origin[1] - at[1]) < 0.6),
    );
  const scene = (cargo) => ({
    W: 390,
    H: 844,
    F: 390 / 105,
    HY: 844 * 0.52,
    cam: { x: -170, z: 140, yaw: 0 },
    PITCH: Math.PI / 3,
    P: { x: -170, y: 8, z: 140, yaw: 0, inv: 0 },
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
    cargo,
  });
  const crateGreen = [0.13, 0.42, 0.14],
    cableDark = [0.12, 0.12, 0.1],
    // Suelo en la caja: 3,1; cuerpo de la caja en el suelo a 3,1+1,8.
    groundCrate = [-170, 4.9, 140],
    // Caja colgando: panza del helicóptero (y 8) menos 4,6.
    slungCrate = [-170, 3.4, 140];
  // En el suelo: caja verde en su sitio, sin cable.
  const ground = renderParts(
    scene({ state: 'waiting', x: -170, z: 140, progress: 0 }),
  );
  assert.ok(has(ground, crateGreen, groundCrate), 'caja verde en el suelo');
  assert.ok(!has(ground, cableDark), 'sin cable en el suelo');
  // Enganchando (progreso 0,5): cable oscuro bajo el helicóptero y la
  // caja todavía en el suelo.
  const winching = renderParts(
    scene({ state: 'waiting', x: -170, z: 140, progress: 0.5 }),
  );
  assert.ok(has(winching, cableDark), 'cable al enganchar');
  assert.ok(has(winching, crateGreen, groundCrate), 'la caja sigue en el suelo');
  // Colgando: cable y caja verde bajo el helicóptero; la del suelo ya
  // no está en su sitio.
  const carried = renderParts(
    scene({ state: 'carried', x: -170, z: 140, progress: 1 }),
  );
  assert.ok(has(carried, cableDark), 'cable con la caja colgando');
  assert.ok(has(carried, crateGreen, slungCrate), 'caja colgando bajo el helicóptero');
  assert.ok(!has(carried, crateGreen, groundCrate), 'la caja ya no está en el suelo');
});
