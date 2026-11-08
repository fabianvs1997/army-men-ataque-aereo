const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('../support/fake-host.cjs');
const key = (g, k) =>
  g.host.emit('keydown', { key: k, repeat: false, preventDefault() {} });
function completeMission(g) {
  const { app, state: s } = g;
  for (const e of s.E) app.combat.kill(e);
  s.E = [];
  s.EB = [];
  for (const a of s.mission.allies.filter((a) => a.wounded)) {
    s.P.x = a.x;
    s.P.z = a.z;
    for (let i = 0; i < 30; i++) app.upd(0.05);
  }
  // Misión 1 del vídeo, sin heridos: sin embarque, el jugador nunca
  // pasaría por B y la fase se quedaría en COMBATE_RUTA_AB (para
  // llegar a DESPEJAR_B hay que acercarse a B a menos de 40 u).
  if (s.mission.noEscort) {
    s.P.x = s.mission.rules.B.x;
    s.P.z = s.mission.rules.B.z;
    for (let i = 0; i < 30; i++) app.upd(0.05);
  }
  s.P.x = s.mission.finish.x;
  s.P.z = s.mission.finish.z;
  for (let i = 0; i < 1800 && s.st === 'play'; i++) app.upd(0.05);
  // Misión 1: tras la entrega en C queda la caja y el portal.
  if (s.mission.stage === 'CARGA_PORTAL') {
    s.P.x = s.mission.cargo.x;
    s.P.z = s.mission.cargo.z;
    for (let i = 0; i < 200 && s.mission.cargo.state === 'waiting'; i++)
      app.upd(0.05);
    s.P.x = s.mission.portal.x;
    s.P.z = s.mission.portal.z;
    for (let i = 0; i < 600 && s.st === 'play'; i++) app.upd(0.05);
  }
  // Misión 2: si queda algún garaje tras la entrega en C, destruirlo
  // (aquí ya murieron todos al principio, pero el helper cubre la fase).
  if (s.mission.stage === 'GARAJES') {
    for (const g of s.mission.garages)
      s.mission.enemyEliminated({ id: g.id, k: 'garage' });
    for (let i = 0; i < 600 && s.st === 'play'; i++) app.upd(0.05);
  }
  // Misión 3: tras la entrega en C queda la batería, el tren y el
  // portal. El helicóptero Tan ya murió al principio (la batería
  // cayó donde murió); levantarla con el winch, dejarla en la
  // plataforma y esperar al tren en C.
  if (s.mission.stage === 'ENTREGA_C' && s.mission.train) {
    if (s.mission.cargo.state === 'waiting') {
      s.P.x = s.mission.cargo.x;
      s.P.z = s.mission.cargo.z;
      for (let i = 0; i < 200 && s.mission.cargo.state === 'waiting'; i++)
        app.upd(0.05);
    }
    if (s.mission.cargo.state === 'carried') {
      s.P.x = s.mission.batteryPad.x;
      s.P.z = s.mission.batteryPad.z;
      for (let i = 0; i < 200 && s.mission.cargo.state === 'carried'; i++)
        app.upd(0.05);
    }
    // Esperar al tren en C (llega en ~67 s desde que arranca).
    s.P.x = s.mission.finish.x;
    s.P.z = s.mission.finish.z;
    for (let i = 0; i < 1800 && s.st === 'play'; i++) app.upd(0.05);
    if (s.mission.stage === 'PORTAL') {
      s.P.x = s.mission.portal.x;
      s.P.z = s.mission.portal.z;
      for (let i = 0; i < 600 && s.st === 'play'; i++) app.upd(0.05);
    }
  }
}
test('campaign integrates rescue, extraction, next mission and play again', () => {
  const g = game();
  g.element('go').onclick();
  for (let n = 1; n <= 3; n++) {
    assert.equal(g.state.mis, n);
    completeMission(g);
    assert.equal(g.state.st, n === 3 ? 'campaign' : 'win');
    const score = g.state.P.sc;
    g.app.upd(0.05);
    assert.equal(g.state.P.sc, score);
    g.element('go').onclick();
  }
  assert.equal(g.state.mis, 1);
  assert.equal(g.state.P.sc, 0);
});
test('lethal damage prevents same-frame healing; retry preserves checkpoint and mission', () => {
  const g = game(),
    s = g.state;
  g.app.start(2, true);
  s.checkpoint = 250;
  s.P.sc = 345;
  s.P.arm = 1;
  s.E = [];
  s.PK = [{ x: 0, z: 0, ty: 'a' }];
  s.EB = [{ x: s.P.x, y: s.P.y, z: s.P.z, vx: 0, vy: 0, vz: 0, l: 1 }];
  g.app.upd(0.05);
  assert.equal(s.st, 'over');
  assert.equal(s.P.arm, 0);
  g.element('go').onclick();
  assert.equal(s.st, 'play');
  assert.equal(s.mis, 2);
  assert.equal(s.P.sc, 250);
  assert.equal(s.P.arm, 10);
  assert.equal(s.mission.rescued, 0);
});
test('chase flight advances, reverses and steers continuously with camera alignment', () => {
  for (const k of ['w', 's', 'a', 'd']) {
    const g = game(),
      s = g.state;
    g.app.start(1, true);
    s.E = [];
    // La salida A ya no es fija en (0, 0): se mide el desplazamiento
    // desde donde arranca el jugador, no desde el origen.
    const startX = s.P.x,
      startZ = s.P.z;
    key(g, k);
    for (let i = 0; i < 20; i++) {
      const before = s.P.yaw;
      g.app.upd(0.03);
      assert.ok(Math.abs(s.P.yaw - before) <= 1.8 * 0.03 + 1e-9);
      assert.equal(g.app.view.cam.yaw, s.P.yaw);
    }
    if (k === 'w' || k === 's') {
      assert.equal(s.P.yaw, 0);
      assert.ok((s.P.z - startZ) * (k === 'w' ? 1 : -1) > 0);
    } else {
      assert.equal(s.P.x, startX);
      assert.equal(s.P.z, startZ);
      assert.ok(s.P.yaw * (k === 'a' ? 1 : -1) > 0);
    }
    g.app.input.clear();
    const pos = [s.P.x, s.P.z, s.P.yaw];
    g.app.upd(0.03);
    assert.deepEqual([s.P.x, s.P.z, s.P.yaw], pos);
  }
});
test('joystick changes direction without release, keeps firing independent and clears on cancel', () => {
  const g = game(),
    s = g.state;
  g.app.start(1, true);
  s.E = [];
  const startZ = s.P.z;
  const c = g.element('world3d');
  c.emit('pointerdown', { pointerId: 1, clientX: 40, clientY: 200 });
  c.emit('pointermove', { pointerId: 1, clientX: 40, clientY: 130 });
  g.app.upd(0.03);
  assert.ok(s.P.z > startZ);
  assert.equal(s.P.yaw, 0);
  const z = s.P.z;
  c.emit('pointermove', { pointerId: 1, clientX: 40, clientY: 270 });
  g.app.upd(0.03);
  assert.ok(s.P.z < z);
  assert.equal(s.P.yaw, 0);
  g.element('fu').emit('pointerdown', { pointerId: 2 });
  c.emit('pointermove', { pointerId: 1, clientX: 110, clientY: 130 });
  g.app.upd(0.03);
  assert.ok(s.P.yaw < 0);
  assert.ok(s.BL.length > 0);
  c.emit('pointercancel', { pointerId: 1 });
  const pos = [s.P.x, s.P.z, s.P.yaw];
  g.app.upd(0.03);
  assert.deepEqual([s.P.x, s.P.z, s.P.yaw], pos);
  assert.equal(g.app.input.read().fire, true);
  g.app.pauseGame();
  assert.equal(g.app.input.read().fire, false);
});
test('paused menus preserve mission; abandon requires confirmation; preferences synchronize', () => {
  const g = game(),
    s = g.state;
  for (const id of ['menuHelp', 'menuSettings', 'menuCredits']) {
    g.element(id).onclick();
    g.element('back').onclick();
    assert.equal(s.st, 'menu');
  }
  g.app.start(2, true);
  s.P.sc = 345;
  s.P.x = 41;
  key(g, 'w');
  g.host.emit('blur');
  assert.equal(s.st, 'paused');
  const time = s.t;
  g.app.upd(0.05);
  assert.equal(s.t, time);
  g.element('menuSettings').onclick();
  key(g, 'p');
  assert.equal(s.st, 'paused');
  g.element('menuSound').onclick();
  assert.equal(
    g.element('sound').textContent,
    g.element('menuSound').textContent,
  );
  g.element('menuQuality').onclick();
  assert.equal(g.saved.get('toy-quality'), 'low');
  g.element('back').onclick();
  g.element('go').onclick();
  assert.equal(s.st, 'play');
  assert.equal(s.P.x, 41);
  assert.equal(s.P.sc, 345);
  key(g, 'Escape');
  g.element('menuExit').onclick();
  g.element('back').onclick();
  assert.equal(s.P.sc, 345);
  g.element('menuExit').onclick();
  g.element('confirmExit').onclick();
  assert.equal(s.st, 'menu');
  assert.equal(s.P, null);
  g.element('go').onclick();
  assert.equal(s.P.sc, 0);
});
test('economy drawing cadence does not slow simulation and hidden/paused views stop work', () => {
  const g = game(),
    s = g.state;
  g.app.start(1, true);
  s.E = [];
  s.lowQuality = true;
  let draws = 0;
  g.app.view.draw = () => draws++;
  for (let i = 1; i <= 60; i++) g.app.loop((i * 1000) / 60);
  assert.equal(draws, 30);
  assert.ok(Math.abs(s.t - 1) < 1e-8);
  g.app.pauseGame();
  g.app.loop(1016);
  const d = draws,
    t = s.t;
  g.app.loop(1032);
  assert.equal(draws, d);
  assert.equal(s.t, t);
  g.host.document.hidden = true;
  s.needsDraw = true;
  g.app.loop(1048);
  assert.equal(draws, d);
});
test('seeded missions reproduce spawns and terrain heights; 3D draw without WebGL shows the required message', () => {
  const a = game(78),
    b = game(78);
  a.app.start(2, true);
  b.app.start(2, true);
  assert.deepEqual(a.state.E, b.state.E);
  const world = a.state.world;
  for (const e of a.state.E) {
    assert.equal(e.y, e.k === 'heli' ? 8 : world.height(e.x, e.z));
    assert.ok(world.clearOfLandmarks(e.x, e.z, 10));
  }
  a.state.mission.transition('COMBATE_RUTA_AB');
  assert.doesNotThrow(() => a.app.draw3d.draw(a.app.view));
  a.app.pauseGame();
  assert.doesNotThrow(() => a.app.draw3d.draw(a.app.view));
});
test('assisted bullets hit offset infantry without turning the player', () => {
  // Mapa fijo de la misión 1: la geometría del disparo depende de su
  // ruta. El objetivo va junto a la ruta, 35 u desde A y 5 u a un
  // lado, sobre el camino llano.
  const g = game(123),
    s = g.state;
  g.app.start(1, true);
  s.E = [];
  const target = g.app.spawnE('inf', -90, 100);
  const route = s.world.routes[0];
  let [tx, tz] = route[0];
  let left = 35;
  for (let j = 1; j < route.length && left > 0; j++) {
    const [bx, bz] = route[j],
      len = Math.hypot(bx - tx, bz - tz);
    if (len >= left) {
      tx += ((bx - tx) / len) * left;
      tz += ((bz - tz) / len) * left;
      left = 0;
    } else {
      tx = bx;
      tz = bz;
      left -= len;
    }
  }
  const rdx = route[1][0] - route[0][0],
    rdz = route[1][1] - route[0][1],
    rdl = Math.hypot(rdx, rdz);
  target.x = tx + (-rdz / rdl) * 5;
  target.z = tz + (rdx / rdl) * 5;
  // La altura del suelo del mundo activo de la partida, no la del
  // mundo por defecto: con otro relieve, el objetivo quedaría flotando
  // (o enterrado) y la bala pasaría por encima (o por debajo).
  target.y = s.world.height(target.x, target.z);
  target.cd = 999;
  // El jugador mira hacia la ruta antes de disparar: la asistencia
  // solo actúa en un cono estrecho y el objetivo está junto al
  // camino, no en línea recta hacia adelante. Lo que comprueba el
  // test es que no gira durante el disparo.
  const yaw0 = Math.atan2(rdx, rdz);
  s.P.yaw = yaw0;
  g.element('fu').emit('pointerdown', { pointerId: 1 });
  g.app.upd(0.01);
  g.element('fu').emit('pointerup', { pointerId: 1 });
  // Aislar el disparo asistido del jugador: las balas aliadas, ahora más
  // rápidas, también alcanzarían al objetivo dentro de la ventana y lo
  // matarían antes de comprobar el impacto del jugador.
  s.BL = s.BL.filter((b) => b.vy < 0);
  for (let i = 0; i < 8; i++) g.app.upd(0.04);
  assert.equal(target.hp, 1);
  assert.equal(s.P.yaw, yaw0);
});
test('result panels preserve retry/next actions and Escape navigates without losing state', () => {
  for (const [state, expected] of [
    ['over', 2],
    ['win', 3],
    ['campaign', 1],
  ]) {
    const g = game();
    g.app.start(state === 'campaign' ? 3 : 2, true);
    g.app.setState(state);
    g.element('menuCredits').onclick();
    key(g, 'Escape');
    assert.equal(g.state.st, state);
    g.element('go').onclick();
    assert.equal(g.state.mis, expected);
  }
  const g = game();
  let prevented = false;
  g.host.emit('keydown', {
    key: ' ',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, false);
});
