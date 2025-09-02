// server/index.js - Updated with Ghost System Integration

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

// Enhanced SHARED_CONFIG with ghost events
SHARED_CONFIG.EVENTS = {
    ...SHARED_CONFIG.EVENTS,
    // Ghost events
    REQUEST_GHOST_ROLE: 'requestGhostRole',
    RELEASE_GHOST_ROLE: 'releaseGhostRole',
    GHOST_ROLE_GRANTED: 'ghostRoleGranted',
    GHOST_ROLE_DENIED: 'ghostRoleDenied',
    GHOST_ROLE_RELEASED: 'ghostRoleReleased',
    GHOST_INPUT: 'ghostInput',
    GHOST_UPDATE: 'ghostUpdate',
    GHOST_ABILITY_USED: 'ghostAbilityUsed',
    GHOST_MINION_SPAWNED: 'ghostMinionSpawned'
};

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

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));
app.use('/src', express.static(path.join(__dirname, '../client/src')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));

// Enhanced API endpoints
app.get('/api/stats', (req, res) => {
    const playerGhosts = Object.keys(ghostLogic.getPlayerGhosts()).length;
    const aiGhosts = ghostLogic.getGhosts().filter(g => g.type === 'ai').length;
    
    res.json({
        activePlayers: playerManager.getActivePlayerCount(),
        totalGhosts: ghostLogic.getGhosts().length,
        playerGhosts: playerGhosts,
        aiGhosts: aiGhosts,
        availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
        currentWave: gameState.waveNumber,
        gameTime: gameState.gameTime
    });
});

