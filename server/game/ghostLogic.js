// Enhanced GhostLogic.js - Supporting both AI and Player-controlled ghosts
const { SHARED_CONFIG, SharedUtils } = require('../../shared/constants');
const { getTowersInRange, canTowerFire, fireTower } = require('./towers');

class GhostLogic {
    constructor() {
        this.ghosts = [];
        this.playerGhosts = {}; // Track player-controlled ghosts
        this.ghostMinions = {}; // Track minions by ghost ID
        this.availableGhostSlots = 2; // Max number of player ghosts
        this.spawnRate = 8000; // AI ghost spawn rate
        this.lastSpawn = 0;
        this.ghostIdCounter = 0;
        this.gameMode = 'hybrid'; // 'ai-only', 'player-only', 'hybrid'
        this.ghostAbilities = this.initializeAbilities();
        
        // Game balance settings
        this.balance = {
            playerGhost: {
                health: 80,
                maxHealth: 80,
                speed: 25,
                energy: 100,
                maxEnergy: 100,
                energyRegen: 0.8,
                attackDamage: 35,
                attackRange: 35,
                selfDamageOnAttack: 8
            },
            aiGhost: {
                health: 45,
                maxHealth: 45,
                speed: 18,
                attackDamage: 25,
                attackRange: 30,
                selfDamageOnAttack: 12
            },
            minion: {
                health: 20,
                maxHealth: 20,
                speed: 12,
                attackDamage: 15,
                attackRange: 25,
                lifespan: 20000
            }
        };
    }

    initializeAbilities() {
        return {
            speedBurst: {
                energyCost: 25,
                cooldown: 8000,
                duration: 4000,
                speedMultiplier: 2.5,
                description: 'Move much faster for a short time'
            },
            phaseThrough: {
                energyCost: 35,
                cooldown: 12000,
                duration: 3000,
                description: 'Pass through walls and turrets'
            },
            summonMinion: {
                energyCost: 60,
                cooldown: 25000,
                minionCount: 1,
                description: 'Summon a helper ghost minion'
            },
            fearAura: {
                energyCost: 40,
                cooldown: 15000,
                duration: 5000,
                range: 120,
                description: 'Disable nearby turrets temporarily'
            }
        };
    }

    initializeGhosts() {
        console.log('🎮 Initializing ghost system...');
        // Start with one AI ghost if no players are ghosts
        if (Object.keys(this.playerGhosts).length === 0) {
            this.spawnAIGhost();
        }
    }

    // ========= PLAYER GHOST MANAGEMENT =========

    requestGhostRole(playerId, playerData) {
        console.log(`👻 Player ${playerId} requesting ghost role...`);
        
        // Check if ghost slots are available
        const currentPlayerGhosts = Object.keys(this.playerGhosts).length;
        if (currentPlayerGhosts >= this.availableGhostSlots) {
            return { 
                success: false, 
                reason: `All ghost slots occupied (${currentPlayerGhosts}/${this.availableGhostSlots})` 
            };
        }

        // Check if player is already a ghost
        if (this.playerGhosts[playerId]) {
            return { success: false, reason: 'Already controlling a ghost' };
        }

        // Check if player is sleeping (can't become ghost while sleeping)
        if (playerData.isSleeping) {
            return { success: false, reason: 'Cannot become ghost while sleeping' };
        }

        // Create player-controlled ghost
        const ghost = this.createPlayerGhost(playerId, playerData);
        this.playerGhosts[playerId] = ghost;
        this.ghosts.push(ghost);

        console.log(`👻 Player ${playerId} became ghost ${ghost.id}!`);
        return { success: true, ghost };
    }

    releaseGhostRole(playerId) {
        const ghost = this.playerGhosts[playerId];
        if (!ghost) {
            console.log(`❌ Player ${playerId} is not a ghost`);
            return false;
        }

        console.log(`👻 Player ${playerId} releasing ghost role (Ghost ${ghost.id})`);

        // Remove ghost's minions
        this.removeGhostMinions(ghost.id);

        // Remove from ghosts array
        this.ghosts = this.ghosts.filter(g => g.id !== ghost.id);
        delete this.playerGhosts[playerId];

        // Spawn AI ghost if no player ghosts remain and there are sleeping players
        setTimeout(() => {
            if (Object.keys(this.playerGhosts).length === 0) {
                this.spawnAIGhost();
            }
        }, 3000);

        return true;
    }

