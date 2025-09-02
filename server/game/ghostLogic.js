// Enhanced GhostLogic.js - Supporting both AI and Player-controlled ghosts
const { SHARED_CONFIG, SharedUtils } = require('../../shared/constants');
const { getTowersInRange, canTowerFire, fireTower } = require('./towers');

class GhostLogic {
    constructor() {
        this.ghosts = [];
        this.playerGhosts = {}; // Track player-controlled ghosts
        this.availableGhostSlots = 2; // Max number of player ghosts
        this.spawnRate = 5000;
        this.lastSpawn = 0;
        this.ghostIdCounter = 0;
        this.gameMode = 'hybrid'; // 'ai-only', 'player-only', 'hybrid'
    }

    initializeGhosts() {
        // Start with one AI ghost if no players are ghosts
        if (Object.keys(this.playerGhosts).length === 0) {
            this.spawnAIGhost();
        }
    }

    // Player requests to become a ghost
    requestGhostRole(playerId, playerData) {
        // Check if ghost slots are available
        if (Object.keys(this.playerGhosts).length >= this.availableGhostSlots) {
            return { success: false, reason: 'No ghost slots available' };
        }

        // Check if player is already a ghost
        if (this.playerGhosts[playerId]) {
            return { success: false, reason: 'Already a ghost' };
        }

        // Create player-controlled ghost
        const ghost = this.createPlayerGhost(playerId, playerData);
        this.playerGhosts[playerId] = ghost;
        this.ghosts.push(ghost);

        console.log(`👻 Player ${playerId} became a ghost!`);
        return { success: true, ghost };
    }

    // Player stops being a ghost
    releaseGhostRole(playerId) {
        const ghost = this.playerGhosts[playerId];
        if (!ghost) return false;

        // Remove from ghosts array
        this.ghosts = this.ghosts.filter(g => g.id !== ghost.id);
        delete this.playerGhosts[playerId];

        console.log(`👻 Player ${playerId} stopped being a ghost`);

        // Spawn AI ghost if no player ghosts remain
        if (Object.keys(this.playerGhosts).length === 0) {
            setTimeout(() => this.spawnAIGhost(), 2000);
        }

        return true;
    }

    createPlayerGhost(playerId, playerData) {
        return {
            id: this.ghostIdCounter++,
            playerId: playerId, // Link to controlling player
            type: 'player',
            x: playerData.spawnX || SharedUtils.randInt(-100, -50),
            y: playerData.spawnY || SharedUtils.randInt(200, 600),
            health: 60, // Player ghosts are stronger
            maxHealth: 60,
            speed: 30,
            target: null,
            state: 'seeking',
            abilities: {
                speedBurst: { cooldown: 10000, lastUsed: 0 },
                phaseThrough: { cooldown: 15000, lastUsed: 0 },
                summonMinion: { cooldown: 20000, lastUsed: 0 }
            },
            energy: 100, // Energy for special abilities
            maxEnergy: 100
        };
    }

    spawnAIGhost() {
        const ghost = {
            id: this.ghostIdCounter++,
            playerId: null, // AI controlled
            type: 'ai',
            x: SharedUtils.randInt(-100, -50),
            y: SharedUtils.randInt(200, 600),
            health: 40,
            maxHealth: 40,
            speed: 20,
            target: null,
            state: 'seeking',
            aiPersonality: SharedUtils.randInt(0, 2), // 0: aggressive, 1: sneaky, 2: strategic
            lastDecision: 0
        };

        this.ghosts.push(ghost);
        console.log(`🤖 AI Ghost ${ghost.id} spawned`);
        return ghost;
    }

    updateGhosts(gameState) {
        const currentTime = Date.now();
        
        // Auto-spawn AI ghosts if needed
        this.manageAIGhostSpawning(currentTime, gameState);
        
        // Update all ghosts
        this.ghosts.forEach(ghost => {
            if (ghost.type === 'player') {
                this.updatePlayerGhost(ghost, gameState, currentTime);
            } else {
                this.updateAIGhost(ghost, gameState, currentTime);
            }
        });
        
        // Remove dead ghosts
        this.removeDeadGhosts(gameState);
        
        return this.ghosts;
    }

