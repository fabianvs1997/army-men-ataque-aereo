const test = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('../support/fake-host.cjs');

// Congelamiento al regresar al punto A (misión 1, dos variantes):
// 1) liberar B, limpiar enemigos hasta C, NO embarcar heridos y volver a A.
// 2) embarcar heridos, ir a C, NO entregarlos y volver a A con ellos.
// Causa: en upd() cada enemigo trazaba línea de visión a cada soldado
// más cercano que el jugador sin límite de distancia, aunque solo puede
// disparar a 45-75 u. Con el jugador lejos, eran 50-90 traces/frame de
// hasta 370 u, con traces sueltos de hasta 50 ms en Node (misión 1,
// semillas 1/123/2026). El arreglo limita el trace al alcance de
// disparo del enemigo; más allá de él persigue al jugador, como ya
// hacen los aliados en defend().

function flyTo(app, state, x, z, speed = 28) {
  let frames = 0;
  for (;;) {
    const dx = x - state.P.x;
    const dz = z - state.P.z;
    const d = Math.hypot(dx, dz);
    if (d < 1 || frames > 30000) break;
    const step = Math.min(d, speed / 60);
    state.P.x += (dx / d) * step;
    state.P.z += (dz / d) * step;
    state.P.arm = 10;
    state.P.inv = 0;
    app.upd(1 / 60);
    frames++;
  }
  return frames;
}

function clearThreats(app, state, m) {
  for (let i = 0; i < 20 && m.threats(state.E).length; i++) {
    for (const e of m.threats(state.E)) app.combat.kill(e);
    state.EB = [];
    for (let j = 0; j < 10; j++) {
      state.P.arm = 10;
      state.P.inv = 0;
      app.upd(1 / 60);
    }
  }
}

function boardWounded(app, state, m) {
  for (const a of m.allies.filter((a) => a.wounded)) {
    // El abordaje se bloquea si una patrulla entra en el perímetro de B
    // (por diseño, con mensaje en el HUD): se reintenta despejando.
    for (let attempt = 0; attempt < 3 && a.state !== 'A_BORDO'; attempt++) {
      clearThreats(app, state, m);
      state.P.x = a.x;
      state.P.z = a.z;
      for (let i = 0; i < 40; i++) {
        state.P.arm = 10;
        state.P.inv = 0;
        app.upd(0.05);
        if (m.threats(state.E).length) {
          for (const e of m.threats(state.E)) app.combat.kill(e);
          state.EB = [];
        }
        if (a.state === 'A_BORDO') break;
      }
    }
  }
}

function traceSpy(app) {
  const cover = app.view.cover;
  const spy = { calls: 0, maxLen: 0 };
  const orig = cover.trace.bind(cover);
  cover.trace = (a, b, r, h) => {
    spy.calls++;
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (len > spy.maxLen) spy.maxLen = len;
    return orig(a, b, r, h);
  };
  spy.restore = () => {
    cover.trace = orig;
  };
  return spy;
}

function reachB(app, state, m) {
  flyTo(app, state, m.rules.B.x, m.rules.B.z);
  for (const e of m.threats(state.E)) app.combat.kill(e);
  state.EB = [];
  for (let i = 0; i < 30; i++) {
    state.P.arm = 10;
    state.P.inv = 0;
    app.upd(1 / 60);
  }
  assert.equal(m.stage, 'EMBARCAR_HERIDOS');
}

test('variante 1: volver a A sin heridos no traza visión a larga distancia', () => {
  for (const seed of [1]) {
    const { app, state } = game(seed);
    app.start(1, true);
    const m = state.mission;
    reachB(app, state, m);
    flyTo(app, state, m.finish.x, m.finish.z);
    for (const e of [...state.E].filter((e) => e.zone === 'BC'))
      app.combat.kill(e);
    state.EB = [];
    for (let i = 0; i < 120; i++) {
      state.P.arm = 10;
      state.P.inv = 0;
      app.upd(1 / 60);
    }
    const spy = traceSpy(app);
    const frames = flyTo(app, state, m.start.x, m.start.z);
    spy.restore();
    assert.equal(m.stage, 'EMBARCAR_HERIDOS');
    assert.equal(state.st, 'play');
    assert.equal(m.rescued, 0);
    // Antes del arreglo: ~70 traces/frame y segmentos de hasta 370 u
    // en este mismo tramo. Ahora ningún trace supera el alcance de
    // disparo (75 u del tanque + margen por la altura).
    assert.ok(
      spy.maxLen <= 80,
      `seed ${seed}: trace más largo ${spy.maxLen.toFixed(1)} u`,
    );
    assert.ok(
      spy.calls / frames < 5,
      `seed ${seed}: ${spy.calls} traces en ${frames} frames`,
    );
  }
});

