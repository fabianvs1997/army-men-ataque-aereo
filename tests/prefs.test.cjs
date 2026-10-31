const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  Prefs = require('../src/prefs.js');
test('preferences survive writes and blocked storage access uses defaults', () => {
  const data = new Map(),
    p = Prefs.create(() => ({
      getItem: (k) => data.get(k),
      setItem: (k, v) => data.set(k, v),
    }));
  assert.equal(p.preference('muted', 'false'), 'false');
  p.savePreference('muted', 'true');
  assert.equal(p.preference('muted', 'false'), 'true');
  const denied = Prefs.create(() => {
    throw Error('blocked');
  });
  assert.equal(denied.preference('quality', 'detail'), 'detail');
  assert.doesNotThrow(() => denied.savePreference('quality', 'low'));
});