    manageAIGhostSpawning(currentTime, gameState) {
        // Only spawn AI ghosts if there are fewer total ghosts than needed
        const sleepingPlayers = Object.values(gameState.players).filter(p => p.isSleeping);
        const playerGhostCount = Object.keys(this.playerGhosts).length;
        const aiGhostCount = this.ghosts.filter(g => g.type === 'ai').length;
        
        // Spawn AI ghosts to fill gaps
        const desiredTotalGhosts = Math.min(2, Math.ceil(sleepingPlayers.length / 2));
        const currentTotalGhosts = playerGhostCount + aiGhostCount;
        
        if (currentTotalGhosts < desiredTotalGhosts && 
            currentTime - this.lastSpawn > this.spawnRate && 
            sleepingPlayers.length > 0) {
            
            this.spawnAIGhost();
            this.lastSpawn = currentTime;
        }
    }

    updatePlayerGhost(ghost, gameState, currentTime) {
        // Player-controlled ghosts are updated via player input
        // We still need to handle physics, abilities, and interactions
        
        // Regenerate energy over time
        if (ghost.energy < ghost.maxEnergy) {
            ghost.energy = Math.min(ghost.maxEnergy, ghost.energy + 0.5);
        }

        // Check for tower attacks (both AI and player ghosts can be attacked)
        this.checkTowerAttacks(ghost, gameState, currentTime);
        
        if (ghost.health <= 0) return;

        // Check player attacks (if ghost reaches sleeping players)
        this.checkPlayerAttacks(ghost, gameState);
    }

    updateAIGhost(ghost, gameState, currentTime) {
        // Standard AI ghost behavior
        this.checkTowerAttacks(ghost, gameState, currentTime);
        
        if (ghost.health <= 0) return;
        
        // AI Decision making based on personality
        if (currentTime - ghost.lastDecision > 1000) { // Decide every second
            this.makeAIDecision(ghost, gameState);
            ghost.lastDecision = currentTime;
        }
        
        // Execute current state
        this.executeAIState(ghost, gameState);
        
        // Check if ghost reached a sleeping player
        this.checkPlayerAttacks(ghost, gameState);
    }

    makeAIDecision(ghost, gameState) {
        const sleepingPlayers = Object.values(gameState.players).filter(p => p.isSleeping);
        
        if (sleepingPlayers.length === 0) {
            ghost.state = 'wandering';
            return;
        }

        switch (ghost.aiPersonality) {
            case 0: // Aggressive - always goes for closest target
                ghost.target = this.findClosestPlayer(ghost, sleepingPlayers);
                ghost.state = 'attacking';
                break;
                
            case 1: // Sneaky - avoids heavy defenses, looks for weak points
                ghost.target = this.findWeakestDefendedPlayer(ghost, sleepingPlayers, gameState);
                ghost.state = 'sneaking';
                break;
                
            case 2: // Strategic - waits for opportunities, focuses on disruption
                if (Math.random() < 0.3) {
                    ghost.state = 'waiting';
                } else {
                    ghost.target = this.findStrategicTarget(ghost, sleepingPlayers, gameState);
                    ghost.state = 'strategic';
                }
                break;
        }
    }

    executeAIState(ghost, gameState) {
        switch (ghost.state) {
            case 'attacking':
                this.moveAggressively(ghost);
                break;
            case 'sneaking':
                this.moveSneakily(ghost);
                break;
            case 'strategic':
                this.moveStrategically(ghost, gameState);
                break;
            case 'waiting':
                this.moveSlightly(ghost);
                break;
            case 'wandering':
                this.moveRandomly(ghost);
                break;
        }
    }

