// ================================================================
// 🐚 Shelldon's Tower Defense — v2.x
// ================================================================

// CanvasRenderingContext2D.roundRect polyfill (for Firefox <112, Safari <15.4)
if (typeof CanvasRenderingContext2D !== 'undefined' &&
    !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        const radius = typeof r === 'number' ? r : (Array.isArray(r) ? (r[0] || 0) : 0);
        this.moveTo(x + radius, y);
        this.lineTo(x + w - radius, y);
        this.arcTo(x + w, y, x + w, y + radius, radius);
        this.lineTo(x + w, y + h - radius);
        this.arcTo(x + w, y + h, x + w - radius, y + h, radius);
        this.lineTo(x + radius, y + h);
        this.arcTo(x, y + h, x, y + h - radius, radius);
        this.lineTo(x, y + radius);
        this.arcTo(x, y, x + radius, y, radius);
    };
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CELL_SIZE = 40;
const GRID_WIDTH = 20;
const GRID_HEIGHT = 15;

// ================================================================
// GAME STATE
// ================================================================
let gold = 200;
let lives = 20;
let wave = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('tdHighScore') || '0');
let selectedTowerType = null;
let selectedTower = null;
let towers = [];
let enemies = [];
let projectiles = [];
let particles = [];
let gameRunning = false;
let gamePaused = false;
let waveInProgress = false;
let gameSpeed = 1;
let waveSpawnPending = 0;
let waveSpawnTimeouts = [];
let hoverCell = null;
let lastTimestamp = 0;
let autoWave = false;
let autoWaveTimer = null;
let autoWaveCountdown = 0;
let shakeAmount = 0;
let soundEnabled = true;
let totalKills = 0;
let totalGoldEarned = 0;
let totalDamageDealt = 0;
let gameStartTime = Date.now();
let sessionWaveHighest = parseInt(localStorage.getItem('tdWaveHigh') || '0');
let livesAtWaveStart = 20; // track for no-leak bonus
let screenFlash = 0; // white flash intensity (0-1)
let damageBoostMult = 1.0;
let damageBoostEnd  = 0; // timestamp when surge ends
let prevBoostActive = false;
let recentKillTimes = []; // timestamps of recent kills for combo tracking
let comboActive = false;

// ================================================================
// AUDIO SYSTEM (Web Audio API — no external files)
// ================================================================
let _audioCtx = null;
function getAC() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
}

const _soundThrottle = {};
function _tone({ freq = 440, type = 'sine', dur = 0.15, vol = 0.3, decay = 0.1, sweep = null }) {
    try {
        const ac  = getAC();
        const osc = ac.createOscillator();
        const g   = ac.createGain();
        osc.connect(g); g.connect(ac.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ac.currentTime);
        if (sweep) osc.frequency.linearRampToValueAtTime(sweep, ac.currentTime + dur);
        g.gain.setValueAtTime(Math.min(vol, 1), ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur + decay);
        osc.start(); osc.stop(ac.currentTime + dur + decay + 0.02);
    } catch(e) { /* audio may not be available */ }
}

function sfxFire(type) {
    if (!soundEnabled) return;
    const key = 'fire_' + type;
    const now = Date.now();
    if (_soundThrottle[key] && now - _soundThrottle[key] < 200) return;
    _soundThrottle[key] = now;
    switch(type) {
        case 'basic':  _tone({ freq: 350, type: 'square',   dur: 0.04, vol: 0.18, decay: 0.06 }); break;
        case 'heavy':  _tone({ freq: 90,  type: 'sawtooth', dur: 0.12, vol: 0.32, decay: 0.22, sweep: 40 }); break;
        case 'fast':   _tone({ freq: 700, type: 'square',   dur: 0.03, vol: 0.12, decay: 0.04 }); break;
        case 'slow':   _tone({ freq: 500, type: 'sine',     dur: 0.10, vol: 0.20, decay: 0.10, sweep: 800 }); break;
        case 'sniper': _tone({ freq: 160, type: 'sawtooth', dur: 0.02, vol: 0.38, decay: 0.35, sweep: 50 }); break;
        case 'area':   _tone({ freq: 110, type: 'sawtooth', dur: 0.10, vol: 0.40, decay: 0.45, sweep: 30 }); break;
        case 'arc':    _tone({ freq: 1400, type: 'sawtooth', dur: 0.06, vol: 0.22, decay: 0.14, sweep: 400 }); break;
        case 'poison': _tone({ freq: 280,  type: 'sine',     dur: 0.14, vol: 0.18, decay: 0.22, sweep: 180 }); break;
        case 'pulse':  {
            // Electric buzz — two tones
            _tone({ freq: 80,  type: 'square', dur: 0.06, vol: 0.35, decay: 0.15, sweep: 40 });
            setTimeout(() => _tone({ freq: 1800, type: 'square', dur: 0.04, vol: 0.12, decay: 0.10 }), 30);
            break;
        }
    }
}

function sfxKill(isBoss) {
    if (!soundEnabled) return;
    if (isBoss) {
        _tone({ freq: 60, type: 'sawtooth', dur: 0.28, vol: 0.5, decay: 0.5, sweep: 20 });
        setTimeout(() => _tone({ freq: 500, type: 'sine', dur: 0.15, vol: 0.35, decay: 0.25, sweep: 800 }), 200);
    } else {
        if (_soundThrottle['kill'] && Date.now() - _soundThrottle['kill'] < 80) return;
        _soundThrottle['kill'] = Date.now();
        _tone({ freq: 220, type: 'sawtooth', dur: 0.06, vol: 0.22, decay: 0.10, sweep: 90 });
    }
}

function sfxLifeLost() {
    if (!soundEnabled) return;
    _tone({ freq: 200, type: 'sawtooth', dur: 0.18, vol: 0.40, decay: 0.25, sweep: 100 });
}

function sfxWaveStart() {
    if (!soundEnabled) return;
    [440, 550, 660].forEach((f, i) => setTimeout(() =>
        _tone({ freq: f, type: 'sine', dur: 0.09, vol: 0.28, decay: 0.12 }), i * 75));
}

function sfxWaveComplete() {
    if (!soundEnabled) return;
    [440, 550, 660, 880].forEach((f, i) => setTimeout(() =>
        _tone({ freq: f, type: 'sine', dur: 0.11, vol: 0.30, decay: 0.14 }), i * 80));
}

function sfxUpgrade() {
    if (!soundEnabled) return;
    [440, 660, 880, 1100].forEach((f, i) => setTimeout(() =>
        _tone({ freq: f, type: 'sine', dur: 0.07, vol: 0.28, decay: 0.10 }), i * 55));
}

function sfxPlace() {
    if (!soundEnabled) return;
    _tone({ freq: 330, type: 'sine', dur: 0.07, vol: 0.22, decay: 0.08, sweep: 440 });
}

function sfxSell() {
    if (!soundEnabled) return;
    _tone({ freq: 660, type: 'sine', dur: 0.05, vol: 0.20, decay: 0.10, sweep: 330 });
}

function sfxGameOver() {
    if (!soundEnabled) return;
    [440, 330, 220, 110].forEach((f, i) => setTimeout(() =>
        _tone({ freq: f, type: 'sawtooth', dur: 0.2, vol: 0.35, decay: 0.3, sweep: f * 0.7 }), i * 200));
}

// ================================================================
// SCREEN SHAKE
// ================================================================
function triggerShake(amount) {
    shakeAmount = Math.max(shakeAmount, amount);
}

function applyShake() {
    if (shakeAmount > 0.3) {
        ctx.translate(
            (Math.random() - 0.5) * shakeAmount,
            (Math.random() - 0.5) * shakeAmount
        );
        shakeAmount *= 0.82;
    } else {
        shakeAmount = 0;
    }
}

// ================================================================
// PATH DEFINITION
// ================================================================
// ================================================================
// MAPS (multiple selectable path layouts)
// ================================================================
const ALL_MAPS = [
    {
        name: 'Snake',
        icon: '🐍',
        desc: 'Klassischer Schlangenweg',
        waypoints: [
            {x: 0,  y: 7},
            {x: 5,  y: 7},
            {x: 5,  y: 2},
            {x: 11, y: 2},
            {x: 11, y: 11},
            {x: 16, y: 11},
            {x: 16, y: 5},
            {x: 20, y: 5}
        ]
    },
    {
        name: 'Zigzag',
        icon: '⚡',
        desc: 'Mehrfache Kehrtwendungen',
        waypoints: [
            {x: 0,  y: 2},
            {x: 10, y: 2},
            {x: 10, y: 7},
            {x: 2,  y: 7},
            {x: 2,  y: 12},
            {x: 12, y: 12},
            {x: 12, y: 4},
            {x: 20, y: 4}
        ]
    },
    {
        name: 'Spiral',
        icon: '🌀',
        desc: 'Weite Spirale — lang!',
        waypoints: [
            {x: 0,  y: 7},
            {x: 15, y: 7},
            {x: 15, y: 1},
            {x: 1,  y: 1},
            {x: 1,  y: 13},
            {x: 20, y: 13}
        ]
    }
];

let selectedMapIndex = 0;
let PATH_WAYPOINTS = ALL_MAPS[0].waypoints;
let pathCells = new Set();

function computePathCells() {
    pathCells.clear();
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
        const from = PATH_WAYPOINTS[i];
        const to   = PATH_WAYPOINTS[i + 1];
        const dx = Math.sign(to.x - from.x);
        const dy = Math.sign(to.y - from.y);
        let cx = from.x, cy = from.y;
        while (cx !== to.x || cy !== to.y) {
            pathCells.add(`${cx},${cy}`);
            cx += dx; cy += dy;
        }
        pathCells.add(`${to.x},${to.y}`);
    }
}

function selectMap(index) {
    selectedMapIndex = index;
    PATH_WAYPOINTS = ALL_MAPS[index].waypoints;
    computePathCells();
    // Clear any placed towers (map changed)
    towers = []; selectedTower = null;
}

computePathCells(); // initialize with map 0

