(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyInput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create(env) {
    const keys = {};
    let fire = false,
      mAsk = false,
      drag = null,
      firePointer = null;
    function clearInput() {
      for (const key in keys) delete keys[key];
      fire = false;
      mAsk = false;
      drag = null;
      firePointer = null;
      env.$('stick').style.display = 'none';
    }
    function updateStick() {
      if (!drag) return;
      const r = env.cv.getBoundingClientRect(),
        dx = drag.x - drag.sx,
        dy = drag.y - drag.sy,
        k = 40 / Math.max(70, Math.hypot(dx, dy));
      env.$('stick').style.display = 'block';
      env.$('stick').style.left = drag.sx - (r.left || 0) + 'px';
      env.$('stick').style.top = drag.sy - (r.top || 0) + 'px';
      env.$('knob').style.transform =
        'translate(' + dx * k + 'px,' + dy * k + 'px)';
    }
    function read() {
      let sx = 0,
        sy = 0;
      if (drag) {
        sx = env.clamp((drag.x - drag.sx) / 70, -1, 1);
        sy = env.clamp(-(drag.y - drag.sy) / 70, -1, 1);
      }
      if (keys.arrowleft || keys.a) sx = -1;
      if (keys.arrowright || keys.d) sx = 1;
      if (keys.arrowup || keys.w) sy = 1;
      if (keys.arrowdown || keys.s) sy = -1;
      return { sx, sy, fire: !!(fire || keys[' ']), missile: mAsk };
    }
    function bind() {
      env.host.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (
          env.st === 'play' &&
          [' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)
        )
          e.preventDefault();
        if (k === 'escape' && !e.repeat) {
          e.preventDefault();
          if (env.st === 'play') env.pauseGame();
          else if (env.overlayPage !== 'main' && env.overlayPage !== 'result')
            env.menuBack();
          else if (env.st === 'paused') env.resumeGame();
          return;
        }
        if (k === 'p' && !e.repeat) {
          if (env.st === 'play') env.pauseGame();
          else if (env.st === 'paused' && env.overlayPage === 'result')
            env.resumeGame();
          return;
        }
        if (env.st !== 'play') return;
        keys[k] = 1;
        if ((k === 'm' || k === 'shift') && !e.repeat) mAsk = true;
      });
      env.host.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = 0;
      });
      env.host.addEventListener('contextmenu', (e) => e.preventDefault());
      env.cv.addEventListener('pointerdown', (e) => {
        env.audio();
        if (env.st !== 'play' || drag) return;
        env.humOn();
        drag = {
          id: e.pointerId,
          sx: e.clientX,
          sy: e.clientY,
          x: e.clientX,
          y: e.clientY,
        };
        env.cv.setPointerCapture(e.pointerId);
        updateStick();
      });
      env.cv.addEventListener('pointermove', (e) => {
        if (drag && drag.id === e.pointerId) {
          drag.x = e.clientX;
          drag.y = e.clientY;
          updateStick();
        }
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        env.cv.addEventListener(event, (e) => {
          if (drag && drag.id === e.pointerId) {
            drag = null;
            env.$('stick').style.display = 'none';
          }
        });

      env.host.addEventListener('resize', () => {
        clearInput();
        env.needsDraw = true;
      });
      const fu = env.$('fu'),
        mi = env.$('mi');
      fu.addEventListener('pointerdown', (e) => {
        if (env.st !== 'play' || firePointer !== null) return;
        env.audio();
        firePointer = e.pointerId;
        fire = true;
        fu.setPointerCapture(e.pointerId);
      });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
        fu.addEventListener(ev, (e) => {
          if (e.pointerId === firePointer) {
            fire = false;
            firePointer = null;
          }
        });
      mi.addEventListener('pointerdown', () => {
        if (env.st !== 'play') return;
        env.audio();
        mAsk = true;
      });
    }
    return {
      read,
      clear: clearInput,
      clearInput,
      updateStick,
      bind,
      consumeMissile() {
        mAsk = false;
      },
      values: {
        get keys() {
          return keys;
        },
        get fire() {
          return fire;
        },
        set fire(v) {
          fire = v;
        },
        get mAsk() {
          return mAsk;
        },
        set mAsk(v) {
          mAsk = v;
        },
        get drag() {
          return drag;
        },
        set drag(v) {
          drag = v;
        },
        get firePointer() {
          return firePointer;
        },
        set firePointer(v) {
          firePointer = v;
        },
      },
    };
  }
  return { create };
});
