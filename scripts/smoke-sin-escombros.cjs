// Development fixture: deterministic impacts in the real file:// game, both renderers.
// Sin escombros: un impacto que no mata y las bajas no dejan ningún resto
// en el suelo (antes el impacto dejaba 4 cubitos y cada baja su pecio).
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
      if (tank.hp !== 5 || s.DB.length !== 0)
        throw Error('Impact left debris or did not chip tank');
      if (s.FX.length) throw Error('Unexpected fireball');
      for (const e of s.E) g.combat.hit(e, 100);
      s.E = s.E.filter((e) => !e.dead);
      s.BL = [];
      g.draw3d.draw();
      return {
        pieces: s.DB.length,
        webgl: document.getElementById('world3d').style.display,
      };
    });
    assert.equal(result.pieces, 0, 'ningún resto tras 5 bajas');
    assert.equal(result.webgl, 'block');
    await page.screenshot({
      path: process.env.NO_DEBRIS_SCREENSHOT || '/tmp/plastic-no-debris.png',
    });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.view.renderer3d = null;
      // Sin WebGL no hay respaldo 2D: draw3d muestra el mensaje.
      g.draw3d.draw();
    });
    await page.screenshot({ path: '/tmp/plastic-webgl-required.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.fixtureGame.draw3d.draw());
    assert.deepEqual(errors, []);
    console.log(
      'PASS no-debris: swept hit, five enemy types, no fireballs, no remains, WebGL, portrait/landscape; no JS errors',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
