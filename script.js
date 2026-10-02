const battlefield = document.getElementById("battlefield");
const unitsLayer = document.getElementById("units");
const enemiesLayer = document.getElementById("enemies");
const projectilesLayer = document.getElementById("projectiles");
const effectsLayer = document.getElementById("effects");

const homeScreen = document.getElementById("homeScreen");
const gameScreen = document.getElementById("gameScreen");
const gameOverScreen = document.getElementById("gameOverScreen");

const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const gameOverRestart = document.getElementById("gameOverRestart");

const defencePointsEl = document.getElementById("defencePoints");
const baseHealthEl = document.getElementById("baseHealth");
const enemyCountEl = document.getElementById("enemyCount");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");
const gameTimeEl = document.getElementById("gameTime");
const baseHealthBar = document.getElementById("baseHealthBar");

const selectionText = document.getElementById("selectionText");
const moveMarker = document.getElementById("moveMarker");
const battleMessage = document.getElementById("battleMessage");

const finalScoreEl = document.getElementById("finalScore");
const finalBestEl = document.getElementById("finalBest");
const finalTimeEl = document.getElementById("finalTime");

const unitButtons = document.querySelectorAll(".unit-button");

const UNIT_TYPES = {
    infantry: {
        name: "Infantry",
        cost: 100,
        hp: 100,
        attack: 10,
        range: 100,
        speed: 55,
        cooldown: 700,
        color: "#4ade80"
    },
    tank: {
        name: "Tank",
        cost: 250,
        hp: 200,
        attack: 25,
        range: 150,
        speed: 35,
        cooldown: 1000,
        color: "#f59e0b"
    },
    fighter: {
        name: "Fighter",
        cost: 400,
        hp: 120,
        attack: 35,
        range: 250,
        speed: 110,
        cooldown: 850,
        color: "#60a5fa"
    }
};

const MAX_DEFENCE_POINTS = 1000;
const MAX_UNITS = 10;
const MAX_ENEMIES = 12;

let defencePoints = MAX_DEFENCE_POINTS;
let baseHealth = 1000;
let score = 0;
let gameTime = 0;

let units = [];
let enemies = [];
let projectiles = [];

let selectedType = null;
let running = false;
let gameOver = false;

let lastTime = 0;
let lastHudUpdate = 0;
let spawnTimer = 0;
let enemyId = 0;
let unitId = 0;

let animationFrame = null;

let bestScore = Number(localStorage.getItem("defenceCommandBest")) || 0;

bestScoreEl.textContent = bestScore;


// =========================
// START / RESTART
// =========================

function startGame() {
    cancelAnimationFrame(animationFrame);

    defencePoints = MAX_DEFENCE_POINTS;
    baseHealth = 1000;
    score = 0;
    gameTime = 0;

    units = [];
    enemies = [];
    projectiles = [];

    selectedType = null;
    running = true;
    gameOver = false;

    lastTime = performance.now();
    lastHudUpdate = 0;
    spawnTimer = 0;

    unitsLayer.innerHTML = "";
    enemiesLayer.innerHTML = "";
    projectilesLayer.innerHTML = "";
    effectsLayer.innerHTML = "";

    homeScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");

    selectionText.textContent = "Select a unit";
    battleMessage.textContent = "DEFEND THE BASE";

    updateHUD();

    animationFrame = requestAnimationFrame(gameLoop);
}


function restartGame() {
    startGame();
}


// =========================
// UNIT SELECTION
// =========================

unitButtons.forEach(button => {

    button.addEventListener("click", function(event) {

        event.stopPropagation();

        if (!running) return;

        const type = this.dataset.unit;

        if (!UNIT_TYPES[type]) return;

        if (defencePoints < UNIT_TYPES[type].cost) {
            battleMessage.textContent = "NOT ENOUGH DEFENCE POINTS";
            return;
        }

        selectedType = type;

        unitButtons.forEach(btn => btn.classList.remove("selected"));

        this.classList.add("selected");

        selectionText.textContent =
            `${UNIT_TYPES[type].name} selected — Click battlefield to deploy`;

        battleMessage.textContent = `DEPLOY ${UNIT_TYPES[type].name}`;
    });
});


// =========================
// BATTLEFIELD DEPLOYMENT
// =========================

