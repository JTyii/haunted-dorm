// client/scenes/RoomSelectScene.js - Enhanced with proper network handling
class RoomSelectScene extends Phaser.Scene {
    constructor() {
        super('RoomSelectScene');
    }

    init(data) {
        this.playerRole = data?.playerRole || 'defender';
        this.gameData = data?.gameData || {};
        console.log('🏠 RoomSelectScene initialized with role:', this.playerRole);
    }

    preload() {
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

        // Initialize game state tracking
        this.roomsCreated = false;
        this.playersCreated = false;
        this.lastGameStateUpdate = 0;

        // Create UI
        this.uiManager.createMoneyDisplay(this.playerManager.getMoney());
        this.setupControls();
        this.setupNetworkEventHandlers();

        // Create background and UI elements
        this.createBackground();
        this.createUI();

        // Join the game
        this.networkManager.joinGame();
    }

    createBackground() {
        // Create background
        this.add.rectangle(
            GAME_CONFIG.SCREEN.WIDTH / 2, 
            GAME_CONFIG.SCREEN.HEIGHT / 2, 
            GAME_CONFIG.SCREEN.WIDTH, 
            GAME_CONFIG.SCREEN.HEIGHT, 
            0x0f1419
        );
    }

    createUI() {
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

        // Network status indicator
        this.networkStatusText = this.add.text(20, GAME_CONFIG.SCREEN.HEIGHT - 60, 'Connecting...', {
            fontSize: '12px',
            fill: '#ffff00',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 5, y: 5 }
        }).setScrollFactor(0).setDepth(1000);

