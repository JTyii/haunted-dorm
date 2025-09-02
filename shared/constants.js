// shared/constants.js

// Shared constants between client and server
const SHARED_CONFIG = {
    // Room generation settings
    ROOM_GENERATION: {
        MIN_ROOMS: 3,
        MAX_ROOMS: 5,
        MIN_BEDS: 1,
        MAX_BEDS: 2,
        STICK_PROBABILITY: 0.6, // client had 0.6, server had 0.4
        MIN_SPACING: 20,        // server had smaller minimum
        MAX_EXTRA_SPACING: 200,
        MIN_COLS: 4,
        MAX_COLS: 8,
        MIN_ROWS: 3,
        MAX_ROWS: 6
    },

    // Door configuration
    DOORS: {
        SIDES: ["top", "bottom", "left", "right"],
        WIDTH: 60,
        HEIGHT: 10
    },

    // Tower types
    TOWER_TYPES: {
        BASIC: {
            type: 'basic',
            cost: 50,
            damage: 10,
            range: 100,
            fireRate: 1000, // ms
            health: 50
        },
        ADVANCED: {
            type: 'advanced',
            cost: 100,
            damage: 20,
            range: 150,
            fireRate: 800,
            health: 75
        },
        MEGA: {
            type: 'mega',
            cost: 200,
            damage: 40,
            range: 200,
            fireRate: 600,
            health: 100
        }
    },

    // Ghost configuration
    GHOST: {
        MAX_GHOSTS: 2,
        BASE_HEALTH: 100,
        BASE_SPEED: 150,
        BASE_ENERGY: 100,
        ENERGY_REGEN: 2, // per second
        ABILITIES: {
            SPEED_BURST: {
                cost: 20,
                cooldown: 5000,
                duration: 3000,
                speedMultiplier: 2
            },
            PHASE_THROUGH: {
                cost: 30,
                cooldown: 8000,
                duration: 2000
            },
            SUMMON_MINION: {
                cost: 50,
                cooldown: 15000,
                minionHealth: 25,
                minionSpeed: 100
            }
        }
    },

    // Network / game events
    EVENTS: {
        // Lobby events
        JOIN_LOBBY: 'join_lobby',
        LOBBY_UPDATE: 'lobby_update',
        SELECT_ROLE: 'select_role',
        ROLE_SELECTED: 'role_selected',
        REQUEST_GAME_START: 'request_game_start',
        GAME_STARTING: 'game_starting',
        GAME_STARTED: 'game_started',

        // Game events
        JOIN_GAME: 'join_game',
        GAME_STATE: 'game_state',
        PLAYER_MOVE: 'player_move', // client version
        PLAYER_JOINED: 'player_joined',
        PLAYER_LEFT: 'player_left',
        PLAYER_JOIN: 'newPlayer', // server version variant
        ROOM_MESSAGE: 'roomMessage',

        // Room/bed events
        ENTER_ROOM: 'enter_room',
        EXIT_ROOM: 'exit_room',
        REQUEST_BED_SLEEP: 'request_bed_sleep',
        REQUEST_WAKE_UP: 'request_wake_up',
        BED_OCCUPIED: 'bed_occupied',
        PLAYER_WOKE_UP: 'player_woke_up',
        SNAP_TO_BED: 'snapToBed',

        // Building events
        BUILD_TOWER: 'build_tower',
        PLACE_TOWER: 'place_tower',
        TOWER_PLACED: 'tower_placed',
        BUILD_FAILED: 'build_failed',
        UPGRADE_TOWER: 'upgrade_tower',

        // Ghost events
        REQUEST_GHOST_ROLE: 'request_ghost_role',
        RELEASE_GHOST_ROLE: 'release_ghost_role',
        GHOST_ROLE_GRANTED: 'ghost_role_granted',
        GHOST_ROLE_DENIED: 'ghost_role_denied',
        GHOST_ROLE_RELEASED: 'ghost_role_released',
        GHOST_INPUT: 'ghost_input',
        GHOST_UPDATE: 'ghost_update',
        GHOST_ABILITY_USED: 'ghost_ability_used',
        GHOST_MINION_SPAWNED: 'ghost_minion_spawned',
        PLAYER_ATTACKED_BY_GHOST: 'player_attacked_by_ghost',
        GHOST_KILLED: 'ghost_killed',

        // General events
        ERROR: 'error',
        DEBUG: 'debug'
    },

    // Player roles
    ROLES: {
        DEFENDER: 'defender',
        GHOST: 'ghost'
    },

    // Game phases
    GAME_PHASES: {
        LOBBY: 'lobby',
        ROOM_SELECT: 'room_select',
        ACTIVE: 'active',
        ENDED: 'ended'
    }
};

// Shared utility functions
const SharedUtils = {
    // Generate random integer between min and max (inclusive)
    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // Calculate distance between two points
    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },

    // Check if point is within rectangle bounds
    pointInRect(px, py, rx, ry, width, height) {
        return px >= rx - width / 2 && px <= rx + width / 2 &&
               py >= ry - height / 2 && py <= ry + height / 2;
    }
};

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = { SHARED_CONFIG, SharedUtils };
} else if (typeof window !== 'undefined') {
    // Browser
    window.SHARED_CONFIG = SHARED_CONFIG;
    window.SharedUtils = SharedUtils;
}
