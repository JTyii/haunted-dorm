// shared/constants.js - Fixed and unified constants

// Shared constants between client and server
const SHARED_CONFIG = {
    // Room generation settings (unified values)
    ROOM_GENERATION: {
        MIN_ROOMS: 3,
        MAX_ROOMS: 5,
        MIN_BEDS: 1,
        MAX_BEDS: 2,
        STICK_PROBABILITY: 0.6,
        MIN_SPACING: 20,
        MAX_EXTRA_SPACING: 200,
        MIN_COLS: 4,
        MAX_COLS: 8,
        MIN_ROWS: 3,
        MAX_ROWS: 6,
        TILE_SIZE: 60, // Added for consistency
        STARTING_X_OFFSET: 200,
        BASE_SPACING: 100
    },

    // Door configuration
    DOORS: {
        SIDES: ["top", "bottom", "left", "right"],
        WIDTH: 60,
        HEIGHT: 10
    },

    // Tower types (updated with more balanced values)
    TOWER_TYPES: {
        BASIC: {
            type: 'basic',
            cost: 50,
            damage: 10,
            range: 100,
            fireRate: 1000, // ms
            health: 50,
            upgradeMultiplier: 1.5
        },
        ADVANCED: {
            type: 'advanced',
            cost: 100,
            damage: 20,
            range: 150,
            fireRate: 800,
            health: 75,
            upgradeMultiplier: 1.7
        },
        MEGA: {
            type: 'mega',
            cost: 200,
            damage: 40,
            range: 200,
            fireRate: 600,
            health: 100,
            upgradeMultiplier: 2.0
        }
    },

    // Ghost configuration (enhanced)
    GHOST: {
        MAX_GHOSTS: 2,
        BASE_HEALTH: 100,
        BASE_SPEED: 150,
        BASE_ENERGY: 100,
        ENERGY_REGEN: 2, // per second
        ABILITIES: {
            SPEED_BURST: {
                name: 'Speed Burst',
                cost: 20,
                cooldown: 5000,
                duration: 3000,
                speedMultiplier: 2,
                description: 'Move faster temporarily'
            },
            PHASE_THROUGH: {
                name: 'Phase Through',
                cost: 30,
                cooldown: 8000,
                duration: 2000,
                description: 'Pass through walls'
            },
            SUMMON_MINION: {
                name: 'Summon Minion',
                cost: 50,
                cooldown: 15000,
                minionHealth: 25,
                minionSpeed: 100,
                description: 'Create helper ghost'
            }
        }
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
    },

    // Lobby settings
    LOBBY: {
        MIN_PLAYERS: 2,
        MAX_PLAYERS: 8,
        MAX_GHOSTS: 2,
        COUNTDOWN_DURATION: 3, // seconds
        READY_TIMEOUT: 30000 // 30 seconds to ready up
    },

    // Economy settings (unified)
    ECONOMY: {
        STARTING_MONEY: 100,
        SLEEP_EARNINGS: 5,
        SLEEP_INTERVAL: 2000, // ms
        GHOST_KILL_BOUNTY: 10,
        TOWER_COST_MULTIPLIER: 1.2 // for upgrades
    },

    // Network / game events (unified and organized)
    EVENTS: {
        // Connection events
        CONNECTION: 'connect',
        DISCONNECTION: 'disconnect',
        CONNECTION_ERROR: 'connect_error',
        RECONNECT: 'reconnect',
        RECONNECT_ERROR: 'reconnect_error',

        // Lobby events
        JOIN_LOBBY: 'join_lobby',
        LEAVE_LOBBY: 'leave_lobby',
        LOBBY_UPDATE: 'lobby_update',
        SELECT_ROLE: 'select_role',
        ROLE_SELECTED: 'role_selected',
        ROLE_SELECTION_FAILED: 'role_selection_failed',
        SET_READY: 'set_ready',
        READY_STATUS_UPDATED: 'ready_status_updated',
        REQUEST_GAME_START: 'request_game_start',
        GAME_START_FAILED: 'game_start_failed',
        GAME_STARTING: 'game_starting',
        GAME_STARTED: 'game_started',
        COUNTDOWN_UPDATE: 'countdown_update',

        // Game state events
        JOIN_GAME: 'join_game',
        GAME_STATE: 'game_state',
        GAME_STATE_UPDATE: 'game_state_update',
        PLAYER_JOINED: 'player_joined',
        PLAYER_LEFT: 'player_left',
        NEW_PLAYER: 'newPlayer', // server compatibility

        // Movement events
        PLAYER_MOVE: 'player_move',
        PLAYER_POSITION_UPDATE: 'player_position_update',

        // Room/bed events
        ENTER_ROOM: 'enter_room',
        EXIT_ROOM: 'exit_room',
        REQUEST_BED_SLEEP: 'request_bed_sleep',
        REQUEST_WAKE_UP: 'request_wake_up',
        BED_OCCUPIED: 'bed_occupied',
        BED_FREED: 'bed_freed',
        PLAYER_WOKE_UP: 'player_woke_up',
        SNAP_TO_BED: 'snapToBed',
        ROOM_MESSAGE: 'roomMessage',

        // Building events
        BUILD_TOWER: 'build_tower',
        PLACE_TOWER: 'place_tower',
        TOWER_PLACED: 'tower_placed',
        BUILD_FAILED: 'build_failed',
        UPGRADE_TOWER: 'upgrade_tower',
        TOWER_UPGRADED: 'tower_upgraded',
        TOWER_DESTROYED: 'tower_destroyed',

        // Ghost events
        REQUEST_GHOST_ROLE: 'request_ghost_role',
        RELEASE_GHOST_ROLE: 'release_ghost_role',
        GHOST_ROLE_GRANTED: 'ghost_role_granted',
        GHOST_ROLE_DENIED: 'ghost_role_denied',
        GHOST_ROLE_RELEASED: 'ghost_role_released',
        GHOST_INPUT: 'ghost_input',
        GHOST_UPDATE: 'ghost_update',
        GHOST_POSITION_UPDATE: 'ghost_position_update',
        GHOST_ABILITY_USED: 'ghost_ability_used',
        GHOST_ABILITY_FAILED: 'ghost_ability_failed',
        GHOST_MINION_SPAWNED: 'ghost_minion_spawned',
        PLAYER_ATTACKED_BY_GHOST: 'player_attacked_by_ghost',
        GHOST_KILLED: 'ghost_killed',

        // Economy events
        MONEY_UPDATE: 'money_update',
        MONEY_EARNED: 'money_earned',
        MONEY_SPENT: 'money_spent',

        // General events
        ERROR: 'error',
        DEBUG: 'debug',
        MESSAGE: 'message',
        NOTIFICATION: 'notification'
    },

    // Network settings
    NETWORK: {
        RECONNECT_ATTEMPTS: 5,
        RECONNECT_DELAY: 2000, // ms
        TIMEOUT: 10000, // ms
        PING_INTERVAL: 25000, // ms
        PING_TIMEOUT: 5000, // ms
        UPGRADE_TIMEOUT: 10000, // ms
        TRANSPORTS: ['websocket', 'polling']
    },

    // Game timing
    TIMING: {
        GAME_UPDATE_INTERVAL: 100, // ms
        GHOST_MOVE_INTERVAL: 1000, // ms
        WAVE_DURATION: 30000, // ms
        GHOST_SPAWN_RATE: 5000 // ms
    }
};

