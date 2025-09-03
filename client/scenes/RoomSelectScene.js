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

        this.debugText = this.add.text(10, 120, 'Debug: Press P for player state, R to reset main player', {
        fontSize: '12px',
        fill: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 5, y: 5 }
    }).setScrollFactor(0).setDepth(1000);
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
    console.log('🔍 DEBUG: Handling players...', {
        currentSocketId: this.networkManager.getSocketId(),
        playersInState: Object.keys(state.players),
        existingPlayers: Object.keys(this.playerManager.players)
    });

    // Create/update players
    Object.values(state.players).forEach((playerData, index) => {
        console.log('🔍 Processing player:', {
            playerId: playerData.id,
            index: index,
            position: { x: playerData.x, y: playerData.y },
            isMainPlayerBySocketId: playerData.id === this.networkManager.getSocketId()
        });

        const existingPlayer = this.playerManager.getPlayer(playerData.id);
        
        if (!existingPlayer) {
            // Create new player
            console.log(`👤 Creating player ${playerData.id}`, playerData);
            const player = this.playerManager.createPlayer(playerData);
        } else {
            // Update existing player
            this.updateExistingPlayer(playerData, state);
        }
    });

    // FORCE SET MAIN PLAYER if we don't have one
    if (!this.playerManager.mainPlayer) {
        const playerIds = Object.keys(this.playerManager.players);
        if (playerIds.length > 0) {
            const firstPlayerId = playerIds[0];
            console.log('🎮 FORCING main player to be:', firstPlayerId);
            
            // Directly set main player
            this.playerManager.mainPlayer = this.playerManager.players[firstPlayerId];
            this.playerManager.mainPlayerId = firstPlayerId;
            
            // Setup main player
            if (this.playerManager.mainPlayer) {
                this.playerManager.setupMainPlayer();
                this.setupMainPlayerPhysics();
                
                this.time.delayedCall(100, () => {
                    this.playerManager.enableMovement();
                    console.log('✅ Main player movement enabled for:', firstPlayerId);
                });
            }
        }
    }

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

    // Debug: Check final state
    console.log('🔍 Final player state after handlePlayers:', {
        mainPlayer: this.playerManager.mainPlayer ? 'exists' : 'null',
        mainPlayerId: this.playerManager.mainPlayerId,
        totalPlayers: Object.keys(this.playerManager.players).length,
        playerIds: Object.keys(this.playerManager.players)
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
        console.log('🔧 Setting up main player physics...');
        
        // Setup wall collisions with delay to ensure rooms are created
        this.time.delayedCall(150, () => {
            if (this.roomManager) {
                this.roomManager.setupWallCollisions();
            }
        });

        // Setup bed overlaps with delay
        this.time.delayedCall(200, () => {
            if (this.roomManager) {
                this.roomManager.setupBedOverlaps();
            }
        });

        // Enable input handling
        this.time.delayedCall(250, () => {
            if (this.playerManager && this.playerManager.mainPlayer) {
                this.playerManager.resetMainPlayerPhysics();
                console.log('✅ Main player physics setup complete');
            }
        });
    }

    update() {
    try {
        // Debug hotkeys
        if (this.input.keyboard.addKey('P').isDown) {
            this.playerManager.debugPlayerState();
        }
        
        // MANUAL FIX - press F key to force set main player
        if (this.input.keyboard.addKey('F').isDown) {
            const playerIds = Object.keys(this.playerManager.players);
            if (playerIds.length > 0) {
                const firstPlayerId = playerIds[0];
                console.log('🔧 MANUAL: Forcing main player to be:', firstPlayerId);
                
                this.playerManager.mainPlayer = this.playerManager.players[firstPlayerId];
                this.playerManager.mainPlayerId = firstPlayerId;
                this.playerManager.setupMainPlayer();
                this.playerManager.enableMovement();
                
                console.log('✅ Manual main player setup complete');
            }
        }

        // Handle player movement input
        if (this.playerManager) {
            this.playerManager.handleMovementInput();
            
            // Interpolate other player movements
            this.playerManager.interpolatePlayerMovement();
        }
        
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

    enableDebugMode() {
    window.DEBUG_MODE = true;
    console.log('🔍 Debug mode enabled - press P key to check player state');
}
}

window.RoomSelectScene = RoomSelectScene;