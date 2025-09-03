// server/index.js - Fixed with Proper Lobby Integration and Connection Handling

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import game modules
const { gameState, updateGameState, ghostLogic } = require('./game/gameState');
const PlayerManager = require('./managers/PlayerManager');
const LobbyManager = require('./managers/LobbyManager');
const { generateRooms, occupyBed, freeBed } = require('./game/rooms');
const { placeTower } = require('./game/towers');
const config = require('./config/serverConfig');
const { SHARED_CONFIG } = require('../shared/constants');

// Enhanced SHARED_CONFIG with all necessary events
SHARED_CONFIG.EVENTS = {
    ...SHARED_CONFIG.EVENTS,
    // Connection events
    CONNECTION: 'connect',
    DISCONNECTION: 'disconnect',
    CONNECTION_ERROR: 'connect_error',
    RECONNECT: 'reconnect',
    RECONNECT_ERROR: 'reconnect_error',
    
    // Lobby events
    JOIN_LOBBY: 'joinLobby',
    LOBBY_UPDATE: 'lobbyUpdate',
    SELECT_ROLE: 'selectRole',
    ROLE_SELECTED: 'roleSelected',
    ROLE_SELECTION_FAILED: 'roleSelectionFailed',
    SET_READY: 'setReady',
    READY_STATUS_UPDATED: 'readyStatusUpdated',
    REQUEST_GAME_START: 'requestGameStart',
    GAME_STARTING: 'gameStarting',
    COUNTDOWN_UPDATE: 'countdownUpdate',
    GAME_STARTED: 'gameStarted',
    
    // Game events
    JOIN_GAME: 'joinGame',
    GAME_STATE: 'gameState',
    PLAYER_MOVE: 'playerMove',
    PLAYER_JOIN: 'playerJoined',
    PLAYER_LEFT: 'playerLeft',
    ENTER_ROOM: 'enterRoom',
    SNAP_TO_BED: 'snapToBed',
    BED_OCCUPIED: 'bedOccupied',
    PLAYER_WOKE_UP: 'playerWokeUp',
    REQUEST_BED_SLEEP: 'requestBedSleep',
    REQUEST_WAKE_UP: 'requestWakeUp',
    ROOM_MESSAGE: 'roomMessage',
    
    // Building events
    BUILD_TOWER: 'buildTower',
    PLACE_TOWER: 'placeTower',
    TOWER_PLACED: 'towerPlaced',
    BUILD_FAILED: 'buildFailed',
    UPGRADE_TOWER: 'upgradeTower',
    
    // Ghost events
    REQUEST_GHOST_ROLE: 'requestGhostRole',
    RELEASE_GHOST_ROLE: 'releaseGhostRole',
    GHOST_ROLE_GRANTED: 'ghostRoleGranted',
    GHOST_ROLE_DENIED: 'ghostRoleDenied',
    GHOST_ROLE_RELEASED: 'ghostRoleReleased',
    GHOST_INPUT: 'ghostInput',
    GHOST_UPDATE: 'ghostUpdate',
    GHOST_ABILITY_USED: 'ghostAbilityUsed',
    GHOST_MINION_SPAWNED: 'ghostMinionSpawned',
    
    // Utility events
    ERROR: 'error',
    DEBUG: 'debug'
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: false
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6,
    allowEIO3: true
});

// Initialize managers
const playerManager = new PlayerManager();
const lobbyManager = new LobbyManager(ghostLogic);

// Store active lobbies (for future multi-lobby support)
const activePlayers = new Map(); // socketId -> player state

