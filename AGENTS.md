# Guía de desarrollo de RIFTVOLT (para LLMs y personas)

Lee este archivo completo antes de modificar el juego. Está pensado para que cualquier asistente de IA continúe el desarrollo sin contexto previo.

## 1. Qué es
Action-RPG roguelite top-down (estilo Zelda) en un **universo paralelo eléctrico**. Una IA llamada **NEXUS** aprende de cómo juegas y hace que cada partida sea más difícil (la dificultad nunca baja). Es JavaScript puro sobre un canvas de 384×216 escalado en pixel art, sin dependencias ni build. Se publica con GitHub Pages (`https://eveth0797.github.io/rifvolt/`) y es una PWA con controles táctiles, teclado y mando.

## 2. Mapa de archivos
| Archivo | Responsabilidad |
|---|---|
| `index.html` | Canvas `#game` y pantallas DOM (`.screen#scr-*`): title, intro, hub (laboratorio), howto, level (cartas), dialog, pause, nexus, dead. También los controles táctiles. |
| `css/style.css` | Estilo neón/CRT de los menús y de los controles táctiles (`body.touch[data-mode="play"]`). |
| `js/audio.js` | `window.RVAudio`: SFX sintetizados (`sfx(nombre)`) y música synthwave generativa (`playSong(seed, {scale, intensity, bpm})`, `setIntensity`). |
| `js/ai.js` | `window.RVNexus`: Elo + trinquete, Q-learning por especie, algoritmo genético, Thompson sampling, modelo del jugador y selección de mutadores. Persistencia en `riftvolt.nexus.v1`. |
| `js/world.js` | `window.RVWorld`: `REALMS` (8 reinos con paleta, villano, enemigos y códice), `ENEMIES`, `MODS` (18 cartas), `UPGRADES` (mejoras permanentes), `genRealm` (mazmorra procedural) y `genLayout` (sala). |
| `js/game.js` | Motor: input, estado, run/salas, spawns, combate, IA de enemigos (Q-learning en tiempo real) y de jefes (patrones), render (caché de sala, luces, bloom), HUD, menús, guardado y logros. |
| `sw.js`, `manifest.json`, `icon.svg` | PWA (pantalla completa, horizontal, offline). |
| `docs/` | Capturas del README. |

## 3. Bucle y estados
`mode ∈ {title, hub, play, menu, dead}`. `frame()` llama a `update(dt)` solo en `play` y a `render()` en `play/menu/dead` (en `title/hub` dibuja `renderTitle`). `menu` congela el juego mientras una pantalla DOM está abierta. Coordenadas: la sala mide 24×12 tiles de 16 px (0..384 × 0..192) y el HUD ocupa los 24 px superiores (`HUD`).

## 4. Mundo
- `run.dungeon = W.genRealm(realmIdx, cycle, seed)`: cuadrícula de 7×7 salas generada con random walk. Tipos de sala: `start`, `boss` (la más lejana), `elite` ×3 (sueltan ◆ núcleos), `npc` (rescate), `shrine` (terminal de compra) y `pylon` ×3 (misión de calibrar).
- Tiles: `0` suelo, `1` muro, `2` suelo eléctrico (daña cuando pulsa), `4` pilón decorativo (sólido), `9` puerta cerrada o sellada.
- La puerta de la sala del jefe queda sellada hasta tener 3 núcleos (`run.bossOpen`).
- Al vencer al jefe aparece un portal hacia el siguiente reino. Después del reino 8 empieza `cycle++`: los villanos roban patrones de otros (fusión).

## 5. IA (NEXUS) — el corazón del juego
- **Dificultad:** `D = max(piso + 30·reino + 220·ciclo, skill + 70 + 45·reino + 260·ciclo [+120 en élite])`. `NX.scale(D)` produce multiplicadores de vida, daño, velocidad, presupuesto de spawn, cadencia e `intel` (precisión predictiva).
- **Elo:** `NX.roomResult({D, hpLostFrac, died, seconds})` al terminar cada sala.
- **Trinquete:** `NX.newSession()` sube el piso en cada carga; `realmCleared` lo sube a 0.9·D. **No añadas nada que baje `floor`**: es un requisito explícito de la persona usuaria.
- **Q-learning:** estado de 256 valores (`encodeState`) × 7 acciones. Las decisiones se toman cada 0.28-0.42 s en `updateEnemy`. Recompensas: +1.2 al dañar al jugador, −0.25 al recibir daño, −1 al morir, shaping de +0.05 por estar en rango con el ataque listo y −0.02 por paso. Hay máscaras de acción (las torretas no se mueven).
- **Genético:** `pickGenome` / `reportGenome` (aptitud = daño×5 + supervivencia). Evoluciona cada 12 evaluaciones.
- **Bandido:** `weightTypes` (composición de las salas) y `pickBossPattern` / `reportBossPattern`.
- **Modelo del jugador:** `trackMove`, `trackDodge`, `trackAttack`, `trackDash`, `trackDist`, `trackHitBy` → `profile()` y `dodgeBias()` (los usan el mutador "Precognición", el teletransporte de los jefes y el jefe final).

