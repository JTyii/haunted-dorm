const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import game modules
const { gameState, updateGameState, ghostLogic } = require('./game/gameState');
const PlayerManager = require('./managers/PlayerManager');
const { generateRooms, occupyBed, freeBed } = require('./game/rooms');
const { placeTower } = require('./game/towers');
const config = require('./config/serverConfig');
const { SHARED_CONFIG } = require('../shared/constants');
const DatabaseManager = require('./db/sqlite');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Initialize managers
const playerManager = new PlayerManager();
const dbManager = new DatabaseManager();

// Initialize database
dbManager.init().catch(console.error);

// Serve static files from client folder
app.use(express.static(path.join(__dirname, '../client')));
app.use('/src', express.static(path.join(__dirname, '../client/src')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));

// API endpoints
app.get('/api/stats', (req, res) => {
    res.json({
        activePlayers: playerManager.getActivePlayerCount(),
        totalGhosts: gameState.ghosts.length,
        currentWave: gameState.waveNumber,
        gameTime: gameState.gameTime
    });
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const scores = await dbManager.getTopScores(10);
        res.json(scores);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get leaderboard' });
    }
});

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
            socket.emit(SHARED_CONFIG.EVENTS.PLAYER_MOVE, { playerId: player.id, x: player.x, y: player.y });
        }
    });

    // --- Movement sync ---
    socket.on(SHARED_CONFIG.EVENTS.PLAYER_MOVE, ({ x, y }) => {
        if (playerManager.updatePlayerPosition(socket.id, x, y)) {
            socket.broadcast.emit(SHARED_CONFIG.EVENTS.PLAYER_MOVE, { playerId: socket.id, x, y });
        }
    });

    // ---- Player enters a room (snap to bed + message)
    socket.on(SHARED_CONFIG.EVENTS.ENTER_ROOM, ({ roomId, bedIndex, bedX, bedY }) => {
        const player = playerManager.getPlayer(socket.id);
        const room = gameState.rooms.find(r => r.id === roomId);
        if (!player || !room) return;

        // Check if bed is already occupied
        const bedOccupied = room.occupiedBeds.find(b => b.index === bedIndex);
        if (bedOccupied) {
            socket.emit(SHARED_CONFIG.EVENTS.ROOM_MESSAGE, { 
                text: 'Bed is occupied!', 
                x: bedX, 
                y: bedY - 40 
            });
            return;
        }

        // Wake up player from any previous bed
        if (player.isSleeping) {
            freeBed(gameState, socket.id);
            playerManager.wakePlayer(socket.id);
        }

        // Mark player as sleeping in new bed
        playerManager.makePlayerSleep(socket.id, roomId, bedIndex);
        occupyBed(gameState, roomId, socket.id, bedIndex);

        console.log(`🛏️ ${socket.id} entered Room ${roomId}, Bed ${bedIndex}`);

        // ✅ Snap to bed for everyone
        io.emit(SHARED_CONFIG.EVENTS.SNAP_TO_BED, { playerId: socket.id, bedX, bedY, roomId });

        // 📢 Show floating message
        io.emit(SHARED_CONFIG.EVENTS.ROOM_MESSAGE, { 
            text: `Player joined Room ${roomId}`, 
            x: bedX, 
            y: bedY - 40 
        });

        // Refresh state so beds tint correctly
        io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, gameState);
    });

    // ---- Tower placement
    socket.on(SHARED_CONFIG.EVENTS.PLACE_TOWER, (data) => {
        const result = placeTower(gameState, socket, data);
        if (result.success) {
            playerManager.addTower(socket.id, result.tower);
            io.emit(SHARED_CONFIG.EVENTS.TOWER_PLACED, result.tower);
            
            // Save tower stats to database
            dbManager.saveTowerStats({
                playerId: socket.id,
                roomId: data.roomId,
                col: data.col,
                row: data.row,
                towerType: data.type,
                cost: data.cost,
                damageDealt: 0,
                ghostsKilled: 0
            }).catch(console.error);
            
        } else {
            socket.emit(SHARED_CONFIG.EVENTS.ROOM_MESSAGE, {
                text: result.error,
                x: data.x || 640,
                y: data.y || 360
            });
        }
    });

    // ---- Player manually leaves bed
    socket.on('leaveBed', () => {
        const player = playerManager.getPlayer(socket.id);
        if (player && player.isSleeping) {
            freeBed(gameState, socket.id);
            playerManager.wakePlayer(socket.id);
            
            io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, gameState);
            console.log(`☀️ Player ${socket.id} manually left bed`);
        }
    });

    // ---- Chat messages
    socket.on('chatMessage', ({ message }) => {
        const player = playerManager.getPlayer(socket.id);
        if (player && message.trim()) {
            io.emit('chatMessage', {
                playerId: socket.id,
                message: message.trim(),
                timestamp: Date.now()
            });
        }
    });

    // ---- Disconnect cleanup
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        const player = playerManager.getPlayer(socket.id);
        const stats = playerManager.getSessionStats(socket.id);
        
        // Save session to database
        if (player && stats) {
            dbManager.saveGameSession({
                playerId: socket.id,
                moneyEarned: stats.moneyEarned,
                towersPlaced: stats.towersPlaced,
                ghostsDefeated: stats.ghostsKilled,
                waveReached: gameState.waveNumber
            }).catch(console.error);

            // Save high score if it's significant
            const score = stats.moneyEarned + (stats.ghostsKilled * 10) + (gameState.waveNumber * 50);
            if (score > 100) {
                dbManager.saveHighScore({
                    playerId: socket.id,
                    score,
                    waveReached: gameState.waveNumber,
                    ghostsKilled: stats.ghostsKilled,
                    moneyEarned: stats.moneyEarned
                }).catch(console.error);
            }
        }
        
        // Clean up player from bed
        freeBed(gameState, socket.id);
        
        // Remove player
        playerManager.removePlayer(socket.id);
        delete gameState.players[socket.id];

        // Notify all remaining players
        socket.broadcast.emit('playerLeft', socket.id);
        io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, gameState);
    });
});

