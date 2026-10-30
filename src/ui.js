(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create(env) {
    function renderStatus(active) {
      env.needsDraw = true;
      env.$('renderMode').textContent = active
        ? '3D · Plástico'
        : '2D · 3D no disponible';
    }
    function menuLayout(page) {
      env.overlayPage = page;
      env.$('ov').scrollTop = 0;
      const main = page === 'main' || page === 'result';
      for (const [id, name] of [
        ['helpPane', 'help'],
        ['settingsPane', 'settings'],
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
        'Rescatados: ' + env.mission.rescued + '. Puntos: ' + env.P.sc + '.',
        next === 'campaign' ? 'Jugar de nuevo' : 'Siguiente misión',
      );
    }
    function showMain() {
      env.$('ti').innerHTML = 'ARMY MEN<span>Ataque aéreo</span>';
      env.$('tx').textContent =
        'Un pequeño helicóptero. Un gran rescate. Libera a tu escuadrón en una campaña de tres misiones.';
      env.$('go').textContent = 'Iniciar campaña →';
      menuLayout('main');
      env.$('go').focus?.();
    }
    function menuPage(page) {
      const titles = {
        help: 'Cómo jugar',
        settings: 'Ajustes',
        credits: 'Acerca del juego',
        confirm: '¿Abandonar campaña?',
      };
      const subtitles = {
        help: 'Tu guía de vuelo y rescate.',
        settings: 'Prepara el juego a tu manera.',
        credits: 'Una batalla pequeña en un mundo grande.',
        confirm: 'Esta acción reinicia tu progreso.',
      };
      env.$('ti').textContent = titles[page];
      env.$('tx').textContent = subtitles[page];
      menuLayout(page);
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
      for (const id of ['quality', 'menuQuality']) {
        env.$(id).textContent = env.lowQuality
          ? 'Gráficos: ahorro'
          : 'Gráficos: detalle';
        env.$(id).setAttribute('aria-pressed', String(env.lowQuality));
      }
    }
    function setText(id, value) {
      if (env.$(id).textContent !== value) env.$(id).textContent = value;
    }
    function updateHUD() {
      env.$('ai').style.width = env.P.arm * 10 + '%';
      setText(
        'inf',
        'Misión ' +
          env.mis +
          '/3 · Bases ' +
          env.bd +
          '/' +
          env.tb +
          ' · Rescate ' +
          env.mission.rescued +
          '/' +
          env.mission.allies.length,
      );
      setText('mi', 'Misil ' + env.P.mi);
      setText(
        'objective',
        env.mission.config.name + ' · ' + env.mission.message,
      );
      const target = env.mission.target(env.P),
        point = env.P3(target.x, env.groundAt(target.x, target.z), target.z),
        player = env.P3(env.P.x, env.groundAt(env.P.x, env.P.z), env.P.z);
      env.$('cmp').style.transform =
        'rotate(' +
        (Math.atan2(point[0] - player[0], player[1] - point[1]) * 180) /
          Math.PI +
        'deg)';
      setText('dg', 'Puntos: ' + env.P.sc);
    }
    function bind() {
      env.$('go').addEventListener('pointerdown', () => env.audio());
      env.$('pause').onclick = env.pauseGame;

      soundLabel();
      env.$('sound').onclick = () => {
        env.muted = !env.muted;
        env.savePreference('muted', String(env.muted));
        soundLabel();
        env.syncAudio();
      };

      qualityLabel();
      env.$('quality').onclick = () => {
        env.lowQuality = !env.lowQuality;
        env.savePreference('quality', env.lowQuality ? 'low' : 'detail');
        qualityLabel();
        env.rs();
      };

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
        env.start(nx ? env.mis + 1 : retry ? env.mis : 1, !nx);
      };
      env.$('menuHelp').onclick = () => menuPage('help');
      env.$('menuSettings').onclick = () => menuPage('settings');
      env.$('menuCredits').onclick = () => menuPage('credits');
      env.$('menuSound').onclick = () => env.$('sound').onclick();
      env.$('menuQuality').onclick = () => env.$('quality').onclick();
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
      bind,
    };
  }
  return { create };
});