battlefield.addEventListener("click", function(event) {

    if (!running || gameOver) return;

    if (!selectedType) return;

    if (units.length >= MAX_UNITS) {
        battleMessage.textContent = "MAXIMUM 10 UNITS DEPLOYED";
        return;
    }

    const type = UNIT_TYPES[selectedType];

    if (defencePoints < type.cost) {
        battleMessage.textContent = "NOT ENOUGH DEFENCE POINTS";
        selectedType = null;
        return;
    }

    const rect = battlefield.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (
        x < 20 ||
        y < 20 ||
        x > rect.width - 20 ||
        y > rect.height - 20
    ) {
        return;
    }

    deployUnit(selectedType, x, y);

    selectedType = null;

    unitButtons.forEach(btn => btn.classList.remove("selected"));

    selectionText.textContent = "Select a unit";

    battleMessage.textContent = "UNIT DEPLOYED";
});


// =========================
// DEPLOY UNIT
// =========================

function deployUnit(type, x, y) {

    const data = UNIT_TYPES[type];

    defencePoints -= data.cost;

    const unit = {
        id: ++unitId,
        type,
        x,
        y,
        hp: data.hp,
        maxHp: data.hp,
        attack: data.attack,
        range: data.range,
        speed: data.speed,
        cooldown: 0,
        targetX: x,
        targetY: y,
        element: null,
        healthBar: null
    };

    const element = document.createElement("div");

    element.className = `battle-unit ${type}`;

    element.innerHTML = `
        <div class="unit-icon">${getUnitIcon(type)}</div>
        <div class="unit-health">
            <div class="unit-health-fill"></div>
        </div>
    `;

    unitsLayer.appendChild(element);

    unit.element = element;
    unit.healthBar = element.querySelector(".unit-health-fill");

    units.push(unit);

    updateUnitPosition(unit);
}


// =========================
// UNIT ICONS
// =========================

function getUnitIcon(type) {

    if (type === "infantry") return "●";
    if (type === "tank") return "▰";
    if (type === "fighter") return "✦";

    return "●";
}


// =========================
// ENEMY SPAWNING
// =========================

function spawnEnemy() {

    if (!running) return;

    if (enemies.length >= MAX_ENEMIES) return;

    const rect = battlefield.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) return;

    const side = Math.floor(Math.random() * 4);

    let x;
    let y;

    if (side === 0) {
        x = Math.random() * rect.width;
        y = 10;
    } else if (side === 1) {
        x = rect.width - 10;
        y = Math.random() * rect.height;
    } else if (side === 2) {
        x = Math.random() * rect.width;
        y = rect.height - 10;
    } else {
        x = 10;
        y = Math.random() * rect.height;
    }

    const difficulty = Math.min(gameTime / 120, 1);

    const enemy = {
        id: ++enemyId,
        x,
        y,
        hp: 70 + difficulty * 50,
        maxHp: 70 + difficulty * 50,
        attack: 12 + difficulty * 8,
        speed: 22 + difficulty * 12,
        range: 65,
        cooldown: 0,
        target: null,
        element: null,
        healthBar: null
    };

    const element = document.createElement("div");

    element.className = "enemy";

    element.innerHTML = `
        <div class="enemy-icon">◆</div>
        <div class="enemy-health">
            <div class="enemy-health-fill"></div>
        </div>
    `;

    enemiesLayer.appendChild(element);

    enemy.element = element;
    enemy.healthBar = element.querySelector(".enemy-health-fill");

    enemies.push(enemy);

    updateEnemyPosition(enemy);
}


// =========================
// MAIN GAME LOOP
// =========================

function gameLoop(timestamp) {

    if (!running || gameOver) return;

    let delta = timestamp - lastTime;

    if (delta > 40) delta = 40;

    lastTime = timestamp;

    const dt = delta / 1000;

    gameTime += dt;

    spawnTimer += delta;

    // First enemy after approximately 3 seconds
    if (gameTime >= 3 && spawnTimer >= getSpawnInterval()) {

        spawnTimer = 0;

        spawnEnemy();
    }

    updateUnits(dt);
    updateEnemies(dt);
    updateProjectiles(dt);

    cleanupObjects();

    if (baseHealth <= 0) {
        endGame();
        return;
    }

    if (timestamp - lastHudUpdate >= 100) {
        updateHUD();
        lastHudUpdate = timestamp;
    }

    animationFrame = requestAnimationFrame(gameLoop);
}


// =========================
// SPAWN INTERVAL
// =========================

