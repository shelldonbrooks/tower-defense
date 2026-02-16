// Game configuration
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CELL_SIZE = 40;
const GRID_WIDTH = 20;
const GRID_HEIGHT = 15;

// Game state
let gold = 200;
let lives = 20;
let wave = 0;
let selectedTowerType = null;
let selectedTower = null;
let towers = [];
let enemies = [];
let projectiles = [];
let gameRunning = false;
let waveInProgress = false;

// Path for enemies (snake pattern)
const path = [
    {x: 0, y: 7},
    {x: 5, y: 7},
    {x: 5, y: 3},
    {x: 10, y: 3},
    {x: 10, y: 10},
    {x: 15, y: 10},
    {x: 15, y: 5},
    {x: 20, y: 5}
];

// Tower types
const TOWER_TYPES = {
    basic: {
        name: 'Basic',
        cost: 50,
        damage: 10,
        range: 120,
        fireRate: 1000,
        color: '#4CAF50',
        icon: '🎯',
        projectileSpeed: 5
    },
    heavy: {
        name: 'Heavy',
        cost: 100,
        damage: 30,
        range: 100,
        fireRate: 2000,
        color: '#F44336',
        icon: '💣',
        projectileSpeed: 3
    },
    fast: {
        name: 'Fast',
        cost: 80,
        damage: 5,
        range: 140,
        fireRate: 300,
        color: '#2196F3',
        icon: '⚡',
        projectileSpeed: 8
    }
};

// Enemy class
class Enemy {
    constructor(health, speed, reward, pathIndex = 0) {
        this.health = health;
        this.maxHealth = health;
        this.speed = speed;
        this.reward = reward;
        this.pathIndex = pathIndex;
        this.x = path[pathIndex].x * CELL_SIZE + CELL_SIZE / 2;
        this.y = path[pathIndex].y * CELL_SIZE + CELL_SIZE / 2;
        this.progress = 0;
    }

    update() {
        if (this.pathIndex >= path.length - 1) {
            return true; // Reached end
        }

        const current = path[this.pathIndex];
        const next = path[this.pathIndex + 1];
        
        const dx = (next.x - current.x) * CELL_SIZE;
        const dy = (next.y - current.y) * CELL_SIZE;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        this.progress += this.speed;
        
        if (this.progress >= distance) {
            this.pathIndex++;
            this.progress = 0;
            if (this.pathIndex < path.length) {
                this.x = path[this.pathIndex].x * CELL_SIZE + CELL_SIZE / 2;
                this.y = path[this.pathIndex].y * CELL_SIZE + CELL_SIZE / 2;
            }
        } else {
            const ratio = this.progress / distance;
            this.x = current.x * CELL_SIZE + CELL_SIZE / 2 + dx * ratio;
            this.y = current.y * CELL_SIZE + CELL_SIZE / 2 + dy * ratio;
        }
        
        return false;
    }

    draw() {
        // Enemy body
        ctx.fillStyle = this.health < this.maxHealth / 2 ? '#FF5722' : '#E91E63';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Health bar
        const barWidth = 20;
        const barHeight = 4;
        const healthRatio = this.health / this.maxHealth;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - barWidth/2, this.y - 20, barWidth, barHeight);
        ctx.fillStyle = healthRatio > 0.5 ? '#4CAF50' : '#F44336';
        ctx.fillRect(this.x - barWidth/2, this.y - 20, barWidth * healthRatio, barHeight);
    }

    takeDamage(damage) {
        this.health -= damage;
        return this.health <= 0;
    }
}

// Tower class
class Tower {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.config = TOWER_TYPES[type];
        this.lastFired = 0;
        this.target = null;
    }

    update(timestamp) {
        // Find target
        if (!this.target || this.target.health <= 0) {
            this.target = this.findTarget();
        }

        // Fire at target
        if (this.target && timestamp - this.lastFired >= this.config.fireRate) {
            this.fire();
            this.lastFired = timestamp;
        }
    }

    findTarget() {
        let closestEnemy = null;
        let maxProgress = -1;

        for (const enemy of enemies) {
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= this.config.range) {
                const totalProgress = enemy.pathIndex * 1000 + enemy.progress;
                if (totalProgress > maxProgress) {
                    maxProgress = totalProgress;
                    closestEnemy = enemy;
                }
            }
        }

        return closestEnemy;
    }

    fire() {
        if (this.target) {
            projectiles.push(new Projectile(
                this.x, 
                this.y, 
                this.target, 
                this.config.damage,
                this.config.projectileSpeed,
                this.config.color
            ));
        }
    }

    draw() {
        // Range indicator when selected
        if (selectedTower === this) {
            ctx.strokeStyle = this.config.color + '40';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.config.range, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Tower base
        ctx.fillStyle = this.config.color;
        ctx.fillRect(this.x - 15, this.y - 15, 30, 30);
        
        // Tower icon
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.config.icon, this.x, this.y);
    }
}

// Projectile class
class Projectile {
    constructor(x, y, target, damage, speed, color) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = speed;
        this.color = color;
        this.active = true;
    }

    update() {
        if (!this.target || this.target.health <= 0) {
            this.active = false;
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.speed) {
            // Hit target
            if (this.target.takeDamage(this.damage)) {
                const index = enemies.indexOf(this.target);
                if (index > -1) {
                    gold += this.target.reward;
                    enemies.splice(index, 1);
                }
            }
            this.active = false;
        } else {
            // Move towards target
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Draw the path
function drawPath() {
    ctx.strokeStyle = '#8D6E63';
    ctx.lineWidth = CELL_SIZE * 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(path[0].x * CELL_SIZE + CELL_SIZE/2, path[0].y * CELL_SIZE + CELL_SIZE/2);
    
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x * CELL_SIZE + CELL_SIZE/2, path[i].y * CELL_SIZE + CELL_SIZE/2);
    }
    
    ctx.stroke();
}

