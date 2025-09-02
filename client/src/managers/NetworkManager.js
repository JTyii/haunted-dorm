// client/src/managers/NetworkManager.js - Updated with Ready System
class NetworkManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = null;
        this.socketId = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        this.init();
    }

    init() {
        try {
            // Connect to server
            this.socket = io({
                transports: ['websocket', 'polling'],
                upgrade: true,
                rememberUpgrade: true,
                timeout: 10000,
                forceNew: true
            });

            this.setupEventListeners();
            
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
        this.socket.on(SHARED_CONFIG.EVENTS.LOBBY_UPDATE, (data) => {
            if (this.scene.updatePlayerList) {
                this.scene.updatePlayerList(data);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.ROLE_SELECTED, (data) => {
            console.log('✅ Role selection confirmed:', data.role);
        });

        this.socket.on(SHARED_CONFIG.EVENTS.ROLE_SELECTION_FAILED, (data) => {
            console.log('❌ Role selection failed:', data.reason);
        });

        this.socket.on(SHARED_CONFIG.EVENTS.READY_STATUS_UPDATED, (data) => {
            console.log('✅ Ready status updated:', data.ready);
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GAME_STARTING, (data) => {
            console.log('🎮 Game is starting in', data.countdown, 'seconds');
            if (this.scene.startGameCountdown) {
                this.scene.startGameCountdown(data.countdown);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GAME_STARTED, (data) => {
            console.log('🎮 Game started! Role:', data.playerRole);
            if (this.scene.scene) {
                this.scene.scene.start('RoomSelectScene', { 
                    playerRole: data.playerRole,
                    gameData: data 
                });
            }
        });

        // Game state events
        this.socket.on(SHARED_CONFIG.EVENTS.GAME_STATE, (state) => {
            if (this.scene.handleGameState) {
                this.scene.handleGameState(state);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.PLAYER_JOINED, (playerData) => {
            console.log('👤 Player joined:', playerData.id);
        });

        this.socket.on(SHARED_CONFIG.EVENTS.PLAYER_LEFT, (playerId) => {
            console.log('👋 Player left:', playerId);
        });

        // Bed interaction events
        this.socket.on(SHARED_CONFIG.EVENTS.BED_OCCUPIED, (data) => {
            if (this.scene.playerManager) {
                this.scene.playerManager.snapPlayerToBed(
                    data.playerId, 
                    data.bedX, 
                    data.bedY, 
                    data.roomId
                );
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.PLAYER_WOKE_UP, (data) => {
            if (this.scene.playerManager) {
                this.scene.playerManager.wakePlayer(data.playerId);
            }
        });

        // Tower/building events
        this.socket.on(SHARED_CONFIG.EVENTS.TOWER_PLACED, (data) => {
            console.log('🔫 Tower placed:', data);
            if (this.scene.buildMenu && this.scene.buildMenu.handleTowerPlaced) {
                this.scene.buildMenu.handleTowerPlaced(data);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.BUILD_FAILED, (data) => {
            console.log('❌ Build failed:', data.reason);
            if (this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Build failed: ${data.reason}`,
                    GAME_CONFIG.SCREEN.WIDTH / 2,
                    GAME_CONFIG.SCREEN.HEIGHT / 2
                );
            }
        });

        // Ghost events
        this.setupGhostEvents();

        // Error handling
        this.socket.on(SHARED_CONFIG.EVENTS.ERROR, (error) => {
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
        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_ROLE_GRANTED, (ghostData) => {
            console.log('👻 Granted ghost role:', ghostData);
            if (this.scene.ghostManager) {
                this.scene.ghostManager.becomeGhost(ghostData);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_ROLE_DENIED, (reason) => {
            console.log('❌ Ghost role denied:', reason);
            if (this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Cannot become ghost: ${reason}`,
                    GAME_CONFIG.SCREEN.WIDTH / 2,
                    GAME_CONFIG.SCREEN.HEIGHT / 2
                );
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_ROLE_RELEASED, () => {
            console.log('👻 Ghost role released');
            if (this.scene.ghostManager) {
                this.scene.ghostManager.stopBeingGhost();
            }
        });

        // Ghost updates
        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_UPDATE, (ghostsData) => {
            if (this.scene.ghostManager) {
                this.scene.ghostManager.updateGhosts(ghostsData);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_ABILITY_USED, (data) => {
            if (this.scene.ghostManager) {
                this.scene.ghostManager.showAbilityEffect(data.ghostId, data.abilityName);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_MINION_SPAWNED, (minionData) => {
            console.log('👥 Ghost minion spawned:', minionData);
        });

        // Ghost game events
        this.socket.on(SHARED_CONFIG.EVENTS.PLAYER_ATTACKED_BY_GHOST, (data) => {
            console.log('💀 Player attacked by ghost:', data);
            if (this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Ghost attack! -${data.damage}`,
                    data.x,
                    data.y
                );
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_KILLED, (data) => {
            console.log('💀 Ghost killed:', data);
            if (this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Ghost eliminated! +${data.reward}`,
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
        
        this.socket.emit(SHARED_CONFIG.EVENTS.JOIN_LOBBY, {
            playerName: 'Player_' + Math.random().toString(36).substr(2, 5)
        });
    }

    sendRoleSelection(role) {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.SELECT_ROLE, { role });
        console.log('📤 Sent role selection:', role);
    }

    sendReadyStatus(ready) {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.SET_READY, { ready });
        console.log('📤 Sent ready status:', ready);
    }

    requestGameStart() {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.REQUEST_GAME_START);
        console.log('📤 Requested game start');
    }

    // Game methods
    joinGame() {
        if (!this.connected) {
            console.warn('Cannot join game - not connected');
            return;
        }
        
        this.socket.emit(SHARED_CONFIG.EVENTS.JOIN_GAME);
    }

    sendPlayerMove(x, y) {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.PLAYER_MOVE, { x, y });
    }

    sendEnterRoom(roomId, bedIndex, bedX, bedY) {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.ENTER_ROOM, {
            roomId,
            bedIndex,
            bedX,
            bedY
        });
    }

    requestBedSleep(bedId, roomId, bedIndex) {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.REQUEST_BED_SLEEP, {
            bedId,
            roomId,
            bedIndex
        });
    }

    requestWakeUp() {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.REQUEST_WAKE_UP);
    }

    // Building methods
    sendPlaceTower(roomId, col, row, cost, towerType) {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.BUILD_TOWER, {
            roomId, col, row, cost, towerType
        });
    }

    requestTowerUpgrade(towerId) {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.UPGRADE_TOWER, { towerId });
    }

    // Ghost methods
    sendGhostRequest() {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.REQUEST_GHOST_ROLE);
    }

    sendGhostRelease() {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.RELEASE_GHOST_ROLE);
    }

    sendGhostInput(inputData) {
        if (!this.connected) return;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.GHOST_INPUT, inputData);
    }

    // Connection management
    handleDisconnection(reason) {
        console.log('Handling disconnection:', reason);
        
        if (reason === 'io server disconnect') {
            console.log('Server disconnected client');
            return;
        }

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
        
        this.socket.emit(SHARED_CONFIG.EVENTS.DEBUG, { type, data, timestamp: Date.now() });
    }

    // Cleanup
    destroy() {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.connected = false;
        this.socketId = null;
        
        console.log('🗑️ NetworkManager destroyed');
    }
}

window.NetworkManager = NetworkManager;