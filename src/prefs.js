(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyPrefs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create(getStorage) {
    function preference(key, fallback) {
      try {
        return getStorage().getItem('toy-' + key) || fallback;
      } catch (e) {
        return fallback;
      }
    }
    function savePreference(key, value) {
      try {
        getStorage().setItem('toy-' + key, value);
      } catch (e) {}
    }
    return { preference, savePreference };
  }
  return { create };
});
