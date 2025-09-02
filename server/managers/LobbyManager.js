// server/managers/LobbyManager.js - Updated with Ready System and AI Ghost Fallback
const { SHARED_CONFIG } = require('../../shared/constants');

class LobbyManager {
    constructor(ghostLogic = null) {
        this.players = new Map(); // socketId -> player data
        this.gameStarted = false;
        this.startingGame = false;
        this.minPlayers = 2;
        this.maxGhosts = 2;
        this.ghostLogic = ghostLogic; // Reference to ghost logic for AI fallback
    }

    // Add player to lobby
    addPlayer(socketId, playerData = {}) {
        const player = {
            id: socketId,
            name: playerData.playerName || `Player_${socketId.substr(0, 5)}`,
            selectedRole: SHARED_CONFIG.ROLES.DEFENDER, // Default role
            ready: false,
            joinedAt: Date.now(),
            ...playerData
        };

        this.players.set(socketId, player);
        console.log(`👤 Player ${socketId} joined lobby as ${player.name}`);
        
        return player;
    }

    // Remove player from lobby
    removePlayer(socketId) {
        const player = this.players.get(socketId);
        if (player) {
            this.players.delete(socketId);
            console.log(`👋 Player ${socketId} left lobby`);
            return player;
        }
        return null;
    }

    // Update player's role selection
    selectRole(socketId, role) {
        const player = this.players.get(socketId);
        if (!player) {
            return { success: false, reason: 'Player not found' };
        }

        // Validate role
        if (!Object.values(SHARED_CONFIG.ROLES).includes(role)) {
            console.log(`❌ Invalid role selected: ${role}`);
            return { success: false, reason: 'Invalid role' };
        }

        // Check ghost slot availability
        if (role === SHARED_CONFIG.ROLES.GHOST) {
            const currentGhosts = this.getGhostCount();
            if (currentGhosts >= this.maxGhosts) {
                console.log(`❌ Ghost slots full (${currentGhosts}/${this.maxGhosts})`);
                return { success: false, reason: 'Ghost slots are full' };
            }
        }

        const oldRole = player.selectedRole;
        player.selectedRole = role;
        
        // Automatically unready when changing roles
        if (player.ready) {
            player.ready = false;
            console.log(`🔄 Player ${socketId} unreadied due to role change`);
        }
        
        console.log(`✅ Player ${socketId} selected role: ${oldRole} -> ${role}`);
        return { success: true, role };
    }

    // Set player ready status
    setPlayerReady(socketId, readyState) {
        const player = this.players.get(socketId);
        if (!player) {
            return { success: false, reason: 'Player not found' };
        }

        // Can't be ready without selecting a role (should always have default)
        if (!player.selectedRole) {
            return { success: false, reason: 'Must select a role first' };
        }

        player.ready = readyState;
        console.log(`✅ Player ${socketId} ready status: ${readyState}`);
        return { success: true, ready: readyState };
    }

    // Check if all players are ready
    allPlayersReady() {
        if (this.players.size === 0) return false;
        
        for (const player of this.players.values()) {
            if (!player.ready) {
                return false;
            }
        }
        return true;
    }

    // Get current lobby state
    getLobbyState() {
        const playersArray = Array.from(this.players.values());
        const ghostCount = this.getGhostCount();
        const readyCount = playersArray.filter(p => p.ready).length;
        
        return {
            players: this.getPlayersObject(),
            playerCount: this.players.size,
            ghostCount: ghostCount,
            maxGhosts: this.maxGhosts,
            readyCount: readyCount,
            canStartGame: this.canStartGame(),
            allPlayersReady: this.allPlayersReady(),
            gameStarted: this.gameStarted,
            startingGame: this.startingGame
        };
    }

    // Get players as object (for compatibility)
    getPlayersObject() {
        const playersObj = {};
        for (const [id, player] of this.players) {
            playersObj[id] = player;
        }
        return playersObj;
    }

    // Get number of ghost players
    getGhostCount() {
        let count = 0;
        for (const player of this.players.values()) {
            if (player.selectedRole === SHARED_CONFIG.ROLES.GHOST) {
                count++;
            }
        }
        return count;
    }

    // Check if game can start
    canStartGame() {
        if (this.gameStarted || this.startingGame) {
            return false;
        }

        // Need minimum players
        if (this.players.size < this.minPlayers) {
            return false;
        }

        // All players must be ready
        if (!this.allPlayersReady()) {
            return false;
        }

        // Need at least one defender (ghosts are optional, AI will fill in)
        const ghostCount = this.getGhostCount();
        const defenderCount = this.players.size - ghostCount;

        if (defenderCount === 0) {
            console.log('❌ Need at least one defender to start');
            return false;
        }

        return true;
    }

