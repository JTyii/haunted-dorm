// server/game/gameState.js
const { generateRooms } = require('./rooms');
const config = require('../config/serverConfig');

// Main game state
const gameState = {
    players: {},
    rooms: [],
    ghosts: [],
    towers: [],
    waveNumber: 1,
    gameTime: 0,
    gameStartTime: Date.now(),
    isActive: true
};

// Initialize rooms when server starts
function initializeGameState() {
    gameState.rooms = generateRooms(config.GAME.ROOM_COUNT);
    console.log(`🏠 Generated ${gameState.rooms.length} rooms`);
}

// Update game state (called periodically)
function updateGameState() {
    if (!gameState.isActive) return;
    
    gameState.gameTime = Date.now() - gameState.gameStartTime;
    
    // Update ghost logic
    ghostLogic.update(gameState);
}

// Basic ghost logic (placeholder - expand as needed)
const ghostLogic = {
    playerGhosts: {}, // socketId -> ghost data
    aiGhosts: [],
    maxPlayerGhosts: 2,
    
    getGhosts() {
        return [
            ...Object.values(this.playerGhosts),
            ...this.aiGhosts
        ];
    },
    
    getPlayerGhosts() {
        return this.playerGhosts;
    },
    
    getAvailableGhostSlots() {
        return this.maxPlayerGhosts - Object.keys(this.playerGhosts).length;
    },
    
    isPlayerGhost(socketId) {
        return !!this.playerGhosts[socketId];
    },
    
    requestGhostRole(socketId, spawnOptions = {}) {
        // Check if slots available
        if (Object.keys(this.playerGhosts).length >= this.maxPlayerGhosts) {
            return { success: false, reason: 'No ghost slots available' };
        }
        
        // Check if player already has ghost
        if (this.playerGhosts[socketId]) {
            return { success: false, reason: 'Player already has ghost role' };
        }
        
        // Create ghost
        const ghost = {
            id: `ghost_${socketId}`,
            playerId: socketId,
            type: 'player',
            x: spawnOptions.spawnX || -50,
            y: spawnOptions.spawnY || 400,
            health: 100,
            maxHealth: 100,
            speed: 150,
            energy: 100,
            maxEnergy: 100,
            abilities: {
                speedBurst: { ready: true, cooldown: 0 },
                phaseThrough: { ready: true, cooldown: 0 },
                summonMinion: { ready: true, cooldown: 0 }
            },
            createdAt: Date.now()
        };
        
        this.playerGhosts[socketId] = ghost;
        
        console.log(`👻 Player ${socketId} became a ghost`);
        return { success: true, ghost };
    },
    
    releaseGhostRole(socketId) {
        if (this.playerGhosts[socketId]) {
            delete this.playerGhosts[socketId];
            console.log(`👻 Player ${socketId} released ghost role`);
            return true;
        }
        return false;
    },
    
    handlePlayerGhostInput(socketId, inputData) {
        const ghost = this.playerGhosts[socketId];
        if (!ghost) return false;
        
        // Handle movement
        if (inputData.action === 'move') {
            ghost.x = inputData.x;
            ghost.y = inputData.y;
            return true;
        }
        
        // Handle abilities
        if (inputData.action === 'ability') {
            return this.useGhostAbility(ghost, inputData.abilityName);
        }
        
        return false;
    },
    
    useGhostAbility(ghost, abilityName) {
        const ability = ghost.abilities[abilityName];
        if (!ability || !ability.ready) {
            return false;
        }
        
        // Use ability logic here
        console.log(`👻 Ghost ${ghost.id} used ability: ${abilityName}`);
        
        // Set cooldown
        ability.ready = false;
        ability.cooldown = Date.now() + 5000; // 5 second cooldown
        
        setTimeout(() => {
            ability.ready = true;
            ability.cooldown = 0;
        }, 5000);
        
        return true;
    },
    
    update(gameState) {
        // Update AI ghosts, abilities, etc.
        const now = Date.now();
        
        // Update ability cooldowns
        Object.values(this.playerGhosts).forEach(ghost => {
            Object.values(ghost.abilities).forEach(ability => {
                if (!ability.ready && now >= ability.cooldown) {
                    ability.ready = true;
                    ability.cooldown = 0;
                }
            });
        });
    },
    
    updateGhosts(ghostsData) {
        // Update ghost positions/states from client
        ghostsData.forEach(ghostData => {
            const ghost = this.playerGhosts[ghostData.playerId];
            if (ghost) {
                ghost.x = ghostData.x;
                ghost.y = ghostData.y;
                ghost.health = ghostData.health;
            }
        });
    },
    
    showAbilityEffect(ghostId, abilityName) {
        // Visual effects for abilities
        console.log(`✨ Ghost ${ghostId} ability effect: ${abilityName}`);
    }
};

// Initialize the game state
initializeGameState();

module.exports = {
    gameState,
    updateGameState,
    ghostLogic,
    initializeGameState
};