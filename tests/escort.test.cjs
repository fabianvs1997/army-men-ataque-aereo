const test = require('node:test'),
  assert = require('node:assert/strict');
const { Mission, objectives } = require('../src/escort-mission.js');
test('escort transitions reject skips and emit each authorized transition once', () => {
  const m = new Mission();
  assert.equal(m.transition('COMPLETADA'), false);
  for (const next of [
    'COMBATE_RUTA_AB',
    'DESPEJAR_B',
    'EMBARCAR_HERIDOS',
    'ESCOLTAR_BC',
    'ENTREGA_C',
    'COMPLETADA',
  ]) {
    assert.equal(m.transition(next), true);
    assert.equal(m.message, objectives[next]);
    assert.equal(m.transition(next), false);
  }
  assert.equal(m.drainEvents().length, 6);
  assert.equal(m.drainEvents().length, 0);
  assert.equal(m.transition('FRACASADA'), false);
});
test('A guards and B squad are distinct and all enemies are predeclared outside A', () => {
  const c = require('../src/escort-config.js'),
    World = require('../src/toy-world.js');
  for (let n = 1; n <= 3; n++) {
    const m = new Mission(n);
    assert.equal(m.guards.length, 4);
    assert.equal(m.allies.filter((a) => a.wounded).length, 3);
    assert.ok(m.guards.every((a) => a.group === 'A'));
    assert.ok(m.allies.every((a) => a.group === 'B'));
    assert.equal(new Set(m.guards.concat(m.allies).map((a) => a.id)).size, 11);
    assert.equal(m.enemyPlan.filter((e) => e.k === 'heli').length, n);
    for (const e of m.enemyPlan) {
      assert.ok(Math.hypot(e.x, e.z) > c.safeRadius + 3);
      assert.ok(World.canTravel(e.x, e.z), e.id);
    }
  }
});
const tick = (m, p, seconds, env = {}) => {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) m.update(0.05, p, env);
};
test('B boarding requires local clearance, accepts only wounded and resets interrupted holds', () => {
  const m = new Mission(),
    b = m.rules.B,
    a = m.allies.find((a) => a.wounded),
    threat = { id: 'blocker', x: b.x + 20, z: b.z, y: 0, k: 'tank', hp: 10 };
  tick(m, a, 2, { enemies: [threat] });
  assert.equal(m.stage, 'DESPEJAR_B');
  assert.equal(m.rescued, 0);
  m.damageSoldier(a, 100);
  assert.ok(a.hp > 0, 'wounded are protected during clearance');
  tick(m, a, 1, { enemies: [] });
  assert.equal(a.state, 'ABORDANDO');
  tick(m, a, 0.1, { enemies: [threat] });
  assert.equal(a.hold, 0);
  const distant = { ...threat, x: 0, z: 0 };
  tick(m, a, 2, { enemies: [distant] });
  assert.equal(a.state, 'A_BORDO');
  for (const soldier of m.allies.filter((a) => a.wounded))
    tick(m, soldier, 2, { enemies: [] });
  assert.equal(m.rescued, 3);
  assert.equal(m.stage, 'ESCOLTAR_BC');
  assert.ok(
    m.allies
      .filter((a) => !a.wounded)
      .every((a) => a.state === 'MARCHANDO_A_C'),
  );
});
test('healthy soldiers fire autonomously only with line of sight; losses emit once', () => {
  const m = new Mission(),
    a = m.allies[0];
  let shots = 0;
  const env = {
    groundAt: () => 0,
    enemies: [{ x: a.x + 10, z: a.z, y: 0, hp: 10, k: 'inf' }],
    fireAlly: () => shots++,
    cover: { trace: () => ({ t: 0.5 }) },
  };
  m.defend(a, 1, env);
  assert.equal(shots, 0);
  env.cover.trace = () => null;
  m.defend(a, 1, env);
  assert.equal(shots, 1);
  assert.equal(m.damageSoldier(a, 100), true);
  assert.equal(m.damageSoldier(a, 100), false);
  assert.equal(
    m.drainEvents().filter((e) => e.type === 'soldier-fallen').length,
    1,
  );
});
test('no waiting wounded explicitly starts escort and configured capacity limits generation', () => {
  const c = require('../src/escort-config.js');
  const m = new Mission(1, { ...c, wounded: 0 });
  tick(m, c.B, 0.1);
  assert.equal(m.stage, 'ESCOLTAR_BC');
  assert.equal(
    new Mission(1, { ...c, wounded: 20 }).allies.filter((a) => a.wounded)
      .length,
    c.capacity,
  );
});
function escorted(config) {
  const m = new Mission(1, config);
  tick(m, m.rules.B, 0.1);
  for (const a of m.allies.filter((a) => a.wounded)) tick(m, a, 2);
  return m;
}
test('ground escort reaches C through real terrain without exceeding speed or crossing hills', () => {
  const World = require('../src/toy-world.js'),
    Collision = require('../src/collision.js');
  const m = escorted(),
    env = {
      groundAt: World.height,
      cover: Collision.create({ DC: World.shrubs, DB: [] }, World),
      enemies: [],
    };
  for (
    let i = 0;
    i < 1800 && m.allies.some((a) => !a.wounded && a.state !== 'SEGURO_EN_C');
    i++
  ) {
    const old = m.allies.map((a) => ({ ...a }));
    m.update(0.05, m.finish, env);
    m.allies.forEach((a, j) => {
      assert.ok(
        Math.hypot(a.x - old[j].x, a.z - old[j].z) <=
          m.rules.soldierSpeed * 0.05 * 1.1,
      );
      if (!a.wounded)
        assert.ok(World.canTravel(a.x, a.z, m.rules.soldierRadius));
    });
  }
  assert.ok(
    m.allies.filter((a) => !a.wounded).every((a) => a.state === 'SEGURO_EN_C'),
  );
  assert.equal(m.delivered, m.rules.healthy + m.rules.wounded);
  tick(m, m.finish, 2, env);
  assert.equal(m.delivered, m.rules.healthy + m.rules.wounded);
});
test('blocked soldiers become explicit casualties after timeout instead of teleporting', () => {
  const c = require('../src/escort-config.js'),
    m = escorted({ ...c, stuckSeconds: 1 });
  const old = m.allies
    .filter((a) => !a.wounded)
    .map((a) => ({ x: a.x, z: a.z }));
  tick(m, m.finish, 2, {
    cover: { trace: () => null, move: (a) => ({ ...a }) },
  });
  m.allies
    .filter((a) => !a.wounded)
    .forEach((a, i) => {
      assert.equal(a.state, 'CAIDO');
      assert.deepEqual({ x: a.x, z: a.z }, old[i]);
    });
  assert.equal(
    m.drainEvents().filter((e) => e.reason === 'atasco').length,
    c.healthy,
  );
});
test('helicopter-only arrival cannot win; delivery is stable and counts each soldier once', () => {
  const m = escorted();
  tick(m, m.finish, 3, { cover: { trace: () => null, move: (a) => a } });
  assert.equal(m.stage, 'ENTREGA_C');
  assert.equal(m.complete, false);
  assert.equal(m.delivered, m.rules.wounded);
  assert.ok(
    m.allies.filter((a) => !a.wounded).every((a) => a.state !== 'SEGURO_EN_C'),
  );
  tick(m, m.finish, 90);
  assert.equal(m.complete, true);
  assert.equal(m.delivered, m.allies.length);
  assert.equal(m.stars, 3);
  tick(m, m.finish, 10);
  assert.equal(m.delivered, m.allies.length);
});
test('total squad loss fails, while surviving wounded can be delivered after ground casualties', () => {
  const m = escorted();
  for (const a of m.allies) {
    a.state = 'MARCHANDO_A_C';
    a.wounded = false;
    m.damageSoldier(a, 100);
  }
  tick(m, m.finish, 0.1);
  assert.equal(m.failed, true);
  assert.equal(m.complete, false);
  const survivor = escorted();
  for (const a of survivor.allies.filter((a) => !a.wounded))
    survivor.damageSoldier(a, 100);
  tick(survivor, survivor.finish, 3);
  assert.equal(survivor.complete, true);
  assert.equal(survivor.stars, 1);
});
test('versioned progress keeps best results and tolerates missing or corrupt storage', () => {
  const Progress = require('../src/escort-progress.js');
  let saved = null;
  const store = Progress.create(() => ({
    getItem: () => saved,
    setItem: (_, v) => (saved = v),
  }));
  assert.deepEqual(store.read().missions, {});
  assert.equal(store.record(1, { complete: false }), false);
  assert.equal(
    store.record(1, { complete: true, stars: 3, delivered: 7 }),
    true,
  );
  store.record(1, { complete: true, stars: 1, delivered: 2 });
  assert.deepEqual(store.read().missions[1], { stars: 3, saved: 7 });
  saved = '{broken';
  assert.deepEqual(store.read().missions, {});
  const missing = Progress.create(() => {
    throw Error('blocked');
  });
  assert.deepEqual(missing.read().missions, {});
  assert.equal(
    missing.record(1, { complete: true, stars: 1, delivered: 1 }),
    false,
  );
});
