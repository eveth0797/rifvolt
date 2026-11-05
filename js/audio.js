/* =========================================================
   RIFTVOLT — Audio procedural (WebAudio, sin archivos)
   SFX sintetizados + música synthwave generativa por reino
   ========================================================= */
(() => {
  const A = {};
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicOn = true, sfxOn = true;
  let seqTimer = null, step = 0, nextT = 0, song = null;

  A.init = () => {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
      const comp = ctx.createDynamicsCompressor(); comp.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(comp);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(comp);
    } catch (e) { ctx = null; }
  };
  A.setMusic = v => { musicOn = v; if (musicGain) musicGain.gain.value = v ? 0.22 : 0; };
  A.setSfx = v => { sfxOn = v; };

  function tone(freq, dur, type = "square", vol = 0.3, slide = 0, delay = 0, dest) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(dur, vol = 0.3, filt = 2000, delay = 0, dest) {
    if (!ctx) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filt;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(dest || sfxGain); s.start(t); s.stop(t + dur);
  }

  const last = {};
  A.sfx = (name) => {
    if (!ctx || !sfxOn) return;
    const now = performance.now(); if (last[name] && now - last[name] < 35) return; last[name] = now;
    switch (name) {
      case "slash": noise(0.09, 0.25, 5000); tone(880, 0.08, "sawtooth", 0.08, -500); break;
      case "bolt": tone(1400, 0.12, "square", 0.08, -900); tone(2100, 0.06, "sine", 0.05, -1200, 0.02); break;
      case "hit": tone(220, 0.08, "square", 0.18, -120); noise(0.06, 0.2, 3000); break;
      case "crit": tone(1760, 0.1, "square", 0.12, -800); noise(0.1, 0.25, 6000); break;
      case "kill": tone(660, 0.07, "square", 0.12); tone(990, 0.1, "square", 0.1, 0, 0.05); noise(0.15, 0.2, 2500); break;
      case "hurt": tone(160, 0.25, "sawtooth", 0.25, -100); noise(0.2, 0.3, 1200); break;
      case "dash": noise(0.15, 0.18, 8000); tone(300, 0.15, "sine", 0.08, 600); break;
      case "pickup": tone(1318, 0.06, "square", 0.07); tone(1760, 0.08, "square", 0.06, 0, 0.04); break;
      case "level": [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.15, "square", 0.1, 0, i * 0.07)); break;
      case "door": tone(110, 0.3, "square", 0.15, 60); noise(0.3, 0.15, 900); break;
      case "shoot": tone(520, 0.1, "triangle", 0.07, -260); break;
      case "zap": noise(0.25, 0.25, 9000); tone(80, 0.3, "sawtooth", 0.15, 40); break;
      case "boss": [110, 104, 98, 92].forEach((f, i) => tone(f, 0.5, "sawtooth", 0.18, 0, i * 0.25)); noise(1.2, 0.2, 600); break;
      case "quest": [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, "triangle", 0.12, 0, i * 0.09)); break;
      case "die": [440, 330, 247, 165, 110].forEach((f, i) => tone(f, 0.3, "sawtooth", 0.15, 0, i * 0.15)); break;
      case "ui": tone(990, 0.05, "square", 0.06); break;
      case "charge": tone(200, 0.4, "sawtooth", 0.08, 800); break;
      case "explode": noise(0.5, 0.4, 1500); tone(90, 0.5, "sine", 0.3, -60); break;
    }
  };

  /* ---------- Música generativa ---------- */
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], phryg: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    harm: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11]
  };
  const PROGS = [[0, 5, 3, 4], [0, 3, 4, 3], [0, 6, 5, 4], [0, 4, 5, 3], [0, 2, 5, 4]];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  A.playSong = (seed, opts = {}) => {
    A.init(); if (!ctx) return;
    let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const scaleNames = Object.keys(SCALES);
    song = {
      root: 45 + Math.floor(rnd() * 7), scale: SCALES[opts.scale || scaleNames[Math.floor(rnd() * scaleNames.length)]],
      prog: PROGS[Math.floor(rnd() * PROGS.length)], bpm: opts.bpm || 118 + Math.floor(rnd() * 30),
      arp: Array.from({ length: 16 }, () => Math.floor(rnd() * 5)), arpOn: Array.from({ length: 16 }, (_, i) => i % 2 === 0 || rnd() > 0.45),
      lead: Array.from({ length: 32 }, () => (rnd() > 0.72 ? Math.floor(rnd() * 7) : -1)),
      intensity: opts.intensity || 1
    };
    step = 0; nextT = ctx.currentTime + 0.05;
    if (!seqTimer) seqTimer = setInterval(schedule, 25);
  };
  A.setIntensity = v => { if (song) song.intensity = v; };
  A.stopSong = () => { song = null; };

  function note(deg, oct) { const sc = song.scale, n = sc.length; const o = Math.floor(deg / n); return song.root + oct * 12 + sc[((deg % n) + n) % n] + o * 12; }
  function schedule() {
    if (!ctx || !song || !musicOn) return;
    const spb = 60 / song.bpm / 4;
    while (nextT < ctx.currentTime + 0.12) {
      const bar = Math.floor(step / 16) % 4, s16 = step % 16, chord = song.prog[bar];
      const d = nextT - ctx.currentTime;
      // kick
      if (s16 % 4 === 0) { tone(120, 0.18, "sine", 0.5, -80, d, musicGain); }
      // snare
      if (song.intensity > 0.5 && s16 % 8 === 4) noise(0.12, 0.25, 4000, d, musicGain);
      // hats
      if (song.intensity > 0.3 && s16 % 2 === 1) noise(0.03, 0.08, 9000, d, musicGain);
      // bass
      if (s16 % 2 === 0) tone(mtof(note(chord, 0) - 12), spb * 1.8, "sawtooth", 0.18, 0, d, musicGain);
      // arp
      if (song.arpOn[s16]) tone(mtof(note(chord + [0, 2, 4, 7, 9][song.arp[s16]], 1)), spb * 0.9, "square", 0.05 * song.intensity, 0, d, musicGain);
      // lead
      const ld = song.lead[step % 32];
      if (song.intensity > 0.9 && ld >= 0 && s16 % 2 === 0) tone(mtof(note(chord + ld, 2)), spb * 3, "triangle", 0.07, 0, d, musicGain);
      nextT += spb; step++;
    }
  }
  window.RVAudio = A;
})();