// ===== Socket.io with Ghost System =====
io.on('connection', (socket) => {
    console.log('✅ Player connected:', socket.id);

    // --- Create new player ---
    const newPlayer = playerManager.createPlayer(socket.id);
    gameState.players[socket.id] = newPlayer;

    // Send enhanced game state with ghost info
    const enhancedGameState = {
        ...gameState,
        availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
        playerGhosts: Object.keys(ghostLogic.getPlayerGhosts())
    };
    
    socket.emit(SHARED_CONFIG.EVENTS.GAME_STATE, enhancedGameState);
    socket.broadcast.emit(SHARED_CONFIG.EVENTS.PLAYER_JOIN, newPlayer);

    // ===== EXISTING EVENTS =====
    
    // Movement sync
    socket.on(SHARED_CONFIG.EVENTS.PLAYER_MOVE, ({ x, y }) => {
        // Don't process movement if player is a ghost
        if (ghostLogic.isPlayerGhost(socket.id)) return;
        
        if (playerManager.updatePlayerPosition(socket.id, x, y)) {
            socket.broadcast.emit(SHARED_CONFIG.EVENTS.PLAYER_MOVE, { 
                playerId: socket.id, x, y 
            });
        }
    });

    // Room entry
    socket.on(SHARED_CONFIG.EVENTS.ENTER_ROOM, ({ roomId, bedIndex, bedX, bedY }) => {
        // Ghosts can't sleep in beds
        if (ghostLogic.isPlayerGhost(socket.id)) {
            socket.emit(SHARED_CONFIG.EVENTS.ROOM_MESSAGE, {
                text: 'Ghosts cannot sleep!',
                x: bedX,
                y: bedY - 40
            });
            return;
        }

        const player = playerManager.getPlayer(socket.id);
        const room = gameState.rooms.find(r => r.id === roomId);
        if (!player || !room) return;

        const bedOccupied = room.occupiedBeds.find(b => b.index === bedIndex);
        if (bedOccupied) {
            socket.emit(SHARED_CONFIG.EVENTS.ROOM_MESSAGE, { 
                text: 'Bed is occupied!', 
                x: bedX, 
                y: bedY - 40 
            });
            return;
        }

        if (player.isSleeping) {
            freeBed(gameState, socket.id);
            playerManager.wakePlayer(socket.id);
        }

        playerManager.makePlayerSleep(socket.id, roomId, bedIndex);
        occupyBed(gameState, roomId, socket.id, bedIndex);

        console.log(`🛏️ ${socket.id} entered Room ${roomId}, Bed ${bedIndex}`);

        io.emit(SHARED_CONFIG.EVENTS.SNAP_TO_BED, { 
            playerId: socket.id, bedX, bedY, roomId 
        });
        io.emit(SHARED_CONFIG.EVENTS.ROOM_MESSAGE, { 
            text: `Player joined Room ${roomId}`, 
            x: bedX, 
            y: bedY - 40 
        });

        // Update game state
        const updatedGameState = {
            ...gameState,
            availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
            playerGhosts: Object.keys(ghostLogic.getPlayerGhosts())
        };
        io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, updatedGameState);
    });

    // Tower placement
    socket.on(SHARED_CONFIG.EVENTS.PLACE_TOWER, (data) => {
        // Ghosts can't place towers
        if (ghostLogic.isPlayerGhost(socket.id)) {
            socket.emit(SHARED_CONFIG.EVENTS.ROOM_MESSAGE, {
                text: 'Ghosts cannot build towers!',
                x: data.x || 640,
                y: data.y || 360
            });
            return;
        }

        const result = placeTower(gameState, socket, data);
        if (result.success) {
            playerManager.addTower(socket.id, result.tower);
            io.emit(SHARED_CONFIG.EVENTS.TOWER_PLACED, result.tower);
        } else {
            socket.emit(SHARED_CONFIG.EVENTS.ROOM_MESSAGE, {
                text: result.error,
                x: data.x || 640,
                y: data.y || 360
            });
        }
    });

    // ===== NEW GHOST EVENTS =====

    // Request to become a ghost
    socket.on(SHARED_CONFIG.EVENTS.REQUEST_GHOST_ROLE, () => {
        console.log(`👻 Player ${socket.id} requesting ghost role`);
        
        // Can't become ghost while sleeping
        const player = playerManager.getPlayer(socket.id);
        if (player && player.isSleeping) {
            socket.emit(SHARED_CONFIG.EVENTS.GHOST_ROLE_DENIED, 'Cannot become ghost while sleeping');
            return;
        }

        const result = ghostLogic.requestGhostRole(socket.id, {
            spawnX: player ? player.x - 100 : -50,
            spawnY: player ? player.y : 400
        });

        if (result.success) {
            // Player becomes a ghost
            socket.emit(SHARED_CONFIG.EVENTS.GHOST_ROLE_GRANTED, result.ghost);
            
            // Notify all players about new ghost
            socket.broadcast.emit(SHARED_CONFIG.EVENTS.GHOST_UPDATE, ghostLogic.getGhosts());
            
            // Update available slots
            const updatedGameState = {
                ...gameState,
                availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
                playerGhosts: Object.keys(ghostLogic.getPlayerGhosts())
            };
            io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, updatedGameState);
            
            console.log(`✅ Player ${socket.id} became a ghost`);
        } else {
            socket.emit(SHARED_CONFIG.EVENTS.GHOST_ROLE_DENIED, result.reason);
            console.log(`❌ Ghost request denied for ${socket.id}: ${result.reason}`);
        }
    });

    // Release ghost role
    socket.on(SHARED_CONFIG.EVENTS.RELEASE_GHOST_ROLE, () => {
        console.log(`👻 Player ${socket.id} releasing ghost role`);
        
        if (ghostLogic.releaseGhostRole(socket.id)) {
            socket.emit(SHARED_CONFIG.EVENTS.GHOST_ROLE_RELEASED);
            
            // Update all players about ghost removal
            io.emit(SHARED_CONFIG.EVENTS.GHOST_UPDATE, ghostLogic.getGhosts());
            
            // Update available slots
            const updatedGameState = {
                ...gameState,
                availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
                playerGhosts: Object.keys(ghostLogic.getPlayerGhosts())
            };
            io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, updatedGameState);
            
            console.log(`✅ Player ${socket.id} stopped being a ghost`);
        }
    });

    // Ghost input handling
    socket.on(SHARED_CONFIG.EVENTS.GHOST_INPUT, (inputData) => {
        if (!ghostLogic.isPlayerGhost(socket.id)) return;
        
        const success = ghostLogic.handlePlayerGhostInput(socket.id, inputData);
        
        if (success && inputData.action === 'ability') {
            // Notify all players about ability use
            const ghost = ghostLogic.getPlayerGhosts()[socket.id];
            if (ghost) {
                io.emit(SHARED_CONFIG.EVENTS.GHOST_ABILITY_USED, {
                    ghostId: ghost.id,
                    abilityName: inputData.abilityName
                });
            }
        }
    });

    // Player manually leaves bed
    socket.on('leaveBed', () => {
        const player = playerManager.getPlayer(socket.id);
        if (player && player.isSleeping) {
            freeBed(gameState, socket.id);
            playerManager.wakePlayer(socket.id);
            
            const updatedGameState = {
                ...gameState,
                availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
                playerGhosts: Object.keys(ghostLogic.getPlayerGhosts())
            };
            io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, updatedGameState);
            console.log(`☀️ Player ${socket.id} manually left bed`);
        }
    });

    // Chat messages
    socket.on('chatMessage', ({ message }) => {
        const player = playerManager.getPlayer(socket.id);
        const isGhost = ghostLogic.isPlayerGhost(socket.id);
        
        if (player && message.trim()) {
            io.emit('chatMessage', {
                playerId: socket.id,
                message: message.trim(),
                timestamp: Date.now(),
                isGhost: isGhost
            });
        }
    });

    // ===== DISCONNECT CLEANUP =====
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        // Release ghost role if player was a ghost
        if (ghostLogic.isPlayerGhost(socket.id)) {
            ghostLogic.releaseGhostRole(socket.id);
        }
        
        // Clean up player from bed
        freeBed(gameState, socket.id);
        
        // Remove player
        playerManager.removePlayer(socket.id);
        delete gameState.players[socket.id];

        // Notify remaining players
        socket.broadcast.emit('playerLeft', socket.id);
        
        // Send updated state with ghost info
        const updatedGameState = {
            ...gameState,
            availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
            playerGhosts: Object.keys(ghostLogic.getPlayerGhosts())
        };
        io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, updatedGameState);
        io.emit(SHARED_CONFIG.EVENTS.GHOST_UPDATE, ghostLogic.getGhosts());
    });
});

