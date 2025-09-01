// Load configuration
const GAME_CONFIG = {
    SCREEN: {
        WIDTH: 1280,
        HEIGHT: 720
    },
    
    PHYSICS: {
        DEFAULT: "arcade",
        DEBUG: false
    },
    
    PLAYER: {
        SPEED: 200
    },
    
    ROOM: {
        TILE_SIZE: 60,
        DEFAULT_COLS: 6,
        DEFAULT_ROWS: 4,
        MIN_COLS: 4,
        MAX_COLS: 8,
        MIN_ROWS: 3,
        MAX_ROWS: 6
    },
    
    ECONOMY: {
        STARTING_MONEY: 100,
        SLEEP_EARNINGS: 5,
        SLEEP_INTERVAL: 2000, // milliseconds
        TURRET_COST: 50
    },
    
    COLORS: {
        ROOM_BG: 0x222222,
        ROOM_BORDER: 0xffffff,
        TILE_BG: 0x555555,
        TILE_BORDER: 0x999999,
        WALL: 0xff0000,
        DOOR: 0x8B4513,
        SLEEPING_TINT: 0x3399ff,
        TURRET_TINT: 0x00ff00
    },
    
    ASSETS: {
        PLAYER: 'https://labs.phaser.io/assets/sprites/phaser-dude.png',
        TOWER: 'https://labs.phaser.io/assets/sprites/block.png',
        BED: '../assets/single-bed.png',
        COIN: '../assets/goldCoin5.png',
        TURRET: 'https://labs.phaser.io/assets/sprites/block.png',
        MENU_BG: '../assets/menuFrame.png'
    }
};

const config = {
    type: Phaser.AUTO,
    width: GAME_CONFIG.SCREEN.WIDTH,
    height: GAME_CONFIG.SCREEN.HEIGHT,
    physics: {
        default: GAME_CONFIG.PHYSICS.DEFAULT,
        arcade: { debug: GAME_CONFIG.PHYSICS.DEBUG }
    },
    scene: [RoomSelectScene] // RoomSelectScene will be loaded via script tag
};

new Phaser.Game(config);