    createPlayerGhost(playerId, playerData) {
        const balance = this.balance.playerGhost;
        
        return {
            id: this.ghostIdCounter++,
            playerId: playerId,
            type: 'player',
            x: playerData.x || SharedUtils.randInt(-120, -60),
            y: playerData.y || SharedUtils.randInt(150, 550),
            health: balance.health,
            maxHealth: balance.maxHealth,
            speed: balance.speed,
            baseSpeed: balance.speed,
            target: null,
            state: 'seeking',
            energy: balance.energy,
            maxEnergy: balance.maxEnergy,
            energyRegen: balance.energyRegen,
            attackDamage: balance.attackDamage,
            attackRange: balance.attackRange,
            selfDamageOnAttack: balance.selfDamageOnAttack,
            abilities: this.createAbilityStates(),
            activeEffects: {},
            lastAttack: 0,
            attackCooldown: 1500,
            created: Date.now()
        };
    }

    createAbilityStates() {
        const states = {};
        Object.keys(this.ghostAbilities).forEach(abilityName => {
            states[abilityName] = {
                lastUsed: 0,
                isActive: false,
                endTime: 0
            };
        });
        return states;
    }

    // ========= AI GHOST MANAGEMENT =========

    spawnAIGhost() {
        const balance = this.balance.aiGhost;
        
        const ghost = {
            id: this.ghostIdCounter++,
            playerId: null,
            type: 'ai',
            x: SharedUtils.randInt(-150, -80),
            y: SharedUtils.randInt(100, 600),
            health: balance.health,
            maxHealth: balance.maxHealth,
            speed: balance.speed,
            baseSpeed: balance.speed,
            target: null,
            state: 'seeking',
            attackDamage: balance.attackDamage,
            attackRange: balance.attackRange,
            selfDamageOnAttack: balance.selfDamageOnAttack,
            aiPersonality: SharedUtils.randInt(0, 3), // 0: aggressive, 1: sneaky, 2: strategic, 3: berserker
            lastDecision: 0,
            decisionInterval: SharedUtils.randInt(800, 1200),
            lastAttack: 0,
            attackCooldown: 2000,
            created: Date.now()
        };

        this.ghosts.push(ghost);
        console.log(`🤖 AI Ghost ${ghost.id} spawned (personality: ${ghost.aiPersonality})`);
        return ghost;
    }

    // ========= GHOST UPDATING =========

    updateGhosts(gameState) {
        const currentTime = Date.now();
        
        // Manage AI ghost spawning
        this.manageAIGhostSpawning(currentTime, gameState);
        
        // Update all ghosts
        this.ghosts.forEach(ghost => {
            if (ghost.type === 'player') {
                this.updatePlayerGhost(ghost, gameState, currentTime);
            } else if (ghost.type === 'minion') {
                this.updateMinion(ghost, gameState, currentTime);
            } else {
                this.updateAIGhost(ghost, gameState, currentTime);
            }
        });
        
        // Remove dead/expired ghosts
        this.removeDeadGhosts(gameState);
        
        return this.ghosts;
    }

    manageAIGhostSpawning(currentTime, gameState) {
        const sleepingPlayers = Object.values(gameState.players).filter(p => p.isSleeping);
        const playerGhostCount = Object.keys(this.playerGhosts).length;
        const aiGhostCount = this.ghosts.filter(g => g.type === 'ai').length;
        const minionCount = this.ghosts.filter(g => g.type === 'minion').length;
        
        // Dynamic ghost spawning based on game state
        const desiredAIGhosts = Math.min(2, Math.max(1, Math.floor(sleepingPlayers.length / 3)));
        const shouldSpawnAI = aiGhostCount < desiredAIGhosts && 
                             currentTime - this.lastSpawn > this.spawnRate && 
                             sleepingPlayers.length > 0;
        
        if (shouldSpawnAI) {
            this.spawnAIGhost();
            this.lastSpawn = currentTime;
        }

        // Log ghost statistics periodically
        if (currentTime % 10000 < 100) { // Every ~10 seconds
            console.log(`👻 Ghost Stats: ${playerGhostCount} players, ${aiGhostCount} AI, ${minionCount} minions, ${sleepingPlayers.length} targets`);
        }
    }

