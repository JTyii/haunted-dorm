// server/managers/GameManager.js - Enhanced with broadcasting
const config = require('../config/serverConfig');
const PlayerManager = require('./PlayerManager');
const { generateRooms } = require('../game/rooms');

class GameManager {
    constructor() {
        this.playerManager = new PlayerManager();
        this.gameState = {
            rooms: [],
            players: {},
            ghosts: {},
            gameStarted: false,
            seed: Date.now() // Deterministic seed for room generation
        };
        this.io = null;
        this.lastUpdate = Date.now();
        this.updateInterval = null;
        
        console.log('🎮 GameManager initialized with seed:', this.gameState.seed);
    }

    initialize(io) {
        this.io = io;
        this.startGameLoop();
        this.generateGameRooms();
        console.log('✅ GameManager initialized with Socket.IO');
    }

    // Generate rooms once on server startup with deterministic seed
    generateGameRooms() {
        // Use the seed to create deterministic random generation
        const seededRandom = this.createSeededRandom(this.gameState.seed);
        
        // Generate rooms with seeded randomness
        this.gameState.rooms = this.generateDeterministicRooms(seededRandom);
        
        console.log(`🏠 Generated ${this.gameState.rooms.length} deterministic rooms`);
        this.broadcastGameState();
    }

    // Create seeded random function for deterministic generation
    createSeededRandom(seed) {
        let currentSeed = seed;
        return function() {
            currentSeed = (currentSeed * 9301 + 49297) % 233280;
            return currentSeed / 233280;
        };
    }

    // Generate rooms with deterministic randomness
    generateDeterministicRooms(random) {
        const rooms = [];
        const roomCount = 4; // Fixed room count
        
        for (let i = 0; i < roomCount; i++) {
            const room = this.generateDeterministicRoom(i, random);
            rooms.push(room);
        }
        
        return rooms;
    }

    generateDeterministicRoom(index, random) {
        const { ROOM_GENERATION } = config;
        
        // Use seeded random for consistent generation
        const cols = Math.floor(random() * (ROOM_GENERATION.MAX_COLS - ROOM_GENERATION.MIN_COLS + 1)) + ROOM_GENERATION.MIN_COLS;
        const rows = Math.floor(random() * (ROOM_GENERATION.MAX_ROWS - ROOM_GENERATION.MIN_ROWS + 1)) + ROOM_GENERATION.MIN_ROWS;
        
        // Calculate deterministic positions
        const roomWidth = cols * ROOM_GENERATION.TILE_SIZE;
        const roomHeight = rows * ROOM_GENERATION.TILE_SIZE;
        
        // Deterministic positioning logic
        let x, isStuckToPrevious = false;
        if (index === 0) {
            x = 300; // First room at fixed position
        } else {
            const prevRoom = rooms[index - 1];
            const shouldStick = random() < 0.4; // 40% chance to stick
            
            if (shouldStick && prevRoom) {
                x = prevRoom.x + prevRoom.width + 20;
                isStuckToPrevious = true;
            } else {
                x = prevRoom ? (prevRoom.x + prevRoom.width + 100 + random() * 200) : 300;
            }
        }
        
        const y = 360; // Fixed Y position for all rooms
        
        // Generate deterministic doors
        const doorSides = ['top', 'bottom', 'left', 'right'];
        let availableSides = [...doorSides];
        
        if (isStuckToPrevious) {
            availableSides = availableSides.filter(side => side !== 'left');
        }
        
        const doorSide = availableSides[Math.floor(random() * availableSides.length)];
        
        // Generate beds deterministically
        const bedCount = Math.floor(random() * 3) + 2; // 2-4 beds
        
        const room = {
            id: index,
            index: index,
            x: x,
            y: y,
            cols: cols,
            rows: rows,
            width: roomWidth,
            height: roomHeight,
            bedCount: bedCount,
            doorSide: doorSide,
            occupiedBeds: [],
            towers: [],
            createdAt: Date.now(),
            isStuckToPrevious: isStuckToPrevious
        };
        
        console.log(`🏠 Room ${room.id}: ${cols}x${rows}, ${bedCount} beds, door on ${doorSide}`);
        return room;
    }