// Serve static files with proper MIME types
app.use(express.static(path.join(__dirname, '../client'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

app.use('/src', express.static(path.join(__dirname, '../client/src')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));

// Enhanced API endpoints
app.get('/api/stats', (req, res) => {
    const playerGhosts = Object.keys(ghostLogic.getPlayerGhosts()).length;
    const aiGhosts = ghostLogic.getGhosts().filter(g => g.type === 'ai').length;
    const lobbyStats = lobbyManager.getStats();
    
    res.json({
        lobby: lobbyStats,
        game: {
            activePlayers: playerManager.getActivePlayerCount(),
            totalGhosts: ghostLogic.getGhosts().length,
            playerGhosts: playerGhosts,
            aiGhosts: aiGhosts,
            availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
            currentWave: gameState.waveNumber,
            gameTime: gameState.gameTime
        },
        server: {
            uptime: process.uptime(),
            connectedSockets: io.sockets.sockets.size
        }
    });
});

app.get('/api/lobby', (req, res) => {
    res.json(lobbyManager.getDetailedState());
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        connections: io.sockets.sockets.size
    });
});

// ===== Socket.io Connection Handling =====
io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id, 'from:', socket.handshake.address);
    
    // Track this connection
    activePlayers.set(socket.id, {
        connectedAt: Date.now(),
        inLobby: false,
        inGame: false
    });

    // Send connection confirmation
    socket.emit('connected', { socketId: socket.id, timestamp: Date.now() });

    // ===== LOBBY EVENTS =====
    
    socket.on(SHARED_CONFIG.EVENTS.JOIN_LOBBY, (playerData) => {
        console.log('📥 Join lobby request from:', socket.id, playerData);
        
        try {
            // Add player to lobby
            const player = lobbyManager.addPlayer(socket.id, playerData);
            
            // Update connection state
            const playerState = activePlayers.get(socket.id);
            if (playerState) {
                playerState.inLobby = true;
            }
            
            // Send lobby state to all players
            const lobbyState = lobbyManager.getLobbyState();
            io.emit(SHARED_CONFIG.EVENTS.LOBBY_UPDATE, lobbyState);
            
            console.log('✅ Player joined lobby successfully:', socket.id);
            
        } catch (error) {
            console.error('❌ Failed to join lobby:', error);
            socket.emit(SHARED_CONFIG.EVENTS.ERROR, { 
                message: 'Failed to join lobby: ' + error.message 
            });
        }
    });

    socket.on(SHARED_CONFIG.EVENTS.SELECT_ROLE, ({ role }) => {
        console.log('📥 Role selection from:', socket.id, '- Role:', role);
        
        try {
            const result = lobbyManager.selectRole(socket.id, role);
            
            if (result.success) {
                // Confirm role selection to player
                socket.emit(SHARED_CONFIG.EVENTS.ROLE_SELECTED, { role: result.role });
                
                // Update all players with new lobby state
                const lobbyState = lobbyManager.getLobbyState();
                io.emit(SHARED_CONFIG.EVENTS.LOBBY_UPDATE, lobbyState);
                
                console.log('✅ Role selected successfully:', socket.id, '- Role:', role);
            } else {
                socket.emit(SHARED_CONFIG.EVENTS.ROLE_SELECTION_FAILED, { reason: result.reason });
                console.log('❌ Role selection failed:', socket.id, '- Reason:', result.reason);
            }
        } catch (error) {
            console.error('❌ Error handling role selection:', error);
            socket.emit(SHARED_CONFIG.EVENTS.ERROR, { message: 'Role selection error' });
        }
    });

    socket.on(SHARED_CONFIG.EVENTS.SET_READY, ({ ready }) => {
        console.log('📥 Ready status from:', socket.id, '- Ready:', ready);
        
        try {
            const result = lobbyManager.setPlayerReady(socket.id, ready);
            
            if (result.success) {
                // Confirm ready status to player
                socket.emit(SHARED_CONFIG.EVENTS.READY_STATUS_UPDATED, { ready: result.ready });
                
                // Update all players with new lobby state
                const lobbyState = lobbyManager.getLobbyState();
                io.emit(SHARED_CONFIG.EVENTS.LOBBY_UPDATE, lobbyState);
                
                console.log('✅ Ready status updated:', socket.id, '- Ready:', ready);
            } else {
                socket.emit(SHARED_CONFIG.EVENTS.ERROR, { message: result.reason });
                console.log('❌ Ready status update failed:', socket.id, '- Reason:', result.reason);
            }
        } catch (error) {
            console.error('❌ Error handling ready status:', error);
            socket.emit(SHARED_CONFIG.EVENTS.ERROR, { message: 'Ready status error' });
        }
    });

    socket.on(SHARED_CONFIG.EVENTS.REQUEST_GAME_START, () => {
        console.log('📥 Game start request from:', socket.id);
        
        try {
            if (lobbyManager.canStartGame()) {
                // Start the game (async)
                lobbyManager.startGame(io).then(success => {
                    if (success) {
                        console.log('✅ Game started successfully');
                        
                        // Move players from lobby to game state
                        const players = lobbyManager.getAllPlayers();
                        players.forEach(player => {
                            // Create game player
                            const newPlayer = playerManager.createPlayer(player.id);
                            newPlayer.selectedRole = player.selectedRole;
                            gameState.players[player.id] = newPlayer;
                            
                            // Update connection state
                            const playerState = activePlayers.get(player.id);
                            if (playerState) {
                                playerState.inLobby = false;
                                playerState.inGame = true;
                            }
                        });
                        
                    } else {
                        socket.emit(SHARED_CONFIG.EVENTS.ERROR, { message: 'Failed to start game' });
                    }
                }).catch(error => {
                    console.error('❌ Game start error:', error);
                    socket.emit(SHARED_CONFIG.EVENTS.ERROR, { message: 'Game start failed: ' + error.message });
                });
            } else {
                const validation = lobbyManager.validateGameStart();
                socket.emit(SHARED_CONFIG.EVENTS.ERROR, { 
                    message: 'Cannot start game: ' + validation.issues.join(', ') 
                });
            }
        } catch (error) {
            console.error('❌ Error handling game start request:', error);
            socket.emit(SHARED_CONFIG.EVENTS.ERROR, { message: 'Game start request error' });
        }
    });

    // ===== GAME EVENTS (after game has started) =====
    
    socket.on(SHARED_CONFIG.EVENTS.JOIN_GAME, () => {
        console.log('📥 Join game request from:', socket.id);
        
        try {
            if (!gameState.players[socket.id] && !lobbyManager.hasPlayer(socket.id)) {
                // Create new player if not exists
                const newPlayer = playerManager.createPlayer(socket.id);
                gameState.players[socket.id] = newPlayer;
                
                // Update connection state
                const playerState = activePlayers.get(socket.id);
                if (playerState) {
                    playerState.inGame = true;
                }
            }

            // Send enhanced game state with ghost info
            const enhancedGameState = {
                ...gameState,
                availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
                playerGhosts: Object.keys(ghostLogic.getPlayerGhosts())
            };
            
            socket.emit(SHARED_CONFIG.EVENTS.GAME_STATE, enhancedGameState);
            
            // Notify other players
            const player = gameState.players[socket.id];
            if (player) {
                socket.broadcast.emit(SHARED_CONFIG.EVENTS.PLAYER_JOIN, player);
            }
            
        } catch (error) {
            console.error('❌ Error joining game:', error);
            socket.emit(SHARED_CONFIG.EVENTS.ERROR, { message: 'Failed to join game' });
        }
    });

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

    // Room entry and bed interactions
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

        io.emit(SHARED_CONFIG.EVENTS.BED_OCCUPIED, { 
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

    socket.on(SHARED_CONFIG.EVENTS.REQUEST_BED_SLEEP, ({ bedId, roomId, bedIndex }) => {
        // Handle bed sleep request (alternative to ENTER_ROOM)
        socket.emit(SHARED_CONFIG.EVENTS.ENTER_ROOM, { roomId, bedIndex, bedX: 0, bedY: 0 });
    });

    socket.on(SHARED_CONFIG.EVENTS.REQUEST_WAKE_UP, () => {
        const player = playerManager.getPlayer(socket.id);
        if (player && player.isSleeping) {
            freeBed(gameState, socket.id);
            playerManager.wakePlayer(socket.id);
            
            socket.emit(SHARED_CONFIG.EVENTS.PLAYER_WOKE_UP, { playerId: socket.id });
            
            const updatedGameState = {
                ...gameState,
                availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
                playerGhosts: Object.keys(ghostLogic.getPlayerGhosts())
            };
            io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, updatedGameState);
            console.log(`☀️ Player ${socket.id} woke up`);
        }
    });

    // Tower placement
    socket.on(SHARED_CONFIG.EVENTS.BUILD_TOWER, (data) => {
        // Ghosts can't place towers
        if (ghostLogic.isPlayerGhost(socket.id)) {
            socket.emit(SHARED_CONFIG.EVENTS.BUILD_FAILED, {
                reason: 'Ghosts cannot build towers!'
            });
            return;
        }

        try {
            const result = placeTower(gameState, socket, data);
            if (result.success) {
                playerManager.addTower(socket.id, result.tower);
                io.emit(SHARED_CONFIG.EVENTS.TOWER_PLACED, result.tower);
                console.log('🏗️ Tower placed:', result.tower.id);
            } else {
                socket.emit(SHARED_CONFIG.EVENTS.BUILD_FAILED, {
                    reason: result.error
                });
            }
        } catch (error) {
            console.error('❌ Tower placement error:', error);
            socket.emit(SHARED_CONFIG.EVENTS.BUILD_FAILED, {
                reason: 'Tower placement failed'
            });
        }
    });

    // Legacy tower placement event (for compatibility)
    socket.on(SHARED_CONFIG.EVENTS.PLACE_TOWER, (data) => {
        socket.emit(SHARED_CONFIG.EVENTS.BUILD_TOWER, data);
    });

    // ===== GHOST SYSTEM EVENTS =====

    // Request to become a ghost
    socket.on(SHARED_CONFIG.EVENTS.REQUEST_GHOST_ROLE, () => {
        console.log(`👻 Player ${socket.id} requesting ghost role`);
        
        // Can't become ghost while sleeping
        const player = playerManager.getPlayer(socket.id);
        if (player && player.isSleeping) {
            socket.emit(SHARED_CONFIG.EVENTS.GHOST_ROLE_DENIED, 'Cannot become ghost while sleeping');
            return;
        }

        try {
            const result = ghostLogic.requestGhostRole(socket.id, {
                spawnX: player ? player.x - 100 : -50,
                spawnY: player ? player.y : 400
            });

            if (result.success) {
                // Player becomes a ghost
                socket.emit(SHARED_CONFIG.EVENTS.GHOST_ROLE_GRANTED, result.ghost);
                
                // Notify all players about new ghost
                io.emit(SHARED_CONFIG.EVENTS.GHOST_UPDATE, ghostLogic.getGhosts());
                
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
        } catch (error) {
            console.error('❌ Ghost role request error:', error);
            socket.emit(SHARED_CONFIG.EVENTS.GHOST_ROLE_DENIED, 'Ghost role system error');
        }
    });

    // Release ghost role
    socket.on(SHARED_CONFIG.EVENTS.RELEASE_GHOST_ROLE, () => {
        console.log(`👻 Player ${socket.id} releasing ghost role`);
        
        try {
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
        } catch (error) {
            console.error('❌ Ghost role release error:', error);
            socket.emit(SHARED_CONFIG.EVENTS.ERROR, { message: 'Failed to release ghost role' });
        }
    });

    // Ghost input handling
    socket.on(SHARED_CONFIG.EVENTS.GHOST_INPUT, (inputData) => {
        if (!ghostLogic.isPlayerGhost(socket.id)) return;
        
        try {
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
        } catch (error) {
            console.error('❌ Ghost input error:', error);
        }
    });

    // Chat messages
    socket.on('chatMessage', ({ message }) => {
        const player = playerManager.getPlayer(socket.id);
        const isGhost = ghostLogic.isPlayerGhost(socket.id);
        
        if (player && message && message.trim()) {
            io.emit('chatMessage', {
                playerId: socket.id,
                message: message.trim(),
                timestamp: Date.now(),
                isGhost: isGhost
            });
        }
    });

    // Debug event handler
    socket.on(SHARED_CONFIG.EVENTS.DEBUG, (data) => {
        if (process.env.NODE_ENV === 'development') {
            console.log('🐛 Debug message from', socket.id, ':', data);
        }
    });

    // ===== CONNECTION CLEANUP =====
    socket.on('disconnect', (reason) => {
        console.log('❌ Client disconnected:', socket.id, '- Reason:', reason);
        
        try {
            // Remove from active players
            activePlayers.delete(socket.id);
            
            // Release ghost role if player was a ghost
            if (ghostLogic.isPlayerGhost(socket.id)) {
                ghostLogic.releaseGhostRole(socket.id);
            }
            
            // Remove from lobby if present
            if (lobbyManager.hasPlayer(socket.id)) {
                lobbyManager.removePlayer(socket.id);
                
                // Update lobby for remaining players
                const lobbyState = lobbyManager.getLobbyState();
                io.emit(SHARED_CONFIG.EVENTS.LOBBY_UPDATE, lobbyState);
            }
            
            // Clean up game state
            if (gameState.players[socket.id]) {
                // Clean up player from bed
                freeBed(gameState, socket.id);
                
                // Remove player
                playerManager.removePlayer(socket.id);
                delete gameState.players[socket.id];

                // Notify remaining players
                socket.broadcast.emit(SHARED_CONFIG.EVENTS.PLAYER_LEFT, socket.id);
                
                // Send updated state with ghost info
                const updatedGameState = {
                    ...gameState,
                    availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
                    playerGhosts: Object.keys(ghostLogic.getPlayerGhosts())
                };
                io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, updatedGameState);
                io.emit(SHARED_CONFIG.EVENTS.GHOST_UPDATE, ghostLogic.getGhosts());
            }
        } catch (error) {
            console.error('❌ Error during disconnect cleanup:', error);
        }
    });

    // Handle connection errors
    socket.on('error', (error) => {
        console.error('❌ Socket error for', socket.id, ':', error);
    });
});