// ================================================================
// TOWER TYPES
// ================================================================
const TOWER_TYPES = {
    basic: {
        name: 'Basic',
        desc: 'Ausgewogener Allrounder',
        cost: 50,
        damage: 10,
        range: 120,
        fireRate: 1000,
        color: '#4CAF50',
        icon: '🎯',
        projectileSpeed: 5,
        projectileRadius: 5
    },
    heavy: {
        name: 'Heavy',
        desc: 'Viel Schaden, langsam',
        cost: 100,
        damage: 35,
        range: 110,
        fireRate: 2200,
        color: '#F44336',
        icon: '💣',
        projectileSpeed: 3,
        projectileRadius: 7
    },
    fast: {
        name: 'Fast',
        desc: 'Rapid fire, low damage',
        cost: 80,
        damage: 6,
        range: 140,
        fireRate: 280,
        color: '#2196F3',
        icon: '⚡',
        projectileSpeed: 9,
        projectileRadius: 4
    },
    slow: {
        name: 'Cryo',
        desc: 'Verlangsamt Gegner 60%',
        cost: 75,
        damage: 4,
        range: 130,
        fireRate: 900,
        color: '#00BCD4',
        icon: '🧊',
        projectileSpeed: 6,
        projectileRadius: 6,
        slowAmount: 0.4,
        slowDuration: 2500
    },
    sniper: {
        name: 'Sniper',
        desc: 'Hohe Reichweite + Schaden',
        cost: 150,
        damage: 80,
        range: 290,
        fireRate: 3200,
        color: '#9C27B0',
        icon: '🔭',
        projectileSpeed: 18,
        projectileRadius: 4
    },
    area: {
        name: 'Bomber',
        desc: 'Flächenschaden',
        cost: 120,
        damage: 45,
        range: 120,
        fireRate: 2500,
        color: '#FF9800',
        icon: '💥',
        projectileSpeed: 4,
        projectileRadius: 8,
        splashRadius: 75
    },
    pulse: {
        name: 'Pulse',
        desc: 'EM-Puls — trifft ALLE in Reichweite',
        cost: 135,
        damage: 18,
        range: 90,
        fireRate: 900,
        color: '#CFD8DC',
        icon: '🧲',
        projectileSpeed: 0,
        projectileRadius: 0,
        isAura: true
    },
    poison: {
        name: 'Poison',
        desc: 'Vergiftet Gegner (DoT 4s)',
        cost: 90,
        damage: 8,
        range: 140,
        fireRate: 1500,
        color: '#76FF03',
        icon: '🧪',
        projectileSpeed: 5,
        projectileRadius: 6,
        poisonDPS: 20,
        poisonDuration: 4000
    },
    arc: {
        name: 'Arc',
        desc: 'Kettenblitz (3 Ziele)',
        cost: 110,
        damage: 28,
        range: 135,
        fireRate: 1600,
        color: '#FFEB3B',
        icon: '🌩',
        projectileSpeed: 11,
        projectileRadius: 6,
        chainRange: 110,
        chainHits: 2,
        chainDmgMult: 0.65
    }
};

// ================================================================
// UPGRADE LEVELS (index = level-1)
// ================================================================
const UPGRADES = [
    { dmgMult: 1.0,  rangeMult: 1.0,  rateMult: 1.0,   costFactor: 0   }, // L1
    { dmgMult: 1.65, rangeMult: 1.2,  rateMult: 0.85,  costFactor: 1.5 }, // L2
    { dmgMult: 2.6,  rangeMult: 1.45, rateMult: 0.70,  costFactor: 2.5 }  // L3
];

// ================================================================
// PARTICLE CLASS
// ================================================================
class Particle {
    constructor(x, y, color, vx, vy, life, radius = 4) {
        this.x = x; this.y = y;
        this.color = color;
        this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life;
        this.radius = radius;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.91;
        this.vy *= 0.91;
        this.life--;
        return this.life <= 0;
    }
    draw() {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.5, this.radius * alpha), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

const MAX_PARTICLES = 300;

function spawnExplosion(x, y, color, count = 12) {
    if (particles.length > MAX_PARTICLES) return; // performance cap
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const speed = 1.5 + Math.random() * 3;
        particles.push(new Particle(x, y, color,
            Math.cos(angle) * speed, Math.sin(angle) * speed,
            18 + Math.floor(Math.random() * 14), 3 + Math.random() * 3));
    }
}

function spawnHitFlash(x, y, color) {
    particles.push(new Particle(x, y, color, 0, -0.8, 10, 9));
}

function spawnLightning(x1, y1, x2, y2) {
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
        const t = i / (steps + 1);
        const px = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 10;
        const py = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 10;
        particles.push(new Particle(px, py, '#FFEB3B', 0, 0, 7, 3));
        particles.push(new Particle(px, py, '#FFF9C4', 0, 0, 5, 2));
    }
}

function spawnFloatText(x, y, text, color = '#FFD700') {
    // Use a dedicated "textParticle" approach via a simple object
    textParticles.push({ x, y, text, color, life: 45, maxLife: 45, vy: -1.2 });
}

let textParticles = [];

function updateTextParticles() {
    for (let i = textParticles.length - 1; i >= 0; i--) {
        const p = textParticles[i];
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) { textParticles.splice(i, 1); continue; }
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, p.y);
        ctx.globalAlpha = 1;
    }
}

// ================================================================
// ENEMY CLASS
// ================================================================
class Enemy {
    constructor(cfg) {
        this.health    = cfg.health;
        this.maxHealth = cfg.health;
        this.speed     = cfg.speed;
        this.baseSpeed = cfg.speed;
        this.reward    = cfg.reward;
        this.scoreVal  = cfg.scoreVal || cfg.reward;
        this.icon      = cfg.icon    || '👾';
        this.color     = cfg.color   || '#E91E63';
        this.radius    = cfg.radius  || 12;
        this.isTank       = cfg.isTank       || false;
        this.isFast       = cfg.isFast       || false;
        this.isSlowImmune = cfg.isSlowImmune || false;
        this.armorReduce  = cfg.armorReduce  || 0;  // 0-1: fraction of damage blocked

        this.pathIndex = 0;
        this.progress  = 0;
        this.x = PATH_WAYPOINTS[0].x * CELL_SIZE + CELL_SIZE / 2;
        this.y = PATH_WAYPOINTS[0].y * CELL_SIZE + CELL_SIZE / 2;

        this.slowedUntil  = 0;
        this.poisonDPS    = 0;
        this.poisonEnd    = 0;
        this.poisonSource = null;
        this.regenDPS     = cfg.regenDPS || 0;
        this._lastTick    = 0;
    }

    applyPoison(dps, duration, tower) {
        this.poisonDPS    = dps;
        this.poisonEnd    = Date.now() + duration;
        this.poisonSource = tower;
        if (this._lastTick === 0) this._lastTick = Date.now();
    }

    applySlowEffect(slowAmt, duration) {
        if (this.isSlowImmune) {
            // Show brief visual that it's immune
            spawnHitFlash(this.x, this.y, '#78909C');
            return;
        }
        this.speed = this.baseSpeed * slowAmt;
        this.slowedUntil = Date.now() + duration;
    }

    update(now) {
        if (this.slowedUntil && now > this.slowedUntil) {
            this.speed = this.baseSpeed;
            this.slowedUntil = 0;
        }

        // Time-delta for DOT / regen
        if (this._lastTick === 0) this._lastTick = now;
        const dtSec = Math.min((now - this._lastTick) / 1000, 0.1);
        this._lastTick = now;

        // Poison DOT (time-based)
        if (this.poisonEnd && now > this.poisonEnd) {
            this.poisonDPS = 0; this.poisonEnd = 0; this.poisonSource = null;
        }
        if (this.poisonDPS > 0 && dtSec > 0) {
            const dotDmg = this.poisonDPS * dtSec;
            this.health -= dotDmg;
            if (this.poisonSource) this.poisonSource.totalDmg += dotDmg;
            totalDamageDealt += dotDmg;
        }

        // Regen (only when NOT poisoned)
        if (this.regenDPS > 0 && this.poisonDPS === 0 && this.health < this.maxHealth && dtSec > 0) {
            this.health = Math.min(this.maxHealth, this.health + this.regenDPS * dtSec);
        }

        if (this.pathIndex >= PATH_WAYPOINTS.length - 1) return true;

        const cur  = PATH_WAYPOINTS[this.pathIndex];
        const next = PATH_WAYPOINTS[this.pathIndex + 1];
        const dx = (next.x - cur.x) * CELL_SIZE;
        const dy = (next.y - cur.y) * CELL_SIZE;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.progress += this.speed * gameSpeed;

        if (this.progress >= dist) {
            this.pathIndex++;
            this.progress = 0;
            if (this.pathIndex < PATH_WAYPOINTS.length) {
                this.x = PATH_WAYPOINTS[this.pathIndex].x * CELL_SIZE + CELL_SIZE / 2;
                this.y = PATH_WAYPOINTS[this.pathIndex].y * CELL_SIZE + CELL_SIZE / 2;
            }
        } else {
            const ratio = this.progress / dist;
            this.x = cur.x * CELL_SIZE + CELL_SIZE / 2 + dx * ratio;
            this.y = cur.y * CELL_SIZE + CELL_SIZE / 2 + dy * ratio;
        }

        return false;
    }

