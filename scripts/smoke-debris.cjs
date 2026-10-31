// Development fixture: deterministic impacts in the real file:// game, both renderers.
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
        viewport: { width: 844, height: 600 },
      }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
      Object.defineProperty(window, 'ToyGame', {
        configurable: true,
        set(api) {
          const create = api.create;
          api.create = (...args) => (window.fixtureGame = create(...args));
          Object.defineProperty(window, 'ToyGame', {
            value: api,
            configurable: true,
          });
        },
      });
    });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    await page.waitForFunction(() => window.fixtureGame);
    const result = await page.evaluate(() => {
      const g = window.fixtureGame,
        s = g.state;
      g.start(1, true);
      s.E = [];
      s.P.x = 0;
      s.P.z = 0;
      s.P.y = 8;
      Object.assign(g.view.cam, { x: 0, z: 30, yaw: 0 });
      for (const [i, k] of ['inf', 'tank', 'tur', 'heli', 'base'].entries())
        g.spawnE(k, (i - 2) * 19, 30);
      s.E.forEach((e) => (e.cd = 999));
      // A real swept bullet chips the tank; not a renderer-only particle injection.
      const tank = s.E[1];
      s.BL = [
        {
          x: tank.x,
          y: tank.y + 1.5,
          z: tank.z - 10,
          vx: 0,
          vy: 0,
          vz: 400,
          l: 1,
        },
      ];
      g.combat.stepProjectiles(0.05);
      if (tank.hp !== 5 || s.DB.length !== 4)
        throw Error('Impact did not chip tank');
      if (s.FX.length) throw Error('Unexpected fireball');
      for (const e of s.E) g.combat.hit(e, 100);
      s.E = s.E.filter((e) => !e.dead);
      s.BL = [];
      for (let i = 0; i < 30; i++) g.combat.stepDebris(1 / 60);
      g.render2d.draw();
      return {
        pieces: s.DB.length,
        webgl: document.getElementById('world3d').style.display,
      };
    });
    assert.ok(result.pieces > 60);
    assert.equal(result.webgl, 'block');
    await page.screenshot({
      path: process.env.DEBRIS_SCREENSHOT || '/tmp/plastic-airborne.png',
    });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      for (let i = 0; i < 600; i++) g.combat.stepDebris(1 / 60);
      if (!g.state.DB.every((p) => p.settled))
        throw Error('Unsettled wreckage');
      g.render2d.draw();
    });
    await page.screenshot({ path: '/tmp/plastic-settled.png' });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.view.renderer3d = null;
      document.getElementById('world3d').style.display = 'none';
      document.getElementById('c').style.opacity = '1';
      g.render2d.draw();
    });
    await page.screenshot({ path: '/tmp/plastic-canvas.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.fixtureGame.render2d.draw());
    assert.deepEqual(errors, []);
    console.log(
      'PASS debris: swept hit, five enemy types, no fireballs, landing, WebGL and Canvas, portrait/landscape; no JS errors',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
