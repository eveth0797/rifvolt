/* =========================================================
   RIFTVOLT — NEXUS: el Director de IA que aprende de ti
   ---------------------------------------------------------
   4 sistemas de aprendizaje que se combinan:
   1) Rating de habilidad tipo Elo + "Trinquete de Entropía":
      la dificultad mínima NUNCA baja entre partidas.
   2) Q-learning tabular por tipo de enemigo: cada especie
      aprende tácticas (flanquear, predecir, retirarse...)
      contra TU forma de jugar. Las tablas Q se guardan.
   3) Algoritmo genético: cada especie tiene una población de
      genomas (velocidad, vida, cadencia...). Los que más te
      dañan se reproducen. Generación tras generación mutan.
   4) Bandido multibrazo (Thompson sampling): elige qué
      especies y qué patrones de jefe te cuestan más.
   + Modelo del jugador: histograma de movimiento, preferencia
      cuerpo a cuerpo vs. distancia, uso de dash, precisión.
   ========================================================= */
(() => {
  const KEY = "riftvolt.nexus.v1";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = Math.random;

  /* ---------- muestreo Beta (Thompson) ---------- */
  function gauss() { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function gamma(k) {
    if (k < 1) return gamma(k + 1) * Math.pow(rand(), 1 / k);
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) { let x, v; do { x = gauss(); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = rand();
      if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
  }
  const betaSample = (a, b) => { const x = gamma(a), y = gamma(b); return x / (x + y); };

  /* ---------- Q-learning ---------- */
  const N_ACTIONS = 7; // 0 acercarse,1 flanquear izq,2 flanquear der,3 retirarse,4 atacar,5 esperar/finta,6 interceptar (predictivo)
  const ACTION_NAMES = ["Acercarse", "Flanqueo ←", "Flanqueo →", "Retirada", "Ataque", "Finta", "Intercepción"];
  const N_STATES = 4 * 2 * 2 * 2 * 2 * 2 * 2; // 256

  const GENE_KEYS = ["spd", "hp", "rate", "pspd", "aggr", "size"];

  function defaultState() {
    return {
      v: 1, sessions: 0, skill: 1000, floor: 900, peakD: 900, roomsPlayed: 0,
      q: {}, qVisits: {}, eps: {},
      ga: {}, bandit: {}, bossBandit: {},
      model: {
        moveHist: [1, 1, 1, 1, 1, 1, 1, 1], dodgeHist: [1, 1, 1, 1, 1, 1, 1, 1],
        meleeShots: 1, boltShots: 1, meleeHits: 1, boltHits: 1, dashes: 1, dashPerMin: 6,
        dmgTakenPerRoom: 1.5, clearTime: 20, hitsBy: {}, deaths: 0, playSec: 0,
        avgDist: 60, nearTime: 1, farTime: 1
      },
      log: []
    };
  }

  let S;
  try { S = Object.assign(defaultState(), JSON.parse(localStorage.getItem(KEY) || "{}")); S.model = Object.assign(defaultState().model, S.model); }
  catch { S = defaultState(); }

  const N = {};
  N.ACTION_NAMES = ACTION_NAMES; N.N_ACTIONS = N_ACTIONS;
  N.state = () => S;
  N.save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
  N.reset = () => { S = defaultState(); N.save(); };
  N.note = (msg) => { S.log.unshift({ t: Date.now(), msg }); S.log = S.log.slice(0, 40); };

  /* ===== Trinquete: cada nueva sesión sube el piso ===== */
  N.newSession = () => {
    S.sessions++;
    const bump = 25 + Math.min(60, S.sessions * 3);
    S.floor = Math.max(S.floor + bump, S.peakD * 0.92);
    N.note(`Sesión #${S.sessions}: piso de entropía elevado a ${Math.round(S.floor)} (+${bump}). El multiverso recuerda.`);
    N.save();
  };

  /* ===== Dificultad objetivo de una sala ===== */
  N.roomDifficulty = (realm, cycle, isElite) => {
    const target = S.skill + 70 + realm * 45 + cycle * 260 + (isElite ? 120 : 0);
    const D = Math.max(S.floor + realm * 30 + cycle * 220, target);
    S.peakD = Math.max(S.peakD, D);
    return D;
  };
  /* Escalado de stats a partir de D */
  N.scale = (D) => ({
    hp: 1 + Math.max(0, D - 900) / 1100,
    dmg: 1 + Math.max(0, D - 900) / 2200,
    spd: Math.min(1.7, 1 + Math.max(0, D - 900) / 3000),
    budget: 4 + Math.max(0, D - 900) / 95,
    intel: clamp((D - 800) / 1600, 0.1, 1),       // precisión predictiva
    rate: Math.min(2, 1 + Math.max(0, D - 900) / 2500)
  });

  /* ===== Resultado de sala → actualización Elo ===== */
  N.roomResult = ({ D, hpLostFrac, died, seconds }) => {
    const E = 1 / (1 + Math.pow(10, (D - S.skill) / 400));
    const score = died ? 0 : clamp(1 - hpLostFrac * 1.6 - Math.max(0, seconds - 35) / 120, 0, 1);
    const K = S.roomsPlayed < 30 ? 48 : 28;
    const delta = K * (score - E);
    S.skill = clamp(S.skill + delta, 600, 6000);
    S.roomsPlayed++;
    const m = S.model; m.dmgTakenPerRoom = m.dmgTakenPerRoom * 0.9 + hpLostFrac * 10 * 0.1; if (!died) m.clearTime = m.clearTime * 0.9 + seconds * 0.1;
    if (!died && score > 0.85) S.floor = Math.max(S.floor, S.floor + 4); // dominar sube el piso
    return { E, score, delta };
  };
  N.realmCleared = (D) => { S.floor = Math.max(S.floor, D * 0.9); N.note(`Reino superado. El piso sube a ${Math.round(S.floor)}.`); N.save(); };
  N.playerDied = () => { S.model.deaths++; N.save(); };

  /* ===== Q-learning por especie ===== */
  function qtab(type) {
    if (!S.q[type] || S.q[type].length !== N_STATES * N_ACTIONS) {
      S.q[type] = new Array(N_STATES * N_ACTIONS).fill(0);
      // sesgo inicial razonable: acercarse/atacar
      for (let s = 0; s < N_STATES; s++) { S.q[type][s * N_ACTIONS] = 0.2; S.q[type][s * N_ACTIONS + 4] = 0.15; }
      S.qVisits[type] = 0; S.eps[type] = 0.35;
    }
    return S.q[type];
  }
  N.encodeState = (f) => {
    // f: {distB 0-3, facingMe 0/1, playerMoving 0/1, lowHp 0/1, ready 0/1, playerDashReady 0/1, blocked 0/1}
    return ((((((f.distB * 2 + f.facingMe) * 2 + f.playerMoving) * 2 + f.lowHp) * 2 + f.ready) * 2 + f.playerDashReady) * 2 + f.blocked);
  };
  N.chooseAction = (type, s, mask) => {
    const Q = qtab(type); const eps = S.eps[type];
    if (rand() < eps) { let a; do { a = Math.floor(rand() * N_ACTIONS); } while (mask && !mask[a]); return a; }
    let best = -1e9, ba = 0;
    for (let a = 0; a < N_ACTIONS; a++) { if (mask && !mask[a]) continue; const v = Q[s * N_ACTIONS + a] + rand() * 1e-4; if (v > best) { best = v; ba = a; } }
    return ba;
  };
  N.learn = (type, s, a, r, s2, done) => {
    const Q = qtab(type), alpha = 0.15, gamma = 0.9;
    let max2 = 0;
    if (!done) { max2 = -1e9; for (let b = 0; b < N_ACTIONS; b++) max2 = Math.max(max2, Q[s2 * N_ACTIONS + b]); }
    const i = s * N_ACTIONS + a;
    Q[i] += alpha * (r + gamma * max2 - Q[i]);
    S.qVisits[type] = (S.qVisits[type] || 0) + 1;
    S.eps[type] = Math.max(0.04, 0.35 * Math.pow(0.9993, S.qVisits[type]));
  };
  N.qStats = (type) => {
    const Q = qtab(type), counts = new Array(N_ACTIONS).fill(0);
    for (let s = 0; s < N_STATES; s++) { let b = 0, bv = -1e9; for (let a = 0; a < N_ACTIONS; a++) if (Q[s * N_ACTIONS + a] > bv) { bv = Q[s * N_ACTIONS + a]; b = a; } counts[b]++; }
    return { visits: S.qVisits[type] || 0, eps: S.eps[type], policy: counts };
  };

  /* ===== Algoritmo genético ===== */
  const randGenome = () => ({ spd: 0.85 + rand() * 0.3, hp: 0.85 + rand() * 0.3, rate: 0.85 + rand() * 0.3, pspd: 0.85 + rand() * 0.3, aggr: rand(), size: 0.9 + rand() * 0.2, hue: Math.floor(rand() * 60) - 30, fit: 0, n: 0 });
  function pop(type) {
    if (!S.ga[type]) S.ga[type] = { gen: 1, pop: Array.from({ length: 8 }, randGenome), trials: 0, best: 0 };
    return S.ga[type];
  }
  N.pickGenome = (type) => {
    const P = pop(type);
    // torneo de 2 con preferencia por no evaluados
    const a = P.pop[Math.floor(rand() * P.pop.length)], b = P.pop[Math.floor(rand() * P.pop.length)];
    const sc = g => (g.n < 2 ? 99 : g.fit / g.n);
    const g = sc(a) >= sc(b) ? a : b;
    return { idx: P.pop.indexOf(g), g, gen: P.gen };
  };
  N.reportGenome = (type, idx, gen, fitness) => {
    const P = pop(type); if (gen !== P.gen || !P.pop[idx]) return;
    P.pop[idx].fit += fitness; P.pop[idx].n++; P.trials++;
    if (P.trials >= 12) evolve(type);
  };
  function evolve(type) {
    const P = pop(type);
    const scored = P.pop.map(g => ({ g, s: g.n ? g.fit / g.n : 0 })).sort((x, y) => y.s - x.s);
    const elite = scored.slice(0, 3).map(x => x.g);
    const cap = Math.min(2.3, 1.45 + P.gen * 0.03);
    const kids = [];
    while (kids.length < P.pop.length - elite.length) {
      const p1 = elite[Math.floor(rand() * elite.length)], p2 = scored[Math.floor(rand() * Math.min(5, scored.length))].g;
      const k = { fit: 0, n: 0 };
      GENE_KEYS.forEach(key => { let v = rand() < 0.5 ? p1[key] : p2[key]; if (rand() < 0.35) v += gauss() * 0.09; k[key] = key === "aggr" ? clamp(v, 0, 1) : clamp(v, 0.7, cap); });
      k.hue = (rand() < 0.5 ? p1.hue : p2.hue) + Math.round(gauss() * 12);
      kids.push(k);
    }
    P.best = scored[0].s;
    P.pop = elite.map(g => ({ ...g, fit: 0, n: 0 })).concat(kids);
    P.gen++; P.trials = 0;
    N.note(`🧬 ${type}: generación ${P.gen}. Mejor aptitud ${scored[0].s.toFixed(1)}.`);
  }
  N.gaStats = (type) => { const P = pop(type); const avg = k => P.pop.reduce((a, g) => a + g[k], 0) / P.pop.length; return { gen: P.gen, spd: avg("spd"), hp: avg("hp"), rate: avg("rate"), aggr: avg("aggr") }; };

  /* ===== Bandido: qué especies te hacen daño ===== */
  function arm(tbl, k) { if (!tbl[k]) tbl[k] = [1, 1]; return tbl[k]; }
  N.weightTypes = (types) => types.map(t => ({ t, w: betaSample(...arm(S.bandit, t)) }));
  N.reportType = (type, success) => { const a = arm(S.bandit, type); if (success) a[0] += 1; else a[1] += 1; if (a[0] + a[1] > 60) { a[0] *= 0.9; a[1] *= 0.9; } };
  N.pickBossPattern = (boss, patterns) => {
    const tbl = S.bossBandit[boss] = S.bossBandit[boss] || {};
    let best = -1, bp = patterns[0];
    patterns.forEach(p => { const v = betaSample(...arm(tbl, p)); if (v > best) { best = v; bp = p; } });
    return bp;
  };
  N.reportBossPattern = (boss, p, success) => { const tbl = S.bossBandit[boss] = S.bossBandit[boss] || {}; const a = arm(tbl, p); if (success) a[0]++; else a[1] += 0.5; };

  /* ===== Modelo del jugador ===== */
  N.trackMove = (dir8) => { if (dir8 >= 0) S.model.moveHist[dir8] += 0.02; };
  N.trackDodge = (dir8) => { if (dir8 >= 0) S.model.dodgeHist[dir8] += 1; };
  N.trackAttack = (kind, hit) => { const m = S.model; if (kind === "melee") { m.meleeShots++; if (hit) m.meleeHits++; } else { m.boltShots++; if (hit) m.boltHits++; } };
  N.trackHitBy = (type) => { S.model.hitsBy[type] = (S.model.hitsBy[type] || 0) + 1; };
  N.trackDash = () => { S.model.dashes++; };
  N.trackDist = (d, dt) => { const m = S.model; m.avgDist = m.avgDist * 0.999 + d * 0.001; if (d < 50) m.nearTime += dt; else m.farTime += dt; m.playSec += dt; };
  N.dodgeBias = () => { const h = S.model.dodgeHist, s = h.reduce((a, b) => a + b, 0); return h.map(v => v / s); };
  N.profile = () => {
    const m = S.model;
    const meleeRatio = m.meleeShots / (m.meleeShots + m.boltShots);
    const acc = (m.meleeHits + m.boltHits) / (m.meleeShots + m.boltShots);
    const dashRate = m.dashes / Math.max(1, m.playSec / 60);
    const h = m.dodgeHist, maxD = h.indexOf(Math.max(...h));
    const style = meleeRatio > 0.62 ? "Duelista (cuerpo a cuerpo)" : meleeRatio < 0.38 ? "Artillero (a distancia)" : "Híbrido";
    let nemesis = "—", nm = 0; Object.entries(m.hitsBy).forEach(([k, v]) => { if (v > nm) { nm = v; nemesis = k; } });
    return { meleeRatio, acc, dashRate, style, dodgeDir: ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"][maxD], nemesis, aggression: m.nearTime / (m.nearTime + m.farTime) };
  };

  /* ===== Mutaciones del Rift según tus debilidades/fortalezas ===== */
  const MUTATORS = [
    { id: "aegis", name: "Égida Fásica", desc: "Los enemigos bloquean rayos de frente.", when: p => p.meleeRatio < 0.45 },
    { id: "thorns", name: "Espinas de Arco", desc: "Golpear cuerpo a cuerpo a veces te electrocuta.", when: p => p.meleeRatio > 0.6 },
    { id: "static", name: "Suelo Estático", desc: "El dash deja de dar invulnerabilidad completa.", when: p => p.dashRate > 14 },
    { id: "swarm", name: "Enjambre", desc: "Más enemigos, menos vida cada uno.", when: p => p.acc > 0.5 },
    { id: "dark", name: "Apagón Parcial", desc: "Visión reducida en las salas.", when: () => true },
    { id: "haste", name: "Sobretensión", desc: "Enemigos +20% velocidad.", when: p => p.aggression < 0.35 },
    { id: "bounce", name: "Resonancia", desc: "Los proyectiles enemigos rebotan en paredes.", when: p => p.aggression > 0.5 },
    { id: "regen", name: "Autorecierre", desc: "Los enemigos se regeneran lentamente.", when: p => p.acc < 0.35 },
    { id: "volatile", name: "Volátil", desc: "Los enemigos explotan al morir.", when: p => p.meleeRatio > 0.5 },
    { id: "predict", name: "Precognición", desc: "Los enemigos predicen tu esquiva favorita.", when: () => S.roomsPlayed > 25 }
  ];
  N.MUTATORS = MUTATORS;
  N.pickMutators = (realm, cycle) => {
    const p = N.profile(); const n = clamp(Math.floor(realm / 2) + cycle + (S.sessions > 3 ? 1 : 0), 0, 4);
    const pool = MUTATORS.filter(m => m.when(p)); const rest = MUTATORS.filter(m => !pool.includes(m));
    const out = [];
    while (out.length < n && (pool.length || rest.length)) {
      const src = pool.length && rand() < 0.75 ? pool : rest.length ? rest : pool;
      out.push(src.splice(Math.floor(rand() * src.length), 1)[0]);
    }
    return out;
  };

  window.RVNexus = N;
})();
