// client/scenes/RoomSelectScene.js
class RoomSelectScene extends Phaser.Scene {
    constructor() {
        super('RoomSelectScene');
    }

    init(data) {
        // Store initialization data
        this.playerRole = data?.playerRole || 'defender';
        this.gameData = data?.gameData || {};
        
        console.log('🏠 RoomSelectScene initialized with role:', this.playerRole);
    }

    preload() {
        // Assets should already be loaded by BootScene
        console.log('📦 RoomSelectScene preload');
    }

    create() {
        console.log('🏠 Creating RoomSelectScene');
        
        // Initialize managers
        this.networkManager = new NetworkManager(this);
        this.uiManager = new UIManager(this);
        this.roomManager = new RoomManager(this);
        this.playerManager = new PlayerManager(this);
        this.buildMenu = new BuildMenu(this);

        // Initialize ghost manager if available
        if (typeof GhostManager !== 'undefined') {
            this.ghostManager = new GhostManager(this);
            this.ghostManager.createGhostSelectionUI();
        }

        // Initialize game state
        this.roomsCreated = false;
        this.playersCreated = false;

        // Create UI
        this.uiManager.createMoneyDisplay(this.playerManager.getMoney());

        // Setup input controls
        this.setupControls();

        // Setup network events
        this.setupNetworkEvents();

        // Join the game
        this.networkManager.joinGame();

        // Create background
        this.add.rectangle(
            GAME_CONFIG.SCREEN.WIDTH / 2, 
            GAME_CONFIG.SCREEN.HEIGHT / 2, 
            GAME_CONFIG.SCREEN.WIDTH, 
            GAME_CONFIG.SCREEN.HEIGHT, 
            0x0f1419
        );

        // Add title
        this.add.text(20, 20, '🏠 Dorm Selection', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setScrollFactor(0);

        // Add role indicator
        const roleIcon = this.playerRole === 'ghost' ? '👻' : '🏠';
        const roleColor = this.playerRole === 'ghost' ? '#8844ff' : '#4CAF50';
        
        this.add.text(20, 50, `${roleIcon} Role: ${this.playerRole.toUpperCase()}`, {
            fontSize: '18px',
            fill: roleColor
        }).setScrollFactor(0);

        // Add instructions
        const instructions = this.playerRole === 'ghost' ? 
            'Hunt sleeping defenders and steal their money!' :
            'Find a room, sleep in beds to earn money, and build defenses!';
            
        this.add.text(20, 80, instructions, {
            fontSize: '14px',
            fill: '#cccccc',
            wordWrap: { width: 400 }
        }).setScrollFactor(0);
    }

    setupControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        });

        // ESC key to wake up if sleeping
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.escKey.on('down', () => {
            if (this.playerManager.isSleeping(this.networkManager.getSocketId())) {
                this.networkManager.requestWakeUp();
            }
        });
    }

    setupNetworkEvents() {
        // Game state updates
        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.GAME_STATE, (state) => {
            this.handleGameState(state);
        });

        // Player events
        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.PLAYER_JOINED, (playerData) => {
            console.log('👤 Player joined game:', playerData.id);
        });

        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.PLAYER_LEFT, (playerId) => {
            console.log('👋 Player left game:', playerId);
            // Remove player sprite if it exists
            const player = this.playerManager.getPlayer(playerId);
            if (player) {
                player.destroy();
                delete this.playerManager.players[playerId];
            }
        });

        // Room/bed events
        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.BED_OCCUPIED, (data) => {
            console.log('🛏️ Bed occupied:', data);
            this.playerManager.snapPlayerToBed(data.playerId, data.bedX, data.bedY, data.roomId);
        });

        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.PLAYER_WOKE_UP, (data) => {
            console.log('☀️ Player woke up:', data);
            this.playerManager.wakePlayer(data.playerId);
        });

        // Building events
        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.TOWER_PLACED, (data) => {
            console.log('🔫 Tower placed by server:', data);
            // Visual feedback handled by buildMenu
        });

        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.BUILD_FAILED, (data) => {
            console.log('❌ Build failed:', data.reason);
            this.uiManager.showMessage(
                `Build failed: ${data.reason}`, 
                GAME_CONFIG.SCREEN.WIDTH / 2, 
                GAME_CONFIG.SCREEN.HEIGHT / 2
            );
        });
    }

    handleGameState(state) {
        console.log('📦 Received game state:', state);

        // Validate state
        if (!state || !state.rooms || !state.players) {
            console.error('Invalid game state received:', state);
            return;
        }

        try {
            // Create/update rooms
            this.handleRooms(state);
            
            // Create/update players
            this.handlePlayers(state);
            
            // Update ghost manager if available
            if (this.ghostManager && state.ghosts) {
                this.ghostManager.updateGhosts(state.ghosts);
                this.ghostManager.updateGhostSelectionButton(state);
            }
            
        } catch (error) {
            console.error('Error handling game state:', error);
        }
    }

    handleRooms(state) {
        // Create rooms first time
        if (!this.roomsCreated) {
            state.rooms.forEach((room, index) => {
                console.log(`🏠 Creating room ${room.id}`, room);
                this.roomManager.createRoom(room, index, state.rooms.length);
            });
            this.roomsCreated = true;
        }

        // Update bed occupancy for all rooms
        state.rooms.forEach(room => {
            this.roomManager.updateBedOccupancy(room, state);
        });
    }

    handlePlayers(state) {
        // Create/update players
        Object.values(state.players).forEach(playerData => {
            const existingPlayer = this.playerManager.getPlayer(playerData.id);
            
            if (!existingPlayer) {
                // Create new player
                console.log(`👤 Creating player ${playerData.id}`, playerData);
                const player = this.playerManager.createPlayer(playerData);
                
                // Setup physics interactions for main player
                if (playerData.id === this.networkManager.getSocketId()) {
                    this.setupMainPlayerPhysics();
                }
            } else {
                // Update existing player
                this.updateExistingPlayer(playerData, state);
            }
        });

        // Remove players that left
        Object.keys(this.playerManager.players).forEach(playerId => {
            if (!state.players[playerId]) {
                console.log(`👋 Removing player ${playerId}`);
                const player = this.playerManager.getPlayer(playerId);
                if (player) {
                    player.destroy();
                    delete this.playerManager.players[playerId];
                }
            }
        });

        this.playersCreated = true;
    }

    updateExistingPlayer(playerData, state) {
        const isMainPlayer = playerData.id === this.networkManager.getSocketId();
        
        // Handle sleeping state
        if (playerData.isSleeping && playerData.bed) {
            const room = state.rooms.find(r => r.id === playerData.bed.roomId);
            if (room) {
                const bedSprites = this.roomManager.getRoomBeds()[playerData.bed.roomId];
                const bed = bedSprites?.[playerData.bed.bedIndex];
                if (bed) {
                    this.playerManager.makePlayerSleep(playerData.id, bed.x, bed.y);
                }
            }
        } else {
            // Update position for non-main players
            if (!isMainPlayer) {
                this.playerManager.updatePlayerPosition(playerData.id, playerData.x, playerData.y);
            }
            // Wake up if was sleeping
            this.playerManager.wakePlayer(playerData.id);
        }
    }

    setupMainPlayerPhysics() {
        // Setup wall collisions
        this.time.delayedCall(100, () => {
            this.roomManager.setupWallCollisions();
        });

        // Setup bed overlaps
        this.time.delayedCall(200, () => {
            this.roomManager.setupBedOverlaps();
        });
    }

    update() {
        try {
            // Handle player movement input
            this.playerManager.handleMovementInput();
            
            // Interpolate other player movements
            this.playerManager.interpolatePlayerMovement();
            
            // Handle ghost movement if controlling a ghost
            if (this.ghostManager && this.ghostManager.isControllingGhost()) {
                this.ghostManager.handleGhostMovementInput();
            }
            
        } catch (error) {
            console.error('Error in update loop:', error);
        }
    }

    // Clean up when scene is destroyed
    destroy() {
        console.log('🗑️ Destroying RoomSelectScene');
        
        try {
            if (this.networkManager) this.networkManager.destroy();
            if (this.uiManager) this.uiManager.destroy();
            if (this.roomManager) this.roomManager.destroy();
            if (this.playerManager) this.playerManager.destroy();
            if (this.buildMenu) this.buildMenu.destroy();
            if (this.ghostManager) this.ghostManager.destroy();
        } catch (error) {
            console.error('Error destroying scene:', error);
        }
    }
}

window.RoomSelectScene = RoomSelectScene;