## 6. Cómo añadir contenido
- **Enemigo:** añade una entrada en `W.ENEMIES` con `kind` (uno existente: chaser, turret, splitter, shooter, charger, blinker, bomber) o crea un `kind` nuevo. Para eso implementa su ataque en `attack()` y su dibujo en `drawEnemy()`. Luego inclúyelo en `REALMS[i].enemies`. El Q-learning y el genético funcionan solos por `type`.
- **Patrón de jefe:** añade un `case` en `runPattern(e, dt)` que use `e.patData`/`e.patT` y llame a `endPattern(e, cd)`. Añádelo a `BOSS_PATTERNS[boss]` y a `ALL_PATTERNS`.
- **Reino o villano:** añade un objeto a `W.REALMS` (paleta completa, `boss`, `bossName`, `enemies`, `hazard`, `scale` musical y `codex`), un patrón en `BOSS_PATTERNS` y su dibujo en `drawBoss()`. `META.unlocked` y los ciclos usan `W.REALMS.length`.
- **Mod:** añade a `W.MODS` y aplica su efecto en `stats()` o en el punto del motor correspondiente con `mod("id")`.
- **Logro:** añade una entrada a `ACH` en game.js (`{id, i, n, d, t: () => bool}`).

## 7. Render
`buildRoomCache()` pre-dibuja suelo y muros (perspectiva 3/4, oclusión ambiental y circuitos) en `roomCv` al entrar a una sala. Cada frame dibuja: caché → tiles animados → entidades → partículas (modo `lighter`) → `drawLights()` (sprites radiales cacheados por color) → `bloom()` (downsample a 96×48 y 48×24 y suma) → viñeta → HUD → banner. Si añades algo luminoso, agrégale una `light(x, y, r, color, alpha)`.

## 8. Persistencia
- `riftvolt.meta.v1`: research, mejoras, reinos desbloqueados, récords, códice, logros y opciones.
- `riftvolt.nexus.v1`: todo lo aprendido por la IA.
- `riftvolt.run.v1`: run en curso. Se guarda al entrar o limpiar sala y al ocultar la pestaña. Se borra al morir. La mazmorra se **regenera desde la semilla** y solo se guardan los estados de las salas.
- Puente con Life Quest: se lee `lifequest.v1` (misiones de hoy) en `newRun` para dar bonus.

## 9. Depuración y pruebas
`window.__RV` expone `{run, P, enemies, curRoom, newRun(realm), goBoss(), dbg:{elite(type), chest()}, NX}`. Prueba con Playwright: `__RV.newRun(6); __RV.goBoss()` lleva directo a PPO-Ω. Un bot simple debe moverse hacia los enemigos y hacia las puertas por los corredores centrales, que están siempre despejados (fila 5-6 y columna 11-12). Vigila `pageerror`.

## 10. Roadmap sugerido
1. **Ajustar la curva de dificultad** con datos reales de juego (telemetría local que se pueda exportar).
2. **Jefe-agente entrenado offline**: exportar una política PPO real (por ejemplo del entorno IEEE 123-bus de la persona usuaria) a JSON o TF.js y usarla para PPO-Ω.
3. **NEXUS global**: un backend opcional (Cloudflare Worker o Supabase) que agregue tablas Q y genomas de todos los jugadores.
4. Más biomas, armas alternativas (látigo de arco, cañón de riel) y salas secretas con muros rompibles.
5. Sprites más detallados manteniendo el estilo y el rendimiento (atlas de pixel art generado en un canvas al iniciar).
6. Accesibilidad: modo daltónico (paletas), remapeo de teclas y opción para reducir el bloom.