function getSpawnInterval() {

    const reduction = Math.min(gameTime * 12, 1200);

    return Math.max(1800, 3000 - reduction);
}


// =========================
// UPDATE PLAYER UNITS
// =========================

function updateUnits(dt) {

    for (const unit of units) {

        if (!unit.element) continue;

        unit.cooldown -= dt * 1000;

        const target = findNearestEnemy(unit);

        if (target) {

            const distance = getDistance(
                unit.x,
                unit.y,
                target.x,
                target.y
            );

            if (distance <= unit.range) {

                if (unit.cooldown <= 0) {

                    attackEnemy(unit, target);

                    unit.cooldown = UNIT_TYPES[unit.type].cooldown;
                }

            } else {

                moveUnitTowards(unit, target.x, target.y, dt);
            }
        }

        updateUnitPosition(unit);
    }
}


// =========================
// UNIT MOVEMENT
// =========================

function moveUnitTowards(unit, targetX, targetY, dt) {

    const dx = targetX - unit.x;
    const dy = targetY - unit.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 2) return;

    unit.x += (dx / distance) * unit.speed * dt;
    unit.y += (dy / distance) * unit.speed * dt;
}


// =========================
// PLAYER ATTACK
// =========================

function attackEnemy(unit, enemy) {

    enemy.hp -= unit.attack;

    createProjectile(
        unit.x,
        unit.y,
        enemy.x,
        enemy.y,
        unit.type
    );

    createHitEffect(enemy.x, enemy.y);

    if (enemy.hp <= 0) {

        score += 100;

        enemy.dead = true;

        battleMessage.textContent = "ENEMY DESTROYED";
    }
}


// =========================
// UPDATE ENEMIES
// =========================

function updateEnemies(dt) {

    for (const enemy of enemies) {

        if (enemy.dead) continue;

        enemy.cooldown -= dt * 1000;

        let target = enemy.target;

        if (
            !target ||
            target.dead ||
            !units.includes(target)
        ) {
            target = findNearestUnit(enemy);

            enemy.target = target;
        }

        if (target) {

            const distance = getDistance(
                enemy.x,
                enemy.y,
                target.x,
                target.y
            );

            if (distance <= enemy.range) {

                if (enemy.cooldown <= 0) {

                    target.hp -= enemy.attack;

                    enemy.cooldown = 1000;

                    createHitEffect(target.x, target.y);

                    if (target.hp <= 0) {
                        target.dead = true;
                        enemy.target = null;
                    }
                }

            } else {

                moveEnemyTowards(
                    enemy,
                    target.x,
                    target.y,
                    dt
                );
            }

        } else {

            const rect = battlefield.getBoundingClientRect();

            const baseX = rect.width / 2;
            const baseY = rect.height / 2;

            const distanceToBase = getDistance(
                enemy.x,
                enemy.y,
                baseX,
                baseY
            );

            if (distanceToBase <= 55) {

                if (enemy.cooldown <= 0) {

                    baseHealth -= enemy.attack;

                    enemy.cooldown = 1000;

                    createHitEffect(baseX, baseY);
                }

            } else {

                moveEnemyTowards(
                    enemy,
                    baseX,
                    baseY,
                    dt
                );
            }
        }

        updateEnemyPosition(enemy);
    }
}


// =========================
// ENEMY MOVEMENT
// =========================

function moveEnemyTowards(enemy, targetX, targetY, dt) {

    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 2) return;

    enemy.x += (dx / distance) * enemy.speed * dt;
    enemy.y += (dy / distance) * enemy.speed * dt;
}


// =========================
// FIND TARGETS
// =========================

function findNearestEnemy(unit) {

    let nearest = null;
    let nearestDistance = Infinity;

    for (const enemy of enemies) {

        if (enemy.dead) continue;

        const distance = getDistance(
            unit.x,
            unit.y,
            enemy.x,
            enemy.y
        );

        if (distance < nearestDistance) {

            nearestDistance = distance;
            nearest = enemy;
        }
    }

    return nearest;
}


function findNearestUnit(enemy) {

    let nearest = null;
    let nearestDistance = Infinity;

    for (const unit of units) {

        if (unit.dead) continue;

        const distance = getDistance(
            enemy.x,
            enemy.y,
            unit.x,
            unit.y
        );

        if (distance < nearestDistance) {

            nearestDistance = distance;
            nearest = unit;
        }
    }

    return nearest;
}