// Draw grid
function drawGrid() {
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// Update UI
function updateUI() {
    document.getElementById('gold').textContent = gold;
    document.getElementById('lives').textContent = lives;
    document.getElementById('wave').textContent = wave;
    
    // Update tower button states
    document.querySelectorAll('.tower-btn').forEach(btn => {
        const cost = parseInt(btn.dataset.cost);
        if (gold < cost) {
            btn.classList.add('disabled');
        } else {
            btn.classList.remove('disabled');
        }
    });
    
    document.getElementById('sellTower').disabled = !selectedTower;
}

// Spawn wave
function spawnWave() {
    if (waveInProgress) return;
    
    wave++;
    waveInProgress = true;
    
    const enemyCount = 5 + wave * 3;
    const enemyHealth = 20 + wave * 10;
    const enemySpeed = 1 + wave * 0.1;
    const enemyReward = 10 + wave * 2;
    
    let spawned = 0;
    const spawnInterval = setInterval(() => {
        enemies.push(new Enemy(enemyHealth, enemySpeed, enemyReward));
        spawned++;
        
        if (spawned >= enemyCount) {
            clearInterval(spawnInterval);
        }
    }, 1000);
}

// Game loop
let lastTimestamp = 0;
function gameLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw elements
    drawGrid();
    drawPath();
    
    // Update and draw towers
    towers.forEach(tower => {
        tower.update(timestamp);
        tower.draw();
    });
    
    // Update and draw enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const reachedEnd = enemy.update();
        
        if (reachedEnd) {
            lives--;
            enemies.splice(i, 1);
            
            if (lives <= 0) {
                alert('Game Over! Du hast Welle ' + wave + ' erreicht!');
                resetGame();
                return;
            }
        } else {
            enemy.draw();
        }
    }
    
    // Update and draw projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.update();
        
        if (!projectile.active) {
            projectiles.splice(i, 1);
        } else {
            projectile.draw();
        }
    }
    
    // Check if wave is complete
    if (waveInProgress && enemies.length === 0) {
        waveInProgress = false;
        gold += 50; // Wave completion bonus
    }
    
    updateUI();
    
    if (gameRunning) {
        requestAnimationFrame(gameLoop);
    }
}

function resetGame() {
    gold = 200;
    lives = 20;
    wave = 0;
    towers = [];
    enemies = [];
    projectiles = [];
    selectedTower = null;
    selectedTowerType = null;
    waveInProgress = false;
    updateUI();
}

// Event listeners
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on existing tower
    const clickedTower = towers.find(t => 
        Math.abs(t.x - x) < 20 && Math.abs(t.y - y) < 20
    );
    
    if (clickedTower) {
        selectedTower = clickedTower;
        selectedTowerType = null;
        document.querySelectorAll('.tower-btn').forEach(btn => 
            btn.classList.remove('selected')
        );
        return;
    }
    
    // Place new tower
    if (selectedTowerType) {
        const config = TOWER_TYPES[selectedTowerType];
        
        if (gold >= config.cost) {
            // Check if on path
            const gridX = Math.floor(x / CELL_SIZE);
            const gridY = Math.floor(y / CELL_SIZE);
            
            const onPath = path.some(p => p.x === gridX && p.y === gridY);
            
            if (!onPath) {
                // Check if spot is free
                const spotTaken = towers.some(t => 
                    Math.abs(t.x - (gridX * CELL_SIZE + CELL_SIZE/2)) < CELL_SIZE/2 &&
                    Math.abs(t.y - (gridY * CELL_SIZE + CELL_SIZE/2)) < CELL_SIZE/2
                );
                
                if (!spotTaken) {
                    gold -= config.cost;
                    towers.push(new Tower(
                        gridX * CELL_SIZE + CELL_SIZE/2,
                        gridY * CELL_SIZE + CELL_SIZE/2,
                        selectedTowerType
                    ));
                    selectedTowerType = null;
                    document.querySelectorAll('.tower-btn').forEach(btn => 
                        btn.classList.remove('selected')
                    );
                }
            }
        }
    }
    
    selectedTower = null;
});

document.querySelectorAll('.tower-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const cost = parseInt(btn.dataset.cost);
        
        if (gold >= cost) {
            selectedTowerType = type;
            selectedTower = null;
            
            document.querySelectorAll('.tower-btn').forEach(b => 
                b.classList.remove('selected')
            );
            btn.classList.add('selected');
        }
    });
});

document.getElementById('startWave').addEventListener('click', () => {
    if (!waveInProgress) {
        spawnWave();
    }
});

document.getElementById('sellTower').addEventListener('click', () => {
    if (selectedTower) {
        const refund = Math.floor(selectedTower.config.cost * 0.5);
        gold += refund;
        const index = towers.indexOf(selectedTower);
        if (index > -1) {
            towers.splice(index, 1);
        }
        selectedTower = null;
    }
});

// Start game
gameRunning = true;
requestAnimationFrame(gameLoop);
