/* Medición del mapa M1 (antes/después): alturas, cobertura de tierra
   del shader alpino, rocas, pinos y montañas. Uso:
   node scripts/mapa-m1-video-medicion.cjs [antes|despues]
   `antes` evalúa la fórmula de tierra vieja (seno fino) y `despues` la
   nueva (baja frecuencia + mancha de la base); las alturas son siempre
   las del mundo actual. Vuelca /tmp/mapa-m1-<modo>.png (mapa cenital
   de colores del terreno, paso 4 u) y los valores medidos por consola. */
'use strict';
const Maps = require('../src/original-maps.js');
const World = require('../src/toy-world.js');
const fs = require('node:fs');

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Tierra del shader actual (gloss -3): patrón seno fino.
const dirtOld = (x, z) =>
  smoothstep(0.55, 0.85, Math.sin(x * 0.055 + Math.sin(z * 0.035)) * Math.cos(z * 0.045 + x * 0.025)) * 0.6;
// Tierra nueva: dos senos de baja frecuencia (parches de decenas de u).
const dirtNew = (x, z) =>
  smoothstep(
    0.2, 0.6,
    Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.013 + 0.7) +
      0.5 * Math.sin(x * 0.023 + 4.0) * Math.cos(z * 0.019 + 2.0),
  ) * 0.8;

const m1 = Maps.generate(1);
const world = World.create(m1);
const mode = process.argv[2] || 'antes';
const dirt = mode === 'despues' ? dirtNew : dirtOld;

console.log('== alturas (mundo M1) ==');
for (const [name, x, z] of [
  ['A', 0, 0], ['B', -150, 170], ['C', 180, 190],
  ['colina -60,120', -60, 120], ['colina 60,120', 60, 120],
  ['colina -220,60', -220, 60], ['colina 100,80', 100, 80],
  ['colina -60,-120', -60, -120], ['colina -300,-100', -300, -100],
  ['colina 150,-150', 150, -150],
  ['cresta N 0,330', 0, 330], ['cresta E 320,160', 320, 160], ['cresta O -370,60', -370, 60],
  ['esquina 350,-350', 350, -350], ['esquina -350,350', -350, 350],
]) console.log(`${name}: ${world.height(x, z).toFixed(1)}`);
// Máxima altura sobre la ruta (debe ser <1).
let maxRoute = 0;
for (const route of m1.routes)
  for (let i = 1; i < route.length; i++) {
    const [ax, az] = route[i - 1], [bx, bz] = route[i];
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
    for (let j = 0; j <= steps; j++)
      maxRoute = Math.max(maxRoute, world.height(ax + ((bx - ax) * j) / steps, az + ((bz - az) * j) / steps));
  }
console.log(`máx altura sobre rutas: ${maxRoute.toFixed(2)} (canTravel exige <2)`);

console.log('== cobertura de tierra (rejilla 4 u, valle |x|,|z|<=440, altura<12) ==');
let n = 0, visOld = 0, visNew = 0, strongOld = 0, strongNew = 0;
for (let z = -440; z <= 440; z += 4)
  for (let x = -440; x <= 440; x += 4) {
    if (world.height(x, z) >= 12) continue;
    n++;
    const a = dirtOld(x, z), b = dirtNew(x, z);
    if (a > 0.15) visOld++;
    if (b > 0.15) visNew++;
    if (a > 0.4) strongOld++;
    if (b > 0.4) strongNew++;
  }
console.log(`celdas de valle: ${n}`);
console.log(`tierra visible (>0.15): antes ${(100 * visOld / n).toFixed(1)}%  nueva ${(100 * visNew / n).toFixed(1)}%`);
console.log(`tierra fuerte (>0.4): antes ${(100 * strongOld / n).toFixed(1)}%  nueva ${(100 * strongNew / n).toFixed(1)}%`);

