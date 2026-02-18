# 🐚 Shelldon's Tower Defense v5.1

A browser-based tower defense game built with vanilla HTML/CSS/JavaScript (Canvas 2D).
No external dependencies, no build tools — open `index.html` and play.

---

## 🎮 Quick Start

Open `index.html` in any modern browser. That's it.

---

## 🗼 Tower Types (10 total)

| # | Icon | Name | Cost | Damage | Range | Rate | Special |
|---|------|------|------|--------|-------|------|---------|
| 1 | 🎯 | Basic | 50g | 10 | 120 | 1/s | L3: Burst (every 3rd shot = 3 targets) |
| 2 | 💣 | Heavy | 100g | 35 | 110 | 0.45/s | L3: Cluster shockwave (30% outer ring) |
| 3 | ⚡ | Fast | 80g | 6 | 140 | 3.6/s | L3: Double shot (2nd target) |
| 4 | 🧊 | Cryo | 75g | 4 | 130 | 1.1/s | Slows 60%. L3: 15% full freeze |
| 5 | 🔭 | Sniper | 150g | 80 | 290 | 0.31/s | Huge range, sees ghosts. L3: Crit (every 4th = 3×) |
| 6 | 💥 | Bomber | 120g | 45 | 120 | 0.4/s | 75px splash, ignores armor. L3: Napalm DoT |
| 7 | 🌩 | Arc | 110g | 28 | 135 | 0.63/s | Chain lightning ×3. L3: ×5 chains |
| 8 | 🧪 | Poison | 90g | 8 | 140 | 0.67/s | DoT 20/s × 4s. L3: Chain to nearby enemy |
| 9 | 🧲 | Pulse | 135g | 18 | 90 | 1.1/s | Hits ALL in range, ignores armor. L3: Overclock (every 5th = 2×) |
| 0 | 🔦 | Laser | 165g | 8→42 DPS | 155 | Continuous | Lock-on ramp 2s, ignores armor. L3: Overdrive (→2× DPS after 1s full lock) |

### Upgrade System
- **L2**: ×1.65 damage, +20% range, -15% fire time
- **L3**: ×2.6 damage, +45% range, -30% fire time + **unique L3 special ability**
- L3 towers can target invisible Ghost enemies

### Synergy System
Adjacent same-type towers: +10% damage per neighbor (max +30%)

### Veteran System  
High-kill towers gain passive damage bonuses:
- 20 kills → +3% | 50 kills → +7% ✦ | 100 kills → +12% ⭐ | 200 kills → +18% ⭐⭐

---

## 👾 Enemy Types (11 total)

| Icon | Name | Appears | Special |
|------|------|---------|---------|
| 👾 | Normal | W1+ | Standard enemy |
| 🏃 | Fast | W3+ | 2.6× speed |
| 🛡️ | Tank | W5+ | 3.5× HP, immune to slow |
| 🐝 | Swarm | W8+ | Splits into 3 Larvae 🪲 on death |
| 🧬 | Mutant | W10+ | Regenerates 1.5% HP/s (countered by Poison) |
| 🔩 | Mech | W12+ | 40% armor (reduced by splash/poison/laser) |
| 👻 | Ghost | W15+ | Invisible — only Sniper or L3 towers can target |
| 👹 | Elite | W7,14,21… | Miniboss, 5.5× HP, bonus gold drop, rages at <25% HP |
| 💀 | Boss | W5,10,15… | 7× HP, immune to slow, random power-up drop |
| 🪲 | Larva | (spawned) | Fast offspring of Swarm |

**Rage Mode**: Tanks, Bosses, and Elites speed up +30% when below 25% HP!

---

## 🗺 Maps (5 total)

| Icon | Name | Description |
|------|------|-------------|
| 🐍 | Snake | Classic S-curve |
| ⚡ | Zigzag | Multiple sharp turns |
| 🌀 | Spiral | Long winding path |
| 🏛 | Labyrinth | Many chokepoints, tactical placement |
| 🏔 | Schlucht | Longest path, deep U-loop crossing |

