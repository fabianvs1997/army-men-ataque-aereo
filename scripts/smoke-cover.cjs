// Development-only real-browser coverage fixture on the existing watering can.
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
      Object.assign(s.P, { x: -45, y: 8, z: -45, arm: 10, inv: 0 });
      const fire = (x) => {
        s.EB = [{ x, y: 8, z: -20, vx: 0, vy: 0, vz: -200, l: 1 }];
        g.combat.stepProjectiles(0.2);
      };
      fire(-45);
      const sheltered = s.P.arm;
      s.P.x = -60;
      s.P.inv = 0;
      fire(-60);
      const exposed = s.P.arm;
      const stopped = g.view.cover.move(
        { x: -45, y: 8, z: -45 },
        { x: -45, y: 8, z: -22 },
      );
      const over = g.view.cover.move(
        { x: -45, y: 25, z: -45 },
        { x: -45, y: 25, z: -22 },
      );
      Object.assign(s.P, { x: -45, y: 8, z: -45, arm: 10, inv: 0 });
      s.EB = [];
      Object.assign(g.view.cam, { x: -45, z: -33, yaw: 0.5 });
      g.render2d.draw();
      return {
        sheltered,
        exposed,
        z: stopped.z,
        over: over.z,
        webgl: document.getElementById('world3d').style.display,
      };
    });
    assert.equal(result.sheltered, 10);
    assert.ok(result.exposed < 10);
    assert.ok(result.z < -38);
    assert.equal(result.over, -22);
    assert.equal(result.webgl, 'block');
    await page.screenshot({ path: '/tmp/cover-webgl.png' });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.view.renderer3d = null;
      document.getElementById('world3d').style.display = 'none';
      document.getElementById('c').style.opacity = '1';
      g.render2d.draw();
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.fixtureGame.render2d.draw());
    await page.screenshot({ path: '/tmp/cover-canvas.png' });
    assert.deepEqual(errors, []);
    console.log(
      'PASS cover: watering can shields player, exposed shot damages, movement blocked at height, clearance above, WebGL/Canvas and both orientations',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
