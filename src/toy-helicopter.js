/* Player's molded-plastic gunship. Shared geometry for WebGL and Canvas. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ToyHelicopter = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const green = [0.17, 0.53, 0.035],
    light = [0.3, 0.66, 0.055],
    dark = [0.065, 0.24, 0.025],
    glass = [0.025, 0.045, 0.035],
    ivory = [0.9, 0.92, 0.73],
    red = [0.9, 0.12, 0.035];
  const body = [];
  const part = (kind, x, y, z, sx, sy, sz, color = green, yaw = 0) => ({
    kind,
    x,
    y,
    z,
    sx,
    sy,
    sz,
    color,
    yaw,
  });
  const add = (...args) => body.push(part(...args));
  // Narrow elongated shell, two black canopy sections and a raised green frame.
  add('sphere', 0, 0, 0.65, 1.35, 1.15, 3.7);
  add('sphere', 0, 0.55, 2.65, 1.13, 0.91, 1.65, glass);
  add('sphere', 0, 0.76, 0.5, 1.13, 0.88, 1.12, glass);
  add('rounded', 0, 1.32, 1.47, 1.08, 0.1, 0.14, light);
  add('rounded', 0, 1.3, -0.75, 0.53, 0.14, 0.5, dark);
  add('rounded', 0, 1.46, -0.75, 0.41, 0.06, 0.37, light);
  for (const side of [-1, 1]) {
    // Engine housings and exhaust openings behind the cockpit.
    add('sphere', side * 1.14, 0.64, -1.55, 0.59, 0.72, 1.55);
    add('sphere', side * 1.14, 0.65, -2.84, 0.41, 0.44, 0.12, dark);
    add('rounded', side * 1.35, -0.25, 3.5, 0.12, 0.12, 0.38, ivory);
    // Stub wing with light bands and a small toy insignia on its upper face.
    add('box', side * 2.85, 0.1, -0.8, 1.85, 0.14, 0.72, green, side * -0.12);
    add(
      'box',
      side * 4.05,
      0.26,
      -0.66,
      0.11,
      0.025,
      0.67,
      ivory,
      side * -0.12,
    );
    add('sphere', side * 3.0, 0.275, -0.8, 0.45, 0.025, 0.32, ivory);
    add('sphere', side * 3.0, 0.3, -0.8, 0.33, 0.026, 0.23, green);
    for (let i = 0; i < 3; i++)
      add(
        'box',
        side * 3,
        0.335,
        -0.8,
        0.25,
        0.025,
        0.035,
        ivory,
        (i * Math.PI) / 3,
      );
    // Paired racks: green rocket bodies with pale rounded noses.
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++) {
        const x = side * (2.1 + col * 0.65),
          y = -0.45 - row * 0.55,
          z = -0.38;
        add('sphere', x, y, z, 0.23, 0.23, 1.05, green);
        add('sphere', x, y, z + 1.0, 0.23, 0.23, 0.3, ivory);
      }
    add('sphere', side * 4.55, -0.12, -0.65, 0.32, 0.36, 0.5, dark);
    // Small landing wheels and nose gun barrels rather than broad skids.
    add('box', side * 1.35, -1.05, -1.3, 0.1, 0.48, 0.1, dark);
    add('sphere', side * 1.45, -1.48, -1.3, 0.16, 0.34, 0.34, glass);
    add('box', side * 0.85, -0.8, 3.9, 0.1, 0.1, 0.65, dark);
  }
  add('sphere', 0, -1.35, 2.4, 0.22, 0.32, 0.32, glass);
  // Tapered tail boom, stabilizer, tail fin and red navigation caps.
  add('rounded', 0, 0.18, -4.55, 0.29, 0.28, 2.3);
  add('box', 0, 0.35, -6.2, 1.35, 0.12, 0.45);
  add('rounded', 0, 1.2, -6.6, 0.15, 1.1, 0.44, light);
  add('sphere', 0, 2.28, -6.6, 0.15, 0.17, 0.18, red);
  add('box', 0, 0.4, -6.3, 1.5, 0.12, 0.12, dark);
  for (const side of [-1, 1])
    add('sphere', side * 1.5, 0.43, -6.3, 0.14, 0.18, 0.17, red);
  add('sphere', 0, 1.4, -1.8, 0.67, 0.22, 0.67, light);
  add('box', 0, 1.9, -1.8, 0.13, 0.5, 0.13, dark);
  add('sphere', 0, 2.4, -1.8, 0.48, 0.18, 0.48, green);
  add('sphere', 0, 2.58, -1.8, 0.17, 0.15, 0.17, red);
  const blades = [];
  for (const side of [-1, 1]) {
    blades.push(part('box', side * 4.2, 2.4, -1.8, 3.8, 0.07, 0.32, green));
    for (const x of [6.8, 7.25])
      blades.push(part('box', side * x, 2.48, -1.8, 0.1, 0.025, 0.33, ivory));
    blades.push(part('sphere', side * 8, 2.4, -1.8, 0.48, 0.16, 0.39, light));
  }
  function parts(rot = 0, flash = false) {
    const c = Math.cos(rot),
      s = Math.sin(rot);
    const moving = blades.map((p) => ({
      ...p,
      x: p.x * c,
      z: -1.8 - p.x * s,
      yaw: rot,
    }));
    const all = body.concat(moving);
    return flash ? all.map((p) => ({ ...p, color: ivory })) : all;
  }
  // Small mesh cache for the software renderer, retaining the same proportions.
  const boxFaces = [
    [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
    ],
    [
      [1, -1, -1],
      [1, -1, 1],
      [1, 1, 1],
      [1, 1, -1],
    ],
    [
      [-1, -1, 1],
      [-1, -1, -1],
      [-1, 1, -1],
      [-1, 1, 1],
    ],
    [
      [1, -1, 1],
      [-1, -1, 1],
      [-1, 1, 1],
      [1, 1, 1],
    ],
    [
      [-1, 1, -1],
      [1, 1, -1],
      [1, 1, 1],
      [-1, 1, 1],
    ],
    [
      [-1, -1, 1],
      [1, -1, 1],
      [1, -1, -1],
      [-1, -1, -1],
    ],
  ];
  function sphereMesh(rows, columns) {
    const faces = [];
    const point = (i, j) => {
      const a = (Math.PI * i) / rows,
        b = (Math.PI * 2 * j) / columns;
      return [
        Math.sin(a) * Math.cos(b),
        Math.cos(a),
        Math.sin(a) * Math.sin(b),
      ];
    };
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < columns; j++) {
        const a = point(i, j),
          b = point(i + 1, j),
          c = point(i + 1, j + 1),
          d = point(i, j + 1);
        if (i < rows - 1) faces.push([a, b, c]);
        if (i > 0) faces.push([a, c, d]);
      }
    return faces;
  }
  const coarse = sphereMesh(6, 8),
    detail = sphereMesh(10, 16);
  return {
    parts,
    faces: (kind, detailed = false) =>
      kind === 'sphere' ? (detailed ? detail : coarse) : boxFaces,
  };
});
