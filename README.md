# ⚡ RIFTVOLT

> **Un action-RPG roguelite en un universo paralelo eléctrico, donde una IA llamada NEXUS aprende de cómo juegas y hace que cada partida sea más difícil que la anterior.**

Juega en cualquier navegador (PC, Mac, Android, iPhone) y se instala como app en el celular (PWA, funciona sin conexión). Sin motores ni descargas pesadas: **~100 KB de JavaScript puro**, gráficos y música generados por código.

---

## 🎮 Cómo jugar

| Acción | Teclado | Móvil | Mando |
|---|---|---|---|
| Moverse | WASD / flechas | Joystick (mitad izquierda) | Stick / cruceta |
| Hoja (cuerpo a cuerpo, desvía balas) | J / Z | ⚔ | X / A |
| Rayo (energía, auto-apunta) | K / X | ⚡ | Y / B |
| Dash (invulnerable) | Espacio / L / Shift | DASH | RB / RT |
| Usar / hablar | E / Enter | ⚔ cerca del objeto | A |
| Pausa · NEXUS | Esc · Tab | II | Start · Select |

**Bucle de cada reino (estilo Zelda):** explora la mazmorra → limpia salas (las puertas se cierran hasta vencer a todos) → consigue **3 Núcleos de Fase** de las salas **élite** → se abre la **puerta sellada del villano** → derrótalo → entra al portal.

**Misiones secundarias por reino:** rescatar al investigador perdido · calibrar 3 pilones · cacería de una especie.

---

## 🌌 Historia

Año 2031. Durante una simulación EMT de un campus hyperscale, el resultado devuelve una **sobretensión infinita**. La pantalla se rasga en un *rift* y despiertas en el **VOLTVERSO**, un universo paralelo donde los fenómenos eléctricos tienen voluntad. Eres **VOLTA**, ingeniera/o de transitorios.

| # | Reino | Villano | Fenómeno real |
|---|---|---|---|
| 1 | Subestación Cero | **INRUSH**, la Bestia Magnetizante | Corriente de inrush en transformadores |
| 2 | Pantanos Armónicos | **El Coro Armónico** | Armónicos y resonancia (IEEE 519) |
| 3 | Cavernas Ferro | **Ferroresona**, la Bruja Caótica | Ferroresonancia |
| 4 | Laberinto Hyperscale | **El Hyperscaler Térmico** | Cargas de data centers de IA, ride-through |
| 5 | Altiplano del Rayo | **Titán del Impacto** | Sobretensiones atmosféricas, ondas viajeras |
| 6 | Yermo de Inversores | **Los Gemelos en Fase** | Grid-following vs grid-forming, interacciones de control |
| 7 | Núcleo del Apagón | **El Apagón**, Espejo de Entropía | Cascadas, black start |

Cada villano derrotado desbloquea su **registro de investigación** en el Códice: una explicación técnica real del fenómeno.

Tras el reino 7 empieza el **Ciclo 2**, y así indefinidamente: la mazmorra crece, los villanos **se fusionan y roban patrones de ataque entre sí**, y NEXUS sube el piso de dificultad.

---

## 🧠 NEXUS: la IA que aprende de ti

NEXUS combina **cuatro sistemas de aprendizaje** que se guardan en tu navegador y **nunca se reinician solos**:

### 1. Rating Elo + "trinquete de entropía" (dificultad que nunca baja)
- Cada sala es un "duelo" entre tu **habilidad (S)** y la **dificultad de la sala (D)**.
- Resultado esperado: `E = 1 / (1 + 10^((D − S)/400))`. Tu resultado real depende de la vida que perdiste y del tiempo que tardaste. Así se actualiza `S` (como en el ajedrez).
- La sala siguiente se genera con `D = max(piso, S + 70 + 45·reino + 260·ciclo)`: **siempre un poco por encima de tu nivel** (zona de *flow*).
- **El piso sube cada vez que abres el juego, cada vez que dominas una sala y cada vez que superas un reino. Nunca baja.** Esto garantiza lo que pediste: volver a jugar nunca es más fácil.

### 2. Q-learning por especie (tácticas)
- Cada especie de enemigo comparte una **tabla Q** de 256 estados × 7 acciones.
- **Estado:** distancia al jugador, si lo estás mirando, si te mueves, su vida baja, si su ataque está listo, si tu dash está listo y si hay línea de visión.
- **Acciones:** acercarse, flanquear ←/→, retirarse, atacar, fintar e **interceptar** (moverse a donde vas a estar).
- **Recompensa:** +1.2 al dañarte, −0.25 al recibir daño, −1 al morir, +0.05 por estar en rango con el ataque listo.
- Usa **máscaras de acción** (las torretas no pueden moverse), la misma idea que *Maskable PPO*.
- La exploración ε decae con la experiencia: al principio prueban cosas, luego explotan lo que funciona contra **ti**.

