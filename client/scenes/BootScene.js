// client/scenes/BootScene.js
class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Create loading bar
        this.createLoadingBar();
        
        // Load essential assets
        this.load.image('player', GAME_CONFIG.ASSETS.PLAYER);
        this.load.image('tower', GAME_CONFIG.ASSETS.TOWER);
        this.load.image('bed', GAME_CONFIG.ASSETS.BED);
        this.load.image('coin', GAME_CONFIG.ASSETS.COIN);
        this.load.image('turret', GAME_CONFIG.ASSETS.TURRET);
        this.load.image('menu-bg', GAME_CONFIG.ASSETS.MENU_BG);
        
        // Ghost assets
        this.load.image('ghost', 'https://labs.phaser.io/assets/sprites/enemy-bullet.png');
        
        // Button assets
        this.load.image('button-bg', 'https://labs.phaser.io/assets/ui/flixel-button.png');
        
        // Setup loading events
        this.load.on('progress', (progress) => {
            this.updateLoadingBar(progress);
        });
        
        this.load.on('complete', () => {
            console.log('✅ Assets loaded successfully');
        });
    }

    create() {
        console.log('🚀 BootScene started');
        
        // Add title
        this.add.text(GAME_CONFIG.SCREEN.WIDTH / 2, GAME_CONFIG.SCREEN.HEIGHT / 2 - 100, 
            '👻 HAUNTED DORM', {
            fontSize: '48px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Add loading complete message
        this.add.text(GAME_CONFIG.SCREEN.WIDTH / 2, GAME_CONFIG.SCREEN.HEIGHT / 2 + 50, 
            'Loading Complete! Starting game...', {
            fontSize: '18px',
            fill: '#00ff00'
        }).setOrigin(0.5);
        
        // Wait a moment then transition to lobby
        this.time.delayedCall(1500, () => {
            console.log('🎮 Starting LobbyScene');
            this.scene.start('LobbyScene');
        });
    }

    createLoadingBar() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        // Background
        this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x1a1a2e);
        
        // Loading bar background
        this.loadingBarBg = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 400, 20, 0x333333)
            .setStrokeStyle(2, 0x666666);
        
        // Loading bar fill
        this.loadingBar = this.add.rectangle(WIDTH / 2 - 200, HEIGHT / 2, 0, 16, 0x00ff88);
        
        // Loading text
        this.loadingText = this.add.text(WIDTH / 2, HEIGHT / 2 + 40, 'Loading... 0%', {
            fontSize: '16px',
            fill: '#ffffff'
        }).setOrigin(0.5);
    }

    updateLoadingBar(progress) {
        const barWidth = 400 * progress;
        this.loadingBar.setSize(barWidth, 16);
        this.loadingBar.setX((GAME_CONFIG.SCREEN.WIDTH / 2) - 200 + (barWidth / 2));
        
        this.loadingText.setText(`Loading... ${Math.round(progress * 100)}%`);
    }
}

window.BootScene = BootScene;