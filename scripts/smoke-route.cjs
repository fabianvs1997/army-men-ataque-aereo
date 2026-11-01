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
      g.state.F = 2;
      g.state.P.yaw = 0;
      g.state.rot = 0.55;
      g.state.P.pitch = 0;
      g.view.cam.yaw = 0;
      g.render2d.draw();
    });
    assert.equal(
      await page.locator('#world3d').evaluate((e) => e.style.display),
      'block',
    );
    await page.screenshot({ path: '/tmp/route-webgl.png' });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.state.F = 10;
      g.state.P.pitch = 0;
      g.state.P.x = g.state.mission.finish.x;
      g.state.P.z = g.state.mission.finish.z;
      g.view.cam.x = g.state.P.x;
      g.view.cam.z = g.state.P.z;
      g.view.cam.yaw = 0;
      g.state.rot = 1.4;
      g.render2d.draw();
    });
    await page.screenshot({ path: '/tmp/route-tilted.png' });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.view.renderer3d = null;
      document.getElementById('world3d').style.display = 'none';
      document.getElementById('c').style.opacity = '1';
      g.state.P.pitch = 0;
      g.state.rot = 0.55;
      g.render2d.draw();
    });
    await page.screenshot({ path: '/tmp/route-canvas.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.rs();
      g.view.cam.yaw = g.state.P.yaw;
      g.render2d.draw();
    });
    const results = await page.evaluate(() => {
      const g = window.fixtureGame,
        result = [];
      for (let n = 1; n <= 3; n++) {
        g.start(n, true);
        const s = g.state;
        for (const e of s.E) g.combat.kill(e);
        s.E = [];
        s.EB = [];
        s.airLeft = 0;
        const stand = (point, frames) => {
          s.P.x = point.x;
          s.P.z = point.z;
          for (let i = 0; i < frames; i++) g.upd(0.05);
        };
        stand(s.mission.finish, 50);
        const early = s.st;
        for (const a of s.mission.allies) stand(a, 30);
        stand(s.mission.start, 50);
        const atStart = s.st;
        stand(s.mission.finish, 40);
        result.push({ early, atStart, end: s.st });
      }
      return result;
    });
    assert.deepEqual(results, [
      { early: 'play', atStart: 'play', end: 'win' },
      { early: 'play', atStart: 'play', end: 'win' },
      { early: 'play', atStart: 'play', end: 'campaign' },
    ]);
    assert.deepEqual(errors, []);
    console.log(
      'PASS route: separate final pad renders in WebGL/Canvas; three missions reject early/start extraction and finish after rescues; no JS errors',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
