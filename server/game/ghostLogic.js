const { SHARED_CONFIG, SharedUtils } = require('../../shared/constants');
const { getTowersInRange, canTowerFire, fireTower } = require('./towers');

class GhostLogic {
    constructor() {
        this.ghosts = [];
        this.spawnRate = 5000; // milliseconds between spawns
        this.lastSpawn = 0;
        this.ghostIdCounter = 0;
    }

    initializeGhosts() {
        // Start with one ghost
        this.ghosts = [{
            id: this.ghostIdCounter++,
            x: -50,
            y: SharedUtils.randInt(200, 600),
            health: 30,
            maxHealth: 30,
            speed: 20,
            target: null,
            state: 'seeking' // seeking, attacking, fleeing
        }];
    }

    updateGhosts(gameState) {
        const currentTime = Date.now();
        
        // Spawn new ghosts periodically
        this.spawnGhosts(currentTime, gameState);
        
        // Update existing ghosts
        this.ghosts.forEach(ghost => {
            this.updateGhost(ghost, gameState, currentTime);
        });
        
        // Remove dead ghosts
        this.ghosts = this.ghosts.filter(ghost => ghost.health > 0);
        
        // Update game state
        gameState.ghosts = this.ghosts;
        
        return this.ghosts;
    }

    spawnGhosts(currentTime, gameState) {
        if (currentTime - this.lastSpawn > this.spawnRate) {
            // Only spawn if there are sleeping players
            const sleepingPlayers = Object.values(gameState.players).filter(p => p.isSleeping);
            
            if (sleepingPlayers.length > 0 && this.ghosts.length < 5) {
                const newGhost = {
                    id: this.ghostIdCounter++,
                    x: SharedUtils.randInt(-100, -50),
                    y: SharedUtils.randInt(200, 600),
                    health: 30,
                    maxHealth: 30,
                    speed: SharedUtils.randInt(15, 25),
                    target: null,
                    state: 'seeking'
                };
                
                this.ghosts.push(newGhost);
                this.lastSpawn = currentTime;
                console.log(`👻 Spawned ghost ${newGhost.id} at (${newGhost.x}, ${newGhost.y})`);
            }
        }
    }

    updateGhost(ghost, gameState, currentTime) {
        // Check for tower attacks
        this.checkTowerAttacks(ghost, gameState, currentTime);
        
        if (ghost.health <= 0) return;
        
        // Find target
        this.updateGhostTarget(ghost, gameState);
        
        // Move ghost toward target
        this.moveGhost(ghost);
        
        // Check if ghost reached a sleeping player
        this.checkPlayerAttacks(ghost, gameState);
    }

    checkTowerAttacks(ghost, gameState, currentTime) {
        const towersInRange = getTowersInRange(gameState, ghost.x, ghost.y, 100);
        
        towersInRange.forEach(tower => {
            if (canTowerFire(tower, currentTime)) {
                const shot = fireTower(tower, ghost);
                ghost.health -= shot.damage;
                
                if (ghost.health <= 0) {
                    console.log(`💀 Ghost ${ghost.id} destroyed by tower`);
                    // Award money to tower owner
                    const owner = gameState.players[tower.owner];
                    if (owner) {
                        owner.money += 10; // Bounty for killing ghost
                    }
                }
            }
        });
    }

    updateGhostTarget(ghost, gameState) {
        const sleepingPlayers = Object.values(gameState.players).filter(p => p.isSleeping);
        
        if (sleepingPlayers.length === 0) {
            ghost.target = null;
            return;
        }
        
        // Find closest sleeping player
        let closestPlayer = null;
        let closestDistance = Infinity;
        
        sleepingPlayers.forEach(player => {
            const distance = SharedUtils.distance(ghost.x, ghost.y, player.x, player.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPlayer = player;
            }
        });
        
        ghost.target = closestPlayer;
    }

    moveGhost(ghost) {
        if (!ghost.target) {
            // Wander randomly if no target
            ghost.x += SharedUtils.randInt(-10, 10);
            ghost.y += SharedUtils.randInt(-5, 5);
            return;
        }
        
        const dx = ghost.target.x - ghost.x;
        const dy = ghost.target.y - ghost.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            ghost.x += (dx / distance) * ghost.speed;
            ghost.y += (dy / distance) * ghost.speed;
        }
    }

    checkPlayerAttacks(ghost, gameState) {
        if (!ghost.target) return;
        
        const distance = SharedUtils.distance(ghost.x, ghost.y, ghost.target.x, ghost.target.y);
        
        if (distance < 30) {
            // Ghost reached a sleeping player - attack!
            console.log(`👻 Ghost ${ghost.id} attacked player ${ghost.target.id}!`);
            
            // Damage player (reduce money)
            ghost.target.money = Math.max(0, ghost.target.money - 20);
            
            // Ghost gets damaged from attacking (self-destruct mechanic)
            ghost.health -= 15;
            
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

    getGhosts() {
        return this.ghosts;
    }

    removeGhost(ghostId) {
        this.ghosts = this.ghosts.filter(g => g.id !== ghostId);
    }
}

module.exports = GhostLogic;