// Shared utility functions
const SharedUtils = {
    // Generate random integer between min and max (inclusive)
    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // Generate random float between min and max
    randFloat(min, max) {
        return Math.random() * (max - min) + min;
    },

    // Calculate distance between two points
    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },

    // Check if point is within rectangle bounds
    pointInRect(px, py, rx, ry, width, height) {
        return px >= rx - width / 2 && px <= rx + width / 2 &&
               py >= ry - height / 2 && py <= ry + height / 2;
    },

    // Check if point is within circle bounds
    pointInCircle(px, py, cx, cy, radius) {
        return this.distance(px, py, cx, cy) <= radius;
    },

    // Clamp value between min and max
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    // Linear interpolation
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    },

    // Normalize angle to 0-2π range
    normalizeAngle(angle) {
        while (angle < 0) angle += Math.PI * 2;
        while (angle >= Math.PI * 2) angle -= Math.PI * 2;
        return angle;
    },

    // Convert degrees to radians
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    },

    // Convert radians to degrees
    toDegrees(radians) {
        return radians * (180 / Math.PI);
    },

    // Deep clone object
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
    },

    // Validate player name
    isValidPlayerName(name) {
        if (!name || typeof name !== 'string') return false;
        const cleaned = name.trim();
        return cleaned.length >= 1 && cleaned.length <= 20 && /^[a-zA-Z0-9_\s]+$/.test(cleaned);
    },

    // Generate unique ID
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    // Format time duration
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000) % 60;
        const minutes = Math.floor(ms / 60000) % 60;
        const hours = Math.floor(ms / 3600000);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// Validation functions
const Validators = {
    // Validate role selection
    isValidRole(role) {
        return Object.values(SHARED_CONFIG.ROLES).includes(role);
    },

    // Validate tower type
    isValidTowerType(type) {
        return Object.keys(SHARED_CONFIG.TOWER_TYPES).includes(type.toUpperCase());
    },

    // Validate ghost ability
    isValidGhostAbility(ability) {
        return Object.keys(SHARED_CONFIG.GHOST.ABILITIES).includes(ability.toUpperCase());
    },

    // Validate position
    isValidPosition(x, y, bounds) {
        if (typeof x !== 'number' || typeof y !== 'number') return false;
        if (!bounds) return true;
        return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
    },

    // Validate money amount
    isValidMoneyAmount(amount) {
        return typeof amount === 'number' && amount >= 0 && Number.isInteger(amount);
    }
};

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { 
        SHARED_CONFIG, 
        SharedUtils,
        Validators
    };
} else if (typeof window !== 'undefined') {
    // Browser environment
    window.SHARED_CONFIG = SHARED_CONFIG;
    window.SharedUtils = SharedUtils;
    window.Validators = Validators;
} else {
    // Other environments (like Web Workers)
    this.SHARED_CONFIG = SHARED_CONFIG;
    this.SharedUtils = SharedUtils;
    this.Validators = Validators;
}