// =========================
// PROJECTILES
// =========================

function createProjectile(x1, y1, x2, y2, type) {

    if (projectiles.length >= 30) return;

    const element = document.createElement("div");

    element.className = "projectile";

    projectilesLayer.appendChild(element);

    projectiles.push({
        x: x1,
        y: y1,
        targetX: x2,
        targetY: y2,
        progress: 0,
        speed: 7,
        element,
        type
    });
}


function updateProjectiles(dt) {

    for (const projectile of projectiles) {

        projectile.progress += projectile.speed * dt;

        const p = Math.min(projectile.progress, 1);

        projectile.x =
            projectile.x +
            (projectile.targetX - projectile.x) * p;

        projectile.y =
            projectile.y +
            (projectile.targetY - projectile.y) * p;

        projectile.element.style.transform =
            `translate(${projectile.x}px, ${projectile.y}px)`;
    }

    projectiles = projectiles.filter(projectile => {

        if (projectile.progress >= 1) {

            projectile.element.remove();

            return false;
        }

        return true;
    });
}


// =========================
// HIT EFFECT
// =========================

function createHitEffect(x, y) {

    if (effectsLayer.children.length >= 20) return;

    const effect = document.createElement("div");

    effect.className = "hit-effect";

    effect.style.left = `${x}px`;
    effect.style.top = `${y}px`;

    effectsLayer.appendChild(effect);

    setTimeout(() => {

        effect.remove();

    }, 250);
}


// =========================
// CLEANUP
// =========================

function cleanupObjects() {

    units = units.filter(unit => {

        if (unit.dead || unit.hp <= 0) {

            if (unit.element) {
                unit.element.remove();
            }

            return false;
        }

        return true;
    });


    enemies = enemies.filter(enemy => {

        if (enemy.dead || enemy.hp <= 0) {

            if (enemy.element) {
                enemy.element.remove();
            }

            return false;
        }

        return true;
    });
}


// =========================
// POSITION + HEALTH BARS
// =========================

function updateUnitPosition(unit) {

    unit.element.style.transform =
        `translate(${unit.x}px, ${unit.y}px)`;

    const percentage =
        Math.max(0, (unit.hp / unit.maxHp) * 100);

    unit.healthBar.style.width =
        `${percentage}%`;
}


function updateEnemyPosition(enemy) {

    enemy.element.style.transform =
        `translate(${enemy.x}px, ${enemy.y}px)`;

    const percentage =
        Math.max(0, (enemy.hp / enemy.maxHp) * 100);

    enemy.healthBar.style.width =
        `${percentage}%`;
}


// =========================
// DISTANCE
// =========================

function getDistance(x1, y1, x2, y2) {

    const dx = x2 - x1;
    const dy = y2 - y1;

    return Math.sqrt(dx * dx + dy * dy);
}


// =========================
// HUD
// =========================

function updateHUD() {

    defencePointsEl.textContent =
        Math.max(0, defencePoints);

    baseHealthEl.textContent =
        Math.max(0, Math.floor(baseHealth));

    enemyCountEl.textContent =
        enemies.length;

    scoreEl.textContent =
        Math.floor(score);

    bestScoreEl.textContent =
        bestScore;

    gameTimeEl.textContent =
        formatTime(gameTime);

    if (baseHealthBar) {

        baseHealthBar.style.width =
            `${Math.max(0, baseHealth / 10)}%`;
    }
}


function formatTime(seconds) {

    const minutes =
        Math.floor(seconds / 60);

    const secs =
        Math.floor(seconds % 60);

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}


// =========================
// GAME OVER
// =========================

function endGame() {

    running = false;
    gameOver = true;

    cancelAnimationFrame(animationFrame);

    if (score > bestScore) {

        bestScore = Math.floor(score);

        localStorage.setItem(
            "defenceCommandBest",
            bestScore
        );
    }

    updateHUD();

    finalScoreEl.textContent =
        Math.floor(score);

    finalBestEl.textContent =
        bestScore;

    finalTimeEl.textContent =
        formatTime(gameTime);

    gameScreen.classList.add("hidden");
    gameOverScreen.classList.remove("hidden");
}


// =========================
// BUTTONS
// =========================

startButton.addEventListener("click", startGame);

restartButton.addEventListener("click", restartGame);

gameOverRestart.addEventListener("click", restartGame);