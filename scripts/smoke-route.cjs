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
      g.draw3d.draw();
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
      g.draw3d.draw();
    });
    await page.screenshot({ path: '/tmp/route-tilted.png' });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.view.renderer3d = null;
      // Sin WebGL no hay respaldo 2D: draw3d muestra el mensaje.
      g.state.P.pitch = 0;
      g.state.rot = 0.55;
      g.draw3d.draw();
    });
    await page.screenshot({ path: '/tmp/route-webgl-required.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const g = window.fixtureGame;
      g.rs();
      g.view.cam.yaw = g.state.P.yaw;
      g.draw3d.draw();
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
        const stand = (point, frames) => {
          s.P.x = point.x;
          s.P.z = point.z;
          for (let i = 0; i < frames; i++) g.upd(0.05);
        };
        stand(s.mission.finish, 50);
        const early = s.st;
        // Misión 3: la batería cae al morir el helicóptero Tan; se
        // levanta con el winch (en cualquier fase) y se deja en la
        // plataforma del tren, que arranca hacia C mientras se
        // rescata a los heridos. Las posiciones salen del estado
        // vivo de la misión (cargo, batteryPad, portal), no de
        // coordenadas copiadas: la batería cae donde muere el
        // helicóptero y el juego la acerca a un punto volable.
        if (n === 3) {
          stand(s.mission.cargo, 40);
          stand(s.mission.batteryPad, 10);
        }
        for (const a of s.mission.allies.filter((a) => a.wounded)) stand(a, 35);
        stand(s.mission.start, 50);
        const atStart = s.st;
        stand(s.mission.finish, 1800);
        // Misión 1: tras la entrega en C queda la caja (winch en la
        // fase CARGA_PORTAL) y la salida por el portal.
        if (n === 1) {
          stand(s.mission.cargo, 40);
          stand(s.mission.portal, 50);
        }
        // Misión 3: con la batería en el tren y el tren en C, la
        // salida es por el portal.
        if (n === 3) stand(s.mission.portal, 50);
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
      'PASS route: separate final pad renders in WebGL; three missions reject early/start extraction and finish after rescues, crate/battery winch and portal exit; no JS errors',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
