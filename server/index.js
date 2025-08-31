const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from client folder
app.use(express.static(path.join(__dirname, '../client')));

// ===== Helpers =====
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// generate random rooms at server start
function generateRooms(count) {
    const rooms = [];
    let xOffset = 200; // spacing between rooms
    for (let i = 1; i <= count; i++) {
        const cols = randInt(4, 8);  // room width in tiles
        const rows = randInt(3, 6);  // room height in tiles
        const bedCount = randInt(1, 2);

        rooms.push({
            id: i,
            x: xOffset,
            y: 200,
            bedCount,
            occupiedBeds: [], // array of { playerId, index }
            cols,
            rows
        });

        xOffset += cols * 40 + 100; // spread them apart
    }
    return rooms;
}

// ===== Game State =====
let gameState = {
    players: {},
    ghosts: [{ x: 100, y: 100 }],
    rooms: generateRooms(3) 
};

// ===== Socket.io =====
io.on('connection', (socket) => {
    console.log('✅ Player connected:', socket.id);

    // --- Create new player ---
    gameState.players[socket.id] = {
        id: socket.id,
        x: 50,
        y: 500,
        roomId: null,
        towers: [],
        isSleeping: false,
        bed: null // { roomId, bedIndex }
    };

    // 1. Send full game state to new player
    socket.emit('gameState', gameState);

    // 2. Tell others about the new player
    socket.broadcast.emit('newPlayer', gameState.players[socket.id]);

    // 3. Send existing players to the newcomer
    Object.values(gameState.players).forEach(player => {
        if (player.id !== socket.id) {
            socket.emit('newPlayer', player);
            socket.emit('playerMove', { playerId: player.id, x: player.x, y: player.y });
        }
    });

    // --- Movement sync ---
    socket.on('movePlayer', ({ x, y }) => {
        const player = gameState.players[socket.id];
        if (!player || player.isSleeping) return; // 🚫 no movement if sleeping

        player.x = x;
        player.y = y;
        io.emit('playerMove', { playerId: socket.id, x, y });
    });

    // ---- Player enters a room (snap to bed + message)
    socket.on('enterRoom', ({ roomId, bedIndex, bedX, bedY }) => {
        const player = gameState.players[socket.id];
        const room = gameState.rooms.find(r => r.id === roomId);
        if (!player || !room) return;

        // mark sleeping
        player.isSleeping = true;
        player.bed = { roomId, bedIndex };
        player.roomId = roomId;

        room.occupiedBeds.push({ playerId: socket.id, index: bedIndex });

        console.log(`🛏️ ${socket.id} entered Room ${roomId}, Bed ${bedIndex}`);

        // ✅ snap to bed for everyone
        io.emit('snapToBed', { playerId: socket.id, bedX, bedY, roomId });

        // 📢 show floating message
        io.emit('roomMessage', { 
            text: `Player ${socket.id} entered Room ${roomId}`, 
            x: bedX, 
            y: bedY - 40 
        });

        // refresh state so beds tint correctly
        io.emit('gameState', gameState);
    });

    // ---- Tower placement
    socket.on('placeTower', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].towers.push(data);
            io.emit('gameState', gameState);
        }
    });

    // ---- Disconnect cleanup
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        const player = gameState.players[socket.id];
        delete gameState.players[socket.id];

        // free up their bed if sleeping
        gameState.rooms.forEach(r => {
            r.occupiedBeds = r.occupiedBeds.filter(b => b.playerId !== socket.id);
        });

        io.emit('gameState', gameState);
    });
});

// ===== Simple Ghost Movement =====
setInterval(() => {
    gameState.ghosts.forEach(g => g.x += 5);
    io.emit('gameState', gameState);
}, 1000);

// ===== Start Server =====
server.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));