---

## ⚙️ Difficulty Modes

| Mode | Gold | Lives | Notes |
|------|------|-------|-------|
| 🌱 Easy | 350g | 30❤️ | Relaxed |
| ⚔️ Normal | 200g | 20❤️ | Balanced |
| 💀 Hard | 120g | 10❤️ | For experts |
| ☠️ Nightmare | 80g | 5❤️ | +20% enemy speed, no wave events |

---

## 💰 Economy

- **Kill gold**: enemies drop gold on death (2× during Goldschauer event)
- **Wave bonus**: 30 + wave×12 gold per wave
- **No-leak bonus**: +25g if no lives lost that wave  
- **Interest**: 5% of current gold per wave (max 80g)
- **Kill milestones**: 250 kills → +60g | 750 kills → +1 life | 1500 kills → free upgrade

---

## 🎲 Wave Events (every 3rd non-boss wave)

| Event | Effect |
|-------|--------|
| 💰 Goldrausch | +50g bonus |
| 🧊 Kältefeld | All enemies slowed for 3s |
| ⚡ Kurzer Surge | +30% damage for 10s |
| ❤️ Reparatur | +1 life |
| 👾 Gegnerwelle | 5 extra enemies |
| 🌟 Goldschauer | 2× kill gold for 15s |
| ⬆ Gratis-Upgrade | Free random tower upgrade |

---

## 💀 Boss Drops

| Drop | Chance | Effect |
|------|--------|--------|
| 💰 Gold | 65% | 80 + wave×8 gold |
| 💝 Life | 23% | +1 life (max 25) |
| ⚡ Power Surge | 12% | +75% damage for 30s |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1–9, 0 | Select tower type |
| Space / P | Pause/Resume |
| Enter | Start next wave |
| Esc | Deselect tower |
| T | Cycle targeting mode (selected tower) |
| R | Restart (on game over screen) |
| Shift+Click | Place multiple towers |
| Ctrl+S | Save game |
| Ctrl+L | Load game |

---

## 🎯 Targeting Modes

Each tower can be set to target: **Vorne** (first), **Hinten** (last), **Stark** (strongest), **Schwach** (weakest). Press `T` to cycle.

---

## 🏅 Achievements (31 total)

Achievements for kills, waves, tower use, special kills, combos, and more. View them via the 🏅 button.

---

## 💾 Save / Load

- Manual save (Ctrl+S) / load (Ctrl+L) between waves  
- Auto-save after each wave completes
- Saves: gold, lives, wave, score, tower types/levels/kills/targeting modes, map, difficulty

---

## 📊 Technical

- Pure HTML/CSS/JavaScript (Canvas 2D API)
- Web Audio API for procedural sound effects
- No external dependencies
- `localStorage` for save data, achievements, leaderboard
- Responsive canvas scaling for mobile

---

## 🔧 Development History

| Version | Date | Highlights |
|---------|------|------------|
| v1.0 | 2026-02-16 | Initial: 3 towers, pathfinding, wave system |
| v2.0 | 2026-02-17 | 6 towers, upgrades, 4 enemy types, particles |
| v2.9 | 2026-02-17 | 7 towers, Arc chain lightning, sound system |
| v3.0 | 2026-02-17 | Poison/Pulse towers, achievements, maps |
| v3.9 | 2026-02-17 | Ghost enemy, synergy lines, cooldown arcs |
| v4.0 | 2026-02-18 | Laser tower, Swarm enemy, Elite, 4th map |
| v4.7 | 2026-02-18 | L3 specials (6 towers), veteran system |
| v5.0 | 2026-02-18 | Complete L3 set (all 10 towers), Nightmare difficulty |
| v5.1 | 2026-02-18 | 5th map (Schlucht), overdrive visual |
