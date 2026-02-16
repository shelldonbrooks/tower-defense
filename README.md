# 🐚 Shelldon's Tower Defense

Ein kleines Tower Defense Spiel, gebaut für shelldon.monoroc.de

## 🎮 Spielanleitung

### Ziel
Verhindere, dass Gegner das Ende des Pfades erreichen. Jeder Gegner, der durchkommt, kostet dich 1 Leben. Bei 0 Leben ist das Spiel vorbei.

### Steuerung
1. **Turm auswählen**: Klicke auf einen Turm-Button in der Seitenleiste
2. **Turm platzieren**: Klicke auf ein freies Feld (nicht auf dem Pfad!)
3. **Welle starten**: Klicke auf "▶️ Welle starten"
4. **Turm verkaufen**: Wähle einen platzierten Turm aus (Klick drauf), dann "💸 Turm verkaufen"

### 🗼 Türme

| Typ | Kosten | Schaden | Reichweite | Feuerrate | Taktik |
|-----|--------|---------|------------|-----------|---------|
| 🎯 **Basic** | 50💰 | 10 | Mittel | Mittel | Allrounder, gut für den Start |
| 💣 **Heavy** | 100💰 | 30 | Kurz | Langsam | Hoher Schaden, platziere nah am Pfad |
| ⚡ **Fast** | 80💰 | 5 | Weit | Sehr schnell | Perfekt für schnelle Gegner |

### 💰 Wirtschaft
- **Startgeld**: 200💰
- **Gegner töten**: +10-20💰 (steigt mit Wellen)
- **Welle abschließen**: +50💰 Bonus
- **Turm verkaufen**: 50% Rückerstattung

### 🌊 Wellen
Jede Welle wird schwieriger:
- Mehr Gegner spawnen
- Gegner haben mehr Leben
- Gegner bewegen sich schneller
- Höhere Belohnungen

### 🎯 Strategie-Tipps
1. **Platziere Basic-Türme** früh am Pfad für maximale Schuss-Zeit
2. **Heavy-Türme** sind ideal an Ecken/Kurven
3. **Fast-Türme** eignen sich gut für Lücken in der Verteidigung
4. **Mix & Match**: Kombiniere verschiedene Türme für optimale Abdeckung
5. **Range-Anzeige**: Klicke auf einen Turm, um seine Reichweite zu sehen

## 🛠️ Tech Stack
- **HTML5 Canvas** für Rendering
- **Vanilla JavaScript** (keine Frameworks)
- **CSS3** für UI
- **RequestAnimationFrame** für Game Loop

## 📁 Datei-Struktur
```
tower-defense-game/
├── index.html      # Haupt-HTML mit Canvas und UI
├── style.css       # Styling und Layout
├── game.js         # Game Logic, Klassen, Game Loop
└── README.md       # Diese Datei
```

## 🚀 Features
- ✅ Drei verschiedene Turm-Typen
- ✅ Wellensystem mit Schwierigkeitssteigerung
- ✅ Intelligentes Targeting (Gegner am weitesten im Pfad)
- ✅ Gesundheitsbalken für Gegner
- ✅ Reichweitenanzeige
- ✅ Sell-Funktion
- ✅ Responsive Design

## 🔮 Geplante Features
- 🔄 Sound-Effekte
- 🔄 Mehr Turm-Typen (Area Damage, Slow, etc.)
- 🔄 Spezial-Gegner (Schnell, Tank, Fliegend)
- 🔄 Partikel-Effekte
- 🔄 Multiple Maps
- 🔄 Highscore-System
- 🔄 Achievements

## 🐚 Made by Shelldon
Built with 💜 using OpenClaw
