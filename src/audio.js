(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToyAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create(env) {
    const { isPlaying, isMuted } = env;
    let AC = null,
      hum = null,
      sil = null;
    const noiseCache = new Map();
    function silentSrc() {
      const n = 4000,
        b = new Uint8Array(44 + n),
        v = new DataView(b.buffer),
        w = (o, s) => {
          for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i);
        };
      w(0, 'RIFF');
      v.setUint32(4, 36 + n, true);
      w(8, 'WAVEfmt ');
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true);
      v.setUint32(28, 8000, true);
      v.setUint16(32, 1, true);
      v.setUint16(34, 8, true);
      w(36, 'data');
      v.setUint32(40, n, true);
      b.fill(128, 44);
      let s = '';
      for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      return 'data:audio/wav;base64,' + env.host.btoa(s);
    }
    function audio() {
      if (isMuted()) return;
      try {
        if (env.host.navigator.audioSession)
          env.host.navigator.audioSession.type = 'playback';
      } catch (e) {}
      if (!AC) {
        try {
          AC = new (
            env.host.window.AudioContext || env.host.window.webkitAudioContext
          )();
          const s = AC.createBufferSource();
          s.buffer = AC.createBuffer(1, 1, 22050);
          s.connect(AC.destination);
          s.start(0);
        } catch (e) {}
      }
      if (AC && AC.state !== 'running') {
        try {
          AC.resume().catch(() => {});
        } catch (e) {}
      }
      if (sil && sil.paused) sil.play().catch(() => {});
      if (!sil) {
        try {
          sil = new env.host.Audio(silentSrc());
          sil.loop = true;
          const p = sil.play();
          if (p) p.catch(() => {});
        } catch (e) {}
      }
    }
    function tone(f, f2, d, type, v) {
      if (!AC || isMuted() || env.host.document.hidden || !isPlaying()) return;
      const o = AC.createOscillator(),
        g = AC.createGain(),
        n = AC.currentTime;
      o.type = type;
      o.frequency.setValueAtTime(f, n);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), n + d);
      g.gain.setValueAtTime(v, n);
      g.gain.exponentialRampToValueAtTime(0.001, n + d);
      o.connect(g);
      g.connect(AC.destination);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
      o.start(n);
      o.stop(n + d);
    }
    function noise(d, v, fc) {
      if (!AC || isMuted() || env.host.document.hidden || !isPlaying()) return;
      const n = AC.currentTime,
        len = Math.floor(AC.sampleRate * d);
      let buf = noiseCache.get(len);
      if (!buf) {
        buf = AC.createBuffer(1, len, AC.sampleRate);
        const a = buf.getChannelData(0);
        for (let i = 0; i < len; i++) a[i] = Math.random() * 2 - 1;
        noiseCache.set(len, buf);
      }
      const s = AC.createBufferSource(),
        fl = AC.createBiquadFilter(),
        g = AC.createGain();
      s.buffer = buf;
      fl.type = 'lowpass';
      fl.frequency.value = fc;
      g.gain.setValueAtTime(v, n);
      g.gain.exponentialRampToValueAtTime(0.001, n + d);
      s.connect(fl);
      fl.connect(g);
      g.connect(AC.destination);
      s.onended = () => {
        s.disconnect();
        fl.disconnect();
        g.disconnect();
      };
      s.start(n);
    }
    function buzz(p) {
      if (env.host.navigator.vibrate) {
        try {
          env.host.navigator.vibrate(p);
        } catch (e) {}
      }
    }
    const sfx = {
      shot() {
        tone(900, 500, 0.07, 'square', 0.06);
      },
      boom() {
        noise(0.45, 0.7, 1500);
        tone(180, 50, 0.35, 'sawtooth', 0.25);
      },
      hurt() {
        tone(300, 90, 0.3, 'square', 0.25);
        noise(0.25, 0.5, 1500);
      },
      pick() {
        tone(520, 520, 0.08, 'triangle', 0.25);
        env.host.setTimeout(() => tone(780, 780, 0.12, 'triangle', 0.25), 80);
      },
      miss() {
        noise(0.5, 0.4, 2500);
        tone(200, 700, 0.4, 'sawtooth', 0.15);
      },
      over() {
        tone(400, 80, 0.9, 'sawtooth', 0.25);
      },
    };
    function humOn() {
      if (!AC || hum || isMuted()) return;
      const o = AC.createOscillator(),
        l = AC.createOscillator(),
        lg = AC.createGain(),
        g = AC.createGain(),
        f = AC.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.value = 110;
      f.type = 'lowpass';
      f.frequency.value = 700;
      g.gain.value = 0.08;
      l.frequency.value = 13;
      lg.gain.value = 0.06;
      l.connect(lg);
      lg.connect(g.gain);
      o.connect(f);
      f.connect(g);
      g.connect(AC.destination);
      o.start();
      l.start();
      hum = { o, l, lg, g, f };
    }
    function humOff() {
      if (!hum) return;
      try {
        hum.o.stop();
        hum.l.stop();
      } catch (e) {}
      for (const node of Object.values(hum)) node.disconnect();
      hum = null;
    }
    return {
      silentSrc,
      audio,
      tone,
      noise,
      buzz,
      sfx,
      humOn,
      humOff,
      get AC() {
        return AC;
      },
      set AC(v) {
        AC = v;
      },
      get hum() {
        return hum;
      },
      set hum(v) {
        hum = v;
      },
      get sil() {
        return sil;
      },
      set sil(v) {
        sil = v;
      },
    };
  }
  return { create };
});
