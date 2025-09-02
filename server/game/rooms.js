// server/game/rooms.js
const config = require('../config/serverConfig');
const { SharedUtils } = require('../../shared/constants');

// Generate rooms for the game
function generateRooms(roomCount = 3) {
    const rooms = [];
    
    for (let i = 0; i < roomCount; i++) {
        const room = generateRoom(i);
        rooms.push(room);
    }
    
    console.log(`🏠 Generated ${rooms.length} rooms`);
    return rooms;
}

// Generate a single room
function generateRoom(index) {
    const { ROOM_GENERATION } = config;
    
    // Random dimensions
    const cols = SharedUtils ? SharedUtils.randInt(ROOM_GENERATION.MIN_COLS, ROOM_GENERATION.MAX_COLS) : 
                  Math.floor(Math.random() * (ROOM_GENERATION.MAX_COLS - ROOM_GENERATION.MIN_COLS + 1)) + ROOM_GENERATION.MIN_COLS;
    const rows = SharedUtils ? SharedUtils.randInt(ROOM_GENERATION.MIN_ROWS, ROOM_GENERATION.MAX_ROWS) :
                  Math.floor(Math.random() * (ROOM_GENERATION.MAX_ROWS - ROOM_GENERATION.MIN_ROWS + 1)) + ROOM_GENERATION.MIN_ROWS;
    
    // Calculate room position
    const roomWidth = cols * ROOM_GENERATION.TILE_SIZE;
    const roomHeight = rows * ROOM_GENERATION.TILE_SIZE;
    
    const x = ROOM_GENERATION.STARTING_X_OFFSET + (index * (roomWidth + ROOM_GENERATION.BASE_SPACING));
    const y = 200 + (index % 2) * 150; // Stagger rooms vertically
    
    // Generate beds
    const bedCount = Math.floor(Math.random() * (ROOM_GENERATION.MAX_BEDS - ROOM_GENERATION.MIN_BEDS + 1)) + ROOM_GENERATION.MIN_BEDS;
    const beds = generateBeds(bedCount, cols, rows, x, y, ROOM_GENERATION.TILE_SIZE);
    
    // Generate doors
    const doors = generateDoors(x, y, roomWidth, roomHeight);
    
    const room = {
        id: `room_${index}`,
        index: index,
        x: x,
        y: y,
        cols: cols,
        rows: rows,
        width: roomWidth,
        height: roomHeight,
        beds: beds,
        doors: doors,
        occupiedBeds: [], // { playerId, bedIndex, occupiedAt }
        towers: [],
        createdAt: Date.now()
    };
    
    console.log(`🏠 Room ${room.id}: ${cols}x${rows}, ${bedCount} beds, at (${x}, ${y})`);
    return room;
}

// Generate beds for a room
function generateBeds(bedCount, cols, rows, roomX, roomY, tileSize) {
    const beds = [];
    const occupiedPositions = new Set();
    
    for (let i = 0; i < bedCount; i++) {
        let attempts = 0;
        let bedPlaced = false;
        
        while (!bedPlaced && attempts < 50) {
            const col = Math.floor(Math.random() * cols);
            const row = Math.floor(Math.random() * rows);
            const posKey = `${col},${row}`;
            
            if (!occupiedPositions.has(posKey)) {
                const bedX = roomX + (col * tileSize) + (tileSize / 2);
                const bedY = roomY + (row * tileSize) + (tileSize / 2);
                
                beds.push({
                    id: `bed_${i}`,
                    index: i,
                    x: bedX,
                    y: bedY,
                    col: col,
                    row: row,
                    occupied: false,
                    playerId: null
                });
                
                occupiedPositions.add(posKey);
                bedPlaced = true;
            }
            attempts++;
        }
    }
    
    return beds;
}

// Generate doors for a room
function generateDoors(x, y, width, height) {
    const doors = [];
    
    // Add a door on each side (simplified)
    doors.push({
        id: 'door_left',
        side: 'left',
        x: x,
        y: y + height / 2,
        width: 10,
        height: 60
    });
    
    doors.push({
        id: 'door_right',
        side: 'right',
        x: x + width,
        y: y + height / 2,
        width: 10,
        height: 60
    });
    
    return doors;
}

