function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRooms(count) {
    const rooms = [];
    let xOffset = 200;
    for (let i = 1; i <= count; i++) {
        const cols = randInt(4, 8);
        const rows = randInt(3, 6);
        const bedCount = randInt(1, 2);

        rooms.push({
            id: i,
            x: xOffset,
            y: 200,
            bedCount,
            occupiedBeds: [],
            cols,
            rows
        });

        xOffset += cols * 40 + 100;
    }
    return rooms;
}

function occupyBed(gameState, roomId, playerId, index) {
    const room = gameState.rooms.find(r => r.id === roomId);
    if (room) room.occupiedBeds.push({ playerId, index });
}

function freeBed(gameState, playerId) {
    gameState.rooms.forEach(room => {
        room.occupiedBeds = room.occupiedBeds.filter(b => b.playerId !== playerId);
    });
}

module.exports = { generateRooms, occupyBed, freeBed };