    // Player ghost input handling
    handlePlayerGhostInput(playerId, input) {
        const ghost = this.playerGhosts[playerId];
        if (!ghost || ghost.health <= 0) return false;

        const { action, x, y, targetX, targetY } = input;

        switch (action) {
            case 'move':
                if (x !== undefined && y !== undefined) {
                    ghost.x = x;
                    ghost.y = y;
                }
                break;

            case 'speedBurst':
                if (this.canUseAbility(ghost, 'speedBurst') && ghost.energy >= 20) {
                    this.activateSpeedBurst(ghost);
                    ghost.energy -= 20;
                }
                break;

            case 'phaseThrough':
                if (this.canUseAbility(ghost, 'phaseThrough') && ghost.energy >= 30) {
                    this.activatePhaseThrough(ghost);
                    ghost.energy -= 30;
                }
                break;

            case 'summonMinion':
                if (this.canUseAbility(ghost, 'summonMinion') && ghost.energy >= 50) {
                    this.summonMinion(ghost);
                    ghost.energy -= 50;
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

    // Ability system for player ghosts
    canUseAbility(ghost, abilityName) {
        const ability = ghost.abilities[abilityName];
        if (!ability) return false;
        
        const currentTime = Date.now();
        return (currentTime - ability.lastUsed) >= ability.cooldown;
    }

    activateSpeedBurst(ghost) {
        ghost.speed *= 2;
        ghost.abilities.speedBurst.lastUsed = Date.now();
        
        // Speed returns to normal after 3 seconds
        setTimeout(() => {
            ghost.speed /= 2;
        }, 3000);
        
        console.log(`💨 Ghost ${ghost.id} used speed burst!`);
    }

    activatePhaseThrough(ghost) {
        ghost.phasing = true;
        ghost.abilities.phaseThrough.lastUsed = Date.now();
        
        // Phase through ends after 2 seconds
        setTimeout(() => {
            ghost.phasing = false;
        }, 2000);
        
        console.log(`👻 Ghost ${ghost.id} is phasing through walls!`);
    }

    summonMinion(ghost) {
        const minion = {
            id: this.ghostIdCounter++,
            playerId: ghost.playerId,
            type: 'minion',
            x: ghost.x + SharedUtils.randInt(-50, 50),
            y: ghost.y + SharedUtils.randInt(-50, 50),
            health: 15,
            maxHealth: 15,
            speed: 15,
            target: ghost.target,
            state: 'seeking',
            lifespan: 15000 // Minions disappear after 15 seconds
        };
        
        this.ghosts.push(minion);
        ghost.abilities.summonMinion.lastUsed = Date.now();
        
        console.log(`👥 Ghost ${ghost.id} summoned minion ${minion.id}!`);
    }

    // AI Movement patterns
    moveAggressively(ghost) {
        if (!ghost.target) return;
        
        const dx = ghost.target.x - ghost.x;
        const dy = ghost.target.y - ghost.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            ghost.x += (dx / distance) * ghost.speed;
            ghost.y += (dy / distance) * ghost.speed;
        }
    }

    moveSneakily(ghost) {
        // Similar to aggressive but with some randomness to avoid predictability
        if (!ghost.target) return;
        
        const dx = ghost.target.x - ghost.x;
        const dy = ghost.target.y - ghost.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            // Add some noise to movement
            const noiseX = SharedUtils.randInt(-5, 5);
            const noiseY = SharedUtils.randInt(-5, 5);
            
            ghost.x += ((dx / distance) * ghost.speed * 0.8) + noiseX;
            ghost.y += ((dy / distance) * ghost.speed * 0.8) + noiseY;
        }
    }

    moveStrategically(ghost, gameState) {
        // Move toward areas with fewer defenses or waiting for better opportunities
        if (!ghost.target) return;
        
        // Check for nearby towers and try to avoid them
        const nearbyTowers = getTowersInRange(gameState, ghost.x, ghost.y, 150);
        
        if (nearbyTowers.length > 0) {
            // Move away from towers
            let avoidX = 0, avoidY = 0;
            nearbyTowers.forEach(tower => {
                avoidX += ghost.x - tower.worldX;
                avoidY += ghost.y - tower.worldY;
            });
            
            ghost.x += avoidX * 0.1;
            ghost.y += avoidY * 0.1;
        } else {
            // Move toward target when safe
            this.moveAggressively(ghost);
        }
    }

    moveSlightly(ghost) {
        // Small random movements while waiting
        ghost.x += SharedUtils.randInt(-2, 2);
        ghost.y += SharedUtils.randInt(-2, 2);
    }

    moveRandomly(ghost) {
        ghost.x += SharedUtils.randInt(-10, 10);
        ghost.y += SharedUtils.randInt(-5, 5);
    }

    // Target selection for AI
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
        // Find player with fewest nearby towers
        let weakestPlayer = null;
        let lowestDefense = Infinity;
        
        players.forEach(player => {
            const nearbyTowers = getTowersInRange(gameState, player.x, player.y, 200);
            if (nearbyTowers.length < lowestDefense) {
                lowestDefense = nearbyTowers.length;
                weakestPlayer = player;
            }
        });
        
        return weakestPlayer || this.findClosestPlayer(ghost, players);
    }

