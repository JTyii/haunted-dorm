// client/src/managers/NetworkManager.js
class NetworkManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = null;
        this.socketId = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        // Ghost system extension
        this.ghostExtension = null;
        
        this.init();
    }

    init() {
        try {
            // Connect to server
            this.socket = io('http://localhost:3000', {
                transports: ['websocket'],
                upgrade: true,
                rememberUpgrade: true
            });

            this.setupEventListeners();
            
            // Initialize ghost system if GhostManager exists
            if (typeof GhostNetworkExtension !== 'undefined') {
                this.ghostExtension = new GhostNetworkExtension(this);
            }
            
        } catch (error) {
            console.error('Failed to initialize NetworkManager:', error);
            this.handleConnectionError();
        }
    }

    setupEventListeners() {
        // Connection events
        this.socket.on('connect', () => {
            this.socketId = this.socket.id;
            this.connected = true;
            this.reconnectAttempts = 0;
            console.log('🔗 Connected to server:', this.socketId);
            
            // Send initial join request
            this.joinGame();
        });

        this.socket.on('disconnect', (reason) => {
            this.connected = false;
            console.log('❌ Disconnected from server:', reason);
            this.handleDisconnection(reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.handleConnectionError();
        });

        // Lobby events
        this.socket.on('lobby_joined', (data) => {
            console.log('🏠 Joined lobby:', data);
        });

        this.socket.on('lobby_update', (data) => {
            if (this.scene.updatePlayerList) {
                this.scene.updatePlayerList(data.players, data.ghostCount);
            }
        });

        this.socket.on('role_selected', (data) => {
            console.log('✅ Role selection confirmed:', data.role);
        });

        this.socket.on('game_starting', (data) => {
            console.log('🎮 Game is starting in', data.countdown, 'seconds');
        });

        this.socket.on('game_started', (data) => {
            console.log('🎮 Game started! Role:', data.playerRole);
        });

        // Game state events
        this.socket.on('game_state', (state) => {
            if (this.scene.handleGameState) {
                this.scene.handleGameState(state);
            }
        });

        this.socket.on('player_joined', (playerData) => {
            console.log('👤 Player joined:', playerData.id);
        });

        this.socket.on('player_left', (playerId) => {
            console.log('👋 Player left:', playerId);
        });

        // Bed interaction events
        this.socket.on('bed_occupied', (data) => {
            if (this.scene.playerManager) {
                this.scene.playerManager.snapPlayerToBed(
                    data.playerId, 
                    data.bedX, 
                    data.bedY, 
                    data.roomId
                );
            }
        });

        this.socket.on('player_woke_up', (data) => {
            if (this.scene.playerManager) {
                this.scene.playerManager.wakePlayer(data.playerId);
            }
        });

        // Tower/building events
        this.socket.on('tower_placed', (data) => {
            console.log('🔫 Tower placed:', data);
            if (this.scene.buildMenu && this.scene.buildMenu.handleTowerPlaced) {
                this.scene.buildMenu.handleTowerPlaced(data);
            }
        });

        this.socket.on('build_failed', (data) => {
            console.log('❌ Build failed:', data.reason);
            if (this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Build failed: ${data.reason}`,
                    GAME_CONFIG.SCREEN.WIDTH / 2,
                    GAME_CONFIG.SCREEN.HEIGHT / 2
                );
            }
        });

        // Ghost-specific events (handled by GhostNetworkExtension)
        this.setupGhostEvents();

        // Error handling
        this.socket.on('error', (error) => {
            console.error('Server error:', error);
            if (this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Error: ${error.message}`,
                    GAME_CONFIG.SCREEN.WIDTH / 2,
                    100
                );
            }
        });
    }

    setupGhostEvents() {
        // Ghost role management
        this.socket.on('ghost_role_granted', (ghostData) => {
            console.log('👻 Granted ghost role:', ghostData);
            if (this.scene.ghostManager) {
                this.scene.ghostManager.becomeGhost(ghostData);
            }
        });

        this.socket.on('ghost_role_denied', (reason) => {
            console.log('❌ Ghost role denied:', reason);
            if (this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Cannot become ghost: ${reason}`,
                    GAME_CONFIG.SCREEN.WIDTH / 2,
                    GAME_CONFIG.SCREEN.HEIGHT / 2
                );
            }
        });

        this.socket.on('ghost_role_released', () => {
            console.log('👻 Ghost role released');
            if (this.scene.ghostManager) {
                this.scene.ghostManager.stopBeingGhost();
            }
        });

        // Ghost updates
        this.socket.on('ghost_update', (ghostsData) => {
            if (this.scene.ghostManager) {
                this.scene.ghostManager.updateGhosts(ghostsData);
            }
        });

        this.socket.on('ghost_ability_used', (data) => {
            if (this.scene.ghostManager) {
                this.scene.ghostManager.showAbilityEffect(data.ghostId, data.abilityName);
            }
        });

        this.socket.on('ghost_minion_spawned', (minionData) => {
            console.log('👥 Ghost minion spawned:', minionData);
            // Handle minion spawning
        });

        // Ghost game events
        this.socket.on('player_attacked_by_ghost', (data) => {
            console.log('💀 Player attacked by ghost:', data);
            if (this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Ghost attack! -$${data.damage}`,
                    data.x,
                    data.y
                );
            }
        });

        this.socket.on('ghost_killed', (data) => {
            console.log('💀 Ghost killed:', data);
            if (this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Ghost eliminated! +$${data.reward}`,
                    data.x,
                    data.y
                );
            }
        });
    }

    // Lobby methods
    joinLobby() {
        if (!this.connected) {
            console.warn('Cannot join lobby - not connected');
            return;
        }
        
        this.socket.emit('join_lobby', {
            playerName: 'Player_' + Math.random().toString(36).substr(2, 5)
        });
    }

    sendRoleSelection(role) {
        if (!this.connected) return;
        
        this.socket.emit('select_role', { role });
        console.log('📤 Sent role selection:', role);
    }

    requestGameStart() {
        if (!this.connected) return;
        
        this.socket.emit('request_game_start');
        console.log('📤 Requested game start');
    }

    // Game methods
    joinGame() {
        if (!this.connected) {
            console.warn('Cannot join game - not connected');
            return;
        }
        
        this.socket.emit('join_game');
    }

    sendPlayerMove(x, y) {
        if (!this.connected) return;
        
        this.socket.emit('player_move', { x, y });
    }

    requestBedSleep(bedId, roomId, bedIndex) {
        if (!this.connected) return;
        
        this.socket.emit('request_bed_sleep', {
            bedId,
            roomId,
            bedIndex
        });
    }

    requestWakeUp() {
        if (!this.connected) return;
        
        this.socket.emit('request_wake_up');
    }

    // Building methods
    requestTowerBuild(x, y, towerType) {
        if (!this.connected) return;
        
        this.socket.emit('build_tower', {
            x, y, towerType
        });
    }

    requestTowerUpgrade(towerId) {
        if (!this.connected) return;
        
        this.socket.emit('upgrade_tower', { towerId });
    }

    // Ghost methods (delegated to extension)
    sendGhostRequest() {
        if (this.ghostExtension) {
            this.ghostExtension.sendGhostRequest();
        } else if (this.connected) {
            this.socket.emit('request_ghost_role');
        }
    }

    sendGhostRelease() {
        if (this.ghostExtension) {
            this.ghostExtension.sendGhostRelease();
        } else if (this.connected) {
            this.socket.emit('release_ghost_role');
        }
    }

    sendGhostInput(inputData) {
        if (this.ghostExtension) {
            this.ghostExtension.sendGhostInput(inputData);
        } else if (this.connected) {
            this.socket.emit('ghost_input', inputData);
        }
    }

    // Connection management
    handleDisconnection(reason) {
        console.log('Handling disconnection:', reason);
        
        if (reason === 'io server disconnect') {
            // Server initiated disconnect
            console.log('Server disconnected client');
            return;
        }

        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
        } else {
            console.error('Max reconnection attempts reached');
            this.showPermanentError();
        }
    }

    handleConnectionError() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        this.reconnectAttempts++;
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

        setTimeout(() => {
            if (this.socket) {
                this.socket.connect();
            }
        }, this.reconnectDelay * this.reconnectAttempts);

        // Show reconnection message
        if (this.scene.uiManager) {
            this.scene.uiManager.showMessage(
                `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
                GAME_CONFIG.SCREEN.WIDTH / 2,
                50
            );
        }
    }

    showPermanentError() {
        if (this.scene.showConnectionError) {
            this.scene.showConnectionError();
        }
    }

    // Utility methods
    getSocketId() {
        return this.socketId;
    }

    isConnected() {
        return this.connected;
    }

    getLatency() {
        return this.socket ? this.socket.ping : -1;
    }

    // Debug methods
    sendDebugMessage(type, data) {
        if (!this.connected || !window.DEBUG_MODE) return;
        
        this.socket.emit('debug', { type, data, timestamp: Date.now() });
    }

    // Cleanup
    destroy() {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        
        if (this.ghostExtension) {
            this.ghostExtension = null;
        }
        
        this.connected = false;
        this.socketId = null;
        
        console.log('🗑️ NetworkManager destroyed');
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkManager;
} else {
    window.NetworkManager = NetworkManager;
}