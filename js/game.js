/* =========================================================
   RIFTVOLT — Motor principal
   Canvas 384x216 (pixel art escalado), sin dependencias.
   ========================================================= */
(() => {
  "use strict";
  const W = window.RVWorld, NX = window.RVNexus, AU = window.RVAudio;
  const T = W.TILE, RW = W.RW, RH = W.RH, HUD = 24;
  const VW = RW * T, VH = RH * T + HUD; // 384 x 216
  const cv = document.getElementById("game"), g = cv.getContext("2d");
  cv.width = VW; cv.height = VH; g.imageSmoothingEnabled = false;
  const $ = s => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const FONT = '"Press Start 2P", monospace';

  /* ================= META (persistente) ================= */
  const MKEY = "riftvolt.meta.v1";
  const defMeta = () => ({ research: 0, totalResearch: 0, up: {}, unlocked: 1, bestRealm: 0, bestCycle: 0, runs: 0, deaths: 0, kills: 0, bosses: {}, codex: {}, playSec: 0, music: true, sfx: true, shake: true, highScore: 0, seenIntro: false });
  let META; try { META = Object.assign(defMeta(), JSON.parse(localStorage.getItem(MKEY) || "{}")); } catch { META = defMeta(); }
  const saveMeta = () => { try { localStorage.setItem(MKEY, JSON.stringify(META)); } catch {} };
  const upLvl = id => META.up[id] || 0;

  /* ================= INPUT ================= */
  const keys = {}; const pressed = {};
  addEventListener("keydown", e => {
    const k = e.key.toLowerCase(); if (!keys[k]) pressed[k] = true; keys[k] = true;
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright", "tab"].includes(k)) e.preventDefault();
    AU.init();
  });
  addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
  const touch = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0, btn: {} };
  const joy = $("#joy"), knob = $("#knob");
  function joyStart(e) {
    for (const t of e.changedTouches) {
      if (touch.id !== null) break;
      touch.id = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY; touch.dx = touch.dy = 0; touch.active = true;
      joy.style.left = (t.clientX - 50) + "px"; joy.style.top = (t.clientY - 50) + "px"; joy.classList.add("on");
    }
    e.preventDefault(); AU.init();
  }
  function joyMove(e) {
    for (const t of e.changedTouches) if (t.identifier === touch.id) {
      let dx = t.clientX - touch.ox, dy = t.clientY - touch.oy; const m = Math.hypot(dx, dy), mx = 40;
      if (m > mx) { dx = dx / m * mx; dy = dy / m * mx; }
      touch.dx = dx / mx; touch.dy = dy / mx; knob.style.transform = `translate(${dx}px,${dy}px)`;
    }
    e.preventDefault();
  }
  function joyEnd(e) { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.id = null; touch.active = false; touch.dx = touch.dy = 0; knob.style.transform = ""; joy.classList.remove("on"); } }
  const tz = $("#touchzone");
  tz.addEventListener("touchstart", joyStart, { passive: false }); tz.addEventListener("touchmove", joyMove, { passive: false });
  tz.addEventListener("touchend", joyEnd); tz.addEventListener("touchcancel", joyEnd);
  document.querySelectorAll("[data-btn]").forEach(b => {
    const n = b.dataset.btn;
    b.addEventListener("touchstart", e => { e.preventDefault(); if (!touch.btn[n]) pressed["btn_" + n] = true; touch.btn[n] = true; b.classList.add("on"); AU.init(); }, { passive: false });
    b.addEventListener("touchend", e => { e.preventDefault(); touch.btn[n] = false; b.classList.remove("on"); }, { passive: false });
  });
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) document.body.classList.add("touch");

  let gpPrev = {};
  function readInput() {
    let mx = 0, my = 0;
    if (keys["a"] || keys["arrowleft"]) mx -= 1; if (keys["d"] || keys["arrowright"]) mx += 1;
    if (keys["w"] || keys["arrowup"]) my -= 1; if (keys["s"] || keys["arrowdown"]) my += 1;
    if (touch.active) { mx += touch.dx; my += touch.dy; }
    const inp = {
      mx, my,
      atk: pressed["j"] || pressed["z"] || pressed["btn_atk"] || keys["j"] || keys["z"] || touch.btn.atk,
      bolt: pressed["k"] || pressed["x"] || pressed["btn_bolt"] || keys["k"] || keys["x"] || touch.btn.bolt,
      dash: pressed[" "] || pressed["l"] || pressed["shift"] || pressed["c"] || pressed["btn_dash"],
      use: pressed["e"] || pressed["enter"] || pressed["btn_atk"] || pressed["j"] || pressed["z"],
      pause: pressed["escape"] || pressed["p"], nexus: pressed["tab"] || pressed["n"]
    };
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.2) { inp.mx += ax; inp.my += ay; }
      const b = i => gp.buttons[i]?.pressed, ed = i => b(i) && !gpPrev[i];
      if (b(12)) inp.my -= 1; if (b(13)) inp.my += 1; if (b(14)) inp.mx -= 1; if (b(15)) inp.mx += 1;
      if (b(2) || b(0)) inp.atk = true; if (b(3) || b(1)) inp.bolt = true; if (ed(5) || ed(7) || ed(4)) inp.dash = true;
      if (ed(0)) inp.use = true; if (ed(9)) inp.pause = true; if (ed(8)) inp.nexus = true;
      gpPrev = {}; gp.buttons.forEach((bb, i) => (gpPrev[i] = bb.pressed));
    }
    const m = Math.hypot(inp.mx, inp.my); if (m > 1) { inp.mx /= m; inp.my /= m; }
    for (const k in pressed) delete pressed[k];
    return inp;
  }

  /* ================= ESTADO ================= */
  let mode = "title"; // title | hub | play | menu | dead
  let run = null, room = null, P = null;
  let enemies = [], bullets = [], bolts = [], parts = [], pickups = [], fx = [], texts = [], hazards = [];
  let shake = 0, hitstop = 0, flash = 0, time = 0, transition = 0, banner = null;
  let roomStats = null;

  /* ================= RUN ================= */
  function newRun(startRealm = 0, seedStr = null) {
    const seed = seedStr ? W.hash(seedStr) : (Math.random() * 1e9) >>> 0;
    run = { realm: startRealm, cycle: 0, seed, daily: !!seedStr, mods: {}, level: 1, xp: 0, xpNext: 12, electrons: 0, research: 0,
      kills: 0, time: 0, rerolls: upLvl("reroll"), combo: 0, comboT: 0, bestCombo: 0, score: 0, bossesKilled: 0, roomsCleared: 0 };
    P = { x: 0, y: 0, vx: 0, vy: 0, r: 5, face: 0, hp: 0, maxHp: 6 + upLvl("hp") * 2, energy: 0, maxEnergy: 60 + upLvl("energy") * 10,
      atkCd: 0, boltCd: 0, dashCd: 0, dashT: 0, inv: 0, swing: 0, moving: false, shieldUsed: false, orbitA: 0, lastDir: 0 };
    P.hp = P.maxHp; P.energy = P.maxEnergy;
    META.runs++; saveMeta();
    startRealm_(startRealm);
    // Puente con LIFE QUEST: la disciplina real da ventajas en el juego
    try {
      const lq = JSON.parse(localStorage.getItem("lifequest.v1") || "null");
      if (lq && lq.quests && lq.quests.length) {
        const d = new Date(), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const done = (lq.questDone && lq.questDone[k] || []).length, ratio = done / lq.quests.length;
        if (ratio >= 1) { P.maxHp += 2; P.hp += 2; run.rerolls += 1; setTimeout(() => toast("🌟 Disciplina real (Life Quest 100%): +1 ♥ y +1 re-tirada"), 1200); }
        else if (ratio >= 0.5) { run.rerolls += 1; setTimeout(() => toast(`✨ Life Quest ${done}/${lq.quests.length}: +1 re-tirada`), 1200); }
        else setTimeout(() => toast(`💡 Completa tus misiones en Life Quest para ganar ventajas (${done}/${lq.quests.length})`), 1200);
      }
    } catch {}
    for (let i = 0; i < upLvl("start"); i++) { const m = W.MODS.filter(x => x.rar < 2)[Math.floor(Math.random() * 10)]; applyMod(m); }
    mode = "play"; showUI("play");
  }
  function startRealm_(idx) {
    run.realm = idx; const R = W.REALMS[idx];
    run.dungeon = W.genRealm(idx, run.cycle, run.seed + idx * 7919 + run.cycle * 104729);
    run.cores = 0; run.bossOpen = false; run.bossDead = false;
    run.mutators = NX.pickMutators(idx, run.cycle);
    run.quests = { rescue: false, rescueTalked: false, pylons: 0, pylonsDone: false, hunt: 0, huntDone: false, huntType: run.dungeon.huntType, huntGoal: run.dungeon.huntGoal };
    enterRoom(run.dungeon.start, -1);
    P.x = VW / 2; P.y = RH * T / 2;
    AU.playSong(W.hash(R.id + run.cycle), { scale: R.scale, intensity: 0.6 });
    const mutTxt = run.mutators.length ? "Mutaciones: " + run.mutators.map(m => m.name).join(" · ") : "Sin mutaciones (por ahora)";
    banner = { t: 4.5, title: (run.cycle ? `CICLO ${run.cycle + 1} · ` : "") + R.name.toUpperCase(), sub: R.sub, sub2: mutTxt };
    NX.note(`Entrando a ${R.name} (ciclo ${run.cycle + 1}). ${mutTxt}`);
  }
  const hasMut = id => run && run.mutators.some(m => m.id === id);

  /* ================= GUARDAR / CONTINUAR RUN ================= */
  const RKEY = "riftvolt.run.v1";
  function saveRun() {
    if (!run || !room || mode === "dead") return;
    try {
      const rs = run.dungeon.rooms.map(r => ({ c: r.cleared ? 1 : 0, v: r.visited ? 1 : 0, p: r.pylon ? { x: r.pylon.x, y: r.pylon.y, on: r.pylon.on } : null, n: r.npc ? r.npc.talked : null }));
      const R = Object.assign({}, run, { dungeon: null, mutators: run.mutators.map(m => m.id) });
      localStorage.setItem(RKEY, JSON.stringify({ run: R, P, rs, cur: [room.x, room.y], t: Date.now() }));
    } catch {}
  }
  const clearRun = () => { try { localStorage.removeItem(RKEY); } catch {} };
  const savedRun = () => { try { return JSON.parse(localStorage.getItem(RKEY) || "null"); } catch { return null; } };
  function loadRun() {
    const d = savedRun(); if (!d) return false;
    run = d.run; P = Object.assign(P || {}, d.P);
    run.dungeon = W.genRealm(run.realm, run.cycle, run.seed + run.realm * 7919 + run.cycle * 104729);
    run.mutators = (d.run.mutators || []).map(id => NX.MUTATORS.find(m => m.id === id)).filter(Boolean);
    run.dungeon.rooms.forEach((r, i) => { const st = d.rs[i]; if (!st) return; r.cleared = !!st.c; r.visited = !!st.v; if (st.p) r.pylon = st.p; if (st.n !== null && st.n !== undefined && r.type === "npc") r.npc = { x: VW / 2, y: RH * T / 2 - 20, name: npcName(), talked: st.n }; });
    const cur = run.dungeon.grid[run.dungeon.key(d.cur[0], d.cur[1])] || run.dungeon.start;
    const wasCleared = cur.cleared; cur.cleared = wasCleared;
    enterRoom(cur, -1); P.x = VW / 2; P.y = RH * T / 2; if (!cur.cleared) { const s0 = freeSpot(0); P.x = VW / 2; P.y = RH * T - 30; }
    P.inv = 1.5; P.dashT = 0; P.swing = 0;
    AU.playSong(W.hash(W.REALMS[run.realm].id + run.cycle), { scale: W.REALMS[run.realm].scale, intensity: 0.8 });
    banner = { t: 3, title: "RUN RESTAURADA", sub: W.REALMS[run.realm].name + (run.cycle ? ` · Ciclo ${run.cycle + 1}` : ""), sub2: "NEXUS no olvidó nada mientras no estabas" };
    mode = "play"; showUI("play"); return true;
  }
  addEventListener("visibilitychange", () => { if (document.hidden) { saveRun(); if (mode === "play") openPause(); } });

  /* ================= SALAS ================= */
  function neighbor(r, i) { const d = W.DIRS[i]; return run.dungeon.grid[run.dungeon.key(r.x + d[0], r.y + d[1])]; }
  function setDoors(state) {
    // state: "open" | "locked"
    room.doors.forEach((open, i) => {
      if (!open) return;
      const nb = neighbor(room, i);
      const seal = nb && nb.type === "boss" && !run.bossOpen;
      const v = state === "locked" || seal ? 9 : 0;
      room.doorCells[i].forEach(([x, y]) => (room.layout[y * RW + x] = v));
    });
  }
  function enterRoom(r, fromDir) {
    room = r; const first = !r.visited; r.visited = true;
    enemies = []; bullets = []; bolts = []; pickups = []; fx = []; hazards = [];
    P.shieldUsed = false;
    if (fromDir >= 0) {
      // aparece en la puerta opuesta
      const opp = (fromDir + 2) % 4;
      const pos = [[VW - 22, RH * T / 2], [VW / 2, RH * T - 22], [22, RH * T / 2], [VW / 2, 22]][opp];
      P.x = pos[0]; P.y = pos[1];
    }
    if (r.type === "npc" && !r.npc) r.npc = { x: VW / 2, y: RH * T / 2 - 20, name: npcName(), talked: false };
    if (r.type === "shrine" && !r.term) r.term = { x: VW / 2, y: RH * T / 2 - 20 };
    if (r.type === "pylon" && !r.pylon) r.pylon = { x: VW / 2 + rnd(-60, 60), y: RH * T / 2 + rnd(-30, 30), on: false };
    if (r.type === "boss" && run.bossDead && !r.portal) r.portal = { x: VW / 2, y: RH * T / 2 };
    const combat = !r.cleared && ["normal", "elite", "pylon", "boss", "npc"].includes(r.type);
    if (combat) {
      setDoors("locked");
      if (r.type === "boss") spawnBoss(); else spawnWave(r.type === "elite");
      roomStats = { D: room.D, hp0: P.hp, t0: run.time, hits: 0 };
      AU.setIntensity(r.type === "boss" ? 1.2 : 1);
      if (first || true) AU.sfx("door");
    } else { r.cleared = true; setDoors("open"); AU.setIntensity(0.6); }
    buildRoomCache();
    transition = 0.35;
    setTimeout(saveRun, 0);
  }
  const NPC_NAMES = ["Dra. Lumen", "Ing. Faraday-9", "Prof. Tesla Rho", "Dra. Kirchhoff", "Ing. Ampère Vex", "Dr. Heaviside", "Ing. Nyquist"];
  const npcName = () => NPC_NAMES[(run.realm + run.cycle * 3) % NPC_NAMES.length];

  function freeSpot(minDist = 80) {
    for (let i = 0; i < 200; i++) {
      const tx = 2 + Math.floor(Math.random() * (RW - 4)), ty = 2 + Math.floor(Math.random() * (RH - 4));
      if (room.layout[ty * RW + tx] !== 0) continue;
      const x = tx * T + 8, y = ty * T + 8; if (Math.hypot(x - P.x, y - P.y) < minDist) continue;
      return { x, y };
    }
    return { x: VW / 2, y: 40 };
  }

  /* ================= ENEMIGOS ================= */
  function spawnWave(elite) {
    const R = W.REALMS[run.realm];
    const D = NX.roomDifficulty(run.realm, run.cycle, elite); room.D = D;
    const sc = NX.scale(D);
    let budget = sc.budget * (hasMut("swarm") ? 1.4 : 1) * (room.type === "npc" ? 0.8 : 1);
    const weights = NX.weightTypes(R.enemies);
    if (elite) { const t = weights.sort((a, b) => b.w - a.w)[0].t; spawnEnemy(t, sc, D, true); budget -= W.ENEMIES[t].cost * 3; }
    let guard = 0;
    while (budget > 0.5 && guard++ < 40) {
      const tot = weights.reduce((a, w) => a + w.w * w.w, 0); let r = Math.random() * tot, pick = weights[0].t;
      for (const w of weights) { r -= w.w * w.w; if (r <= 0) { pick = w.t; break; } }
      spawnEnemy(pick, sc, D, false); budget -= W.ENEMIES[pick].cost;
    }
  }
  function spawnEnemy(type, sc, D, elite, at) {
    const def = W.ENEMIES[type], gn = NX.pickGenome(type), G = gn.g;
    const pos = at || freeSpot(elite ? 100 : 80);
    const swarm = hasMut("swarm") ? 0.7 : 1;
    const hp = def.hp * sc.hp * G.hp * swarm * (elite ? 3 : 1);
    const e = {
      type, def, kind: def.kind, x: pos.x, y: pos.y, vx: 0, vy: 0, r: def.r * G.size * (elite ? 1.4 : 1), hp, maxHp: hp,
      spd: def.spd * sc.spd * G.spd * (hasMut("haste") ? 1.2 : 1), fireI: (def.fire || 1.5) / (sc.rate * G.rate),
      pspd: 85 * G.pspd * (1 + Math.max(0, D - 900) / 5000), intel: sc.intel, dmg: def.dmg, aggr: G.aggr, hue: G.hue,
      gn, elite, cd: rnd(0.5, 1.5), spawnT: 0.7, flash: 0, t: 0, dmgDealt: 0, born: run.time,
      brain: { s: -1, a: 5, t: 0, rew: 0 }, act: 5, flankSign: Math.random() < 0.5 ? 1 : -1, charge: 0, chargeDir: 0, tele: 0, stun: 0
    };
    if (elite) {
      const AFF = ["Blindado", "Veloz", "Vampírico", "Explosivo"]; const n = 1 + (run.cycle > 0 || run.realm > 3 ? 1 : 0);
      e.affixes = []; while (e.affixes.length < n) { const a = AFF[Math.floor(Math.random() * AFF.length)]; if (!e.affixes.includes(a)) e.affixes.push(a); }
      if (e.affixes.includes("Blindado")) { e.hp *= 1.5; e.maxHp *= 1.5; }
      if (e.affixes.includes("Veloz")) { e.spd *= 1.35; e.fireI *= 0.75; }
    }
    enemies.push(e); return e;
  }

  /* ================= JEFES ================= */
  const BOSS_PATTERNS = {
    inrush: ["charge", "ring", "aimed", "charge2"],
    choir: ["spiral", "ring", "aimed", "wave"],
    ferro: ["teleport", "spiral", "summon", "aimed"],
    hyper: ["summon", "aimed", "wave", "ring", "barrage"],
    titan: ["strikes", "charge", "wave", "ring"],
    twins: ["aimed", "charge", "mirror", "spiral"],
    agent: ["masklines", "restore", "aimed", "charge", "masklines"],
    blackout: ["mimic", "strikes", "spiral", "teleport", "charge", "wave", "summon", "barrage"]
  };
  const ALL_PATTERNS = ["charge", "ring", "aimed", "spiral", "wave", "teleport", "summon", "strikes", "barrage", "masklines"];
  function spawnBoss() {
    const R = W.REALMS[run.realm];
    const D = NX.roomDifficulty(run.realm, run.cycle, true) + 150; room.D = D;
    const sc = NX.scale(D);
    const mk = (x, y, hpMul) => {
      const hp = (420 + run.realm * 120) * sc.hp * hpMul * (1 + run.cycle * 0.5);
      let pats = BOSS_PATTERNS[R.boss].slice();
      if (run.cycle > 0) { // FUSIÓN: en ciclos superiores robas patrones de otros jefes
        for (let i = 0; i < Math.min(3, run.cycle); i++) { const p = ALL_PATTERNS[(W.hash(R.boss + i + run.seed) + i) % ALL_PATTERNS.length]; if (!pats.includes(p)) pats.push(p); }
      }
      return { type: "boss", boss: R.boss, kind: "boss", def: { name: R.bossName, color: R.pal.acc, xp: 0 }, x, y, vx: 0, vy: 0, r: 14, hp, maxHp: hp,
        spd: 55 * sc.spd, pspd: 95 * (1 + run.cycle * 0.15), intel: Math.max(0.6, sc.intel), dmg: 2, pats, pat: null, patT: 0, patData: {}, cd: 1.6, phase: 1,
        spawnT: 1.2, flash: 0, t: 0, dmgDealt: 0, patHit: false, hue: 0, aggr: 1, elite: false, gn: null, stun: 0 };
    };
    if (R.boss === "twins") { enemies.push(mk(VW / 2 - 70, 60, 0.6), mk(VW / 2 + 70, 60, 0.6)); enemies[1].mirrorSide = true; }
    else enemies.push(mk(VW / 2, 60, 1));
    AU.sfx("boss");
    banner = { t: 3, title: R.bossName, sub: "⚠ ENCUENTRO CON VILLANO ⚠", sub2: run.cycle ? "Fusión activa: patrones robados de otros villanos" : "" };
    META.codex[R.boss] = META.codex[R.boss] || "seen"; saveMeta();
  }

  /* ================= MODS ================= */
  function applyMod(m) {
    run.mods[m.id] = (run.mods[m.id] || 0) + 1;
    if (m.id === "hp") { P.maxHp += 2; P.hp = Math.min(P.maxHp, P.hp + 2); }
    if (m.id === "energy") { P.maxEnergy += 25; P.energy = P.maxEnergy; }
  }
  const mod = id => run.mods[id] || 0;
  const stats = () => ({
    dmg: 10 * (1 + 0.2 * mod("dmg") + 0.08 * upLvl("dmg")) * (1 + 0.05 * mod("ohm") * (P.maxHp - P.hp) / 2 * 2),
    aspd: 1 + 0.18 * mod("aspd"), speed: 92 * (1 + 0.1 * mod("speed")), crit: 0.05 + 0.12 * mod("crit"),
    range: 22 * (1 + 0.2 * mod("range")), dashCd: 0.85 * Math.pow(0.8, mod("dashcd")) * Math.pow(0.94, upLvl("dash")),
    magnet: 30 + 30 * mod("magnet"), regen: 9 + 4 * mod("energy")
  });

  /* ================= COLISIÓN ================= */
  function tileAt(px, py) { const tx = Math.floor(px / T), ty = Math.floor(py / T); if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) return -1; return room.layout[ty * RW + tx]; }
  function blocked(x, y, r, isPlayer) {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]]) {
      const t = tileAt(x + ox, y + oy);
      if (t === -1) { if (!isPlayer) return true; continue; }
      if (W.solid(t)) return true;
    }
    return false;
  }
  function move(e, dx, dy, isPlayer) {
    let hit = false;
    if (!blocked(e.x + dx, e.y, e.r, isPlayer)) e.x += dx; else hit = true;
    if (!blocked(e.x, e.y + dy, e.r, isPlayer)) e.y += dy; else hit = true;
    return hit;
  }
  const losClear = (a, b) => { const n = Math.ceil(dist(a, b) / 8); for (let i = 1; i < n; i++) { const t = tileAt(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n); if (t === 1 || t === 9) return false; } return true; };

  /* ================= FX ================= */
  function burst(x, y, color, n = 10, sp = 80, life = 0.5) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rnd(sp * 0.3, sp); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(life * 0.5, life), max: life, color, sz: Math.random() < 0.3 ? 2 : 1 }); } }
  function txt(x, y, s, color = "#fff", big = false) { texts.push({ x, y, s: String(s), color, life: 0.8, big }); }
  function bolt(x1, y1, x2, y2, color = "#7df9ff", life = 0.15) { fx.push({ kind: "lightning", x1, y1, x2, y2, color, life, max: life, seed: Math.random() * 1000 }); }
  function doShake(v) { if (META.shake) shake = Math.max(shake, v); }

  /* ================= DAÑO ================= */
  function hurtPlayer(n, src) {
    if (P.inv > 0 || mode !== "play") return false;
    if (P.dashT > 0 && !hasMut("static")) return false;
    if (P.dashT > 0 && hasMut("static") && Math.random() < 0.5) return false;
    if (mod("shield") && !P.shieldUsed) { P.shieldUsed = true; P.inv = 0.8; burst(P.x, P.y, "#7df9ff", 20, 120); txt(P.x, P.y - 10, "BLOQUEO", "#7df9ff"); AU.sfx("zap"); return false; }
    P.hp -= n; P.inv = 1.0; doShake(5); flash = 0.15; hitstop = 0.06; AU.sfx("hurt");
    burst(P.x, P.y, "#ff4d6d", 16, 110);
    run.combo = 0;
    if (src && src.affixes && src.affixes.includes("Vampírico")) { src.hp = Math.min(src.maxHp, src.hp + src.maxHp * 0.15); txt(src.x, src.y - 12, "+VIDA", "#ff4d6d"); }
    if (src) { src.dmgDealt = (src.dmgDealt || 0) + n; if (src.brain) src.brain.rew += 1.2; if (src.type && src.type !== "boss") { NX.trackHitBy(W.ENEMIES[src.type].name); } if (src.kind === "boss") src.patHit = true; }
    if (roomStats) roomStats.hits++;
    if (mod("nova")) { enemies.forEach(e => { if (dist(e, P) < 60) damageEnemy(e, 15 * mod("nova"), P, false); }); fx.push({ kind: "ring", x: P.x, y: P.y, r: 0, max: 60, life: 0.3, color: "#7df9ff" }); }
    if (P.hp <= 0) die();
    return true;
  }
  function damageEnemy(e, d, src, isMelee) {
    if (e.spawnT > 0 || e.dead) return;
    let crit = Math.random() < stats().crit; if (crit) d *= 2;
    // Égida: bloquea rayos frontales
    if (!isMelee && hasMut("aegis") && e.kind !== "boss" && src) { const a = ang(e, src), fa = Math.atan2(e.vy, e.vx); if (Math.abs(((a - fa + 9.42) % 6.283) - 3.14) > 2.2 && Math.random() < 0.6) { txt(e.x, e.y - 8, "BLOQ", "#888"); burst(e.x, e.y, "#aaa", 4, 40); return; } }
    e.hp -= d; e.flash = 0.1; if (e.brain) e.brain.rew -= 0.25;
    txt(e.x + rnd(-4, 4), e.y - e.r - 4, Math.round(d), crit ? "#ffd60a" : "#fff", crit);
    burst(e.x, e.y, crit ? "#ffd60a" : (e.def.color || "#fff"), crit ? 10 : 5, 70, 0.35);
    AU.sfx(crit ? "crit" : "hit");
    if (isMelee) { hitstop = Math.max(hitstop, crit ? 0.07 : 0.035); const a = ang(src, e); e.vx += Math.cos(a) * 120; e.vy += Math.sin(a) * 120; e.stun = 0.12; }
    if (isMelee && hasMut("thorns") && Math.random() < 0.12) { hurtPlayer(1, null); bolt(e.x, e.y, P.x, P.y, "#ff4d6d"); }
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    e.dead = true; run.kills++; META.kills++;
    run.combo++; run.comboT = 2.5; run.bestCombo = Math.max(run.bestCombo, run.combo);
    burst(e.x, e.y, e.def.color || "#fff", e.kind === "boss" ? 60 : 18, e.kind === "boss" ? 200 : 110, 0.7);
    fx.push({ kind: "ring", x: e.x, y: e.y, r: 0, max: e.kind === "boss" ? 120 : 28 + e.r, life: 0.35, color: e.def.color || "#fff" }); doShake(e.kind === "boss" ? 12 : 2); AU.sfx(e.kind === "boss" ? "explode" : "kill");
    if (e.kind !== "boss") {
      if (e.brain && e.brain.s >= 0) NX.learn(e.type, e.brain.s, e.brain.a, e.brain.rew - 1, 0, true);
      NX.reportGenome(e.type, e.gn.idx, e.gn.gen, e.dmgDealt * 5 + Math.min(30, run.time - e.born) * 0.15);
      NX.reportType(e.type, e.dmgDealt > 0);
      const mult = 1 + Math.min(run.combo, 30) * 0.05;
      const n = Math.ceil(e.def.xp * (e.elite ? 4 : 1) * mult);
      for (let i = 0; i < Math.min(n, 12); i++) pickups.push({ kind: "e", x: e.x + rnd(-6, 6), y: e.y + rnd(-6, 6), vx: rnd(-60, 60), vy: rnd(-60, 60), v: Math.max(1, Math.round(n / Math.min(n, 12))), t: 0 });
      if (Math.random() < 0.05 + (P.hp < P.maxHp / 2 ? 0.04 : 0)) pickups.push({ kind: "h", x: e.x, y: e.y, vx: 0, vy: 0, t: 0 });
      if (e.elite) { pickups.push({ kind: "core", x: e.x, y: e.y, vx: 0, vy: 0, t: 0 }); }
      if (mod("leech") && Math.random() < 0.15 * mod("leech")) { P.hp = Math.min(P.maxHp, P.hp + 1); txt(P.x, P.y - 10, "+1", "#06d6a0"); }
      if (run.quests.huntType === e.type && !run.quests.huntDone) { run.quests.hunt++; if (run.quests.hunt >= run.quests.huntGoal) completeQuest("hunt"); }
      if (e.kind === "splitter" && !e.child) { for (let i = 0; i < 2; i++) { const c = spawnEnemy("slime", NX.scale(room.D), room.D, false, { x: e.x + rnd(-6, 6), y: e.y + rnd(-6, 6) }); c.r *= 0.65; c.hp = c.maxHp = e.maxHp * 0.35; c.child = true; c.spawnT = 0.1; c.spd *= 1.3; } }
      if (e.affixes && e.affixes.includes("Explosivo")) { for (let i = 0; i < 12; i++) shoot(e, i * 0.5236, 90); fx.push({ kind: "ring", x: e.x, y: e.y, r: 0, max: 40, life: 0.35, color: "#ff9f1c" }); }
      if (hasMut("volatile") || e.kind === "bomber") { fx.push({ kind: "ring", x: e.x, y: e.y, r: 0, max: 26, life: 0.35, color: "#ff4d6d" }); if (dist(e, P) < 26) hurtPlayer(1, e); }
      run.score += Math.round(e.def.xp * 10 * mult);
    } else {
      NX.reportBossPattern(e.boss, e.pat || "aimed", e.patHit);
      if (enemies.filter(x => x.kind === "boss" && !x.dead).length === 0) bossDefeated(e);
    }
  }

  /* ================= MUERTE / VICTORIA ================= */
  function die() {
    clearRun();
    mode = "dead"; AU.sfx("die"); NX.playerDied(); META.deaths++;
    if (roomStats) NX.roomResult({ D: room.D, hpLostFrac: 1, died: true, seconds: run.time - roomStats.t0 });
    const gained = run.research + Math.floor(run.roomsCleared * 1.5) + run.bossesKilled * 5;
    META.research += gained; META.totalResearch += gained;
    META.highScore = Math.max(META.highScore, run.score);
    META.bestRealm = Math.max(META.bestRealm, run.realm + run.cycle * W.REALMS.length);
    saveMeta(); NX.save();
    const p = NX.profile(), s = NX.state();
    $("#deadStats").innerHTML = `
      <p>Llegaste a <b>${W.REALMS[run.realm].name}</b>${run.cycle ? ` (Ciclo ${run.cycle + 1})` : ""} · Nivel ${run.level} · ${run.kills} eliminaciones · combo máx ×${run.bestCombo}</p>
      <p>Puntuación: <b>${run.score}</b> · Récord: ${META.highScore}</p>
      <p class="hl">+${gained} 🧪 Datos de Investigación</p>
      <div class="nexus-says"><b>NEXUS ha aprendido:</b><br>
      Tu estilo: <b>${p.style}</b> · Esquivas sobre todo hacia <b>${p.dodgeDir}</b> · Tu némesis: <b>${p.nemesis}</b><br>
      Rating estimado: <b>${Math.round(s.skill)}</b> · Piso de entropía: <b>${Math.round(s.floor)}</b> (nunca baja)<br>
      <i>“${taunt(p)}”</i></div>`;
    showUI("dead");
  }
  function taunt(p) {
    const t = [
      `Siempre esquivas hacia ${p.dodgeDir}. Ahí te estaré esperando.`,
      p.meleeRatio > 0.6 ? "Te gusta pelear de cerca. Mis criaturas han aprendido a no dejarte." : p.meleeRatio < 0.4 ? "Disparas desde lejos. Les enseñé a cubrirse." : "Mezclas estilos. Interesante. Estoy ajustando.",
      `${p.nemesis !== "—" ? p.nemesis + " te ha herido más que nadie. Habrá más." : "Aún te estudio."}`,
      "Cada vez que vuelves, el multiverso es un poco más hostil.",
      "No me reinicio. Evoluciono."
    ];
    return t[Math.floor(Math.random() * t.length)];
  }
  function bossDefeated(e) {
    const R = W.REALMS[run.realm];
    run.bossDead = true; run.bossesKilled++; room.cleared = true;
    const rr = 25 + run.realm * 10 + run.cycle * 30; run.research += rr;
    META.bosses[R.boss] = (META.bosses[R.boss] || 0) + 1; META.codex[R.boss] = "known";
    META.unlocked = Math.max(META.unlocked, Math.min(W.REALMS.length, run.realm + 2));
    saveMeta();
    NX.realmCleared(room.D);
    roomCleared(true);
    room.portal = { x: VW / 2, y: RH * T / 2 };
    banner = { t: 4, title: "¡VILLANO DERROTADO!", sub: `+${rr} 🧪 · Registro desbloqueado en el Códice`, sub2: "Entra al portal para continuar" };
    AU.sfx("quest"); for (let i = 0; i < 4; i++) setTimeout(() => burst(rnd(60, VW - 60), rnd(40, 150), ["#ffd60a", "#7df9ff", "#ff4d6d"][i % 3], 40, 160, 1), i * 200);
    for (let i = 0; i < 3; i++) pickups.push({ kind: "h", x: e.x + rnd(-20, 20), y: e.y + rnd(-10, 10), vx: 0, vy: 0, t: 0 });
  }
  function roomCleared(isBoss) {
    room.cleared = true; run.roomsCleared++;
    if (roomStats) {
      const r = NX.roomResult({ D: room.D, hpLostFrac: Math.max(0, roomStats.hp0 - P.hp) / P.maxHp, died: false, seconds: run.time - roomStats.t0 });
      if (roomStats.hits === 0 && !isBoss) { META.noHit = (META.noHit || 0) + 1; txt(P.x, P.y - 16, "¡SIN DAÑO! +5", "#ffd60a", true); run.electrons += 5; run.score += 100; }
      roomStats = null;
    }
    setDoors("open"); AU.sfx("door"); AU.setIntensity(0.6); setTimeout(saveRun, 0);
    enemies.forEach(e => { if (e.gn && !e.dead) NX.reportGenome(e.type, e.gn.idx, e.gn.gen, e.dmgDealt * 5); });
    if (Math.random() < 0.25) pickups.push({ kind: "h", x: VW / 2, y: RH * T / 2, vx: 0, vy: 0, t: 0 });
    if (!isBoss && (room.type === "elite" || Math.random() < 0.14 + upLvl("luck") * 0.02)) { const sp = freeSpot(40); pickups.push({ kind: "chest", x: sp.x, y: sp.y, vx: 0, vy: 0, t: 0 }); AU.sfx("pickup"); txt(sp.x, sp.y - 12, "¡COFRE!", "#ffd60a", true); }
    NX.save();
  }
  function completeQuest(q) {
    const Q = run.quests;
    if (q === "hunt") { Q.huntDone = true; run.electrons += 40; run.research += 10; toast(`✔ Cacería completada: +40 ⚡ +10 🧪`); }
    if (q === "pylons") { Q.pylonsDone = true; run.research += 10; toast("✔ Pilones calibrados: elige una mejora"); setTimeout(() => openLevelUp(true), 400); }
    if (q === "rescue") { Q.rescue = true; run.research += 15; P.hp = P.maxHp; toast("✔ Investigador rescatado: vida al máximo, +15 🧪"); }
    AU.sfx("quest"); run.score += 500;
  }

  /* ================= SUBIR DE NIVEL ================= */
  function gainXP(v) {
    run.electrons += v; run.xp += v;
    while (run.xp >= run.xpNext) { run.xp -= run.xpNext; run.level++; run.xpNext = Math.round(12 + run.level * 7 + run.level * run.level * 0.6); openLevelUp(false); }
  }
  let pendingLevels = 0;
  function openLevelUp(bonus) {
    pendingLevels++; if (mode === "menu") return;
    showLevelCards(bonus);
  }
  function rollCards() {
    const luck = upLvl("luck");
    const pool = W.MODS.filter(m => !(m.id === "shield" && mod("shield")) && !(m.id === "multi" && mod("multi") >= 2));
    const out = [];
    while (out.length < 3) {
      const roll = Math.random() * 100 + luck * 6;
      const rar = roll > 92 ? 2 : roll > 65 ? 1 : 0;
      const c = pool.filter(m => m.rar === rar && !out.includes(m)); const pick = c.length ? c[Math.floor(Math.random() * c.length)] : pool.find(m => !out.includes(m));
      out.push(pick);
    }
    return out;
  }
  function showLevelCards(bonus) {
    mode = "menu"; AU.sfx("level");
    const cards = rollCards();
    const el = $("#cards");
    el.innerHTML = cards.map((m, i) => `<button class="card r${m.rar}" data-i="${i}"><span class="ci">${m.icon}</span><b>${m.name}</b><small>${m.desc}</small>${mod(m.id) ? `<em>Nv ${mod(m.id)} → ${mod(m.id) + 1}</em>` : `<em>${["Común", "Raro", "Épico"][m.rar]}</em>`}</button>`).join("");
    $("#levelTitle").textContent = bonus ? "RECOMPENSA DE MISIÓN" : `NIVEL ${run.level}`;
    $("#rerollBtn").textContent = `🎲 Re-simular (${run.rerolls})`; $("#rerollBtn").disabled = run.rerolls <= 0;
    el.onclick = e => { const b = e.target.closest(".card"); if (!b) return; applyMod(cards[+b.dataset.i]); AU.sfx("ui"); pendingLevels--; if (pendingLevels > 0) showLevelCards(false); else { mode = "play"; showUI("play"); } };
    $("#rerollBtn").onclick = () => { if (run.rerolls > 0) { run.rerolls--; showLevelCards(bonus); } };
    showUI("level");
  }

  /* ================= DIÁLOGOS ================= */
  function dialog(title, html, buttons) {
    mode = "menu"; $("#dlgTitle").textContent = title; $("#dlgBody").innerHTML = html;
    const bx = $("#dlgBtns"); bx.innerHTML = "";
    buttons.forEach(b => { const el = document.createElement("button"); el.className = "btn" + (b.cls ? " " + b.cls : ""); el.textContent = b.label; el.disabled = !!b.disabled;
      el.onclick = () => { AU.sfx("ui"); const keep = b.fn && b.fn(); if (!keep) { mode = "play"; showUI("play"); } }; bx.appendChild(el); });
    showUI("dialog");
  }
  function talkNPC() {
    const n = room.npc, R = W.REALMS[run.realm];
    if (!room.cleared) return;
    if (!n.talked) {
      n.talked = true; completeQuest("rescue");
      dialog(n.name, `<p>¡Gracias! Llevo días atrapada en ${R.name} midiendo este fenómeno.</p><p class="codex">${R.codex}</p><p>Consejo: NEXUS se adapta a tu estilo. Si cambias de táctica, sus criaturas tardan en reaprender. <b>Sé impredecible.</b></p><p>Misión extra: elimina <b>${run.quests.huntGoal} ${W.ENEMIES[run.quests.huntType].name}</b> y calibra los <b>3 pilones</b> del reino.</p>`, [{ label: "Entendido" }]);
    } else dialog(n.name, `<p>Necesitas 3 Núcleos de Fase de las salas élite para abrir la puerta del villano. Llevas <b>${run.cores}/3</b>.</p>`, [{ label: "OK" }]);
  }
  function useTerminal() {
    const buy = (cost, fn) => () => { if (run.electrons < cost) { toast("⚡ insuficientes"); return true; } run.electrons -= cost; fn(); AU.sfx("pickup"); return false; };
    dialog("TERMINAL DE INVESTIGACIÓN", `<p>Electrones disponibles: <b>⚡ ${run.electrons}</b></p><p>Vida ${P.hp}/${P.maxHp}</p>`, [
      { label: "Reparar 2 vida — ⚡25", fn: buy(25, () => { P.hp = Math.min(P.maxHp, P.hp + 2); }) },
      { label: "Mod aleatorio — ⚡70", fn: buy(70, () => setTimeout(() => openLevelUp(true), 50)) },
      { label: "+10 🧪 investigación — ⚡50", fn: buy(50, () => { run.research += 10; }) },
      { label: "Salir", cls: "ghost" }
    ]);
  }

  /* ================= LOGROS ================= */
  const ACH = [
    { id: "blood", i: "⚔️", n: "Primer contacto", d: "Elimina a tu primer enemigo", t: () => META.kills >= 1 },
    { id: "k500", i: "💀", n: "Cortocircuito", d: "500 eliminaciones en total", t: () => META.kills >= 500 },
    { id: "k3000", i: "☠️", n: "Apagón masivo", d: "3000 eliminaciones en total", t: () => META.kills >= 3000 },
    { id: "c10", i: "🔥", n: "En resonancia", d: "Combo ×10", t: () => run && run.bestCombo >= 10 },
    { id: "c40", i: "🌋", n: "Ferroresonancia", d: "Combo ×40", t: () => run && run.bestCombo >= 40 },
    { id: "nohit", i: "🛡️", n: "Intocable", d: "Limpia una sala sin recibir daño", t: () => (META.noHit || 0) >= 1 },
    { id: "nohit50", i: "👻", n: "Fantasma del rift", d: "50 salas sin daño", t: () => (META.noHit || 0) >= 50 },
    { id: "lvl10", i: "⭐", n: "Sobrecargada/o", d: "Nivel 10 en una run", t: () => run && run.level >= 10 },
    { id: "mods8", i: "🧩", n: "Build rota", d: "8 mods distintos en una run", t: () => run && Object.keys(run.mods).length >= 8 },
    { id: "rich", i: "💰", n: "Banco de electrones", d: "300 ⚡ a la vez", t: () => run && run.electrons >= 300 },
    { id: "boss1", i: "👑", n: "Cazavillanos", d: "Derrota a tu primer villano", t: () => Object.keys(META.bosses).length >= 1 },
    { id: "realm5", i: "🗺️", n: "Explorador/a del Voltverso", d: "Llega al reino 5", t: () => META.bestRealm >= 4 },
    { id: "agent", i: "🤖", n: "Política derrotada", d: "Vence a PPO-Ω", t: () => !!META.bosses.agent },
    { id: "blackout", i: "🌑", n: "Black Start", d: "Vence a El Apagón", t: () => !!META.bosses.blackout },
    { id: "cycle2", i: "♾️", n: "Bucle infinito", d: "Entra al Ciclo 2", t: () => META.bestCycle >= 1 },
    { id: "loyal", i: "🧠", n: "Sujeto de estudio", d: "Juega 7 sesiones (NEXUS te conoce bien)", t: () => NX.state().sessions >= 7 }
  ];
  META.ach = META.ach || {};
  function checkAch() {
    ACH.forEach(a => { if (!META.ach[a.id] && a.t()) { META.ach[a.id] = Date.now(); saveMeta(); toast(`🏆 LOGRO: ${a.n}`); AU.sfx("quest"); run && (run.research += 3); } });
  }
  let achT = 0;

  /* ================= UPDATE ================= */
  function update(dt) {
    const inp = readInput();
    if (inp.pause && (mode === "play")) { openPause(); return; }
    if (inp.nexus && mode === "play") { openNexus(true); return; }
    if (mode !== "play") return;
    if (hitstop > 0) { hitstop -= dt; return; }
    run.time += dt; META.playSec += dt; time += dt;
    if ((achT -= dt) <= 0) { achT = 1; checkAch(); }
    if (transition > 0) transition -= dt;
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    if (run.comboT > 0) { run.comboT -= dt; if (run.comboT <= 0) run.combo = 0; }
    const st = stats();

    /* --- jugador --- */
    P.atkCd -= dt; P.boltCd -= dt; P.dashCd -= dt; P.inv -= dt; P.swing -= dt;
    P.energy = Math.min(P.maxEnergy, P.energy + st.regen * dt);
    P.moving = Math.hypot(inp.mx, inp.my) > 0.15;
    if (P.moving && P.dashT <= 0) { P.face = Math.atan2(inp.my, inp.mx); P.lastDir = ((Math.round(P.face / (Math.PI / 4)) % 8) + 8) % 8; NX.trackMove(P.lastDir); }
    if (inp.dash && P.dashCd <= 0) {
      P.dashT = 0.16; P.dashCd = st.dashCd; P.inv = Math.max(P.inv, 0.22); AU.sfx("dash"); NX.trackDash();
      const dodgeDir = P.moving ? P.lastDir : -1; if (bullets.some(b => dist(b, P) < 50) || enemies.some(e => dist(e, P) < 40)) NX.trackDodge(dodgeDir);
    }
    let sp = st.speed;
    if (P.dashT > 0) { P.dashT -= dt; sp = 330; if (mod("trail")) hazards.push({ x: P.x, y: P.y, r: 7, life: 1.2, dmg: 4 * mod("trail"), tick: 0, own: true }); parts.push({ x: P.x, y: P.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: "#7df9ff", sz: 4, ghost: true }); }
    const dirx = P.dashT > 0 ? Math.cos(P.face) : inp.mx, diry = P.dashT > 0 ? Math.sin(P.face) : inp.my;
    const accel = hasMut("slip") ? 4 : 18;
    P.vx += (dirx * sp - P.vx) * Math.min(1, accel * dt); P.vy += (diry * sp - P.vy) * Math.min(1, accel * dt);
    move(P, P.vx * dt, P.vy * dt, true);
    // tracking de distancia
    const near = enemies.reduce((m, e) => Math.min(m, dist(e, P)), 999); if (near < 999) NX.trackDist(near, dt);

    // ataque cuerpo a cuerpo
    if (inp.atk && P.atkCd <= 0 && !nearInteract()) {
      P.atkCd = 0.32 / st.aspd; P.swing = 0.14; P.swingA = P.face; AU.sfx("slash");
      let hitAny = false;
      enemies.forEach(e => {
        const d = dist(e, P); if (d > st.range + e.r) return;
        let da = Math.abs(((ang(P, e) - P.face + 9.42) % 6.283) - 3.14);
        if (da < 1.0 || d < e.r + 6) { damageEnemy(e, st.dmg, P, true); hitAny = true; }
      });
      bullets.forEach(b => { if (dist(b, P) < st.range && !b.big) { b.dead = true; burst(b.x, b.y, "#fff", 3, 40); } }); // desviar balas
      if (room.pylon && !room.pylon.on && room.cleared && dist(room.pylon, P) < st.range + 8) calibratePylon();
      NX.trackAttack("melee", hitAny);
    }
    // rayo
    if (inp.bolt && P.boltCd <= 0 && P.energy >= 12) {
      P.boltCd = 0.28 / st.aspd; P.energy -= 12; AU.sfx("bolt");
      // auto-apuntado suave
      let aim = P.face, best = 1e9;
      enemies.forEach(e => { if (e.spawnT > 0) return; const a = ang(P, e), da = Math.abs(((a - P.face + 9.42) % 6.283) - 3.14), d = dist(e, P); if (da < 0.6 && d < 220 && d < best) { best = d; aim = a; } });
      const n = mod("multi") ? 1 + 2 * Math.min(2, mod("multi")) : 1;
      for (let i = 0; i < n; i++) { const a = aim + (i - (n - 1) / 2) * 0.18; bolts.push({ x: P.x, y: P.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 0.9, pierce: mod("pierce"), hit: new Set(), r: 3 }); }
      NX.trackAttack("bolt", false);
    }
    // interacción
    if (inp.use) { const it = nearInteract(); if (it === "npc") talkNPC(); else if (it === "term") useTerminal(); else if (it === "portal") enterPortal(); }
    // orbital
    if (mod("orbit")) { P.orbitA += dt * 4; for (let i = 0; i < mod("orbit"); i++) { const a = P.orbitA + i * 6.283 / mod("orbit"); const ox = P.x + Math.cos(a) * 20, oy = P.y + Math.sin(a) * 20; enemies.forEach(e => { if (Math.hypot(e.x - ox, e.y - oy) < e.r + 4 && (!e.orbT || e.orbT < time)) { e.orbT = time + 0.4; damageEnemy(e, st.dmg * 0.5, P, false); } }); } }

    // salida por puertas
    let dir = -1;
    if (P.x > VW + 2) dir = 0; else if (P.y > RH * T + 2) dir = 1; else if (P.x < -2) dir = 2; else if (P.y < -2) dir = 3;
    if (dir >= 0) { const nb = neighbor(room, dir); if (nb) enterRoom(nb, dir); else { P.x = clamp(P.x, 8, VW - 8); P.y = clamp(P.y, 8, RH * T - 8); } }

    // suelo eléctrico (pulsa)
    const pulse = (time % 2) < 1;
    if (pulse && tileAt(P.x, P.y) === 2 && P.dashT <= 0) hurtPlayer(1, null);

    /* --- rayos del jugador --- */
    bolts.forEach(b => {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const t = tileAt(b.x, b.y); if (t === 1 || t === 9 || t === 4) { b.life = 0; burst(b.x, b.y, "#7df9ff", 4, 50); }
      enemies.forEach(e => {
        if (b.life <= 0 || b.hit.has(e) || dist(b, e) > e.r + b.r) return;
        b.hit.add(e); damageEnemy(e, st.dmg * 0.7, P, false); NX.trackAttack("bolt", true);
        if (mod("chain") && Math.random() < 0.2 * mod("chain")) { enemies.filter(o => o !== e && !o.dead && dist(o, e) < 80).slice(0, 2).forEach(o => { bolt(e.x, e.y, o.x, o.y); damageEnemy(o, st.dmg * 0.5, P, false); }); }
        if (b.pierce-- <= 0) b.life = 0;
      });
    });
    bolts = bolts.filter(b => b.life > 0);

    /* --- enemigos --- */
    enemies.forEach(e => updateEnemy(e, dt));
    enemies = enemies.filter(e => !e.dead);
    // separación
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) { const a = enemies[i], b = enemies[j], d = dist(a, b), m = a.r + b.r; if (d < m && d > 0) { const push = (m - d) / 2, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d; move(a, -nx * push, -ny * push); move(b, nx * push, ny * push); } }
    // fin de combate
    if (!room.cleared && enemies.length === 0 && room.type !== "boss" && ["normal", "elite", "pylon", "npc"].includes(room.type) && roomStats) roomCleared(false);

    /* --- balas enemigas --- */
    bullets.forEach(b => {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.accel) { b.vx *= 1 + b.accel * dt; b.vy *= 1 + b.accel * dt; }
      const t = tileAt(b.x, b.y);
      if (t === 1 || t === 9 || t === -1) { if (hasMut("bounce") && !b.bounced) { b.bounced = true; const tx = tileAt(b.x - b.vx * dt, b.y); if (tx === 1 || tx === 9) b.vy *= -1; else b.vx *= -1; b.x -= b.vx * dt * 2; b.y -= b.vy * dt * 2; } else b.life = 0; }
      if (dist(b, P) < b.r + P.r - 1) { if (hurtPlayer(b.dmg || 1, b.src)) b.life = 0; }
    });
    bullets = bullets.filter(b => b.life > 0 && !b.dead);

    /* --- peligros (charcos, impactos, ondas) --- */
    hazards.forEach(h => {
      h.life -= dt;
      if (h.own) { h.tick -= dt; if (h.tick <= 0) { h.tick = 0.3; enemies.forEach(e => { if (dist(e, h) < h.r + e.r) damageEnemy(e, h.dmg, P, false); }); } return; }
      if (h.kind === "strike") { h.warn -= dt; if (h.warn <= 0 && !h.done) { h.done = true; bolt(h.x, -20, h.x, h.y, "#fff3a8", 0.25); burst(h.x, h.y, "#ffd60a", 20, 120); doShake(4); AU.sfx("zap"); if (dist(h, P) < h.r + P.r) { hurtPlayer(h.dmg, h.src); } h.life = Math.min(h.life, 0.2); } }
      if (h.kind === "wave") { h.rad += h.spd * dt; const d = dist(h, P); if (Math.abs(d - h.rad) < 5 && !h.hitP) { if (hurtPlayer(1, h.src)) h.hitP = true; } if (h.rad > 400) h.life = 0; }
      if (h.kind === "field") { if (dist(h, P) < h.r && (time % 0.5) < dt) hurtPlayer(1, h.src); }
    });
    hazards = hazards.filter(h => h.life > 0);

    /* --- pickups --- */
    pickups.forEach(p => {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
      const d = dist(p, P);
      if (p.kind !== "chest" && p.t > 0.3 && d < st.magnet + (room.cleared ? 400 : 0) * (p.kind === "e" ? 1 : 0)) { const a = ang(p, P), s = 160 + (1 - d / 400) * 100; p.x += Math.cos(a) * s * dt; p.y += Math.sin(a) * s * dt; }
      if (d < P.r + 5) {
        p.got = true;
        if (p.kind === "e") { gainXP(p.v); AU.sfx("pickup"); }
        if (p.kind === "h") { P.hp = Math.min(P.maxHp, P.hp + 2); txt(P.x, P.y - 10, "+♥", "#ff4d6d"); AU.sfx("pickup"); }
        if (p.kind === "chest") { burst(p.x, p.y, "#ffd60a", 30, 140); AU.sfx("level"); run.score += 200; setTimeout(() => openLevelUp(true), 150); }
        if (p.kind === "core") { run.cores++; AU.sfx("quest"); toast(`◆ Núcleo de Fase ${run.cores}/3`); run.score += 300; if (run.cores >= 3) { run.bossOpen = true; setDoors(room.cleared ? "open" : "locked"); banner = { t: 3, title: "PUERTA DEL VILLANO ABIERTA", sub: "Busca la sala sellada en el mapa ☠", sub2: "" }; } }
      }
    });
    pickups = pickups.filter(p => !p.got);

    /* --- partículas / textos / fx --- */
    parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
    if (parts.length > 600) parts.splice(0, parts.length - 600);
    texts.forEach(t => { t.y -= 22 * dt; t.life -= dt; }); texts = texts.filter(t => t.life > 0);
    fx.forEach(f => { f.life -= dt; if (f.kind === "ring") f.r = f.max * (1 - f.life / 0.35); }); fx = fx.filter(f => f.life > 0);
    if (shake > 0) shake = Math.max(0, shake - dt * 30); if (flash > 0) flash -= dt;
  }

  function nearInteract() {
    if (!room) return null;
    if (room.npc && room.cleared && dist(room.npc, P) < 24) return "npc";
    if (room.term && dist(room.term, P) < 24) return "term";
    if (room.portal && dist(room.portal, P) < 20) return "portal";
    return null;
  }
  function calibratePylon() {
    room.pylon.on = true; run.quests.pylons++; AU.sfx("quest"); burst(room.pylon.x, room.pylon.y, "#7df9ff", 30, 140);
    bolt(room.pylon.x, room.pylon.y, room.pylon.x, -10, "#7df9ff", 0.4);
    toast(`⚡ Pilón calibrado ${run.quests.pylons}/3`);
    if (run.quests.pylons >= 3 && !run.quests.pylonsDone) completeQuest("pylons");
  }
  function enterPortal() {
    AU.sfx("level");
    let next = run.realm + 1;
    if (next >= W.REALMS.length) { next = 0; run.cycle++; META.bestCycle = Math.max(META.bestCycle, run.cycle); NX.note(`Ciclo ${run.cycle + 1} iniciado. El multiverso se reescribe.`); }
    P.hp = Math.min(P.maxHp, P.hp + Math.ceil(P.maxHp / 2));
    META.bestRealm = Math.max(META.bestRealm, next + run.cycle * W.REALMS.length); saveMeta();
    startRealm_(next);
  }

  /* ================= IA DE ENEMIGOS (Q-learning) ================= */
  function predictPos(e, speed) {
    // intercepción: donde estará el jugador cuando llegue el proyectil
    const d = dist(e, P), t = d / Math.max(30, speed);
    let px = P.x + P.vx * t * e.intel, py = P.y + P.vy * t * e.intel;
    if (hasMut("predict") && P.vx === 0 && P.vy === 0) { const b = NX.dodgeBias(); const k = b.indexOf(Math.max(...b)); const a = k * Math.PI / 4; px += Math.cos(a) * 20 * e.intel; py += Math.sin(a) * 20 * e.intel; }
    return { x: px, y: py };
  }
  function shoot(e, a, spd, opts = {}) { bullets.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: opts.r || 3, life: opts.life || 3.5, dmg: opts.dmg || 1, src: e, color: opts.color || e.def.color, accel: opts.accel || 0, big: opts.big }); }

  function updateEnemy(e, dt) {
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (e.kind === "boss") return updateBoss(e, dt);
    if (hasMut("regen")) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
    e.cd -= dt;
    if (e.stun > 0) { e.stun -= dt; move(e, e.vx * dt, e.vy * dt); e.vx *= 0.85; e.vy *= 0.85; return; }
    const d = dist(e, P);

    // --- decisión (cada ~0.35s) ---
    e.brain.t -= dt;
    if (e.brain.t <= 0) {
      const facing = Math.abs(((ang(P, e) - P.face + 9.42) % 6.283) - 3.14) < 0.8 ? 1 : 0;
      const f = { distB: d < 30 ? 0 : d < 70 ? 1 : d < 130 ? 2 : 3, facingMe: facing, playerMoving: P.moving ? 1 : 0, lowHp: e.hp < e.maxHp * 0.4 ? 1 : 0,
        ready: e.cd <= 0 ? 1 : 0, playerDashReady: P.dashCd <= 0 ? 1 : 0, blocked: losClear(e, P) ? 0 : 1 };
      const s = NX.encodeState(f);
      // shaping: estar en rango con ataque listo
      const inRange = (e.kind === "chaser" || e.kind === "charger" || e.kind === "splitter") ? d < 45 : d < 160 && !f.blocked;
      e.brain.rew += (inRange && e.cd <= 0 ? 0.05 : 0) - 0.02;
      if (e.brain.s >= 0) NX.learn(e.type, e.brain.s, e.brain.a, e.brain.rew, s, false);
      const mask = e.kind === "turret" ? [false, false, false, false, true, true, false] : null;
      let a = NX.chooseAction(e.type, s, mask);
      if (Math.random() < e.aggr * 0.25 && e.cd <= 0) a = 4; // genoma agresivo
      e.brain.s = s; e.brain.a = a; e.brain.rew = 0; e.brain.t = rnd(0.28, 0.42); e.act = a;
      if (a === 1 || a === 2) e.flankSign = a === 1 ? -1 : 1;
    }

    // --- ejecución ---
    let tx = 0, ty = 0; const toP = ang(e, P);
    switch (e.act) {
      case 0: tx = Math.cos(toP); ty = Math.sin(toP); break;
      case 1: case 2: { const a = toP + e.flankSign * 1.2; tx = Math.cos(a); ty = Math.sin(a); break; }
      case 3: tx = -Math.cos(toP); ty = -Math.sin(toP); break;
      case 5: { const a = toP + Math.PI / 2 * Math.sin(e.t * 3); tx = Math.cos(a) * 0.3; ty = Math.sin(a) * 0.3; break; }
      case 6: { const pp = predictPos(e, e.spd * 1.5); const a = Math.atan2(pp.y - e.y, pp.x - e.x); tx = Math.cos(a); ty = Math.sin(a); break; }
      case 4: attack(e, d); break;
    }
    if (e.charge > 0) { e.charge -= dt; tx = Math.cos(e.chargeDir) * 3.2; ty = Math.sin(e.chargeDir) * 3.2; if (Math.random() < 0.5) parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.2, max: 0.2, color: e.def.color, sz: 3, ghost: true }); }
    if (e.tele > 0) { e.tele -= dt; tx = ty = 0; if (e.tele <= 0) { e.charge = 0.45; AU.sfx("dash"); } }
    const sp = e.spd;
    e.vx += (tx * sp - e.vx) * Math.min(1, 8 * dt); e.vy += (ty * sp - e.vy) * Math.min(1, 8 * dt);
    if (move(e, e.vx * dt, e.vy * dt) && e.charge > 0) { e.charge = 0; e.stun = 0.4; doShake(2); }
    // contacto
    if (d < e.r + P.r && e.kind !== "turret") { hurtPlayer(e.dmg, e); }
  }
  function attack(e, d) {
    if (e.cd > 0) return;
    const sc = e.fireI;
    switch (e.kind) {
      case "chaser": case "splitter": { const pp = predictPos(e, e.spd * 3); e.chargeDir = Math.atan2(pp.y - e.y, pp.x - e.x); e.charge = 0.25; e.cd = 1.2; break; }
      case "charger": { const pp = predictPos(e, e.spd * 3.2); e.chargeDir = Math.atan2(pp.y - e.y, pp.x - e.x); e.tele = 0.45; e.cd = 2.2; AU.sfx("charge"); break; }
      case "turret": { if (!losClear(e, P)) return; const pp = predictPos(e, e.pspd); const a = Math.atan2(pp.y - e.y, pp.x - e.x); shoot(e, a, e.pspd); if (e.elite) { shoot(e, a + 0.25, e.pspd); shoot(e, a - 0.25, e.pspd); } e.cd = sc; AU.sfx("shoot"); break; }
      case "shooter": { const pp = predictPos(e, e.pspd); const a = Math.atan2(pp.y - e.y, pp.x - e.x); [-0.2, 0, 0.2].forEach(o => shoot(e, a + o, e.pspd * 0.9)); e.cd = sc; AU.sfx("shoot"); break; }
      case "blinker": { const s = freeSpot(60); burst(e.x, e.y, e.def.color, 10, 60); e.x = s.x; e.y = s.y; burst(e.x, e.y, e.def.color, 10, 60); const pp = predictPos(e, e.pspd); const a = Math.atan2(pp.y - e.y, pp.x - e.x); for (let i = 0; i < 5; i++) shoot(e, a + (i - 2) * 0.3, e.pspd * 0.8); e.cd = sc; AU.sfx("zap"); break; }
      case "bomber": { const pp = predictPos(e, 80); hazards.push({ kind: "strike", x: clamp(pp.x, 20, VW - 20), y: clamp(pp.y, 20, RH * T - 20), r: 18, warn: 0.9, life: 1.2, dmg: 1, src: e }); e.cd = sc; AU.sfx("charge"); break; }
    }
  }

  /* ================= IA DE JEFES (bandido de patrones) ================= */
  function updateBoss(e, dt) {
    e.cd -= dt;
    const crit = enemies.filter(x => x.critical && !x.dead);
    if (crit.length) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.012 * crit.length * dt); if (Math.random() < 0.15) crit.forEach(c => bolt(c.x, c.y, e.x, e.y, "#00e5d4", 0.08)); }
    if (e.phase === 1 && e.hp < e.maxHp * 0.5) { e.phase = 2; e.cd = 0.5; banner = { t: 2, title: "FASE 2", sub: "El villano se sobrecarga", sub2: "" }; AU.sfx("boss"); doShake(8); e.spd *= 1.25; e.pspd *= 1.15; }
    const d = dist(e, P);
    if (!e.pat && e.cd <= 0) {
      e.pat = NX.pickBossPattern(e.boss, e.pats); e.patT = 0; e.patData = {}; e.patHit = false;
    }
    if (!e.pat) { // reposicionamiento entre patrones
      let a = ang(e, P) + (e.mirrorSide ? 1.4 : -1.4) * Math.sin(e.t);
      const want = d > 110 ? 1 : d < 60 ? -1 : 0.2;
      move(e, Math.cos(a) * e.spd * want * dt, Math.sin(a) * e.spd * want * dt);
    } else runPattern(e, dt);
    if (d < e.r + P.r) hurtPlayer(e.dmg, e);
  }
  function endPattern(e, cd) { NX.reportBossPattern(e.boss, e.pat, e.patHit); e.pat = null; e.cd = cd * (e.phase === 2 ? 0.65 : 1) / (1 + run.cycle * 0.15); }
  function runPattern(e, dt) {
    const D = e.patData; e.patT += dt; const p2 = e.phase === 2;
    switch (e.pat) {
      case "charge": case "charge2": {
        if (!D.s) { D.s = 1; const pp = predictPos(e, 300); D.a = Math.atan2(pp.y - e.y, pp.x - e.x); D.tele = 0.6; D.n = e.pat === "charge2" || p2 ? 3 : 1; AU.sfx("charge"); }
        if (D.tele > 0) { D.tele -= dt; if (D.tele <= 0) { D.go = 0.5; AU.sfx("dash"); } break; }
        if (D.go > 0) { D.go -= dt; const hit = move(e, Math.cos(D.a) * 320 * dt, Math.sin(D.a) * 320 * dt); parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: e.def.color, sz: 6, ghost: true });
          if (hit || D.go <= 0) { doShake(6); for (let i = 0; i < 10; i++) shoot(e, i * 0.628, e.pspd * 0.7); D.n--; if (D.n > 0) { const pp = predictPos(e, 300); D.a = Math.atan2(pp.y - e.y, pp.x - e.x); D.tele = 0.35; D.go = 0; } else endPattern(e, 1.4); } }
        break;
      }
      case "ring": { if (!D.k) D.k = 0; if (e.patT > D.k * 0.5) { const n = 14 + (p2 ? 8 : 0) + run.cycle * 2; const off = D.k * 0.2; for (let i = 0; i < n; i++) shoot(e, off + i * 6.283 / n, e.pspd * 0.8); D.k++; AU.sfx("shoot"); } if (D.k >= (p2 ? 4 : 3)) endPattern(e, 1.4); break; }
      case "aimed": { if (!D.k) D.k = 0; if (e.patT > D.k * 0.22) { const pp = predictPos(e, e.pspd * 1.3); const a = Math.atan2(pp.y - e.y, pp.x - e.x); shoot(e, a, e.pspd * 1.3, { r: 4 }); if (p2) { shoot(e, a + 0.3, e.pspd * 1.2); shoot(e, a - 0.3, e.pspd * 1.2); } D.k++; AU.sfx("shoot"); } if (D.k >= 6) endPattern(e, 1.2); break; }
      case "spiral": { D.a = (D.a || 0) + dt * (p2 ? 5 : 3.5); if ((D.f = (D.f || 0) + dt) > 0.06) { D.f = 0; const arms = p2 ? 4 : 3; for (let i = 0; i < arms; i++) shoot(e, D.a + i * 6.283 / arms, e.pspd * 0.75); } if (e.patT > 2.6) endPattern(e, 1.4); break; }
      case "wave": { if (!D.s) { D.s = 1; D.k = 0; } if (e.patT > D.k * 0.7 && D.k < (p2 ? 3 : 2)) { hazards.push({ kind: "wave", x: e.x, y: e.y, rad: e.r, spd: 110 + run.cycle * 15, life: 4, src: e }); D.k++; AU.sfx("zap"); doShake(3); } if (e.patT > 2.2) endPattern(e, 1.2); break; }
      case "teleport": { if (!D.s) { D.s = 1; burst(e.x, e.y, e.def.color, 30, 120); const b = NX.dodgeBias(); const k = b.indexOf(Math.max(...b)); const a = k * Math.PI / 4; const tx = clamp(P.x + Math.cos(a) * 50, 30, VW - 30), ty = clamp(P.y + Math.sin(a) * 50, 30, RH * T - 30); if (!blocked(tx, ty, e.r)) { e.x = tx; e.y = ty; } else { const s = freeSpot(60); e.x = s.x; e.y = s.y; } AU.sfx("zap"); }
        if (e.patT > 0.45 && !D.f) { D.f = 1; const n = 16; for (let i = 0; i < n; i++) shoot(e, i * 6.283 / n, e.pspd * 0.7); } if (e.patT > 0.9) endPattern(e, 1.0); break; }
      case "summon": { if (!D.s) { D.s = 1; const R = W.REALMS[run.realm]; const n = (p2 ? 3 : 2) + Math.min(2, run.cycle); const sc = NX.scale(room.D * 0.8); for (let i = 0; i < n; i++) { const t = R.enemies[Math.floor(Math.random() * R.enemies.length)]; const m = spawnEnemy(t, sc, room.D * 0.8, false, { x: clamp(e.x + rnd(-40, 40), 30, VW - 30), y: clamp(e.y + rnd(-30, 30), 30, RH * T - 30) }); m.minion = true; } AU.sfx("charge"); }
        if (e.patT > 1) endPattern(e, 2.2); break; }
      case "strikes": { if (!D.k) D.k = 0; if (e.patT > D.k * 0.3 && D.k < (p2 ? 7 : 5)) { const pp = predictPos(e, 120); hazards.push({ kind: "strike", x: clamp(pp.x + rnd(-14, 14), 16, VW - 16), y: clamp(pp.y + rnd(-14, 14), 16, RH * T - 16), r: 16, warn: 0.75, life: 1, dmg: 1, src: e }); D.k++; } if (e.patT > 2.5) endPattern(e, 1.0); break; }
      case "barrage": { if ((D.f = (D.f || 0) + dt) > 0.12) { D.f = 0; shoot(e, rnd(0, 6.283), e.pspd * rnd(0.5, 1), { accel: 0.6 }); shoot(e, ang(e, P) + rnd(-0.4, 0.4), e.pspd); } if (e.patT > 2.2) endPattern(e, 1.4); break; }
      case "mirror": { // imita tu posición reflejada y dispara cuando atacas
        const tx = VW - P.x, ty = e.mirrorSide ? P.y : RH * T - P.y; const a = Math.atan2(ty - e.y, tx - e.x); move(e, Math.cos(a) * e.spd * 1.6 * dt, Math.sin(a) * e.spd * 1.6 * dt);
        if (P.swing > 0.1 || (P.boltCd > 0.2 && !D.lock)) { D.lock = 0.4; shoot(e, ang(e, P), e.pspd * 1.2, { r: 4 }); }
        if (D.lock) { D.lock -= dt; if (D.lock <= 0) D.lock = 0; }
        if (e.patT > 3) endPattern(e, 0.8); break; }
      case "masklines": { // máscara de acciones: líneas prohibidas con pocas casillas libres
        if (!D.s) { D.s = 1; D.k = 0; AU.sfx("charge"); }
        if (e.patT > D.k * 0.9 && D.k < (p2 ? 3 : 2)) {
          const horiz = Math.random() < 0.5, nLines = 2 + (p2 ? 1 : 0) + Math.min(2, run.cycle);
          for (let l = 0; l < nLines; l++) {
            if (horiz) { const y = 24 + Math.floor(Math.random() * 9) * 16 + 8; const gap = Math.floor(Math.random() * 20) + 2; for (let x = 16; x < VW - 16; x += 16) { if (Math.abs(x / 16 - gap) < 1.5) continue; hazards.push({ kind: "strike", x, y, r: 9, warn: 1.0, life: 1.3, dmg: 1, src: e }); } }
            else { const x = 24 + Math.floor(Math.random() * 21) * 16 + 8; const gap = Math.floor(Math.random() * 8) + 2; for (let y = 16; y < RH * T - 16; y += 16) { if (Math.abs(y / 16 - gap) < 1.5) continue; hazards.push({ kind: "strike", x, y, r: 9, warn: 1.0, life: 1.3, dmg: 1, src: e }); } }
          }
          D.k++;
        }
        if (e.patT > 2.4) endPattern(e, 1.2); break; }
      case "restore": { // invoca cargas críticas que lo curan
        if (!D.s) { D.s = 1; const n = 2 + (p2 ? 1 : 0); const sc = NX.scale(room.D * 0.8);
          for (let i = 0; i < n; i++) { const sp = freeSpot(70); const c = spawnEnemy("turret", sc, room.D * 0.8, false, sp); c.critical = true; c.minion = true; c.hp = c.maxHp = c.maxHp * 1.5; c.def = Object.assign({}, c.def, { name: "Carga Crítica", color: "#00e5d4" }); }
          banner = { t: 2, title: "RESTAURACIÓN EN CURSO", sub: "¡Destruye las cargas críticas: lo están curando!", sub2: "" }; AU.sfx("quest"); }
        if (e.patT > 1.2) endPattern(e, 2.0); break; }
      case "mimic": { // El Apagón usa tus propias tácticas: dash hacia tu esquiva favorita + rayos
        if ((D.f = (D.f || 0) + dt) > 0.5) { D.f = 0; const b = NX.dodgeBias(); const k = b.indexOf(Math.max(...b)); const a = k * Math.PI / 4; const pp = { x: P.x + Math.cos(a) * 35, y: P.y + Math.sin(a) * 35 }; const aa = Math.atan2(pp.y - e.y, pp.x - e.x); for (let i = -1; i <= 1; i++) shoot(e, aa + i * 0.15, 260, { r: 3, color: "#7df9ff" }); move(e, Math.cos(aa) * 30, Math.sin(aa) * 30); AU.sfx("bolt"); }
        if (e.patT > 3) endPattern(e, 1.0); break; }
      default: endPattern(e, 1);
    }
  }

  /* ================= RENDER ================= */
  function render() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!run || !room) { g.fillStyle = "#000"; g.fillRect(0, 0, VW, VH); return; }
    const R = W.REALMS[run.realm], pal = R.pal;
    const sx = shake ? rnd(-shake, shake) : 0, sy = shake ? rnd(-shake, shake) : 0;
    g.fillStyle = pal.bg; g.fillRect(0, 0, VW, VH);
    g.save(); g.translate(Math.round(sx), HUD + Math.round(sy));
    drawRoom(pal);
    if (room.type === "start" && run.realm === 0 && run.cycle === 0) {
      const tch = document.body.classList.contains("touch");
      g.font = `6px ${FONT}`; g.textAlign = "center"; g.fillStyle = pal.acc; g.globalAlpha = 0.75;
      g.fillText(tch ? "JOYSTICK: MOVER · ⚔ HOJA · ⚡ RAYO · DASH: ESQUIVA" : "WASD MOVER · J HOJA · K RAYO · ESPACIO DASH", VW / 2, 40);
      g.fillText("REÚNE 3 ◆ DE LAS SALAS ÉLITE → VENCE AL VILLANO", VW / 2, 152);
      g.fillStyle = "#ff8fa3"; g.fillText("NEXUS TE OBSERVA. CADA PARTIDA SERÁ MÁS DIFÍCIL.", VW / 2, 164); g.globalAlpha = 1;
    }
    // peligros
    hazards.forEach(h => {
      if (h.own) { g.fillStyle = `rgba(255,120,40,${0.4 * h.life})`; g.beginPath(); g.arc(h.x, h.y, h.r, 0, 7); g.fill(); return; }
      if (h.kind === "strike" && !h.done) { const k = 1 - h.warn / 0.9; g.strokeStyle = `rgba(255,214,10,${0.4 + 0.6 * Math.abs(Math.sin(time * 20))})`; g.lineWidth = 1; g.beginPath(); g.arc(h.x, h.y, h.r, 0, 7); g.stroke(); g.fillStyle = "rgba(255,214,10,0.25)"; g.beginPath(); g.arc(h.x, h.y, h.r * clamp(k, 0, 1), 0, 7); g.fill(); }
      if (h.kind === "wave") { g.strokeStyle = pal.glow; g.lineWidth = 3; g.globalAlpha = 0.8; g.beginPath(); g.arc(h.x, h.y, h.rad, 0, 7); g.stroke(); g.globalAlpha = 1; g.lineWidth = 1; }
    });
    // objetos de sala
    if (room.pylon) drawPylon(room.pylon, pal);
    if (room.npc) drawNPC(room.npc);
    if (room.term) drawTerm(room.term, pal);
    if (room.portal) drawPortal(room.portal, pal);
    // pickups
    pickups.forEach(p => {
      if (p.kind === "e") { g.fillStyle = (time * 10 + p.x) % 2 < 1 ? "#7df9ff" : "#fff"; g.fillRect(p.x - 1, p.y - 1, 3, 3); }
      if (p.kind === "chest") { const bob = Math.sin(time * 4) * 1; g.fillStyle = "rgba(0,0,0,0.4)"; g.fillRect(p.x - 7, p.y + 5, 14, 2); g.fillStyle = "#8a5a12"; g.fillRect(p.x - 7, p.y - 4 + bob, 14, 9); g.fillStyle = "#ffd60a"; g.fillRect(p.x - 7, p.y - 6 + bob, 14, 3); g.fillRect(p.x - 1, p.y - 2 + bob, 2, 3); g.fillStyle = "#fff"; if ((time * 3) % 1 < 0.2) g.fillRect(p.x + 3, p.y - 6 + bob, 1, 1); }
      if (p.kind === "h") drawHeart(p.x - 4, p.y - 4 + Math.sin(time * 5) * 1.5, 1, "#ff4d6d");
      if (p.kind === "core") { g.save(); g.translate(p.x, p.y + Math.sin(time * 4) * 2); g.rotate(time * 2); g.fillStyle = "#c77dff"; g.shadowColor = "#c77dff"; g.shadowBlur = 10; g.fillRect(-5, -5, 10, 10); g.restore(); }
    });
    // enemigos
    enemies.forEach(e => drawEnemy(e, pal));
    // jugador
    drawPlayer(pal);
    // balas
    g.globalCompositeOperation = "lighter";
    bullets.forEach(b => { g.fillStyle = b.color || "#ff9f1c"; g.beginPath(); g.arc(b.x, b.y, b.r + 1.5, 0, 7); g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1; g.fillStyle = "#fff"; g.beginPath(); g.arc(b.x, b.y, b.r - 1, 0, 7); g.fill(); });
    bolts.forEach(b => { g.strokeStyle = "#7df9ff"; g.lineWidth = 3; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); g.stroke(); g.strokeStyle = "#fff"; g.lineWidth = 1; g.stroke(); });
    parts.forEach(p => {
      g.globalAlpha = clamp(p.life / p.max, 0, 1) * (p.ghost ? 0.4 : 1);
      const sp2 = p.vx * p.vx + p.vy * p.vy;
      if (!p.ghost && sp2 > 900) { g.strokeStyle = p.color; g.lineWidth = p.sz; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); g.stroke(); g.lineWidth = 1; }
      else { g.fillStyle = p.color; g.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
    });
    g.globalAlpha = 1;
    fx.forEach(f => {
      if (f.kind === "lightning") drawLightning(f.x1, f.y1, f.x2, f.y2, f.color, f.life / f.max, f.seed);
      if (f.kind === "ring") { g.strokeStyle = f.color; g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.stroke(); g.lineWidth = 1; }
    });
    g.globalCompositeOperation = "source-over";
    drawLights(pal);
    // arco de ataque
    if (P.swing > 0) { const st = stats(); g.strokeStyle = "#fff"; g.lineWidth = 3; g.globalAlpha = P.swing / 0.14; g.beginPath(); g.arc(P.x, P.y, st.range - 4, P.swingA - 1, P.swingA + 1); g.stroke(); g.strokeStyle = "#7df9ff"; g.lineWidth = 1; g.beginPath(); g.arc(P.x, P.y, st.range, P.swingA - 1.1, P.swingA + 1.1); g.stroke(); g.globalAlpha = 1; }
    // textos
    g.textAlign = "center";
    texts.forEach(t => { g.globalAlpha = clamp(t.life / 0.5, 0, 1); g.font = `${t.big ? 8 : 6}px ${FONT}`; g.fillStyle = "#000"; g.fillText(t.s, t.x + 1, t.y + 1); g.fillStyle = t.color; g.fillText(t.s, t.x, t.y); });
    g.globalAlpha = 1;
    // apagón parcial
    if (hasMut("dark")) { const gr = g.createRadialGradient(P.x, P.y, 30, P.x, P.y, 130); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.92)"); g.fillStyle = gr; g.fillRect(-10, -10, VW + 20, RH * T + 20); }
    // indicador de interacción
    const it = nearInteract(); if (it) { const o = it === "npc" ? room.npc : it === "term" ? room.term : room.portal; g.font = `6px ${FONT}`; g.fillStyle = "#fff"; g.fillText(document.body.classList.contains("touch") ? "⚔ = usar" : "E = usar", o.x, o.y - 18 + Math.sin(time * 6) * 2); }
    g.restore();
    bloom();
    { const vg = g.createRadialGradient(VW / 2, HUD + RH * T / 2, 90, VW / 2, HUD + RH * T / 2, 240); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.5)"); g.fillStyle = vg; g.fillRect(0, HUD, VW, RH * T); }
    if (flash > 0.05 || hitstop > 0.05) { // aberración cromática en golpes fuertes
      g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.25;
      g.drawImage(cv, 0, HUD, VW, RH * T, 2, HUD, VW, RH * T); g.drawImage(cv, 0, HUD, VW, RH * T, -2, HUD, VW, RH * T); g.restore();
    }
    if (P.hp <= Math.max(2, P.maxHp * 0.25)) { // peligro: viñeta roja que late
      const a = 0.25 + 0.2 * Math.sin(time * 8), vg2 = g.createRadialGradient(VW / 2, HUD + RH * T / 2, 80, VW / 2, HUD + RH * T / 2, 230);
      vg2.addColorStop(0, "rgba(255,0,40,0)"); vg2.addColorStop(1, `rgba(255,0,40,${a})`); g.fillStyle = vg2; g.fillRect(0, HUD, VW, RH * T);
    }
    if (enemies.some(e => e.kind === "boss" && e.t < 2.2)) { // franjas cinematográficas al aparecer el jefe
      const b = enemies.find(e => e.kind === "boss"), k = Math.min(1, b.t < 1.6 ? b.t * 2 : (2.2 - b.t) * 1.6) * 18;
      g.fillStyle = "#000"; g.fillRect(0, HUD, VW, k); g.fillRect(0, VH - k, VW, k);
    }
    drawHUD(pal);
    if (banner) drawBanner(pal);
    if (flash > 0) { g.fillStyle = `rgba(255,60,90,${flash * 2})`; g.fillRect(0, 0, VW, VH); }
    if (transition > 0) { g.fillStyle = `rgba(0,0,0,${transition / 0.35})`; g.fillRect(0, HUD, VW, VH - HUD); for (let i = 0; i < 6; i++) { g.fillStyle = pal.acc; g.globalAlpha = transition; g.fillRect(0, HUD + Math.random() * (VH - HUD), VW, 1); } g.globalAlpha = 1; }
    // viñeta + scanlines
    g.fillStyle = "rgba(0,0,0,0.12)"; for (let y = 0; y < VH; y += 2) g.fillRect(0, y, VW, 1);
  }

  /* ===== GRÁFICOS: caché de sala con profundidad, luces, bloom ===== */
  const roomCv = document.createElement("canvas"); roomCv.width = VW; roomCv.height = RH * T; const rg = roomCv.getContext("2d");
  let motes = [];
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const c = k => clamp(Math.round(((n >> k) & 255) * f), 0, 255); return `rgb(${c(16)},${c(8)},${c(0)})`; }
  function buildRoomCache() {
    const pal = W.REALMS[run.realm].pal, L = room.layout;
    let sd = (room.x * 73856093) ^ (room.y * 19349663) ^ run.seed; const r = () => ((sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const isWall = (x, y) => { if (x < 0 || y < 0 || x >= RW || y >= RH) return true; const v = L[y * RW + x]; return v === 1; };
    rg.fillStyle = pal.bg; rg.fillRect(0, 0, VW, RH * T);
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const v = L[y * RW + x], px = x * T, py = y * T;
      if (v !== 1) {
        rg.fillStyle = (x + y) % 2 ? pal.floor : pal.floor2; rg.fillRect(px, py, T, T);
        rg.fillStyle = shade(pal.floor, 1.35); rg.fillRect(px, py, T, 1); rg.fillRect(px, py, 1, T);
        rg.fillStyle = shade(pal.floor, 0.7); rg.fillRect(px + T - 1, py, 1, T); rg.fillRect(px, py + T - 1, T, 1);
        const q = r();
        if (q < 0.18) { // trazas de circuito
          rg.strokeStyle = pal.acc; rg.globalAlpha = 0.22; rg.beginPath(); const h = r() < 0.5; const o = 3 + Math.floor(r() * 10);
          if (h) { rg.moveTo(px, py + o + 0.5); rg.lineTo(px + 8, py + o + 0.5); rg.lineTo(px + 11, py + o + 3.5); rg.lineTo(px + T, py + o + 3.5); }
          else { rg.moveTo(px + o + 0.5, py); rg.lineTo(px + o + 0.5, py + 9); rg.lineTo(px + o + 3.5, py + 12); rg.lineTo(px + o + 3.5, py + T); }
          rg.stroke(); rg.fillStyle = pal.glow; rg.globalAlpha = 0.45; rg.fillRect(px + (h ? 8 : o), py + (h ? o : 9), 2, 2); rg.globalAlpha = 1;
        } else if (q < 0.26) { rg.fillStyle = shade(pal.floor, 0.6); rg.fillRect(px + 3, py + 3, 1, 1); rg.fillRect(px + 12, py + 3, 1, 1); rg.fillRect(px + 3, py + 12, 1, 1); rg.fillRect(px + 12, py + 12, 1, 1); }
        else if (q < 0.30) { rg.fillStyle = shade(pal.floor, 0.65); rg.fillRect(px + 4, py + 4, 8, 8); rg.fillStyle = shade(pal.floor, 1.25); for (let i = 0; i < 3; i++) rg.fillRect(px + 5, py + 5 + i * 2, 6, 1); }
        // oclusión ambiental bajo muros
        if (isWall(x, y - 1)) { const gr = rg.createLinearGradient(0, py, 0, py + 7); gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); rg.fillStyle = gr; rg.fillRect(px, py, T, 7); }
        if (isWall(x - 1, y)) { rg.fillStyle = "rgba(0,0,0,0.25)"; rg.fillRect(px, py, 3, T); }
        if (isWall(x + 1, y)) { rg.fillStyle = "rgba(0,0,0,0.18)"; rg.fillRect(px + T - 2, py, 2, T); }
      } else {
        const front = !isWall(x, y + 1);
        rg.fillStyle = pal.top; rg.fillRect(px, py, T, T);
        rg.fillStyle = shade(pal.top, 1.2); rg.fillRect(px, py, T, 1);
        rg.fillStyle = shade(pal.top, 0.8); if ((x * 7 + y * 3) % 4 === 0) rg.fillRect(px + 4, py + 4, 8, 1);
        if (front) {
          rg.fillStyle = pal.wall; rg.fillRect(px, py + 6, T, 10);
          rg.fillStyle = shade(pal.wall, 0.7); rg.fillRect(px, py + 6, T, 1); rg.fillRect(px + (x % 2 ? 7 : 3), py + 7, 1, 9);
          rg.fillStyle = shade(pal.wall, 1.25); rg.fillRect(px, py + 15, T, 1);
          if ((x * 13 + y) % 5 === 0) { rg.fillStyle = pal.acc; rg.globalAlpha = 0.7; rg.fillRect(px + 5, py + 10, 6, 1); rg.globalAlpha = 1; }
        } else { rg.fillStyle = shade(pal.top, 0.85); rg.fillRect(px, py + T - 1, T, 1); }
      }
    }
    motes = Array.from({ length: 26 }, () => ({ x: Math.random() * VW, y: Math.random() * RH * T, v: 3 + Math.random() * 8, p: Math.random() * 6 }));
  }
  const lightCache = {};
  function lightSprite(color) {
    if (lightCache[color]) return lightCache[color];
    const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, color); gr.addColorStop(0.25, color); gr.addColorStop(1, "rgba(0,0,0,0)");
    x.globalAlpha = 1; x.fillStyle = gr; x.fillRect(0, 0, 64, 64); x.globalCompositeOperation = "destination-in";
    const gm = x.createRadialGradient(32, 32, 0, 32, 32, 32); gm.addColorStop(0, "rgba(0,0,0,1)"); gm.addColorStop(0.4, "rgba(0,0,0,0.35)"); gm.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gm; x.fillRect(0, 0, 64, 64);
    return (lightCache[color] = c);
  }
  function light(x, y, r, color, a) { g.globalAlpha = a; g.drawImage(lightSprite(color), x - r, y - r, r * 2, r * 2); }
  const bloomA = document.createElement("canvas"); bloomA.width = 96; bloomA.height = 48; const ba = bloomA.getContext("2d");
  const bloomB = document.createElement("canvas"); bloomB.width = 48; bloomB.height = 24; const bb = bloomB.getContext("2d");
  function drawLights(pal) {
    g.globalCompositeOperation = "lighter";
    const pulse = (time % 2) < 1;
    light(P.x, P.y, 46, "#7df9ff", 0.32);
    if (P.dashT > 0) light(P.x, P.y, 30, "#ffffff", 0.3);
    if (P.swing > 0) light(P.x + Math.cos(P.swingA) * 14, P.y + Math.sin(P.swingA) * 14, 22, "#bff", 0.22);
    enemies.forEach(e => { if (e.spawnT > 0) return; light(e.x, e.y, e.kind === "boss" ? 70 : 20 + e.r, e.kind === "boss" ? pal.glow : (e.def.color || "#fff"), e.kind === "boss" ? 0.35 : e.elite ? 0.4 : 0.22); });
    bullets.forEach(b => light(b.x, b.y, 12, b.color || "#ff9f1c", 0.5));
    bolts.forEach(b => light(b.x, b.y, 16, "#7df9ff", 0.55));
    pickups.forEach(p => { if (p.kind === "chest") light(p.x, p.y, 26, "#ffd60a", 0.45); if (p.kind === "core") light(p.x, p.y, 24, "#c77dff", 0.6); else if (p.kind === "h") light(p.x, p.y, 12, "#ff4d6d", 0.4); });
    hazards.forEach(h => { if (h.kind === "strike" && h.done) light(h.x, h.y, 50, "#fff3a8", 0.8); if (h.own) light(h.x, h.y, 14, "#ff7828", 0.3 * h.life); });
    if (pulse) { const L = room.layout; for (let i = 0; i < L.length; i++) if (L[i] === 2) light((i % RW) * T + 8, Math.floor(i / RW) * T + 8, 18, "#ffd60a", 0.25); }
    for (let i = 0; i < room.layout.length; i++) if (room.layout[i] === 4) light((i % RW) * T + 8, Math.floor(i / RW) * T + 9, 14, pal.glow, 0.2 + 0.1 * Math.sin(time * 3 + i));
    if (room.portal) light(room.portal.x, room.portal.y, 50, pal.acc, 0.5);
    if (room.pylon) light(room.pylon.x, room.pylon.y - 13, room.pylon.on ? 40 : 10, "#7df9ff", room.pylon.on ? 0.6 : 0.2);
    if (room.term) light(room.term.x, room.term.y - 4, 22, pal.acc, 0.35);
    // motas ambientales
    g.fillStyle = pal.glow;
    motes.forEach(m => { m.y -= m.v * 0.016; m.x += Math.sin(time + m.p) * 0.1; if (m.y < 0) { m.y = RH * T; m.x = Math.random() * VW; } g.globalAlpha = 0.25 + 0.25 * Math.sin(time * 2 + m.p); g.fillRect(m.x, m.y, 1, 1); });
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  }
  function bloom() {
    ba.globalCompositeOperation = "copy"; ba.imageSmoothingEnabled = true; ba.drawImage(cv, 0, HUD, VW, RH * T, 0, 0, 96, 48);
    bb.globalCompositeOperation = "copy"; bb.imageSmoothingEnabled = true; bb.drawImage(bloomA, 0, 0, 48, 24);
    g.save(); g.imageSmoothingEnabled = true; g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.22; g.drawImage(bloomA, 0, HUD, VW, RH * T);
    g.globalAlpha = 0.28; g.drawImage(bloomB, 0, HUD, VW, RH * T);
    g.restore(); g.imageSmoothingEnabled = false;
  }
  function drawRoom(pal) {
    g.drawImage(roomCv, 0, 0);
    const L = room.layout; const pulse = (time % 2) < 1;
    for (let i = 0; i < L.length; i++) {
      const v = L[i]; if (v !== 2 && v !== 4 && v !== 9) continue;
      const x = i % RW, y = Math.floor(i / RW), px = x * T, py = y * T;
      if (v === 2) { g.fillStyle = pulse ? "rgba(255,214,10,0.5)" : "rgba(255,214,10,0.1)"; g.fillRect(px + 1, py + 1, T - 2, T - 2); g.strokeStyle = "rgba(255,214,10,0.6)"; g.strokeRect(px + 1.5, py + 1.5, T - 3, T - 3); if (pulse && Math.random() < 0.2) drawLightning(px + 2, py + rnd(2, 14), px + 14, py + rnd(2, 14), "#ffd60a", 1, Math.random() * 99); }
      else if (v === 4) {
        g.fillStyle = "rgba(0,0,0,0.4)"; g.fillRect(px + 2, py + 13, 12, 3);
        g.fillStyle = pal.wall; g.fillRect(px + 3, py + 2, 10, 12); g.fillStyle = pal.top; g.fillRect(px + 3, py + 1, 10, 3);
        g.fillStyle = shade(pal.wall, 0.7); g.fillRect(px + 3, py + 11, 10, 3);
        g.globalAlpha = 0.6 + 0.4 * Math.sin(time * 3 + x); g.fillStyle = pal.glow; g.fillRect(px + 6, py + 6, 4, 3); g.globalAlpha = 1;
      } else {
        const sealed = room.cleared;
        g.fillStyle = "#000"; g.fillRect(px, py, T, T);
        g.fillStyle = sealed ? "#c77dff" : "#ff4d6d"; g.globalAlpha = 0.6 + 0.4 * Math.sin(time * 8);
        for (let k = 0; k < 4; k++) g.fillRect(px + k * 4 + 1, py, 2, T); g.globalAlpha = 1;
        if (Math.random() < 0.05) drawLightning(px, py + rnd(0, 16), px + 16, py + rnd(0, 16), sealed ? "#c77dff" : "#ff4d6d", 0.8, Math.random() * 99);
      }
    }
  }
  function drawLightning(x1, y1, x2, y2, color, a, seed) {
    let s = seed || 1; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    g.strokeStyle = color; g.globalAlpha = a; g.lineWidth = 2; g.beginPath(); g.moveTo(x1, y1);
    const n = 6; for (let i = 1; i < n; i++) { const t = i / n; g.lineTo(x1 + (x2 - x1) * t + (r() - 0.5) * 10, y1 + (y2 - y1) * t + (r() - 0.5) * 10); }
    g.lineTo(x2, y2); g.stroke(); g.strokeStyle = "#fff"; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1;
  }
  function drawHeart(x, y, fill, color) {
    const H = ["01100110", "11111111", "11111111", "01111110", "00111100", "00011000"];
    H.forEach((row, j) => [...row].forEach((c, i) => { if (c === "1") { g.fillStyle = (i < 4 || fill >= 1) && fill > 0 ? color : "#3a2030"; g.fillRect(x + i, y + j, 1, 1); } }));
  }
  function drawPlayer(pal) {
    if (P.inv > 0 && P.dashT <= 0 && Math.floor(time * 20) % 2) return;
    const x = Math.round(P.x), y = Math.round(P.y);
    const walk = P.moving ? Math.sin(time * 16) : 0, bob = P.moving ? Math.abs(walk) * -1 : Math.sin(time * 3) * 0.5;
    const fx_ = Math.cos(P.face), fy_ = Math.sin(P.face), flip = fx_ < -0.2 ? -1 : 1;
    // sombra
    g.fillStyle = "rgba(0,0,0,0.45)"; g.beginPath(); g.ellipse(x, y + 7, 6, 2, 0, 0, 7); g.fill();
    // capa ondeante
    const ca = P.face + Math.PI; g.fillStyle = "#c9184a";
    g.beginPath(); g.moveTo(x - 3, y - 2 + bob); g.lineTo(x + 3, y - 2 + bob);
    g.lineTo(x + Math.cos(ca) * 9 + Math.sin(time * 14) * 1.5 + 3, y + 5 + Math.sin(ca) * 4); g.lineTo(x + Math.cos(ca) * 9 - 3, y + 6 + Math.sin(ca) * 4); g.fill();
    const R = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(x + dx * flip - (flip < 0 ? w : 0), y + dy + bob, w, h); };
    // contorno
    g.fillStyle = "#05050c"; g.fillRect(x - 5, y - 8 + bob, 10, 15); g.fillRect(x - 4, y + 3, 3, 4); g.fillRect(x + 1, y + 3, 3, 4);
    // piernas
    g.fillStyle = "#2b3a67"; g.fillRect(x - 3, y + 3 + Math.max(0, walk) * 1.5, 2, 3); g.fillRect(x + 1, y + 3 + Math.max(0, -walk) * 1.5, 2, 3);
    g.fillStyle = "#0b0b1e"; g.fillRect(x - 3, y + 5 + Math.max(0, walk) * 1.5, 2, 1); g.fillRect(x + 1, y + 5 + Math.max(0, -walk) * 1.5, 2, 1);
    // torso
    R(-4, -2, 8, 5, "#dfe9ff"); R(-4, 2, 8, 1, "#1b2a4a"); R(-4, -2, 1, 5, "#a9b8e6"); R(1, -1, 2, 2, "#00f0ff");
    // casco
    R(-4, -7, 8, 5, "#eef4ff"); R(-4, -7, 8, 1, "#ffffff"); R(-4, -3, 8, 1, "#9fb0dd");
    // visor (mira hacia donde apuntas)
    g.shadowColor = "#00f0ff"; g.shadowBlur = 6; g.fillStyle = "#00f0ff";
    if (fy_ < -0.6) { g.fillRect(x - 3, y - 7 + bob, 6, 1); } else g.fillRect(x - 1 + Math.round(fx_ * 2), y - 6 + bob + (fy_ > 0.6 ? 1 : 0), 4, 2);
    g.shadowBlur = 0;
    // antena
    g.fillStyle = "#ffd60a"; g.fillRect(x - 1 * flip, y - 9 + bob, 1, 2);
    // hoja de energía
    const bx = x + fx_ * 9, by = y + fy_ * 9 + bob;
    g.strokeStyle = "#7df9ff"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + fx_ * 4, y + fy_ * 4 + bob); g.lineTo(bx, by); g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 1; g.beginPath(); g.moveTo(x + fx_ * 4, y + fy_ * 4 + bob); g.lineTo(bx, by); g.stroke();
    if (mod("orbit")) for (let i = 0; i < mod("orbit"); i++) { const a = P.orbitA + i * 6.283 / mod("orbit"); g.fillStyle = "#7df9ff"; g.shadowColor = "#7df9ff"; g.shadowBlur = 6; g.fillRect(P.x + Math.cos(a) * 20 - 2, P.y + Math.sin(a) * 20 - 2, 4, 4); g.shadowBlur = 0; }
    if (mod("shield") && !P.shieldUsed) { g.strokeStyle = `rgba(125,249,255,${0.35 + 0.2 * Math.sin(time * 5)})`; g.beginPath(); g.arc(x, y, 11, 0, 7); g.stroke(); }
  }
  function drawEnemy(e, pal) {
    const x = e.x, y = e.y, r = e.r;
    if (e.spawnT > 0) { g.strokeStyle = e.def.color || "#fff"; g.globalAlpha = 0.7; g.beginPath(); g.arc(x, y, r * (1 + e.spawnT * 3), 0, 7); g.stroke(); g.globalAlpha = 1; if (Math.random() < 0.3) drawLightning(x, y - 30, x, y, e.def.color || "#fff", 0.6, Math.random() * 99); return; }
    g.fillStyle = "rgba(0,0,0,0.45)"; g.beginPath(); g.ellipse(x, y + r + 1, r, r * 0.35, 0, 0, 7); g.fill();
    let col = e.def.color || "#fff";
    if (e.hue) col = shiftHue(col, e.hue);
    if (e.flash > 0) col = "#ffffff";
    g.fillStyle = col; g.strokeStyle = col;
    if (e.elite) { g.shadowColor = "#ffd60a"; g.shadowBlur = 10; }
    if (e.kind === "boss") return drawBoss(e, pal, col);
    const k = e.kind;
    if (k === "chaser") { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * 0.628 + time * 6, rr = i % 2 ? r * 0.5 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
    else if (k === "turret") { g.fillRect(x - r, y - r, r * 2, r * 2); g.fillStyle = "#000"; g.fillRect(x - r + 2, y - r + 2, r * 2 - 4, r * 2 - 4); g.fillStyle = col; const a = ang(e, P); g.fillRect(x - 2, y - 2, 4, 4); g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4)); g.stroke(); g.lineWidth = 1; }
    else if (k === "splitter") { const w = Math.sin(time * 6 + x) * 1.5; g.beginPath(); g.ellipse(x, y, r + w, r - w, 0, 0, 7); g.fill(); g.fillStyle = "#fff"; g.fillRect(x - 3, y - 2, 2, 2); g.fillRect(x + 1, y - 2, 2, 2); }
    else if (k === "shooter") { g.save(); g.translate(x, y); g.rotate(time * 2); g.beginPath(); g.moveTo(0, -r); g.lineTo(r, 0); g.lineTo(0, r); g.lineTo(-r, 0); g.fill(); g.restore(); g.beginPath(); g.arc(x, y, r + 3, time * 4, time * 4 + 2); g.stroke(); }
    else if (k === "charger") { g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(x + Math.cos(i * 1.047) * r, y + Math.sin(i * 1.047) * r); g.fill(); const a = Math.atan2(e.vy, e.vx); g.strokeStyle = "#ffd60a"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 2, a - 0.7, a + 0.7); g.stroke(); g.lineWidth = 1;
      if (e.tele > 0) { g.strokeStyle = "rgba(255,77,109,0.8)"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(e.chargeDir) * 120, y + Math.sin(e.chargeDir) * 120); g.stroke(); } }
    else if (k === "blinker") { g.globalAlpha = 0.6 + 0.4 * Math.sin(time * 10); g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y + r); g.lineTo(x - r, y + r); g.fill(); g.globalAlpha = 1; g.fillStyle = "#000"; g.fillRect(x - 2, y, 4, 2); }
    else if (k === "bomber") { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = "#000"; g.fillRect(x - 1, y - 4, 2, 8); g.fillRect(x - 4, y - 1, 8, 2); }
    g.shadowBlur = 0;
    if (k !== "turret") { // contorno + ojos que te siguen
      g.strokeStyle = "rgba(0,0,0,0.7)"; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r + 0.5, 0, 7); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1;
      const ea = ang(e, P), ex = Math.cos(ea) * r * 0.35, ey = Math.sin(ea) * r * 0.35;
      g.fillStyle = "#fff"; g.fillRect(x + ex - 3, y + ey - 2, 2, 2); g.fillRect(x + ex + 1, y + ey - 2, 2, 2);
      g.fillStyle = e.act === 4 || e.charge > 0 || e.tele > 0 ? "#ff2a2a" : "#000"; g.fillRect(x + ex - 3 + Math.sign(ex), y + ey - 2, 1, 1); g.fillRect(x + ex + 1 + Math.sign(ex), y + ey - 2, 1, 1);
    }
    // ojos: acción de la IA (debug visual sutil)
    if (["turret", "shooter", "blinker", "bomber"].includes(k) && e.cd < 0.35 && e.cd > -0.5 && e.act === 4) { g.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(time * 30)})`; g.beginPath(); g.arc(x, y, r + 3 + Math.max(0, e.cd) * 10, 0, 7); g.stroke(); }
    if (e.hp < e.maxHp) { g.fillStyle = "#000"; g.fillRect(x - r, y - r - 4, r * 2, 2); g.fillStyle = "#ff4d6d"; g.fillRect(x - r, y - r - 4, r * 2 * clamp(e.hp / e.maxHp, 0, 1), 2); }
    if (e.elite) { g.fillStyle = "#ffd60a"; g.font = `5px ${FONT}`; g.textAlign = "center"; g.fillText(e.affixes ? e.affixes.join(" · ").toUpperCase() : "ÉLITE", x, y - r - 6); }
  }
  function drawBoss(e, pal, col) {
    const x = e.x, y = e.y, r = e.r + (e.phase === 2 ? 2 : 0);
    g.shadowColor = pal.glow; g.shadowBlur = 16;
    g.save(); g.translate(x, y);
    const b = e.boss;
    if (b === "inrush") { g.rotate(Math.atan2(P.y - y, P.x - x)); g.fillStyle = col; g.beginPath(); g.moveTo(r + 4, 0); g.lineTo(-r, -r); g.lineTo(-r * 0.6, 0); g.lineTo(-r, r); g.fill(); }
    else if (b === "choir") { for (let i = 0; i < 5; i++) { const a = time * 2 + i * 1.256; g.fillStyle = col; g.beginPath(); g.arc(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, 5, 0, 7); g.fill(); } g.beginPath(); g.arc(0, 0, r * 0.6, 0, 7); g.fill(); }
    else if (b === "ferro") { g.rotate(Math.sin(time * 3) * 0.5); g.fillStyle = col; g.beginPath(); g.moveTo(0, -r - 6); g.lineTo(r, r); g.lineTo(-r, r); g.fill(); g.fillStyle = "#000"; g.fillRect(-r + 4, -2, r * 2 - 8, 3); }
    else if (b === "hyper") { g.fillStyle = col; g.fillRect(-r, -r, r * 2, r * 2); g.fillStyle = "#000"; for (let i = 0; i < 4; i++) g.fillRect(-r + 3, -r + 3 + i * 6, r * 2 - 6, 3); g.fillStyle = (time * 4) % 2 < 1 ? "#0f0" : "#f00"; g.fillRect(r - 6, -r + 3, 2, 2); }
    else if (b === "titan") { g.fillStyle = col; g.beginPath(); g.moveTo(-r, r); g.lineTo(-r * 0.4, -r); g.lineTo(0, -r * 0.2); g.lineTo(r * 0.4, -r); g.lineTo(r, r); g.fill(); }
    else if (b === "twins") { g.rotate(time * (e.mirrorSide ? -2 : 2)); g.fillStyle = col; g.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.5 : r; g.lineTo(Math.cos(i * 0.785) * rr, Math.sin(i * 0.785) * rr); } g.fill(); }
    else if (b === "agent") { g.rotate(time * 0.8); g.fillStyle = col; g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(Math.cos(i * 1.047) * r, Math.sin(i * 1.047) * r); g.fill();
      g.fillStyle = "#000"; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((i + j + Math.floor(time * 3)) % 2 === 0) g.fillRect(i * 5 - 2, j * 5 - 2, 4, 4); }
    else { // blackout
      g.fillStyle = "#000"; g.beginPath(); g.arc(0, 0, r + 2, 0, 7); g.fill(); g.strokeStyle = pal.acc; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, r + 4 + i * 4, time * (i + 1), time * (i + 1) + 2.5); g.stroke(); } g.lineWidth = 1; }
    g.shadowBlur = 0;
    // ojos
    g.fillStyle = "#fff"; const ea = Math.atan2(P.y - y, P.x - x); g.fillRect(Math.cos(ea) * 4 - 4, Math.sin(ea) * 4 - 2, 3, 3); g.fillRect(Math.cos(ea) * 4 + 2, Math.sin(ea) * 4 - 2, 3, 3);
    g.restore();
    if (e.flash > 0) { g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    if (e.pat === "charge" && e.patData.tele > 0) { g.strokeStyle = "rgba(255,77,109,0.9)"; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(e.patData.a) * 300, y + Math.sin(e.patData.a) * 300); g.stroke(); g.setLineDash([]); }
  }
  function drawPylon(p, pal) { g.fillStyle = pal.wall; g.fillRect(p.x - 4, p.y - 12, 8, 16); g.fillStyle = p.on ? "#7df9ff" : "#444"; g.shadowColor = "#7df9ff"; g.shadowBlur = p.on ? 12 : 0; g.fillRect(p.x - 3, p.y - 16, 6, 5); g.shadowBlur = 0; if (!p.on && room.cleared) { g.font = `5px ${FONT}`; g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText("¡GOLPEA!", p.x, p.y - 20 + Math.sin(time * 6)); } }
  function drawNPC(n) { const x = n.x, y = n.y + Math.sin(time * 3); g.fillStyle = "#ffd60a"; g.fillRect(x - 4, y - 6, 8, 11); g.fillStyle = "#fff"; g.fillRect(x - 3, y - 9, 6, 4); g.fillStyle = "#000"; g.fillRect(x - 2, y - 8, 1, 1); g.fillRect(x + 1, y - 8, 1, 1); if (!room.cleared) { g.strokeStyle = "#ff4d6d"; g.strokeRect(x - 8, y - 12, 16, 20); } else if (!n.talked) { g.fillStyle = "#ffd60a"; g.font = `8px ${FONT}`; g.textAlign = "center"; g.fillText("!", x, y - 14); } }
  function drawTerm(t, pal) { g.fillStyle = "#222"; g.fillRect(t.x - 8, t.y - 10, 16, 18); g.fillStyle = pal.acc; g.fillRect(t.x - 6, t.y - 8, 12, 8); g.fillStyle = "#000"; for (let i = 0; i < 3; i++) g.fillRect(t.x - 5, t.y - 7 + i * 2 + ((time * 4) % 2 | 0), 6 + (i * 3) % 5, 1); }
  function drawPortal(p, pal) { for (let i = 0; i < 4; i++) { g.strokeStyle = i % 2 ? pal.acc : "#fff"; g.globalAlpha = 0.8; g.beginPath(); g.ellipse(p.x, p.y, 10 + i * 3 + Math.sin(time * 4 + i) * 2, 16 + i * 3, 0, time * (i + 1), time * (i + 1) + 4.5); g.stroke(); } g.globalAlpha = 1; }
  function shiftHue(hex, deg) {
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16) / 255, gg = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); let h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (gg - b) / d + (gg < b ? 6 : 0) : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4; h *= 60; }
    return `hsl(${(h + deg + 360) % 360},${Math.round(s * 100)}%,${Math.round(l * 100)}%)`;
  }

  function drawHUD(pal) {
    g.fillStyle = "#05050c"; g.fillRect(0, 0, VW, HUD); g.fillStyle = pal.acc; g.fillRect(0, HUD - 1, VW, 1);
    // vida
    if (P.maxHp <= 18) { for (let i = 0; i < P.maxHp / 2; i++) { const v = P.hp - i * 2; drawHeart(4 + i * 10, 3, v >= 2 ? 2 : v === 1 ? 0.5 : 0, "#ff4d6d"); } }
    else { drawHeart(4, 3, 2, "#ff4d6d"); g.font = `6px ${FONT}`; g.textAlign = "left"; g.fillStyle = "#ff8fa3"; g.fillText(`${P.hp}/${P.maxHp}`, 15, 9); }
    // energía
    g.fillStyle = "#1a1a33"; g.fillRect(4, 12, 60, 4); g.fillStyle = "#4cc9f0"; g.fillRect(4, 12, 60 * P.energy / P.maxEnergy, 4);
    // xp
    g.fillStyle = "#1a1a33"; g.fillRect(4, 18, 60, 3); g.fillStyle = "#ffd60a"; g.fillRect(4, 18, 60 * run.xp / run.xpNext, 3);
    g.font = `6px ${FONT}`; g.textAlign = "left"; g.fillStyle = "#fff";
    g.fillText(`LV${run.level}`, 68, 21);
    g.fillStyle = "#7df9ff"; g.fillText(`⚡${run.electrons}`, 100, 10);
    g.fillStyle = "#c77dff"; g.fillText("◆".repeat(run.cores) + "◇".repeat(Math.max(0, 3 - run.cores)), 100, 20);
    // reino / ciclo
    g.fillStyle = pal.acc; g.textAlign = "center"; g.fillText(W.REALMS[run.realm].name.toUpperCase(), 210, 9);
    g.fillStyle = "#aaa"; const s = NX.state();
    g.fillText(`CICLO ${run.cycle + 1} · ENTROPÍA ${Math.round(room.D || s.floor)}`, 210, 19);
    if (run.combo > 2) { g.fillStyle = "#ffd60a"; g.font = `8px ${FONT}`; g.textAlign = "right"; g.fillText(`×${run.combo}`, 300, 20 - Math.min(3, run.combo / 10)); }
    // minimapa
    const ms = 4, ox = VW - 7 * (ms + 1) - 4, oy = 1;
    run.dungeon.rooms.forEach(r => {
      if (!r.visited && !run.dungeon.rooms.some(o => o.visited && Math.abs(o.x - r.x) + Math.abs(o.y - r.y) === 1)) return;
      g.fillStyle = r === room ? "#fff" : !r.visited ? "#333" : r.type === "boss" ? "#ff4d6d" : r.type === "elite" ? "#ffd60a" : r.type === "shrine" ? "#06d6a0" : r.type === "npc" ? "#4cc9f0" : r.type === "pylon" ? "#7df9ff" : pal.wall;
      g.fillRect(ox + r.x * (ms + 1), oy + r.y * (ms + 1) * 0.75, ms, ms * 0.75 + 0.5);
      if (r.type === "boss" && (r.visited || run.bossOpen)) { g.fillStyle = "#ff4d6d"; g.fillRect(ox + r.x * (ms + 1) + 1, oy + r.y * (ms + 1) * 0.75 + 1, 2, 1); }
    });
    // mutadores activos
    if (run.mutators.length) { g.font = `5px ${FONT}`; g.textAlign = "left"; g.fillStyle = "#ff4d6d"; g.globalAlpha = 0.85; g.fillText("☣ " + run.mutators.map(m => m.name).join(" · "), 4, VH - 4); g.globalAlpha = 1; }
    // barra de jefe
    const boss = enemies.find(e => e.kind === "boss");
    if (boss) { const bw = 220, bx = (VW - bw) / 2, by = VH - 14; const hp = enemies.filter(e => e.kind === "boss").reduce((a, e) => a + Math.max(0, e.hp), 0), mx = enemies.filter(e => e.kind === "boss").reduce((a, e) => a + e.maxHp, 0);
      g.fillStyle = "#000"; g.fillRect(bx - 1, by - 1, bw + 2, 6); g.fillStyle = "#ff4d6d"; g.fillRect(bx, by, bw * hp / mx, 4); g.font = `5px ${FONT}`; g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(boss.def.name, VW / 2, by - 3); }
  }
  function drawBanner(pal) {
    const a = clamp(banner.t, 0, 1);
    g.globalAlpha = a; g.fillStyle = "rgba(0,0,0,0.65)"; g.fillRect(0, 70, VW, 56);
    g.fillStyle = pal.acc; g.fillRect(0, 70, VW, 1); g.fillRect(0, 125, VW, 1);
    g.textAlign = "center"; g.font = `10px ${FONT}`; g.fillStyle = "#000"; g.fillText(banner.title, VW / 2 + 1, 90 + 1); g.fillStyle = "#fff"; g.fillText(banner.title, VW / 2, 90);
    g.font = `6px ${FONT}`; g.fillStyle = pal.glow; g.fillText(banner.sub, VW / 2, 104);
    if (banner.sub2) { g.fillStyle = "#ff8fa3"; g.font = `5px ${FONT}`; g.fillText(banner.sub2.slice(0, 80), VW / 2, 116); }
    g.globalAlpha = 1;
  }

  /* ================= UI DOM ================= */
  function showUI(which) {
    document.querySelectorAll(".screen").forEach(s => s.classList.toggle("show", s.id === "scr-" + which));
    document.body.dataset.mode = which;
  }
  let toastT; function toast(s) { const el = $("#toast"); el.textContent = s; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2200); }
  function openPause() {
    mode = "menu"; showUI("pause");
    const Q = run.quests;
    $("#questLog").innerHTML = `
      <li class="${run.bossDead ? "ok" : ""}">☠ Principal: reúne 3 Núcleos (${run.cores}/3) y derrota a <b>${W.REALMS[run.realm].bossName}</b></li>
      <li class="${Q.rescue ? "ok" : ""}">🧑‍🔬 Rescata al investigador perdido ${Q.rescue ? "✔" : ""}</li>
      <li class="${Q.pylonsDone ? "ok" : ""}">⚡ Calibra 3 pilones (${Q.pylons}/3)</li>
      <li class="${Q.huntDone ? "ok" : ""}">🎯 Cacería: ${W.ENEMIES[Q.huntType].name} (${Math.min(Q.hunt, Q.huntGoal)}/${Q.huntGoal})</li>`;
    $("#modList").innerHTML = Object.entries(run.mods).map(([id, n]) => { const m = W.MODS.find(x => x.id === id); return `<span title="${m.desc}">${m.icon} ${m.name}${n > 1 ? " ×" + n : ""}</span>`; }).join("") || "<i>Sin mods aún</i>";
    $("#mutList").innerHTML = run.mutators.map(m => `<li><b>${m.name}</b>: ${m.desc}</li>`).join("") || "<li>Ninguna</li>";
  }
  function openNexus(fromGame) {
    if (fromGame) mode = "menu";
    const s = NX.state(), p = NX.profile();
    const types = Object.keys(W.ENEMIES);
    $("#nexusBody").innerHTML = `
      <div class="nx-grid">
        <div class="nx-card"><h4>📈 Rating de habilidad (Elo)</h4><div class="big">${Math.round(s.skill)}</div><small>Salas jugadas: ${s.roomsPlayed} · Sesiones: ${s.sessions}</small></div>
        <div class="nx-card"><h4>🔒 Piso de Entropía</h4><div class="big">${Math.round(s.floor)}</div><small>Nunca baja. Sube cada sesión y cada reino superado.</small></div>
        <div class="nx-card"><h4>🧠 Tu perfil</h4><small>Estilo: <b>${p.style}</b><br>Precisión: ${(p.acc * 100).toFixed(0)}% · Dash/min: ${p.dashRate.toFixed(1)}<br>Esquiva favorita: <b>${p.dodgeDir}</b> · Agresividad: ${(p.aggression * 100).toFixed(0)}%<br>Némesis: <b>${p.nemesis}</b></small></div>
      </div>
      <h4>🧬 Evolución por especie (Q-learning + Algoritmo Genético + Bandido)</h4>
      <table class="nx-table"><tr><th>Especie</th><th>Gen.</th><th>Vel</th><th>Vida</th><th>Cadencia</th><th>Experiencias</th><th>ε</th><th>Táctica dominante</th><th>Amenaza</th></tr>
      ${types.map(t => { const gs = NX.gaStats(t), q = NX.qStats(t), b = s.bandit[t] || [1, 1]; const top = q.policy.indexOf(Math.max(...q.policy));
        return `<tr><td>${W.ENEMIES[t].name}</td><td>${gs.gen}</td><td>${gs.spd.toFixed(2)}</td><td>${gs.hp.toFixed(2)}</td><td>${gs.rate.toFixed(2)}</td><td>${q.visits}</td><td>${q.eps.toFixed(2)}</td><td>${NX.ACTION_NAMES[top]}</td><td>${(b[0] / (b[0] + b[1]) * 100).toFixed(0)}%</td></tr>`; }).join("")}
      </table>
      <h4>📜 Bitácora de NEXUS</h4><ul class="nx-log">${s.log.slice(0, 12).map(l => `<li>${l.msg}</li>`).join("") || "<li>NEXUS aún te observa…</li>"}</ul>`;
    showUI("nexus");
  }
  function openHub() {
    mode = "hub"; showUI("hub"); AU.playSong(1234, { scale: "lydian", intensity: 0.5, bpm: 100 });
    $("#hubResearch").textContent = META.research;
    { const sv = savedRun(); const b = $("#btnContinue"); b.hidden = !sv; if (sv) b.textContent = `▶ CONTINUAR (${W.REALMS[sv.run.realm].name}${sv.run.cycle ? " · C" + (sv.run.cycle + 1) : ""} · Nv ${sv.run.level})`; }
    $("#upgrades").innerHTML = W.UPGRADES.map(u => { const l = upLvl(u.id), cost = Math.round(u.base * Math.pow(1.6, l)); return `<button class="up" data-up="${u.id}" ${l >= u.max || META.research < cost ? "disabled" : ""}><b>${u.name}</b><small>${u.desc}</small><span class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? "on" : ""}"></i>`).join("")}</span><em>${l >= u.max ? "MÁX" : "🧪 " + cost}</em></button>`; }).join("");
    $("#realmSel").innerHTML = W.REALMS.map((r, i) => `<option value="${i}" ${i >= META.unlocked ? "disabled" : ""}>${i + 1}. ${r.name}${i >= META.unlocked ? " 🔒" : ""}</option>`).join("");
    $("#achList").innerHTML = ACH.map(a => `<div class="ach ${META.ach[a.id] ? "got" : ""}" title="${a.d}"><span>${a.i}</span><b>${a.n}</b><small>${a.d}</small></div>`).join("");
    $("#achCount").textContent = `${Object.keys(META.ach).length}/${ACH.length}`;
    $("#hubStats").innerHTML = `Runs: ${META.runs} · Muertes: ${META.deaths} · Eliminaciones: ${META.kills} · Mejor ciclo: ${META.bestCycle + 1} · Récord: ${META.highScore} · Tiempo: ${Math.round(META.playSec / 60)} min`;
    $("#codex").innerHTML = W.REALMS.map(r => `<details ${META.codex[r.boss] === "known" ? "" : "class='locked'"}><summary>${META.codex[r.boss] === "known" ? "📘" : META.codex[r.boss] ? "👁️" : "🔒"} ${META.codex[r.boss] ? r.bossName : "???"} ${META.bosses[r.boss] ? `· derrotado ×${META.bosses[r.boss]}` : ""}</summary><p>${META.codex[r.boss] === "known" ? r.codex : "Derrota a este villano para desbloquear su registro de investigación."}</p></details>`).join("");
  }
  $("#upgrades").addEventListener("click", e => { const b = e.target.closest("[data-up]"); if (!b) return; const u = W.UPGRADES.find(x => x.id === b.dataset.up), l = upLvl(u.id), cost = Math.round(u.base * Math.pow(1.6, l)); if (META.research >= cost && l < u.max) { META.research -= cost; META.up[u.id] = l + 1; saveMeta(); AU.sfx("level"); openHub(); } });

  /* botones */
  const on = (id, fn) => $(id).addEventListener("click", () => { AU.init(); AU.sfx("ui"); fn(); });
  on("#btnStart", () => { if (!META.seenIntro) { META.seenIntro = true; saveMeta(); showUI("intro"); } else openHub(); });
  on("#btnIntroGo", () => openHub());
  on("#btnPlay", () => { if (savedRun() && !confirm("Tienes una run guardada. ¿Empezar una nueva y perderla?")) return; clearRun(); newRun(+$("#realmSel").value || 0); });
  on("#btnContinue", () => { if (!loadRun()) toast("No hay run guardada"); });
  on("#btnDaily", () => { const d = new Date(); newRun(0, `daily-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`); toast("🗓️ Desafío diario: misma semilla para todos hoy"); });
  on("#btnHubNexus", () => openNexus(false));
  on("#btnNexusClose", () => { if (run && mode === "menu") { mode = "play"; showUI("play"); } else openHub(); });
  on("#btnResume", () => { mode = "play"; showUI("play"); });
  on("#btnPauseNexus", () => openNexus(true));
  on("#btnAbandon", () => { if (confirm("¿Abandonar la run? Conservas los datos de investigación ganados.")) { P.hp = 0; mode = "play"; die(); } });
  on("#btnSaveQuit", () => { saveRun(); openHub(); toast("💾 Run guardada"); });
  on("#btnDeadHub", () => openHub());
  on("#btnDeadRetry", () => newRun(Math.min(run.realm, META.unlocked - 1)));
  on("#btnHowto", () => showUI("howto"));
  on("#btnHowtoBack", () => openHub());
  on("#btnPauseBtn", () => { if (mode === "play") openPause(); });
  $("#optMusic").checked = META.music; $("#optSfx").checked = META.sfx; $("#optShake").checked = META.shake;
  AU.setMusic(META.music); AU.setSfx(META.sfx);
  $("#optMusic").onchange = e => { META.music = e.target.checked; AU.setMusic(META.music); saveMeta(); };
  $("#optSfx").onchange = e => { META.sfx = e.target.checked; AU.setSfx(META.sfx); saveMeta(); };
  $("#optShake").onchange = e => { META.shake = e.target.checked; saveMeta(); };
  on("#btnResetAI", () => { if (confirm("Esto borra TODO lo que NEXUS aprendió de ti. ¿Seguro?")) { NX.reset(); toast("NEXUS reiniciado… por ahora."); openNexus(false); } });
  on("#btnFull", () => { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); try { screen.orientation.lock("landscape").catch(() => {}); } catch {} });

  /* ================= LOOP ================= */
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === "play") update(dt); else readInput();
    if (mode === "play" || mode === "menu" || mode === "dead") render();
    else renderTitle(dt);
    requestAnimationFrame(frame);
  }
  // pantalla de título animada en el canvas
  const tstars = Array.from({ length: 80 }, () => ({ x: Math.random() * VW, y: Math.random() * VH, z: Math.random() }));
  function renderTitle(dt) {
    time += dt; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#04030c"; g.fillRect(0, 0, VW, VH);
    // rejilla synthwave
    g.strokeStyle = "rgba(255,0,200,0.35)"; for (let i = 0; i < 14; i++) { const y = 130 + Math.pow(i / 14, 2) * 90 + ((time * 20) % 6); g.beginPath(); g.moveTo(0, y); g.lineTo(VW, y); g.stroke(); }
    for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(VW / 2 + i * 6, 130); g.lineTo(VW / 2 + i * 60, VH); g.stroke(); }
    tstars.forEach(s => { s.x -= (s.z + 0.2) * 20 * dt; if (s.x < 0) s.x = VW; g.fillStyle = `rgba(255,255,255,${s.z})`; g.fillRect(s.x, s.y * 0.6, 1, 1); });
    // sol
    const gr = g.createLinearGradient(0, 40, 0, 130); gr.addColorStop(0, "#ffd60a"); gr.addColorStop(1, "#ff00c8"); g.fillStyle = gr; g.beginPath(); g.arc(VW / 2, 120, 48, Math.PI, 0); g.fill();
    g.fillStyle = "#04030c"; for (let i = 0; i < 6; i++) g.fillRect(VW / 2 - 50, 85 + i * 7, 100, 1 + i * 0.6);
    if (Math.random() < 0.08) drawLightning(rnd(0, VW), 0, rnd(0, VW), rnd(60, 130), "#7df9ff", 1, Math.random() * 99);
  }

  NX.newSession();
  showUI("title");
  requestAnimationFrame(frame);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  window.__RV = { get run() { return run; }, get P() { return P; }, get curRoom() { return room; }, dbg: { elite: (t) => spawnEnemy(t || "knight", NX.scale(1200), 1200, true), chest: () => pickups.push({ kind: "chest", x: P.x + 20, y: P.y, vx: 0, vy: 0, t: 0 }) }, goBoss() { run.bossOpen = true; P.x = VW / 2; P.y = RH * T - 30; enterRoom(run.dungeon.boss, -1); }, get enemies() { return enemies; }, newRun, openHub, NX };
})();