    findStrategicTarget(ghost, players, gameState) {
        // Look for players that are isolated or in rooms with valuable targets
        return players[SharedUtils.randInt(0, players.length - 1)];
    }

    // Existing methods (tower attacks, player attacks, etc.) remain the same
    checkTowerAttacks(ghost, gameState, currentTime) {
        const towersInRange = getTowersInRange(gameState, ghost.x, ghost.y, 100);
        
        towersInRange.forEach(tower => {
            if (canTowerFire(tower, currentTime)) {
                const shot = fireTower(tower, ghost);
                
                // Player ghosts can potentially dodge or use abilities
                if (ghost.type === 'player' && ghost.phasing) {
                    console.log(`👻 Player ghost ${ghost.id} phased through tower attack!`);
                    return; // No damage while phasing
                }
                
                ghost.health -= shot.damage;
                
                if (ghost.health <= 0) {
                    console.log(`💀 Ghost ${ghost.id} destroyed by tower`);
                    // Award money to tower owner
                    const owner = gameState.players[tower.owner];
                    if (owner) {
                        owner.money += ghost.type === 'player' ? 25 : 10; // Player ghosts worth more
                    }
                }
            }
        });
    }

    checkPlayerAttacks(ghost, gameState) {
        if (!ghost.target) return;
        
        const distance = SharedUtils.distance(ghost.x, ghost.y, ghost.target.x, ghost.target.y);
        
        if (distance < 30) {
            console.log(`👻 Ghost ${ghost.id} attacked player ${ghost.target.id}!`);
            
            // Damage amount depends on ghost type
            const damage = ghost.type === 'player' ? 30 : 20;
            ghost.target.money = Math.max(0, ghost.target.money - damage);
            
            // Ghost gets damaged from attacking
            ghost.health -= ghost.type === 'player' ? 10 : 15;
            
            // Push ghost away
            const dx = ghost.x - ghost.target.x;
            const dy = ghost.y - ghost.target.y;
            const pushDistance = 50;
            
            if (dx !== 0 || dy !== 0) {
                const norm = Math.sqrt(dx * dx + dy * dy);
                ghost.x += (dx / norm) * pushDistance;
                ghost.y += (dy / norm) * pushDistance;
            }
        }
    }

    removeDeadGhosts(gameState) {
        const deadGhosts = this.ghosts.filter(g => g.health <= 0);
        
        deadGhosts.forEach(ghost => {
            if (ghost.playerId) {
                // Player ghost died - remove from player ghosts
                delete this.playerGhosts[ghost.playerId];
                console.log(`💀 Player ghost ${ghost.playerId} was defeated!`);
                
                // Notify the player they're no longer a ghost
                // This should be handled by the server to emit an event
            }
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