        // Debug text
        this.debugText = this.add.text(10, 120, 'Debug: Press P for player state, F to fix main player', {
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

    setupNetworkEventHandlers() {
        // Set network event handlers on the scene for the NetworkManager to call
        this.handleGameState = (gameState) => {
            this.processGameState(gameState);
        };

        this.handlePlayerJoined = (data) => {
            console.log('👤 Player joined game:', data.id);
            // Player creation will be handled by next game state update
        };

        this.handlePlayerLeft = (data) => {
            console.log('👋 Player left:', data.playerId);
            
            // Remove player sprite if it exists
            const player = this.playerManager.getPlayer(data.playerId);
            if (player) {
                player.destroy();
                delete this.playerManager.players[data.playerId];
            }
        };

        this.handleBedOccupied = (data) => {
            console.log('🛏️ Bed occupied by server:', data);
            this.playerManager.snapPlayerToBed(data.playerId, data.bedX, data.bedY, data.roomId);
        };

        this.handlePlayerWakeUp = (data) => {
            console.log('☀️ Player woke up by server:', data);
            this.playerManager.wakePlayer(data.playerId);
        };

        this.handleTowerPlaced = (data) => {
            console.log('🔫 Tower placed by server:', data);
            
            // Visual feedback - place tower sprite
            if (this.roomManager) {
                const room = this.roomManager.getRoomRects()[data.tower.roomId];
                if (room) {
                    this.roomManager.placeTurretVisual(
                        data.tower.roomId, 
                        data.tower.col, 
                        data.tower.row, 
                        data.tower.x, 
                        data.tower.y
                    );
                }
            }
        };

        this.handleBuildFailed = (data) => {
            console.log('❌ Build failed by server:', data.reason);
            this.uiManager.showMessage(
                `Build failed: ${data.reason}`, 
                GAME_CONFIG.SCREEN.WIDTH / 2, 
                GAME_CONFIG.SCREEN.HEIGHT / 2
            );
        };

        this.handlePlayerMoneyUpdate = (data) => {
            // Handle money updates from server
            this.playerManager.handleMoneyUpdate(data);
        };
    }

    processGameState(gameState) {
        console.log('📦 Processing game state update');
        
        // Update network status
        this.updateNetworkStatus();
        
        // Validate state
        if (!gameState || !gameState.rooms || !gameState.players) {
            console.error('Invalid game state received:', gameState);
            return;
        }

        try {
            // Create/update rooms (only once, as they're deterministic from server)
            if (!this.roomsCreated) {
                this.handleRooms(gameState);
            }
            
            // Create/update players
            this.handlePlayers(gameState);
            
            // Update room occupancy
            this.updateRoomOccupancy(gameState);
            
            this.lastGameStateUpdate = Date.now();
            
        } catch (error) {
            console.error('Error processing game state:', error);
        }
    }

    handleRooms(gameState) {
        console.log('🏠 Creating rooms from server data');
        
        gameState.rooms.forEach((room, index) => {
            console.log(`🏠 Creating room ${room.id} with server data:`, room);
            this.roomManager.createRoom(room, index, gameState.rooms.length);
        });
        
        this.roomsCreated = true;
        console.log('✅ All rooms created');
        
        // Setup physics after a short delay
        this.time.delayedCall(200, () => {
            this.setupMainPlayerPhysics();
        });
    }

    handlePlayers(gameState) {
        const mySocketId = this.networkManager.getSocketId();
        
        console.log('🔍 Handling players update:', {
            mySocketId: mySocketId,
            playersInState: Object.keys(gameState.players),
            existingPlayers: Object.keys(this.playerManager.players)
        });

        // Create/update players
        Object.values(gameState.players).forEach((playerData) => {
            const existingPlayer = this.playerManager.getPlayer(playerData.id);
            
            if (!existingPlayer) {
                // Create new player
                console.log(`👤 Creating new player ${playerData.id}`);
                this.playerManager.createPlayer(playerData);
            } else {
                // Update existing player (position, state, etc.)
                this.updateExistingPlayer(playerData, gameState);
            }
        });

        // Remove players that left
        Object.keys(this.playerManager.players).forEach(playerId => {
            if (!gameState.players[playerId]) {
                console.log(`👋 Removing disconnected player ${playerId}`);
                const player = this.playerManager.getPlayer(playerId);
                if (player) {
                    player.destroy();
                    delete this.playerManager.players[playerId];
                }
            }
        });

        // Ensure we have a main player
        this.ensureMainPlayer(mySocketId);
        
        this.playersCreated = true;
    }

    updateExistingPlayer(playerData, gameState) {
        const isMainPlayer = playerData.id === this.networkManager.getSocketId();
        
        // Handle sleeping state
        if (playerData.isSleeping && playerData.bed) {
            const room = gameState.rooms.find(r => r.id === playerData.bed.roomId);
            if (room) {
                // Find the bed position from room data
                const bedData = room.occupiedBeds.find(b => b.playerId === playerData.id);
                if (bedData !== undefined) {
                    // Calculate bed position based on room layout
                    const bedX = room.x - (room.width / 2) + (bedData.index * 60) + 30;
                    const bedY = room.y + (room.height / 2) - 30;
                    this.playerManager.makePlayerSleep(playerData.id, bedX, bedY);
                }
            }
        } else {
            // Update position for non-main players only
            if (!isMainPlayer) {
                this.playerManager.updatePlayerPosition(playerData.id, playerData.x, playerData.y);
            }
            // Wake up if was sleeping
            this.playerManager.wakePlayer(playerData.id);
        }
    }

    updateRoomOccupancy(gameState) {
        // Update bed occupancy visual indicators
        gameState.rooms.forEach(room => {
            if (this.roomManager) {
                this.roomManager.updateBedOccupancy(room, gameState);
            }
        });
    }

    ensureMainPlayer(mySocketId) {
        if (!this.playerManager.mainPlayer && mySocketId) {
            const myPlayer = this.playerManager.getPlayer(mySocketId);
            if (myPlayer) {
                console.log('🎮 Setting up main player:', mySocketId);
                this.playerManager.mainPlayer = myPlayer;
                this.playerManager.mainPlayerId = mySocketId;
                this.playerManager.setupMainPlayer();
                
                // Setup physics with delay
                this.time.delayedCall(100, () => {
                    this.setupMainPlayerPhysics();
                });
            }
        }
    }

    setupMainPlayerPhysics() {
        if (!this.playerManager.mainPlayer) {
            console.log('❌ Cannot setup physics - no main player');
            return;
        }

        console.log('🔧 Setting up main player physics...');
        
        // Setup wall collisions
        this.time.delayedCall(50, () => {
            if (this.roomManager) {
                this.roomManager.setupWallCollisions();
            }
        });

        // Setup bed overlaps
        this.time.delayedCall(100, () => {
            if (this.roomManager) {
                this.roomManager.setupBedOverlaps();
            }
        });

        // Enable movement
        this.time.delayedCall(150, () => {
            if (this.playerManager && this.playerManager.mainPlayer) {
                this.playerManager.resetMainPlayerPhysics();
                this.playerManager.enableMovement();
                console.log('✅ Main player physics setup complete');
            }
        });
    }

    updateNetworkStatus() {
        if (!this.networkStatusText) return;
        
        const connectionInfo = this.networkManager.getConnectionInfo();
        const latency = this.networkManager.getLatency();
        
        if (connectionInfo.connected) {
            const statusColor = latency < 100 ? '#00ff00' : latency < 200 ? '#ffff00' : '#ff0000';
            this.networkStatusText.setText(`🌐 Connected | Ping: ${latency}ms | Players: ${Object.keys(this.playerManager.players).length}`);
            this.networkStatusText.setStyle({ fill: statusColor });
        } else {
            this.networkStatusText.setText('❌ Disconnected');
            this.networkStatusText.setStyle({ fill: '#ff0000' });
        }
    }

    update() {
        try {
            // Debug hotkeys
            if (this.input.keyboard.addKey('P').isDown) {
                this.playerManager.debugPlayerState();
            }
            
            // Manual fix - F key to force set main player
            if (this.input.keyboard.addKey('F').isDown) {
                const mySocketId = this.networkManager.getSocketId();
                if (mySocketId && this.playerManager.players[mySocketId]) {
                    console.log('🔧 MANUAL: Forcing main player setup');
                    this.playerManager.mainPlayer = this.playerManager.players[mySocketId];
                    this.playerManager.mainPlayerId = mySocketId;
                    this.playerManager.setupMainPlayer();
                    this.setupMainPlayerPhysics();
                }
            }

            // Handle movement input for main player
            if (this.playerManager && this.playerManager.mainPlayer) {
                this.playerManager.handleMovementInput();
            }
            
            // Interpolate other players' movements
            if (this.playerManager) {
                this.playerManager.interpolatePlayerMovement();
            }
            
            // Update network status periodically
            if (Date.now() - this.lastGameStateUpdate > 2000) {
                this.updateNetworkStatus();
            }
            
        } catch (error) {
            console.error('Error in update loop:', error);
        }
    }

    // Scene lifecycle methods
    shutdown() {
        console.log('🔄 RoomSelectScene shutting down');
        
        // Clean up any scene-specific resources
        if (this.networkStatusText) {
            this.networkStatusText.destroy();
        }
        
        if (this.debugText) {
            this.debugText.destroy();
        }
    }

    destroy() {
        console.log('🗑️ Destroying RoomSelectScene');
        
        try {
            // Clean up managers in reverse order
            if (this.buildMenu) this.buildMenu.destroy();
            if (this.roomManager) this.roomManager.destroy();
            if (this.playerManager) this.playerManager.destroy();
            if (this.uiManager) this.uiManager.destroy();
            if (this.networkManager) this.networkManager.destroy();
            
            // Clear scene references
            this.handleGameState = null;
            this.handlePlayerJoined = null;
            this.handlePlayerLeft = null;
            this.handleBedOccupied = null;
            this.handlePlayerWakeUp = null;
            this.handleTowerPlaced = null;
            this.handleBuildFailed = null;
            this.handlePlayerMoneyUpdate = null;
            
        } catch (error) {
            console.error('Error destroying scene:', error);
        }
    }

    // Debug methods
    enableDebugMode() {
        window.DEBUG_MODE = true;
        console.log('🔍 Debug mode enabled');
        
        // Add debug display
        if (!this.debugDisplay) {
            this.debugDisplay = this.add.text(GAME_CONFIG.SCREEN.WIDTH - 200, 20, '', {
                fontSize: '12px',
                fill: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 5, y: 5 }
            }).setScrollFactor(0).setDepth(1001);
        }
    }

    updateDebugDisplay() {
        if (this.debugDisplay && window.DEBUG_MODE) {
            const connectionInfo = this.networkManager.getConnectionInfo();
            const playerCount = Object.keys(this.playerManager.players).length;
            const mainPlayerPos = this.playerManager.mainPlayer ? 
                `${Math.round(this.playerManager.mainPlayer.x)}, ${Math.round(this.playerManager.mainPlayer.y)}` : 
                'No player';
            
            this.debugDisplay.setText([
                'DEBUG INFO',
                `Connected: ${connectionInfo.connected}`,
                `Latency: ${this.networkManager.getLatency()}ms`,
                `Players: ${playerCount}`,
                `Main Player: ${mainPlayerPos}`,
                `Rooms: ${this.roomsCreated ? 'Created' : 'Pending'}`,
                `Socket: ${connectionInfo.socketId?.substr(0, 8)}...`
            ].join('\n'));
        }
    }
}

window.RoomSelectScene = RoomSelectScene;