    updatePlayerGhost(ghost, gameState, currentTime) {
        // Regenerate energy
        if (ghost.energy < ghost.maxEnergy) {
            ghost.energy = Math.min(ghost.maxEnergy, ghost.energy + ghost.energyRegen);
        }

        // Update active abilities
        this.updateAbilityEffects(ghost, currentTime);

        // Check for tower attacks
        this.checkTowerAttacks(ghost, gameState, currentTime);
        
        if (ghost.health <= 0) return;

        // Check player attacks
        this.checkPlayerAttacks(ghost, gameState, currentTime);

        // Update target if none exists
        if (!ghost.target) {
            ghost.target = this.findBestTarget(ghost, gameState);
        }
    }

    updateAIGhost(ghost, gameState, currentTime) {
        // Check for tower attacks
        this.checkTowerAttacks(ghost, gameState, currentTime);
        
        if (ghost.health <= 0) return;
        
        // AI Decision making
        if (currentTime - ghost.lastDecision > ghost.decisionInterval) {
            this.makeAIDecision(ghost, gameState);
            ghost.lastDecision = currentTime;
        }
        
        // Execute current state
        this.executeAIState(ghost, gameState);
        
        // Check if ghost can attack players
        this.checkPlayerAttacks(ghost, gameState, currentTime);
    }

    updateMinion(ghost, gameState, currentTime) {
        // Check lifespan
        if (currentTime - ghost.created > ghost.lifespan) {
            ghost.health = 0;
            console.log(`👥 Minion ${ghost.id} expired`);
            return;
        }

        // Basic AI for minions
        this.updateAIGhost(ghost, gameState, currentTime);
    }

    // ========= ABILITY SYSTEM =========

    handlePlayerGhostInput(playerId, input) {
        const ghost = this.playerGhosts[playerId];
        if (!ghost || ghost.health <= 0) return false;

        const { action, x, y, targetX, targetY, abilityName } = input;

        switch (action) {
            case 'move':
                if (x !== undefined && y !== undefined) {
                    // Validate movement (prevent teleporting too far)
                    const maxMoveDistance = ghost.speed * 2;
                    const distance = SharedUtils.distance(ghost.x, ghost.y, x, y);
                    
                    if (distance <= maxMoveDistance) {
                        ghost.x = x;
                        ghost.y = y;
                    }
                }
                break;

            case 'ability':
                if (abilityName && this.canUseAbility(ghost, abilityName)) {
                    return this.activateAbility(ghost, abilityName, { targetX, targetY });
                }
                break;

            case 'target':
                if (targetX !== undefined && targetY !== undefined) {
                    ghost.target = { x: targetX, y: targetY };
                }
                break;
        }

        return true;
    }

    canUseAbility(ghost, abilityName) {
        const ability = this.ghostAbilities[abilityName];
        const state = ghost.abilities[abilityName];
        
        if (!ability || !state) return false;
        
        const currentTime = Date.now();
        const hasEnergy = ghost.energy >= ability.energyCost;
        const notOnCooldown = (currentTime - state.lastUsed) >= ability.cooldown;
        
        return hasEnergy && notOnCooldown;
    }

    activateAbility(ghost, abilityName, options = {}) {
        const ability = this.ghostAbilities[abilityName];
        const state = ghost.abilities[abilityName];
        
        if (!this.canUseAbility(ghost, abilityName)) return false;

        console.log(`👻 Ghost ${ghost.id} used ability: ${abilityName}`);
        
        // Consume energy
        ghost.energy -= ability.energyCost;
        state.lastUsed = Date.now();

        // Activate ability effect
        switch (abilityName) {
            case 'speedBurst':
                this.activateSpeedBurst(ghost);
                break;
            case 'phaseThrough':
                this.activatePhaseThrough(ghost);
                break;
            case 'summonMinion':
                this.summonMinion(ghost, options);
                break;
            case 'fearAura':
                this.activateFearAura(ghost);
                break;
        }

        return true;
    }

    activateSpeedBurst(ghost) {
        const ability = this.ghostAbilities.speedBurst;
        
        ghost.speed = ghost.baseSpeed * ability.speedMultiplier;
        ghost.abilities.speedBurst.isActive = true;
        ghost.abilities.speedBurst.endTime = Date.now() + ability.duration;
        
        console.log(`💨 Ghost ${ghost.id} speed burst activated!`);
    }

    activatePhaseThrough(ghost) {
        const ability = this.ghostAbilities.phaseThrough;
        
        ghost.phasing = true;
        ghost.abilities.phaseThrough.isActive = true;
        ghost.abilities.phaseThrough.endTime = Date.now() + ability.duration;
        
        console.log(`👻 Ghost ${ghost.id} is phasing through walls!`);
    }

