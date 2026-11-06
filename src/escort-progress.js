(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports
      ? require('./escort-config.js')
      : root.ToyEscortConfig,
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyEscortProgress = api;
})(globalThis, function (Config) {
  'use strict';
  function create(getStorage) {
    function read() {
      const empty = { version: Config.progressVersion, missions: {} };
      try {
        const data = JSON.parse(getStorage().getItem(Config.progressKey));
        if (data?.version !== Config.progressVersion || !data.missions)
          return empty;
        for (const key of ['1', '2', '3']) {
          const item = data.missions[key];
          if (
            item &&
            Number.isInteger(item.stars) &&
            item.stars >= 1 &&
            item.stars <= 3 &&
            Number.isInteger(item.saved) &&
            item.saved > 0 &&
            item.saved <= Config.healthy + Config.capacity
          )
            empty.missions[key] = { stars: item.stars, saved: item.saved };
        }
      } catch (_) {}
      return empty;
    }
    function record(number, mission) {
      if (!mission.complete || number < 1 || number > 3 || !mission.delivered)
        return false;
      const data = read(),
        old = data.missions[number] || { stars: 0, saved: 0 };
      data.missions[number] = {
        stars: Math.max(old.stars, mission.stars),
        saved: Math.max(old.saved, mission.delivered),
      };
      try {
        getStorage().setItem(Config.progressKey, JSON.stringify(data));
        return true;
      } catch (_) {
        return false;
      }
    }
    return { read, record };
  }
  return { create };
});
