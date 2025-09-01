const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import game modules
const gameState = require('./game/gameState');
const PlayerManager = require('./managers/PlayerManager');
const { generateRooms, occupyBed, freeBed } = require('./game/rooms');
const { placeTower } = require('./game/towers');
const config = require('./config/serverConfig');
const { SHARED_CONFIG, SharedUtils } = require('../shared/constant');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialize PlayerManager
const playerManager = new PlayerManager();

// Serve static files from client folder
app.use(express.static(path.join(__dirname, '../client')));

// ===== Socket.io =====
io.on('connection', (socket) => {
    console.log('✅ Player connected:', socket.id);

    // --- Create new player ---
    const newPlayer = playerManager.createPlayer(socket.id);
    gameState.players[socket.id] = newPlayer;

    // 1. Send full game state to new player
    socket.emit(SHARED_CONFIG.EVENTS.GAME_STATE, gameState);

    // 2. Tell others about the new player
    socket.broadcast.emit(SHARED_CONFIG.EVENTS.PLAYER_JOIN, newPlayer);

    // 3. Send existing players to the newcomer
    playerManager.getPlayersArray().forEach(player => {
        if (player.id !== socket.id) {
            socket.emit(SHARED_CONFIG.EVENTS.PLAYER_JOIN, player);
            socket.emit('playerMove', { playerId: player.id, x: player.x, y: player.y });
        }
    });

    // --- Movement sync ---
    socket.on(SHARED_CONFIG.EVENTS.PLAYER_MOVE, ({ x, y }) => {
        if (playerManager.updatePlayerPosition(socket.id, x, y)) {
            io.emit('playerMove', { playerId: socket.id, x, y });
        }
    });

    // ---- Player enters a room (snap to bed + message)
    socket.on(SHARED_CONFIG.EVENTS.ENTER_ROOM, ({ roomId, bedIndex, bedX, bedY }) => {
        const player = playerManager.getPlayer(socket.id);
        const room = gameState.rooms.find(r => r.id === roomId);
        if (!player || !room) return;

        // mark sleeping
        playerManager.makePlayerSleep(socket.id, roomId, bedIndex);
        occupyBed(gameState, roomId, socket.id, bedIndex);

        console.log(`🛏️ ${socket.id} entered Room ${roomId}, Bed ${bedIndex}`);

        // ✅ snap to bed for everyone
        io.emit(SHARED_CONFIG.EVENTS.SNAP_TO_BED, { playerId: socket.id, bedX, bedY, roomId });

        // 📢 show floating message
        io.emit(SHARED_CONFIG.EVENTS.ROOM_MESSAGE, { 
            text: `Player ${socket.id} entered Room ${roomId}`, 
            x: bedX, 
            y: bedY - 40 
        });

        // refresh state so beds tint correctly
        io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, gameState);
    });

    // ---- Tower placement
    socket.on(SHARED_CONFIG.EVENTS.PLACE_TOWER, (data) => {
        placeTower(gameState, socket, data);
        io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, gameState);
    });

    // ---- Disconnect cleanup
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        playerManager.removePlayer(socket.id);
        freeBed(gameState, socket.id);

        io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, gameState);
    });
});

// ===== Simple Ghost Movement =====
setInterval(() => {
    gameState.ghosts.forEach(g => g.x += config.GAME.GHOST_SPEED);
    io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, gameState);
}, config.GAME.GHOST_MOVE_INTERVAL);

// ===== Start Server =====
server.listen(config.SERVER.PORT, () => console.log(`🚀 Server running on http://${config.SERVER.HOST}:${config.SERVER.PORT}`));