    summonMinion(ghost, options) {
        const balance = this.balance.minion;
        const ability = this.ghostAbilities.summonMinion;
        
        for (let i = 0; i < ability.minionCount; i++) {
            const minion = {
                id: this.ghostIdCounter++,
                playerId: ghost.playerId,
                parentGhostId: ghost.id,
                type: 'minion',
                x: ghost.x + SharedUtils.randInt(-40, 40),
                y: ghost.y + SharedUtils.randInt(-40, 40),
                health: balance.health,
                maxHealth: balance.maxHealth,
                speed: balance.speed,
                baseSpeed: balance.speed,
                target: ghost.target,
                state: 'seeking',
                attackDamage: balance.attackDamage,
                attackRange: balance.attackRange,
                lifespan: balance.lifespan,
                lastAttack: 0,
                attackCooldown: 1000,
                created: Date.now()
            };
            
            this.ghosts.push(minion);
            
            if (!this.ghostMinions[ghost.id]) {
                this.ghostMinions[ghost.id] = [];
            }
            this.ghostMinions[ghost.id].push(minion);
        }
        
        console.log(`👥 Ghost ${ghost.id} summoned ${ability.minionCount} minion(s)!`);
    }

    activateFearAura(ghost) {
        const ability = this.ghostAbilities.fearAura;
        
        ghost.abilities.fearAura.isActive = true;
        ghost.abilities.fearAura.endTime = Date.now() + ability.duration;
        ghost.fearAuraRange = ability.range;
        
        console.log(`😱 Ghost ${ghost.id} activated fear aura!`);
    }

    updateAbilityEffects(ghost, currentTime) {
        Object.keys(ghost.abilities).forEach(abilityName => {
            const state = ghost.abilities[abilityName];
            
            if (state.isActive && currentTime >= state.endTime) {
                this.deactivateAbility(ghost, abilityName);
            }
        });
    }

    deactivateAbility(ghost, abilityName) {
        const state = ghost.abilities[abilityName];
        state.isActive = false;
        
        switch (abilityName) {
            case 'speedBurst':
                ghost.speed = ghost.baseSpeed;
                console.log(`💨 Ghost ${ghost.id} speed burst ended`);
                break;
            case 'phaseThrough':
                ghost.phasing = false;
                console.log(`👻 Ghost ${ghost.id} stopped phasing`);
                break;
            case 'fearAura':
                delete ghost.fearAuraRange;
                console.log(`😱 Ghost ${ghost.id} fear aura ended`);
                break;
        }
    }

    // ========= AI BEHAVIOR =========

    makeAIDecision(ghost, gameState) {
        const sleepingPlayers = Object.values(gameState.players).filter(p => p.isSleeping);
        
        if (sleepingPlayers.length === 0) {
            ghost.state = 'wandering';
            ghost.target = null;
            return;
        }

        switch (ghost.aiPersonality) {
            case 0: // Aggressive
                ghost.target = this.findClosestPlayer(ghost, sleepingPlayers);
                ghost.state = 'attacking';
                break;
                
            case 1: // Sneaky
                ghost.target = this.findWeakestDefendedPlayer(ghost, sleepingPlayers, gameState);
                ghost.state = 'sneaking';
                break;
                
            case 2: // Strategic
                if (Math.random() < 0.25) {
                    ghost.state = 'waiting';
                } else {
                    ghost.target = this.findStrategicTarget(ghost, sleepingPlayers, gameState);
                    ghost.state = 'strategic';
                }
                break;

            case 3: // Berserker
                ghost.target = this.findRichestPlayer(ghost, sleepingPlayers);
                ghost.state = 'berserker';
                ghost.speed = ghost.baseSpeed * 1.5; // Berserkers are faster
                break;
        }
    }

    executeAIState(ghost, gameState) {
        switch (ghost.state) {
            case 'attacking':
                this.moveAggressively(ghost);
                break;
            case 'sneaking':
                this.moveSneakily(ghost, gameState);
                break;
            case 'strategic':
                this.moveStrategically(ghost, gameState);
                break;
            case 'berserker':
                this.moveBerserker(ghost);
                break;
            case 'waiting':
                this.moveSlightly(ghost);
                break;
            case 'wandering':
                this.moveRandomly(ghost);
                break;
        }
    }

