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
    const results = await page.evaluate(() => {
      const g = window.fixtureGame,
        start = ToyMissions.layout.start;
      const dist = (e) => Math.hypot(e.x - start.x, e.z - start.z);
      const checks = [];
      for (let n = 1; n <= 3; n++) {
        g.start(n, true);
        checks.push(
          g.state.E.every(
            (e) => dist(e) - e.r >= ToyMissions.layout.minEnemyDistance,
          ),
        );
        const initial = new Set(g.state.E),
          air = g.state.E.filter((e) => e.k === 'heli');
        checks.push(air.length === g.state.mission.config.air);
        for (let i = 0; i < 700; i++) {
          g.state.P.inv = 100;
          g.upd(0.05);
        }
        checks.push(
          g.state.st === 'play' && g.state.E.every((e) => initial.has(e)),
        );
        for (const e of air) g.combat.kill(e);
        for (let i = 0; i < 1400; i++) {
          g.state.P.inv = 100;
          g.upd(0.05);
        }
        checks.push(
          g.state.st === 'play' &&
            g.state.E.every((e) => initial.has(e)) &&
            !g.state.E.some((e) => e.k === 'heli' && !e.dead),
        );
      }
      g.start(1, true);
      g.upd(0.01);
      g.draw3d.draw();
      return checks;
    });
    assert.ok(results.every(Boolean));
    await page.screenshot({ path: '/tmp/initial-air.png' });
    assert.deepEqual(errors, []);
    console.log(
      'PASS initial air: all three missions preload helicopters and spawn none during 105 seconds of simulation, including after destruction; no JS errors',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