    // Start game countdown
    async startGame(io) {
        if (!this.canStartGame()) {
            console.log('❌ Cannot start game - requirements not met');
            return false;
        }

        if (this.startingGame) {
            console.log('⚠️ Game is already starting');
            return false;
        }

        this.startingGame = true;
        console.log('🎮 Starting game countdown...');

        // Handle AI ghost fallback BEFORE starting
        const ghostCount = this.getGhostCount();
        if (ghostCount === 0) {
            console.log('👻 No player ghosts selected - AI ghosts will be used');
        } else {
            console.log(`👻 ${ghostCount} player ghost(s) selected`);
        }

        // Notify all players game is starting
        const countdown = 3;
        io.emit(SHARED_CONFIG.EVENTS.GAME_STARTING, { 
            countdown,
            playerGhosts: ghostCount,
            aiGhosts: ghostCount === 0 ? 'AI ghosts will be spawned' : 'Player ghosts ready'
        });

        // Countdown timer
        for (let i = countdown; i > 0; i--) {
            console.log(`Starting in ${i}...`);
            io.emit(SHARED_CONFIG.EVENTS.COUNTDOWN_UPDATE, { remaining: i });
            await this.delay(1000);
        }

        // Actually start the game
        this.gameStarted = true;
        
        // Prepare game data
        const gameData = {
            totalPlayers: this.players.size,
            playerGhosts: ghostCount,
            aiGhostsNeeded: ghostCount === 0,
            playersById: this.getPlayersObject()
        };

        // Assign roles and start game for each player
        for (const [socketId, player] of this.players) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit(SHARED_CONFIG.EVENTS.GAME_STARTED, {
                    playerRole: player.selectedRole,
                    gameData: gameData
                });
                
                console.log(`🎮 Started game for ${socketId} as ${player.selectedRole}`);
            }
        }

        // If no player chose ghost, ensure AI ghosts will spawn
        if (ghostCount === 0 && this.ghostLogic) {
            console.log('🤖 Ensuring AI ghosts will spawn since no players chose ghost role');
            // The ghost logic will handle spawning AI ghosts automatically
        }

        console.log(`✅ Game started with ${this.players.size} players (${ghostCount} player ghosts, ${ghostCount === 0 ? 'AI ghosts will spawn' : 'no AI needed'})`);
        return true;
    }

    // Check if we can start with current configuration
    validateGameStart() {
        const issues = [];
        
        if (this.players.size < this.minPlayers) {
            issues.push(`Need at least ${this.minPlayers} players (have ${this.players.size})`);
        }
        
        if (!this.allPlayersReady()) {
            const readyCount = Array.from(this.players.values()).filter(p => p.ready).length;
            issues.push(`All players must be ready (${readyCount}/${this.players.size} ready)`);
        }
        
        const ghostCount = this.getGhostCount();
        const defenderCount = this.players.size - ghostCount;
        
        if (defenderCount === 0) {
            issues.push('Need at least one defender');
        }
        
        if (ghostCount > this.maxGhosts) {
            issues.push(`Too many ghosts (${ghostCount}/${this.maxGhosts})`);
        }
        
        return {
            canStart: issues.length === 0,
            issues: issues,
            stats: {
                totalPlayers: this.players.size,
                defenders: defenderCount,
                ghosts: ghostCount,
                ready: Array.from(this.players.values()).filter(p => p.ready).length
            }
        };
    }

    // Reset lobby (for game restart)
    reset() {
        this.gameStarted = false;
        this.startingGame = false;
        
        // Reset all players to not ready but keep their role selection
        for (const player of this.players.values()) {
            player.ready = false;
        }
        
        console.log('🔄 Lobby reset - players can ready up again');
    }

    // Force reset (clear all roles too)
    forceReset() {
        this.gameStarted = false;
        this.startingGame = false;
        
        // Reset all players to default state
        for (const player of this.players.values()) {
            player.ready = false;
            player.selectedRole = SHARED_CONFIG.ROLES.DEFENDER;
        }
        
        console.log('🔄 Lobby force reset - all roles and ready states cleared');
    }

    // Get detailed lobby information for admin/debug
    getDetailedState() {
        const players = Array.from(this.players.values());
        const validation = this.validateGameStart();
        
        return {
            ...this.getLobbyState(),
            validation: validation,
            playerDetails: players.map(p => ({
                id: p.id,
                name: p.name,
                role: p.selectedRole,
                ready: p.ready,
                joinedAt: new Date(p.joinedAt).toISOString()
            }))
        };
    }

    // Utility method for delays
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get player by socket ID
    getPlayer(socketId) {
        return this.players.get(socketId);
    }

    // Get all players array
    getAllPlayers() {
        return Array.from(this.players.values());
    }

    // Get players by role
    getPlayersByRole(role) {
        return Array.from(this.players.values()).filter(p => p.selectedRole === role);
    }

    // Check if player exists
    hasPlayer(socketId) {
        return this.players.has(socketId);
    }

    // Get lobby statistics
    getStats() {
        const ghostCount = this.getGhostCount();
        const readyCount = Array.from(this.players.values()).filter(p => p.ready).length;
        
        return {
            totalPlayers: this.players.size,
            defenders: this.players.size - ghostCount,
            ghosts: ghostCount,
            readyPlayers: readyCount,
            canStart: this.canStartGame(),
            gameStarted: this.gameStarted,
            gameStarting: this.startingGame,
            allReady: this.allPlayersReady()
        };
    }

    // Emergency stop game start (if needed)
    cancelGameStart() {
        if (this.startingGame && !this.gameStarted) {
            this.startingGame = false;
            console.log('🛑 Game start cancelled');
            return true;
        }
        return false;
    }
}

module.exports = LobbyManager;