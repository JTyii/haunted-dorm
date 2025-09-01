const { generateRooms } = require('./rooms');

let gameState = {
    players: {},
    ghosts: [{ x: 100, y: 100 }],
    rooms: generateRooms(3)
};

module.exports = gameState;
