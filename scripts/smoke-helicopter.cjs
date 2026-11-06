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
        viewport: { width: 700, height: 700 },
      }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
      Object.defineProperty(window, 'ToyGame', {
        configurable: true,
        set(api) {
          const create = api.create;
          api.create = (...a) => (window.fixtureGame = create(...a));
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
      const g = window.fixtureGame;
      g.start(1, true);
      g.state.E = [];
      g.state.F = 25;
      g.state.P.yaw = 3.7;
      g.state.rot = 0.55;
      g.state.P.pitch = 0;
      g.view.cam.yaw = 1;
      g.draw3d.draw();
    });
    assert.equal(
      await page.locator('#world3d').evaluate((e) => e.style.display),
      'block',
    );
    await page.screenshot({ path: '/tmp/gunship-webgl.png' });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.state.P.pitch = 0.32;
      g.state.rot = 1.4;
      g.draw3d.draw();
    });
    await page.screenshot({ path: '/tmp/gunship-tilted.png' });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.view.renderer3d = null;
      // Sin WebGL no hay respaldo 2D: draw3d muestra el mensaje.
      g.state.P.pitch = 0;
      g.state.rot = 0.55;
      g.draw3d.draw();
    });
    await page.screenshot({ path: '/tmp/gunship-webgl-required.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.rs();
      g.view.cam.yaw = g.state.P.yaw;
      g.draw3d.draw();
    });
    assert.deepEqual(errors, []);
    console.log(
      'PASS gunship: shared player model renders with rotor animation and pitch, WebGL, portrait resize; no JS errors',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