console.log('== rocas M1 ==');
const rocks = m1.scenery.rocks;
console.log(`n=${rocks.length} s min=${Math.min(...rocks.map((r) => r.s)).toFixed(1)} max=${Math.max(...rocks.map((r) => r.s)).toFixed(1)} media=${(rocks.reduce((a, r) => a + r.s, 0) / rocks.length).toFixed(2)}`);
console.log('== pinos M1 (bosquecillos) ==');
const pines = m1.scenery.shrubs;
let grouped = 0;
for (const p of pines) {
  let near = 0;
  for (const q of pines) if (q !== p && Math.hypot(p.x - q.x, p.z - q.z) < 20) near++;
  if (near >= 2) grouped++;
}
console.log(`n=${pines.length} en bosquecillo (>=2 vecinos a <20 u): ${(100 * grouped / pines.length).toFixed(0)}%  s media=${(pines.reduce((a, p) => a + p.s, 0) / pines.length).toFixed(2)}`);
console.log('== montañas M1 (distancia a la ruta más cercana y altura aparente) ==');
const routePts = m1.routes.flat();
const distRoute = (x, z) => {
  let best = Infinity;
  for (const r of m1.routes)
    for (let i = 1; i < r.length; i++) {
      const [ax, az] = r[i - 1], [bx, bz] = r[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
    }
  return best;
};
for (const m of m1.scenery.mountains) {
  const top = world.height(m.x, m.z) + m.s * 1.05;
  const dC = Math.hypot(m.x - 180, m.z - 190);
  console.log(`(${m.x},${m.z}) s=${m.s} distRuta=${distRoute(m.x, m.z).toFixed(0)}u cima~${top.toFixed(0)}u (desde C: ${dC.toFixed(0)}u, ${(Math.atan2(top - world.height(180, 190), dC) * 180 / Math.PI).toFixed(1)}°)`);
}
// PNG cenital: color base del shader alpino (rama gloss -3) con difusa
// de la normal suavizada, paso 4 u. Escribe /tmp/mapa-m1-<mode>.png.
const { execFileSync } = require('node:child_process');
const W = 241, H = 241, px = Buffer.alloc(W * H * 3);
const mix = (a, b, t) => a + (b - a) * t;
const terrainColor = (x, z) => {
  const y = world.height(x, z);
  // Normal suavizada por gradiente del heightfield.
  const gx = (world.height(x + 4, z) - world.height(x - 4, z)) / 8;
  const gz = (world.height(x, z + 4) - world.height(x, z - 4)) / 8;
  const nl = Math.hypot(gx, 1, gz), ny = 1 / nl;
  const hill = smoothstep(1, 18, y);
  let base = [mix(0.3, 0.16, hill), mix(0.6, 0.38, hill), mix(0.16, 0.12, hill)];
  const d = dirt(x, z);
  base = [mix(base[0], 0.52, d), mix(base[1], 0.4, d), mix(base[2], 0.22, d)];
  const mottle = smoothstep(0.25, 0.75, Math.sin(x * 0.021 + 2.0) * Math.cos(z * 0.017 + 1.0));
  base = [mix(base[0], 0.36, mottle * 0.28), mix(base[1], 0.62, mottle * 0.28), mix(base[2], 0.19, mottle * 0.28)];
  // Mancha de tierra de la base (solo modo despues).
  if (mode === 'despues') {
    const bd = smoothstep(70, 25, Math.hypot(x - 0, z - 0)) * 0.55;
    base = [mix(base[0], 0.52, bd), mix(base[1], 0.4, bd), mix(base[2], 0.22, bd)];
  }
  const rock2 = smoothstep(12, 22, y);
  base = [mix(base[0], 0.48, rock2 * 0.6), mix(base[1], 0.45, rock2 * 0.6), mix(base[2], 0.38, rock2 * 0.6)];
  const snow = smoothstep(20, 30, y);
  base = [mix(base[0], 0.93, snow * 0.8), mix(base[1], 0.94, snow * 0.8), mix(base[2], 0.96, snow * 0.8)];
  const cliff = 1 - smoothstep(0.55, 0.92, ny);
  base = [mix(base[0], 0.45, cliff * 0.4), mix(base[1], 0.42, cliff * 0.4), mix(base[2], 0.36, cliff * 0.4)];
  const grain = ((Math.sin((Math.floor(x * 0.5) * 12.9 + Math.floor(z * 0.5) * 7.7)) * 97.1) % 1 + 1) % 1;
  const patch = Math.sin(x * 0.047 + Math.sin(z * 0.031)) * Math.cos(z * 0.061);
  const mul = 0.95 + grain * 0.05 + patch * 0.16;
  const diffuse = Math.max(((-gx) * -0.6 + 1 * 1 + (-gz) * -0.4) / (nl * Math.hypot(-0.6, 1, -0.4)), 0);
  const amb = 0.68, light = amb + (1 - amb) * diffuse;
  return base.map((c) => Math.max(0, Math.min(255, Math.round(c * mul * light * 255))));
};
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const [r, g, b] = terrainColor(i * 4 - 480, j * 4 - 480);
    const o = (j * W + i) * 3;
    px[o] = r; px[o + 1] = g; px[o + 2] = b;
  }
fs.writeFileSync(`/tmp/mapa-m1-${mode}.rgb`, px);
execFileSync('python3', ['-c', `
from PIL import Image
import sys
raw=open('/tmp/mapa-m1-${mode}.rgb','rb').read()
im=Image.frombytes('RGB',(241,241),raw)
im=im.resize((723,723),Image.NEAREST)
im.save('/tmp/mapa-m1-${mode}.png')
print('png ok')
`], { stdio: 'inherit' });
// Mediana de color del PNG en zona de valle (excluye roca/nieve: altura<12).
let rs = [], gs = [], bs = [];
for (let j = 0; j < H; j += 2)
  for (let i = 0; i < W; i += 2) {
    const x = i * 4 - 480, z = j * 4 - 480;
    if (world.height(x, z) >= 12) continue;
    const o = (j * W + i) * 3;
    rs.push(px[o]); gs.push(px[o + 1]); bs.push(px[o + 2]);
  }
const med = (a) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
console.log(`mediana color valle en PNG: #${[med(rs), med(gs), med(bs)].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
