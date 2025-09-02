// client/src/managers/NetworkManager.js - Fixed with Better Connection Handling and Error Recovery
class NetworkManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = null;
        this.socketId = null;
        this.connected = false;
        this.connecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = SHARED_CONFIG.NETWORK.RECONNECT_ATTEMPTS || 5;
        this.reconnectDelay = SHARED_CONFIG.NETWORK.RECONNECT_DELAY || 2000;
        this.connectionTimeout = SHARED_CONFIG.NETWORK.TIMEOUT || 10000;
        this.lastPingTime = 0;
        this.connectionTimeoutId = null;
        this.reconnectTimeoutId = null;
        
        // Connection state callbacks
        this.onConnectionCallbacks = [];
        this.onDisconnectionCallbacks = [];
        
        this.init();
    }

    init() {
        try {
            console.log('🔗 Initializing NetworkManager...');
            this.connect();
        } catch (error) {
            console.error('Failed to initialize NetworkManager:', error);
            this.handleConnectionError(error);
        }
    }

    connect() {
        if (this.connecting || this.connected) {
            console.log('Already connecting or connected');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.connecting = true;
            this.clearTimeouts();
            
            try {
                // Determine server URL
                const serverUrl = this.getServerUrl();
                console.log('🔗 Connecting to:', serverUrl);

                // Create socket with enhanced configuration
                this.socket = io(serverUrl, {
                    transports: SHARED_CONFIG.NETWORK.TRANSPORTS || ['websocket', 'polling'],
                    upgrade: true,
                    rememberUpgrade: true,
                    timeout: this.connectionTimeout,
                    forceNew: true,
                    reconnection: false, // We'll handle reconnection manually
                    pingInterval: SHARED_CONFIG.NETWORK.PING_INTERVAL || 25000,
                    pingTimeout: SHARED_CONFIG.NETWORK.PING_TIMEOUT || 5000,
                    maxHttpBufferSize: 1e6, // 1MB buffer
                    withCredentials: false,
                    autoConnect: true
                });

                this.setupEventListeners(resolve, reject);
                
                // Connection timeout
                this.connectionTimeoutId = setTimeout(() => {
                    if (!this.connected) {
                        console.error('❌ Connection timeout');
                        this.connecting = false;
                        reject(new Error('Connection timeout'));
                        this.handleConnectionTimeout();
                    }
                }, this.connectionTimeout);
                
            } catch (error) {
                console.error('Failed to create socket:', error);
                this.connecting = false;
                reject(error);
                this.handleConnectionError(error);
            }
        });
    }

    getServerUrl() {
        // Try to detect the server URL
        if (typeof window !== 'undefined') {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const port = window.location.port || (protocol === 'wss:' ? '443' : '80');
            
            // For development, check if we're on localhost
            if (host === 'localhost' || host === '127.0.0.1') {
                return `http://${host}:3000`; // Default development port
            }
            
            return `${window.location.protocol}//${window.location.host}`;
        }
        
        return 'http://localhost:3000'; // Fallback
    }

    setupEventListeners(resolveConnection = null, rejectConnection = null) {
        if (!this.socket) return;

        // Clear any existing listeners to prevent duplicates
        this.socket.removeAllListeners();

        // Connection events
        this.socket.on(SHARED_CONFIG.EVENTS.CONNECTION, () => {
            this.onConnected();
            if (resolveConnection) resolveConnection();
        });

        this.socket.on(SHARED_CONFIG.EVENTS.DISCONNECTION, (reason) => {
            this.onDisconnected(reason);
        });

        this.socket.on(SHARED_CONFIG.EVENTS.CONNECTION_ERROR, (error) => {
            console.error('Connection error:', error);
            this.connecting = false;
            if (rejectConnection) rejectConnection(error);
            this.onConnectionError(error);
        });

        this.socket.on(SHARED_CONFIG.EVENTS.RECONNECT, (attemptNumber) => {
            console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
            this.onConnected();
        });

        this.socket.on(SHARED_CONFIG.EVENTS.RECONNECT_ERROR, (error) => {
            console.error('❌ Reconnection error:', error);
            this.handleReconnectionError();
        });

        // Ping/Pong for connection monitoring
        this.socket.on('ping', () => {
            this.lastPingTime = Date.now();
        });

        this.socket.on('pong', (latency) => {
            // Connection is healthy
            this.lastPingTime = Date.now();
        });

        // Lobby events
        this.socket.on(SHARED_CONFIG.EVENTS.LOBBY_UPDATE, (data) => {
            console.log('📊 Lobby update received:', data);
            if (this.scene && this.scene.updatePlayerList) {
                this.scene.updatePlayerList(data);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.ROLE_SELECTED, (data) => {
            console.log('✅ Role selection confirmed:', data.role);
            if (this.scene && this.scene.onRoleSelected) {
                this.scene.onRoleSelected(data);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.ROLE_SELECTION_FAILED, (data) => {
            console.log('❌ Role selection failed:', data.reason);
            if (this.scene && this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    data.reason,
                    GAME_CONFIG.SCREEN.WIDTH / 2,
                    GAME_CONFIG.SCREEN.HEIGHT / 2 - 50
                );
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.READY_STATUS_UPDATED, (data) => {
            console.log('✅ Ready status updated:', data.ready);
            if (this.scene && this.scene.onReadyStatusUpdated) {
                this.scene.onReadyStatusUpdated(data);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GAME_STARTING, (data) => {
            console.log('🎮 Game is starting in', data.countdown, 'seconds');
            if (this.scene && this.scene.startGameCountdown) {
                this.scene.startGameCountdown(data.countdown);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GAME_STARTED, (data) => {
            console.log('🎮 Game started! Role:', data.playerRole);
            if (this.scene && this.scene.scene) {
                this.scene.scene.start('RoomSelectScene', { 
                    playerRole: data.playerRole,
                    gameData: data 
                });
            }
        });

        // Game state events
        this.socket.on(SHARED_CONFIG.EVENTS.GAME_STATE, (state) => {
            if (this.scene && this.scene.handleGameState) {
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
            if (this.scene && this.scene.playerManager) {
                this.scene.playerManager.snapPlayerToBed(
                    data.playerId, 
                    data.bedX, 
                    data.bedY, 
                    data.roomId
                );
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.PLAYER_WOKE_UP, (data) => {
            if (this.scene && this.scene.playerManager) {
                this.scene.playerManager.wakePlayer(data.playerId);
            }
        });

        // Tower/building events
        this.socket.on(SHARED_CONFIG.EVENTS.TOWER_PLACED, (data) => {
            console.log('🔫 Tower placed:', data);
            if (this.scene && this.scene.buildMenu && this.scene.buildMenu.handleTowerPlaced) {
                this.scene.buildMenu.handleTowerPlaced(data);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.BUILD_FAILED, (data) => {
            console.log('❌ Build failed:', data.reason);
            if (this.scene && this.scene.uiManager) {
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
            if (this.scene && this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Error: ${error.message || error}`,
                    GAME_CONFIG.SCREEN.WIDTH / 2,
                    100
                );
            }
        });
    }

    setupGhostEvents() {
        if (!this.socket) return;

        // Ghost role management
        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_ROLE_GRANTED, (ghostData) => {
            console.log('👻 Granted ghost role:', ghostData);
            if (this.scene && this.scene.ghostManager) {
                this.scene.ghostManager.becomeGhost(ghostData);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_ROLE_DENIED, (reason) => {
            console.log('❌ Ghost role denied:', reason);
            if (this.scene && this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Cannot become ghost: ${reason}`,
                    GAME_CONFIG.SCREEN.WIDTH / 2,
                    GAME_CONFIG.SCREEN.HEIGHT / 2
                );
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_ROLE_RELEASED, () => {
            console.log('👻 Ghost role released');
            if (this.scene && this.scene.ghostManager) {
                this.scene.ghostManager.stopBeingGhost();
            }
        });

        // Ghost updates
        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_UPDATE, (ghostsData) => {
            if (this.scene && this.scene.ghostManager) {
                this.scene.ghostManager.updateGhosts(ghostsData);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_ABILITY_USED, (data) => {
            if (this.scene && this.scene.ghostManager) {
                this.scene.ghostManager.showAbilityEffect(data.ghostId, data.abilityName);
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_MINION_SPAWNED, (minionData) => {
            console.log('👥 Ghost minion spawned:', minionData);
        });

        // Ghost game events
        this.socket.on(SHARED_CONFIG.EVENTS.PLAYER_ATTACKED_BY_GHOST, (data) => {
            console.log('💀 Player attacked by ghost:', data);
            if (this.scene && this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Ghost attack! -${data.damage}`,
                    data.x,
                    data.y
                );
            }
        });

        this.socket.on(SHARED_CONFIG.EVENTS.GHOST_KILLED, (data) => {
            console.log('💀 Ghost killed:', data);
            if (this.scene && this.scene.uiManager) {
                this.scene.uiManager.showMessage(
                    `Ghost eliminated! +${data.reward}`,
                    data.x,
                    data.y
                );
            }
        });
    }

    // Enhanced connection handling
    onConnected() {
        this.clearTimeouts();
        this.connected = true;
        this.connecting = false;
        this.reconnectAttempts = 0;
        this.socketId = this.socket.id;
        
        console.log('✅ Connected with socket ID:', this.socketId);
        
        // Notify scene of successful connection
        if (this.scene && this.scene.onConnectionEstablished) {
            this.scene.onConnectionEstablished();
        }
        
        // Call any registered connection callbacks
        this.onConnectionCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in connection callback:', error);
            }
        });
    }

    onDisconnected(reason) {
        console.log('❌ Disconnected:', reason);
        
        this.connected = false;
        this.socketId = null;
        
        // Notify scene of disconnection
        if (this.scene && this.scene.updateConnectionStatus) {
            this.scene.updateConnectionStatus('Disconnected', 'failed');
        }
        
        // Call any registered disconnection callbacks
        this.onDisconnectionCallbacks.forEach(callback => {
            try {
                callback(reason);
            } catch (error) {
                console.error('Error in disconnection callback:', error);
            }
        });

        // Handle reconnection unless it was a manual disconnect
        if (reason !== 'io client disconnect') {
            this.handleDisconnection(reason);
        }
    }

    onConnectionError(error) {
        console.error('Connection error:', error);
        this.connecting = false;
        
        if (this.scene && this.scene.updateConnectionStatus) {
            this.scene.updateConnectionStatus('Connection Error', 'failed');
        }
        
        this.handleConnectionError(error);
    }

    // Lobby methods with better error handling
    async joinLobby() {
        if (!this.isConnected()) {
            console.warn('Cannot join lobby - not connected, attempting to connect first...');
            
            try {
                await this.connect();
            } catch (error) {
                console.error('Failed to connect before joining lobby:', error);
                throw error;
            }
        }
        
        return new Promise((resolve, reject) => {
            const playerData = {
                playerName: this.generatePlayerName()
            };
            
            console.log('📤 Joining lobby with data:', playerData);
            
            // Set up one-time listeners for response
            const onLobbyJoined = (data) => {
                console.log('✅ Successfully joined lobby:', data);
                this.socket.off(SHARED_CONFIG.EVENTS.ERROR, onError);
                resolve(data);
            };
            
            const onError = (error) => {
                console.error('❌ Failed to join lobby:', error);
                this.socket.off(SHARED_CONFIG.EVENTS.LOBBY_UPDATE, onLobbyJoined);
                reject(error);
            };
            
            // Listen for successful join (lobby update) or error
            this.socket.once(SHARED_CONFIG.EVENTS.LOBBY_UPDATE, onLobbyJoined);
            this.socket.once(SHARED_CONFIG.EVENTS.ERROR, onError);
            
            // Send join request
            this.socket.emit(SHARED_CONFIG.EVENTS.JOIN_LOBBY, playerData);
            
            // Timeout the request after 10 seconds
            setTimeout(() => {
                this.socket.off(SHARED_CONFIG.EVENTS.LOBBY_UPDATE, onLobbyJoined);
                this.socket.off(SHARED_CONFIG.EVENTS.ERROR, onError);
                reject(new Error('Lobby join timeout'));
            }, 10000);
        });
    }

    sendRoleSelection(role) {
        if (!this.isConnected()) {
            console.warn('Cannot send role selection - not connected');
            return false;
        }
        
        if (!Validators.isValidRole(role)) {
            console.error('Invalid role:', role);
            return false;
        }
        
        this.socket.emit(SHARED_CONFIG.EVENTS.SELECT_ROLE, { role });
        console.log('📤 Sent role selection:', role);
        return true;
    }

    sendReadyStatus(ready) {
        if (!this.isConnected()) {
            console.warn('Cannot send ready status - not connected');
            return false;
        }
        
        this.socket.emit(SHARED_CONFIG.EVENTS.SET_READY, { ready });
        console.log('📤 Sent ready status:', ready);
        return true;
    }

    requestGameStart() {
        if (!this.isConnected()) {
            console.warn('Cannot request game start - not connected');
            return false;
        }
        
        this.socket.emit(SHARED_CONFIG.EVENTS.REQUEST_GAME_START);
        console.log('📤 Requested game start');
        return true;
    }

    // Game methods
    joinGame() {
        if (!this.isConnected()) {
            console.warn('Cannot join game - not connected');
            return false;
        }
        
        this.socket.emit(SHARED_CONFIG.EVENTS.JOIN_GAME);
        return true;
    }

    sendPlayerMove(x, y) {
        if (!this.isConnected()) return false;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.PLAYER_MOVE, { x, y });
        return true;
    }

    sendEnterRoom(roomId, bedIndex, bedX, bedY) {
        if (!this.isConnected()) return false;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.ENTER_ROOM, {
            roomId,
            bedIndex,
            bedX,
            bedY
        });
        return true;
    }

    requestBedSleep(bedId, roomId, bedIndex) {
        if (!this.isConnected()) return false;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.REQUEST_BED_SLEEP, {
            bedId,
            roomId,
            bedIndex
        });
        return true;
    }

    requestWakeUp() {
        if (!this.isConnected()) return false;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.REQUEST_WAKE_UP);
        return true;
    }

    // Building methods
    sendPlaceTower(roomId, col, row, cost, towerType) {
        if (!this.isConnected()) return false;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.BUILD_TOWER, {
            roomId, col, row, cost, towerType
        });
        return true;
    }

    requestTowerUpgrade(towerId) {
        if (!this.isConnected()) return false;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.UPGRADE_TOWER, { towerId });
        return true;
    }

    // Ghost methods
    sendGhostRequest() {
        if (!this.isConnected()) return false;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.REQUEST_GHOST_ROLE);
        return true;
    }

    sendGhostRelease() {
        if (!this.isConnected()) return false;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.RELEASE_GHOST_ROLE);
        return true;
    }

    sendGhostInput(inputData) {
        if (!this.isConnected()) return false;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.GHOST_INPUT, inputData);
        return true;
    }

    // Enhanced connection management
    handleDisconnection(reason) {
        console.log('Handling disconnection:', reason);
        
        if (reason === 'io server disconnect') {
            console.log('Server disconnected client');
            this.showPermanentError('Server closed the connection');
            return;
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
        } else {
            console.error('Max reconnection attempts reached');
            this.showPermanentError('Unable to reconnect to server');
        }
    }

    handleConnectionError(error) {
        console.error('Handling connection error:', error);
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
        } else {
            this.showPermanentError('Connection failed');
        }
    }

    handleConnectionTimeout() {
        console.error('Connection timeout occurred');
        
        if (this.scene && this.scene.onConnectionTimeout) {
            this.scene.onConnectionTimeout();
        } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
        } else {
            this.showPermanentError('Connection timeout');
        }
    }

    attemptReconnect() {
        if (this.connecting) {
            console.log('Already attempting to reconnect');
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

        // Update UI
        if (this.scene && this.scene.updateConnectionStatus) {
            this.scene.updateConnectionStatus(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'reconnecting');
        }

        const delay = this.reconnectDelay * this.reconnectAttempts;
        this.reconnectTimeoutId = setTimeout(() => {
            this.connect().catch(error => {
                console.error('Reconnection failed:', error);
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    this.showPermanentError('Unable to reconnect');
                }
            });
        }, delay);
    }

    handleReconnectionError() {
        console.error('Reconnection error occurred');
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.showPermanentError('Reconnection failed');
        }
    }

    showPermanentError(message = 'Connection lost') {
        console.error('Showing permanent error:', message);
        
        if (this.scene && this.scene.showConnectionError) {
            this.scene.showConnectionError(message);
        }
    }

    // Utility methods
    getSocketId() {
        return this.socketId;
    }

    isConnected() {
        return this.connected && this.socket && this.socket.connected;
    }

    getLatency() {
        return this.socket ? this.socket.ping : -1;
    }

    generatePlayerName() {
        const adjectives = ['Swift', 'Brave', 'Clever', 'Bold', 'Quick', 'Smart', 'Strong'];
        const nouns = ['Player', 'Defender', 'Guardian', 'Hero', 'Warrior', 'Fighter'];
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = Math.floor(Math.random() * 999) + 1;
        
        return `${adjective}${noun}${number}`;
    }

    // Event callback management
    onConnection(callback) {
        this.onConnectionCallbacks.push(callback);
    }

    onDisconnection(callback) {
        this.onDisconnectionCallbacks.push(callback);
    }

    clearTimeouts() {
        if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId);
            this.connectionTimeoutId = null;
        }
        
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }
    }

    // Debug methods
    sendDebugMessage(type, data) {
        if (!this.isConnected() || !window.DEBUG_MODE) return false;
        
        this.socket.emit(SHARED_CONFIG.EVENTS.DEBUG, { 
            type, 
            data, 
            timestamp: Date.now(),
            socketId: this.socketId
        });
        return true;
    }

    getConnectionInfo() {
        return {
            connected: this.connected,
            connecting: this.connecting,
            socketId: this.socketId,
            reconnectAttempts: this.reconnectAttempts,
            latency: this.getLatency(),
            lastPingTime: this.lastPingTime,
            transportType: this.socket ? this.socket.io.engine.transport.name : 'none'
        };
    }

    // Cleanup
    destroy() {
        console.log('🗑️ Destroying NetworkManager...');
        
        this.clearTimeouts();
        
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.connected = false;
        this.connecting = false;
        this.socketId = null;
        this.onConnectionCallbacks = [];
        this.onDisconnectionCallbacks = [];
        
        console.log('✅ NetworkManager destroyed');
    }
}

window.NetworkManager = NetworkManager;

// Updated LobbyScene Integration Methods
// Add these methods to your LobbyScene class for better NetworkManager integration:

/*
// In LobbyScene.js - Update the attemptLobbyConnection method:
async attemptLobbyConnection() {
    if (!this.networkManager) {
        console.error('NetworkManager not initialized');
        this.showConnectionError('Network manager failed to initialize');
        return;
    }

    try {
        this.updateConnectionStatus('Connecting...', 'connecting');
        
        // Use the new async joinLobby method
        await this.networkManager.joinLobby();
        
        console.log('✅ Successfully joined lobby');
        this.updateConnectionStatus('Connected', 'connected');
        this.connectionState = 'connected';
        this.connectionRetries = 0;
        
    } catch (error) {
        console.error('❌ Failed to join lobby:', error);
        this.connectionState = 'failed';
        this.updateConnectionStatus('Connection failed', 'failed');
        
        if (this.connectionRetries < this.maxConnectionRetries) {
            this.connectionRetries++;
            this.showRetryOption();
        } else {
            this.showConnectionError('Unable to connect to server. Please check your internet connection and try again.');
        }
    }
}

// In LobbyScene.js - Update the onConnectionEstablished method:
onConnectionEstablished() {
    console.log('✅ Connection established');
    this.updateConnectionStatus('Connected', 'connected');
    this.connectionState = 'connected';
    this.connectionRetries = 0;
}

// In LobbyScene.js - Add these new event handler methods:
onRoleSelected(data) {
    console.log('Role selection confirmed:', data.role);
    // Update UI to show selection was successful
    if (this.uiManager) {
        this.uiManager.showMessage(
            `Role selected: ${data.role}`,
            GAME_CONFIG.SCREEN.WIDTH / 2,
            GAME_CONFIG.SCREEN.HEIGHT / 2 + 100
        );
    }
}

onReadyStatusUpdated(data) {
    console.log('Ready status confirmed:', data.ready);
    // Update UI to show ready status was updated
}
*/