    draw() {
        // Fast enemy speed lines
        if (this.isFast && this.pathIndex < PATH_WAYPOINTS.length - 1) {
            const cur  = PATH_WAYPOINTS[this.pathIndex];
            const next = PATH_WAYPOINTS[this.pathIndex + 1];
            const dx = (next.x - cur.x) * CELL_SIZE;
            const dy = (next.y - cur.y) * CELL_SIZE;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                const nx = -dx / len, ny = -dy / len; // opposite direction
                ctx.strokeStyle = 'rgba(255, 100, 30, 0.5)';
                ctx.lineWidth = 1.5;
                for (let i = 1; i <= 3; i++) {
                    const lineLen = 4 + i * 3;
                    ctx.beginPath();
                    ctx.moveTo(this.x + nx * (this.radius + i * 3),
                               this.y + ny * (this.radius + i * 3));
                    ctx.lineTo(this.x + nx * (this.radius + i * 3 + lineLen),
                               this.y + ny * (this.radius + i * 3 + lineLen));
                    ctx.globalAlpha = 0.5 - i * 0.12;
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }
        }

        // Slow immune indicator (small shield badge)
        if (this.isSlowImmune) {
            ctx.font = '9px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText('🛡', this.x + this.radius - 1, this.y - this.radius + 1);
        }

        // Armor indicator
        if (this.armorReduce > 0) {
            ctx.font = '9px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('🔩', this.x - this.radius + 1, this.y - this.radius + 1);
        }

        // Cryo glow
        if (this.slowedUntil > Date.now()) {
            ctx.strokeStyle = 'rgba(0, 188, 212, 0.8)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Poison glow
        if (this.poisonEnd > Date.now()) {
            const pulse = 0.6 + Math.sin(Date.now() / 150) * 0.3;
            ctx.strokeStyle = `rgba(100,255,50,${pulse})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
            if (particles.length < MAX_PARTICLES - 5 && Math.random() < 0.22) {
                particles.push(new Particle(
                    this.x + (Math.random() - 0.5) * this.radius * 2,
                    this.y - this.radius * 0.5 + (Math.random() - 0.5) * this.radius,
                    '#76FF03', (Math.random() - 0.5) * 0.4, -0.9 - Math.random() * 0.5,
                    12 + Math.floor(Math.random() * 8), 2.5
                ));
            }
        }

        // Regen glow (subtle green pulse when regenerating and not poisoned)
        if (this.regenDPS > 0 && this.poisonDPS === 0 && this.health < this.maxHealth) {
            const repulse = 0.2 + Math.abs(Math.sin(Date.now() / 400)) * 0.25;
            ctx.strokeStyle = `rgba(0,200,83,${repulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 7, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.radius - 2, this.radius * 0.8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Stroke
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Icon
        ctx.font = `${Math.round(this.radius * 1.1)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, this.x, this.y);

        // Health bar
        const bw = this.radius * 2.2;
        const bh = 4;
        const hRatio = this.health / this.maxHealth;
        const bx = this.x - bw / 2;
        const by = this.y - this.radius - 9;
        ctx.fillStyle = '#333';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = hRatio > 0.6 ? '#4CAF50' : hRatio > 0.25 ? '#FF9800' : '#F44336';
        ctx.fillRect(bx, by, bw * hRatio, bh);
    }

    takeDamage(dmg, isSplash = false) {
        // Armor reduces non-splash damage
        const effective = this.armorReduce > 0 && !isSplash
            ? dmg * (1 - this.armorReduce)
            : dmg;
        this.health -= effective;
        return this.health <= 0;
    }

    getPathProgress() {
        return this.pathIndex * 10000 + this.progress;
    }
}

// ================================================================
// TOWER CLASS
// ================================================================
class Tower {
    constructor(x, y, type) {
        this.gridX = Math.floor(x / CELL_SIZE);
        this.gridY = Math.floor(y / CELL_SIZE);
        this.x = this.gridX * CELL_SIZE + CELL_SIZE / 2;
        this.y = this.gridY * CELL_SIZE + CELL_SIZE / 2;
        this.type   = type;
        this.config = TOWER_TYPES[type];
        this.level  = 1;
        this.lastFired = 0;
        this.target    = null;
        this.kills     = 0;
        this.totalDmg  = 0;
        this.angle     = 0;   // current rotation (radians)
        this.targetMode = 'first'; // 'first' | 'last' | 'strong' | 'weak'
    }

    getSynergyBonus() {
        // +10% dmg per adjacent same-type tower (max 30%)
        let adj = 0;
        for (const t of towers) {
            if (t === this || t.type !== this.type) continue;
            const dx = Math.abs(t.gridX - this.gridX);
            const dy = Math.abs(t.gridY - this.gridY);
            if (dx <= 1 && dy <= 1) adj++;
        }
        return Math.min(adj * 0.10, 0.30);
    }

    getStats() {
        const u    = UPGRADES[this.level - 1];
        const dmgBoost = (Date.now() < damageBoostEnd) ? damageBoostMult : 1.0;
        const synergy  = 1.0 + this.getSynergyBonus();
        return {
            damage:   this.config.damage   * u.dmgMult * dmgBoost * synergy,
            range:    this.config.range    * u.rangeMult,
            fireRate: this.config.fireRate * u.rateMult
        };
    }

    getUpgradeCost() {
        if (this.level >= 3) return null;
        return Math.floor(this.config.cost * UPGRADES[this.level].costFactor);
    }

    getSellValue() {
        let total = this.config.cost;
        for (let l = 1; l < this.level; l++) {
            total += Math.floor(this.config.cost * UPGRADES[l].costFactor);
        }
        return Math.floor(total * 0.5);
    }

    update(now) {
        const stats = this.getStats();
        const effectiveRate = stats.fireRate / gameSpeed;

        if (this.config.isAura) {
            // Aura/pulse tower — no targeting, pulses all enemies in range
            this.angle += 0.015 * gameSpeed; // slow spin
            if (now - this.lastFired >= effectiveRate) {
                this.fireAura(stats);
                this.lastFired = now;
            }
            return;
        }

        if (!this.target || this.target.health <= 0) {
            this.target = this.findTarget(stats.range);
        }

        this.updateAngle();

        if (this.target && now - this.lastFired >= effectiveRate) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            if (Math.sqrt(dx * dx + dy * dy) <= stats.range) {
                this.fire(stats);
                this.lastFired = now;
            } else {
                this.target = null;
            }
        }
    }

    fireAura(stats) {
        sfxFire('pulse');
        spawnAuraPulse(this.x, this.y, stats.range, this.config.color);
        let hitCount = 0;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const dx = e.x - this.x, dy = e.y - this.y;
            if (Math.sqrt(dx * dx + dy * dy) > stats.range) continue;
            spawnHitFlash(e.x, e.y, this.config.color);
            this.totalDmg += stats.damage;
            totalDamageDealt += stats.damage;
            hitCount++;
            if (e.takeDamage(stats.damage, true)) {  // pulse ignores armor (area effect)
                this.kills++;
                killEnemy(i);
            }
        }
        return hitCount;
    }

    findTarget(range) {
        let best = null;
        let bestVal = this.targetMode === 'last' ? Infinity
                    : this.targetMode === 'weak' ? Infinity
                    : -Infinity;

        for (const e of enemies) {
            const dx = e.x - this.x, dy = e.y - this.y;
            if (Math.sqrt(dx * dx + dy * dy) > range) continue;

            let val;
            switch (this.targetMode) {
                case 'first':  val = e.getPathProgress(); if (val > bestVal) { bestVal = val; best = e; } break;
                case 'last':   val = e.getPathProgress(); if (val < bestVal) { bestVal = val; best = e; } break;
                case 'strong': val = e.health;            if (val > bestVal) { bestVal = val; best = e; } break;
                case 'weak':   val = e.health;            if (val < bestVal) { bestVal = val; best = e; } break;
            }
        }
        return best;
    }

    updateAngle() {
        if (!this.target) return;
        const desired = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        let diff = desired - this.angle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += diff * 0.18;
    }

    fire(stats) {
        if (!this.target) return;
        sfxFire(this.type);
        projectiles.push(new Projectile(
            this.x, this.y,
            this.target,
            stats.damage,
            this.config.projectileSpeed * gameSpeed,
            this.config.color,
            this.config.projectileRadius,
            !!this.config.splashRadius,
            this.config.splashRadius || 0,
            this,
            this.config.slowAmount   || null,
            this.config.slowDuration || null,
            this.config.chainRange   || 0,
            this.config.chainHits    || 0,
            this.config.chainDmgMult || 0.65,
            this.config.poisonDPS      || 0,
            this.config.poisonDuration || 0
        ));
    }

    draw() {
        const stats = this.getStats();

        // Damage boost surge glow
        if (Date.now() < damageBoostEnd) {
            const remain = (damageBoostEnd - Date.now()) / 30000; // fraction remaining
            ctx.strokeStyle = `rgba(255,215,0,${0.3 + remain * 0.5})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 20 + Math.sin(Date.now() / 150) * 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Pulse/Aura tower: always show range ring with animation
        if (this.config.isAura) {
            const elapsed = Date.now() - this.lastFired;
            const coolFrac = Math.min(1, elapsed / (stats.fireRate / gameSpeed));
            const pulse2 = 0.15 + coolFrac * 0.45;
            ctx.strokeStyle = this.config.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = pulse2;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, stats.range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        // Sniper laser sight
        if (this.type === 'sniper' && this.target && this.target.health > 0) {
            const now2 = Date.now();
            const coolFrac = Math.max(0, Math.min(1, (now2 - this.lastFired) / (stats.fireRate / gameSpeed)));
            const alpha = Math.floor(coolFrac * 200);
            ctx.strokeStyle = this.config.color + alpha.toString(16).padStart(2, '0');
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 8]);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.target.x, this.target.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Range ring when selected
        if (selectedTower === this) {
            ctx.strokeStyle = this.config.color + '55';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, stats.range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Level ring
        const lvlColor = ['#888', '#FFD700', '#FF6B6B'];
        if (this.level > 1) {
            ctx.strokeStyle = lvlColor[this.level - 1];
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(this.x - 18, this.y - 18, 36, 36, 6);
            ctx.stroke();
        }

        // Rotated barrel
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Base (rounded square)
        ctx.fillStyle = this.config.color + 'CC';
        ctx.beginPath();
        ctx.roundRect(-15, -15, 30, 30, 5);
        ctx.fill();
        ctx.strokeStyle = this.config.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Barrel (pointing right = angle 0, rotates toward target)
        ctx.fillStyle = this.config.color;
        ctx.fillRect(6, -3.5, 12, 7);
        // Barrel tip ring
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(16, -2.5, 3, 5);
        ctx.globalAlpha = 1;

        ctx.restore();

        // Icon (on top, not rotated)
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.config.icon, this.x, this.y);

        // Level badge
        if (this.level > 1) {
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = lvlColor[this.level - 1];
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText(`L${this.level}`, this.x + 14, this.y - 15);
        }
    }
}

// ================================================================
// PROJECTILE CLASS
// ================================================================
class Projectile {
    constructor(x, y, target, damage, speed, color, radius,
                isSplash = false, splashR = 0, tower = null,
                slowAmt = null, slowDur = null,
                chainRange = 0, chainHits = 0, chainDmgMult = 0.65,
                poisonDPS = 0, poisonDuration = 0) {
        this.x = x; this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed  = speed;
        this.color  = color;
        this.radius = radius;
        this.active = true;
        this.isSplash    = isSplash;
        this.splashR     = splashR;
        this.tower       = tower;
        this.slowAmt     = slowAmt;
        this.slowDur     = slowDur;
        this.chainRange  = chainRange;
        this.chainHits   = chainHits;
        this.chainDmgMult = chainDmgMult;
        this.poisonDPS      = poisonDPS;
        this.poisonDuration = poisonDuration;
    }

    update(now) {
        if (!this.target || this.target.health <= 0) {
            this.active = false;
            return;
        }
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.speed + this.radius) {
            this.hit(now);
            this.active = false;
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
            // Trail particles
            if (particles.length < MAX_PARTICLES - 10 && Math.random() < 0.6) {
                particles.push(new Particle(
                    this.x + (Math.random() - 0.5) * 3,
                    this.y + (Math.random() - 0.5) * 3,
                    this.color, 0, 0, 5, this.radius * 0.5
                ));
            }
        }
    }

    hit(now) {
        if (this.isSplash) {
            spawnExplosion(this.target.x, this.target.y, this.color, 18);
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                const dx = e.x - this.target.x, dy = e.y - this.target.y;
                if (Math.sqrt(dx * dx + dy * dy) <= this.splashR) {
                    spawnHitFlash(e.x, e.y, this.color);
                    if (this.tower) this.tower.totalDmg += this.damage;
                    totalDamageDealt += this.damage;
                    if (e.takeDamage(this.damage, true)) {  // splash = ignores armor
                        if (this.tower) this.tower.kills++;
                        killEnemy(i);
                    }
                }
            }
        } else {
            const idx = enemies.indexOf(this.target);
            if (idx !== -1) {
                spawnHitFlash(this.target.x, this.target.y, this.color);
                if (this.slowAmt && this.slowDur) {
                    this.target.applySlowEffect(this.slowAmt, this.slowDur);
                }
                if (this.poisonDPS && this.poisonDuration) {
                    this.target.applyPoison(this.poisonDPS, this.poisonDuration, this.tower);
                }
                if (this.tower) this.tower.totalDmg += this.damage;
                totalDamageDealt += this.damage;
                if (this.target.takeDamage(this.damage)) {
                    if (this.tower) this.tower.kills++;
                    killEnemy(idx);
                }

                // Chain lightning bounce
                if (this.chainHits > 0) {
                    const hitSet = new Set([this.target]);
                    let lastHit = this.target;
                    for (let b = 0; b < this.chainHits; b++) {
                        // Find nearest unhit enemy in chainRange
                        const next = enemies
                            .filter(e => !hitSet.has(e))
                            .sort((a, cc) =>
                                Math.hypot(a.x - lastHit.x, a.y - lastHit.y) -
                                Math.hypot(cc.x - lastHit.x, cc.y - lastHit.y)
                            )[0];
                        if (!next) break;
                        const d2next = Math.hypot(next.x - lastHit.x, next.y - lastHit.y);
                        if (d2next > this.chainRange) break;

                        spawnLightning(lastHit.x, lastHit.y, next.x, next.y);
                        spawnHitFlash(next.x, next.y, '#FFEB3B');

                        const chainDmg = this.damage * Math.pow(this.chainDmgMult, b + 1);
                        if (this.tower) this.tower.totalDmg += chainDmg;
                        totalDamageDealt += chainDmg;

                        const nextIdx = enemies.indexOf(next);
                        if (next.takeDamage(chainDmg)) {
                            if (this.tower) this.tower.kills++;
                            if (nextIdx !== -1) killEnemy(nextIdx);
                        }

                        hitSet.add(next);
                        lastHit = next;
                    }
                }
            }
        }
    }

    draw() {
        ctx.shadowColor = this.color;
        ctx.shadowBlur  = 8;
        ctx.fillStyle   = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// ================================================================
// KILL ENEMY
// ================================================================
function triggerBossDrop() {
    const roll = Math.random();
    if (roll < 0.12) {
        // Damage surge: +75% for 30s
        damageBoostMult = 1.75;
        damageBoostEnd  = Date.now() + 30000;
        sfxUpgrade();
        unlockAchievement('full_upgrade');
        showBanner('⚡ POWER SURGE! +75% Schaden für 30s!');
    } else if (roll < 0.35) {
        // Extra life
        lives = Math.min(lives + 1, 25);
        showBanner(`💝 Bonus Leben! ${lives}❤️`);
        _tone({ freq: 880, type: 'sine', dur: 0.2, vol: 0.4, decay: 0.2, sweep: 1100 });
    } else {
        // Gold drop (always happens)
        const goldDrop = 80 + Math.floor(wave * 8);
        gold += goldDrop;
        totalGoldEarned += goldDrop;
        spawnFloatText(canvas.width / 2, canvas.height / 2, `💰 Boss Drop: +${goldDrop}!`, '#FFD700');
        showBanner(`💰 Boss Drop: +${goldDrop}💰`);
    }
    updateUI();
}

function killEnemy(idx) {
    const e = enemies[idx];
    if (!e) return;
    const isBoss = e.icon === '💀';
    gold  += e.reward;
    score += e.scoreVal;
    totalKills++;
    totalGoldEarned += e.reward;
    spawnExplosion(e.x, e.y, e.color, isBoss ? 24 : 12);
    spawnFloatText(e.x, e.y - 15, `+${e.reward}💰`);
    sfxKill(isBoss);
    if (isBoss) {
        triggerShake(14);
        screenFlash = 0.7;
        // Boss power-up drop
        setTimeout(() => triggerBossDrop(), 400);
    }
    enemies.splice(idx, 1);
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('tdHighScore', String(highScore));
    }
    // Achievements
    checkAchievements();
    if (isBoss) unlockAchievement('boss_kill');
    if (e && e.icon === '🧬') unlockAchievement('mutant_kill');

    // Kill milestones
    if (totalKills === 100) showBanner('🎖 100 Gegner besiegt!');
    else if (totalKills === 500) showBanner('🏅 500 Gegner besiegt!');
    else if (totalKills === 1000) showBanner('🏆 1000 Kills! Wahnsinn!');

    // Combo tracking
    const now3 = Date.now();
    recentKillTimes.push(now3);
    recentKillTimes = recentKillTimes.filter(t => now3 - t < 2000);
    if (recentKillTimes.length >= 5 && !comboActive) {
        comboActive = true;
        const comboGold = 20;
        gold += comboGold;
        totalGoldEarned += comboGold;
        const ex = e.x ?? (canvas.width / 2), ey = e.y ?? (canvas.height / 2);
        spawnFloatText(ex, ey - 30, `🔥 COMBO! +${comboGold}💰`, '#FF6B6B');
        sfxUpgrade();
        unlockAchievement('combo');
        setTimeout(() => { comboActive = false; }, 500);
    }
}

// ================================================================
// WAVE EVENTS
// ================================================================
const WAVE_EVENTS = [
    {
        id: 'gold_rush',
        name: '💰 Goldrausch!',
        desc: '+50💰 Bonus',
        apply: () => {
            const bonus = 50 + wave * 3;
            gold += bonus; totalGoldEarned += bonus;
            spawnFloatText(canvas.width / 2, canvas.height / 2 - 20, `+${bonus}💰 Goldrausch!`, '#FFD700');
            updateUI();
        }
    },
    {
        id: 'slow_field',
        name: '🧊 Kältefeld!',
        desc: 'Alle Gegner 3s verlangsamt',
        apply: () => {
            const now = Date.now();
            enemies.forEach(e => { if (!e.isSlowImmune) e.applySlowEffect(0.4, 3000); });
        }
    },
    {
        id: 'mini_surge',
        name: '⚡ Kurzer Surge!',
        desc: '+30% Schaden für 10s',
        apply: () => {
            damageBoostMult = 1.30;
            damageBoostEnd  = Math.max(damageBoostEnd, Date.now() + 10000);
        }
    },
    {
        id: 'repair',
        name: '❤️ Reparatur!',
        desc: '+1 Leben',
        apply: () => {
            if (lives < (selectedDifficulty === 'easy' ? 30 : selectedDifficulty === 'hard' ? 10 : 20) + 5) {
                lives = Math.min(lives + 1, 30);
                updateUI();
            } else {
                // Convert to gold instead
                const bonus = 30;
                gold += bonus; totalGoldEarned += bonus;
                spawnFloatText(canvas.width/2, 80, `+${bonus}💰 (max Leben!)`, '#FFD700');
                updateUI();
            }
        }
    },
    {
        id: 'enemy_surge',
        name: '👾 Gegnerwelle!',
        desc: '5 Extra-Gegner!',
        apply: () => {
            // Spawn 5 extra basic enemies immediately
            const scaledW   = wave <= 20 ? wave : 20 + Math.sqrt(wave - 20) * 2.5;
            const hp = Math.floor((28 + scaledW * 14) * 0.6);
            const spd = Math.min(0.85 + scaledW * 0.065, 3.2);
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    enemies.push(new Enemy({
                        health: hp, speed: spd, reward: Math.floor(8 + wave * 3),
                        scoreVal: 12 + wave * 2,
                        icon: '👾', color: '#E91E63', radius: 12
                    }));
                    waveSpawnPending++;
                    _waveRosterTotal++;
                }, i * 400);
            }
        }
    }
];

