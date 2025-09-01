const { SERVER, PLAYER } = require('../config/serverConfig');

class PlayerManager {
    constructor() {
        this.players = {};
    }

    createPlayer(socketId) {
        const player = {
            id: socketId,
            x: PLAYER.STARTING_X,
            y: PLAYER.STARTING_Y,
            roomId: null,
            towers: [],
            isSleeping: false,
            bed: null // { roomId, bedIndex }
        };

        this.players[socketId] = player;
        console.log('✅ Player created:', socketId);
        return player;
    }

    getPlayer(socketId) {
        return this.players[socketId];
    }

    getAllPlayers() {
        return this.players;
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

        player.isSleeping = true;
        player.bed = { roomId, bedIndex };
        player.roomId = roomId;
        
        console.log(`😴 Player ${socketId} is now sleeping in room ${roomId}, bed ${bedIndex}`);
        return true;
    }

    wakePlayer(socketId) {
        const player = this.players[socketId];
        if (!player) return false;

        player.isSleeping = false;
        player.bed = null;
        player.roomId = null;
        
        console.log(`☀️ Player ${socketId} woke up`);
        return true;
    }

    addTower(socketId, towerData) {
        const player = this.players[socketId];
        if (!player) return false;

        player.towers.push(towerData);
        console.log(`🔫 Player ${socketId} placed tower:`, towerData);
        return true;
    }

    removePlayer(socketId) {
        const player = this.players[socketId];
        if (player) {
            delete this.players[socketId];
            console.log('❌ Player removed:', socketId);
            return player;
        }
        return null;
    }

    getPlayersArray() {
        return Object.values(this.players);
    }
}

module.exports = PlayerManager;