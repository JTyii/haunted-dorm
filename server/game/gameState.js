const { generateRooms } = require('./rooms');
const config = require('../config/serverConfig');

let gameState = {
    players: {},
    ghosts: [{ x: 100, y: 100 }],
    rooms: generateRooms(config.GAME.ROOM_COUNT)
};

module.exports = gameState;