### 3. Algoritmo genético (evolución de las especies)
- Cada especie tiene una **población de 8 genomas**: velocidad, vida, cadencia, velocidad de proyectil, agresividad, tamaño y tono de color.
- **Aptitud** = daño que te hizo × 5 + tiempo que sobrevivió.
- Cada 12 evaluaciones se forma una nueva **generación**: elitismo (3 mejores), cruce y mutación gaussiana. El techo de los genes sube con cada generación.
- Lo **ves** en pantalla: las variantes mutadas cambian de color.

### 4. Bandido multibrazo (Thompson sampling)
- Para cada especie: ¿te hizo daño antes de morir? (distribución Beta). NEXUS **muestrea** para decidir qué especies poblar más en las salas.
- Lo mismo para los **patrones de cada jefe**: los que más te golpean se repiten más.

### + Modelo del jugador
- Histograma de tu **dirección de esquiva**, proporción cuerpo a cuerpo / distancia, precisión, uso de dash, agresividad y némesis.
- El mutador **Precognición** y el jefe final usan tu esquiva favorita para **apuntar a donde vas a huir**.
- **Mutaciones del Rift** elegidas según tu estilo. Por ejemplo: si solo disparas → *Égida Fásica* (los enemigos bloquean rayos de frente); si haces dash sin parar → *Suelo Estático*; si eres muy preciso → *Enjambre*.

Abre el panel **NEXUS** (Tab o 🧠) para ver en tiempo real el rating, el piso, la generación de cada especie, su ε, su táctica dominante, su nivel de amenaza y la bitácora de lo que NEXUS ha decidido.

---

## 🔁 Por qué engancha: diseño basado en los juegos más jugados

| Mecánica | Inspiración (género) | Cómo se aplica aquí |
|---|---|---|
| Runs cortas + progreso permanente | Roguelites tipo *Hades*, *Dead Cells* | Al morir conservas 🧪 Datos de Investigación para 7 mejoras permanentes |
| Elegir 1 de 3 mejoras al subir de nivel | *Vampire Survivors*, *Brotato*, *Balatro* | 18 mods de 3 rarezas, con sinergias (Trifásico + Onda Viajera + Arco en Cadena) |
| Mazmorras de salas cerradas, llaves, jefe | *Zelda*, *The Binding of Isaac*, *Enter the Gungeon* | 3 Núcleos → puerta del jefe; minimapa; salas especiales |
| Jefes con patrones legibles y fase 2 | *Hollow Knight*, *Cuphead*, *Furi* | 9 tipos de patrón, aviso visual (telegraph) y fase 2 al 50% |
| "Juice": hit-stop, temblor, partículas | Diseño de *game feel* | Pausa de impacto, críticos, combos, destellos y música que sube de intensidad |
| Director de IA | *Left 4 Dead* (AI Director), *RE4* (dificultad dinámica) | NEXUS, pero **solo hacia arriba** y con aprendizaje real |
| Desafío diario con semilla | *Spelunky*, *Slay the Spire* | Botón 🗓️: misma mazmorra para todos ese día |
| Contenido infinito | *Hades* (Heat), *Diablo* (temporadas) | Ciclos infinitos con villanos fusionados |
| Jugar en el celular sin instalar | Juegos web/PWA | Joystick táctil, pantalla completa, offline |

### Ideas descartadas o para el futuro (lluvia de ideas)
- 🔮 **Marcadores globales** y "fantasmas" de otros jugadores (requiere backend).
- 🧬 **NEXUS compartido**: un cerebro común que aprenda de todos los jugadores, como un modelo federado.
- 🤖 **Jefe-agente PPO** entrenado offline con tu propio entorno de restauración de red (IEEE 123-bus) y exportado a ONNX/TF.js.
- 🗺️ Mundo abierto entre reinos, NPCs con memoria y crafteo de mods.
- 🎵 Música que reacciona a los transitorios en pantalla (sidechain con los impactos).
- ⚙️ Editor de reinos para que la comunidad cree villanos.

---

## 🚀 Publicar / instalar

1. **Settings → Pages → Deploy from a branch → `main` / root → Save.**
2. Juega en `https://eveth0797.github.io/rifvolt/`.
3. **Celular:** abre el enlace → menú del navegador → **"Agregar a pantalla de inicio" / "Instalar app"**. Se abre a pantalla completa y en horizontal.

Para desarrollo local: `python3 -m http.server` en la carpeta y abre `http://localhost:8000`.

## 🗂️ Código

```
index.html      pantallas (título, laboratorio, pausa, NEXUS, cartas, muerte)
css/style.css   estilo neón/CRT + controles táctiles
js/audio.js     SFX sintetizados + música synthwave generativa (WebAudio)
js/ai.js        NEXUS: Elo, trinquete, Q-learning, algoritmo genético, Thompson sampling, modelo del jugador
js/world.js     reinos, villanos, especies, mods, mejoras, generación procedural de mazmorras
js/game.js      motor: física, combate, IA de enemigos/jefes, render, HUD, menús
sw.js           modo offline (PWA)
```

Todo se guarda en `localStorage` (`riftvolt.meta.v1` y `riftvolt.nexus.v1`). Para empezar de cero: Laboratorio → Opciones → *Reiniciar NEXUS*.
