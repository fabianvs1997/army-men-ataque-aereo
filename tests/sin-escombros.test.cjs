const { test } = require('node:test');
const assert = require('node:assert/strict');
const Combat = require('../src/combat.js');
const { game } = require('../support/fake-host.cjs');

// Sin escombros (2026-11-07, pedido de Fabian): al destruir un enemigo
// no queda ningún resto en el suelo — ni pecio, ni cubitos, ni piezas
// desprendidas —, solo la explosión (bola de fuego + humo, que se
// apagan solos). Los restos se acumulaban, saturaban el juego y
// cerraban el camino al pelotón (un soldado moría de atasco ~1 de
// cada 5 partidas). state.DB solo guarda las marcas de aliado caído.

const enemy = (k, hp = 2) => ({
  x: 0,
  y: 0,
  z: 0,
  k,
  hp,
  r: 2,
  p: 10,
  cd: 999,
});
const state = () => ({
  P: { x: 0, y: 8, z: 0, sc: 0 },
  DB: [],
  FX: [],
  SM: [],
  PK: [],
  E: [],
  bd: 0,
  mission: { enemyEliminated() {}, release() {} },
});

test('matar un enemigo de cada tipo no deja ningún resto', () => {
  const s = state();
  for (const k of ['inf', 'tank', 'tur', 'heli', 'base', 'garage', 'car']) {
    const e = enemy(k, 1);
    assert.equal(Combat.kill(s, e, { random: () => 0.9 }), true);
    assert.equal(e.dead, 1);
  }
  assert.equal(s.DB.length, 0);
});

test('30 bajas seguidas no acumulan nada en el suelo', () => {
  const s = state();
  const env = {
    state: s,
    FX: s.FX,
    SM: s.SM,
    E: [],
    BL: [],
    EB: [],
    MS: [],
    groundAt: () => 0,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    sfx: {},
    buzz: () => {},
    ToyMissions: require('../src/toy-missions.js'),
    cover: { trace: () => null },
    hurt: () => {},
    P: s.P,
    st: 'play',
  };
  const combat = Combat.create(env);
  const kinds = ['inf', 'tank', 'tur', 'heli'];
  for (let i = 0; i < 30; i++) {
    const e = enemy(kinds[i % kinds.length], 1);
    e.x = (i % 6) * 10;
    e.z = Math.floor(i / 6) * 10;
    assert.equal(combat.kill(e), true);
  }
  assert.equal(s.DB.length, 0);
  assert.equal(s.FX.length, 30, 'una bola de fuego por baja');
  assert.ok(s.SM.length > 0, 'el humo de las explosiones sigue existiendo');
  assert.ok(s.SM.length <= 160, 'el humo sigue acotado');
});

test('impactos que no matan tampoco dejan cubitos, pero el daño se sigue viendo', () => {
  const s = state();
  const heli = enemy('heli', 10);
  Combat.hit(s, heli, 1, {});
  assert.equal(heli.chips, 1);
  assert.equal(heli.detached, undefined, 'con 1 impacto el rotor sigue');
  assert.equal(s.DB.length, 0);
  Combat.hit(s, heli, 1, {});
  assert.equal(heli.chips, 2);
  assert.equal(heli.detached, true, 'con 2 impactos el rotor se ve caído');
  assert.equal(s.DB.length, 0, 'la pieza no cae al suelo');
  const base = enemy('base', 10);
  for (let i = 0; i < 3; i++) Combat.hit(s, base, 1, {});
  assert.equal(base.detached, undefined);
  Combat.hit(s, base, 1, {});
  assert.equal(base.detached, true, 'la base pierde el techo a los 4 impactos');
  assert.equal(s.DB.length, 0);
});

test('en el juego real, matar enemigos no deja restos y el aliado caído sigue marcándose', () => {
  const { app, state: s } = game(42);
  app.start(1, true);
  // Matar a todos los enemigos presentes en la misión 1.
  for (const e of [...s.E]) app.combat.kill(e);
  s.E = s.E.filter((e) => !e.dead);
  for (let i = 0; i < 10; i++) app.upd(0.05);
  assert.equal(s.DB.length, 0, 'ningún resto de enemigo');
  // Que caiga un aliado del pelotón: su cuerpo sí se marca (2 cajitas
  // verdes), que es la única marca visual de la baja.
  const ally = s.mission.allies.find((a) => !a.wounded);
  assert.ok(ally, 'hay un aliado sano en el pelotón');
  assert.equal(s.mission.damageSoldier(ally, 100), true);
  for (let i = 0; i < 10; i++) app.upd(0.05);
  assert.equal(ally.state, 'CAIDO');
  assert.equal(s.DB.length, 2, 'solo el cuerpo del aliado caído');
  assert.ok(
    s.DB.every(
      (p) => p.color[0] === 0.24 && p.color[1] === 0.65 && p.color[2] === 0.16,
    ),
    'las marcas son verdes, no restos de enemigo',
  );
  // Y matar más enemigos después no añade restos encima.
  for (const e of [...s.E]) app.combat.kill(e);
  for (let i = 0; i < 10; i++) app.upd(0.05);
  assert.equal(s.DB.length, 2, 'siguen siendo solo las marcas del caído');
});
