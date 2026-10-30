(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(
      require('./prefs.js'),
      require('./audio.js'),
      require('./input.js'),
      require('./combat.js'),
      require('./render2d.js'),
      require('./ui.js'),
      require('./toy-world.js'),
      require('./toy-missions.js'),
      require('./toy-renderer.js'),
    );
  else
    root.ToyGame = factory(
      root.ToyPrefs,
      root.ToyAudio,
      root.ToyInput,
      root.ToyCombat,
      root.ToyRender2D,
      root.ToyUI,
      root.ToyWorld,
      root.ToyMissions,
      root.ToyRenderer,
    );
})(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function (
    ToyPrefs,
    ToyAudio,
    ToyInput,
    ToyCombat,
    ToyRender2D,
    ToyUI,
    ToyWorld,
    ToyMissions,
    ToyRenderer,
  ) {
    'use strict';
    function create(host = globalThis) {
      const env = {
        host,
        get draw() {
          return draw;
        },
        set draw(v) {
          draw = v;
        },
        get $() {
          return $;
        },
        get cv() {
          return cv;
        },
        get st() {
          return st;
        },
        set st(v) {
          st = v;
        },
        get pauseGame() {
          return pauseGame;
        },
        get overlayPage() {
          return overlayPage;
        },
        set overlayPage(v) {
          overlayPage = v;
        },
        get menuBack() {
          return menuBack;
        },
        get resumeGame() {
          return resumeGame;
        },
        get audio() {
          return audio;
        },
        get humOn() {
          return humOn;
        },
        get needsDraw() {
          return needsDraw;
        },
        set needsDraw(v) {
          needsDraw = v;
        },
        get FX() {
          return FX;
        },
        set FX(v) {
          FX = v;
        },
        get sfx() {
          return sfx;
        },
        get buzz() {
          return buzz;
        },
        get P() {
          return P;
        },
        set P(v) {
          P = v;
        },
        get bd() {
          return bd;
        },
        set bd(v) {
          bd = v;
        },
        get mission() {
          return mission;
        },
        set mission(v) {
          mission = v;
        },
        get PK() {
          return PK;
        },
        set PK(v) {
          PK = v;
        },
        get BL() {
          return BL;
        },
        set BL(v) {
          BL = v;
        },
        get E() {
          return E;
        },
        set E(v) {
          E = v;
        },
        get ToyMissions() {
          return ToyMissions;
        },
        get groundAt() {
          return groundAt;
        },
        get MS() {
          return MS;
        },
        set MS(v) {
          MS = v;
        },
        get clamp() {
          return clamp;
        },
        get EB() {
          return EB;
        },
        set EB(v) {
          EB = v;
        },
        get hurt() {
          return hurt;
        },
        get DC() {
          return DC;
        },
        set DC(v) {
          DC = v;
        },
        get cam() {
          return cam;
        },
        get PITCH() {
          return PITCH;
        },
        get W() {
          return W;
        },
        set W(v) {
          W = v;
        },
        get F() {
          return F;
        },
        set F(v) {
          F = v;
        },
        get HY() {
          return HY;
        },
        set HY(v) {
          HY = v;
        },
        get ctx() {
          return ctx;
        },
        get rot() {
          return rot;
        },
        set rot(v) {
          rot = v;
        },
        get H() {
          return H;
        },
        set H(v) {
          H = v;
        },
        get shk() {
          return shk;
        },
        set shk(v) {
          shk = v;
        },
        get R() {
          return R;
        },
        get renderer3d() {
          return renderer3d;
        },
        set renderer3d(v) {
          renderer3d = v;
        },
        get lowQuality() {
          return lowQuality;
        },
        set lowQuality(v) {
          lowQuality = v;
        },
        get t() {
          return t;
        },
        set t(v) {
          t = v;
        },
        get ToyWorld() {
          return ToyWorld;
        },
        get sil() {
          return audioEngine.sil;
        },
        set sil(v) {
          audioEngine.sil = v;
        },
        get clearInput() {
          return clearInput;
        },
        get humOff() {
          return humOff;
        },
        get AC() {
          return audioEngine.AC;
        },
        set AC(v) {
          audioEngine.AC = v;
        },
        get checkpoint() {
          return checkpoint;
        },
        set checkpoint(v) {
          checkpoint = v;
        },
        get mis() {
          return mis;
        },
        set mis(v) {
          mis = v;
        },
        get muted() {
          return muted;
        },
        set muted(v) {
          muted = v;
        },
        get tb() {
          return tb;
        },
        set tb(v) {
          tb = v;
        },
        get P3() {
          return P3;
        },
        get savePreference() {
          return savePreference;
        },
        get rs() {
          return rs;
        },
        get tone() {
          return tone;
        },
        get start() {
          return start;
        },
        get SCALE_WIDTH() {
          return SCALE_WIDTH;
        },
        get airLeft() {
          return airLeft;
        },
        set airLeft(v) {
          airLeft = v;
        },
        get hs() {
          return hs;
        },
        set hs(v) {
          hs = v;
        },
        get spawnE() {
          return spawnE;
        },
        get upd() {
          return upd;
        },
        get last() {
          return last;
        },
        set last(v) {
          last = v;
        },
        get lastDraw() {
          return lastDraw;
        },
        set lastDraw(v) {
          lastDraw = v;
        },
        get loop() {
          return loop;
        },
        get keys() {
          return input.values.keys;
        },
        set keys(v) {
          input.values.keys = v;
        },
        get fire() {
          return input.values.fire;
        },
        set fire(v) {
          input.values.fire = v;
        },
        get mAsk() {
          return input.values.mAsk;
        },
        set mAsk(v) {
          input.values.mAsk = v;
        },
        get drag() {
          return input.values.drag;
        },
        set drag(v) {
          input.values.drag = v;
        },
        get firePointer() {
          return input.values.firePointer;
        },
        set firePointer(v) {
          input.values.firePointer = v;
        },
        get hum() {
          return audioEngine.hum;
        },
        set hum(v) {
          audioEngine.hum = v;
        },
      };
      const { preference, savePreference } = ToyPrefs.create(
        () => host.localStorage,
      );
      const audioEngine = ToyAudio.create({
        host,
        isPlaying: () => st === 'play',
        isMuted: () => muted,
      });
      const { silentSrc, audio, tone, noise, buzz, sfx, humOn, humOff } =
        audioEngine;
      const input = ToyInput.create(env),
        { clearInput, updateStick } = input;
      const combat = ToyCombat.create(env),
        { mk, boom, hit, kill, gunVelocity, stepProjectiles } = combat;
      const render2d = ToyRender2D.create(env);
      let {
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
      } = render2d;
      const ui = ToyUI.create(env),
        {
          renderStatus,
          menuLayout,
          show,
          mainMenu,
          menuPage,
          menuBack,
          soundLabel,
          qualityLabel,
          setText,
          updateHUD,
        } = ui;

      const $ = (id) => host.document.getElementById(id),
        clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
        R = (a, b) => a + Math.random() * (b - a);
      /* audio y vibración */

      let lowQuality = preference('quality', 'detail') === 'low',
        needsDraw = true;
      let muted = preference('muted', 'false') === 'true';

      function pauseGame() {
        if (st !== 'play') return;
        clearInput();
        st = 'paused';
        humOff();
        if (audioEngine.sil) audioEngine.sil.pause();
        if (audioEngine.AC) audioEngine.AC.suspend().catch(() => {});
        show(
          'Partida en pausa',
          'Tu misión continuará desde el mismo punto.',
          'Continuar',
        );
      }
      function resumeGame() {
        clearInput();
        st = 'play';
        audio();
        humOn();
        $('ov').style.display = 'none';
        $('hud').style.display = 'block';
        cv.tabIndex = 0;
        cv.focus?.();
      }
      host.addEventListener('blur', pauseGame);
      host.document.addEventListener('visibilitychange', () => {
        if (host.document.hidden) pauseGame();
      });
      /* cámara y proyección 3D (canvas 2D, sin WebGL) */
      const cv = $('c'),
        ctx = cv.getContext('2d'),
        cam = { x: 0, z: 0, yaw: Math.PI / 5 },
        PITCH = Math.PI / 3,
        SCALE_WIDTH = 105;
      let W = 360,
        H = 640,
        HY = 256,
        F = 380;
      function rs() {
        const r = cv.getBoundingClientRect(),
          d = Math.min(host.devicePixelRatio || 1, lowQuality ? 1 : 1.75);
        cv.width = r.width * d;
        cv.height = r.height * d;
        W = r.width;
        H = r.height;
        ctx.setTransform(d, 0, 0, d, 0, 0);
        F = Math.min(W / SCALE_WIDTH, H / 120);
        needsDraw = true;
      }
      host.addEventListener('resize', rs);
      rs();
      let renderer3d = null;

      renderStatus(false);
      try {
        if (typeof ToyRenderer !== 'undefined')
          renderer3d = new ToyRenderer(
            $('world3d'),
            () => {
              pauseGame();
              $('world3d').style.display = 'none';
              $('c').style.opacity = '1';
              renderStatus(false);
            },
            () => {
              renderStatus(true);
            },
          );
      } catch (error) {
        console.warn('Modo 2D: no se pudo iniciar WebGL.', error);
      }
      if (renderer3d) renderStatus(true);

      // Orthographic camera: fixed diagonal heading and 60-degree downward pitch.

      /* estado */
      let mission = null,
        checkpoint = 0,
        airLeft = 0,
        overlayPage = 'main';
      let st = 'menu',
        P,
        E = [],
        BL = [],
        EB = [],
        MS = [],
        FX = [],
        PK = [],
        DC = [],
        mis = 1,
        t = 0,
        rot = 0,
        shk = 0,
        bd = 0,
        tb = 0,
        hs = 3;

      const groundAt = (x, z) =>
        typeof ToyWorld === 'undefined' ? 0 : ToyWorld.height(x, z);
      DC = typeof ToyWorld === 'undefined' ? [] : ToyWorld.shrubs;

      function spawnE(k, x, z) {
        E.push({
          k,
          x,
          y: k === 'heli' ? 8 : groundAt(x, z),
          z,
          hp: { heli: 4, tank: 6, tur: 5, base: 10, inf: 2 }[k],
          r: { heli: 3, tank: 3.5, tur: 2.5, base: 6, inf: 1.5 }[k],
          cd: R(1, 3),
          p: { heli: 50, tank: 30, tur: 20, base: 100, inf: 10 }[k],
          fl: 0,
        });
      }
      function start(n, full) {
        clearInput();
        t = 0;
        shk = 0;
        mis = n;
        mission = new ToyMissions.Mission(n);
        airLeft = mission.config.air;
        E = [];
        BL = [];
        EB = [];
        MS = [];
        FX = [];
        PK = [];
        if (full || !P)
          P = { arm: 10, mi: 6, sc: 0, cd: 0, inv: 0, gs: 0, bank: 0 };
        else {
          P.arm = Math.min(10, P.arm + 3);
          P.mi += 4;
        }
        P.cd = 0;
        P.inv = 0;
        P.sc = full ? checkpoint : P.sc;
        P.x = 0;
        P.z = 0;
        P.y = 8;
        P.yaw = 0;
        bd = 0;
        tb = mission.config.bases.length;
        hs = 25;
        const ring = (k, c, a, b) => {
          for (let i = 0; i < c; i++) {
            let x = 0,
              z = b;
            for (let attempt = 0; attempt < 24; attempt++) {
              const an = R(0, 6.28),
                d = R(a, b),
                nx = Math.cos(an) * d,
                nz = Math.sin(an) * d;
              if (
                typeof ToyWorld === 'undefined' ||
                ToyWorld.clearOfLandmarks(nx, nz, 10)
              ) {
                x = nx;
                z = nz;
                break;
              }
            }
            spawnE(k, x, z);
          }
        };
        mission.config.bases.forEach(([x, z], camp) => {
          spawnE('base', x, z);
          E[E.length - 1].camp = camp;
        });
        ring('tank', mission.config.tanks, 45, 110);
        ring('tur', mission.config.turrets, 45, 110);
        ring('inf', mission.config.infantry, 35, 100);
        cam.x = 0;
        cam.z = 0;
        cam.yaw = Math.PI / 5;
        st = 'play';
      }

      function hurt() {
        if (st !== 'play' || P.inv > 0) return;
        P.arm--;
        P.inv = 0.3;
        shk = 0.3;
        sfx.hurt();
        buzz(60);
        if (P.arm <= 0) {
          st = 'over';
          humOff();
          sfx.over();
          buzz(300);
          clearInput();
          show(
            'Misión fallida',
            'Reintenta ' +
              mission.config.name +
              '. Los rescates de esta misión se reinician.',
            'Reintentar misión',
          );
        }
      }
      /* entrada */
      input.bind();
      ui.bind();
      // Aim assist is chosen at trigger time; bullets never steer after launch.

      /* actualización */
      function upd(dt) {
        if (st !== 'play') return;
        const controls = input.read(),
          usedMissile = controls.missile;
        t += dt;
        shk = Math.max(0, shk - dt);
        P.cd -= dt;
        P.inv -= dt;
        const { sx, sy } = controls;
        const magnitude = Math.min(1, Math.hypot(sx, sy));
        if (magnitude > 0.08) {
          const length = Math.hypot(sx, sy),
            right = sx / length,
            up = sy / length;
          const vx = -right * Math.cos(cam.yaw) + up * Math.sin(cam.yaw),
            vz = right * Math.sin(cam.yaw) + up * Math.cos(cam.yaw);
          P.yaw = Math.atan2(vx, vz);
          P.x = clamp(P.x + vx * 28 * magnitude * dt, -190, 190);
          P.z = clamp(P.z + vz * 28 * magnitude * dt, -190, 190);
        }
        const fx = Math.sin(P.yaw),
          fz = Math.cos(P.yaw);
        P.y = 8 + Math.sin(t * 3) * 0.3;
        P.bank = 0;
        const follow = 1 - Math.exp(-6 * dt);
        cam.x += (P.x - cam.x) * follow;
        cam.z += (P.z - cam.z) * follow;
        if (controls.fire && P.cd <= 0) {
          P.cd = 0.09;
          const side = (P.gs = !P.gs) ? 1.2 : -1.2;
          const muzzle = {
            x: P.x - fz * side + fx * 2,
            y: P.y - 0.3,
            z: P.z + fx * side + fz * 2,
          };
          const velocity = gunVelocity(P, muzzle, E);
          mk(
            BL,
            muzzle.x,
            muzzle.y,
            muzzle.z,
            velocity.vx,
            velocity.vy,
            velocity.vz,
            1.1,
          );
          sfx.shot();
        }
        if (controls.missile) {
          input.consumeMissile();
          if (P.mi > 0) {
            P.mi--;
            let tg = null,
              dm = 130;
            for (const e of E) {
              if (e.dead) continue;
              const dx = e.x - P.x,
                dz = e.z - P.z,
                d = Math.hypot(dx, dz);
              if (d < dm && dx * fx + dz * fz > 0.5 * d) {
                dm = d;
                tg = e;
              }
            }
            const o = mk(
              MS,
              P.x + fx * 2,
              P.y - 1,
              P.z + fz * 2,
              fx * 75,
              0,
              fz * 75,
              3,
            );
            o.tg = tg;
            sfx.miss();
          }
        }
        hs -= dt;
        if (hs <= 0 && airLeft > 0 && bd < tb) {
          hs = 25;
          airLeft--;
          if (
            E.filter((e) => e.k === 'heli' && !e.dead).length <
            Math.min(1 + mis, 4)
          ) {
            const a = R(0, 6.28);
            spawnE(
              'heli',
              clamp(P.x + Math.sin(a) * 110, -185, 185),
              clamp(P.z + Math.cos(a) * 110, -185, 185),
            );
          }
        }
        for (const e of E) {
          if (e.dead) continue;
          e.fl = Math.max(0, e.fl - dt);
          const dx = P.x - e.x,
            dz = P.z - e.z,
            d = Math.hypot(dx, dz),
            a = Math.atan2(dx, dz);
          if (e.k === 'heli') {
            const q = d > 32 ? 1 : 0;
            e.x += (Math.sin(a) * 18 * q + Math.cos(a) * 10 * (1 - q)) * dt;
            e.z += (Math.cos(a) * 18 * q - Math.sin(a) * 10 * (1 - q)) * dt;
            e.y = 8 + Math.sin(t * 2 + e.cd) * 0.4;
          } else if (e.k === 'tank' && d > 25 && d < 150) {
            e.x += Math.sin(a) * 6 * dt;
            e.z += Math.cos(a) * 6 * dt;
          }
          if (e.k === 'inf' && d > 18 && d < 80) {
            e.x += Math.sin(a) * 3 * dt;
            e.z += Math.cos(a) * 3 * dt;
          }
          if (e.k !== 'heli') e.y = groundAt(e.x, e.z);
          const rg =
            e.k === 'tur'
              ? 65
              : e.k === 'tank'
                ? 75
                : e.k === 'heli'
                  ? 70
                  : e.k === 'inf'
                    ? 45
                    : 0;
          e.cd -= dt;
          if (rg && d < rg && e.cd <= 0) {
            e.cd = e.k === 'heli' ? 1.5 : e.k === 'inf' ? 2.8 : 2.4;
            const s2 = 42,
              a2 = a + R(-0.06, 0.06);
            mk(
              EB,
              e.x,
              e.y + 2,
              e.z,
              Math.sin(a2) * s2,
              (8 - (e.y + 2)) / Math.max(0.3, d / s2),
              Math.cos(a2) * s2,
              4,
            );
          }
        }
        if (!stepProjectiles(dt)) return;
        for (const q of PK)
          if (Math.hypot(q.x - P.x, q.z - P.z) < 5) {
            q.d = 1;
            if (q.ty === 'a') P.arm = Math.min(10, P.arm + 3);
            else P.mi += 3;
            sfx.pick();
            buzz(20);
          }
        for (const o of FX) o.l -= dt;
        E = E.filter((e) => !e.dead);
        BL = BL.filter((b) => b.l > 0);
        MS = MS.filter((o) => o.l > 0);
        EB = EB.filter((b) => b.l > 0);
        PK = PK.filter((q) => !q.d);
        FX = FX.filter((o) => o.l > 0);
        const event = mission.update(dt, P, {
          moving: magnitude > 0.08,
          firing: !!(controls.fire || usedMissile),
          damaged: P.inv > 0,
        });
        if (event === 'rescued') {
          P.sc += 50;
          sfx.pick();
          buzz(20);
        }
        if (event === 'complete') {
          P.sc += 250;
          st = mis === ToyMissions.configs.length ? 'campaign' : 'win';
          clearInput();
          humOff();
          show(
            st === 'campaign'
              ? 'Campaña completada'
              : 'Misión ' + mis + ' cumplida',
            'Rescatados: ' + mission.rescued + '. Puntos: ' + P.sc + '.',
            st === 'campaign' ? 'Jugar de nuevo' : 'Siguiente misión',
          );
        }
        updateHUD();
      }
      /* sprites */

      // Rounded molded parts: a solid team color with a narrow plastic highlight.

      // Shared household geometry projected as shaded faces in the fallback.

      /* dibujo */

      let last = host.performance.now(),
        lastDraw = -Infinity;
      function loop(n) {
        const dt = Math.max(0, Math.min(0.05, (n - last) / 1e3));
        last = n;
        if (!host.document.hidden) {
          if (st === 'play') {
            rot += dt * 30;
            upd(dt);
          } else if (st === 'menu') {
            rot += dt * 30;
            cam.x = Math.sin(n / 12000) * 20;
            cam.z = Math.cos(n / 12000) * 20;
          }
          // Throttle drawing only: simulation/input keep the browser's frame cadence.
          if (
            needsDraw ||
            ((st === 'play' || st === 'menu') &&
              (!lowQuality || n - lastDraw >= 1000 / 30 - 1))
          ) {
            draw();
            lastDraw = n;
            needsDraw = false;
          }
        }
        host.requestAnimationFrame(loop);
      }
      host.requestAnimationFrame(loop);

      return {
        view: env,
        input,
        audio: audioEngine,
        combat,
        ui,
        render2d,
        pauseGame,
        resumeGame,
        rs,
        spawnE,
        start,
        hurt,
        upd,
        loop,
      };
    }
    return { create };
  },
);
