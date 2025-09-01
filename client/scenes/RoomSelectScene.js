import { GAME_CONFIG } from '../config/gameConfig.js';
import { NetworkManager } from '../managers/NetworkManager.js';
import { UIManager } from '../managers/UIManager.js';
import { RoomManager } from '../managers/RoomManager.js';
import { PlayerManager } from '../managers/PlayerManager.js';
import { BuildMenu } from '../ui/BuildMenu.js';

class RoomSelectScene extends Phaser.Scene {
    constructor() {
        super('RoomSelectScene');
    }

    preload() {
        // Load all game assets
        this.load.image('player', GAME_CONFIG.ASSETS.PLAYER);
        this.load.image('tower', GAME_CONFIG.ASSETS.TOWER); 
        this.load.image('bed', GAME_CONFIG.ASSETS.BED);     
        this.load.image('coin', GAME_CONFIG.ASSETS.COIN);
        this.load.image('turret', GAME_CONFIG.ASSETS.TURRET);
        this.load.image('menu-bg', GAME_CONFIG.ASSETS.MENU_BG);
    }

    create() {
        // Initialize managers
        this.networkManager = new NetworkManager(this);
        this.uiManager = new UIManager(this);
        this.roomManager = new RoomManager(this);
        this.playerManager = new PlayerManager(this);
        this.buildMenu = new BuildMenu(this);

        // Initialize game state
        this.roomsCreated = false;

        // Create UI
        this.uiManager.createMoneyDisplay(this.playerManager.getMoney());

        // Setup input controls
        this.setupControls();
    }

    setupControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        });
    }

    handleGameState(state) {
        console.log('📦 Received game state:', state);

        // Create rooms first
        state.rooms.forEach((room, index) => {
            if (!this.roomManager.getRoomRects()[room.id]) {
                console.log(`🏠 Creating room ${room.id}`);
                this.roomManager.createRoom(room, index, state.rooms.length);
            }

            // Update bed occupancy visual
            this.roomManager.updateBedOccupancy(room, state);
        });

        this.roomsCreated = true;

        // Create/update players
        Object.values(state.players).forEach(playerData => {
            const existingPlayer = this.playerManager.getPlayer(playerData.id);
            
            if (!existingPlayer) {
                console.log(`👤 Creating player ${playerData.id}`);
                const player = this.playerManager.createPlayer(playerData);
                
                if (playerData.id === this.networkManager.getSocketId()) {
                    // Set up physics interactions for main player
                    this.roomManager.setupWallCollisions();
                    this.roomManager.setupBedOverlaps();
                }
            } else {
                // Update existing player
                if (playerData.isSleeping && playerData.bed) {
                    const room = state.rooms.find(r => r.id === playerData.bed.roomId);
                    if (room) {
                        const bed = this.roomManager.getRoomBeds()[playerData.bed.roomId]?.[playerData.bed.bedIndex];
                        if (bed) {
                            this.playerManager.makePlayerSleep(playerData.id, bed.x, bed.y);
                        }
                    }
                } else {
                    if (playerData.id !== this.networkManager.getSocketId()) {
                        this.playerManager.updatePlayerPosition(playerData.id, playerData.x, playerData.y);
                    }
                    this.playerManager.wakePlayer(playerData.id);
                }
            }
        });
    }

    update() {
        // Handle player movement input
        this.playerManager.handleMovementInput();
        
        // Interpolate other player movements
        this.playerManager.interpolatePlayerMovement();
    }

    // Clean up when scene is destroyed
    destroy() {
        if (this.networkManager) this.networkManager.destroy();
        if (this.uiManager) this.uiManager.destroy();
        if (this.roomManager) this.roomManager.destroy();
        if (this.playerManager) this.playerManager.destroy();
        if (this.buildMenu) this.buildMenu.destroy();
    }
}

window.RoomSelectScene = RoomSelectScene;