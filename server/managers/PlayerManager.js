// server/managers/PlayerManager.js - Updated with enhanced createPlayer method
const config = require('../config/serverConfig');

class PlayerManager {
    constructor() {
        this.players = {};
        this.playerStats = {}; // Track session stats
        
        // Validate config on initialization
        this.validateConfig();
    }

    validateConfig() {
        if (!config || !config.GAME) {
            console.error('❌ Server config not properly loaded');
            throw new Error('Server configuration is missing');
        }
        
        // Set defaults using the new config structure (config.GAME instead of config.PLAYER)
        this.config = {
            STARTING_X: 100, // Enhanced starting position
            STARTING_Y: 400, // Enhanced starting position  
            STARTING_MONEY: config.GAME.PLAYER_START_MONEY || 100,
            SLEEP_EARNINGS: config.GAME.SLEEP_EARNINGS_PER_INTERVAL || 5,
            GHOST_KILL_BOUNTY: config.GAME.GHOST_KILL_BOUNTY || 10
        };
        
        console.log('✅ PlayerManager config validated:', this.config);
    }

    // ENHANCED createPlayer method - REPLACE your existing one with this
    createPlayer(socketId) {
        const player = {
            id: socketId,
            x: this.config.STARTING_X, // Use config value (100)
            y: this.config.STARTING_Y, // Use config value (400)
            roomId: null,
            towers: [],
            isSleeping: false,
            bed: null, // { roomId, bedIndex }
            money: this.config.STARTING_MONEY,
            joinTime: Date.now(),
            lastMoveTime: Date.now(), // NEW: Track last movement
            lastBroadcast: 0 // NEW: Track last broadcast for throttling
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

        console.log('✅ Server player created:', socketId, `at (${player.x}, ${player.y})`);
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

    // ENHANCED updatePlayerPosition method
    updatePlayerPosition(socketId, x, y) {
        const player = this.players[socketId];
        if (!player || player.isSleeping) return false;

        // Enhanced validation
        if (typeof x !== 'number' || typeof y !== 'number') return false;
        if (!isFinite(x) || !isFinite(y)) return false;
        
        // Basic bounds checking
        if (x < -100 || x > 2100 || y < -100 || y > 1100) {
            console.warn(`⚠️ Player ${socketId} tried to move out of bounds: (${x}, ${y})`);
            return false;
        }
        
        // Calculate movement delta for validation
        const dx = Math.abs(x - player.x);
        const dy = Math.abs(y - player.y);
        const maxDelta = 100; // Maximum pixels per update
        
        if (dx > maxDelta || dy > maxDelta) {
            console.warn(`⚠️ Large movement delta from ${socketId}: (${dx}, ${dy})`);
            // Allow but clamp the movement
            player.x = Math.max(-50, Math.min(2050, x));
            player.y = Math.max(-50, Math.min(1050, y));
        } else {
            player.x = x;
            player.y = y;
        }
        
        player.lastMoveTime = Date.now();
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
            if (this.playerStats[socketId]) {
                this.playerStats[socketId].timeSlept += sleepDuration;
            }
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
        if (this.playerStats[socketId]) {
            this.playerStats[socketId].moneyEarned += amount;
        }
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
        if (this.playerStats[socketId]) {
            this.playerStats[socketId].towersPlaced++;
        }
        
        console.log(`🔫 Player ${socketId} placed tower:`, towerData);
        return true;
    }

    addGhostKill(socketId) {
        if (this.playerStats[socketId]) {
            this.playerStats[socketId].ghostsKilled++;
            
            // Add bounty for ghost kill
            const bounty = this.config.GHOST_KILL_BOUNTY;
            this.addMoney(socketId, bounty);
            console.log(`💀 Player ${socketId} killed ghost - earned $${bounty} bounty!`);
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
        const earnings = this.config.SLEEP_EARNINGS;
        let sleepingCount = 0;
        
        try {
            Object.values(this.players).forEach(player => {
                if (player.isSleeping) {
                    this.addMoney(player.id, earnings);
                    sleepingCount++;
                    console.log(`💰 Player ${player.id} earned $${earnings} while sleeping (total: $${player.money})`);
                }
            });
            
            return sleepingCount;
        } catch (error) {
            console.error('❌ Error processing sleep earnings:', error);
            return 0;
        }
    }

    // Get financial stats for all players
    getFinancialStats() {
        const players = Object.values(this.players);
        const totalMoney = players.reduce((sum, p) => sum + p.money, 0);
        const avgMoney = players.length > 0 ? Math.round(totalMoney / players.length) : 0;
        const richestPlayer = players.reduce((max, p) => p.money > max.money ? p : max, { money: 0 });
        
        return {
            totalPlayers: players.length,
            totalMoney: totalMoney,
            averageMoney: avgMoney,
            richestPlayer: richestPlayer.id || 'none',
            richestAmount: richestPlayer.money || 0,
            sleepingCount: this.getSleepingPlayers().length
        };
    }

    // Emergency money reset (admin function)
    resetAllPlayerMoney() {
        Object.values(this.players).forEach(player => {
            player.money = this.config.STARTING_MONEY;
        });
        console.log('🔄 All player money reset to starting amount');
    }

    // Award bonus money to all players
    awardBonusToAll(amount, reason = 'bonus') {
        Object.values(this.players).forEach(player => {
            this.addMoney(player.id, amount);
        });
        console.log(`💰 Awarded $${amount} ${reason} to all ${Object.keys(this.players).length} players`);
    }
}

module.exports = PlayerManager;