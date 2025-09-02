console.log('🎮 Initializing Haunted Dorm Client...');

// Global configuration
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

// Export globally (optional)
window.GAME_CONFIG = GAME_CONFIG;

// Wait for dependencies
document.addEventListener('DOMContentLoaded', function() {
    if (typeof Phaser === 'undefined') {
        console.error('❌ Phaser not loaded!');
        return;
    }
    if (typeof io === 'undefined') {
        console.error('❌ Socket.IO not loaded!');
        return;
    }
    
    console.log('✅ All dependencies loaded');
    initializeGame();
});

function initializeGame() {
    const config = {
        type: Phaser.AUTO,
        width: GAME_CONFIG.SCREEN.WIDTH,
        height: GAME_CONFIG.SCREEN.HEIGHT,
        backgroundColor: '#1a1a2e',
        physics: {
            default: GAME_CONFIG.PHYSICS.DEFAULT,
            arcade: { 
                debug: GAME_CONFIG.PHYSICS.DEBUG,
                gravity: { y: 0 }
            }
        },
        scene: [
            BootScene,
            LobbyScene, 
            RoomSelectScene,
            GameScene
        ],
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            min: { width: 800, height: 450 },
            max: { width: 1920, height: 1080 }
        },
        input: { keyboard: true, mouse: true },
        render: { antialias: true, pixelArt: false }
    };

    console.log('🚀 Starting Phaser game...');
    
    try {
        const game = new Phaser.Game(config);
        window.game = game;
        window.DEBUG_MODE = false;
        
        console.log('✅ Game initialized successfully!');
        
        window.addEventListener('error', (event) => {
            console.error('💥 Global error:', event.error);
        });
        window.addEventListener('unhandledrejection', (event) => {
            console.error('💥 Unhandled promise rejection:', event.reason);
        });
        
    } catch (error) {
        console.error('💥 Failed to initialize game:', error);
        showErrorMessage('Failed to start game. Please refresh the page.');
    }
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 16px;
        text-align: center;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;
    errorDiv.innerHTML = `
        <h3>⚠️ Error</h3>
        <p>${message}</p>
        <button onclick="location.reload()" style="
            background: white; 
            color: #ff4444; 
            border: none; 
            padding: 8px 16px; 
            border-radius: 4px; 
            cursor: pointer;
            margin-top: 10px;
        ">Refresh Page</button>
    `;
    document.body.appendChild(errorDiv);
}
