const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
      Object.defineProperty(window, 'ToyGame', {
        configurable: true,
        set(api) {
          const create = api.create;
          api.create = (...a) =>
            (window.fixtureGame = create(a[0], {
              ...a[1],
              random: (() => {
                let seed = 1;
                return () =>
                  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) /
                  4294967296;
              })(),
              visualRandom: (() => {
                let seed = 123;
                return () =>
                  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) /
                  4294967296;
              })(),
            }));
          Object.defineProperty(window, 'ToyGame', {
            value: api,
            configurable: true,
          });
        },
      });
    });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    await page.waitForFunction(() => window.fixtureGame);
    await page.evaluate(() => {
      const g = fixtureGame;
      g.start(1, true);
      g.upd(0.01);
      g.draw3d.draw();
    });
    assert.match(
      await page.locator('#objective').textContent(),
      /Dirígete a la base B/,
    );
    await page.screenshot({ path: '/tmp/escort-A.png' });
    const blocked = await page.evaluate(() => {
      const g = fixtureGame,
        s = g.state,
        m = s.mission,
        a = m.allies.find((a) => a.wounded);
      s.P.x = a.x;
      s.P.z = a.z;
      s.P.inv = 100;
      for (let i = 0; i < 40; i++) g.upd(0.05);
      g.draw3d.draw();
      return { stage: m.stage, boarded: m.rescued, guards: m.guards.length };
    });
    assert.deepEqual(blocked, { stage: 'DESPEJAR_B', boarded: 0, guards: 4 });
    await page.screenshot({ path: '/tmp/escort-B.png' });
    const boarding = await page.evaluate(() => {
      const g = fixtureGame,
        s = g.state,
        m = s.mission;
      for (const e of m.threats(s.E)) g.combat.kill(e);
      s.EB = [];
      s.P.inv = 0;
      for (const a of m.allies.filter((a) => a.wounded)) {
        s.P.x = a.x;
        s.P.z = a.z;
        for (let i = 0; i < 35; i++) g.upd(0.05);
      }
      g.draw3d.draw();
      return {
        stage: m.stage,
        boarded: m.rescued,
        ground: m.allies.filter((a) => !a.wounded && a.state !== 'A_BORDO')
          .length,
      };
    });
    assert.deepEqual(boarding, { stage: 'ESCOLTAR_BC', boarded: 3, ground: 4 });
    await page.screenshot({ path: '/tmp/escort-column.png' });
    const result = await page.evaluate(() => {
      const g = fixtureGame,
        s = g.state,
        m = s.mission;
      s.P.x = m.finish.x;
      s.P.z = m.finish.z;
      for (let i = 0; i < 60; i++) g.upd(0.05);
      const early = s.st;
      // Clear the escort ambush, as the player must, before waiting for the column.
      for (const e of s.E.filter((e) => e.zone === 'BC')) g.combat.kill(e);
      s.EB = [];
      let speedOK = true;
      for (let i = 0; i < 2200 && s.st === 'play'; i++) {
        const old = m.allies.map((a) => ({ x: a.x, z: a.z }));
        g.upd(0.05);
        m.allies.forEach((a, j) => {
          if (
            !a.wounded &&
            Math.hypot(a.x - old[j].x, a.z - old[j].z) >
              m.rules.soldierSpeed * 0.05 * 1.1
          )
            speedOK = false;
        });
      }
      g.draw3d.draw();
      return {
        early,
        final: s.st,
        speedOK,
        delivered: m.delivered,
        stars: m.stars,
        progress: JSON.parse(localStorage.getItem(ToyEscortConfig.progressKey)),
        soldiers: m.allies.map((a) => ({
          id: a.id,
          state: a.state,
          cause: a.cause,
          x: a.x,
          z: a.z,
          waypoint: a.waypoint,
        })),
      };
    });
    assert.equal(result.early, 'play');
    assert.equal(result.final, 'win', JSON.stringify(result));
    assert.equal(result.speedOK, true);
    assert.equal(
      result.delivered,
      7,
      'cleared route must not cause navigation casualties',
    );
    assert.ok(result.progress.missions[1]);
    await page.screenshot({ path: '/tmp/escort-result.png' });
    // Five resets in the actual browser preserve exact force counts and stored result.
    assert.equal(
      await page.evaluate(() => {
        const g = fixtureGame,
          saved = localStorage.getItem(ToyEscortConfig.progressKey);
        let ok = true;
        for (let i = 0; i < 5; i++) {
          g.start(1, true, true);
          ok &&=
            g.state.E.length === g.state.mission.enemyPlan.length &&
            g.state.mission.allies.length === 7 &&
            g.state.mission.guards.length === 4;
        }
        return (
          ok && localStorage.getItem(ToyEscortConfig.progressKey) === saved
        );
      }),
      true,
    );
    assert.equal(
      await page.evaluate(() => {
        const g = fixtureGame,
          s = g.state,
          seed = s.mapSeed;
        const old = JSON.stringify(s.world.roads);
        g.start(1, true, true);
        if (s.mapSeed !== seed || JSON.stringify(s.world.roads) !== old)
          return false;
        g.start(2, false);
        g.draw3d.draw();
        return (
          s.mapSeed !== seed &&
          JSON.stringify(s.world.roads) !== old &&
          s.world.limit === 320 &&
          s.renderer3d.world === s.world &&
          s.renderer3d.meshes.terrain.count === s.world.mesh().length / 6
        );
      }),
      true,
    );
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => {
      const g = fixtureGame;
      g.rs();
      g.view.renderer3d = null;
      // Sin WebGL no hay respaldo 2D: draw3d muestra el mensaje.
      g.upd(0.01);
      g.draw3d.draw();
    });
    // Allow the browser resize event to finish before the final draw.
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      fixtureGame.rs();
      fixtureGame.draw3d.draw();
    });
    await page.screenshot({ path: '/tmp/escort-webgl-required.png' });
    assert.deepEqual(errors, []);
    console.log(
      'PASS escort browser: A guards, B blocking and selective boarding, real ground escort, delayed C victory, persisted stars, five resets, WebGL/landscape. ' +
        JSON.stringify(result),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
