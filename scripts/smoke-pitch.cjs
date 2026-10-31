// Real file:// renderer and keyboard input, with manually advanced frames for repeatability.
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
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.start(1, true);
      g.state.E = [];
      g.state.airLeft = 0;
      g.view.cam.yaw = 0;
    });
    await page.keyboard.down('w');
    const moving = await page.evaluate(() => {
      const g = window.fixtureGame;
      for (let i = 0; i < 40; i++) g.upd(1 / 60);
      return g.state.P.pitch;
    });
    assert.ok(moving > 0.3);
    const draw = () =>
      page.evaluate(() => {
        const g = window.fixtureGame;
        Object.assign(g.view.cam, { x: g.state.P.x, z: g.state.P.z, yaw: 1 });
        g.state.F = 12;
        g.render2d.draw();
      });
    await draw();
    assert.equal(
      await page.locator('#world3d').evaluate((e) => e.style.display),
      'block',
    );
    await page.screenshot({
      path: '/tmp/pitch-moving.png',
      clip: { x: 250, y: 170, width: 340, height: 280 },
    });
    await page.keyboard.up('w');
    const braking = await page.evaluate(() => {
      const g = window.fixtureGame;
      for (let i = 0; i < 12; i++) g.upd(1 / 60);
      return g.state.P.pitch;
    });
    assert.ok(braking < -0.05);
    await draw();
    await page.screenshot({
      path: '/tmp/pitch-braking.png',
      clip: { x: 250, y: 170, width: 340, height: 280 },
    });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.view.renderer3d = null;
      document.getElementById('world3d').style.display = 'none';
      document.getElementById('c').style.opacity = '1';
    });
    await draw();
    await page.screenshot({
      path: '/tmp/pitch-canvas.png',
      clip: { x: 250, y: 170, width: 340, height: 280 },
    });
    const level = await page.evaluate(() => {
      const g = window.fixtureGame;
      for (let i = 0; i < 180; i++) g.upd(1 / 60);
      g.render2d.draw();
      return g.state.P.pitch;
    });
    assert.ok(Math.abs(level) < 0.001);
    await page.setViewportSize({ width: 390, height: 844 });
    await draw();
    assert.deepEqual(errors, []);
    console.log(
      'PASS pitch: keyboard movement nose-down, release nose-up, smooth return to level, WebGL and Canvas, both orientations; no JS errors',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
