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
    const transitions = Object.freeze({
      menu: Object.freeze(['play']),
      play: Object.freeze(['paused', 'over', 'win', 'campaign']),
      paused: Object.freeze(['play', 'menu']),
      over: Object.freeze(['play', 'menu']),
      win: Object.freeze(['play', 'menu']),
      campaign: Object.freeze(['play', 'menu']),
    });
    function transition(state, next, onTransition = () => {}) {
      if (next === state.st) return false;
      if (!transitions[state.st]?.includes(next))
        throw new Error('Invalid transition: ' + state.st + ' -> ' + next);
      const previous = state.st;
      state.st = next;
      onTransition(next, previous);
      return true;
    }
    function create(host = globalThis, options = {}) {
      const random = options.random || Math.random;
      const Renderer =
        options.Renderer === undefined ? ToyRenderer : options.Renderer;
      const state = {};
      const env = {
        get random() {
          return random;
        },
        get state() {
          return state;
        },
        get setState() {
          return setState;
        },
        get syncAudio() {
          return syncAudio;
        },
        get mainMenu() {
          return mainMenu;
        },
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
        get pauseGame() {
          return pauseGame;
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
        get visualRandom() {
          return options.visualRandom || Math.random;
        },
        get sfx() {
          return sfx;
        },
        get buzz() {
          return buzz;
        },
        get ToyMissions() {
          return ToyMissions;
        },
        get groundAt() {
          return groundAt;
        },
        get clamp() {
          return clamp;
        },
        get hurt() {
          return hurt;
        },
        get cam() {
          return cam;
        },
        get PITCH() {
          return PITCH;
        },
        get ctx() {
          return ctx;
        },
        get R() {
          return R;
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
        get spawnE() {
          return spawnE;
        },
        get upd() {
          return upd;
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
      // Compatibility view: these accessors reference the sole state object, never copies.
      for (const key of [
        'lastDraw',
        'last',
        'hs',
        'airLeft',
        'tb',
        'muted',
        'mis',
        'checkpoint',
        't',
        'lowQuality',
        'renderer3d',
        'shk',
        'H',
        'rot',
        'HY',
        'F',
        'W',
        'DC',
        'EB',
        'MS',
        'E',
        'BL',
        'PK',
        'mission',
        'bd',
        'P',
        'FX',
        'DB',
        'needsDraw',
        'overlayPage',
        'st',
      ])
        Object.defineProperty(env, key, {
          enumerable: true,
          get: () => state[key],
          set: (value) => {
            state[key] = value;
          },
        });

      const { preference, savePreference } = ToyPrefs.create(
        () => host.localStorage,
      );
      const audioEngine = ToyAudio.create({
        host,
        isPlaying: () => state.st === 'play',
        isMuted: () => state.muted,
      });
      const { silentSrc, audio, tone, noise, buzz, sfx, humOn, humOff } =
        audioEngine;
      const input = ToyInput.create(env),
        { clearInput, updateStick } = input;
      const combat = ToyCombat.create(env),
        { mk, boom, hit, kill, gunVelocity, stepProjectiles, stepDebris } =
          combat;
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
          menuPage,
          menuBack,
          soundLabel,
          qualityLabel,
          setText,
          updateHUD,
        } = ui;

      const $ = (id) => host.document.getElementById(id),
        clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
        R = (a, b) => a + random() * (b - a);
      /* audio y vibración */

      Object.assign(state, {
        lowQuality: preference('quality', 'detail') === 'low',
        needsDraw: true,
      });
      Object.assign(state, { muted: preference('muted', 'false') === 'true' });

      function syncAudio() {
        if (state.st === 'play' && !state.muted) {
          audio();
          humOn();
        } else
          audioEngine.suspend(
            state.muted || state.st === 'paused' || state.st === 'menu',
          );
      }
      function applyState() {
        clearInput();
        syncAudio();
        ui.presentState(state.st);
        state.needsDraw = true;
      }
      function setState(next) {
        return transition(state, next, applyState);
      }
      function mainMenu() {
        state.P = null;
        state.mission = null;
        state.E = [];
        state.BL = [];
        state.EB = [];
        state.MS = [];
        state.FX = [];
        state.DB = [];
        state.PK = [];
        state.checkpoint = 0;
        state.mis = 1;
        state.shk = 0;
        if (!setState('menu')) applyState();
      }
      function pauseGame() {
        if (state.st === 'play') setState('paused');
      }
      function resumeGame() {
        if (state.st === 'paused') setState('play');
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
      Object.assign(state, { W: 360, H: 640, HY: 256, F: 380 });
      function rs() {
        const r = cv.getBoundingClientRect(),
          d = Math.min(host.devicePixelRatio || 1, state.lowQuality ? 1 : 1.75);
        cv.width = r.width * d;
        cv.height = r.height * d;
        state.W = r.width;
        state.H = r.height;
        ctx.setTransform(d, 0, 0, d, 0, 0);
        state.F = Math.min(state.W / SCALE_WIDTH, state.H / 120);
        state.needsDraw = true;
      }
      host.addEventListener('resize', rs);
      rs();
      Object.assign(state, { renderer3d: null });

      renderStatus(false);
      try {
        if (typeof Renderer === 'function')
          state.renderer3d = new Renderer(
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
      if (state.renderer3d) renderStatus(true);

      // Orthographic camera: fixed diagonal heading and 60-degree downward pitch.

      /* estado */
      Object.assign(state, {
        mission: null,
        checkpoint: 0,
        airLeft: 0,
        overlayPage: 'main',
      });
      Object.assign(state, {
        st: 'menu',
        P: undefined,
        E: [],
        BL: [],
        EB: [],
        MS: [],
        FX: [],
        DB: [],
        PK: [],
        DC: [],
        mis: 1,
        t: 0,
        rot: 0,
        shk: 0,
        bd: 0,
        tb: 0,
        hs: 3,
      });

      const groundAt = (x, z) =>
        typeof ToyWorld === 'undefined' ? 0 : ToyWorld.height(x, z);
      state.DC = typeof ToyWorld === 'undefined' ? [] : ToyWorld.shrubs;

      function spawnE(k, x, z) {
        state.E.push({
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
        state.t = 0;
        state.shk = 0;
        state.mis = n;
        state.mission = new ToyMissions.Mission(n);
        state.airLeft = state.mission.config.air;
        state.E = [];
        state.BL = [];
        state.EB = [];
        state.MS = [];
        state.FX = [];
        state.DB = [];
        state.PK = [];
        if (full || !state.P)
          state.P = { arm: 10, mi: 6, sc: 0, cd: 0, inv: 0, gs: 0, bank: 0 };
        else {
          state.P.arm = Math.min(10, state.P.arm + 3);
          state.P.mi += 4;
        }
        state.P.cd = 0;
        state.P.inv = 0;
        state.P.sc = full ? state.checkpoint : state.P.sc;
        state.P.x = 0;
        state.P.z = 0;
        state.P.y = 8;
        state.P.yaw = 0;
        state.bd = 0;
        state.tb = state.mission.config.bases.length;
        state.hs = 25;
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
        state.mission.config.bases.forEach(([x, z], camp) => {
          spawnE('base', x, z);
          state.E[state.E.length - 1].camp = camp;
        });
        ring('tank', state.mission.config.tanks, 45, 110);
        ring('tur', state.mission.config.turrets, 45, 110);
        ring('inf', state.mission.config.infantry, 35, 100);
        cam.x = 0;
        cam.z = 0;
        cam.yaw = Math.PI / 5;
        setState('play');
      }

      function hurt() {
        if (state.st !== 'play' || state.P.inv > 0) return;
        state.P.arm--;
        state.P.inv = 0.3;
        state.shk = 0.3;
        sfx.hurt();
        buzz(60);
        if (state.P.arm <= 0) {
          setState('over');
          sfx.over();
          buzz(300);
        }
      }
      /* entrada */
      input.bind();
      ui.bind();
      // Aim assist is chosen at trigger time; bullets never steer after launch.

      /* actualización */
      function upd(dt) {
        if (state.st !== 'play') return;
        const controls = input.read(),
          usedMissile = controls.missile;
        state.t += dt;
        state.shk = Math.max(0, state.shk - dt);
        state.P.cd -= dt;
        state.P.inv -= dt;
        const { sx, sy } = controls;
        const magnitude = Math.min(1, Math.hypot(sx, sy));
        if (magnitude > 0.08) {
          const length = Math.hypot(sx, sy),
            right = sx / length,
            up = sy / length;
          const vx = -right * Math.cos(cam.yaw) + up * Math.sin(cam.yaw),
            vz = right * Math.sin(cam.yaw) + up * Math.cos(cam.yaw);
          state.P.yaw = Math.atan2(vx, vz);
          state.P.x = clamp(state.P.x + vx * 28 * magnitude * dt, -190, 190);
          state.P.z = clamp(state.P.z + vz * 28 * magnitude * dt, -190, 190);
        }
        const fx = Math.sin(state.P.yaw),
          fz = Math.cos(state.P.yaw);
        state.P.y = 8 + Math.sin(state.t * 3) * 0.3;
        state.P.bank = 0;
        const follow = 1 - Math.exp(-6 * dt);
        cam.x += (state.P.x - cam.x) * follow;
        cam.z += (state.P.z - cam.z) * follow;
        if (controls.fire && state.P.cd <= 0) {
          state.P.cd = 0.09;
          const side = (state.P.gs = !state.P.gs) ? 1.2 : -1.2;
          const muzzle = {
            x: state.P.x - fz * side + fx * 2,
            y: state.P.y - 0.3,
            z: state.P.z + fx * side + fz * 2,
          };
          const velocity = gunVelocity(state.P, muzzle, state.E);
          mk(
            state.BL,
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
          if (state.P.mi > 0) {
            state.P.mi--;
            let tg = null,
              dm = 130;
            for (const e of state.E) {
              if (e.dead) continue;
              const dx = e.x - state.P.x,
                dz = e.z - state.P.z,
                d = Math.hypot(dx, dz);
              if (d < dm && dx * fx + dz * fz > 0.5 * d) {
                dm = d;
                tg = e;
              }
            }
            const o = mk(
              state.MS,
              state.P.x + fx * 2,
              state.P.y - 1,
              state.P.z + fz * 2,
              fx * 75,
              0,
              fz * 75,
              3,
            );
            o.tg = tg;
            sfx.miss();
          }
        }
        state.hs -= dt;
        if (state.hs <= 0 && state.airLeft > 0 && state.bd < state.tb) {
          state.hs = 25;
          state.airLeft--;
          if (
            state.E.filter((e) => e.k === 'heli' && !e.dead).length <
            Math.min(1 + state.mis, 4)
          ) {
            const a = R(0, 6.28);
            spawnE(
              'heli',
              clamp(state.P.x + Math.sin(a) * 110, -185, 185),
              clamp(state.P.z + Math.cos(a) * 110, -185, 185),
            );
          }
        }
        for (const e of state.E) {
          if (e.dead) continue;
          e.fl = Math.max(0, e.fl - dt);
          const dx = state.P.x - e.x,
            dz = state.P.z - e.z,
            d = Math.hypot(dx, dz),
            a = Math.atan2(dx, dz);
          if (e.k === 'heli') {
            const q = d > 32 ? 1 : 0;
            e.x += (Math.sin(a) * 18 * q + Math.cos(a) * 10 * (1 - q)) * dt;
            e.z += (Math.cos(a) * 18 * q - Math.sin(a) * 10 * (1 - q)) * dt;
            e.y = 8 + Math.sin(state.t * 2 + e.cd) * 0.4;
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
              state.EB,
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
        for (const q of state.PK)
          if (Math.hypot(q.x - state.P.x, q.z - state.P.z) < 5) {
            q.d = 1;
            if (q.ty === 'a') state.P.arm = Math.min(10, state.P.arm + 3);
            else state.P.mi += 3;
            sfx.pick();
            buzz(20);
          }
        stepDebris(dt);
        for (const o of state.FX) o.l -= dt;
        state.E = state.E.filter((e) => !e.dead);
        state.BL = state.BL.filter((b) => b.l > 0);
        state.MS = state.MS.filter((o) => o.l > 0);
        state.EB = state.EB.filter((b) => b.l > 0);
        state.PK = state.PK.filter((q) => !q.d);
        state.FX = state.FX.filter((o) => o.l > 0);
        const event = state.mission.update(dt, state.P, {
          moving: magnitude > 0.08,
          firing: !!(controls.fire || usedMissile),
          damaged: state.P.inv > 0,
        });
        if (event === 'rescued') {
          state.P.sc += 50;
          sfx.pick();
          buzz(20);
        }
        if (event === 'complete') {
          state.P.sc += 250;
          setState(
            state.mis === ToyMissions.configs.length ? 'campaign' : 'win',
          );
        }
        updateHUD();
      }
      /* sprites */

      // Rounded molded parts: a solid team color with a narrow plastic highlight.

      // Shared household geometry projected as shaded faces in the fallback.

      /* dibujo */

      Object.assign(state, {
        last: host.performance.now(),
        lastDraw: -Infinity,
      });
      function loop(n) {
        const dt = Math.max(0, Math.min(0.05, (n - state.last) / 1e3));
        state.last = n;
        if (!host.document.hidden) {
          if (state.st === 'play') {
            state.rot += dt * 30;
            upd(dt);
          } else if (state.st === 'menu') {
            state.rot += dt * 30;
            cam.x = Math.sin(n / 12000) * 20;
            cam.z = Math.cos(n / 12000) * 20;
          }
          // Throttle drawing only: simulation/input keep the browser's frame cadence.
          if (
            state.needsDraw ||
            ((state.st === 'play' || state.st === 'menu') &&
              (!state.lowQuality || n - state.lastDraw >= 1000 / 30 - 1))
          ) {
            draw();
            state.lastDraw = n;
            state.needsDraw = false;
          }
        }
        host.requestAnimationFrame(loop);
      }
      host.requestAnimationFrame(loop);

      return {
        state,
        setState,
        mainMenu,
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
    return { create, transitions, transition };
  },
);
