// Microbench de colisiones: trace/move en la zona de combate de M1.
'use strict';
const { game } = require('../support/fake-host.cjs');
const { app, state } = game(123);
app.start(1, true);
const cover = app.view.cover;
function bench(fn, n) {
  for (let i = 0; i < 2000; i++) fn(i);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn(i);
  return Number(process.hrtime.bigint() - t0) / n / 1e3;
}
const traceUs = bench(
  (i) => cover.trace({ x: -170 + (i % 50), y: 10, z: 120 }, { x: -150, y: 10, z: 140 }, 0),
  20000,
);
const moveUs = bench(
  (i) => cover.move({ x: -170 + (i % 50), y: 8, z: 120 }, { x: -169 + (i % 50), y: 8, z: 120 }, 1.8, 1.3),
  20000,
);
state.P.x = -170; state.P.z = 120; app.fire = true;
for (let i = 0; i < 120; i++) app.upd(1 / 60);
const times = [];
for (let i = 0; i < 1200; i++) {
  const t0 = process.hrtime.bigint();
  app.upd(1 / 60);
  times.push(Number(process.hrtime.bigint() - t0) / 1e6);
}
times.sort((a, b) => a - b);
const avg = times.reduce((a, b) => a + b, 0) / times.length;
console.log(JSON.stringify({
  traceUs: +traceUs.toFixed(2),
  moveUs: +moveUs.toFixed(2),
  frameAvgMs: +avg.toFixed(3),
  frameP50Ms: +times[600].toFixed(3),
  frameP95Ms: +times[1140].toFixed(3),
  frameMaxMs: +times[1199].toFixed(2),
  over33: times.filter((t) => t > 33).length,
}));