    // AI Movement patterns
    moveAggressively(ghost) {
        if (!ghost.target) return;
        this.moveTowardsTarget(ghost, ghost.target, 1.0);
    }

    moveSneakily(ghost, gameState) {
        if (!ghost.target) return;
        
        // Try to avoid towers while moving
        const nearbyTowers = getTowersInRange(gameState, ghost.x, ghost.y, 120);
        
        if (nearbyTowers.length > 0) {
            // Calculate avoidance vector
            let avoidX = 0, avoidY = 0;
            nearbyTowers.forEach(tower => {
                const dx = ghost.x - tower.worldX;
                const dy = ghost.y - tower.worldY;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                avoidX += (dx / distance) * 30;
                avoidY += (dy / distance) * 30;
            });
            
            ghost.x += avoidX * 0.3;
            ghost.y += avoidY * 0.3;
        } else {
            this.moveTowardsTarget(ghost, ghost.target, 0.7);
        }
    }

    moveStrategically(ghost, gameState) {
        if (!ghost.target) return;
        
        // Wait for opportunities or attack weak points
        const nearbyTowers = getTowersInRange(gameState, ghost.target.x, ghost.target.y, 100);
        
        if (nearbyTowers.length > 2) {
            // Too defended, wait
            this.moveSlightly(ghost);
        } else {
            this.moveTowardsTarget(ghost, ghost.target, 0.8);
        }
    }

    moveBerserker(ghost) {
        // Berserkers ignore defenses and go straight for target
        if (!ghost.target) return;
        this.moveTowardsTarget(ghost, ghost.target, 1.3);
    }

