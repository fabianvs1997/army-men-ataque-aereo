(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(
      require('./collision.js'),
      require('./prefs.js'),
      require('./audio.js'),
      require('./input.js'),
      require('./combat.js'),
      require('./projection.js'),
      require('./draw3d.js'),
      require('./ui.js'),
      require('./toy-world.js'),
      require('./toy-missions.js'),
      require('./toy-renderer.js'),
      require('./escort-mission.js'),
      require('./escort-progress.js'),
      require('./mission-map.js'),
      require('./perf.js'),
      require('./logger.js'),
      require('./supabase-config.js'),
      require('./supabase.js'),
    );
  else
    root.ToyGame = factory(
      root.ToyCollision,
      root.ToyPrefs,
      root.ToyAudio,
      root.ToyInput,
      root.ToyCombat,
      root.ToyProjection,
      root.ToyDraw3D,
      root.ToyUI,
      root.ToyWorld,
      root.ToyMissions,
      root.ToyRenderer,
      root.ToyEscort,
      root.ToyEscortProgress,
      root.ToyMissionMap,
      root.ToyPerf,
      root.ToyLogger,
      root.ToySupabaseConfig,
      root.ToySupabase,
    );
})(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function (
    ToyCollision,
    ToyPrefs,
    ToyAudio,
    ToyInput,
    ToyCombat,
    ToyProjection,
    ToyDraw3D,
    ToyUI,
    DefaultWorld,
    ToyMissions,
    ToyRenderer,
    ToyEscort,
    ToyEscortProgress,
    ToyMissionMap,
    ToyPerf,
    ToyLogger,
    ToySupabaseConfig,
    ToySupabase,
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
    // Visual pose only: positive pitch lowers the nose along the current heading.
    function updatePitch(player, dx, dz, dt) {
      if (!(dt > 0)) return;
      const speed = Math.max(
        -1,
        Math.min(
          1,
          (dx * Math.sin(player.yaw) + dz * Math.cos(player.yaw)) / (28 * dt),
        ),
      );
      const previous = player.pitchSpeed || 0;
      const target = Math.max(
        -0.3,
        Math.min(0.4, speed * 0.32 + (speed - previous) * 0.8),
      );
      player.pitch =
        (player.pitch || 0) +
        (target - (player.pitch || 0)) * (1 - Math.exp(-12 * dt));
      player.pitchSpeed =
        previous + (speed - previous) * (1 - Math.exp(-5 * dt));
    }
    // Chase-camera flight: horizontal input steers; vertical input is signed throttle.
    function pilotMotion(player, sx, sy, dt) {
      const length = Math.hypot(sx, sy);
      if (!(dt > 0) || length <= 0.12) return { dx: 0, dz: 0, active: false };
      const gain = (Math.min(1, length) - 0.12) / (0.88 * length);
      const turn = -sx * gain * 1.8 * dt,
        distance = sy * gain * 28 * dt;
      const middle = player.yaw + turn * 0.5;
      player.yaw = Math.atan2(
        Math.sin(player.yaw + turn),
        Math.cos(player.yaw + turn),
      );
      return {
        dx: Math.sin(middle) * distance,
        dz: Math.cos(middle) * distance,
        active: true,
      };
    }
    function cameraFraming(width, height) {
      const pitch = (40 * Math.PI) / 180;
      const scale = Math.min(width / 62, height / 72);
      return {
        pitch,
        scale,
        centerY: height * 0.64 + 8 * Math.cos(pitch) * scale,
      };
    }
    function create(host = globalThis, options = {}) {
      const random = options.random || Math.random;
      const ToyWorld = { ...DefaultWorld };
      let currentMap;
      const Renderer =
        options.Renderer === undefined ? ToyRenderer : options.Renderer;
      const state = {};
      const progress = ToyEscortProgress.create(() => host.localStorage);
      const env = {
        get savedProgress() {
          return progress.read();
        },
        get random() {
          return random;
        },
        get cover() {
          return cover;
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
        get perf() {
          return perf;
        },
        get logger() {
          return logger;
        },
        get online() {
          return online;
        },
        get flushRemoteLogs() {
          return flushRemoteLogs;
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
        'cameraCenterY',
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
        'SM',
        'DB',
        'needsDraw',
        'overlayPage',
        'missionPanelOpen',
        'st',
        'pixelRatioCap',
        'perfLevel',
        'perfVisible',
        'logsVisible',
        'modelosVisible',
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
      // Monitor de rendimiento: si los frames se alargan, baja solo de
      // detalle (ver src/perf.js) en vez de quedarse congelado.
      const perf = ToyPerf.create();
      Object.assign(state, {
        pixelRatioCap: perf.pixelRatioCap,
        perfLevel: 0,
        perfVisible:
          typeof host.location === 'object' &&
          /[?&]perf=1/.test(host.location.search || ''),
        logsVisible:
          typeof host.location === 'object' &&
          /[?&]logs=1/.test(host.location.search || ''),
        // Lectura de modelos opcional (?modelos=1): muestra en pantalla
        // qué se dibuja (Blender o procedural) y por qué cayó al
        // respaldo, para comprobarlo en el iPhone sin adivinar.
        modelosVisible:
          typeof host.location === 'object' &&
          /[?&]modelos=1/.test(host.location.search || ''),
      });
      // Registro de errores (ver src/logger.js): captura errores de
      // consola, rechazos y frames de más de 500 ms, con el contexto de
      // la partida. Nunca rompe el juego si el almacenamiento falla.
      function deviceInfo() {
        try {
          const nav = host.navigator || {};
          return [nav.platform, nav.userAgent]
            .filter(Boolean)
            .join(' ')
            .slice(0, 160);
        } catch (_) {
          return '';
        }
      }
      const logger = ToyLogger.create({
        getStorage: () => host.localStorage,
        version: host.ToyVersion || 'dev',
        device: deviceInfo(),
        getContext: () => ({
          mission: state.mis,
          phase: state.mission?.stage || '',
          seed: state.mapSeed ?? null,
          fps: perf.ema
            ? Math.round(1000 / Math.max(1, perf.ema))
            : null,
          ms: +perf.ema.toFixed(1),
          level: perf.level,
        }),
      });
      try {
        logger.install(host);
      } catch (_) {}
      // Supabase opcional (ver src/supabase.js y docs/SUPABASE.md): sin
      // configuración el juego sigue 100 % offline como invitado.
      const online = ToySupabase.create({
        config: ToySupabaseConfig,
        logger,
        getStorage: () => host.localStorage,
        host,
      });
      let logsFlushed = 0;
      function flushRemoteLogs() {
        const pending = logger.list().slice(logsFlushed);
        if (!pending.length) return Promise.resolve({ ok: true, sent: 0 });
        return online
          .flushLogs(pending)
          .then((result) => {
            if (result.ok) logsFlushed += pending.length;
            return result;
          })
          .catch(() => ({ ok: false, reason: 'offline' }));
      }
      online
        .init()
        .then(() => online.flushPendingScores().catch(() => {}))
        .catch(() => {});
      const audioEngine = ToyAudio.create({
        host,
        isPlaying: () => state.st === 'play',
        isMuted: () => state.muted,
      });
      const { silentSrc, audio, tone, noise, buzz, sfx, humOn, humOff, rotorSet, musicOn } =
        audioEngine;
      const input = ToyInput.create(env),
        { clearInput, updateStick } = input;
      const cover = ToyCollision.create(env, ToyWorld);
      const combat = ToyCombat.create(env),
        { mk, boom, hit, kill, gunVelocity, bulletKindFor, stepProjectiles } =
          combat;
      // Solo 3D: la proyección de cámara vive en ToyProjection y el
      // dibujo, en ToyDraw3D (WebGL). La brújula del HUD ya no usa
      // P3: ToyCompass calcula rumbo y objetivo en coordenadas del
      // mundo. Sin WebGL no hay respaldo 2D: se muestra el mensaje
      // de WebGL requerido.
      const projection = ToyProjection.create(env);
      const { P3 } = projection;
      const draw3d = ToyDraw3D.create(env);
      let { draw } = draw3d;
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
        // La música solo puede arrancar tras un toque del usuario (iOS
        // bloquea el autoplay): musicOn() no hace nada sin AudioContext,
        // y el contexto se crea en audio(), que se llama desde los
        // gestos (botones y canvas). Silenciar apaga todo: suspend()
        // para la música y el rotor, y el estado muted bloquea los SFX.
        if (state.muted) {
          audioEngine.suspend(true);
          return;
        }
        if (state.st === 'play') {
          audio();
          humOn();
          musicOn(1);
        } else if (state.st === 'menu') {
          humOff();
          musicOn(0.45);
        } else audioEngine.suspend(state.st === 'paused');
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
        state.SM = [];
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
      /* cámara y proyección 3D (solo WebGL): el canvas es `world3d`. */
      const cv = $('world3d'),
        cam = { x: 0, z: 0, yaw: Math.PI / 5 },
        PITCH = cameraFraming(360, 640).pitch;
      Object.assign(state, { W: 360, H: 640, HY: 256, F: 380 });
      function rs() {
        const r = cv.getBoundingClientRect(),
          d = Math.min(
            host.devicePixelRatio || 1,
            state.lowQuality ? 1 : state.pixelRatioCap || 1.75,
          );
        cv.width = r.width * d;
        cv.height = r.height * d;
        state.W = r.width;
        state.H = r.height;
        const framing = cameraFraming(state.W, state.H);
        state.F = framing.scale;
        state.cameraCenterY = framing.centerY;
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
              renderStatus(false);
            },
            () => {
              renderStatus(true);
            },
          );
      } catch (error) {
        // Sin WebGL no hay respaldo 2D: el juego muestra el mensaje
        // de WebGL requerido (ver src/draw3d.js) en vez de dibujar.
        console.warn('WebGL no disponible: el juego necesita WebGL 3D.', error);
      }
      if (state.renderer3d) renderStatus(true);

      // Orthographic chase camera: follows the nose with the configured oblique pitch.

      /* estado */
      Object.assign(state, {
        mission: null,
        checkpoint: 0,
        overlayPage: 'main',
      });
      Object.assign(state, {
        st: 'menu',
        missionPanelOpen: false,
        P: undefined,
        E: [],
        BL: [],
        EB: [],
        MS: [],
        FX: [],
        SM: [],
        DB: [],
        PK: [],
        DC: [],
        mis: 1,
        t: 0,
        rot: 0,
        shk: 0,
        bd: 0,
        tb: 0,
      });

      const groundAt = (x, z) =>
        typeof ToyWorld === 'undefined' ? 0 : ToyWorld.height(x, z);
      state.DC = typeof ToyWorld === 'undefined' ? [] : ToyWorld.shrubs;

      function spawnE(k, x, z) {
        // Garaje Tan (Misión 2): edificio de 10 HP, como una base;
        // coche de suministros (Misión 2): 3 HP, pequeño y rápido.
        const radius = {
          base: 6,
          tank: 3.5,
          tur: 2.5,
          inf: 0.7,
          heli: 1.8,
          garage: 6,
          car: 2.5,
        }[k];
        const start = state.mission?.start || ToyMissions.layout.start;
        const safeDistance =
          ToyMissions.layout.minEnemyDistance +
          Math.max(radius, k === 'heli' ? 3 : 1.5);
        const free = (nx, nz) =>
          Math.hypot(nx - start.x, nz - start.z) >= safeDistance &&
          (typeof ToyWorld === 'undefined' ||
            !ToyWorld.canTravel ||
            ToyWorld.canTravel(nx, nz, radius)) &&
          !cover.overlaps(
            { x: nx, y: k === 'heli' ? 8 : groundAt(nx, nz) + 2, z: nz },
            radius,
            k === 'base' ? 2.5 : 1.3,
          );
        if (!free(x, z)) {
          const ox = x,
            oz = z;
          search: for (let distance = 3; distance <= 30; distance += 3)
            for (let i = 0; i < 16; i++) {
              const nx = clamp(
                  ox + Math.cos((i * Math.PI) / 8) * distance,
                  -ToyWorld.limit + 15,
                  ToyWorld.limit - 15,
                ),
                nz = clamp(
                  oz + Math.sin((i * Math.PI) / 8) * distance,
                  -ToyWorld.limit + 15,
                  ToyWorld.limit - 15,
                );
              if (free(nx, nz)) {
                x = nx;
                z = nz;
                break search;
              }
            }
        }
        if (!free(x, z) && typeof ToyWorld !== 'undefined' && ToyWorld.roads) {
          const candidate = ToyWorld.roads
            .filter((p) => free(p.x, p.z))
            .sort(
              (a, b) =>
                Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z),
            )[0];
          if (candidate) {
            x = candidate.x;
            z = candidate.z;
          }
        }
        // Never fall back to the rejected position if no valid spawn exists.
        if (!free(x, z)) return null;
        const enemy = {
          k,
          x,
          y: k === 'heli' ? 8 : groundAt(x, z),
          z,
          hp: { heli: 4, tank: 6, tur: 5, base: 10, inf: 2, garage: 10, car: 3 }[k],
          r: { heli: 3, tank: 3.5, tur: 2.5, base: 6, inf: 1.5, garage: 6, car: 2.5 }[k],
          cd: R(1, 3),
          p: { heli: 50, tank: 30, tur: 20, base: 100, inf: 10, garage: 100, car: 10 }[k],
          fl: 0,
        };
        state.E.push(enemy);
        return enemy;
      }
      // Punto volable más cercano a (x, z) (Misión 3): la batería cae
      // donde muere el helicóptero Tan, que puede ser sobre el camino
      // o junto a un obstáculo; el helicóptero necesita un punto
      // llano para bajar con el winch. Se buscan anillos de 0 a 30 u
      // (paso 3 u, 16 ángulos por anillo); si no hay ninguno, se
      // devuelve el punto original.
      function nearestFlyable(x, z) {
        const radius = 1.8;
        for (let distance = 0; distance <= 30; distance += 3)
          for (let i = 0; i < 16; i++) {
            const nx = clamp(
                x + Math.cos((i * Math.PI) / 8) * distance,
                -ToyWorld.limit + 15,
                ToyWorld.limit - 15,
              ),
              nz = clamp(
                z + Math.sin((i * Math.PI) / 8) * distance,
                -ToyWorld.limit + 15,
                ToyWorld.limit - 15,
              );
            if (
              typeof ToyWorld === 'undefined' ||
              !ToyWorld.canTravel ||
              ToyWorld.canTravel(nx, nz, radius)
            )
              return { x: nx, z: nz };
          }
        return { x, z };
      }
      function start(n, full, retry = false) {
        clearInput();
        state.t = 0;
        state.shk = 0;
        state.mis = n;
        if (!retry || !currentMap) {
          // Mapas fijos del original (src/original-maps.js): cada
          // misión tiene un solo mapa, siempre el mismo; reintentar
          // conserva el mapa de esa misión y empezar de nuevo vuelve
          // al mismo mapa fijo. No hay semillas de campaña.
          currentMap = ToyMissionMap.generate(null, n);
        }
        Object.assign(ToyWorld, DefaultWorld.create(currentMap));
        state.world = ToyWorld;
        state.mapSeed = currentMap.seed;
        state.mapName = currentMap.name;
        state.DC = ToyWorld.shrubs;
        if (state.renderer3d?.setWorld) state.renderer3d.setWorld(ToyWorld);
        state.mission = new ToyEscort.Mission(n, currentMap.rules);
        state.E = [];
        state.BL = [];
        state.EB = [];
        state.MS = [];
        state.FX = [];
        state.SM = [];
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
        state.P.x = state.mission.start.x;
        state.P.z = state.mission.start.z;
        state.P.y = 8;
        state.P.yaw = 0;
        state.P.pitch = 0;
        state.P.pitchSpeed = 0;
        state.bd = 0;
        state.tb = state.mission.config.bases.length;
        for (const placement of state.mission.enemyPlan) {
          const e = spawnE(placement.k, placement.x, placement.z);
          if (!e)
            throw new Error('No hay espacio para el despliegue de misión.');
          e.id = placement.id;
          e.zone = placement.zone;
          e.hp = placement.hp;
          // Los garajes traen su `yaw` del mapa (hacia el circuito);
          // el renderizador lo usa para orientar la puerta.
          if (placement.yaw !== undefined) e.yaw = placement.yaw;
        }
        cam.x = state.P.x;
        cam.z = state.P.z;
        cam.yaw = state.P.yaw;
        setState('play');
        // Resumen de la misión al arrancar: nombre y objetivo en
        // pantalla unos segundos, como la pantalla de misión del
        // original, sin abrir el panel.
        ui.showToast(
          'Misión ' +
            state.mis +
            '/3 · ' +
            state.mission.config.name +
            ' — ' +
            state.mission.message,
          5000,
        );
      }

      function hurt() {
        if (state.st !== 'play' || state.P.inv > 0) return;
        state.P.arm--;
        state.P.inv = 0.3;
        state.shk = 0.3;
        sfx.hurt();
        // Salud baja (3 o menos): aviso sonoro una sola vez por
        // cruce, cuando la barra se pone en rojo (ver src/ui.js).
        if (state.P.arm === 3) sfx.alarm();
        buzz(60);
        if (state.P.arm <= 0) {
          state.mission.reason = 'Helicóptero destruido';
          state.mission.transition('FRACASADA');
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
        const beforeX = state.P.x,
          beforeZ = state.P.z;
        const motion = pilotMotion(state.P, sx, sy, dt);
        const magnitude = motion.active ? Math.min(1, Math.hypot(sx, sy)) : 0;
        rotorSet(magnitude, 0);
        if (motion.dx || motion.dz) {
          const next = cover.move(state.P, {
            x: clamp(
              state.P.x + motion.dx,
              -ToyWorld.limit + 10,
              ToyWorld.limit - 10,
            ),
            y: state.P.y,
            z: clamp(
              state.P.z + motion.dz,
              -ToyWorld.limit + 10,
              ToyWorld.limit - 10,
            ),
          });
          state.P.x = next.x;
          state.P.z = next.z;
        }
        const fx = Math.sin(state.P.yaw),
          fz = Math.cos(state.P.yaw);
        state.P.y = 8 + Math.sin(state.t * 3) * 0.3;
        state.P.bank = 0;
        updatePitch(state.P, state.P.x - beforeX, state.P.z - beforeZ, dt);
        cam.x = state.P.x;
        cam.z = state.P.z;
        cam.yaw = state.P.yaw;
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
            0.85,
            'heli',
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
            o.smoke = 0;
            sfx.miss();
          }
        }
        const soldiers = state.mission.activeSoldiers();
        // Puntos de los soldados: una vez por frame, no uno por enemigo
        // y soldado (antes se construía el mismo punto ~20 veces/frame).
        const soldierPoints = soldiers.map((ally) => ({
          x: ally.x,
          y: groundAt(ally.x, ally.z) + 1.5,
          z: ally.z,
        }));
        for (const e of state.E) {
          if (e.dead) continue;
          e.fl = Math.max(0, e.fl - dt);
          // Coches de suministros (Misión 2): avanzan por el circuito
          // hacia el portal a 10 u/s, sin disparar. Al llegar al
          // último punto de su ruta (el portal), desaparecen sin
          // explosión ni puntos: el contador de coches lo lleva la
          // misión (`carEscaped`). Su ruta es la del garaje que los
          // soltó, empezando por el vértice al que se incorporan.
          if (e.k === 'car') {
            const wp = e.route?.[e.wp || 0];
            if (!wp) {
              e.dead = 1;
              state.mission.carEscaped(e);
              continue;
            }
            const dx = wp[0] - e.x,
              dz = wp[1] - e.z,
              d = Math.hypot(dx, dz),
              step = Math.min(d, 10 * dt);
            if (d > 0.01) {
              e.x += (dx / d) * step;
              e.z += (dz / d) * step;
              e.yaw = Math.atan2(dx, dz);
            }
            if (d <= 3) {
              e.wp = (e.wp || 0) + 1;
              if (e.wp >= e.route.length) {
                e.dead = 1;
                state.mission.carEscaped(e);
              }
            }
            e.y = groundAt(e.x, e.z);
            continue;
          }
          // Alcance de disparo por tipo: la línea de visión a un soldado
          // solo se traza si el enemigo podría dispararle. Antes se
          // trazaba a cualquier soldado más cercano que el jugador, sin
          // límite de distancia: con el jugador lejos (vuelo a C y vuelta
          // a A sin recoger heridos, o con heridos a bordo sin entregar
          // en C) eran 50-90 traces/frame de hasta 370 u, con traces
          // sueltos de hasta 50 ms en Node (misión 1). El enemigo solo
          // dispara dentro de su alcance; más allá de él persigue al
          // jugador, como ya hacen los aliados en defend().
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
          let target = state.P,
            nearest = Math.hypot(state.P.x - e.x, state.P.z - e.z);
          // La lista de soldados activos es la misma para todos los
          // enemigos de este frame: se construye una sola vez.
          for (let i = 0; i < soldiers.length; i++) {
            const ally = soldiers[i];
            if (
              ally.wounded &&
              ['INICIO_A', 'COMBATE_RUTA_AB', 'DESPEJAR_B'].includes(
                state.mission.stage,
              )
            )
              continue;
            const d = Math.hypot(ally.x - e.x, ally.z - e.z);
            const point = soldierPoints[i];
            if (
              d < nearest &&
              d <= rg &&
              !cover.trace({ x: e.x, y: e.y + 2, z: e.z }, point)
            ) {
              target = point;
              nearest = d;
            }
          }
          const dx = target.x - e.x,
            dz = target.z - e.z,
            d = Math.hypot(dx, dz),
            a = Math.atan2(dx, dz);
          const previousPosition = {
            x: e.x,
            y: e.y + (e.k === 'heli' ? 0 : 1.5),
            z: e.z,
          };
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
          const solidPosition = cover.move(
            previousPosition,
            { x: e.x, y: previousPosition.y, z: e.z },
            e.k === 'inf' ? 0.65 : 1.8,
            e.k === 'inf' ? 1.4 : 1.3,
          );
          e.x = solidPosition.x;
          e.z = solidPosition.z;
          if (e.k !== 'heli') e.y = groundAt(e.x, e.z);
          e.cd -= dt;
          if (
            rg &&
            d < rg &&
            e.cd <= 0 &&
            !cover.trace({ x: e.x, y: e.y + 2, z: e.z }, target)
          ) {
            e.cd = e.k === 'heli' ? 1.5 : e.k === 'inf' ? 2.8 : 2.4;
            // 55 u/s con vida 3,05 s: mismo alcance (~168 u) que 42 u/s y
            // 4 s, pero las balas enemigas ya no se arrastran por la pantalla.
            const s2 = 55,
              a2 = a + R(-0.06, 0.06);
            mk(
              state.EB,
              e.x,
              e.y + 2,
              e.z,
              Math.sin(a2) * s2,
              (target.y - (e.y + 2)) / Math.max(0.3, d / s2),
              Math.cos(a2) * s2,
              3.05,
              bulletKindFor(e.k),
            );
            // Fuego enemigo audible (vídeo M1: trazadoras Tan por
            // todo el valle): cañón grave para tanque/torreta,
            // crack fino para infantería, jeep y helicóptero Tan.
            if (e.k === 'tank' || e.k === 'tur') sfx.tankShot();
            else sfx.enemyShot();
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
        // Sin paso de escombros: los enemigos destruidos no dejan
        // restos y las marcas de aliado caído (state.DB) son estáticas.
        for (const o of state.FX) o.l -= dt;
        for (const o of state.SM) {
          o.l -= dt;
          o.x += (o.dx || 0) * dt;
          o.y += (o.dy || 0) * dt;
          o.z += (o.dz || 0) * dt;
        }
        state.E = state.E.filter((e) => !e.dead);
        state.BL = state.BL.filter((b) => b.l > 0);
        state.MS = state.MS.filter((o) => o.l > 0);
        state.EB = state.EB.filter((b) => b.l > 0);
        state.PK = state.PK.filter((q) => !q.d);
        state.FX = state.FX.filter((o) => o.l > 0);
        state.SM = state.SM.filter((o) => o.l > 0);
        const event = state.mission.update(dt, state.P, {
          enemies: state.E,
          cover,
          groundAt,
          fireAlly(origin, target) {
            const d = Math.hypot(target.x - origin.x, target.z - origin.z) || 1;
            const speed = state.mission.rules.bulletSpeed;
            mk(
              state.BL,
              origin.x,
              origin.y,
              origin.z,
              ((target.x - origin.x) / d) * speed,
              ((target.y - origin.y) / d) * speed,
              ((target.z - origin.z) / d) * speed,
              1.15,
              'soldier',
            );
          },
          moving: magnitude > 0.08,
          firing: !!(controls.fire || usedMissile),
          damaged: state.P.inv > 0,
        });
        for (const change of state.mission.drainEvents()) {
          if (change.type === 'boarded') {
            state.P.sc += 50;
            sfx.pick();
            buzz(20);
          }
          // Winch de la carga: levantar la caja (Misión 1) o la
          // batería (Misión 3) vale como un rescate.
          if (change.type === 'cargo-lifted') {
            state.P.sc += 50;
            sfx.winch();
            sfx.crateHook();
            buzz(20);
          }
          // Avisos en pantalla: en la grabación el pelotón llegaba
          // a C y el helicóptero volaba sobre el portal sin que
          // pasara nada visible. Cada llegada y cada cambio de fase
          // ahora se anuncia con un toast (ver src/ui.js).
          if (change.type === 'delivered') {
            sfx.pick();
            ui.showToast(
              'Herido entregado en C · A salvo ' +
                state.mission.delivered +
                '/' +
                state.mission.allies.length,
            );
          }
          if (change.type === 'arrived') {
            sfx.pick();
            ui.showToast(
              'Soldado en C · A salvo ' +
                state.mission.delivered +
                '/' +
                state.mission.allies.length,
            );
          }
          if (change.type === 'cargo-delivered') {
            sfx.portal();
            ui.showToast('¡Caja entregada por el portal!');
          }
          if (change.type === 'battery-dropped') {
            ui.showToast('Batería caída: levántala con el cable');
          }
          if (change.type === 'portal-without-cargo') {
            ui.showToast('El portal no abre sin la caja: levántala en B', 5000);
          }
          if (change.type === 'stage' && change.next === 'CARGA_PORTAL') {
            ui.showToast(
              'Pelotón a salvo · Falta la caja: llévala por el portal',
              5000,
            );
          }
          if (change.type === 'stage' && change.next === 'GARAJES') {
            ui.showToast('Pelotón a salvo · Quedan garajes por destruir', 5000);
          }
          // Coches de suministros (Misión 2): un garaje vivo suelta
          // un coche en su puerta; el coche recorre la ruta del
          // garaje (del vértice de incorporación al portal).
          if (change.type === 'spawn-car') {
            const car = spawnE('car', change.x, change.z);
            if (car) {
              car.id = 'car-' + change.garage + '-' + Math.round(state.t * 10);
              car.route = change.route.map((p) => [...p]);
              car.wp = 0;
              car.garage = change.garage;
            }
          }
          // Batería caída (Misión 3): el helicóptero Tan murió y la
          // batería quedó donde cayó; se acerca a un punto volable
          // para que el jugador pueda bajar con el winch.
          if (change.type === 'battery-dropped') {
            const spot = nearestFlyable(change.x, change.z);
            state.mission.placeBattery(spot.x, spot.z);
          }
          // Aliado caído: state.DB solo guarda estas dos cajitas
          // verdes, el cuerpo del aliado en el suelo (el renderizador
          // no dibuja a los CAIDO como soldados, así que sin esto la
          // baja sería invisible). No son escombros de enemigo: son
          // 2 piezas diminutas por baja, estáticas, y no bloquean el
          // paso ni las balas (miden menos de 1 u). Los enemigos
          // destruidos no dejan nada.
          if (change.type === 'soldier-fallen') {
            const a = state.mission.guards
              .concat(state.mission.allies)
              .find((a) => a.id === change.id);
            for (const offset of [-0.5, 0.5])
              state.DB.push({
                kind: 'box',
                x: a.x + offset,
                y: groundAt(a.x, a.z) + 0.2,
                z: a.z,
                sx: 0.3,
                sy: 0.2,
                sz: 0.65,
                color: [0.24, 0.65, 0.16],
                yaw: a.yaw || 0,
                settled: true,
                vx: 0,
                vy: 0,
                vz: 0,
              });
          }
        }
        if (event === 'failed') {
          setState('over');
          sfx.over();
        }
        if (event === 'complete') {
          sfx.fanfare();
          progress.record(state.mis, state.mission);
          state.P.sc += 250;
          // Puntuación en línea si hay cuenta y conexión; como invitado
          // o sin red queda en cola local para reintentarlo luego.
          online
            .saveScore({
              mission: state.mis,
              score: state.P.sc,
              stars: state.mission.stars || 1,
              survivors: state.mission.delivered || 0,
            })
            .catch(() => {});
          flushRemoteLogs().catch(() => {});
          setState(
            state.mis === ToyMissions.configs.length ? 'campaign' : 'win',
          );
        }
        updateHUD();
      }
      /* sprites */

      // Rounded molded parts: a solid team color with a narrow plastic highlight.

      // Shared household geometry (see src/toy-world.js).

      /* dibujo */

      Object.assign(state, {
        last: host.performance.now(),
        lastDraw: -Infinity,
        lastFrameN: null,
      });
      function loop(n) {
        const dt = Math.max(0, Math.min(0.05, (n - state.last) / 1e3));
        state.last = n;
        // Rendimiento real del frame (sin topar): alimenta el monitor
        // que degrada el detalle si el juego se atasca.
        if (state.lastFrameN !== null) {
          const frameMs = n - state.lastFrameN;
          perf.update(frameMs);
          logger.noteFrame(frameMs);
          state.pixelRatioCap = perf.pixelRatioCap;
          state.perfLevel = perf.level;
        }
        state.lastFrameN = n;
        if (!host.document.hidden) {
          // Con el panel de Misión abierto la simulación se congela
          // (el estado sigue en 'play', pero no se llama a upd): el
          // jugador lee tranquilo y al cerrar el panel se reanuda.
          if (state.st === 'play' && !env.missionPanelOpen) {
            state.rot += dt * 30;
            upd(dt);
          } else if (state.st === 'menu') {
            state.rot += dt * 30;
            cam.x = Math.sin(n / 12000) * 20;
            cam.z = Math.cos(n / 12000) * 20;
          }
          // Throttle drawing only: simulation/input keep the browser's frame cadence.
          // El degradado automático también limita el dibujo a 30 fps
          // (nivel 2), como el modo ahorro.
          const throttleMs = state.lowQuality
            ? 1000 / 30
            : perf.drawThrottleMs;
          if (
            state.needsDraw ||
            ((state.st === 'play' || state.st === 'menu') &&
              (!throttleMs || n - state.lastDraw >= throttleMs - 1))
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
        draw3d,
        projection,
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
    return {
      create,
      transitions,
      transition,
      updatePitch,
      cameraFraming,
      pilotMotion,
    };
  },
);