test('variante 2: volver a A con heridos a bordo no traza visión a larga distancia', () => {
  for (const seed of [1]) {
    const { app, state } = game(seed);
    app.start(1, true);
    const m = state.mission;
    reachB(app, state, m);
    boardWounded(app, state, m);
    assert.equal(m.rescued, 3);
    assert.equal(m.stage, 'ESCOLTAR_BC');
    flyTo(app, state, m.finish.x, m.finish.z);
    for (const e of [...state.E].filter((e) => e.zone === 'BC'))
      app.combat.kill(e);
    state.EB = [];
    // En C sin entregar: seguir disparando (no estable → no hay entrega).
    app.view.fire = true;
    for (let i = 0; i < 600; i++) {
      state.P.arm = 10;
      state.P.inv = 0;
      app.upd(1 / 60);
    }
    app.view.fire = false;
    assert.equal(m.rescued, 3);
    assert.equal(m.delivered, 0);
    assert.ok(['ESCOLTAR_BC', 'ENTREGA_C'].includes(m.stage));
    const spy = traceSpy(app);
    const frames = flyTo(app, state, m.start.x, m.start.z);
    spy.restore();
    assert.equal(state.st, 'play');
    assert.equal(m.rescued, 3);
    assert.equal(m.delivered, 0);
    assert.ok(
      spy.maxLen <= 80,
      `seed ${seed}: trace más largo ${spy.maxLen.toFixed(1)} u`,
    );
    assert.ok(
      spy.calls / frames < 5,
      `seed ${seed}: ${spy.calls} traces en ${frames} frames`,
    );
  }
});

test('la entrega en C sigue funcionando tras el arreglo', () => {
  const { app, state } = game(1);
  app.start(1, true);
  const m = state.mission;
  reachB(app, state, m);
  boardWounded(app, state, m);
  assert.equal(m.stage, 'ESCOLTAR_BC');
  flyTo(app, state, m.finish.x, m.finish.z);
  for (const e of [...state.E].filter((e) => e.zone === 'BC'))
    app.combat.kill(e);
  state.EB = [];
  // Quieto en C hasta que el pelotón llegue y se entregue. El pelotón
  // camina a 7 u/s una ruta de ~400 u, así que la espera es larga
  // (pasos de 0,05 s como en scripts/smoke-escort.cjs).
  let frames = 0;
  while (state.st === 'play' && frames < 3000) {
    state.P.arm = 10;
    state.P.inv = 0;
    app.upd(0.05);
    frames++;
  }
  assert.equal(state.st, 'win', `fase ${m.stage}, entregados ${m.delivered}`);
  assert.equal(m.delivered, 7);
});

function targetingSetup() {
  const { app, state } = game(123);
  app.start(1, true);
  const m = state.mission;
  state.E.length = 0;
  // Tanque sobre la ruta AB (terreno llano, línea de visión despejada)
  // y soldado más adelante por el mismo tramo. Fuera de la ruta el
  // relieve se eleva ~20 u y bloquearía el trace por el terreno.
  const routeAB = state.world.routes[0];
  const [tx, tz] = routeAB[1];
  const tank = {
    k: 'tank',
    x: tx,
    y: state.world.height(tx, tz),
    z: tz,
    hp: 8,
    r: 3.5,
    cd: 0,
    p: 30,
    fl: 0,
  };
  state.E.push(tank);
  const soldier = m.allies.find((a) => !a.wounded);
  // Apartar al resto del pelotón y a los guardias: sin esto, el tanque
  // apuntaría al soldado activo más cercano (un guardia a ~38 u) y no
  // al soldado de prueba.
  for (const a of m.guards.concat(m.allies))
    if (a !== soldier) {
      a.x = 250;
      a.z = 200;
    }
  return { app, state, m, tank, soldier, routeAB };
}

