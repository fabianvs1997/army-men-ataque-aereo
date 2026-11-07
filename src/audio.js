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
        // Ametralladora con pegada: chasquido seco de ruido + crack
        // agudo + cuerpo grave. Tres capas cortas, sin cola larga, para
        // que las ráfagas (un disparo cada 0,09 s) no se embarren.
        noise(0.07, 0.3, 2800);
        tone(1400, 350, 0.06, 'square', 0.1);
        tone(160, 60, 0.09, 'triangle', 0.15);
      },
      snap(broken) {
        noise(broken ? 0.14 : 0.045, broken ? 0.24 : 0.09, 3200);
        tone(broken ? 420 : 1100, 180, broken ? 0.1 : 0.035, 'triangle', 0.07);
      },
      boom() {
        noise(0.5, 0.8, 1200);
        tone(160, 40, 0.4, 'sawtooth', 0.3);
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
        // Lanzamiento de misil: silbido de aire + subida de tono + golpe
        // grave de ignición, distinto del disparo de ametralladora.
        noise(0.5, 0.35, 1800);
        tone(300, 900, 0.5, 'sawtooth', 0.1);
        tone(120, 45, 0.5, 'sine', 0.15);
      },
      over() {
        tone(400, 80, 0.9, 'sawtooth', 0.25);
      },
    };
    // Rotor del helicóptero: dos sierras graves (55 y 110 Hz) con el
    // "chop" de las palas —un LFO de ~11 Hz modulando la ganancia, el
    // mismo pulso grave que domina el audio del video de referencia— y
    // un soplo de viento (ruido en bucle). rotorSet() sube el chop y el
    // volumen con la velocidad, sin recrear los nodos.
    function humOn() {
      if (!AC || hum || isMuted()) return;
      const o = AC.createOscillator(),
        o2 = AC.createOscillator(),
        l = AC.createOscillator(),
        lg = AC.createGain(),
        g = AC.createGain(),
        f = AC.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.value = 55;
      o2.type = 'sawtooth';
      o2.frequency.value = 110;
      f.type = 'lowpass';
      f.frequency.value = 420;
      g.gain.value = 0.07;
      l.type = 'sine';
      l.frequency.value = 11;
      lg.gain.value = 0.045;
      l.connect(lg);
      lg.connect(g.gain);
      o.connect(f);
      o2.connect(f);
      f.connect(g);
      g.connect(AC.destination);
      const len = AC.sampleRate * 2;
      let wbuf = noiseCache.get(len);
      if (!wbuf) {
        wbuf = AC.createBuffer(1, len, AC.sampleRate);
        const a = wbuf.getChannelData(0);
        for (let i = 0; i < len; i++) a[i] = Math.random() * 2 - 1;
        noiseCache.set(len, wbuf);
      }
      const w = AC.createBufferSource(),
        wf = AC.createBiquadFilter(),
        wg = AC.createGain();
      w.buffer = wbuf;
      w.loop = true;
      wf.type = 'bandpass';
      wf.frequency.value = 300;
      wg.gain.value = 0.02;
      w.connect(wf);
      wf.connect(wg);
      wg.connect(AC.destination);
      try {
        o.start();
        o2.start();
        l.start();
        w.start();
      } catch (e) {}
      hum = { o, o2, l, lg, g, f, w, wf, wg };
    }
    function rotorSet(throttle, alt) {
      if (!hum) return;
      const t = Math.max(0, Math.min(1, throttle || 0)),
        a = Math.max(0, Math.min(1, alt || 0));
      try {
        hum.l.frequency.value = 11 + 4 * t;
        hum.g.gain.value = 0.06 + 0.05 * t;
        hum.f.frequency.value = 380 + 150 * t + 300 * a;
      } catch (e) {}
    }
    function humOff() {
      if (!hum) return;
      // Solo se paran las fuentes (osciladores y ruido en bucle); las
      // ganancias y los filtros solo se desconectan.
      for (const key of ['o', 'o2', 'l', 'w']) {
        const node = hum[key];
        if (!node) continue;
        try {
          if (typeof node.stop === 'function') node.stop();
        } catch (e) {}
      }
      for (const node of Object.values(hum)) {
        try {
          node.disconnect();
        } catch (e) {}
      }
      hum = null;
    }
    // Música de fondo épica de guerra, 100% original y sintetizada con
    // Web Audio (nada del video de referencia, que es material con
    // derechos): marcha marcial en re menor a 92 BPM, 8 compases en
    // bucle (Dm – Dm – Bb – Bb – F – F – C – C), con tambor grave en
    // los tiempos 1 y 3, redoble en 2 y 4, bordón grave, acordes de
    // metal y una llamada de trompa en los últimos compases. El bucle
    // es exacto por compases, sin huecos ni cortes audibles.
    const MUSIC_BPM = 92,
      MUSIC_BARS = 8,
      MUSIC_BEATS = 4,
      MUSIC_BAR = (MUSIC_BEATS * 60) / MUSIC_BPM,
      MUSIC_LOOP = MUSIC_BARS * MUSIC_BAR;
    // Raíz y acorde (tónica, tercera, quinta) por compás, en Hz.
    const MUSIC_CHORDS = [
      { root: 73.42, notes: [146.83, 174.61, 220.0] }, // Dm
      { root: 73.42, notes: [146.83, 174.61, 220.0] },
      { root: 58.27, notes: [116.54, 146.83, 174.61] }, // Bb
      { root: 58.27, notes: [116.54, 146.83, 174.61] },
      { root: 87.31, notes: [174.61, 220.0, 261.63] }, // F
      { root: 87.31, notes: [174.61, 220.0, 261.63] },
      { root: 65.41, notes: [130.81, 164.81, 196.0] }, // C
      { root: 65.41, notes: [130.81, 164.81, 196.0] },
    ];
    // Llamada de trompa, compases 5-8: [compás, tiempo, nota, duración].
    const MUSIC_HORN = [
      [4, 0, 440.0, 0.65],
      [4, 2, 523.25, 0.65],
      [5, 0, 587.33, 1.3],
      [6, 0, 523.25, 0.65],
      [6, 2, 440.0, 0.65],
      [7, 0, 349.23, 2.6],
    ];
    // Partitura pura y determinista: todos los eventos del bucle, con
    // su instante en segundos desde el inicio del bucle.
    function musicScore() {
      const beat = 60 / MUSIC_BPM,
        events = [];
      for (let bar = 0; bar < MUSIC_BARS; bar++) {
        const t0 = bar * MUSIC_BAR,
          chord = MUSIC_CHORDS[bar];
        for (const b of [0, 2])
          events.push({ at: t0 + b * beat, dur: 0.28, kind: 'drum', vol: 0.5 });
        for (const b of [1, 3])
          events.push({ at: t0 + b * beat, dur: 0.12, kind: 'snare', vol: 0.12 });
        events.push({
          at: t0,
          dur: MUSIC_BAR,
          kind: 'drone',
          freqs: [chord.root, chord.root * 1.5],
          vol: 0.1,
        });
        for (const b of [0, 2])
          for (const f of chord.notes)
            events.push({
              at: t0 + b * beat,
              dur: beat * 1.8,
              kind: 'brass',
              freq: f,
              vol: 0.08,
            });
      }
      for (const [bar, beatN, freq, dur] of MUSIC_HORN)
        events.push({
          at: bar * MUSIC_BAR + beatN * beat,
          dur,
          kind: 'horn',
          freq,
          vol: 0.12,
        });
      return events.sort((a, b) => a.at - b.at);
    }
    let music = null;
    function musicNote(at, ev) {
      if (!music) return;
      if (ev.kind === 'drum') {
        const o = AC.createOscillator(),
          g = AC.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(130, at);
        o.frequency.exponentialRampToValueAtTime(42, at + 0.18);
        g.gain.setValueAtTime(ev.vol, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + ev.dur);
        o.connect(g);
        g.connect(music.bus);
        o.start(at);
        o.stop(at + ev.dur + 0.05);
        o.onended = () => {
          o.disconnect();
          g.disconnect();
        };
        return;
      }
      if (ev.kind === 'snare') {
        const len = Math.floor(AC.sampleRate * ev.dur);
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
        fl.type = 'bandpass';
        fl.frequency.value = 1800;
        g.gain.setValueAtTime(ev.vol, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + ev.dur);
        s.connect(fl);
        fl.connect(g);
        g.connect(music.bus);
        s.start(at);
        s.onended = () => {
          s.disconnect();
          fl.disconnect();
          g.disconnect();
        };
        return;
      }
      const freqs = ev.freqs || [ev.freq],
        attack = ev.kind === 'drone' ? 0.5 : 0.3;
      for (const freq of freqs) {
        const o = AC.createOscillator(),
          g = AC.createGain(),
          fl = AC.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        fl.type = 'lowpass';
        fl.frequency.value = ev.kind === 'drone' ? 400 : 1100;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(
          ev.vol,
          at + Math.min(attack, ev.dur * 0.4),
        );
        g.gain.setValueAtTime(ev.vol, at + ev.dur * 0.8);
        g.gain.exponentialRampToValueAtTime(0.001, at + ev.dur);
        o.connect(fl);
        fl.connect(g);
        g.connect(music.bus);
        o.start(at);
        o.stop(at + ev.dur + 0.05);
        o.onended = () => {
          o.disconnect();
          fl.disconnect();
          g.disconnect();
        };
      }
    }
    function musicTick() {
      if (!music || !AC || isMuted()) return;
      const horizon = AC.currentTime + 0.6;
      while (music.nextBarTime < horizon) {
        const t0 = music.nextBarTime,
          bar = music.bar;
        for (const ev of music.score) {
          if (Math.floor(ev.at / MUSIC_BAR) === bar)
            musicNote(t0 + (ev.at - bar * MUSIC_BAR), ev);
        }
        music.nextBarTime += MUSIC_BAR;
        music.bar = (music.bar + 1) % MUSIC_BARS;
      }
    }
    function musicOn(level) {
      if (!AC || music || isMuted()) return;
      const bus = AC.createGain();
      // Bus de música por debajo de los efectos: el disparo más suave
      // (0,10) sigue sonando por encima de la nota más fuerte (0,5 × 0,12).
      bus.gain.value = 0.12 * (level === undefined ? 1 : level);
      bus.connect(AC.destination);
      const timer = (env.host.setInterval || setInterval)(musicTick, 200);
      music = { bus, timer, score: musicScore(), nextBarTime: AC.currentTime + 0.1, bar: 0 };
      musicTick();
    }
    function musicOff() {
      if (!music) return;
      const m = music;
      music = null;
      try {
        (env.host.clearInterval || clearInterval)(m.timer);
      } catch (e) {}
      try {
        m.bus.gain.value = 0;
        m.bus.disconnect();
      } catch (e) {}
    }
    function suspend(context = true) {
      humOff();
      musicOff();
      if (sil) sil.pause();
      if (context && AC) AC.suspend().catch(() => {});
    }
    return {
      suspend,
      silentSrc,
      audio,
      tone,
      noise,
      buzz,
      sfx,
      humOn,
      humOff,
      rotorSet,
      musicOn,
      musicOff,
      musicScore,
      MUSIC_LOOP,
      get musicActive() {
        return !!music;
      },
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
