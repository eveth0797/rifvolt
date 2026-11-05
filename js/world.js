/* =========================================================
   RIFTVOLT — Mundo: reinos, villanos, generación procedural
   ========================================================= */
(() => {
  const TILE = 16, RW = 24, RH = 12;
  const W = {};
  W.TILE = TILE; W.RW = RW; W.RH = RH;

  /* ---------- RNG con semilla ---------- */
  W.rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  W.hash = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  /* ---------- REINOS / VILLANOS ---------- */
  W.REALMS = [
    { id: "sub0", name: "Subestación Cero", sub: "Donde la red despertó", boss: "inrush", bossName: "INRUSH, la Bestia Magnetizante",
      pal: { bg: "#06070f", floor: "#10142a", floor2: "#141a36", wall: "#2a2f6b", top: "#4b56c9", acc: "#4cc9f0", glow: "#7df9ff" },
      enemies: ["spark", "turret", "slime"], hazard: 0.02, scale: "minor",
      codex: "INRUSH — Al energizar un transformador, el flujo residual en el núcleo puede llevarlo a saturación y la corriente de magnetización se dispara hasta 8-12× la nominal, rica en 2º armónico. Las protecciones diferenciales usan ese 2º armónico para no disparar en falso. Cerrar en el ángulo correcto de tensión (controlled switching) lo reduce." },
    { id: "harm", name: "Pantanos Armónicos", sub: "El ruido tiene forma", boss: "choir", bossName: "EL CORO ARMÓNICO",
      pal: { bg: "#050d0b", floor: "#0c1f1a", floor2: "#0f2721", wall: "#1d5a46", top: "#2fbf8f", acc: "#06d6a0", glow: "#9dffdf" },
      enemies: ["spark", "drone", "slime", "turret"], hazard: 0.05, scale: "dorian",
      codex: "ARMÓNICOS — Rectificadores de UPS y fuentes de servidores inyectan corrientes del 5º, 7º, 11º, 13º orden. Si coinciden con una resonancia paralelo entre capacitores y la inductancia de la red, la distorsión se amplifica. IEEE 519 limita el THD en el punto de acoplamiento común." },
    { id: "ferro", name: "Cavernas Ferro", sub: "El caos tiene memoria", boss: "ferro", bossName: "FERRORESONA, la Bruja Caótica",
      pal: { bg: "#0d0610", floor: "#1d0f24", floor2: "#24122d", wall: "#5a1d6b", top: "#b14be0", acc: "#f15bb5", glow: "#ffb3f0" },
      enemies: ["phantom", "slime", "drone", "spark"], hazard: 0.04, scale: "phryg",
      codex: "FERRORESONANCIA — Una capacitancia (cable, interruptor abierto con capacitor de gradiente) en serie con la inductancia no lineal de un transformador puede saltar a estados estables caóticos con sobretensiones sostenidas. Pequeños cambios en condiciones iniciales → respuestas totalmente distintas. Es determinista… pero impredecible." },
    { id: "dc", name: "Laberinto Hyperscale", sub: "Cada rack es una mente", boss: "hyper", bossName: "EL HYPERSCALER TÉRMICO",
      pal: { bg: "#03080d", floor: "#0a1520", floor2: "#0d1b29", wall: "#1c3c5a", top: "#3a86c8", acc: "#00b4ff", glow: "#a8e6ff" },
      enemies: ["knight", "turret", "drone", "bomber"], hazard: 0.03, scale: "minor",
      codex: "CARGAS DE DATA CENTER — Los centros de datos de IA cambian su consumo en milisegundos (sincronía de GPUs en entrenamiento). Esas oscilaciones de potencia pueden excitar modos de control de la red e interacciones con plantas IBR. La ride-through de UPS y la curva ITIC definen qué huecos de tensión toleran los servidores." },
    { id: "light", name: "Altiplano del Rayo", sub: "El cielo descarga", boss: "titan", bossName: "TITÁN DEL IMPACTO",
      pal: { bg: "#0d0b03", floor: "#1f1a08", floor2: "#26200b", wall: "#6b5a1d", top: "#e0c34b", acc: "#ffd60a", glow: "#fff3a8" },
      enemies: ["bomber", "spark", "turret", "knight"], hazard: 0.06, scale: "harm",
      codex: "SOBRETENSIONES ATMOSFÉRICAS — Un rayo directo o un back-flashover en una torre inyecta ondas viajeras de frente rápido (µs). Se reflejan en discontinuidades (transformadores, cables) y pueden duplicar la tensión. La coordinación de aislamiento y los pararrayos (ubicación + distancia de separación) protegen el equipo." },
    { id: "inv", name: "Yermo de Inversores", sub: "Te imitan para vencerte", boss: "twins", bossName: "LOS GEMELOS EN FASE",
      pal: { bg: "#0b0405", floor: "#1e0b0e", floor2: "#260e12", wall: "#6b1d26", top: "#e04b5c", acc: "#ff4d6d", glow: "#ffb3c0" },
      enemies: ["knight", "phantom", "drone", "bomber", "spark"], hazard: 0.04, scale: "harm",
      codex: "IBR / GRID-FOLLOWING vs GRID-FORMING — Los inversores grid-following siguen la fase de la red con un PLL; en redes débiles (SCR bajo) pueden oscilar. Los grid-forming crean su propia referencia de tensión como una máquina virtual. Dos controles que se 'persiguen' pueden generar interacciones de control (SSCI)." },
    { id: "feeder", name: "Alimentador 123", sub: "Un agente aprendió a restaurar… y a cazar", boss: "agent", bossName: "PPO-Ω, el Agente Enmascarado",
      pal: { bg: "#020a0a", floor: "#071a1c", floor2: "#0a2225", wall: "#145a5e", top: "#2fd1c8", acc: "#00e5d4", glow: "#a8fff7" },
      enemies: ["drone", "knight", "turret", "phantom", "spark"], hazard: 0.03, scale: "dorian",
      codex: "RESTAURACIÓN CON RL — Tras una falla, un agente de aprendizaje por refuerzo decide qué interruptores cerrar para re-energizar cargas críticas usando almacenamiento grid-forming como fuente. Con Maskable PPO, las acciones inválidas (líneas fallidas o prohibidas, maniobras que violan restricciones) se enmascaran antes de muestrear la política: el agente nunca las intenta y aprende más rápido. En este universo, PPO-Ω enmascara TUS movimientos: solo te deja las casillas que él elige." },
    { id: "core", name: "Núcleo del Apagón", sub: "Todo lo que aprendió de ti", boss: "blackout", bossName: "EL APAGÓN — Espejo de Entropía",
      pal: { bg: "#000000", floor: "#0b0b12", floor2: "#101018", wall: "#2b2b3d", top: "#8a8aff", acc: "#c77dff", glow: "#e0c3ff" },
      enemies: ["knight", "phantom", "drone", "bomber", "turret", "spark", "slime"], hazard: 0.05, scale: "phryg",
      codex: "BLACKOUT — Un apagón es una cascada: una falla, protecciones que operan, flujos que se redistribuyen, sobrecargas, pérdida de sincronismo, deslastre insuficiente… El black start requiere unidades capaces de formar red sin referencia externa. En este universo, el Apagón aprendió cada uno de tus movimientos." }
  ];

  /* ---------- ESPECIES ENEMIGAS ---------- */
  W.ENEMIES = {
    spark:   { name: "Chispa",         hp: 18, spd: 70, r: 5,  dmg: 1, cost: 1,   color: "#ffd60a", kind: "chaser",  xp: 3 },
    turret:  { name: "Torreta de Arco",hp: 30, spd: 0,  r: 7,  dmg: 1, cost: 1.5, color: "#ff9f1c", kind: "turret",  xp: 4, fire: 1.6 },
    slime:   { name: "Gel de Surge",   hp: 34, spd: 38, r: 7,  dmg: 1, cost: 1.5, color: "#06d6a0", kind: "splitter",xp: 4 },
    drone:   { name: "Dron Armónico",  hp: 26, spd: 55, r: 6,  dmg: 1, cost: 2,   color: "#4cc9f0", kind: "shooter", xp: 5, fire: 1.9 },
    knight:  { name: "Caballero Breaker", hp: 60, spd: 48, r: 8, dmg: 2, cost: 3,  color: "#e0e0ff", kind: "charger", xp: 8 },
    phantom: { name: "Carga Fantasma", hp: 28, spd: 60, r: 6,  dmg: 1, cost: 2.5, color: "#c77dff", kind: "blinker", xp: 6, fire: 2.2 },
    bomber:  { name: "Condensador Volátil", hp: 40, spd: 45, r: 7, dmg: 2, cost: 2.5, color: "#ff4d6d", kind: "bomber", xp: 6, fire: 2.6 }
  };

  /* ---------- MODS (cartas de subida de nivel) ---------- */
  W.MODS = [
    { id: "dmg",     name: "Sobrecorriente",    icon: "⚔️", rar: 0, desc: "+20% daño" },
    { id: "aspd",    name: "Recierre Rápido",   icon: "⏩", rar: 0, desc: "+18% velocidad de ataque" },
    { id: "hp",      name: "Aislamiento Extra", icon: "❤️", rar: 0, desc: "+2 vida máx. y cura 2" },
    { id: "speed",   name: "Superconductor",    icon: "👟", rar: 0, desc: "+10% velocidad de movimiento" },
    { id: "energy",  name: "Banco de Baterías", icon: "🔋", rar: 0, desc: "+25 energía máx. y regeneración" },
    { id: "multi",   name: "Rayo Trifásico",    icon: "🔱", rar: 1, desc: "Los rayos se dividen en 3" },
    { id: "pierce",  name: "Onda Viajera",      icon: "➰", rar: 1, desc: "Los rayos atraviesan +1 enemigo" },
    { id: "chain",   name: "Arco en Cadena",    icon: "⛓️", rar: 1, desc: "20% de probabilidad de encadenar rayos a 2 enemigos" },
    { id: "crit",    name: "Pico de Tensión",   icon: "💥", rar: 0, desc: "+12% probabilidad de crítico (×2)" },
    { id: "leech",   name: "Regeneración",      icon: "🩸", rar: 1, desc: "15% de curar 1 al eliminar" },
    { id: "trail",   name: "Estela de Plasma",  icon: "🔥", rar: 1, desc: "El dash deja una estela que daña" },
    { id: "orbit",   name: "Electrón Orbital",  icon: "🪐", rar: 1, desc: "Un electrón gira a tu alrededor y daña" },
    { id: "magnet",  name: "Campo Magnético",   icon: "🧲", rar: 0, desc: "Atraes electrones desde más lejos" },
    { id: "ohm",     name: "Ley de Ohm",        icon: "Ω",  rar: 2, desc: "+5% daño por cada vida que te falte" },
    { id: "nova",    name: "Descarga Nova",     icon: "🌟", rar: 2, desc: "Al recibir daño, liberas una nova eléctrica" },
    { id: "dashcd",  name: "Capacitor Rápido",  icon: "⚡", rar: 0, desc: "-20% enfriamiento del dash" },
    { id: "range",   name: "Hoja Extendida",    icon: "🗡️", rar: 0, desc: "+20% alcance del ataque cuerpo a cuerpo" },
    { id: "shield",  name: "Pararrayos",        icon: "🛡️", rar: 2, desc: "Bloquea 1 golpe por sala" }
  ];

  /* ---------- MEJORAS PERMANENTES (Laboratorio) ---------- */
  W.UPGRADES = [
    { id: "hp",     name: "Blindaje Dieléctrico", desc: "+1 vida máxima",          base: 30, max: 8 },
    { id: "dmg",    name: "Calibración de Hoja",  desc: "+8% daño",                base: 35, max: 10 },
    { id: "energy", name: "Supercapacitores",     desc: "+10 energía máx.",        base: 25, max: 6 },
    { id: "dash",   name: "Bobina de Dash",       desc: "-6% enfriamiento de dash", base: 30, max: 6 },
    { id: "luck",   name: "Intuición Cuántica",   desc: "+1 opción de carta rara", base: 50, max: 4 },
    { id: "reroll", name: "Re-simulación",        desc: "+1 re-tirada de cartas por run", base: 60, max: 3 },
    { id: "start",  name: "Kit Inicial",          desc: "Empiezas cada run con 1 mod", base: 80, max: 2 }
  ];

  /* ---------- Generación de un reino (mazmorra) ---------- */
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // E S O N
  W.DIRS = DIRS;
  W.genRealm = (realmIdx, cycle, seed) => {
    const R = W.rng(seed);
    const G = 7, nRooms = Math.min(18, 9 + realmIdx + cycle * 2);
    const grid = {}; const key = (x, y) => x + "," + y;
    let cx = 3, cy = 3; grid[key(cx, cy)] = { x: cx, y: cy };
    let guard = 0;
    while (Object.keys(grid).length < nRooms && guard++ < 5000) {
      const all = Object.values(grid); const from = R() < 0.6 ? all[all.length - 1] : all[Math.floor(R() * all.length)];
      const d = DIRS[Math.floor(R() * 4)]; const nx = from.x + d[0], ny = from.y + d[1];
      if (nx < 0 || ny < 0 || nx >= G || ny >= G || grid[key(nx, ny)]) continue;
      // evitar bloques demasiado densos
      const neigh = DIRS.filter(dd => grid[key(nx + dd[0], ny + dd[1])]).length;
      if (neigh > 2 && R() < 0.7) continue;
      grid[key(nx, ny)] = { x: nx, y: ny };
    }
    const rooms = Object.values(grid);
    rooms.forEach(r => { r.doors = DIRS.map(d => !!grid[key(r.x + d[0], r.y + d[1])]); r.cleared = false; r.visited = false; r.type = "normal"; });
    // BFS distancias
    const start = grid[key(3, 3)]; start.type = "start";
    const dist = { [key(3, 3)]: 0 }; const q = [start];
    while (q.length) { const r = q.shift(); DIRS.forEach((d, i) => { if (!r.doors[i]) return; const k = key(r.x + d[0], r.y + d[1]); if (dist[k] === undefined) { dist[k] = dist[key(r.x, r.y)] + 1; q.push(grid[k]); } }); }
    rooms.forEach(r => (r.dist = dist[key(r.x, r.y)]));
    const byDist = rooms.filter(r => r !== start).sort((a, b) => b.dist - a.dist);
    // jefe: la más lejana con 1 sola puerta si es posible
    const boss = byDist.find(r => r.doors.filter(Boolean).length === 1) || byDist[0]; boss.type = "boss";
    const pool = byDist.filter(r => r !== boss);
    const take = (type, n, pref) => { for (let i = 0; i < n && pool.length; i++) { const idx = pref === "far" ? 0 : pref === "near" ? pool.length - 1 : Math.floor(R() * pool.length); const r = pool.splice(idx, 1)[0]; r.type = type; } };
    take("elite", 3, "far"); take("npc", 1); take("shrine", 1, "near"); take("pylon", 3);
    rooms.forEach(r => { r.layout = W.genLayout(R, r, realmIdx); });
    const hunt = W.REALMS[realmIdx].enemies[Math.floor(R() * W.REALMS[realmIdx].enemies.length)];
    return { grid, rooms, start, boss, key, seed, huntType: hunt, huntGoal: 10 + realmIdx * 2 + cycle * 4 };
  };

  /* ---------- Layout de una sala ---------- */
  W.genLayout = (R, room, realmIdx) => {
    const t = new Uint8Array(RW * RH);
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < RW && y < RH) t[y * RW + x] = v; };
    for (let x = 0; x < RW; x++) { set(x, 0, 1); set(x, RH - 1, 1); }
    for (let y = 0; y < RH; y++) { set(0, y, 1); set(RW - 1, y, 1); }
    // puertas (huecos) – E S O N
    const doorCells = [[[RW - 1, 5], [RW - 1, 6]], [[11, RH - 1], [12, RH - 1]], [[0, 5], [0, 6]], [[11, 0], [12, 0]]];
    room.doorCells = doorCells;
    room.doors.forEach((open, i) => { if (open) doorCells[i].forEach(([x, y]) => set(x, y, 0)); });
    if (room.type === "start" || room.type === "shrine" || room.type === "npc") {
      // salas tranquilas: decoración simétrica
      [[4, 3], [19, 3], [4, 8], [19, 8]].forEach(([x, y]) => set(x, y, 4));
      return t;
    }
    if (room.type === "boss") { [[3, 3], [20, 3], [3, 8], [20, 8]].forEach(([x, y]) => set(x, y, 1)); return t; }
    const pat = Math.floor(R() * 8);
    const sym = (x, y, v) => { set(x, y, v); set(RW - 1 - x, y, v); set(x, RH - 1 - y, v); set(RW - 1 - x, RH - 1 - y, v); };
    switch (pat) {
      case 0: for (let x = 4; x < 10; x += 3) for (let y = 3; y < 5; y += 2) sym(x, y, 1); break;           // pilares
      case 1: for (let x = 8; x < 16; x++) { set(x, 3, 1); set(x, 8, 1); } break;                          // barras
      case 2: for (let y = 3; y <= 8; y++) { if (y < 5 || y > 6) { set(6, y, 1); set(17, y, 1); } } break; // columnas
      case 3: sym(3, 3, 1); sym(4, 3, 1); sym(3, 4, 1); sym(8, 4, 1); sym(9, 4, 1); break;                   // esquinas
      case 4: for (let x = 9; x <= 14; x++) for (let y = 3; y <= 8; y++) if ((x < 11 || x > 12) && (y < 5 || y > 6)) set(x, y, 1); break; // bloque central partido
      case 5: for (let i = 0; i < 10; i++) { const x = 2 + Math.floor(R() * 20), y = 2 + Math.floor(R() * 8); set(x, y, R() < 0.5 ? 1 : 4); } break; // disperso
      case 6: for (let x = 3; x < RW - 3; x += 2) { if (x === 11 || x === 12) continue; set(x, 3, 4); set(x, 8, 4); } break; // fila de pilones
      default: break; // abierta
    }
    // charcos eléctricos
    const hz = W.REALMS[realmIdx].hazard;
    for (let y = 2; y < RH - 2; y++) for (let x = 2; x < RW - 2; x++) if (!t[y * RW + x] && R() < hz) { set(x, y, 2); if (R() < 0.5) set(x + 1, y, 2); }
    // corredores despejados (garantiza conectividad)
    for (let x = 1; x < RW - 1; x++) { if (t[5 * RW + x] !== 2) set(x, 5, 0); if (t[6 * RW + x] !== 2) set(x, 6, 0); }
    for (let y = 1; y < RH - 1; y++) { set(11, y, 0); set(12, y, 0); }
    for (let x = 1; x <= 2; x++) for (let y = 4; y <= 7; y++) { set(x, y, 0); set(RW - 1 - x, y, 0); }
    for (let y = 1; y <= 2; y++) for (let x = 10; x <= 13; x++) { set(x, y, 0); set(x, RH - 1 - y, 0); }
    return t;
  };

  W.solid = v => v === 1 || v === 4 || v === 9;

  window.RVWorld = W;
})();
