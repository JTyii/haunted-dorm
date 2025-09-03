// server/config/serverConfig.js - Unified Configuration

module.exports = {
    SERVER: {
        PORT: process.env.PORT || 3000,
        HOST: process.env.HOST || 'localhost',
        CORS_ORIGIN: process.env.CORS_ORIGIN || "*"
    },
    
    SOCKET: {
        PING_TIMEOUT: 60000,
        PING_INTERVAL: 25000,
        UPGRADE_TIMEOUT: 10000,
        MAX_HTTP_BUFFER_SIZE: 1e6,
        TRANSPORTS: ['websocket', 'polling'],
        CORS: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type"],
            credentials: false
        }
    },
    
    GAME: {
        // Update intervals
        GAME_STATE_UPDATE_INTERVAL: 100,   // smoother updates
        SLEEP_EARNINGS_INTERVAL: 2000,    // 2 sec per earnings
        GHOST_UPDATE_INTERVAL: 500,       // ghost movement check
        WAVE_DURATION: 60000,             // 60 sec wave
        WAVE_BREAK_DURATION: 10000,       // 10 sec break

        // Player economy
        SLEEP_EARNINGS_PER_INTERVAL: 5,
        PLAYER_START_MONEY: 100,
        PLAYER_START_HEALTH: 100,
        PLAYER_SPEED: 3,
        GHOST_KILL_BOUNTY: 10,

        // Towers
        BASE_TOWER_COST: 50,
        TOWER_RANGE: 150,
        TOWER_DAMAGE: 25,
        TOWER_FIRE_RATE: 1000,

        // Lobby / limits
        MIN_PLAYERS: 2,
        MAX_PLAYERS: 8,
        MAX_GHOSTS: 10,   // merge (player+AI limit)
        MAX_AI_GHOSTS: 3,
        GAME_START_COUNTDOWN: 3,
        ROOMS_COUNT: 6,
        BEDS_PER_ROOM: 4
    },
    
    ROOM_GENERATION: {
        STARTING_X_OFFSET: 200,
        BASE_SPACING: 100,
        TILE_SIZE: 60,
        MIN_COLS: 4,
        MAX_COLS: 8,
        MIN_ROWS: 3,
        MAX_ROWS: 6,
        MIN_BEDS: 1,
        MAX_BEDS: 2
    },
    
    GHOSTS: {
        BASE_HEALTH: 30,
        BASE_SPEED: 2,  // use consistent speed with GAME.GHOST_SPEED
        HEALTH_INCREASE_PER_WAVE: 5,
        SPEED_INCREASE_PER_WAVE: 2,
        ATTACK_DAMAGE: 20,
        ATTACK_RANGE: 30,
        SPAWN_DELAY: 2000,
        SPAWN_RATE: 5000 // new: milliseconds between spawns
    },
    
    TOWERS: {
        BASIC: {
            COST: 50,
            DAMAGE: 10,
            RANGE: 100,
            FIRE_RATE: 1000
        }
    },

    LOBBY: {
        MAX_LOBBIES: 10,
        LOBBY_TIMEOUT: 300000,
        READY_TIMEOUT: 60000,
        ROLE_SELECTION_TIMEOUT: 30000
    },
    
    NETWORK: {
        RECONNECT_ATTEMPTS: 5,
        RECONNECT_DELAY: 2000,
        CONNECTION_TIMEOUT: 10000,
        HEARTBEAT_INTERVAL: 30000
    },
    
    LOGGING: {
        LEVEL: process.env.LOG_LEVEL || 'info',
        STATS_INTERVAL: 30000,
        ENABLE_DEBUG: process.env.NODE_ENV === 'development'
    },
    
    SECURITY: {
        RATE_LIMIT: {
            WINDOW_MS: 15 * 60 * 1000,
            MAX_REQUESTS: 100
        },
        MAX_MESSAGE_LENGTH: 1000,
        MAX_USERNAME_LENGTH: 20
    }
};