// Occupy a bed
function occupyBed(gameState, roomId, playerId, bedIndex) {
    const room = gameState.rooms.find(r => r.id === roomId);
    if (!room) {
        console.log(`❌ Room ${roomId} not found`);
        return false;
    }
    
    const bed = room.beds.find(b => b.index === bedIndex);
    if (!bed) {
        console.log(`❌ Bed ${bedIndex} not found in room ${roomId}`);
        return false;
    }
    
    if (bed.occupied) {
        console.log(`❌ Bed ${bedIndex} in room ${roomId} is already occupied`);
        return false;
    }
    
    // Mark bed as occupied
    bed.occupied = true;
    bed.playerId = playerId;
    
    // Add to room's occupied beds list
    room.occupiedBeds.push({
        playerId: playerId,
        bedIndex: bedIndex,
        occupiedAt: Date.now()
    });
    
    console.log(`🛏️ Player ${playerId} occupied bed ${bedIndex} in room ${roomId}`);
    return true;
}

// Free a bed
function freeBed(gameState, playerId) {
    for (const room of gameState.rooms) {
        // Remove from occupied beds list
        const occupiedBedIndex = room.occupiedBeds.findIndex(b => b.playerId === playerId);
        if (occupiedBedIndex !== -1) {
            const occupiedBed = room.occupiedBeds[occupiedBedIndex];
            room.occupiedBeds.splice(occupiedBedIndex, 1);
            
            // Mark bed as free
            const bed = room.beds.find(b => b.index === occupiedBed.bedIndex);
            if (bed) {
                bed.occupied = false;
                bed.playerId = null;
            }
            
            console.log(`🛏️ Player ${playerId} freed bed ${occupiedBed.bedIndex} in room ${room.id}`);
            return true;
        }
    }
    
    return false;
}

// Get room by ID
function getRoom(gameState, roomId) {
    return gameState.rooms.find(r => r.id === roomId);
}

// Get available beds in a room
function getAvailableBeds(room) {
    return room.beds.filter(bed => !bed.occupied);
}

// Get occupied beds in a room
function getOccupiedBeds(room) {
    return room.beds.filter(bed => bed.occupied);
}

// Check if position is valid for building
function isValidBuildPosition(room, col, row) {
    // Check bounds
    if (col < 0 || col >= room.cols || row < 0 || row >= room.rows) {
        return false;
    }
    
    // Check if there's a bed at this position
    const bedAtPosition = room.beds.find(bed => bed.col === col && bed.row === row);
    if (bedAtPosition) {
        return false;
    }
    
    // Check if there's already a tower at this position
    const towerAtPosition = room.towers.find(tower => tower.col === col && tower.row === row);
    if (towerAtPosition) {
        return false;
    }
    
    return true;
}

// Add tower to room
function addTowerToRoom(gameState, roomId, towerData) {
    const room = getRoom(gameState, roomId);
    if (!room) return false;
    
    if (!room.towers) {
        room.towers = [];
    }
    
    room.towers.push(towerData);
    return true;
}

// Remove tower from room
function removeTowerFromRoom(gameState, roomId, towerId) {
    const room = getRoom(gameState, roomId);
    if (!room || !room.towers) return false;
    
    const towerIndex = room.towers.findIndex(t => t.id === towerId);
    if (towerIndex !== -1) {
        room.towers.splice(towerIndex, 1);
        return true;
    }
    
    return false;
}

// Get room statistics
function getRoomStats(room) {
    return {
        id: room.id,
        dimensions: `${room.cols}x${room.rows}`,
        totalBeds: room.beds.length,
        occupiedBeds: room.beds.filter(b => b.occupied).length,
        availableBeds: room.beds.filter(b => !b.occupied).length,
        towers: room.towers ? room.towers.length : 0,
        players: room.occupiedBeds.map(b => b.playerId)
    };
}

// Utility function similar to SharedUtils.randInt
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
    generateRooms,
    generateRoom,
    occupyBed,
    freeBed,
    getRoom,
    getAvailableBeds,
    getOccupiedBeds,
    isValidBuildPosition,
    addTowerToRoom,
    removeTowerFromRoom,
    getRoomStats
};