# 🐚 Shelldon's Tower Defense

A browser-based tower defense game built with vanilla HTML5 Canvas, CSS, and JavaScript.

## 🎮 How to Play

1. Open `index.html` in your browser (or visit the hosted version)
2. Buy towers from the shop panel on the right
3. Click a tower to select it, then click the grid to place it
4. Press **▶️ Welle starten** to send the next wave of enemies
5. Defend your base — don't let enemies reach the exit!

## 🗼 Tower Types

| Icon | Name   | Cost  | Special |
|------|--------|-------|---------|
| 🎯   | Basic  | 50💰  | Balanced all-rounder |
| 💣   | Heavy  | 100💰 | High damage, slow fire |
| ⚡   | Fast   | 80💰  | Rapid fire, low damage |
| 🧊   | Cryo   | 75💰  | Slows enemies 60% for 2.5s |
| 🔭   | Sniper | 150💰 | Extreme range, 1-shot power |
| 💥   | Bomber | 120💰 | Area splash damage |

### Tower Upgrades (L1 → L2 → L3)
- **Level 2:** 1.65× damage, 1.2× range (costs 1.5× base price)
- **Level 3:** 2.6× damage, 1.45× range (costs 2.5× base price)
- Level 2 shows a **gold ring** ⬛, Level 3 shows a **red ring**

## 👾 Enemy Types

| Icon | Name  | Appears | Special |
|------|-------|---------|---------|
| 👾   | Normal | Wave 1+ | Standard enemy |
| 🏃   | Fast  | Wave 3+ | 2.5× speed, 0.45× HP |
| 🛡️   | Tank  | Wave 5+ | 3.5× HP, 0.45× speed |
| 💀   | Boss  | W5,10,15… | 7× HP, drops big reward |

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space / P | Pause / Unpause |
| Enter | Start next wave |
| Esc | Deselect tower |
| Shift + Click | Place multiple towers without deselecting |

## 🎯 Scoring

- Kill reward: enemy's gold value × 1.5
- Wave complete bonus: 30 + (wave × 12) 💰
- High score is saved via localStorage

## 🛠️ Tech Stack

- Vanilla JavaScript (no frameworks)
- HTML5 Canvas 2D API
- CSS3 with gradients and animations
- localStorage for high score
- `requestAnimationFrame` game loop

## 📁 Files

```
tower-defense-game/
├── index.html   — Game structure and UI
├── style.css    — Styling and animations  
├── game.js      — All game logic
└── README.md    — This file
```

## 🔄 Version History

- **v1.0** (2026-02-16): Initial build — 3 towers, wave system, basic enemies
- **v2.0** (2026-02-17): 
  - +3 new tower types (Cryo, Sniper, Bomber/Area)
  - Tower upgrade system (3 levels with stats + visual rings)
  - 4 enemy types (Normal, Fast, Tank, Boss)
  - Particle system (explosions, hit flashes, floating gold text)
  - Hover preview with range circle while placing towers
  - Proper path cell collision (all segment cells, not just waypoints)
  - Score system + localStorage highscore
  - Pause (Space/P) and speed control (1x/2x/3x between waves)
  - Tower info panel with kills counter
  - Wave complete banner animation
  - Game over overlay
  - Keyboard shortcuts
  - Shift+click to place multiple towers
