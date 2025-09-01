module.exports = {
    SERVER: {
        PORT: 3000,
        HOST: 'localhost'
    },
    
    GAME: {
        ROOM_COUNT: 3,
        GHOST_MOVE_INTERVAL: 1000,
        GHOST_SPEED: 5
    },
    
    PLAYER: {
        STARTING_X: 50,
        STARTING_Y: 500
    },
    
    ROOM_GENERATION: {
        STARTING_X_OFFSET: 200,
        BASE_SPACING: 100,
        TILE_SIZE: 40
    }
};