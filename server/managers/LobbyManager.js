// server/managers/LobbyManager.js
const { SHARED_CONFIG } = require('../../shared/constants');

class LobbyManager {
    constructor() {
        this.players = new Map(); // socketId -> player data
        this.gameStarted = false;
        this.startingGame = false;
        this.minPlayers = 2;
        this.maxGhosts = 2;
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
        if (!player) return false;

        // Validate role
        if (!Object.values(SHARED_CONFIG.ROLES).includes(role)) {
            console.log(`❌ Invalid role selected: ${role}`);
            return false;
        }

        // Check ghost slot availability
        if (role === SHARED_CONFIG.ROLES.GHOST) {
            const currentGhosts = this.getGhostCount();
            if (currentGhosts >= this.maxGhosts) {
                console.log(`❌ Ghost slots full (${currentGhosts}/${this.maxGhosts})`);
                return false;
            }
        }

        const oldRole = player.selectedRole;
        player.selectedRole = role;
        // Don't auto-set ready when selecting role
        
        console.log(`✅ Player ${socketId} selected role: ${oldRole} -> ${role}`);
        return true;
    }

    // Toggle player ready status
    togglePlayerReady(socketId, readyState) {
        const player = this.players.get(socketId);
        if (!player) return false;

        player.ready = readyState;
        console.log(`✅ Player ${socketId} ready status: ${readyState}`);
        return true;
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
        
        return {
            players: this.getPlayersObject(),
            playerCount: this.players.size,
            ghostCount: ghostCount,
            maxGhosts: this.maxGhosts,
            canStartGame: this.canStartGame(),
            allPlayersReady: this.allPlayersReady(),
            gameStarted: this.gameStarted,
            readyCount: playersArray.filter(p => p.ready).length
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

        // Need at least one ghost and one defender
        const ghostCount = this.getGhostCount();
        const defenderCount = this.players.size - ghostCount;

        if (ghostCount === 0 || defenderCount === 0) {
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

        // Notify all players game is starting
        const countdown = 3;
        io.emit(SHARED_CONFIG.EVENTS.GAME_STARTING, { countdown });

        // Countdown timer
        for (let i = countdown; i > 0; i--) {
            console.log(`Starting in ${i}...`);
            await this.delay(1000);
        }

        // Actually start the game
        this.gameStarted = true;
        
        // Assign final roles and start game for each player
        const gameData = {
            totalPlayers: this.players.size,
            ghostCount: this.getGhostCount()
        };

        for (const [socketId, player] of this.players) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit(SHARED_CONFIG.EVENTS.GAME_STARTED, {
                    playerRole: player.selectedRole,
                    gameData: gameData
                });
            }
        }

        console.log(`✅ Game started with ${this.players.size} players (${this.getGhostCount()} ghosts)`);
        return true;
    }

    // Reset lobby (for game restart)
    reset() {
        this.gameStarted = false;
        this.startingGame = false;
        
        // Reset all players to not ready
        for (const player of this.players.values()) {
            player.ready = false;
            player.selectedRole = SHARED_CONFIG.ROLES.DEFENDER; // Reset to default
        }
        
        console.log('🔄 Lobby reset');
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

    // Check if player exists
    hasPlayer(socketId) {
        return this.players.has(socketId);
    }

    // Get lobby statistics
    getStats() {
        const ghostCount = this.getGhostCount();
        return {
            totalPlayers: this.players.size,
            defenders: this.players.size - ghostCount,
            ghosts: ghostCount,
            readyPlayers: Array.from(this.players.values()).filter(p => p.ready).length,
            canStart: this.canStartGame(),
            gameStarted: this.gameStarted,
            gameStarting: this.startingGame
        };
    }
}

module.exports = LobbyManager;