// ===== Enhanced Game Loop =====
let lastUpdate = Date.now();

// Main game update loop
const gameUpdateInterval = setInterval(() => {
    try {
        const currentTime = Date.now();
        const deltaTime = currentTime - lastUpdate;
        lastUpdate = currentTime;

        // Update game state (ghosts, waves, etc.)
        updateGameState();
        
        // Process sleep earnings for game players only
        const sleepingCount = playerManager.processSleepEarnings();
        
        // Send money updates to sleeping players
        if (sleepingCount > 0) {
            Object.values(gameState.players).forEach(player => {
                if (player.isSleeping) {
                    const socket = io.sockets.sockets.get(player.id);
                    if (socket) {
                        socket.emit('moneyUpdate', player.money);
                    }
                }
            });
        }
        
        // Send updated game state with ghost information (only if game is active)
        if (Object.keys(gameState.players).length > 0) {
            const enhancedGameState = {
                ...gameState,
                availableGhostSlots: ghostLogic.getAvailableGhostSlots(),
                playerGhosts: Object.keys(ghostLogic.getPlayerGhosts())
            };
            io.emit(SHARED_CONFIG.EVENTS.GAME_STATE, enhancedGameState);
            
            // Send ghost updates (positions, health, etc.)
            io.emit(SHARED_CONFIG.EVENTS.GHOST_UPDATE, ghostLogic.getGhosts());
        }
        
    } catch (error) {
        console.error('❌ Game update error:', error);
    }
}, config.GAME?.GAME_STATE_UPDATE_INTERVAL || 1000);

