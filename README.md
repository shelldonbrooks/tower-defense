# 🐚 Shelldon's Tower Defense

A browser-based tower defense game built with vanilla HTML5 Canvas, CSS, and JavaScript. No frameworks, no build tools — just open `index.html`.

## 🎮 How to Play

1. Open `index.html` in your browser
2. Select a tower from the shop (or press **1–7**)
3. Click the grid to place it (green = OK, red = blocked)
4. Press **▶️ Welle starten** (or **Enter**) to send enemies
5. Defend your base — don't let enemies reach the 🏁 exit!

## 🗼 Tower Types (8 towers)

| # | Icon | Name   | Cost  | Damage | Range | Rate   | Special |
|---|------|--------|-------|--------|-------|--------|---------|
| 1 | 🎯   | Basic  | 50💰  | 10     | 120px | 1/s    | Allrounder |
| 2 | 💣   | Heavy  | 100💰 | 35     | 110px | 0.45/s | High damage |
| 3 | ⚡   | Fast   | 80💰  | 6      | 140px | 3.6/s  | Rapid fire |
| 4 | 🧊   | Cryo   | 75💰  | 4      | 130px | 1.1/s  | Slows 60% for 2.5s |
| 5 | 🔭   | Sniper | 150💰 | 80     | 290px | 0.3/s  | Laser sight |
| 6 | 💥   | Bomber | 120💰 | 45     | 120px | 0.4/s  | 75px splash |
| 7 | 🌩   | Arc    | 110💰 | 28     | 135px | 0.6/s  | Chains to 2 more enemies |
| 8 | 🧪   | Poison | 90💰  | 8      | 140px | 0.67/s | Poisons: 20 dmg/s for 4s (DoT) |

> **Poison Tower tip:** Apply poison to Mutant enemies to cancel their regeneration!

### Tower Upgrades (up to Level 3)
- **L2:** ×1.65 damage, ×1.2 range (costs 1.5× base)
- **L3:** ×2.6 damage, ×1.45 range (costs 2.5× base)
- Gold ring = L2 | Red ring = L3

## 👾 Enemy Types

| Icon | Name   | Appears | Notes |
|------|--------|---------|-------|
| 👾   | Normal | W1+     | Standard |
| 🏃   | Fast   | W3+     | 2.6× speed, motion blur |
| 🛡️   | Tank   | W5+     | 3.5× HP, immune to slow |
| 🧬   | Mutant | W10+    | 2.2× HP, regenerates 1.5% HP/s (countered by Poison!) |
| 💀   | Boss   | W5,10…  | 7× HP, immune to slow, **drops a power-up!** |

### Boss Drops (random)
- **53%** 💰 Gold drop (80 + wave×8 gold)
- **23%** 💝 +1 Life
- **12%** ⚡ **Power Surge!** — All towers +75% damage for 30 seconds

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **1–7** | Select tower type |
| **Space / P** | Pause / unpause |
| **Enter** | Start next wave |
| **Esc** | Deselect |
| **Shift** + click | Place multiple towers |
| **Right-click** tower | Instant sell (50% refund) |
| **Ctrl+S** | Save game |
| **Ctrl+L** | Load game |

## 💰 Economy

- Kill enemies → gold + score
- Wave complete bonus: 30 + wave×12 💰
- **No-leak bonus**: +25💰 if no lives were lost this wave
- **Interest**: +5% of current gold (capped at 80💰) per wave
- Sell tower: 50% of total investment refunded

## 🎯 Targeting Modes

Click a placed tower to select it and choose its targeting priority:
- **Vorne** (First): Targets enemy furthest along the path *(default)*
- **Hinten** (Last): Targets closest to spawn
- **Stark** (Strong): Targets highest HP enemy
- **Schwach** (Weak): Targets lowest HP enemy

## 🎨 Visual Effects

- Particle explosions on kill (color-matched to enemy)
- Projectile trails behind every shot
- Tower barrels rotate toward their target
- Boss kill: white screen flash + heavy shake
- Life lost: screen shake
- 🧊 Cryo aura visible on slowed enemies
- 🏃 Fast enemies show motion blur streaks
- ⚡ Power Surge: golden glow on all towers
- 🔭 Sniper shows laser sight to target
- 🌩 Arc shows yellow lightning particles on chain
- Floating gold text on kills

## 🔊 Audio

Web Audio API synthesized sounds — no external files:
- 7 distinct tower fire sounds (per type, throttled)
- Kill / Boss death fanfares
- Wave start / complete jingles
- Tower place, sell, upgrade clicks
- Life lost sound
- Game over descending scale
- Toggle: 🔊/🔇 button

## 💾 Save / Load

- **Ctrl+S** saves between waves (saves towers, gold, lives, wave, score)
- **Auto-save** happens automatically after each completed wave
- **Ctrl+L** loads last save

## 🏆 Leaderboard

- Top 5 scores stored in localStorage
- Shows score, wave reached, date
- Displayed on game over screen

## 📐 Technical Details

- Vanilla JavaScript, HTML5 Canvas 2D API
- Canvas: 800×600 internal, CSS-scaled for smaller screens
- `requestAnimationFrame` game loop
- Web Audio API (synthesized sounds)
- localStorage: high score, wave high, leaderboard, save state
- `CanvasRenderingContext2D.roundRect` polyfill included
- Touch events supported (mobile-friendly)

## 📁 Files

```
tower-defense-game/
├── index.html   — Game structure + 2 overlays + tooltips
├── style.css    — All styling (~500 lines CSS)
├── game.js      — Game logic (~2000 lines)
└── README.md    — This file
```

## 🔄 Version History

| Version | Date | Features |
|---------|------|----------|
| v1.0 | 2026-02-16 | Initial build: 3 towers, wave system |
| v2.0 | 2026-02-17 | 6 towers, 4 enemies, upgrades, particles |
| v2.1 | 2026-02-17 | Audio system, screen shake, auto-wave |
| v2.2 | 2026-02-17 | Wave preview, grass background, speed control |
| v2.3 | 2026-02-17 | Tower rotation, targeting modes, save/load |
| v2.4 | 2026-02-17 | Path arrows, help modal, particle cap |
| v2.5 | 2026-02-17 | Stats tracking, trails, milestones |
| v2.6 | 2026-02-17 | Economy system, laser sight, speed lines |
| v2.7 | 2026-02-17 | Boss HP bar, number hotkeys |
| v2.8 | 2026-02-17 | Arc chain lightning tower |
| v2.9 | 2026-02-17 | Tank immunity, DPS display, touch |
| v2.10 | 2026-02-17 | Leaderboard, responsive canvas, difficulty cap |
| v2.11 | 2026-02-17 | Boss drops, power surge, auto-save |
| v2.12 | 2026-02-17 | Surge timer, shop tooltips |
| v2.13 | 2026-02-17 | Tower ghost preview, roundRect polyfill |
