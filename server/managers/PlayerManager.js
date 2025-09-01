import { SERVER, PLAYER } from '../config/serverConfig';

class PlayerManager {
    constructor() {
        this.players = {};
        this.playerStats = {}; // Track session stats
    }

    createPlayer(socketId) {
        const player = {
            id: socketId,
            x: PLAYER.STARTING_X,
            y: PLAYER.STARTING_Y,
            roomId: null,
            towers: [],
            isSleeping: false,
            bed: null, // { roomId, bedIndex }
            money: 100,
            joinTime: Date.now()
        };

        this.players[socketId] = player;
        
        // Initialize session stats
        this.playerStats[socketId] = {
            moneyEarned: 0,
            towersPlaced: 0,
            ghostsKilled: 0,
            timeSlept: 0,
            startTime: Date.now()
        };

        console.log('✅ Player created:', socketId);
        return player;
    }

    getPlayer(socketId) {
        return this.players[socketId];
    }

    getAllPlayers() {
        return this.players;
    }

    getPlayerStats(socketId) {
        return this.playerStats[socketId];
    }

    updatePlayerPosition(socketId, x, y) {
        const player = this.players[socketId];
        if (!player || player.isSleeping) return false;

        player.x = x;
        player.y = y;
        return true;
    }

    makePlayerSleep(socketId, roomId, bedIndex) {
        const player = this.players[socketId];
        if (!player) return false;

        // If already sleeping, wake up first
        if (player.isSleeping) {
            this.wakePlayer(socketId);
        }

        player.isSleeping = true;
        player.bed = { roomId, bedIndex };
        player.roomId = roomId;
        player.sleepStartTime = Date.now();
        
        console.log(`😴 Player ${socketId} is now sleeping in room ${roomId}, bed ${bedIndex}`);
        return true;
    }

    wakePlayer(socketId) {
        const player = this.players[socketId];
        if (!player) return false;

        if (player.isSleeping && player.sleepStartTime) {
            const sleepDuration = Date.now() - player.sleepStartTime;
            this.playerStats[socketId].timeSlept += sleepDuration;
        }

        player.isSleeping = false;
        player.bed = null;
        player.roomId = null;
        delete player.sleepStartTime;
        
        console.log(`☀️ Player ${socketId} woke up`);
        return true;
    }

    addMoney(socketId, amount) {
        const player = this.players[socketId];
        if (!player) return false;

        player.money += amount;
        this.playerStats[socketId].moneyEarned += amount;
        return true;
    }

    spendMoney(socketId, amount) {
        const player = this.players[socketId];
        if (!player || player.money < amount) return false;

        player.money -= amount;
        return true;
    }

    addTower(socketId, towerData) {
        const player = this.players[socketId];
        if (!player) return false;

        if (!player.towers) {
            player.towers = [];
        }
        
        player.towers.push(towerData);
        this.playerStats[socketId].towersPlaced++;
        
        console.log(`🔫 Player ${socketId} placed tower:`, towerData);
        return true;
    }

    addGhostKill(socketId) {
        if (this.playerStats[socketId]) {
            this.playerStats[socketId].ghostsKilled++;
        }
    }

    getSessionStats(socketId) {
        const stats = this.playerStats[socketId];
        if (!stats) return null;

        return {
            ...stats,
            sessionDuration: Date.now() - stats.startTime
        };
    }

    removePlayer(socketId) {
        const player = this.players[socketId];
        if (player) {
            // Log session stats before removing
            const stats = this.getSessionStats(socketId);
            if (stats) {
                console.log(`📊 Player ${socketId} session stats:`, {
                    duration: Math.round(stats.sessionDuration / 1000) + 's',
                    moneyEarned: stats.moneyEarned,
                    towersPlaced: stats.towersPlaced,
                    ghostsKilled: stats.ghostsKilled,
                    timeSlept: Math.round(stats.timeSlept / 1000) + 's'
                });
            }

            delete this.players[socketId];
            delete this.playerStats[socketId];
            console.log('❌ Player removed:', socketId);
            return player;
        }
        return null;
    }

    getPlayersArray() {
        return Object.values(this.players);
    }

    getActivePlayerCount() {
        return Object.keys(this.players).length;
    }

    getSleepingPlayers() {
        return Object.values(this.players).filter(p => p.isSleeping);
    }

    getPlayersInRoom(roomId) {
        return Object.values(this.players).filter(p => p.roomId === roomId);
    }

    // Money earning system for sleeping players
    processSleepEarnings() {
        const earnings = 5;
        Object.values(this.players).forEach(player => {
            if (player.isSleeping) {
                this.addMoney(player.id, earnings);
                console.log(`💰 Player ${player.id} earned $${earnings} while sleeping (total: $${player.money})`);
            }
        });
        return Object.values(this.players).filter(p => p.isSleeping).length;
    }
}

module.exports = PlayerManager;