// ===== Enhanced Game Loop with Ghost System =====
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
    
    // Send updated game state with ghost information
    const enhancedGameState = {
        ...gameState,
        availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
        playerGhosts: Object.keys(ghostLogic.getPlayerGhosts())
    };
    io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, enhancedGameState);
    
    // Send ghost updates (positions, health, etc.)
    io.emit(SHARED_CONFIG.EVENTS.GHOST_UPDATE, ghostLogic.getGhosts());
    
}, config.GAME.GAME_STATE_UPDATE_INTERVAL);

// Sleep earnings timer
setInterval(() => {
    playerManager.processSleepEarnings();
}, config.GAME.SLEEP_EARNINGS_INTERVAL);

// Enhanced performance monitoring
setInterval(() => {
    const playerGhostCount = Object.keys(ghostLogic.getPlayerGhosts()).length;
    const aiGhostCount = ghostLogic.getGhosts().filter(g => g.type === 'ai').length;
    
    const stats = {
        players: Object.keys(gameState.players).length,
        totalGhosts: ghostLogic.getGhosts().length,
        playerGhosts: playerGhostCount,
        aiGhosts: aiGhostCount,
        availableSlots: ghostLogic.getAvailableGhostSlots(),
        wave: gameState.waveNumber,
        uptime: process.uptime()
    };
    
    console.log('📈 Server stats:', stats);
}, 30000);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down server gracefully...');
    
    // Save all player data (existing code...)
    const players = playerManager.getPlayersArray();
    console.log(`💾 Saving data for ${players.length} players...`);
    
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
    console.log(`👻 Ghost system active - AI + ${ghostLogic.getAvailableGhostSlots()} player slots`);
    console.log(`🏰 Tower defense system enabled`);
});