// ===== Game Loop =====
let lastUpdate = Date.now();

// Main game update loop
setInterval(() => {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastUpdate;
    lastUpdate = currentTime;

    // Update game state (ghosts, waves, etc.)
    updateGameState();
    
    // Process sleep earnings
    const sleepingCount = playerManager.processSleepEarnings();
    
    // Send money updates to sleeping players
    if (sleepingCount > 0) {
        Object.values(gameState.players).forEach(player => {
            if (player.isSleeping) {
                io.to(player.id).emit('moneyUpdate', player.money);
            }
        });
    }
    
    // Send updated game state to all clients
    io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, gameState);
}, config.GAME.GAME_STATE_UPDATE_INTERVAL);

// Sleep earnings timer
setInterval(() => {
    playerManager.processSleepEarnings();
}, config.GAME.SLEEP_EARNINGS_INTERVAL);

// Performance monitoring
setInterval(() => {
    const stats = {
        players: Object.keys(gameState.players).length,
        ghosts: gameState.ghosts.length,
        wave: gameState.waveNumber,
        uptime: process.uptime()
    };
    console.log('📈 Server stats:', stats);
}, 30000); // Every 30 seconds

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down server gracefully...');
    
    // Save all player data
    const players = playerManager.getPlayersArray();
    for (const player of players) {
        try {
            await dbManager.savePlayer({
                id: player.id,
                username: player.id, // Using socket ID as username for now
                money: player.money,
                totalEarnings: playerManager.getPlayerStats(player.id)?.moneyEarned || 0,
                towersBuilt: player.towers.length,
                ghostsKilled: playerManager.getPlayerStats(player.id)?.ghostsKilled || 0,
                timePlayed: Date.now() - player.joinTime
            });
        } catch (error) {
            console.error(`❌ Error saving player ${player.id}:`, error);
        }
    }
    
    // Close database
    dbManager.close();
    
    // Close server
    server.close(() => {
        console.log('✅ Server shut down successfully');
        process.exit(0);
    });
});

// ===== Start Server =====
server.listen(config.SERVER.PORT, () => {
    console.log(`🚀 Server running on http://${config.SERVER.HOST}:${config.SERVER.PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, '../client')}`);
    console.log(`🎮 Game initialized with ${gameState.rooms.length} rooms`);
    console.log(`👻 Ghost system active - spawning every ${config.GAME.GHOST_SPAWN_RATE/1000}s`);
});