function drive(app, state, frames = 30) {
  for (let i = 0; i < frames; i++) {
    state.P.arm = 10;
    state.P.inv = 0;
    app.upd(1 / 60);
  }
}

// Punto a `distance` unidades por la ruta desde `route[i]`, siguiendo
// sus tramos: con el motor de mapas los tramos ya no miden lo mismo
// en cada mapa, así que las distancias de prueba se caminan, no se
// asumen desde los puntos de la ruta.
function pointAlongRoute(route, i, distance) {
  let [x, z] = route[i];
  let left = distance;
  for (let j = i + 1; j < route.length && left > 0; j++) {
    const [bx, bz] = route[j],
      len = Math.hypot(bx - x, bz - z);
    if (len >= left) return [x + ((bx - x) / len) * left, z + ((bz - z) / len) * left];
    x = bx;
    z = bz;
    left -= len;
  }
  return [x, z];
}

test('un tanque persigue al jugador, no a un soldado fuera de su alcance', () => {
  const { app, state, tank, soldier, routeAB } = targetingSetup();
  // Soldado a 83 u del tanque por la ruta: fuera del alcance del
  // tanque (75 u).
  const [sx, sz] = pointAlongRoute(routeAB, 1, 83);
  soldier.x = sx;
  soldier.z = sz;
  // Jugador en dirección opuesta al soldado, a ~113 u del tanque.
  const [ax, az] = routeAB[1];
  const dx = sx - ax,
    dz = sz - az,
    d = Math.hypot(dx, dz);
  state.P.x = ax - (dx / d) * 113;
  state.P.z = az - (dz / d) * 113;
  const dist = (p) => Math.hypot(tank.x - p.x, tank.z - p.z);
  const dPlayer0 = dist(state.P);
  const dSoldier0 = dist(soldier);
  drive(app, state);
  // El tanque debe cazar al jugador (se acerca a él y se aleja del
  // soldado). Antes del arreglo se iba hacia el soldado porque solo
  // comparaba distancias.
  assert.ok(
    dist(state.P) < dPlayer0 - 1,
    `distancia al jugador: ${dPlayer0.toFixed(1)} → ${dist(state.P).toFixed(1)}`,
  );
  assert.ok(
    dist(soldier) > dSoldier0 + 1,
    `distancia al soldado: ${dSoldier0.toFixed(1)} → ${dist(soldier).toFixed(1)}`,
  );
});

test('un soldado dentro del alcance sigue siendo el objetivo', () => {
  const { app, state, tank, soldier, routeAB } = targetingSetup();
  // Soldado a 50 u del tanque por la ruta: dentro de su alcance
  // (75 u) y con línea de visión despejada por el camino.
  const [ax, az] = routeAB[1];
  const [sx, sz] = pointAlongRoute(routeAB, 1, 50);
  soldier.x = sx;
  soldier.z = sz;
  const dx = sx - ax,
    dz = sz - az,
    d = Math.hypot(dx, dz);
  // Jugador en dirección opuesta al soldado, a ~113 u del tanque.
  state.P.x = ax - (dx / d) * 113;
  state.P.z = az - (dz / d) * 113;
  const dSoldier0 = Math.hypot(tank.x - soldier.x, tank.z - soldier.z);
  const dPlayer0 = Math.hypot(tank.x - state.P.x, tank.z - state.P.z);
  drive(app, state);
  assert.ok(
    Math.hypot(tank.x - soldier.x, tank.z - soldier.z) < dSoldier0 - 1,
    `distancia al soldado: ${dSoldier0.toFixed(1)} → ${Math.hypot(tank.x - soldier.x, tank.z - soldier.z).toFixed(1)}`,
  );
  assert.ok(
    Math.hypot(tank.x - state.P.x, tank.z - state.P.z) > dPlayer0 + 1,
    `distancia al jugador: ${dPlayer0.toFixed(1)} → ${Math.hypot(tank.x - state.P.x, tank.z - state.P.z).toFixed(1)}`,
  );
});
