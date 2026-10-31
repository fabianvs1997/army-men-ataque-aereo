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
    const page = await browser.newPage(),
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
      const e = g.state.E.find((e) => e.k === 'base');
      const yaw = g.view.cam.yaw;
      Object.assign(g.state.P, {
        x: e.x - 35 * Math.sin(yaw),
        z: e.z - 35 * Math.cos(yaw),
        y: 8,
        yaw,
      });
      Object.assign(g.view.cam, { x: g.state.P.x, z: g.state.P.z });
    });
    for (const [name, width, height] of [
      ['portrait', 390, 844],
      ['landscape', 844, 390],
      ['square', 700, 700],
    ]) {
      await page.setViewportSize({ width, height });
      const framing = await page.evaluate(() => {
        const g = window.fixtureGame;
        g.rs();
        g.render2d.draw();
        return {
          point: g.render2d.P3(g.state.P.x, g.state.P.y, g.state.P.z),
          mode: document.getElementById('world3d').style.display,
        };
      });
      assert.equal(framing.mode, 'block');
      assert.ok(Math.abs(framing.point[0] - width / 2) < 1);
      assert.ok(Math.abs(framing.point[1] - height * 0.64) < 1);
      for (const id of ['pause', 'sound', 'mi', 'fu']) {
        const b = await page.locator('#' + id).boundingBox();
        assert.ok(
          b &&
            b.x >= 0 &&
            b.y >= 0 &&
            b.x + b.width <= width + 1 &&
            b.y + b.height <= height + 1,
        );
      }
      await page.screenshot({ path: '/tmp/camera-' + name + '.png' });
    }
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.view.renderer3d = null;
      document.getElementById('world3d').style.display = 'none';
      document.getElementById('c').style.opacity = '1';
      g.render2d.draw();
    });
    await page.screenshot({ path: '/tmp/camera-canvas.png' });
    assert.deepEqual(errors, []);
    console.log(
      'PASS camera: closer framing in portrait/landscape/square, player lower center, visible controls, WebGL and Canvas, no JS errors',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