// Sleep earnings timer
const sleepEarningsInterval = setInterval(() => {
    try {
        playerManager.processSleepEarnings();
    } catch (error) {
        console.error('❌ Sleep earnings error:', error);
    }
}, config.GAME?.SLEEP_EARNINGS_INTERVAL || 5000);

// Performance monitoring
const statsInterval = setInterval(() => {
    try {
        const playerGhostCount = Object.keys(ghostLogic.getPlayerGhosts()).length;
        const aiGhostCount = ghostLogic.getGhosts().filter(g => g.type === 'ai').length;
        const lobbyStats = lobbyManager.getStats();
        
        const stats = {
            connections: io.sockets.sockets.size,
            activePlayers: activePlayers.size,
            lobby: lobbyStats,
            game: {
                players: Object.keys(gameState.players).length,
                totalGhosts: ghostLogic.getGhosts().length,
                playerGhosts: playerGhostCount,
                aiGhosts: aiGhostCount,
                availableSlots: ghostLogic.getAvailableGhostSlots(),
                wave: gameState.waveNumber
            },
            server: {
                uptime: Math.floor(process.uptime()),
                memory: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
            }
        };
        
        console.log('📈 Server stats:', JSON.stringify(stats, null, 2));
    } catch (error) {
        console.error('❌ Stats error:', error);
    }
}, 30000);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down server gracefully...');
    
    try {
        // Clear intervals
        clearInterval(gameUpdateInterval);
        clearInterval(sleepEarningsInterval);
        clearInterval(statsInterval);
        
        // Notify all connected clients
        io.emit('serverShutdown', { message: 'Server is shutting down' });
        
        // Save player data
        const players = playerManager.getPlayersArray();
        console.log(`💾 Saving data for ${players.length} players...`);
        
        // Close server
        server.close(() => {
            console.log('✅ Server shut down successfully');
            process.exit(0);
        });
        
        // Force exit after 5 seconds
        setTimeout(() => {
            console.log('⚠️ Force shutdown after timeout');
            process.exit(1);
        }, 5000);
        
    } catch (error) {
        console.error('❌ Shutdown error:', error);
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// ===== Start Server =====
const PORT = config.SERVER?.PORT || process.env.PORT || 3000;
const HOST = config.SERVER?.HOST || 'localhost';

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, '../client')}`);
    console.log(`🎮 Game initialized with ${gameState.rooms ? gameState.rooms.length : 0} rooms`);
    console.log(`👻 Ghost system active - AI + ${ghostLogic.getAvailableGhostSlots()} player slots`);
    console.log(`🏰 Tower defense system enabled`);
    console.log(`🎯 Lobby system ready for players`);
    console.log('💡 Available endpoints:');
    console.log('   GET /api/stats - Server statistics');
    console.log('   GET /api/lobby - Lobby information');
    console.log('   GET /health - Health check');
});