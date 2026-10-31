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
    for (const direction of ['w', 'd', 's', 'a']) {
      await page.evaluate(() => {
        const g = window.fixtureGame;
        g.start(1, true);
        g.state.E = [];
        g.state.airLeft = 0;
      });
      await page.keyboard.down(direction);
      const values = await page.evaluate(() => {
        const g = window.fixtureGame;
        g.upd(1 / 60);
        const yaw = g.state.P.yaw;
        for (let i = 0; i < 30; i++) g.upd(1 / 60);
        g.render2d.draw();
        const p = g.state.P;
        return {
          yaw,
          after: p.yaw,
          camera: g.view.cam.yaw,
          player: g.render2d.P3(p.x, p.y, p.z),
          ahead: g.render2d.P3(
            p.x + Math.sin(p.yaw) * 10,
            p.y,
            p.z + Math.cos(p.yaw) * 10,
          ),
        };
      });
      assert.equal(values.yaw, values.after);
      assert.equal(values.after, values.camera);
      assert.ok(Math.abs(values.player[0] - values.ahead[0]) < 1e-6);
      assert.ok(values.ahead[1] < values.player[1]);
      await page.keyboard.up(direction);
    }
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.state.P.y = 8;
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
      await page.screenshot({ path: '/tmp/follow-' + name + '.png' });
    }
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.view.renderer3d = null;
      document.getElementById('world3d').style.display = 'none';
      document.getElementById('c').style.opacity = '1';
      g.render2d.draw();
    });
    await page.screenshot({ path: '/tmp/follow-canvas.png' });
    assert.deepEqual(errors, []);
    console.log(
      'PASS follow: four held directions without orbit, camera aligned with nose, forward projects upward, framing and controls in three viewports, WebGL/Canvas',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
