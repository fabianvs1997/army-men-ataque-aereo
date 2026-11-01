(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports
      ? require('./toy-helicopter.js')
      : root.ToyHelicopter,
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyRender2D = api;
})(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function (PlayerModel) {
    'use strict';
    function create(scene) {
      let decorationSource = null,
        decorationMission = null,
        decorationRescued = -1,
        decoration = [];
      function visibleDecoration() {
        if (
          decorationSource !== scene.DC ||
          decorationMission !== scene.mission ||
          decorationRescued !== (scene.mission ? scene.mission.rescued : 0)
        ) {
          decorationSource = scene.DC;
          decorationMission = scene.mission;
          decorationRescued = scene.mission ? scene.mission.rescued : 0;
          decoration = scene.DC.filter(
            (d) =>
              (!scene.ToyWorld ||
                scene.ToyWorld.clearOfLandmarks(d.x, d.z, 3)) &&
              (!scene.mission ||
                !scene.mission.allies.some(
                  (a) =>
                    a.state !== 'rescued' &&
                    Math.hypot(a.x - d.x, a.z - d.z) < 7,
                )),
          );
        }
        return decoration;
      }
      function cs(x, y, z) {
        const dx = x - scene.cam.x,
          dz = z - scene.cam.z,
          s = Math.sin(scene.cam.yaw),
          c = Math.cos(scene.cam.yaw),
          forward = dx * s + dz * c;
        return [
          -dx * c + dz * s,
          y * Math.cos(scene.PITCH) + forward * Math.sin(scene.PITCH),
          300 + forward * Math.cos(scene.PITCH) - y * Math.sin(scene.PITCH),
        ];
      }
      function pj(a) {
        return [
          scene.W / 2 + a[0] * scene.F,
          scene.HY - a[1] * scene.F,
          scene.F,
          a[2],
        ];
      }
      function headingAngle(yaw) {
        const dx = Math.sin(yaw),
          dz = Math.cos(yaw),
          right = -dx * Math.cos(scene.cam.yaw) + dz * Math.sin(scene.cam.yaw),
          down =
            -(dx * Math.sin(scene.cam.yaw) + dz * Math.cos(scene.cam.yaw)) *
            Math.sin(scene.PITCH);
        return Math.atan2(-right, down);
      }
      function P3(x, y, z) {
        const a = cs(x, y, z);
        return a[2] < 1 ? null : pj(a);
      }
      function clip(a, b) {
        if (a[2] < 1 && b[2] < 1) return null;
        if (a[2] < 1) {
          const t = (1 - a[2]) / (b[2] - a[2]);
          a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 1];
        } else if (b[2] < 1) {
          const t = (1 - b[2]) / (a[2] - b[2]);
          b = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, 1];
        }
        return [a, b];
      }
      const ell = (x, y, rx, ry, c) => {
        scene.ctx.fillStyle = c;
        scene.ctx.beginPath();
        scene.ctx.ellipse(
          x,
          y,
          Math.max(0.5, rx),
          Math.max(0.5, ry),
          0,
          0,
          6.3,
        );
        scene.ctx.fill();
      };
      const rc = (x, y, w, h, c) => {
        scene.ctx.fillStyle = c;
        scene.ctx.fillRect(x, y, w, h);
      };
      const tri = (a, b, c, d, e, f, col) => {
        scene.ctx.fillStyle = col;
        scene.ctx.beginPath();
        scene.ctx.moveTo(a, b);
        scene.ctx.lineTo(c, d);
        scene.ctx.lineTo(e, f);
        scene.ctx.fill();
      };
      function heli(
        p,
        col,
        dk,
        fl,
        back,
        bank,
        detached = false,
        pitch = 0,
        yaw = 0,
      ) {
        const s = p[2];
        scene.ctx.save();
        scene.ctx.translate(p[0], p[1]);
        scene.ctx.rotate(bank || 0);
        // Project the tilted forward axis into this sprite's local frame.
        const length = Math.hypot(
          Math.sin(yaw - scene.cam.yaw),
          Math.cos(yaw - scene.cam.yaw) * Math.sin(scene.PITCH),
        );
        const lift =
          (Math.sin(pitch) * Math.cos(scene.PITCH)) / Math.max(0.1, length);
        scene.ctx.transform(
          1,
          0,
          Math.sin(bank || 0) * lift,
          Math.max(0.55, Math.cos(pitch) + Math.cos(bank || 0) * lift),
          0,
          0,
        );
        // Tail, stabilizers and landing skids beneath the molded fuselage.
        rc(-0.25 * s, -4.6 * s, 0.5 * s, 4 * s, dk);
        rc(-1.5 * s, -4.2 * s, 3 * s, 0.3 * s, col);
        scene.ctx.strokeStyle = dk;
        scene.ctx.lineWidth = Math.max(1, 0.22 * s);
        for (const side of [-1, 1]) {
          scene.ctx.beginPath();
          scene.ctx.moveTo(side * 1.2 * s, 0.4 * s);
          scene.ctx.lineTo(side * 2 * s, 1.7 * s);
          scene.ctx.lineTo(side * 2.5 * s, 1.7 * s);
          scene.ctx.stroke();
          rc(side * 2 * s - 0.15 * s, 0.5 * s, 0.3 * s, 1.7 * s, dk);
        }
        const body = scene.ctx.createLinearGradient(-2 * s, -s, 2 * s, s);
        body.addColorStop(0, dk);
        body.addColorStop(0.4, fl ? '#fff' : col);
        body.addColorStop(0.55, fl ? '#fff' : col);
        body.addColorStop(0.61, fl ? '#fff' : '#efffc799');
        body.addColorStop(0.7, fl ? '#fff' : col);
        body.addColorStop(1, dk);
        ell(0, 0, 1.7 * s, 1.6 * s, body);
        // Injection-mold seam and small screw recesses on the toy shell.
        scene.ctx.strokeStyle = dk;
        scene.ctx.lineWidth = Math.max(0.6, 0.05 * s);
        scene.ctx.beginPath();
        scene.ctx.ellipse(0, 0, 1.6 * s, 1.5 * s, 0, 0, Math.PI * 2);
        scene.ctx.stroke();
        ell(-0.7 * s, -0.6 * s, 0.23 * s, 0.45 * s, '#ffffff55');
        for (const side of [-1, 1]) {
          ell(side * 0.85 * s, 0.8 * s, 0.13 * s, 0.13 * s, dk);
          rc(side * 0.85 * s - 0.07 * s, 0.78 * s, 0.14 * s, 0.04 * s, col);
        }
        const glass = scene.ctx.createLinearGradient(0, -s, 0, s);
        glass.addColorStop(0, '#c5f2ed');
        glass.addColorStop(0.45, '#4c8e9c');
        glass.addColorStop(1, '#193b4c');
        ell(
          0,
          back ? -0.5 * s : 0.5 * s,
          1.15 * s,
          0.72 * s,
          detached ? '#4b412d' : glass,
        );
        rc(-0.08 * s, -1.2 * s, 0.16 * s, 1.8 * s, dk);
        for (const side of [-1, 1]) {
          rc(side * 1.7 * s - 0.35 * s, -0.5 * s, 0.7 * s, 1.5 * s, dk);
          ell(side * 1.7 * s, 0.9 * s, 0.25 * s, 0.22 * s, '#162c28');
        }
        rc(-0.8 * s, 0.9 * s, 1.6 * s, 0.18 * s, '#d8dfaa');
        ell(-1.8 * s, 0, 0.14 * s, 0.14 * s, '#f36950');
        ell(1.8 * s, 0, 0.14 * s, 0.14 * s, '#b7ffc1');
        scene.ctx.globalAlpha = 0.14;
        ell(0, -1.8 * s, 5.6 * s, 0.85 * s, '#e7eed1');
        scene.ctx.globalAlpha = 1;
        scene.ctx.strokeStyle = '#213b2b';
        scene.ctx.lineWidth = Math.max(1, 0.19 * s);
        for (let i = 0; i < 2; i++) {
          const a = scene.rot + (i * Math.PI) / 2;
          scene.ctx.beginPath();
          scene.ctx.moveTo(
            Math.cos(a) * 5.5 * s,
            -1.8 * s + Math.sin(a) * 0.8 * s,
          );
          scene.ctx.lineTo(
            -Math.cos(a) * 5.5 * s,
            -1.8 * s - Math.sin(a) * 0.8 * s,
          );
          scene.ctx.stroke();
        }
        ell(0, -1.8 * s, 0.35 * s, 0.25 * s, '#c2c9a1');
        scene.ctx.restore();
      }
      function plasticPart(x, y, w, h, col, shade) {
        const g = scene.ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, shade);
        g.addColorStop(0.16, col);
        g.addColorStop(0.23, '#fff4');
        g.addColorStop(0.32, col);
        g.addColorStop(1, shade);
        scene.ctx.fillStyle = g;
        scene.ctx.beginPath();
        scene.ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.18);
        scene.ctx.fill();
        scene.ctx.strokeStyle = shade;
        scene.ctx.lineWidth = Math.max(0.6, Math.min(w, h) * 0.035);
        scene.ctx.stroke();
      }
      function soldier2d(p, friendly, waiting = false) {
        const s = p[2],
          x = p[0],
          y = p[1],
          color = friendly ? '#57ac43' : '#d1b576';
        ell(x, y, 1.2 * s, 0.4 * s, color);
        rc(x - 0.65 * s, y - 2.5 * s, 1.3 * s, 1.5 * s, color);
        ell(x, y - 3 * s, 0.7 * s, 0.6 * s, color);
        rc(x - 0.6 * s, y - s, 0.4 * s, s, color);
        rc(x + 0.2 * s, y - s, 0.4 * s, s, color);
        rc(x + 0.7 * s, y - 2 * s, 0.25 * s, 1.4 * s, '#4e5d37');
        if (waiting) {
          scene.ctx.fillStyle = '#e8e785';
          scene.ctx.font = Math.max(12, 2 * s) + 'px sans-serif';
          scene.ctx.textAlign = 'center';
          scene.ctx.fillText('+', x, y - 4 * s);
        }
      }
      function sprE(e, p) {
        if (e.k === 'inf') {
          soldier2d(p, false);
          return;
        }
        const s = p[2],
          x = p[0],
          y = p[1],
          f = e.fl > 0,
          col = f ? '#fff' : '#d5b578',
          dk = '#8b713f';
        if (e.k === 'heli') {
          heli(
            p,
            col,
            dk,
            f,
            false,
            headingAngle(Math.atan2(scene.P.x - e.x, scene.P.z - e.z)),
            e.detached,
          );
          return;
        }
        // Flat oval feet make the scenery read as pieces on a toy battlefield.
        ell(x, y + 0.25 * s, (e.k === 'base' ? 6.8 : 3.7) * s, 0.8 * s, dk);
        ell(x, y, (e.k === 'base' ? 6.8 : 3.7) * s, 0.7 * s, col);
        if (e.k === 'tank') {
          plasticPart(x - 3 * s, y - 1.8 * s, 6 * s, 1.8 * s, col, dk);
          for (const side of [-1, 1]) {
            plasticPart(
              x + side * 2.4 * s - 0.5 * s,
              y - 2 * s,
              s,
              2 * s,
              dk,
              '#66572e',
            );
            for (let i = 0; i < 4; i++)
              rc(
                x + side * 2.4 * s - 0.4 * s,
                y - 1.8 * s + i * 0.45 * s,
                0.8 * s,
                0.1 * s,
                col,
              );
          }
          plasticPart(x - 1.5 * s, y - 3 * s, 3 * s, 1.4 * s, col, dk);
          plasticPart(x - 0.3 * s, y - 4.4 * s, 0.6 * s, 2.1 * s, col, dk);
          ell(x, y - 4.4 * s, 0.3 * s, 0.14 * s, dk);
          ell(x + 0.8 * s, y - 2.6 * s, 0.35 * s, 0.2 * s, '#ead39c');
        } else if (e.k === 'tur') {
          plasticPart(x - 1.7 * s, y - 2.2 * s, 3.4 * s, 2.2 * s, col, dk);
          ell(x, y - 2.3 * s, 1.8 * s, 0.65 * s, col);
          plasticPart(x - 0.3 * s, y - 4.1 * s, 0.6 * s, 2 * s, col, dk);
        } else {
          plasticPart(x - 5 * s, y - 4.4 * s, 10 * s, 4.4 * s, col, dk);
          if (!e.detached) {
            tri(
              x - 5.7 * s,
              y - 4 * s,
              x + 5.7 * s,
              y - 4 * s,
              x,
              y - 7 * s,
              col,
            );
            tri(
              x,
              y - 7 * s,
              x + 5.7 * s,
              y - 4 * s,
              x + 0.5 * s,
              y - 4 * s,
              '#edcf92',
            );
          }
          plasticPart(
            x - 1.1 * s,
            y - 2.8 * s,
            2.2 * s,
            2.8 * s,
            dk,
            '#756031',
          );
          for (const side of [-1, 1]) {
            rc(x + side * 3.2 * s - 0.7 * s, y - 3 * s, 1.4 * s, 1.2 * s, dk);
            rc(
              x + side * 3.2 * s - 0.7 * s,
              y - 3 * s,
              1.4 * s,
              0.15 * s,
              '#f5deab',
            );
          }
          rc(x + 4 * s, y - 16 * s, 0.35 * s, 12 * s, dk);
          rc(x + 4.35 * s, y - 16 * s, 2.6 * s, 1.5 * s, '#cf5540');
          ell(x + 4.18 * s, y - 16 * s, 0.3 * s, 0.3 * s, col);
        }
      }
      function yardPart(o) {
        const color = (f) =>
          'rgb(' + o.color.map((v) => Math.round(v * 255 * f)).join(',') + ')';
        if (o.kind === 'sphere') {
          const p = P3(o.x, o.y, o.z);
          ell(p[0], p[1], o.sx * scene.F, o.sy * scene.F, color(0.9));
          return;
        }
        const c = Math.cos(o.yaw),
          s = Math.sin(o.yaw),
          points = [];
        for (const y of [-1, 1])
          for (const [x, z] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ])
            points.push([
              o.x + x * o.sx * c + z * o.sz * s,
              o.y + y * o.sy,
              o.z - x * o.sx * s + z * o.sz * c,
            ]);
        const faces = [
          [0, 1, 5, 4],
          [1, 2, 6, 5],
          [2, 3, 7, 6],
          [3, 0, 4, 7],
          [4, 5, 6, 7],
        ]
          .map((ids, i) => ({
            ids,
            i,
            depth: ids.reduce((v, j) => v + cs(...points[j])[2], 0) / 4,
          }))
          .sort((a, b) => b.depth - a.depth);
        for (const face of faces) {
          scene.ctx.fillStyle = color([0.65, 0.8, 0.7, 0.85, 1][face.i]);
          scene.ctx.beginPath();
          face.ids.forEach((j, i) => {
            const p = P3(...points[j]);
            i ? scene.ctx.lineTo(p[0], p[1]) : scene.ctx.moveTo(p[0], p[1]);
          });
          scene.ctx.closePath();
          scene.ctx.fill();
        }
      }
      function playerHelicopter() {
        const p = scene.P,
          pitch = p.pitch || 0,
          cp = Math.cos(pitch),
          sp = Math.sin(pitch),
          cy = Math.cos(p.yaw),
          sy = Math.sin(p.yaw),
          faces = [];
        const transform = (x, y, z) => {
          const yy = y * cp - z * sp,
            zz = y * sp + z * cp;
          return [p.x + x * cy + zz * sy, p.y + yy, p.z - x * sy + zz * cy];
        };
        const eye = [
          -Math.sin(scene.cam.yaw) * Math.cos(scene.PITCH),
          Math.sin(scene.PITCH),
          -Math.cos(scene.cam.yaw) * Math.cos(scene.PITCH),
        ];
        for (const part of PlayerModel.parts(scene.rot)) {
          const c = Math.cos(part.yaw),
            s = Math.sin(part.yaw),
            origin = transform(part.x, part.y, part.z);
          for (const face of PlayerModel.faces(
            part.kind,
            part.sx > 0.6 && part.sz > 0.8,
          )) {
            const vertices = face.map(([x, y, z]) =>
              transform(
                part.x + x * part.sx * c + z * part.sz * s,
                part.y + y * part.sy,
                part.z - x * part.sx * s + z * part.sz * c,
              ),
            );
            const u = vertices[1].map((v, i) => v - vertices[0][i]),
              v = vertices[2].map((v, i) => v - vertices[0][i]);
            let n = [
              u[1] * v[2] - u[2] * v[1],
              u[2] * v[0] - u[0] * v[2],
              u[0] * v[1] - u[1] * v[0],
            ];
            const center = [0, 1, 2].map(
              (i) => vertices.reduce((t, v) => t + v[i], 0) / vertices.length,
            );
            if (n.reduce((t, v, i) => t + v * (center[i] - origin[i]), 0) < 0)
              n = n.map((v) => -v);
            const length = Math.hypot(...n);
            if (length < 1e-8) continue;
            n = n.map((v) => v / length);
            if (n.reduce((t, v, i) => t + v * eye[i], 0) <= 0) continue;
            const light = Math.max(
              0,
              (-0.6 * n[0] + n[1] - 0.4 * n[2]) / Math.sqrt(1.52),
            );
            const shine =
              Math.pow(
                Math.max(0, n[0] * -0.4 + n[1] * 0.9 + n[2] * -0.15),
                24,
              ) * 0.14;
            const color =
              'rgb(' +
              part.color
                .map((v) =>
                  Math.min(
                    255,
                    Math.round(255 * (v * (0.48 + 0.52 * light) + shine)),
                  ),
                )
                .join(',') +
              ')';
            faces.push({ vertices, color, depth: cs(...center)[2] });
          }
        }
        faces.sort((a, b) => b.depth - a.depth);
        scene.ctx.save();
        scene.ctx.lineWidth = 0.6;
        for (const f of faces) {
          scene.ctx.fillStyle = f.color;
          scene.ctx.beginPath();
          f.vertices.forEach((v, i) => {
            const q = P3(...v);
            if (q)
              i ? scene.ctx.lineTo(q[0], q[1]) : scene.ctx.moveTo(q[0], q[1]);
          });
          scene.ctx.closePath();
          scene.ctx.fill();
          // Cover antialias gaps between adjacent mesh triangles.
          scene.ctx.strokeStyle = f.color;
          scene.ctx.stroke();
        }
        scene.ctx.restore();
      }
      function draw(nextScene) {
        if (nextScene) scene = nextScene;
        scene.HY =
          (scene.cameraCenterY ??
            scene.H * 0.64 + 8 * Math.cos(scene.PITCH) * scene.F) +
          (scene.shk > 0 ? scene.R(-2, 2) : 0);
        if (
          scene.renderer3d &&
          scene.renderer3d.render({
            pixelRatio: scene.lowQuality ? 1 : 1.75,
            W: scene.W,
            H: scene.H,
            F: scene.F,
            HY: scene.HY,
            cam: scene.cam,
            PITCH: scene.PITCH,
            P: scene.P,
            E: scene.E,
            DC: scene.DC,
            BL: scene.BL,
            EB: scene.EB,
            MS: scene.MS,
            FX: scene.FX,
            DB: scene.DB,
            PK: scene.PK,
            rot: scene.rot,
            t: scene.t,
            allies: scene.mission ? scene.mission.allies : [],
          })
        ) {
          scene.$('world3d').style.display = 'block';
          scene.$('c').style.opacity = '0';
          return;
        }

        scene.HY =
          (scene.cameraCenterY ??
            scene.H * 0.64 + 8 * Math.cos(scene.PITCH) * scene.F) +
          (scene.shk > 0 ? scene.R(-2, 2) : 0);
        scene.ctx.fillStyle = '#607c49';
        scene.ctx.fillRect(0, 0, scene.W, scene.H);
        if (typeof scene.ToyWorld !== 'undefined')
          scene.ToyWorld.drawGround(
            scene.ctx,
            P3,
            scene.cam,
            scene.W,
            scene.H,
            scene.F,
          );
        scene.ctx.beginPath();
        for (let k = -10; k <= 10; k++) {
          const v = k * 20;
          for (const q of [
            [v, -200, v, 200],
            [-200, v, 200, v],
          ]) {
            const c = clip(cs(q[0], 0, q[1]), cs(q[2], 0, q[3]));
            if (c) {
              const a = pj(c[0]),
                b = pj(c[1]);
              scene.ctx.moveTo(a[0], a[1]);
              scene.ctx.lineTo(b[0], b[1]);
            }
          }
        }
        scene.ctx.strokeStyle = 'rgba(205,216,148,0)';
        scene.ctx.lineWidth = 1;
        scene.ctx.stroke();
        const sh = (x, z) => {
          const p = P3(x, scene.groundAt(x, z), z);
          if (p) ell(p[0], p[1], 2.2 * p[2], 0.7 * p[2], 'rgba(0,0,0,.22)');
        };
        for (const e of scene.E) if (e.k === 'heli') sh(e.x, e.z);
        if (scene.P) sh(scene.P.x, scene.P.z);
        const L = [],
          add = (x, y, z, fn) => {
            const a = cs(x, y, z);
            if (Math.hypot(x - scene.cam.x, z - scene.cam.z) > 180) return;
            const p = pj(a);
            if (p[0] < -150 || p[0] > scene.W + 150) return;
            L.push([a[2], p, fn]);
          };
        for (const d of visibleDecoration())
          add(d.x, scene.groundAt(d.x, d.z), d.z, (p) => {
            const s = p[2],
              x = p[0],
              y = p[1];
            if (d.t === 'shrub') {
              ell(x, y - d.s * s * 0.5, d.s * s, d.s * s * 0.7, '#435f25');
              ell(
                x - d.s * s * 0.3,
                y - d.s * s,
                d.s * s * 0.65,
                d.s * s * 0.6,
                '#57732e',
              );
            } else if (d.t === 't') {
              ell(x, y, 3.5 * s, 0.65 * s, '#25542c');
              ell(x, y - 0.15 * s, 3.5 * s, 0.55 * s, '#438344');
              rc(x - 0.5 * s, y - 4 * s, s, 4 * s, '#7a5230');
              tri(
                x - 3.6 * s,
                y - 3 * s,
                x + 3.6 * s,
                y - 3 * s,
                x,
                y - 9 * s,
                '#234e38',
              );
              tri(
                x - 2.8 * s,
                y - 5 * s,
                x + 2.8 * s,
                y - 5 * s,
                x,
                y - 11 * s,
                '#376b45',
              );
              tri(
                x - 0.4 * s,
                y - 10 * s,
                x + 2.8 * s,
                y - 5 * s,
                x + 0.3 * s,
                y - 5 * s,
                '#6d8c50',
              );
            } else {
              plasticPart(
                x - (d.s * s) / 2,
                y - d.s * s,
                d.s * s,
                d.s * s,
                d.c,
                '#354c42',
              );
              for (const side of [-1, 1])
                ell(
                  x + side * d.s * s * 0.23,
                  y - d.s * s * 1.04,
                  d.s * s * 0.14,
                  d.s * s * 0.07,
                  d.c,
                );
              rc(
                x - (d.s * s) / 2,
                y - d.s * s * 1.2,
                d.s * s,
                d.s * s * 0.2,
                'rgba(255,255,255,.35)',
              );
            }
          });
        if (typeof scene.ToyWorld !== 'undefined') {
          for (const r of scene.ToyWorld.rocks) {
            const h = scene.groundAt(r.x, r.z);
            const parts = [
              {
                kind: 'sphere',
                x: r.x,
                y: h + r.s * 0.45,
                z: r.z,
                sx: r.s,
                sy: r.s * 0.65,
                sz: r.s * 0.85,
                yaw: r.x,
                color: [0.38, 0.4, 0.32],
              },
              {
                kind: 'sphere',
                x: r.x + 2,
                y: h + 0.45,
                z: r.z + 1,
                sx: 1.3,
                sy: 0.6,
                sz: 1,
                yaw: 0,
                color: [0.28, 0.42, 0.17],
              },
            ];
            for (const p of parts) add(p.x, p.y, p.z, () => yardPart(p));
          }
          for (const o of scene.ToyWorld.yard || [])
            add(o.x, o.y, o.z, () => yardPart(o));
        }
        if (scene.mission)
          for (const a of scene.mission.allies)
            if (a.state !== 'rescued')
              add(a.x, scene.groundAt(a.x, a.z), a.z, (p) =>
                soldier2d(p, true, a.state === 'waiting'),
              );
        for (const d of scene.DB || []) add(d.x, d.y, d.z, () => yardPart(d));
        for (const e of scene.E)
          add(e.x, e.y, e.z, (p) => {
            sprE(e, p);
            // Pale broken edges around recessed chips remain after the impact.
            for (let i = 0; i < (e.chips || 0); i++) {
              const x = p[0] + ((i % 3) - 1) * p[2] * 0.55,
                y = p[1] - (1.2 + (i % 2) * 0.6) * p[2];
              tri(
                x,
                y,
                x + 0.65 * p[2],
                y - 0.3 * p[2],
                x + 0.4 * p[2],
                y + 0.45 * p[2],
                '#edcf92',
              );
              tri(
                x + 0.1 * p[2],
                y,
                x + 0.5 * p[2],
                y - 0.2 * p[2],
                x + 0.3 * p[2],
                y + 0.3 * p[2],
                '#65512e',
              );
            }
          });
        for (const q of scene.PK)
          add(q.x, scene.groundAt(q.x, q.z) + 1.5, q.z, (p) =>
            rc(
              p[0] - 0.9 * p[2],
              p[1] - 0.9 * p[2],
              1.8 * p[2],
              1.8 * p[2],
              q.ty === 'a' ? '#3fbf4a' : '#d9473f',
            ),
          );
        for (const b of scene.BL)
          add(b.x, b.y, b.z, (p) => {
            const q = P3(b.x - b.vx * 0.04, b.y, b.z - b.vz * 0.04);
            scene.ctx.strokeStyle = '#ffe066';
            scene.ctx.lineWidth = Math.max(1.5, p[2] * 0.3);
            scene.ctx.beginPath();
            scene.ctx.moveTo(p[0], p[1]);
            scene.ctx.lineTo(q ? q[0] : p[0], q ? q[1] : p[1]);
            scene.ctx.stroke();
          });
        for (const o of scene.MS)
          add(o.x, o.y, o.z, (p) =>
            ell(
              p[0],
              p[1],
              Math.max(2, 0.7 * p[2]),
              Math.max(2, 0.7 * p[2]),
              '#ff5a2e',
            ),
          );
        for (const b of scene.EB)
          add(b.x, b.y, b.z, (p) =>
            ell(
              p[0],
              p[1],
              Math.max(2, 0.5 * p[2]),
              Math.max(2, 0.5 * p[2]),
              '#ff9a2e',
            ),
          );
        for (const o of scene.FX)
          add(o.x, o.y, o.z, (p) => {
            const k = 1 - o.l / 0.5;
            scene.ctx.globalAlpha = Math.max(0, 0.9 * (1 - k));
            ell(
              p[0],
              p[1],
              o.s * (0.3 + k) * p[2],
              o.s * (0.3 + k) * p[2],
              k > 0.5 ? '#525c50' : '#ef8242',
            );
            ell(
              p[0],
              p[1],
              o.s * (1 - k) * p[2] * 0.6,
              o.s * (1 - k) * p[2] * 0.6,
              '#ffe9a2',
            );
            for (let i = 0; i < 7; i++) {
              const a = (i * 6.28) / 7;
              ell(
                p[0] + Math.cos(a) * k * o.s * p[2] * 1.7,
                p[1] + Math.sin(a) * k * o.s * p[2] * 1.7,
                Math.max(0.5, (1 - k) * p[2] * 0.3),
                Math.max(0.5, (1 - k) * p[2] * 0.3),
                '#ffd78a',
              );
            }
            scene.ctx.globalAlpha = 1;
          });
        if (scene.P && !(scene.P.inv > 0 && Math.floor(scene.t * 20) % 2))
          add(scene.P.x, scene.P.y, scene.P.z, () => playerHelicopter());
        L.sort((a, b) => b[0] - a[0]);
        for (const q of L) q[2](q[1]);
      }
      return {
        cs,
        pj,
        headingAngle,
        P3,
        clip,
        ell,
        rc,
        tri,
        heli,
        plasticPart,
        soldier2d,
        sprE,
        yardPart,
        draw,
      };
    }
    return { create };
  },
);