let lastWaveEvent = null;

function triggerWaveEvent() {
    // Pick random event (don't repeat same event twice)
    const pool = WAVE_EVENTS.filter(e => e.id !== (lastWaveEvent ? lastWaveEvent.id : ''));
    const ev = pool[Math.floor(Math.random() * pool.length)];
    lastWaveEvent = ev;
    showBanner(`🎲 Wellenbonus: ${ev.name} — ${ev.desc}`);
    ev.apply();
}

// ================================================================
// DRAW FUNCTIONS
// ================================================================
// Pre-generate grass patches for consistent background
const grassPatches = (() => {
    const rng = (seed) => {
        let s = seed;
        return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    };
    const r = rng(42);
    return Array.from({ length: 180 }, (_, i) => ({
        x: r() * 800, y: r() * 600,
        rx: 6 + r() * 12, ry: 3 + r() * 6,
        angle: r() * Math.PI,
        alpha: 0.08 + r() * 0.12,
        shade: r() > 0.5
    }));
})();

function drawBackground() {
    // Base grass fill
    ctx.fillStyle = '#dde8c8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grass patches
    for (const p of grassPatches) {
        if (pathCells.has(`${Math.floor(p.x / CELL_SIZE)},${Math.floor(p.y / CELL_SIZE)}`)) continue;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.shade ? '#c8d8a8' : '#b8cc90';
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

function drawPath() {
    // Path fill
    ctx.strokeStyle = '#A1887F';
    ctx.lineWidth = CELL_SIZE * 0.75;
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(PATH_WAYPOINTS[0].x * CELL_SIZE + CELL_SIZE / 2,
               PATH_WAYPOINTS[0].y * CELL_SIZE + CELL_SIZE / 2);
    for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
        ctx.lineTo(PATH_WAYPOINTS[i].x * CELL_SIZE + CELL_SIZE / 2,
                   PATH_WAYPOINTS[i].y * CELL_SIZE + CELL_SIZE / 2);
    }
    ctx.stroke();

    // Path texture overlay
    ctx.strokeStyle = '#8D6E63';
    ctx.lineWidth = CELL_SIZE * 0.75 - 4;
    ctx.setLineDash([8, 12]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Entry marker
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('→', 15, PATH_WAYPOINTS[0].y * CELL_SIZE + CELL_SIZE / 2);

    // Exit marker
    const last = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    ctx.fillText('🏁', canvas.width - 15, last.y * CELL_SIZE + CELL_SIZE / 2);

    // Direction arrows along the path
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.fillStyle   = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
        const from = PATH_WAYPOINTS[i];
        const to   = PATH_WAYPOINTS[i + 1];
        const segDx = (to.x - from.x) * CELL_SIZE;
        const segDy = (to.y - from.y) * CELL_SIZE;
        const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
        const nx = segDx / segLen;
        const ny = segDy / segLen;
        const steps = Math.max(1, Math.floor(segLen / (CELL_SIZE * 2)));
        for (let s = 1; s <= steps; s++) {
            const t = s / (steps + 1);
            const ax = (from.x * CELL_SIZE + CELL_SIZE / 2) + segDx * t;
            const ay = (from.y * CELL_SIZE + CELL_SIZE / 2) + segDy * t;
            // Draw chevron arrow
            const aw = 6, ah = 9;
            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(Math.atan2(ny, nx));
            ctx.beginPath();
            ctx.moveTo(ah / 2, 0);
            ctx.lineTo(-ah / 2, -aw / 2);
            ctx.lineTo(-ah / 4, 0);
            ctx.lineTo(-ah / 2, aw / 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }
}

function spawnAuraPulse(x, y, range, color) {
    if (particles.length >= MAX_PARTICLES - 30) return;
    const steps = 18;
    for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = range * (0.3 + Math.random() * 0.7);
        particles.push(new Particle(
            x + Math.cos(angle) * r * 0.4,
            y + Math.sin(angle) * r * 0.4,
            color,
            Math.cos(angle) * (1.5 + Math.random() * 2.5),
            Math.sin(angle) * (1.5 + Math.random() * 2.5),
            14, 2.5
        ));
    }
    // Center flash
    particles.push(new Particle(x, y, color, 0, 0, 10, 8));
}

function drawSynergyLines() {
    const drawn = new Set();
    const pulse = 0.4 + Math.abs(Math.sin(Date.now() / 600)) * 0.35;
    for (let i = 0; i < towers.length; i++) {
        const ta = towers[i];
        for (let j = i + 1; j < towers.length; j++) {
            const tb = towers[j];
            if (ta.type !== tb.type) continue;
            const dx = Math.abs(ta.gridX - tb.gridX);
            const dy = Math.abs(ta.gridY - tb.gridY);
            if (dx > 1 || dy > 1) continue;
            const key = `${i}-${j}`;
            if (drawn.has(key)) continue;
            drawn.add(key);
            ctx.save();
            ctx.strokeStyle = ta.config.color;
            ctx.globalAlpha = pulse * 0.7;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(ta.x, ta.y);
            ctx.lineTo(tb.x, tb.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }
}

function drawHoverCell() {
    if (!hoverCell || !selectedTowerType) return;
    const key = `${hoverCell.x},${hoverCell.y}`;
    const onPath   = pathCells.has(key);
    const hasTower = towers.some(t => t.gridX === hoverCell.x && t.gridY === hoverCell.y);
    const inBounds = hoverCell.x >= 0 && hoverCell.x < GRID_WIDTH &&
                     hoverCell.y >= 0 && hoverCell.y < GRID_HEIGHT;
    const valid = !onPath && !hasTower && inBounds;

    ctx.fillStyle = valid ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)';
    ctx.fillRect(hoverCell.x * CELL_SIZE, hoverCell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

    // Ghost tower icon in hover cell
    const cx2 = hoverCell.x * CELL_SIZE + CELL_SIZE / 2;
    const cy2 = hoverCell.y * CELL_SIZE + CELL_SIZE / 2;
    const ghostCfg = TOWER_TYPES[selectedTowerType];
    ctx.globalAlpha = valid ? 0.55 : 0.3;
    ctx.fillStyle = ghostCfg.color + '99';
    ctx.beginPath();
    ctx.roundRect(cx2 - 14, cy2 - 14, 28, 28, 4);
    ctx.fill();
    ctx.font = '17px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ghostCfg.icon, cx2, cy2);
    ctx.globalAlpha = 1;

    if (valid && selectedTowerType) {
        const cfg = TOWER_TYPES[selectedTowerType];
        ctx.strokeStyle = cfg.color + '50';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.arc(hoverCell.x * CELL_SIZE + CELL_SIZE / 2,
                hoverCell.y * CELL_SIZE + CELL_SIZE / 2,
                cfg.range, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// ================================================================
// WAVE SPAWNING
// ================================================================
function buildWaveRoster(waveNum) {
    const configs = [];

    // Diminishing scaling after wave 20 to prevent impossible difficulty
    const scaledW   = waveNum <= 20 ? waveNum : 20 + Math.sqrt(waveNum - 20) * 2.5;
    const baseHp    = Math.floor(28 + scaledW * 14);
    const baseSpeed = Math.min(0.85 + scaledW * 0.065, 3.2); // cap speed at 3.2
    const baseReward = Math.floor(8 + scaledW * 2);
    const basicCount = Math.min(6 + waveNum * 2, 30); // cap at 30 basics

    for (let i = 0; i < basicCount; i++) {
        configs.push({
            health: baseHp, speed: baseSpeed, reward: baseReward,
            scoreVal: baseReward * 1.5,
            icon: '👾', color: '#E91E63', radius: 12,
            delay: i * 1100
        });
    }

    if (waveNum >= 3) {
        const fastCount = Math.min(2 + Math.floor(waveNum / 2), 8);
        for (let i = 0; i < fastCount; i++) {
            configs.push({
                health: Math.floor(baseHp * 0.45),
                speed:  baseSpeed * 2.6,
                reward: Math.floor(baseReward * 1.4),
                scoreVal: baseReward * 2.5,
                icon: '🏃', color: '#FF5722', radius: 10,
                isFast: true,
                delay: (basicCount + i) * 900 + 1500
            });
        }
    }

    if (waveNum >= 5) {
        const tankCount = Math.min(1 + Math.floor((waveNum - 5) / 2), 4);
        for (let i = 0; i < tankCount; i++) {
            configs.push({
                health: Math.floor(baseHp * 3.5),
                speed:  baseSpeed * 0.45,
                reward: Math.floor(baseReward * 2.8),
                scoreVal: baseReward * 5,
                icon: '🛡️', color: '#607D8B', radius: 19,
                isTank: true, isSlowImmune: true,
                delay: basicCount * 1300 + i * 2800 + 2000
            });
        }
    }

    if (waveNum >= 12) {
        const mechCount = Math.min(1 + Math.floor((waveNum - 12) / 4), 3);
        const tankCountPrev = Math.min(1 + Math.floor((waveNum - 5) / 2), 4);
        for (let i = 0; i < mechCount; i++) {
            configs.push({
                health: Math.floor(baseHp * 2.8),
                speed:  baseSpeed * 0.55,
                reward: Math.floor(baseReward * 2.5),
                scoreVal: baseReward * 4.5,
                icon: '🔩', color: '#78909C', radius: 17,
                isTank: false, isSlowImmune: false,
                armorReduce: 0.40,  // 40% damage reduction from non-splash
                delay: tankCountPrev * 2800 + basicCount * 1400 + i * 2400 + 3500
            });
        }
    }

    if (waveNum >= 10) {
        const mutantCount = Math.min(1 + Math.floor((waveNum - 10) / 4), 3);
        const tankCount2  = Math.min(1 + Math.floor((waveNum - 5) / 2), 4);
        for (let i = 0; i < mutantCount; i++) {
            const mHp = Math.floor(baseHp * 2.2);
            configs.push({
                health: mHp,
                speed:  baseSpeed * 0.70,
                reward: Math.floor(baseReward * 2.0),
                scoreVal: baseReward * 3.5,
                icon: '🧬', color: '#00C853', radius: 15,
                isTank: false, isSlowImmune: false,
                regenDPS: Math.max(1, Math.floor(mHp * 0.015)), // 1.5% max HP/s regen
                delay: basicCount * 1200 + tankCount2 * 2500 + i * 2200 + 2500
            });
        }
    }

    if (waveNum % 5 === 0) {
        configs.push({
            health: Math.floor(baseHp * 7),
            speed:  baseSpeed * 0.65,
            reward: Math.floor(baseReward * 6),
            scoreVal: baseReward * 15,
            icon: '💀', color: '#4A148C', radius: 23,
            isTank: true, isSlowImmune: true,
            delay: basicCount * 1500 + 6000
        });
    }

    configs.sort((a, b) => a.delay - b.delay);
    return configs;
}

function spawnWave() {
    if (waveInProgress) return;
    clearTimeout(autoWaveTimer);
    autoWaveTimer = null;
    autoWaveCountdown = 0;
    updateAutoWaveDisplay();

    wave++;
    waveInProgress = true;
    waveSpawnPending = 0;
    livesAtWaveStart = lives;
    sfxWaveStart();

    // Random wave events (every 3 waves starting at wave 3, skip boss waves)
    if (wave >= 3 && wave % 5 !== 0 && wave % 3 === 0) {
        setTimeout(() => triggerWaveEvent(), 1200);
    }

    // Wave milestones
    if (wave === 25) {
        setTimeout(() => {
            showBanner('🎉 Welle 25 — Du bist ein Meister! +500💰');
            gold += 500; totalGoldEarned += 500;
            screenFlash = 0.4;
            triggerShake(8);
            // Confetti burst
            for (let i = 0; i < 5; i++) {
                setTimeout(() => spawnExplosion(
                    50 + Math.random() * 700, 100 + Math.random() * 400,
                    ['#FF6B6B','#FFD700','#4CAF50','#2196F3','#E040FB'][Math.floor(Math.random()*5)], 10
                ), i * 80);
            }
        }, 800);
    } else if (wave % 5 === 0) {
        setTimeout(() => showBanner(`💀 BOSS WELLE ${wave}! Vorbereiten!`), 500);
        triggerShake(5);
    } else if (wave === 10 || wave === 20 || wave === 30 || wave === 40) {
        setTimeout(() => showBanner(`🔥 Welle ${wave} — Es wird ernst!`), 400);
    }

    // Update wave high score
    if (wave > sessionWaveHighest) {
        sessionWaveHighest = wave;
        localStorage.setItem('tdWaveHigh', String(wave));
    }

    waveSpawnTimeouts.forEach(t => clearTimeout(t));
    waveSpawnTimeouts = [];

    const roster = buildWaveRoster(wave);
    waveSpawnPending = roster.length;
    _waveRosterTotal = roster.length;

    for (const cfg of roster) {
        const delay = Math.max(50, cfg.delay / gameSpeed);
        const t = setTimeout(() => {
            enemies.push(new Enemy(cfg));
            waveSpawnPending--;
            waveSpawnTimeouts = waveSpawnTimeouts.filter(x => x !== t);
        }, delay);
        waveSpawnTimeouts.push(t);
    }

    updateUI();
}

function checkWaveComplete() {
    if (!waveInProgress) return;
    if (waveSpawnPending > 0 || enemies.length > 0) return;

    waveInProgress = false;
    const bonus = 30 + wave * 12;
    let totalBonus = bonus;
    const bonusParts = [`+${bonus}💰 Wellenbonus`];

    // No-leak bonus: +25 gold if no lives lost this wave
    if (lives >= livesAtWaveStart) {
        const noLeakBonus = 25;
        totalBonus += noLeakBonus;
        bonusParts.push(`+${noLeakBonus}💰 Kein Schaden!`);
        _noLeakCount++;
        if (_noLeakCount >= 3) unlockAchievement('no_leak_3');
    } else {
        _noLeakCount = 0;
    }

    // Interest: 5% of current gold (capped at 80)
    const interest = Math.min(80, Math.floor(gold * 0.05));
    if (interest > 0) {
        totalBonus += interest;
        bonusParts.push(`+${interest}💰 Zinsen (5%)`);
    }

    gold  += totalBonus;
    totalGoldEarned += totalBonus;
    score += wave * 10;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('tdHighScore', String(highScore));
    }

    sfxWaveComplete();
    const shortParts = bonusParts.slice(0, 2).join(' · ');
    showBanner(`🌊 Welle ${wave}! ${shortParts}`);
    checkAchievements();
    updateUI();

    // Auto-save between waves (silent)
    try {
        const autoData = {
            gold, lives, wave, score, highScore,
            towers: towers.map(t => ({
                gx: t.gridX, gy: t.gridY, type: t.type,
                level: t.level, kills: t.kills, totalDmg: t.totalDmg,
                targetMode: t.targetMode
            }))
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(autoData));
    } catch(e) { /* storage full, ignore */ }

    // Auto-wave countdown
    if (autoWave) {
        startAutoWaveCountdown();
    }
}

function startAutoWaveCountdown() {
    const COUNTDOWN_S = 5;
    autoWaveCountdown = COUNTDOWN_S;
    updateAutoWaveDisplay();
    const tick = () => {
        autoWaveCountdown--;
        updateAutoWaveDisplay();
        if (autoWaveCountdown <= 0) {
            spawnWave();
        } else {
            autoWaveTimer = setTimeout(tick, 1000);
        }
    };
    autoWaveTimer = setTimeout(tick, 1000);
}

function updateAutoWaveDisplay() {
    const el = document.getElementById('autoWaveStatus');
    if (!el) return;
    if (autoWaveCountdown > 0) {
        el.textContent = `⏱ Nächste Welle in ${autoWaveCountdown}s`;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// ================================================================
// BOSS HP BAR (rendered at top of canvas during boss waves)
// ================================================================
function drawBossBar() {
    const boss = enemies.find(e => e.icon === '💀');
    if (!boss) return;

    const barW = canvas.width * 0.55;
    const barH = 20;
    const barX = (canvas.width - barW) / 2;
    const barY = 8;
    const hRatio = boss.health / boss.maxHealth;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(barX - 60, barY - 4, barW + 70, barH + 8, 8);
    ctx.fill();

    // HP bar track
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // HP fill (purple gradient)
    const grad = ctx.createLinearGradient(barX, 0, barX + barW * hRatio, 0);
    grad.addColorStop(0, '#9C27B0');
    grad.addColorStop(1, '#E040FB');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * hRatio, barH, 4);
    ctx.fill();

    // Label
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.fillText(`💀 BOSS  ${Math.ceil(boss.health).toLocaleString()} / ${boss.maxHealth.toLocaleString()}`,
                 canvas.width / 2, barY + barH / 2);
}

// ================================================================
// WAVE PROGRESS BAR
// ================================================================
function drawWaveProgress() {
    if (!waveInProgress) return;
    const roster = _waveRosterTotal;
    if (!roster || roster === 0) return;
    const remaining = waveSpawnPending + enemies.length;
    const done = Math.max(0, roster - remaining);
    const progress = Math.min(1, done / roster);

    const barW = 200;
    const barH = 6;
    const barX = canvas.width / 2 - barW / 2;
    const barY = canvas.height - 14;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 4);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();

    const grad2 = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad2.addColorStop(0, '#4CAF50');
    grad2.addColorStop(1, '#8BC34A');
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * progress, barH, 3);
    ctx.fill();
}

let _waveRosterTotal = 0; // set when wave starts

// ================================================================
// WAVE PREVIEW
// ================================================================
let _wavePreviewCache = { wave: -1, inProgress: null };

function updateWavePreview() {
    const el = document.getElementById('wavePreview');
    if (!el) return;
    // Only recalculate when state changes
    if (_wavePreviewCache.wave === wave && _wavePreviewCache.inProgress === waveInProgress) return;
    _wavePreviewCache = { wave, inProgress: waveInProgress };

    if (waveInProgress) {
        el.innerHTML = '<span class="wp-active">🌊 Welle läuft...</span>';
        return;
    }

    const nextWave = wave + 1;
    const roster = buildWaveRoster(nextWave);
    const counts = { normal: 0, fast: 0, tank: 0, mutant: 0, mech: 0, boss: 0 };
    for (const c of roster) {
        if (c.icon === '💀')      counts.boss++;
        else if (c.icon === '🧬') counts.mutant++;
        else if (c.icon === '🔩') counts.mech++;
        else if (c.isTank)        counts.tank++;
        else if (c.isFast)        counts.fast++;
        else                      counts.normal++;
    }

    const parts = [];
    if (counts.normal) parts.push(`<span>👾×${counts.normal}</span>`);
    if (counts.fast)   parts.push(`<span>🏃×${counts.fast}</span>`);
    if (counts.tank)   parts.push(`<span>🛡️×${counts.tank}</span>`);
    if (counts.mutant) parts.push(`<span class="wp-mutant">🧬×${counts.mutant}</span>`);
    if (counts.mech)   parts.push(`<span class="wp-mech">🔩×${counts.mech}</span>`);
    if (counts.boss)   parts.push(`<span class="wp-boss">💀 BOSS!</span>`);

    el.innerHTML = `<strong>Welle ${nextWave}:</strong> ${parts.join(' ')}`;
}

function showBanner(msg) {
    const el = document.getElementById('waveBanner');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2800);
}

// ================================================================
// UI UPDATE
// ================================================================
function updateUI() {
    document.getElementById('gold').textContent      = gold;
    document.getElementById('lives').textContent     = lives;
    document.getElementById('wave').textContent      = wave;
    document.getElementById('score').textContent     = score;
    document.getElementById('highscore').textContent = highScore;
    const mapNameEl = document.getElementById('mapName');
    if (mapNameEl) mapNameEl.textContent = ALL_MAPS[selectedMapIndex].name;

    document.querySelectorAll('.tower-btn').forEach(btn => {
        btn.classList.toggle('disabled', gold < parseInt(btn.dataset.cost));
    });

    const startBtn = document.getElementById('startWave');
    startBtn.disabled = waveInProgress;
    startBtn.textContent = waveInProgress ? '⏳ Läuft...' : '▶️ Welle starten';

    updateTowerPanel();
    updateWavePreview();

    // Enemy counter (only show during wave)
    const ecWrap = document.getElementById('enemiesStatWrapper');
    if (ecWrap) {
        if (waveInProgress || enemies.length > 0) {
            ecWrap.style.display = 'flex';
            const total = waveSpawnPending + enemies.length;
            document.getElementById('enemyCount').textContent = total;
        } else {
            ecWrap.style.display = 'none';
        }
    }
}

function updateTowerPanel() {
    const panel = document.getElementById('towerInfo');
    if (!selectedTower) { panel.style.display = 'none'; return; }

    const t = selectedTower;
    const s = t.getStats();
    const uc = t.getUpgradeCost();
    const sv = t.getSellValue();
    const lvlNames = ['', '★', '★★'];

    panel.style.display = 'block';
    document.getElementById('towerInfoName').textContent =
        `${t.config.icon} ${t.config.name} ${lvlNames[t.level - 1] || '★★★'}`;

    const dps = (s.damage * (1000 / s.fireRate)).toFixed(1);
    const chainNote = t.config.chainHits ? ` ×${t.config.chainHits + 1}` : '';
    const poisonNote = t.config.poisonDPS
        ? `<span>🧪 ${t.config.poisonDPS}/s DoT</span>`
        : '';
    const auraNote = t.config.isAura
        ? `<span title="Hits ALL enemies in range">🧲 Alle Gegner</span>`
        : '';
    const synergyBonus = t.getSynergyBonus();
    const synergyNote = synergyBonus > 0
        ? `<span title="Synergy: +${Math.round(synergyBonus*100)}% dmg">🔗 +${Math.round(synergyBonus*100)}% Syn</span>`
        : '';
    document.getElementById('towerInfoStats').innerHTML =
        `<span>💥 ${Math.round(s.damage)}${chainNote}</span>` +
        `<span>📏 ${Math.round(s.range)}</span>` +
        `<span>🔥 ${(1000 / s.fireRate).toFixed(1)}/s</span>` +
        `<span>📊 ${dps} DPS</span>` +
        poisonNote + auraNote +
        synergyNote +
        `<span>🎯 ${t.kills} kills</span>` +
        `<span>💢 ${Math.floor(t.totalDmg).toLocaleString()}</span>`;

    const upgradeBtn = document.getElementById('upgradeTower');
    if (uc !== null) {
        upgradeBtn.style.display = 'block';
        upgradeBtn.textContent   = `⬆ Upgrade ${uc}💰`;
        upgradeBtn.disabled      = gold < uc;
    } else {
        upgradeBtn.style.display = 'block';
        upgradeBtn.textContent   = '✨ Max Level';
        upgradeBtn.disabled      = true;
    }

    document.getElementById('sellTower').textContent = `💸 Sell ${sv}💰`;
    document.getElementById('sellTower').disabled    = false;

    // Sync targeting mode buttons
    document.querySelectorAll('.tm-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === t.targetMode);
    });
}

// ================================================================
// GAME OVER
// ================================================================
function triggerGameOver() {
    gameRunning = false;
    waveSpawnTimeouts.forEach(t => clearTimeout(t));
    waveSpawnTimeouts = [];
    clearTimeout(autoWaveTimer);
    sfxGameOver();

    // Save to leaderboard
    const lb = addToLeaderboard(score, wave);

    // Time played
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    // Build tower stats summary (top 4 by kills)
    const towerStats = towers
        .filter(t => t.kills > 0)
        .sort((a, b) => b.kills - a.kills)
        .slice(0, 3)
        .map(t => `${t.config.icon} <strong>${t.config.name} L${t.level}</strong>: ${t.kills}x`)
        .join(' &nbsp;·&nbsp; ');

    const ol = document.getElementById('gameOverlay');
    document.getElementById('overlayTitle').textContent = '💀 Game Over!';
    document.getElementById('overlayMessage').innerHTML =
        `Welle <strong>${wave}</strong> &nbsp;|&nbsp; Score: <strong>${score.toLocaleString()}</strong><br>` +
        `Zeit: ${timeStr} &nbsp;|&nbsp; 👾 ${totalKills} Kills &nbsp;|&nbsp; 💥 ${Math.floor(totalDamageDealt).toLocaleString()}<br>` +
        (towerStats ? `<div class="go-tower-stats"><strong>Top Türme:</strong> ${towerStats}</div>` : '') +
        renderLeaderboard();
    document.getElementById('overlayBtn').textContent = '🔄 Neu starten';
    ol.style.display = 'flex';
}

function resetGame() {
    waveSpawnTimeouts.forEach(t => clearTimeout(t));
    waveSpawnTimeouts = [];

    gold = 200; lives = 20; wave = 0; score = 0;
    totalKills = 0; totalGoldEarned = 0; totalDamageDealt = 0;
    gameStartTime = Date.now();
    towers = []; enemies = []; projectiles = [];
    particles = []; textParticles = [];
    selectedTower = null; selectedTowerType = null;
    waveInProgress = false; gamePaused = false;
    waveSpawnPending = 0; lastTimestamp = 0; hoverCell = null;
    gameSpeed = 1; autoWaveCountdown = 0; screenFlash = 0; shakeAmount = 0;
    damageBoostMult = 1.0; damageBoostEnd = 0; prevBoostActive = false;
    recentKillTimes = []; comboActive = false; _noLeakCount = 0;
    clearTimeout(autoWaveTimer); autoWaveTimer = null;
    updateAutoWaveDisplay();

    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('gameOverlay').style.display = 'none';
    document.getElementById('pauseBtn').textContent = '⏸ Pause';
    document.getElementById('speedBtn').textContent = '1x ⏩';
    const awb = document.getElementById('autoWaveBtn');
    if (awb) { awb.checked = false; autoWave = false; }

    // Show difficulty screen again (but keep current difficulty as default)
    showDifficultyScreen();

    if (!gameRunning) {
        gameRunning = true;
        requestAnimationFrame(gameLoop);
    }
    updateUI();
}

// ================================================================
// MAIN GAME LOOP
// ================================================================
function gameLoop(timestamp) {
    lastTimestamp = timestamp;

    if (!gamePaused) {
        const now = Date.now();

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        applyShake();

        drawBackground();
        drawGrid();
        drawPath();
        drawHoverCell();

        towers.forEach(t => { t.update(now); t.draw(); });
        drawSynergyLines();

        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const reachedExit = e.update(now);
            if (e.health <= 0) {
                // DOT kill — attribute to poison tower
                if (e.poisonSource) e.poisonSource.kills++;
                killEnemy(i);
            } else if (reachedExit) {
                lives--;
                spawnExplosion(e.x, e.y, '#F44336', 8);
                sfxLifeLost();
                triggerShake(8);
                enemies.splice(i, 1);
                if (lives <= 0) { triggerGameOver(); return; }
            } else {
                e.draw();
            }
        }

        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.update(now);
            if (!p.active) projectiles.splice(i, 1);
            else p.draw();
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            if (particles[i].update()) particles.splice(i, 1);
            else particles[i].draw();
        }

        updateTextParticles();
        ctx.restore(); // end shake transform

        // Boss HP bar (drawn after ctx.restore so it doesn't shake)
        drawBossBar();

        // Wave progress bar
        drawWaveProgress();

        // Surge timer HUD
        const boostActive = Date.now() < damageBoostEnd;
        if (boostActive) {
            const rem = Math.ceil((damageBoostEnd - Date.now()) / 1000);
            const alpha = rem < 5 ? 0.7 + Math.sin(Date.now() / 200) * 0.3 : 0.9;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.beginPath();
            ctx.roundRect(canvas.width / 2 - 90, canvas.height - 32, 180, 24, 8);
            ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`⚡ POWER SURGE: ${rem}s`, canvas.width / 2, canvas.height - 20);
            ctx.globalAlpha = 1;
            prevBoostActive = true;
        } else if (prevBoostActive) {
            prevBoostActive = false;
            showBanner('⚡ Power Surge abgelaufen!');
        }

        // Screen flash (boss kill / special events)
        if (screenFlash > 0.01) {
            ctx.fillStyle = `rgba(255,255,255,${screenFlash.toFixed(3)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            screenFlash *= 0.75;
        } else {
            screenFlash = 0;
        }

        checkWaveComplete();
        updateUI();
    }

    if (gameRunning) requestAnimationFrame(gameLoop);
}

// ================================================================
// EVENT LISTENERS
// ================================================================
// Touch support
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.touches[0];
    const r  = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const cx = (touch.clientX - r.left) * sx;
    const cy = (touch.clientY - r.top)  * sy;

    if (selectedTowerType) {
        hoverCell = { x: Math.floor(cx / CELL_SIZE), y: Math.floor(cy / CELL_SIZE) };
    }
    // Simulate mouse click at touch position
    canvas.dispatchEvent(new MouseEvent('click', {
        clientX: touch.clientX, clientY: touch.clientY, bubbles: false
    }));
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = e.touches[0];
    const r  = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const cx = (touch.clientX - r.left) * sx;
    const cy = (touch.clientY - r.top)  * sy;
    hoverCell = selectedTowerType
        ? { x: Math.floor(cx / CELL_SIZE), y: Math.floor(cy / CELL_SIZE) }
        : null;
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (!selectedTowerType) hoverCell = null;
}, { passive: false });

canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const cx = (e.clientX - r.left) * sx;
    const cy = (e.clientY - r.top)  * sy;
    hoverCell = selectedTowerType
        ? { x: Math.floor(cx / CELL_SIZE), y: Math.floor(cy / CELL_SIZE) }
        : null;
});

canvas.addEventListener('mouseleave', () => { hoverCell = null; });

// Right-click to sell selected tower
canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (selectedTower) {
        const refund = selectedTower.getSellValue();
        gold += refund;
        sfxSell();
        spawnFloatText(selectedTower.x, selectedTower.y - 20, `+${refund}💰`, '#FFD700');
        towers.splice(towers.indexOf(selectedTower), 1);
        selectedTower = null;
        updateUI();
    }
});

canvas.addEventListener('click', e => {
    const r  = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const cx = (e.clientX - r.left) * sx;
    const cy = (e.clientY - r.top)  * sy;
    const gx = Math.floor(cx / CELL_SIZE);
    const gy = Math.floor(cy / CELL_SIZE);

    const clicked = towers.find(t => t.gridX === gx && t.gridY === gy);

    if (clicked && !selectedTowerType) {
        selectedTower = (selectedTower === clicked) ? null : clicked;
        updateUI();
        return;
    }

    if (selectedTowerType) {
        const cfg = TOWER_TYPES[selectedTowerType];
        if (gold >= cfg.cost) {
            const key = `${gx},${gy}`;
            const ok  = !pathCells.has(key) &&
                        !towers.some(t => t.gridX === gx && t.gridY === gy) &&
                        gx >= 0 && gx < GRID_WIDTH && gy >= 0 && gy < GRID_HEIGHT;
            if (ok) {
                gold -= cfg.cost;
                towers.push(new Tower(cx, cy, selectedTowerType));
                sfxPlace();
                checkAchievements();
                if (!e.shiftKey) {
                    selectedTowerType = null;
                    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
                }
                updateUI();
                return;
            }
        }
    }

    selectedTower = null;
    updateUI();
});

document.querySelectorAll('.tower-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (gold < parseInt(btn.dataset.cost)) return;
        selectedTowerType = (selectedTowerType === type) ? null : type;
        selectedTower = null;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        if (selectedTowerType) btn.classList.add('selected');
        updateUI();
    });

    btn.addEventListener('mouseenter', e => {
        const type = btn.dataset.type;
        const cfg = TOWER_TYPES[type];
        if (!cfg) return;
        const dps = (cfg.damage * 1000 / cfg.fireRate).toFixed(1);
        const extra = cfg.isAura         ? `<div class="tt-stat"><span class="tt-stat-label">🧲 Typ</span><span class="tt-stat-value">Aura — trifft ALLE</span></div>` :
                      cfg.splashRadius  ? `<div class="tt-stat"><span class="tt-stat-label">💥 Splash</span><span class="tt-stat-value">${cfg.splashRadius}px</span></div>` :
                      cfg.slowAmount    ? `<div class="tt-stat"><span class="tt-stat-label">🧊 Slow</span><span class="tt-stat-value">${Math.round((1-cfg.slowAmount)*100)}% für ${cfg.slowDuration/1000}s</span></div>` :
                      cfg.chainHits     ? `<div class="tt-stat"><span class="tt-stat-label">⚡ Kette</span><span class="tt-stat-value">${cfg.chainHits} Bounces</span></div>` :
                      cfg.poisonDPS     ? `<div class="tt-stat"><span class="tt-stat-label">🧪 DoT</span><span class="tt-stat-value">${cfg.poisonDPS}/s für ${cfg.poisonDuration/1000}s</span></div>` : '';
        const tt = document.getElementById('towerTooltip');
        tt.innerHTML = `<div class="tt-title">${cfg.icon} ${cfg.name}</div>` +
            `<div class="tt-desc">${cfg.desc}</div>` +
            `<div class="tt-stat"><span class="tt-stat-label">💥 Schaden</span><span class="tt-stat-value">${cfg.damage}</span></div>` +
            `<div class="tt-stat"><span class="tt-stat-label">📏 Reichweite</span><span class="tt-stat-value">${cfg.range}px</span></div>` +
            `<div class="tt-stat"><span class="tt-stat-label">🔥 Rate</span><span class="tt-stat-value">${(1000/cfg.fireRate).toFixed(1)}/s</span></div>` +
            `<div class="tt-stat"><span class="tt-stat-label">📊 DPS</span><span class="tt-stat-value">${dps}</span></div>` +
            extra;
        const r = btn.getBoundingClientRect();
        tt.style.display = 'block';
        tt.style.top  = `${Math.max(8, r.top - 10)}px`;
        // Prefer right side, but flip left if would overflow
        const ttW = tt.offsetWidth || 220;
        const leftPos = r.right + 8;
        tt.style.left = (leftPos + ttW < window.innerWidth - 8)
            ? `${leftPos}px`
            : `${Math.max(4, r.left - ttW - 8)}px`;
    });

    btn.addEventListener('mouseleave', () => {
        document.getElementById('towerTooltip').style.display = 'none';
    });
});

document.getElementById('startWave').addEventListener('click', () => {
    if (!waveInProgress) spawnWave();
});

document.getElementById('pauseBtn').addEventListener('click', () => {
    gamePaused = !gamePaused;
    document.getElementById('pauseBtn').textContent = gamePaused ? '▶ Weiter' : '⏸ Pause';
});

document.getElementById('speedBtn').addEventListener('click', () => {
    // Speed change allowed anytime — spawn delays are pre-calculated,
    // but enemy movement + fire rates scale with gameSpeed live
    gameSpeed = gameSpeed === 1 ? 2 : gameSpeed === 2 ? 3 : 1;
    document.getElementById('speedBtn').textContent = `${gameSpeed}x ⏩`;
});

document.getElementById('sellTower').addEventListener('click', () => {
    if (!selectedTower) return;
    gold += selectedTower.getSellValue();
    sfxSell();
    towers.splice(towers.indexOf(selectedTower), 1);
    selectedTower = null;
    updateUI();
});

document.getElementById('upgradeTower').addEventListener('click', () => {
    if (!selectedTower || selectedTower.level >= 3) return;
    const cost = selectedTower.getUpgradeCost();
    if (cost !== null && gold >= cost) {
        gold -= cost;
        selectedTower.level++;
        sfxUpgrade();
        checkAchievements();
        updateUI();
    }
});

document.getElementById('overlayBtn').addEventListener('click', resetGame);

let pausedBeforeHelp = false;

document.getElementById('helpBtn').addEventListener('click', () => {
    pausedBeforeHelp = gamePaused;
    gamePaused = true;
    document.getElementById('helpModal').style.display = 'flex';
    document.getElementById('pauseBtn').textContent = '▶ Weiter';
});

document.getElementById('achBtn').addEventListener('click', () => {
    const content = document.getElementById('achContent');
    if (content) content.innerHTML = renderAchievementsModal();
    const wasRunning = !gamePaused;
    if (wasRunning) { gamePaused = true; document.getElementById('pauseBtn').textContent = '▶ Weiter'; }
    const modal = document.getElementById('achModal');
    if (modal) { modal.style.display = 'flex'; modal.dataset.wasRunning = wasRunning ? '1' : '0'; }
});

document.getElementById('closeAch').addEventListener('click', () => {
    const modal = document.getElementById('achModal');
    if (!modal) return;
    modal.style.display = 'none';
    if (modal.dataset.wasRunning === '1') {
        gamePaused = false;
        document.getElementById('pauseBtn').textContent = '⏸ Pause';
    }
});

document.getElementById('closeHelp').addEventListener('click', () => {
    document.getElementById('helpModal').style.display = 'none';
    gamePaused = pausedBeforeHelp; // restore pre-help pause state
    document.getElementById('pauseBtn').textContent = gamePaused ? '▶ Weiter' : '⏸ Pause';
});

// Targeting mode buttons (in tower info panel)
document.querySelectorAll('.tm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!selectedTower) return;
        selectedTower.targetMode = btn.dataset.mode;
        selectedTower.target = null; // force re-target
        document.querySelectorAll('.tm-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

document.getElementById('soundBtn').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.getElementById('soundBtn').textContent = soundEnabled ? '🔊 Sound' : '🔇 Stumm';
});

document.getElementById('autoWaveBtn').addEventListener('change', e => {
    autoWave = e.target.checked;
    if (!autoWave) {
        clearTimeout(autoWaveTimer);
        autoWaveTimer = null;
        autoWaveCountdown = 0;
        updateAutoWaveDisplay();
    } else if (!waveInProgress && wave > 0) {
        // Start countdown immediately if a wave was already played
        startAutoWaveCountdown();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P' || e.key === ' ') {
        e.preventDefault();
        document.getElementById('pauseBtn').click();
    }
    if (e.key === 'Escape') {
        selectedTowerType = null;
        selectedTower = null;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        updateUI();
    }
    if (e.key === 'Enter' && !waveInProgress) {
        document.getElementById('startWave').click();
    }

    // Number keys 1-9 for tower selection
    const towerKeys = ['1','2','3','4','5','6','7','8','9'];
    const towerOrder = ['basic','heavy','fast','slow','sniper','area','arc','poison','pulse'];
    const ki = towerKeys.indexOf(e.key);
    if (ki !== -1) {
        const type = towerOrder[ki];
        const cfg  = TOWER_TYPES[type];
        if (gold >= cfg.cost) {
            selectedTowerType = (selectedTowerType === type) ? null : type;
            selectedTower = null;
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
            if (selectedTowerType) {
                const btn = document.querySelector(`.tower-btn[data-type="${type}"]`);
                if (btn) btn.classList.add('selected');
            }
            updateUI();
        }
    }
});

// ================================================================
// SAVE / LOAD (between waves only)
// ================================================================
const SAVE_KEY = 'tdSaveV2';

function saveGame() {
    if (waveInProgress) return; // only save between waves
    const data = {
        gold, lives, wave, score, highScore,
        towers: towers.map(t => ({
            gx: t.gridX, gy: t.gridY, type: t.type,
            level: t.level, kills: t.kills, totalDmg: t.totalDmg,
            targetMode: t.targetMode
        }))
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    showBanner('💾 Gespeichert!');
}

function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { showBanner('❌ Kein Speicherstand!'); return; }
    try {
        const data = JSON.parse(raw);
        resetGame();
        // Wait one frame so resetGame completes
        requestAnimationFrame(() => {
            gold = data.gold || 200;
            lives = data.lives || 20;
            wave = data.wave || 0;
            score = data.score || 0;
            highScore = Math.max(highScore, data.highScore || 0);
            localStorage.setItem('tdHighScore', String(highScore));

            for (const td of (data.towers || [])) {
                const t = new Tower(
                    td.gx * CELL_SIZE + CELL_SIZE / 2,
                    td.gy * CELL_SIZE + CELL_SIZE / 2,
                    td.type
                );
                t.level = td.level || 1;
                t.kills = td.kills || 0;
                t.totalDmg = td.totalDmg || 0;
                t.targetMode = td.targetMode || 'first';
                towers.push(t);
            }
            updateUI();
            showBanner(`📂 Geladen! Welle ${wave} fortgesetzt`);
        });
    } catch(e) {
        showBanner('❌ Ladefehler!');
    }
}

// Save/load keyboard shortcuts
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveGame(); }
    if (e.ctrlKey && e.key === 'l') { e.preventDefault(); loadGame(); }
});

// ================================================================
// LEADERBOARD
// ================================================================
const LB_KEY = 'tdLeaderboardV2';

function getLeaderboard() {
    return JSON.parse(localStorage.getItem(LB_KEY) || '[]');
}

function addToLeaderboard(scr, wv) {
    const lb = getLeaderboard();
    lb.push({ score: scr, wave: wv, date: new Date().toLocaleDateString('de-DE') });
    lb.sort((a, b) => b.score - a.score);
    lb.splice(5);
    localStorage.setItem(LB_KEY, JSON.stringify(lb));
    return lb;
}

function renderLeaderboard() {
    const lb = getLeaderboard();
    if (lb.length === 0) return '';
    const rows = lb.map((e, i) =>
        `<tr><td>${['🥇','🥈','🥉','4.','5.'][i]}</td>` +
        `<td><strong>${e.score.toLocaleString()}</strong></td>` +
        `<td>W${e.wave}</td><td>${e.date}</td></tr>`
    ).join('');
    return `<div class="go-tower-stats"><strong>🏆 Bestenliste:</strong>` +
           `<table class="lb-table">${rows}</table></div>`;
}

// ================================================================
// ACHIEVEMENT SYSTEM
// ================================================================
const ACH_KEY = 'tdAchievementsV1';

const ACHIEVEMENTS = [
    { id: 'first_kill',     icon: '🎯', name: 'Erster Kill',       desc: 'Ersten Gegner töten' },
    { id: 'first_tower',    icon: '🗼', name: 'Turmbauer',          desc: 'Ersten Turm platzieren' },
    { id: 'wave_5',         icon: '🌊', name: 'Veteran',            desc: 'Welle 5 überstehen' },
    { id: 'wave_10',        icon: '🔥', name: 'Kämpfer',            desc: 'Welle 10 überstehen' },
    { id: 'wave_15',        icon: '⚔️', name: 'Krieger',            desc: 'Welle 15 überstehen' },
    { id: 'wave_20',        icon: '🏆', name: 'Meister',            desc: 'Welle 20 erreichen' },
    { id: 'wave_25',        icon: '🌟', name: 'Legende',            desc: 'Welle 25 erreichen' },
    { id: 'kills_100',      icon: '🎖', name: 'Hundert',            desc: '100 Gegner besiegt' },
    { id: 'kills_500',      icon: '🏅', name: 'Fünfhundert',        desc: '500 Gegner besiegt' },
    { id: 'kills_1000',     icon: '💫', name: 'Tausend Kills',      desc: '1000 Gegner besiegt' },
    { id: 'towers_10',      icon: '🏰', name: 'Festung',            desc: '10 Türme gebaut' },
    { id: 'max_tower',      icon: '⭐', name: 'Meister-Schmied',    desc: 'Turm auf Max-Level' },
    { id: 'combo',          icon: '🔥', name: 'Combo King',         desc: 'Ersten Combo ausgelöst' },
    { id: 'boss_kill',      icon: '💀', name: 'Bossbesieger',       desc: 'Ersten Boss besiegt' },
    { id: 'no_leak_3',      icon: '🛡', name: 'Unberührbar',        desc: '3 Wellen ohne Schaden' },
    { id: 'gold_2000',      icon: '💰', name: 'Reicher',            desc: '2000 Gold verdient' },
    { id: 'gold_5000',      icon: '💎', name: 'Millionär',          desc: '5000 Gold verdient' },
    { id: 'poison_use',     icon: '🧪', name: 'Giftmischer',        desc: 'Poison Tower platziert' },
    { id: 'mutant_kill',    icon: '🧬', name: 'Mutation gestoppt',  desc: 'Ersten Mutanten besiegt' },
    { id: 'full_upgrade',   icon: '🚀', name: 'Power-Up!',          desc: 'Power Surge aktiviert' },
];

let _achUnlocked = new Set(JSON.parse(localStorage.getItem(ACH_KEY) || '[]'));
let _noLeakCount = 0; // consecutive waves without lives lost

function saveAchievements() {
    localStorage.setItem(ACH_KEY, JSON.stringify([..._achUnlocked]));
}

function unlockAchievement(id) {
    if (_achUnlocked.has(id)) return;
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return;
    _achUnlocked.add(id);
    saveAchievements();
    // Show a special banner (different color)
    showAchievementToast(ach);
    if (soundEnabled) {
        // Short celebratory jingle
        [660, 880, 1100].forEach((f, i) => setTimeout(() =>
            _tone({ freq: f, type: 'sine', dur: 0.08, vol: 0.25, decay: 0.10 }), i * 60));
    }
}

let _achToastQueue = [];
let _achToastActive = false;

function showAchievementToast(ach) {
    _achToastQueue.push(ach);
    if (!_achToastActive) processAchievementToastQueue();
}

function processAchievementToastQueue() {
    if (_achToastQueue.length === 0) { _achToastActive = false; return; }
    _achToastActive = true;
    const ach = _achToastQueue.shift();
    const toast = document.getElementById('achToast');
    if (!toast) return;
    toast.innerHTML = `${ach.icon} <strong>${ach.name}</strong><br><small>${ach.desc}</small>`;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(processAchievementToastQueue, 400);
    }, 2600);
}

function checkAchievements() {
    if (towers.length >= 1)    unlockAchievement('first_tower');
    if (towers.some(t => t.type === 'poison')) unlockAchievement('poison_use');
    if (towers.some(t => t.level >= 3)) unlockAchievement('max_tower');
    if (totalKills >= 1)       unlockAchievement('first_kill');
    if (totalKills >= 100)     unlockAchievement('kills_100');
    if (totalKills >= 500)     unlockAchievement('kills_500');
    if (totalKills >= 1000)    unlockAchievement('kills_1000');
    if (towers.length >= 10)   unlockAchievement('towers_10');
    if (wave >= 5)             unlockAchievement('wave_5');
    if (wave >= 10)            unlockAchievement('wave_10');
    if (wave >= 15)            unlockAchievement('wave_15');
    if (wave >= 20)            unlockAchievement('wave_20');
    if (wave >= 25)            unlockAchievement('wave_25');
    if (totalGoldEarned >= 2000)  unlockAchievement('gold_2000');
    if (totalGoldEarned >= 5000)  unlockAchievement('gold_5000');
    if (Date.now() < damageBoostEnd) unlockAchievement('full_upgrade');
}

function renderAchievementsModal() {
    const rows = ACHIEVEMENTS.map(a => {
        const done = _achUnlocked.has(a.id);
        return `<div class="ach-item ${done ? 'ach-done' : 'ach-locked'}">
            <span class="ach-icon">${done ? a.icon : '🔒'}</span>
            <div class="ach-info">
                <strong>${done ? a.name : '???'}</strong>
                <small>${done ? a.desc : 'Noch nicht freigeschaltet'}</small>
            </div>
            ${done ? '<span class="ach-check">✓</span>' : ''}
        </div>`;
    }).join('');
    return `<div class="ach-grid">${rows}</div>
        <p style="text-align:center;color:#aaa;margin-top:8px;font-size:12px;">
            ${_achUnlocked.size}/${ACHIEVEMENTS.length} freigeschaltet
        </p>`;
}

// ================================================================
// RESPONSIVE CANVAS
// ================================================================
function resizeCanvas() {
    const wrapper = canvas.parentElement;
    const availW = wrapper ? wrapper.clientWidth : window.innerWidth - 40;
    const maxW = Math.min(availW, 800);
    if (maxW < 800) {
        canvas.style.width  = `${maxW}px`;
        canvas.style.height = `${Math.round(600 * maxW / 800)}px`;
    } else {
        canvas.style.width  = '';
        canvas.style.height = '';
    }
}

window.addEventListener('resize', resizeCanvas);

// ================================================================
// DIFFICULTY SELECT
// ================================================================
let selectedDifficulty = 'normal';

function showDifficultyScreen() {
    // Populate leaderboard preview
    const lb = getLeaderboard();
    const lbEl = document.getElementById('startLb');
    if (lbEl && lb.length > 0) {
        const top3 = lb.slice(0, 3).map((e, i) =>
            `${['🥇','🥈','🥉'][i]} <strong>${e.score.toLocaleString()}</strong> — W${e.wave} (${e.date})`
        ).join('<br>');
        lbEl.innerHTML = `<strong>🏆 Bestenliste:</strong><br>${top3}`;
    }
    // Sync map button active state
    document.querySelectorAll('.map-btn').forEach(btn => {
        btn.classList.toggle('map-active', parseInt(btn.dataset.map) === selectedMapIndex);
    });
    document.getElementById('difficultyOverlay').style.display = 'flex';
}

document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const startGold  = parseInt(btn.dataset.gold);
        const startLives = parseInt(btn.dataset.lives);
        selectedDifficulty = btn.classList.contains('diff-easy')   ? 'easy'
                           : btn.classList.contains('diff-hard')   ? 'hard'
                           : 'normal';
        gold  = startGold;
        lives = startLives;
        livesAtWaveStart = startLives;
        document.getElementById('difficultyOverlay').style.display = 'none';
        updateUI();
    });
});

document.querySelectorAll('.map-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.map);
        selectMap(idx);
        document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('map-active'));
        btn.classList.add('map-active');
    });
});

// ================================================================
// INIT
// ================================================================
showDifficultyScreen();
gameRunning = true;
updateUI();
resizeCanvas();
requestAnimationFrame(gameLoop);
