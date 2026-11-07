(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports
      ? require('./compass.js')
      : root.ToyCompass,
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Compass) {
  'use strict';
  function create(env) {
    // Sin etiqueta de modo de render en pantalla: el juego es
    // siempre WebGL 3D y, si WebGL no está disponible, el mensaje
    // #webglRequired lo dice (ver src/draw3d.js). Solo se marca que
    // hay que redibujar.
    function renderStatus(active) {
      env.needsDraw = true;
    }
    function menuLayout(page) {
      env.overlayPage = page;
      // Si el panel de Misión estaba abierto, se cierra al mostrar
      // un menú: el juego queda en el estado de ese menú, no a
      // medias entre el panel y la pausa.
      env.missionPanelOpen = false;
      env.$('missionPanel').style.display = 'none';
      env.$('missionBtn').setAttribute('aria-pressed', 'false');
      env.$('ov').scrollTop = 0;
      const main = page === 'main' || page === 'result';
      for (const [id, name] of [
        ['helpPane', 'help'],
        ['settingsPane', 'settings'],
        ['accountPane', 'account'],
        ['logsPane', 'logs'],
        ['creditsPane', 'credits'],
        ['confirmPane', 'confirm'],
      ])
        env.$(id).style.display = page === name ? 'block' : 'none';
      env.$('go').style.display = main ? 'block' : 'none';
      env.$('menuNav').style.display = main ? 'grid' : 'none';
      env.$('back').style.display = main ? 'none' : 'block';
      env.$('menuExit').style.display = page === 'result' ? 'block' : 'none';
      env.$('ov').style.display = 'flex';
      env.$('hud').style.display = 'none';
      env.cv.tabIndex = -1;
      env.needsDraw = true;
    }
    function show(ti, tx, bt) {
      env.$('ti').textContent = ti;
      env.$('tx').textContent = tx;
      env.$('go').textContent = bt;
      menuLayout('result');
      env.$('go').focus?.();
    }
    function presentState(next) {
      if (next === 'play') {
        env.$('ov').style.display = 'none';
        env.$('hud').style.display = 'block';
        env.cv.tabIndex = 0;
        env.cv.focus?.();
        return;
      }
      if (next === 'menu') {
        showMain();
        return;
      }
      if (next === 'paused') {
        show(
          'Partida en pausa',
          'Tu misión continuará desde el mismo punto.',
          'Continuar',
        );
        return;
      }
      if (next === 'over') {
        show(
          'Misión fallida',
          (env.mission.reason ? env.mission.reason + '. ' : '') +
            'Reintenta ' +
            env.mission.config.name +
            '. Los rescates de esta misión se reinician.',
          'Reintentar misión',
        );
        return;
      }
      show(
        next === 'campaign'
          ? 'Campaña completada'
          : 'Misión ' + env.mis + ' cumplida',
        '★'.repeat(env.mission.stars || 1) +
          ' · A salvo: ' +
          env.mission.delivered +
          '/' +
          env.mission.allies.length +
          '. Puntos: ' +
          env.P.sc +
          '.',
        next === 'campaign' ? 'Jugar de nuevo' : 'Siguiente misión',
      );
    }
    function showMain() {
      env.$('ti').innerHTML = 'ARMY MEN<span>Ataque aéreo</span>';
      env.$('tx').textContent =
        'Sal de A, despeja B y escolta al pelotón hasta C. ' +
        Object.entries(env.savedProgress?.missions || {})
          .map(([n, r]) => 'Misión ' + n + ': ' + '★'.repeat(r.stars))
          .join(' · ');
      env.$('go').textContent = 'Iniciar campaña →';
      menuLayout('main');
      env.$('go').focus?.();
    }
    function menuPage(page) {
      const titles = {
        help: 'Cómo jugar',
        settings: 'Ajustes',
        account: 'Cuenta',
        logs: 'Registro de errores',
        credits: 'Acerca del juego',
        confirm: '¿Abandonar campaña?',
      };
      const subtitles = {
        help: 'Tu guía de vuelo y rescate.',
        settings: 'Prepara el juego a tu manera.',
        account: 'Guarda tus puntuaciones en línea con Supabase.',
        logs: 'Errores guardados en este dispositivo.',
        credits: 'Una batalla pequeña en un mundo grande.',
        confirm: 'Esta acción reinicia tu progreso.',
      };
      env.$('ti').textContent = titles[page];
      env.$('tx').textContent = subtitles[page];
      menuLayout(page);
      if (page === 'account') refreshAccount();
      if (page === 'logs') refreshLogs();
      env.$(page === 'settings' ? 'menuSound' : 'ti').focus?.();
    }
    function menuBack() {
      presentState(env.st);
    }
    function soundLabel() {
      for (const id of ['sound', 'menuSound']) {
        env.$(id).textContent = env.muted ? 'Activar sonido' : 'Silenciar';
        env.$(id).setAttribute('aria-pressed', String(env.muted));
      }
    }
    function qualityLabel() {
      // La calidad solo se cambia desde el menú de ajustes: en el
      // HUD ya no hay botón ni etiqueta de gráficos.
      env.$('menuQuality').textContent = env.lowQuality
        ? 'Calidad: ahorro'
        : 'Calidad: completa';
      env.$('menuQuality').setAttribute('aria-pressed', String(env.lowQuality));
    }
    // Panel de Misión: los detalles que antes se veían en las dos
    // barras de arriba (#inf y #objective, ahora ocultas) viven
    // aquí, con los ganchos genéricos de la misión (nombre, mensaje
    // y resumen), sin nada hardcodeado por misión. Al abrirlo el
    // juego se congela (ver el bucle en src/game.js, que no llama a
    // upd con el panel abierto) y al cerrarlo se reanuda: en el
    // iPhone nadie te mata mientras lees.
    function refreshMissionPanel() {
      const m = env.mission;
      if (!m || !env.P) return;
      env.$('missionTitle').textContent =
        'Misión ' + env.mis + '/3 · ' + m.config.name;
      env.$('missionObjective').textContent = m.message;
      env.$('missionSummary').textContent = m.hudSummary
        ? m.hudSummary()
        : '';
      env.$('missionPoints').textContent = 'Puntos: ' + env.P.sc;
    }
    function openMissionPanel() {
      if (!env.mission || !env.P || env.st !== 'play') return;
      env.missionPanelOpen = true;
      refreshMissionPanel();
      env.$('missionPanel').style.display = 'block';
      env.$('missionBtn').setAttribute('aria-pressed', 'true');
      env.clearInput();
      env.humOff();
      env.needsDraw = true;
    }
    function closeMissionPanel() {
      if (!env.missionPanelOpen) return;
      env.missionPanelOpen = false;
      env.$('missionPanel').style.display = 'none';
      env.$('missionBtn').setAttribute('aria-pressed', 'false');
      env.syncAudio();
      env.needsDraw = true;
    }
    function setText(id, value) {
      if (env.$(id).textContent !== value) env.$(id).textContent = value;
    }
    function updateHUD() {
      env.$('ai').style.width = env.P.arm * 10 + '%';
      // Resumen de estado genérico: lo da la misión (hoy, heridos y
      // entregas del rescate A → B → C; las misiones con objetivos
      // nuevos lo redefinen con sus contadores). Sin él, el texto
      // clásico de rescate.
      setText(
        'inf',
        env.mission.hudSummary
          ? env.mission.hudSummary()
          : 'Misión ' +
              env.mis +
              '/3 · Heridos ' +
              env.mission.rescued +
              '/' +
              env.mission.allies.filter((a) => a.wounded).length +
              ' · A salvo ' +
              env.mission.delivered +
              '/' +
              env.mission.allies.length +
              ' · Bajas ' +
              env.mission.allies.filter((a) => a.state === 'CAIDO').length,
      );
      setText('mi', 'Misil ' + env.P.mi);
      // Contador de munición como el original: número grande abajo a
      // la izquierda (misiles, el arma secundaria; la ametralladora
      // no gasta munición). En vacío, el número se pone rojo.
      setText('ammoNum', String(env.P.mi));
      env.$('ammoNum').style.color = env.P.mi <= 0 ? '#ff6b5e' : '';
      setText(
        'objective',
        env.mission.config.name + ' · ' + env.mission.message,
      );
      // Brújula del original (ver src/compass.js): tira de 8 puntos
      // que se desplaza con el rumbo, rumbo actual resaltado en el
      // centro y marca morada hacia el objetivo. El objetivo viene
      // de mission.target(jugador), no está hardcodeado: cuando las
      // misiones cambien de objetivo, la marca seguirá al vigente.
      if (Compass) {
        const target = env.mission.target(env.P),
          strip = Compass.strip(
            Compass.headingDeg(env.P.yaw),
            Compass.bearingDeg(env.P.x, env.P.z, target.x, target.z),
          );
        strip.labels.forEach((label, i) => {
          const el = env.$('cl' + i);
          el.style.display = label.visible ? 'block' : 'none';
          el.style.left = label.at + '%';
          el.style.color = label.current ? '#ffd94d' : '';
          setText('cl' + i, label.label);
        });
        const marker = env.$('compassTarget');
        marker.style.display = strip.target.visible ? 'block' : 'none';
        marker.style.left = (strip.target.at || 50) + '%';
      }
      setText('dg', 'Puntos: ' + env.P.sc);
      // El panel de Misión, si está abierto, se actualiza con el
      // mismo resumen (la simulación está congelada, pero el texto
      // queda al día si algo cambió al abrirlo).
      if (env.missionPanelOpen) refreshMissionPanel();
      // Lectura de rendimiento opcional (?perf=1): FPS, ms por frame,
      // peor frame y nivel de degradado, para diagnosticar en el iPhone.
      // Con ?logs=1 se añade además el contador del registro de errores.
      const logNote =
        env.logsVisible && env.logger
          ? ' · registro ' + env.logger.count
          : '';
      if (env.logsVisible && !env.perfVisible && env.logger) {
        env.$('perf').style.display = 'block';
        setText('perf', 'Registro: ' + env.logger.count + ' entradas');
      }
      if (env.perfVisible && env.perf) {
        if (env.t - (env._perfAt || 0) >= 0.5) {
          env._perfAt = env.t;
          env.$('perf').style.display = 'block';
          setText(
            'perf',
            'FPS ' +
              Math.round(1000 / Math.max(1, env.perf.ema)) +
              ' · ' +
              env.perf.ema.toFixed(1) +
              ' ms · peor ' +
              env.perf.worst.toFixed(0) +
              ' ms · nivel ' +
              env.perf.level +
              (env.perf.level > 0 ? ' (ahorro automático)' : '') +
              ' · ' +
              (env.mission?.stage || '') +
              // El nombre del mapa fijo y su semilla, para saber en
              // qué mapa exacto ocurre algo al reportarlo.
              (env.state?.mapName ? ' · ' + env.state.mapName : '') +
              (env.state?.mapSeed !== undefined
                ? ' · semilla ' + env.state.mapSeed
                : '') +
              logNote,
          );
        }
      }
    }
    // Cuenta de Supabase (opcional): sin configuración el juego sigue
    // como invitado y las puntuaciones quedan solo en este dispositivo.
    async function refreshScores() {
      const list = env.$('scoresList');
      try {
        if (!env.online || !env.online.configured()) {
          list.textContent =
            'Sin conexión con el servidor: aquí aparecerán tus mejores puntuaciones y el ranking cuando actives Supabase.';
          return;
        }
        const top = await env.online.fetchTopScores(null, 5);
        const mine = await env.online.fetchMyScores(5);
        const lines = [];
        if (top.ok && top.rows.length)
          lines.push(
            'Ranking: ' +
              top.rows
                .map(
                  (r, i) =>
                    i +
                    1 +
                    '. ' +
                    (r.display_name || 'Piloto') +
                    ' · ' +
                    r.score +
                    ' pts · M' +
                    (r.mission || '?'),
                )
                .join(' · '),
          );
        if (mine.ok && mine.rows.length)
          lines.push(
            'Tuyas: ' +
              mine.rows
                .map((r) => 'M' + r.mission + ' · ' + r.score + ' pts')
                .join(' · '),
          );
        list.textContent = lines.length
          ? lines.join('\n')
          : 'Aún no hay puntuaciones en línea.';
      } catch (_) {
        list.textContent = 'No se pudieron cargar las puntuaciones.';
      }
    }
    async function refreshAccount() {
      const status = env.$('accountStatus');
      try {
        if (!env.online || !env.online.configured()) {
          status.textContent =
            'Supabase sin configurar: juegas como invitado y tus mejores resultados se guardan solo en este dispositivo. Ver docs/SUPABASE.md para activarlo.';
          env.$('accountSignOut').style.display = 'none';
          await refreshScores();
          return;
        }
        const user = env.online.getUser();
        if (user) {
          status.textContent =
            'Sesión iniciada como ' + (user.email || user.id) + '.';
          env.$('accountSignOut').style.display = 'block';
          try {
            await env.flushRemoteLogs();
          } catch (_) {}
          try {
            await env.online.flushPendingScores();
          } catch (_) {}
        } else {
          status.textContent =
            'Sin sesión: inicia sesión o crea una cuenta para guardar tus puntuaciones en línea.';
          env.$('accountSignOut').style.display = 'none';
        }
        await refreshScores();
      } catch (_) {
        status.textContent =
          'No se pudo conectar con Supabase: juegas como invitado.';
      }
    }
    function refreshLogs() {
      const entries = env.logger ? env.logger.list() : [];
      env.$('logsText').textContent = entries.length
        ? entries
            .slice(-20)
            .map(
              (e) =>
                e.ts +
                ' [' +
                e.type +
                '] ' +
                e.message +
                (e.mission ? ' (M' + e.mission + ' ' + e.phase + ')' : ''),
            )
            .join('\n')
        : 'Sin entradas todavía.';
    }
    function bind() {
      env.$('go').addEventListener('pointerdown', () => env.audio());
      env.$('pause').onclick = env.pauseGame;
      // El panel arranca oculto (en el HTML ya lleva display:none;
      // esto lo deja igual en el DOM que construyen las pruebas).
      env.$('missionPanel').style.display = 'none';

      soundLabel();
      env.$('sound').onclick = () => {
        env.muted = !env.muted;
        env.savePreference('muted', String(env.muted));
        soundLabel();
        env.syncAudio();
      };

      qualityLabel();
      // Botón Misión: abre el panel de detalles (y congela el
      // juego) o lo cierra (y reanuda). El botón Cerrar del panel
      // hace lo mismo.
      env.$('missionBtn').onclick = () => {
        if (env.missionPanelOpen) closeMissionPanel();
        else openMissionPanel();
      };
      env.$('missionClose').onclick = closeMissionPanel;

      env.$('go').onclick = () => {
        if (env.overlayPage !== 'main' && env.overlayPage !== 'result') return;
        if (env.st === 'paused') {
          env.resumeGame();
          return;
        }
        env.audio();
        env.buzz(20);
        env.tone(300, 700, 0.25, 'triangle', 0.25);
        const nx = env.st === 'win',
          retry = env.st === 'over';
        if (nx) env.checkpoint = env.P.sc;
        else if (!retry) env.checkpoint = 0;
        env.start(nx ? env.mis + 1 : retry ? env.mis : 1, !nx, retry);
      };
      env.$('menuHelp').onclick = () => menuPage('help');
      env.$('menuSettings').onclick = () => menuPage('settings');
      env.$('menuAccount').onclick = () => menuPage('account');
      env.$('menuLogs').onclick = () => menuPage('logs');
      env.$('menuCredits').onclick = () => menuPage('credits');
      env.$('accountSignIn').onclick = async () => {
        const status = env.$('accountStatus');
        const email = env.$('accountEmail').value.trim();
        const password = env.$('accountPassword').value;
        if (!email || !password) {
          status.textContent = 'Escribe tu correo y tu contraseña.';
          return;
        }
        status.textContent = 'Iniciando sesión…';
        const result = await env.online.signIn(email, password);
        if (result.ok) {
          env.$('accountPassword').value = '';
          await refreshAccount();
        } else
          status.textContent =
            'No se pudo iniciar sesión: ' + (result.error || result.reason);
      };
      env.$('accountSignUp').onclick = async () => {
        const status = env.$('accountStatus');
        const email = env.$('accountEmail').value.trim();
        const password = env.$('accountPassword').value;
        if (!email || !password) {
          status.textContent = 'Escribe tu correo y tu contraseña.';
          return;
        }
        status.textContent = 'Creando tu cuenta…';
        const result = await env.online.signUp(
          email,
          env.$('accountName').value.trim(),
          password,
        );
        if (result.ok && result.needsConfirmation)
          status.textContent =
            'Cuenta creada: revisa tu correo para confirmarla y luego inicia sesión.';
        else if (result.ok) {
          env.$('accountPassword').value = '';
          await refreshAccount();
        } else
          status.textContent =
            'No se pudo crear la cuenta: ' + (result.error || result.reason);
      };
      env.$('accountSignOut').onclick = async () => {
        await env.online.signOut();
        await refreshAccount();
      };
      env.$('logsExport').onclick = () => {
        const text = env.logger ? env.logger.exportText() : '[]';
        try {
          const doc = env.host && env.host.document;
          const blob = new Blob([text], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = doc.createElement('a');
          a.href = url;
          a.download = 'army-men-logs.json';
          (doc.body || doc).appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (_) {
          env.$('logsText').textContent = text;
        }
      };
      env.$('logsClear').onclick = () => {
        if (env.logger) env.logger.clear();
        refreshLogs();
      };
      env.$('menuSound').onclick = () => env.$('sound').onclick();
      // La calidad solo se cambia desde Ajustes (ya no hay botón en
      // el HUD): el degradado automático sigue funcionando solo.
      env.$('menuQuality').onclick = () => {
        env.lowQuality = !env.lowQuality;
        env.savePreference('quality', env.lowQuality ? 'low' : 'detail');
        qualityLabel();
        env.rs();
      };
      env.$('back').onclick = menuBack;
      env.$('menuExit').onclick = () =>
        env.st === 'campaign' ? env.mainMenu() : menuPage('confirm');
      env.$('confirmExit').onclick = () => {
        if (env.overlayPage === 'confirm') env.mainMenu();
      };
      env.cv.tabIndex = -1;
    }
    return {
      renderStatus,
      menuLayout,
      show,
      showMain,
      presentState,
      menuPage,
      menuBack,
      soundLabel,
      qualityLabel,
      setText,
      updateHUD,
      openMissionPanel,
      closeMissionPanel,
      refreshMissionPanel,
      bind,
    };
  }
  return { create };
});
