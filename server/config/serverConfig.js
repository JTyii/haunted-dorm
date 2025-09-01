module.exports = {
    SERVER: {
        PORT: process.env.PORT || 3000,
        HOST: 'localhost'
    },
    
    GAME: {
        ROOM_COUNT: 3,
        GHOST_MOVE_INTERVAL: 1000, // milliseconds
        GHOST_SPEED: 5,
        GHOST_SPAWN_RATE: 5000, // milliseconds between spawns
        MAX_GHOSTS: 10,
        WAVE_DURATION: 30000, // 30 seconds per wave
        SLEEP_EARNINGS_INTERVAL: 2000, // milliseconds between sleep earnings
        GAME_STATE_UPDATE_INTERVAL: 100 // milliseconds
    },
    
    PLAYER: {
        STARTING_X: 50,
        STARTING_Y: 500,
        STARTING_MONEY: 100,
        SLEEP_EARNINGS: 5,
        GHOST_KILL_BOUNTY: 10
    },
    
    ROOM_GENERATION: {
        STARTING_X_OFFSET: 200,
        BASE_SPACING: 100,
        TILE_SIZE: 60, // Match client tile size
        MIN_COLS: 4,
        MAX_COLS: 8,
        MIN_ROWS: 3,
        MAX_ROWS: 6,
        MIN_BEDS: 1,
        MAX_BEDS: 2
    },
    
    GHOSTS: {
        BASE_HEALTH: 30,
        BASE_SPEED: 20,
        HEALTH_INCREASE_PER_WAVE: 5,
        SPEED_INCREASE_PER_WAVE: 2,
        ATTACK_DAMAGE: 20,
        ATTACK_RANGE: 30
    },
    
    TOWERS: {
        BASIC: {
            COST: 50,
            DAMAGE: 10,
            RANGE: 100,
            FIRE_RATE: 1000
        }
    }
};