/* Diagrama headless del diorama de portada (src/menu-diorama.js).
   Proyecta las piezas con las mismas fórmulas del vertex shader de
   src/toy-renderer.js (cámara, pitch, escala y centerY de
   ToyMenuDiorama.cameraFor) y escribe un SVG por tamaño.
   NO es una captura WebGL: es una referencia de composición para
   comparar encuadres a 1440×1080 y 1920×1080 antes de capturar en
   un navegador real.
   Uso: node scripts/portada-diagrama.cjs 1440x1080 [salida.svg] [t] */
const fs = require('node:fs');
const path = require('node:path');
const Diorama = require('../src/menu-diorama.js');

const [sizeArg, outArg, tArg] = process.argv.slice(2);
const [W, H] = String(sizeArg || '1440x1080').split('x').map(Number);
if (!W || !H) {
  console.error('Uso: node scripts/portada-diagrama.cjs 1440x1080 [salida.svg] [t]');
  process.exit(1);
}
const t = Number(tArg || 1.2);
const camInfo = Diorama.cameraFor(W, H);
const cam = camInfo.cam,
  pitch = camInfo.pitch,
  scale = camInfo.scale,
  centerY = camInfo.centerY;
const cp = Math.cos(pitch),
  sp = Math.sin(pitch),
  sy = Math.sin(cam.yaw),
  cy = Math.cos(cam.yaw);

// Proyección idéntica a VS en src/toy-renderer.js.
function project(x, y, z) {
  const dx = x - cam.x,
    dz = z - cam.z,
    f = dx * sy + dz * cy,
    r = -dx * cy + dz * sy,
    u = y * cp + f * sp,
    depth = f * cp - y * sp;
  return { px: W / 2 + r * scale, py: centerY - u * scale, depth };
}

// Esquinas de la caja envolvente de cada pieza tras aplicar
// size+yaw como en el shader (position*size, giro sobre Y).
function corners(p) {
  const k = p.kind === 'cylinder' || p.kind === 'cone' ? 0.5 : 1;
  const c = Math.cos(p.yaw),
    s = Math.sin(p.yaw),
    out = [];
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      for (const d of [-1, 1]) {
        const lx = a * k * p.sx,
          ly = b * k * p.sy,
          lz = d * k * p.sz;
        out.push(
          project(p.x + lx * c + lz * s, p.y + ly, p.z - lx * s + lz * c),
        );
      }
  return out;
}

function poly(points) {
  // Envolvente convexa simple por ángulo alrededor del centroide:
  // suficiente para un diagrama de composición.
  const cx = points.reduce((a, p) => a + p.px, 0) / points.length,
    cy2 = points.reduce((a, p) => a + p.py, 0) / points.length;
  return [...points]
    .sort((a, b) => Math.atan2(a.py - cy2, a.px - cx) - Math.atan2(b.py - cy2, b.px - cx))
    .map((p) => p.px.toFixed(1) + ',' + p.py.toFixed(1))
    .join(' ');
}

const parts = Diorama.build().map((p) => ({
  ...p,
  yaw: Diorama.swayYaw(p, t),
}));
const drawn = parts
  .map((p) => {
    const cs = corners(p);
    return { p, cs, depth: cs.reduce((a, q) => a + q.depth, 0) / cs.length };
  })
  .sort((a, b) => b.depth - a.depth); // de lejos a cerca (painter)

const rgb = (c) =>
  'rgb(' +
  c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)).join(',') +
  ')';

const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">',
  '<!-- DIAGRAMA headless del diorama de portada: proyección matemática',
  '     de src/menu-diorama.js con la cámara de cameraFor(' + W + 'x' + H + ').',
  '     NO es una captura WebGL del juego. t=' + t + ' -->',
  '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">',
  '<stop offset="0" stop-color="#7ba8c4"/><stop offset="1" stop-color="#cfe0ea"/>',
  '</linearGradient></defs>',
  '<rect width="' + W + '" height="' + H + '" fill="url(#sky)"/>',
  ...drawn.map(
    ({ p, cs }) =>
      '<polygon points="' + poly(cs) + '" fill="' + rgb(p.color) + '" stroke="rgba(0,0,0,0.18)" stroke-width="1"/>',
  ),
  '<text x="12" y="28" font-family="monospace" font-size="16" fill="#123">DIAGRAMA headless (no captura WebGL) · ' + W + '×' + H + '</text>',
  '</svg>',
  '',
].join('\n');

const out =
  outArg ||
  path.join(
    __dirname,
    '..',
    'docs',
    'referencias',
    'portada-diagrama-' + W + 'x' + H + '.svg',
  );
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg);
console.log(out, '(' + parts.length + ' piezas, t=' + t + ')');
