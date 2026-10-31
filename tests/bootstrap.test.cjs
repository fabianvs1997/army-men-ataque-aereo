const test = require('node:test');
const assert = require('node:assert/strict');
const bootstrap = require('../src/bootstrap.js');
test('bootstrap versions every asset and initializes only after ordered loads', async () => {
  const loaded = [];
  let created = 0;
  const style = {
    set href(value) {
      loaded.push(value);
      queueMicrotask(() => this.onload());
    },
  };
  const host = {
    document: {
      querySelector: () => style,
      createElement: () => ({}),
      body: {
        appendChild(script) {
          loaded.push(script.src);
          queueMicrotask(() => script.onload());
        },
      },
    },
    ToyGame: {
      create() {
        created++;
        return 'game';
      },
    },
  };
  const pending = bootstrap.start(host);
  assert.equal(created, 0);
  assert.equal(await pending, 'game');
  assert.equal(created, 1);
  assert.deepEqual(
    loaded,
    [
      'styles.css',
      ...bootstrap.scripts.map((name) => 'src/' + name + '.js'),
    ].map(bootstrap.asset),
  );
});
test('bootstrap stops on failed asset instead of initializing a partial game', async () => {
  let created = false;
  const style = {
    set href(value) {
      queueMicrotask(() => this.onload());
    },
  };
  const host = {
    document: {
      querySelector: () => style,
      createElement: () => ({}),
      body: {
        appendChild(script) {
          queueMicrotask(() => script.onerror());
        },
      },
    },
    ToyGame: {
      create() {
        created = true;
      },
    },
  };
  await assert.rejects(bootstrap.start(host), /Could not load toy-missions/);
  assert.equal(created, false);
});
