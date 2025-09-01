// Shared constants between client and server
const SHARED_CONFIG = {
    ROOM_GENERATION: {
        MIN_BEDS: 1,
        MAX_BEDS: 2,
        STICK_PROBABILITY: 0.4,
        MIN_SPACING: 20,
        MAX_EXTRA_SPACING: 200
    },
    
    DOORS: {
        SIDES: ["top", "bottom", "left", "right"]
    },
    
    EVENTS: {
        // Player events
        PLAYER_MOVE: 'movePlayer',
        PLAYER_JOIN: 'newPlayer',
        ENTER_ROOM: 'enterRoom',
        SNAP_TO_BED: 'snapToBed',
        
        // Game state
        GAME_STATE: 'gameState',
        ROOM_MESSAGE: 'roomMessage',
        
        // Tower events
        PLACE_TOWER: 'placeTower',
        TOWER_PLACED: 'towerPlaced'
    },
    
    TOWER_TYPES: {
        BASIC: {
            type: 'basic',
            cost: 50,
            damage: 10,
            range: 100,
            fireRate: 1000 // milliseconds
        }
    }
};

// Utility functions that can be used by both client and server
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
        return px >= rx - width/2 && px <= rx + width/2 && 
               py >= ry - height/2 && py <= ry + height/2;
    }
};

// Export for both CommonJS (Node.js) and ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { SHARED_CONFIG, SharedUtils };
} else {
    // Browser environment
    window.SHARED_CONFIG = SHARED_CONFIG;
    window.SharedUtils = SharedUtils;
}