    moveTowardsTarget(ghost, target, speedMultiplier = 1.0) {
        const dx = target.x - ghost.x;
        const dy = target.y - ghost.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const speed = ghost.speed * speedMultiplier;
            ghost.x += (dx / distance) * speed;
            ghost.y += (dy / distance) * speed;
        }
    }

    moveSlightly(ghost) {
        ghost.x += SharedUtils.randInt(-3, 3);
        ghost.y += SharedUtils.randInt(-3, 3);
    }

    moveRandomly(ghost) {
        ghost.x += SharedUtils.randInt(-15, 15);
        ghost.y += SharedUtils.randInt(-10, 10);
    }

    // ========= TARGET SELECTION =========

    findBestTarget(ghost, gameState) {
        const sleepingPlayers = Object.values(gameState.players).filter(p => p.isSleeping);
        if (sleepingPlayers.length === 0) return null;
        
        // For player ghosts, prefer richest targets
        if (ghost.type === 'player') {
            return this.findRichestPlayer(ghost, sleepingPlayers);
        } else {
            return this.findClosestPlayer(ghost, sleepingPlayers);
        }
    }

    findClosestPlayer(ghost, players) {
        let closest = null;
        let closestDistance = Infinity;
        
        players.forEach(player => {
            const distance = SharedUtils.distance(ghost.x, ghost.y, player.x, player.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = player;
            }
        });
        
        return closest;
    }

    findWeakestDefendedPlayer(ghost, players, gameState) {
        let weakestPlayer = null;
        let lowestDefense = Infinity;
        
        players.forEach(player => {
            const nearbyTowers = getTowersInRange(gameState, player.x, player.y, 150);
            const defenseScore = nearbyTowers.length;
            
            if (defenseScore < lowestDefense) {
                lowestDefense = defenseScore;
                weakestPlayer = player;
            }
        });
        
        return weakestPlayer || this.findClosestPlayer(ghost, players);
    }

    findRichestPlayer(ghost, players) {
        let richest = null;
        let highestMoney = 0;
        
        players.forEach(player => {
            if (player.money > highestMoney) {
                highestMoney = player.money;
                richest = player;
            }
        });
        
        return richest || this.findClosestPlayer(ghost, players);
    }

    findStrategicTarget(ghost, players, gameState) {
        // Look for isolated players or those with valuable rewards
        const targets = players.map(player => {
            const nearbyTowers = getTowersInRange(gameState, player.x, player.y, 120);
            return {
                player,
                defensiveScore: nearbyTowers.length,
                valueScore: player.money,
                distance: SharedUtils.distance(ghost.x, ghost.y, player.x, player.y)
            };
        });
        
        // Score targets based on value vs defense
        targets.forEach(target => {
            target.strategicScore = (target.valueScore / Math.max(1, target.defensiveScore)) / (target.distance / 100);
        });
        
        targets.sort((a, b) => b.strategicScore - a.strategicScore);
        return targets[0]?.player || players[0];
    }

    // ========= COMBAT SYSTEM =========

    checkTowerAttacks(ghost, gameState, currentTime) {
        // Skip tower attacks if phasing
        if (ghost.phasing) return;
        
        // Fear aura disables nearby towers
        if (ghost.abilities?.fearAura?.isActive) {
            this.applyFearAura(ghost, gameState);
        }
        
        const towersInRange = getTowersInRange(gameState, ghost.x, ghost.y, 120);
        
        towersInRange.forEach(tower => {
            // Skip if tower is feared
            if (tower.feared && tower.feared > currentTime) return;
            
            if (canTowerFire(tower, currentTime)) {
                const shot = fireTower(tower, ghost);
                
                ghost.health -= shot.damage;
                
                if (ghost.health <= 0) {
                    console.log(`💀 Ghost ${ghost.id} destroyed by tower`);
                    
                    // Award money to tower owner
                    const owner = gameState.players[tower.owner];
                    if (owner) {
                        const reward = ghost.type === 'player' ? 30 : 
                                     ghost.type === 'minion' ? 15 : 20;
                        owner.money += reward;
                        
                        // Track kill for player stats
                        if (tower.owner && gameState.playerManager) {
                            gameState.playerManager.addGhostKill(tower.owner);
                        }
                    }
                }
            }
        });
    }

    applyFearAura(ghost, gameState) {
        if (!ghost.fearAuraRange) return;
        
        const currentTime = Date.now();
        const fearDuration = 3000; // 3 seconds
        
        const towersInRange = getTowersInRange(gameState, ghost.x, ghost.y, ghost.fearAuraRange);
        towersInRange.forEach(tower => {
            tower.feared = currentTime + fearDuration;
        });
        
        if (towersInRange.length > 0) {
            console.log(`😱 Ghost ${ghost.id} feared ${towersInRange.length} towers`);
        }
    }

    checkPlayerAttacks(ghost, gameState, currentTime) {
        if (!ghost.target) return;
        if (currentTime - ghost.lastAttack < ghost.attackCooldown) return;
        
        const distance = SharedUtils.distance(ghost.x, ghost.y, ghost.target.x, ghost.target.y);
        
        if (distance < ghost.attackRange) {
            console.log(`👻 Ghost ${ghost.id} attacked player ${ghost.target.id}!`);
            
            // Damage player's money
            const moneyLoss = Math.min(ghost.attackDamage, ghost.target.money);
            ghost.target.money = Math.max(0, ghost.target.money - moneyLoss);
            
            // Ghost takes self-damage from attacking
            ghost.health -= ghost.selfDamageOnAttack;
            ghost.lastAttack = currentTime;
            
            // Push ghost away after attack
            this.pushGhostAway(ghost, ghost.target);
            
            // Emit attack event for client effects
            return {
                type: 'ghost_attack',
                ghostId: ghost.id,
                playerId: ghost.target.id,
                damage: moneyLoss,
                x: ghost.target.x,
                y: ghost.target.y
            };
        }
        
        return null;
    }

    pushGhostAway(ghost, target) {
        const dx = ghost.x - target.x;
        const dy = ghost.y - target.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const pushDistance = 60;
        
        ghost.x += (dx / distance) * pushDistance;
        ghost.y += (dy / distance) * pushDistance;
    }

    // ========= CLEANUP =========

    removeDeadGhosts(gameState) {
        const deadGhosts = this.ghosts.filter(g => g.health <= 0);
        
        deadGhosts.forEach(ghost => {
            if (ghost.playerId && ghost.type === 'player') {
                // Player ghost died - remove from player ghosts
                delete this.playerGhosts[ghost.playerId];
                console.log(`💀 Player ghost ${ghost.playerId} was defeated!`);
            }
            
            // Remove minions belonging to this ghost
            this.removeGhostMinions(ghost.id);
        });
        
        this.ghosts = this.ghosts.filter(ghost => ghost.health > 0);
    }

    // Getter methods
    getGhosts() {
        return this.ghosts;
    }

    getPlayerGhosts() {
        return this.playerGhosts;
    }

    isPlayerGhost(playerId) {
        return !!this.playerGhosts[playerId];
    }

    getAvailableGhostSlots() {
        return Math.max(0, this.availableGhostSlots - Object.keys(this.playerGhosts).length);
    }
}

module.exports = GhostLogic;