    // Handle player connection
    handlePlayerJoin(socket) {
        console.log('👤 Player joined:', socket.id);
        
        // Create player
        const player = this.playerManager.createPlayer(socket.id);
        this.gameState.players[socket.id] = player;
        
        // Send initial game state to new player
        socket.emit('gameState', this.gameState);
        
        // Broadcast to all other players that someone joined
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            player: player
        });
        
        // Setup player event handlers
        this.setupPlayerEventHandlers(socket);
        
        console.log(`✅ Player ${socket.id} joined game. Total players: ${Object.keys(this.gameState.players).length}`);
    }

    setupPlayerEventHandlers(socket) {
        // Handle player movement
        socket.on('playerMove', (data) => {
            this.handlePlayerMove(socket.id, data);
        });
        
        // Handle room entry
        socket.on('enterRoom', (data) => {
            this.handleEnterRoom(socket.id, data);
        });
        
        // Handle wake up
        socket.on('wakeUp', () => {
            this.handleWakeUp(socket.id);
        });
        
        // Handle tower placement
        socket.on('placeTower', (data) => {
            this.handlePlaceTower(socket.id, data);
        });
        
        // Handle disconnection
        socket.on('disconnect', () => {
            this.handlePlayerLeave(socket.id);
        });
    }

    // Handle player movement with broadcasting
    handlePlayerMove(playerId, data) {
        const player = this.gameState.players[playerId];
        if (!player || player.isSleeping) return;
        
        // Validate movement (basic bounds checking)
        const { x, y } = data;
        if (typeof x !== 'number' || typeof y !== 'number') return;
        if (x < 0 || x > 2000 || y < 0 || y > 1000) return;
        
        // Update player position
        player.x = x;
        player.y = y;
        player.lastMoveTime = Date.now();
        
        // Broadcast movement to all OTHER players (not the sender)
        this.io.to(playerId).emit('playerMoved', {
            playerId: playerId,
            x: x,
            y: y,
            timestamp: Date.now()
        });
        
        // Optional: Rate limit movement updates
        if (!player.lastBroadcast || Date.now() - player.lastBroadcast > 50) { // 20fps max
            this.io.emit('playerMoved', {
                playerId: playerId,
                x: x,
                y: y,
                timestamp: Date.now()
            });
            player.lastBroadcast = Date.now();
        }
    }

    // Handle room entry (bed occupation)
    handleEnterRoom(playerId, data) {
        const { roomId, bedIndex, x, y } = data;
        const player = this.gameState.players[playerId];
        const room = this.gameState.rooms.find(r => r.id === roomId);
        
        if (!player || !room) return;
        
        console.log(`🛏️ Player ${playerId} attempting to enter room ${roomId}, bed ${bedIndex}`);
        
        // Check if bed is available
        const bedOccupied = room.occupiedBeds.find(bed => bed.index === bedIndex);
        if (bedOccupied) {
            console.log(`❌ Bed ${bedIndex} in room ${roomId} is already occupied`);
            return;
        }
        
        // Remove player from previous bed if any
        this.removePlayerFromAllBeds(playerId);
        
        // Occupy the bed
        room.occupiedBeds.push({
            playerId: playerId,
            index: bedIndex,
            occupiedAt: Date.now()
        });
        
        // Update player state
        player.isSleeping = true;
        player.roomId = roomId;
        player.bed = { roomId, bedIndex };
        player.x = x;
        player.y = y;
        
        // Broadcast bed occupation to all players
        this.io.emit('bedOccupied', {
            playerId: playerId,
            roomId: roomId,
            bedIndex: bedIndex,
            bedX: x,
            bedY: y
        });
        
        console.log(`✅ Player ${playerId} is now sleeping in room ${roomId}, bed ${bedIndex}`);
        
        // Start money earning for this player
        this.startPlayerEarnings(playerId);
    }

    // Handle player wake up
    handleWakeUp(playerId) {
        const player = this.gameState.players[playerId];
        if (!player || !player.isSleeping) return;
        
        console.log(`☀️ Player ${playerId} waking up`);
        
        // Remove from bed
        this.removePlayerFromAllBeds(playerId);
        
        // Update player state
        player.isSleeping = false;
        player.roomId = null;
        player.bed = null;
        
        // Stop earning money
        this.stopPlayerEarnings(playerId);
        
        // Broadcast wake up to all players
        this.io.emit('playerWokeUp', {
            playerId: playerId
        });
    }

    // Handle tower placement
    handlePlaceTower(playerId, data) {
        const { roomId, col, row, towerType, x, y } = data;
        const player = this.gameState.players[playerId];
        const room = this.gameState.rooms.find(r => r.id === roomId);
        
        if (!player || !room) {
            this.io.to(playerId).emit('buildFailed', { reason: 'Invalid room or player' });
            return;
        }
        
        // Check if player has enough money
        const cost = config.GAME.TURRET_COST || 50;
        if (player.money < cost) {
            this.io.to(playerId).emit('buildFailed', { reason: 'Not enough money' });
            return;
        }
        
        // Check if position is valid (simplified check)
        const existingTower = room.towers.find(t => t.col === col && t.row === row);
        if (existingTower) {
            this.io.to(playerId).emit('buildFailed', { reason: 'Position occupied' });
            return;
        }
        
        // Place tower
        const tower = {
            id: `tower_${Date.now()}`,
            playerId: playerId,
            roomId: roomId,
            col: col,
            row: row,
            x: x,
            y: y,
            type: towerType,
            placedAt: Date.now()
        };
        
        room.towers.push(tower);
        player.money -= cost;
        
        // Broadcast tower placement to all players
        this.io.emit('towerPlaced', {
            tower: tower,
            playerId: playerId
        });
        
        console.log(`🔫 Player ${playerId} placed tower in room ${roomId} at (${col}, ${row})`);
    }

    // Utility methods
    removePlayerFromAllBeds(playerId) {
        this.gameState.rooms.forEach(room => {
            const bedIndex = room.occupiedBeds.findIndex(bed => bed.playerId === playerId);
            if (bedIndex !== -1) {
                room.occupiedBeds.splice(bedIndex, 1);
            }
        });
    }

    startPlayerEarnings(playerId) {
        if (this.playerEarningIntervals && this.playerEarningIntervals[playerId]) {
            clearInterval(this.playerEarningIntervals[playerId]);
        }
        
        if (!this.playerEarningIntervals) {
            this.playerEarningIntervals = {};
        }
        
        this.playerEarningIntervals[playerId] = setInterval(() => {
            const player = this.gameState.players[playerId];
            if (player && player.isSleeping) {
                const earnings = config.GAME.SLEEP_EARNINGS_PER_INTERVAL || 5;
                player.money += earnings;
                
                // Broadcast money update
                this.io.emit('playerMoneyUpdated', {
                    playerId: playerId,
                    money: player.money,
                    earned: earnings
                });
            }
        }, config.GAME.SLEEP_INTERVAL || 2000);
    }

    stopPlayerEarnings(playerId) {
        if (this.playerEarningIntervals && this.playerEarningIntervals[playerId]) {
            clearInterval(this.playerEarningIntervals[playerId]);
            delete this.playerEarningIntervals[playerId];
        }
    }

    // Handle player disconnect
    handlePlayerLeave(playerId) {
        console.log('👋 Player left:', playerId);
        
        // Stop earning money
        this.stopPlayerEarnings(playerId);
        
        // Remove from beds
        this.removePlayerFromAllBeds(playerId);
        
        // Remove player
        delete this.gameState.players[playerId];
        this.playerManager.removePlayer(playerId);
        
        // Broadcast to remaining players
        this.io.emit('playerLeft', { playerId: playerId });
        
        console.log(`❌ Player ${playerId} removed. Remaining players: ${Object.keys(this.gameState.players).length}`);
    }

    // Game loop for regular updates
    startGameLoop() {
        this.updateInterval = setInterval(() => {
            this.gameLoop();
        }, 1000 / 60); // 60 FPS server tick rate
        
        // Slower broadcast loop for full state synchronization
        this.broadcastInterval = setInterval(() => {
            this.broadcastGameState();
        }, 1000); // 1 FPS for full state sync
    }

    gameLoop() {
        const now = Date.now();
        const deltaTime = now - this.lastUpdate;
        
        // Update game logic here
        // - Process ghost movements
        // - Handle collisions
        // - Update timers
        
        this.lastUpdate = now;
    }

    // Broadcast complete game state to all clients
    broadcastGameState() {
        if (this.io) {
            this.io.emit('gameState', {
                rooms: this.gameState.rooms,
                players: this.gameState.players,
                ghosts: this.gameState.ghosts,
                timestamp: Date.now()
            });
        }
    }

    // Get current game statistics
    getGameStats() {
        return {
            totalPlayers: Object.keys(this.gameState.players).length,
            totalRooms: this.gameState.rooms.length,
            sleepingPlayers: Object.values(this.gameState.players).filter(p => p.isSleeping).length,
            totalTowers: this.gameState.rooms.reduce((sum, room) => sum + room.towers.length, 0),
            gameUptime: Date.now() - (this.gameState.startTime || Date.now())
        };
    }

    // Cleanup
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
        }
        
        // Stop all player earnings
        if (this.playerEarningIntervals) {
            Object.values(this.playerEarningIntervals).forEach(interval => {
                clearInterval(interval);
            });
        }
        
        console.log('🗑️ GameManager destroyed');
    }
}

module.exports = GameManager;