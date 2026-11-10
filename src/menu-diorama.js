/* Diorama de portada del menú principal.
   Escena 3D SEPARADA del mundo de campaña: troncos grandes, vegetación
   desproporcionada, dos tanques verdes de juguete en primer plano,
   torres de madera estrechas, tienda militar a la derecha y caja
   amarilla verdosa inclinada a la izquierda, compuestos con
   proporciones de las capturas del original y acabado plástico de la
   propuesta v2 (referencia generada, no malla extraída del juego).
   Solo datos (piezas para ToyRenderer.renderDiorama) y cámara: sin
   colisiones, mapas, enemigos ni objetivos de campaña.
   UMD + file://: sin dependencias ni assets binarios. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory();
  else root.ToyMenuDiorama = factory();
})(globalThis, function () {
  'use strict';

  // Paleta de juguete de plástico: reflejos contenidos (gloss 0.7–1.0
  // en las piezas de plástico, -1 en tierra para el vetado del shader).
  const C = {
    bark: [0.36, 0.22, 0.12],
    barkDark: [0.24, 0.14, 0.08],
    cut: [0.55, 0.4, 0.24],
    leaf: [0.16, 0.42, 0.14],
    leaf2: [0.22, 0.5, 0.18],
    leafLight: [0.32, 0.6, 0.22],
    dirt: [0.42, 0.33, 0.18],
    path: [0.36, 0.28, 0.15],
    tank: [0.13, 0.38, 0.12],
    tankLight: [0.17, 0.45, 0.15],
    track: [0.08, 0.2, 0.08],
    wood: [0.45, 0.3, 0.16],
    woodDark: [0.3, 0.19, 0.1],
    roof: [0.36, 0.3, 0.24],
    tent: [0.16, 0.4, 0.14],
    tentDark: [0.12, 0.3, 0.11],
    door: [0.05, 0.08, 0.05],
    crate: [0.72, 0.68, 0.28],
    crateInset: [0.45, 0.42, 0.15],
    pebble: [0.5, 0.48, 0.44],
    moss: [0.2, 0.45, 0.16],
    white: [0.95, 0.95, 0.9],
    yellow: [0.95, 0.8, 0.25],
  };

  // Hash determinista (sin Math.random): la composición es la misma en
  // cada frame y en cada carga; la animación solo añade vaivén.
  function hash(n) {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  }

  function part(parts, tag, kind, x, y, z, sx, sy, sz, color, yaw = 0, gloss = 0.8, alpha = 1) {
    parts.push({ tag, kind, x, y, z, sx, sy, sz, color, yaw, gloss, alpha, phase: hash(parts.length * 3 + 1) });
  }

  // Tronco grande con copa: cilindro de corteza, ensanche de raíz en
  // cono, superficie de corte clara arriba y 4 esferas de copa.
  function trunk(parts, x, z, r, h) {
    part(parts, 'trunk', 'cylinder', x, h / 2, z, r * 2, h, r * 2, C.bark, 0, 0.7);
    part(parts, 'trunk', 'cone', x, 0.35, z, r * 3.4, 1.1, r * 3.4, C.barkDark, 0, 0.7);
    part(parts, 'trunk', 'cylinder', x, h + 0.15, z, r * 1.9, 0.3, r * 1.9, C.cut, 0, 0.5);
    const top = h + 0.6;
    part(parts, 'canopy', 'sphere', x, top + 1, z, r * 3.2, r * 1.5, r * 3.2, C.leaf, 0, 0.9);
    part(parts, 'canopy', 'sphere', x - r * 1.4, top, z + r * 0.6, r * 2.2, r * 1.1, r * 2.2, C.leaf2, 0, 0.9);
    part(parts, 'canopy', 'sphere', x + r * 1.3, top + 0.4, z - r * 0.7, r * 2.4, r * 1.2, r * 2.4, C.leafLight, 0, 0.9);
    part(parts, 'canopy', 'sphere', x + r * 0.3, top + 1.6, z + r * 1.2, r * 1.8, r * 1.0, r * 1.8, C.leaf2, 0, 0.9);
  }

  // Torre estrecha de madera: 4 patas, riostras horizontales y en
  // diagonal (en planta, la pieza solo gira sobre Y), plataforma,
  // cabina cuadrada techada y un soldado de guardia.
  function tower(parts, x, z, yaw, withSoldier) {
    const h = 10, off = 1.1;
    for (const [dx, dz] of [[-off, -off], [off, -off], [-off, off], [off, off]])
      part(parts, 'tower', 'box', x + dx, h / 2, z + dz, 0.35, h, 0.35, C.woodDark, yaw, 0.6);
    for (const ry of [3.5, 6.5]) {
      part(parts, 'tower', 'box', x, ry, z - off, off * 2 + 0.3, 0.3, 0.3, C.wood, yaw, 0.6);
      part(parts, 'tower', 'box', x, ry, z + off, off * 2 + 0.3, 0.3, 0.3, C.wood, yaw, 0.6);
      part(parts, 'tower', 'box', x - off, ry, z, 0.3, 0.3, off * 2 + 0.3, C.wood, yaw, 0.6);
      part(parts, 'tower', 'box', x + off, ry, z, 0.3, 0.3, off * 2 + 0.3, C.wood, yaw, 0.6);
    }
    part(parts, 'tower', 'box', x, 5, z, 3.6, 0.25, 0.25, C.wood, yaw + 0.5, 0.6);
    part(parts, 'tower', 'box', x, 5, z, 3.6, 0.25, 0.25, C.wood, yaw - 0.5, 0.6);
    part(parts, 'tower', 'box', x, h + 0.25, z, 3.4, 0.5, 3.4, C.wood, yaw, 0.6);
    part(parts, 'tower', 'box', x, h + 1.6, z, 2.6, 2.2, 2.6, C.wood, yaw, 0.7);
    part(parts, 'tower', 'box', x, h + 2.85, z, 2.4, 0.25, 2.4, C.woodDark, yaw, 0.6);
    part(parts, 'tower', 'cone', x, h + 4.1, z, 3.8, 1.7, 3.8, C.roof, yaw + Math.PI / 4, 0.6);
    if (withSoldier) soldier(parts, x, h + 0.5, z, yaw);
  }

  function soldier(parts, x, y, z, yaw) {
    part(parts, 'soldier', 'box', x, y + 0.5, z, 0.5, 1, 0.3, C.tank, yaw, 0.8);
    part(parts, 'soldier', 'rounded', x, y + 1.6, z, 0.8, 1.1, 0.5, C.tank, yaw, 0.8);
    part(parts, 'soldier', 'sphere', x, y + 2.6, z, 0.62, 0.6, 0.62, C.tankLight, 0, 0.8);
    part(parts, 'soldier', 'sphere', x, y + 2.85, z, 0.85, 0.35, 0.85, C.tank, 0, 0.8);
    part(parts, 'soldier', 'box', x + 0.6, y + 1.5, z + 0.2, 0.12, 1.1, 0.12, C.woodDark, yaw, 0.5);
  }

  // Tanque verde de juguete pequeño: casco, orugas con ruedas,
  // torreta, escotilla, cañón fino y costura de molde sobre el casco.
  // Mismo diseño dos veces (como el original), no un vehículo real.
  function tank(parts, x, z, yaw) {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    part(parts, 'tank', 'box', x, 0.6, z, 4.4, 0.5, 3.0, C.track, yaw, 0.7);
    part(parts, 'tank', 'rounded', x, 1.05, z, 4.6, 1.1, 2.8, C.tank, yaw, 0.9);
    part(parts, 'tank', 'box', x, 1.52, z, 3.4, 0.06, 1.6, C.tankLight, yaw, 0.9);
    for (const side of [-1.35, 1.35]) {
      const [tx, tz] = at(0, side);
      part(parts, 'tank', 'box', tx, 0.45, tz, 4.8, 0.9, 0.9, C.track, yaw, 0.7);
      for (const wx of [-1.6, -0.55, 0.55, 1.65]) {
        const [px, pz] = at(wx, side * 1.02);
        part(parts, 'tank', 'sphere', px, 0.45, pz, 0.85, 0.85, 0.85, C.track, yaw, 0.7);
      }
    }
    part(parts, 'tank', 'rounded', x, 1.95, z, 2.2, 0.9, 2.0, C.tankLight, yaw, 0.9);
    part(parts, 'tank', 'sphere', x, 2.5, z, 0.7, 0.25, 0.7, C.tank, yaw, 0.9);
    const [cx, cz] = at(2.4, 0);
    part(parts, 'tank', 'sphere', cx, 1.95, cz, 2.6, 0.28, 0.28, C.tank, yaw, 0.9);
    const [mx, mz] = at(3.7, 0);
    part(parts, 'tank', 'sphere', mx, 1.95, mz, 0.4, 0.4, 0.4, C.track, yaw, 0.7);
  }

  // Tienda militar verde: paredes, techo en cono, puerta oscura y
  // faldones (sin cruz médica: es tienda, no botiquín).
  function tent(parts, x, z, yaw) {
    part(parts, 'tent', 'box', x, 0.15, z, 5.4, 0.3, 3.8, C.tentDark, yaw, 0.6);
    part(parts, 'tent', 'box', x, 1.2, z, 5, 2.4, 3.4, C.tent, yaw, 0.7);
    part(parts, 'tent', 'cone', x, 3.4, z, 5.8, 2.0, 4.2, C.tent, yaw, 0.7);
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const fx = x + s * 1.72, fz = z + c * 1.72;
    part(parts, 'tent', 'box', fx, 0.9, fz, 1.4, 1.8, 0.15, C.door, yaw, 0.4);
    for (const side of [-1, 1]) {
      const px = x + (s * 1.72 + c * side * 1.1), pz = z + (c * 1.72 - s * side * 1.1);
      part(parts, 'tent', 'box', px, 0.45, pz, 1.6, 0.9, 0.12, C.tentDark, yaw + side * 0.4, 0.6);
    }
  }

  // Caja amarilla verdosa inclinada: base, cuerpo, centro hundido con
  // nervaduras y marco. La inclinación se indica con el giro y la
  // posición junto al tronco (la pieza del render gira solo sobre Y).
  function crate(parts, x, z, yaw) {
    part(parts, 'crate', 'box', x, 0.3, z, 4.2, 0.6, 3.2, C.crateInset, yaw, 0.7);
    part(parts, 'crate', 'box', x, 2.2, z, 4.0, 3.2, 3.0, C.crate, yaw, 0.8);
    part(parts, 'crate', 'box', x, 0.75, z, 4.1, 0.25, 3.1, C.crateInset, yaw, 0.7);
    part(parts, 'crate', 'box', x, 3.65, z, 4.1, 0.25, 3.1, C.crateInset, yaw, 0.7);
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const fx = x + s * 1.52, fz = z + c * 1.52;
    part(parts, 'crate', 'box', fx, 2.2, fz, 2.6, 1.8, 0.2, C.crateInset, yaw, 0.6);
    for (const off of [-0.8, 0, 0.8]) {
      const px = fx + c * off, pz = fz - s * off;
      part(parts, 'crate', 'box', px, 2.2, pz, 0.25, 1.8, 0.1, C.crate, yaw, 0.6);
    }
  }

  function vegetation(parts) {
    // Hierba desproporcionada: conos-lanza deterministas. Se descartan
    // las que caerían sobre el camino frontal o las huellas de los
    // edificios para que la composición respire.
    const keepOut = [
      [13, 13, 6], [-13, 16, 6], [-26, -4, 7], [20, -10, 6],
      [24, -16, 7], [-6, -22, 7], [-20, -18, 7], [14, -6, 5], [-16, -8, 5],
    ];
    let placed = 0, i = 0;
    while (placed < 46 && i < 400) {
      i++;
      const x = -38 + hash(i * 7) * 76, z = -30 + hash(i * 13) * 46;
      if (z > 9 && Math.abs(x) < 7) continue; // camino frontal despejado
      if (keepOut.some(([kx, kz, r]) => Math.hypot(x - kx, z - kz) < r)) continue;
      const h = 2.4 + hash(i * 29) * 2.2;
      part(parts, 'blade', 'cone', x, h / 2, z, 0.35, h, 0.35, hash(i * 31) > 0.5 ? C.leaf : C.leaf2, hash(i * 37) * 3, 0.85);
      placed++;
    }
    // Matas, tréboles y flores pequeñas, piedrecitas y musgo.
    for (let k = 0; k < 16; k++) {
      const x = -36 + hash(k * 41 + 5) * 72, z = -28 + hash(k * 43 + 9) * 44;
      part(parts, 'leaf', 'sphere', x, 0.3, z, 1.6 + hash(k * 47) * 1.2, 0.4, 1.0 + hash(k * 53) * 0.8, k % 3 ? C.leaf2 : C.leafLight, hash(k * 59) * 3, 0.85);
    }
    for (let k = 0; k < 12; k++) {
      const x = -34 + hash(k * 61 + 3) * 68, z = -26 + hash(k * 67 + 7) * 42;
      part(parts, 'clover', 'sphere', x, 0.25, z, 0.6, 0.3, 0.6, C.leafLight, 0, 0.85);
    }
    for (let k = 0; k < 5; k++) {
      const x = -30 + hash(k * 71 + 2) * 60, z = -20 + hash(k * 73 + 4) * 34;
      part(parts, 'flower', 'cylinder', x, 0.4, z, 0.08, 0.8, 0.08, C.leaf, 0, 0.6);
      part(parts, 'flower', 'sphere', x, 0.95, z, 0.45, 0.3, 0.45, k % 2 ? C.white : C.yellow, 0, 0.9);
    }
    for (let k = 0; k < 14; k++) {
      const x = -36 + hash(k * 79 + 6) * 72, z = -24 + hash(k * 83 + 8) * 40;
      part(parts, 'pebble', 'sphere', x, 0.18, z, 0.5 + hash(k * 89) * 0.5, 0.25, 0.5 + hash(k * 97) * 0.5, C.pebble, hash(k * 101) * 3, 0.3);
    }
    for (let k = 0; k < 8; k++) {
      const x = -32 + hash(k * 103 + 1) * 64, z = -22 + hash(k * 107 + 2) * 36;
      part(parts, 'moss', 'sphere', x, 0.12, z, 1.4 + hash(k * 109) * 1.2, 0.2, 1.4 + hash(k * 113) * 1.2, C.moss, hash(k * 127) * 3, 0.2);
    }
  }

  function build() {
    const parts = [];
    // Suelo: caja grande con gloss -1 (vetado de tierra del shader) y
    // camino de tierra frontal hacia la cámara.
    part(parts, 'ground', 'box', 0, -0.5, 0, 240, 1, 240, C.dirt, 0, -1);
    part(parts, 'ground', 'box', 0, 0.05, 20, 10, 0.1, 44, C.path, 0, -1);
    // Troncos: pantalla izquierda, central trasero (el más alto, su
    // copa asoma sobre la placa) y pantalla derecha. Ojo: en este
    // shader +x del mundo cae a la izquierda de la pantalla
    // (r = -x con yaw 0), así que las x van espejadas respecto a la
    // foto para que la tienda salga a la derecha y la caja a la
    // izquierda como en el original.
    trunk(parts, 24, -16, 2.6, 30);
    trunk(parts, -6, -22, 3.2, 40);
    trunk(parts, -20, -18, 2.4, 28);
    // Torres estrechas flanqueando la placa (fuera de su ancho);
    // la de pantalla izquierda lleva soldado.
    tower(parts, 14, -6, 0.2, true);
    tower(parts, -16, -8, -0.15, false);
    // Tienda a la derecha de la pantalla, caja inclinada a la
    // izquierda junto al tronco.
    tent(parts, -26, -4, -0.3);
    crate(parts, 20, -10, 0.55);
    // Tanques de juguete en primer plano, a ambos lados del camino.
    tank(parts, 13, 13, 0.35);
    tank(parts, -13, 16, -0.25);
    vegetation(parts);
    return parts;
  }

  // Cámara de juguete a ras de suelo (pitch bajo, no picado como la de
  // campaña): encuadra 72×50 u en horizontal/vertical para que la
  // composición se lea igual a 4:3 y 16:9 sin estirar modelos. En
  // vertical (móvil) se estrecha el encuadre para acercar el diorama.
  // TARGET_U baja el diorama en pantalla para que los tanques de
  // primer plano queden bajo la placa del menú, como en la foto.
  const CAM_Z = 58, PITCH = 0.2, TARGET_U = 8;
  function cameraFor(W, H) {
    const portrait = W < H;
    const scale = portrait
      ? Math.min(W / 52, H / 70)
      : Math.min(W / 72, H / 50);
    return {
      cam: { x: 0, z: CAM_Z, yaw: 0 },
      pitch: PITCH,
      scale,
      centerY: H / 2 + TARGET_U * scale,
    };
  }

  // Vaivén ambiental discreto: solo hierba, hojas, copas y el soldado
  // se mecen unos grados; el resto del diorama queda fijo.
  function swayYaw(part, t) {
    if (part.tag === 'blade' || part.tag === 'leaf' || part.tag === 'canopy')
      return part.yaw + Math.sin(t * 1.2 + part.phase * 6.28) * 0.05;
    if (part.tag === 'soldier')
      return part.yaw + Math.sin(t * 0.8 + part.phase * 6.28) * 0.08;
    return part.yaw;
  }

  const LAYOUT = Object.freeze({
    trunks: 3,
    towers: 2,
    tanks: 2,
    tents: 1,
    crates: 1,
    ground: 2,
  });

  return { build, cameraFor, swayYaw, LAYOUT, CAM_Z, PITCH };
});
