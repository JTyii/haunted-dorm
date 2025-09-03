// client/scenes/LobbyScene.js - Fixed connection issues and updated to use new constants
class LobbyScene extends Phaser.Scene {
    constructor() {
        super('LobbyScene');
    }

    preload() {
        // Load UI assets - fallback if not already loaded
        this.load.image('menu-bg', GAME_CONFIG.ASSETS.MENU_BG);
        this.load.image('button-bg', 'https://labs.phaser.io/assets/ui/flixel-button.png');
        
        // Load role preview assets
        this.load.image('defender-preview', GAME_CONFIG.ASSETS.PLAYER);
        this.load.image('ghost-preview', 'https://labs.phaser.io/assets/sprites/enemy-bullet.png');

        // Show loading indicator
        this.showLoadingIndicator();
    }

    create() {
        console.log('👻 Creating LobbyScene');
        
        // Initialize connection state
        this.connectionState = 'connecting';
        this.connectionRetries = 0;
        this.maxConnectionRetries = SHARED_CONFIG.NETWORK.RECONNECT_ATTEMPTS || 5;
        
        // Game state
        this.selectedRole = SHARED_CONFIG.ROLES.DEFENDER; // Default role
        this.isReady = false;
        this.playerCount = 0;
        this.maxGhosts = SHARED_CONFIG.LOBBY.MAX_GHOSTS || 2;
        this.gameStarted = false;
        this.lobbyData = {};
        
        // Create UI
        this.createBackground();
        this.createTitle();
        this.createConnectionStatus();
        this.createRoleSelection();
        this.createReadyButton();
        this.createPlayerList();
        this.createStartButton();
        this.createInstructions();
        
        // Initialize managers after UI is created
        this.initializeManagers();
    }

    initializeManagers() {
    try {
        // Initialize UI manager first
        this.uiManager = new UIManager(this);
        
        // Initialize network manager with enhanced error handling
        this.networkManager = new NetworkManager(this);
        
        // Register connection callbacks
        this.networkManager.onConnection(() => {
            console.log('Network connection callback triggered');
            this.onConnectionEstablished();
        });
        
        this.networkManager.onDisconnection((reason) => {
            console.log('Network disconnection callback triggered:', reason);
            this.onConnectionLost(reason);
        });
        
        // Attempt to join lobby after managers are ready
        this.time.delayedCall(1000, () => {
            this.attemptLobbyConnection();
        });
        
    } catch (error) {
        console.error('Failed to initialize managers:', error);
        this.showInitializationError(error);
    }
}

    async attemptLobbyConnection() {
    if (!this.networkManager) {
        console.error('NetworkManager not initialized');
        this.showConnectionError('Network manager failed to initialize');
        return;
    }

    try {
        this.updateConnectionStatus('Connecting to lobby...', 'connecting');
        
        // Use the new async joinLobby method
        const lobbyData = await this.networkManager.joinLobby();
        
        console.log('✅ Successfully joined lobby');
        this.updateConnectionStatus('Connected', 'connected');
        this.connectionState = 'connected';
        this.connectionRetries = 0;
        
        // Update lobby display with initial data
        if (lobbyData) {
            this.updatePlayerList(lobbyData);
        }
        
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

    // 3. Add the onConnectionEstablished method:
onConnectionEstablished() {
    console.log('✅ Connection established');
    this.updateConnectionStatus('Connected', 'connected');
    this.connectionState = 'connected';
    this.connectionRetries = 0;
    
    // Update UI elements for connected state
    this.updateReadyButton();
    this.updateStartButton();
}

// 4. Add the onConnectionLost method:
onConnectionLost(reason) {
    console.log('❌ Connection lost:', reason);
    this.connectionState = 'disconnected';
    this.updateConnectionStatus('Disconnected', 'failed');
    
    // Update UI elements for disconnected state
    this.updateReadyButton();
    this.updateStartButton();
    
    // Clear lobby data
    this.lobbyData = {};
    this.updatePlayerList({ players: {}, playerCount: 0, ghostCount: 0, readyCount: 0 });
}

// 5. Add role selection event handlers:
onRoleSelected(data) {
    console.log('Role selection confirmed:', data.role);
    
    // Update local state to match server
    this.selectedRole = data.role;
    this.updateRoleSelection();
    
    // Show confirmation message
    if (this.uiManager) {
        this.uiManager.showMessage(
            `Role selected: ${data.role === SHARED_CONFIG.ROLES.GHOST ? 'Ghost' : 'Defender'}`,
            GAME_CONFIG.SCREEN.WIDTH / 2,
            GAME_CONFIG.SCREEN.HEIGHT / 2 + 100,
            2000 // Show for 2 seconds
        );
    }
}

onReadyStatusUpdated(data) {
    console.log('Ready status confirmed:', data.ready);
    
    // Update local state to match server
    this.isReady = data.ready;
    this.updateReadyButton();
}

    showLoadingIndicator() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        if (this.loadingIndicator) {
            this.loadingIndicator.destroy();
        }
        
        this.loadingIndicator = this.add.container(WIDTH/2, HEIGHT/2);
        
        const bg = this.add.rectangle(0, 0, 200, 100, 0x000000, 0.8)
            .setStrokeStyle(2, 0x333333);
        
        const text = this.add.text(0, -10, 'Loading Lobby...', {
            fontSize: '16px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        const spinner = this.add.text(0, 20, '⟳', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        this.loadingIndicator.add([bg, text, spinner]);
        
        // Animate spinner
        this.tweens.add({
            targets: spinner,
            rotation: Math.PI * 2,
            duration: 1000,
            repeat: -1,
            ease: 'Linear'
        });
    }

    hideLoadingIndicator() {
        if (this.loadingIndicator) {
            this.loadingIndicator.destroy();
            this.loadingIndicator = null;
        }
    }

    createConnectionStatus() {
        const { WIDTH } = GAME_CONFIG.SCREEN;
        
        this.connectionStatusContainer = this.add.container(WIDTH - 20, 20);
        
        this.connectionStatusBg = this.add.rectangle(0, 0, 150, 30, 0x333333, 0.8)
            .setStrokeStyle(1, 0x666666)
            .setOrigin(1, 0);
        
        this.connectionStatusText = this.add.text(-10, 0, 'Connecting...', {
            fontSize: '12px',
            fill: '#ffffff'
        }).setOrigin(1, 0.5);
        
        this.connectionStatusIndicator = this.add.circle(-130, 0, 5, 0xffaa00)
            .setOrigin(0.5);
        
        this.connectionStatusContainer.add([
            this.connectionStatusBg,
            this.connectionStatusText,
            this.connectionStatusIndicator
        ]);
    }

    updateConnectionStatus(text, status) {
        if (!this.connectionStatusText) return;
        
        this.connectionStatusText.setText(text);
        
        const colors = {
            'connecting': 0xffaa00,
            'connected': 0x00ff00,
            'failed': 0xff0000,
            'reconnecting': 0xff8800
        };
        
        const color = colors[status] || 0x666666;
        this.connectionStatusIndicator.setFillStyle(color);
        
        // Add pulsing effect for connecting states
        if (status === 'connecting' || status === 'reconnecting') {
            this.tweens.add({
                targets: this.connectionStatusIndicator,
                alpha: 0.3,
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        } else {
            this.connectionStatusIndicator.setAlpha(1);
            this.tweens.killTweensOf(this.connectionStatusIndicator);
        }
    }

    showRetryOption() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        if (this.retryDialog) {
            this.retryDialog.destroy();
        }
        
        this.retryDialog = this.add.container(WIDTH/2, HEIGHT/2);
        
        const bg = this.add.rectangle(0, 0, 350, 150, 0x000000, 0.9)
            .setStrokeStyle(2, 0xff8800);
        
        const title = this.add.text(0, -40, 'Connection Failed', {
            fontSize: '18px',
            fill: '#ff8800',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const message = this.add.text(0, -10, `Attempt ${this.connectionRetries}/${this.maxConnectionRetries}`, {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        const retryButton = this.add.rectangle(-60, 40, 100, 30, 0x27ae60)
            .setInteractive()
            .setStrokeStyle(2, 0x2ecc71);
        
        const retryText = this.add.text(-60, 40, 'Retry', {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        const cancelButton = this.add.rectangle(60, 40, 100, 30, 0xe74c3c)
            .setInteractive()
            .setStrokeStyle(2, 0xc0392b);
        
        const cancelText = this.add.text(60, 40, 'Cancel', {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        this.retryDialog.add([bg, title, message, retryButton, retryText, cancelButton, cancelText]);
        
        // Button interactions
        retryButton.on('pointerdown', () => {
            this.retryDialog.destroy();
            this.retryDialog = null;
            this.attemptLobbyConnection();
        });
        
        retryButton.on('pointerover', () => {
            retryButton.setFillStyle(0x2ecc71);
        });
        
        retryButton.on('pointerout', () => {
            retryButton.setFillStyle(0x27ae60);
        });
        
        cancelButton.on('pointerdown', () => {
            this.retryDialog.destroy();
            this.retryDialog = null;
            this.scene.start('MenuScene');
        });
        
        cancelButton.on('pointerover', () => {
            cancelButton.setFillStyle(0xc0392b);
        });
        
        cancelButton.on('pointerout', () => {
            cancelButton.setFillStyle(0xe74c3c);
        });
    }

    createBackground() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        // Background
        this.add.rectangle(WIDTH/2, HEIGHT/2, WIDTH, HEIGHT, 0x1a1a2e);
        
        // Title background
        this.add.rectangle(WIDTH/2, 100, WIDTH-40, 120, 0x16213e, 0.8)
            .setStrokeStyle(3, 0x0f3460);
    }

    createTitle() {
        const { WIDTH } = GAME_CONFIG.SCREEN;
        
        this.add.text(WIDTH/2, 60, '👻 HAUNTED DORM', {
            fontSize: '42px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        this.add.text(WIDTH/2, 100, 'Multiplayer Defense', {
            fontSize: '18px',
            fill: '#a8a8a8'
        }).setOrigin(0.5);
        
        this.add.text(WIDTH/2, 125, 'Choose Your Role & Get Ready', {
            fontSize: '14px',
            fill: '#888888'
        }).setOrigin(0.5);
    }

    createRoleSelection() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        // Role selection container
        const roleY = HEIGHT/2 - 80;
        
        // Defender Role Card
        this.createRoleCard(SHARED_CONFIG.ROLES.DEFENDER, WIDTH/2 - 200, roleY, {
            title: '🏠 DORM DEFENDER',
            description: 'Build defenses\nEarn coins while sleeping\nProtect your room',
            color: 0x2d5a87,
            hoverColor: 0x3d6a97
        });
        
        // Ghost Role Card  
        this.createRoleCard(SHARED_CONFIG.ROLES.GHOST, WIDTH/2 + 200, roleY, {
            title: '👻 GHOST HUNTER',
            description: 'Hunt sleeping players\nUse special abilities\nBreak their defenses',
            color: 0x8b2c7a,
            hoverColor: 0x9b3c8a
        });
    }

    createRoleCard(roleType, x, y, config) {
        // Card background
        const card = this.add.rectangle(x, y, 320, 200, config.color, 0.9)
            .setStrokeStyle(3, 0xffffff, 0.3)
            .setInteractive();
            
        // Role icon/preview
        const previewSprite = roleType === SHARED_CONFIG.ROLES.DEFENDER ? 'defender-preview' : 'ghost-preview';
        const icon = this.add.image(x, y - 40, previewSprite)
            .setScale(roleType === SHARED_CONFIG.ROLES.DEFENDER ? 1 : 0.8);
            
        if (roleType === SHARED_CONFIG.ROLES.GHOST) {
            icon.setTint(0x8844ff);
        }
        
        // Title
        const title = this.add.text(x, y + 20, config.title, {
            fontSize: '16px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Description
        const desc = this.add.text(x, y + 55, config.description, {
            fontSize: '12px',
            fill: '#cccccc',
            align: 'center'
        }).setOrigin(0.5);
        
        // Selection indicator
        const indicator = this.add.circle(x + 140, y - 80, 8, 0x00ff00)
            .setVisible(false);
            
        // Availability indicator for ghost role
        let availabilityText = null;
        if (roleType === SHARED_CONFIG.ROLES.GHOST) {
            availabilityText = this.add.text(x, y + 85, `Slots: 0/${this.maxGhosts}`, {
                fontSize: '11px',
                fill: '#ffaa00'
            }).setOrigin(0.5);
        }
        
        // Store references
        const roleCard = {
            card, icon, title, desc, indicator, availabilityText,
            roleType, x, y, config
        };
        
        if (!this.roleCards) this.roleCards = {};
        this.roleCards[roleType] = roleCard;
        
        // Interactions
        card.on('pointerover', () => {
            if (this.connectionState === 'connected') {
                card.setFillStyle(config.hoverColor, 1);
                this.showRolePreview(roleType);
            }
        });
        
        card.on('pointerout', () => {
            card.setFillStyle(config.color, 0.9);
        });
        
        card.on('pointerdown', () => {
            if (this.connectionState === 'connected') {
                this.selectRole(roleType);
            } else {
                this.showConnectionRequiredMessage();
            }
        });
        
        // Default selection
        if (roleType === this.selectedRole) {
            this.updateRoleSelection();
        }
    }

    showConnectionRequiredMessage() {
        if (this.uiManager) {
            this.uiManager.showMessage(
                'Please wait for connection...', 
                GAME_CONFIG.SCREEN.WIDTH/2, 
                GAME_CONFIG.SCREEN.HEIGHT/2 - 50
            );
        }
    }

    // 6. Update the selectRole method to use new NetworkManager:
selectRole(roleType) {
    if (this.selectedRole === roleType) return;
    
    // Check connection
    if (this.connectionState !== 'connected') {
        this.showConnectionRequiredMessage();
        return;
    }
    
    // Check ghost slot availability
    if (roleType === SHARED_CONFIG.ROLES.GHOST) {
        const currentGhosts = this.lobbyData.ghostCount || 0;
        if (currentGhosts >= this.maxGhosts) {
            this.uiManager.showMessage(
                'Ghost slots are full!', 
                GAME_CONFIG.SCREEN.WIDTH/2, 
                GAME_CONFIG.SCREEN.HEIGHT/2 - 50
            );
            return;
        }
    }

    // Send role selection to server
    const success = this.networkManager.sendRoleSelection(roleType);
    if (!success) {
        console.error('Failed to send role selection');
        this.showConnectionRequiredMessage();
        return;
    }
    
    // Optimistically update UI (server will confirm)
    this.selectedRole = roleType;
    this.updateRoleSelection();
    
    // Automatically unready when changing roles
    if (this.isReady) {
        this.toggleReady();
    }
    
    // Sound effect (if available)
    if (this.sound.sounds.length > 0) {
        this.sound.play('select', { volume: 0.5 });
    }
}

    updateRoleSelection() {
        if (!this.roleCards) return;
        
        Object.values(this.roleCards).forEach(card => {
            card.indicator.setVisible(card.roleType === this.selectedRole);
            
            if (card.roleType === this.selectedRole) {
                card.card.setStrokeStyle(3, 0x00ff00, 1);
            } else {
                card.card.setStrokeStyle(3, 0xffffff, 0.3);
            }
        });
    }

    updateGhostAvailability() {
        const ghostCard = this.roleCards[SHARED_CONFIG.ROLES.GHOST];
        if (!ghostCard || !ghostCard.availabilityText) return;
        
        const ghostCount = this.lobbyData.ghostCount || 0;
        const slotsText = `Slots: ${ghostCount}/${this.maxGhosts}`;
        
        ghostCard.availabilityText.setText(slotsText);
        
        // Update card availability
        if (ghostCount >= this.maxGhosts && this.selectedRole !== SHARED_CONFIG.ROLES.GHOST) {
            ghostCard.card.setAlpha(0.5);
            ghostCard.card.setFillStyle(0x444444, 0.7);
            ghostCard.card.disableInteractive();
        } else {
            ghostCard.card.setAlpha(1);
            ghostCard.card.setFillStyle(ghostCard.config.color, 0.9);
            ghostCard.card.setInteractive();
        }
    }

    showRolePreview(roleType) {
        // Show detailed role information
        if (this.rolePreview) {
            this.rolePreview.destroy();
        }
        
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        let previewText = '';
        if (roleType === SHARED_CONFIG.ROLES.DEFENDER) {
            previewText = 'DEFENDER ABILITIES:\n\n' +
                         '• Build turrets to defend your room\n' +
                         '• Sleep in beds to earn coins\n' +
                         '• Upgrade and repair defenses\n' +
                         '• Coordinate with other defenders\n' +
                         '• Wake up to move and build';
        } else {
            const abilities = SHARED_CONFIG.GHOST.ABILITIES;
            previewText = 'GHOST ABILITIES:\n\n' +
                         `• ${abilities.SPEED_BURST.name} - ${abilities.SPEED_BURST.description}\n` +
                         `• ${abilities.PHASE_THROUGH.name} - ${abilities.PHASE_THROUGH.description}\n` +
                         `• ${abilities.SUMMON_MINION.name} - ${abilities.SUMMON_MINION.description}\n` +
                         '• Hunt sleeping defenders for money\n' +
                         '• Break through defenses';
        }
        
        this.rolePreview = this.add.text(WIDTH/2, HEIGHT - 140, previewText, {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 20, y: 15 },
            align: 'left'
        }).setOrigin(0.5);
    }

    createReadyButton() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        // Ready button
        this.readyButton = this.add.rectangle(WIDTH/2, HEIGHT/2 + 50, 200, 50, 0xe74c3c, 0.8)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive();
            
        this.readyButtonText = this.add.text(WIDTH/2, HEIGHT/2 + 50, 'NOT READY', {
            fontSize: '16px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Ready button interactions
        this.readyButton.on('pointerdown', () => {
            if (this.connectionState === 'connected') {
                this.toggleReady();
            } else {
                this.showConnectionRequiredMessage();
            }
        });
        
        this.readyButton.on('pointerover', () => {
            if (this.connectionState === 'connected') {
                if (this.isReady) {
                    this.readyButton.setFillStyle(0xc0392b);
                } else {
                    this.readyButton.setFillStyle(0x27ae60);
                }
            }
        });
        
        this.readyButton.on('pointerout', () => {
            this.updateReadyButton();
        });
    }

    // 7. Update the toggleReady method:
toggleReady() {
    if (this.connectionState !== 'connected') {
        this.showConnectionRequiredMessage();
        return;
    }
    
    const newReadyState = !this.isReady;
    
    // Send to server
    const success = this.networkManager.sendReadyStatus(newReadyState);
    if (!success) {
        console.error('Failed to send ready status');
        this.showConnectionRequiredMessage();
        return;
    }
    
    // Optimistically update UI (server will confirm)
    this.isReady = newReadyState;
    this.updateReadyButton();
    
    console.log(`Ready status: ${this.isReady}`);
}

    updateReadyButton() {
        if (this.connectionState !== 'connected') {
            this.readyButton.setFillStyle(0x95a5a6, 0.5);
            this.readyButtonText.setText('DISCONNECTED');
            this.readyButtonText.setFill('#888888');
            return;
        }

        if (this.isReady) {
            this.readyButton.setFillStyle(0x27ae60, 1);
            this.readyButtonText.setText('READY ✓');
            this.readyButtonText.setFill('#ffffff');
        } else {
            this.readyButton.setFillStyle(0xe74c3c, 0.8);
            this.readyButtonText.setText('NOT READY');
            this.readyButtonText.setFill('#ffffff');
        }
    }

    createPlayerList() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        // Player list container
        this.playerListContainer = this.add.container(50, HEIGHT/2 + 100);
        
        // Player list title
        this.playerCountText = this.add.text(50, HEIGHT/2 + 80, 'Players: 0', {
            fontSize: '16px',
            fill: '#ffffff',
            fontStyle: 'bold'
        });
        
        // Ghost slots indicator
        this.ghostSlotsText = this.add.text(250, HEIGHT/2 + 80, `Ghost Slots: 0/${this.maxGhosts}`, {
            fontSize: '14px',
            fill: '#8844ff'
        });

        // Ready status indicator
        this.readyStatusText = this.add.text(400, HEIGHT/2 + 80, 'Ready: 0/0', {
            fontSize: '14px',
            fill: '#27ae60'
        });
        
        this.playerList = [];
    }

    // 9. Update the updatePlayerList method with better error handling:
updatePlayerList(lobbyData) {
    if (!lobbyData) {
        console.warn('No lobby data provided to updatePlayerList');
        return;
    }
    
    try {
        this.lobbyData = lobbyData;
        
        // Clear existing list
        this.playerList.forEach(item => {
            if (item && item.destroy) item.destroy();
        });
        this.playerList = [];
        
        // Update counters
        this.playerCount = lobbyData.playerCount || 0;
        const ghostCount = lobbyData.ghostCount || 0;
        const readyCount = lobbyData.readyCount || 0;
        
        this.playerCountText.setText(`Players: ${this.playerCount}`);
        this.ghostSlotsText.setText(`Ghost Slots: ${ghostCount}/${this.maxGhosts}`);
        this.readyStatusText.setText(`Ready: ${readyCount}/${this.playerCount}`);
        
        // Update ghost availability
        this.updateGhostAvailability();
        
        // Create player entries
        const players = lobbyData.players || {};
        let yOffset = 0;
        
        Object.values(players).forEach((player, index) => {
            if (!player) return; // Skip null/undefined players
            
            const playerItem = this.add.container(50, this.playerListContainer.y + 30 + yOffset);
            
            // Player role icon and color
            const roleIcon = player.selectedRole === SHARED_CONFIG.ROLES.GHOST ? '👻' : '🏠';
            const roleColor = player.selectedRole === SHARED_CONFIG.ROLES.GHOST ? '#8844ff' : '#2d5a87';
            const readyIcon = player.ready ? '✓' : '⏳';
            const readyColor = player.ready ? '#27ae60' : '#e74c3c';
            
            // Player entry background
            const bgColor = player.ready ? 0x1e3a1e : 0x3a1e1e;
            const playerBg = this.add.rectangle(100, 0, 200, 20, bgColor, 0.3)
                .setStrokeStyle(1, player.ready ? 0x27ae60 : 0xe74c3c, 0.5);
            
            // Player text
            const playerText = this.add.text(20, 0, `${roleIcon} ${player.name || `Player ${index + 1}`}`, {
                fontSize: '14px',
                fill: roleColor
            }).setOrigin(0, 0.5);
            
            // Ready status
            const readyText = this.add.text(180, 0, readyIcon, {
                fontSize: '14px',
                fill: readyColor
            }).setOrigin(0.5);
            
            playerItem.add([playerBg, playerText, readyText]);
            this.playerList.push(playerItem);
            
            yOffset += 25;
        });

        // Update start button
        this.updateStartButton();
        
        // Hide loading indicator once we receive lobby data
        this.hideLoadingIndicator();
        
    } catch (error) {
        console.error('Error updating player list:', error);
        if (this.uiManager) {
            this.uiManager.showMessage(
                'Error updating player list',
                GAME_CONFIG.SCREEN.WIDTH / 2,
                100
            );
        }
    }
}

    createStartButton() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        this.startButton = this.add.rectangle(WIDTH/2, HEIGHT - 80, 250, 50, 0x95a5a6, 0.5)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive();
            
        this.startButtonText = this.add.text(WIDTH/2, HEIGHT - 80, 'WAITING FOR CONNECTION', {
            fontSize: '16px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        this.startButton.on('pointerdown', () => {
            if (this.connectionState === 'connected' && this.canStartGame()) {
                this.networkManager.requestGameStart();
            } else if (this.connectionState !== 'connected') {
                this.showConnectionRequiredMessage();
            }
        });
        
        this.startButton.on('pointerover', () => {
            if (this.connectionState === 'connected' && this.canStartGame()) {
                this.startButton.setFillStyle(0x2ecc71);
            }
        });
        
        this.startButton.on('pointerout', () => {
            this.updateStartButton();
        });
    }

    canStartGame() {
        if (!this.lobbyData.canStartGame) return false;
        if (!this.lobbyData.allPlayersReady) return false;
        if (this.playerCount < (SHARED_CONFIG.LOBBY.MIN_PLAYERS || 2)) return false;
        return !this.gameStarted;
    }

    updateStartButton() {
        if (!this.lobbyData) {
            this.startButtonText.setText('WAITING FOR CONNECTION');
            this.startButton.setFillStyle(0x95a5a6, 0.5);
            this.startButton.setAlpha(0.7);
            return;
        }

        if (this.connectionState !== 'connected') {
            this.startButtonText.setText('DISCONNECTED');
            this.startButton.setFillStyle(0xff0000, 0.5);
            this.startButton.setAlpha(0.7);
            return;
        }

        const minPlayers = SHARED_CONFIG.LOBBY.MIN_PLAYERS || 2;

        if (this.canStartGame()) {
            this.startButtonText.setText('START GAME');
            this.startButton.setFillStyle(0x27ae60, 1);
            this.startButton.setAlpha(1);
        } else if (this.playerCount < minPlayers) {
            this.startButtonText.setText(`NEED MORE PLAYERS (${minPlayers}+)`);
            this.startButton.setFillStyle(0x95a5a6, 0.5);
            this.startButton.setAlpha(0.7);
        } else if (!this.lobbyData.allPlayersReady) {
            const readyCount = this.lobbyData.readyCount || 0;
            this.startButtonText.setText(`WAITING FOR READY (${readyCount}/${this.playerCount})`);
            this.startButton.setFillStyle(0xf39c12, 0.8);
            this.startButton.setAlpha(0.8);
        } else if (this.gameStarted) {
            this.startButtonText.setText('STARTING...');
            this.startButton.setFillStyle(0x8e44ad);
            this.startButton.setAlpha(0.8);
        } else {
            this.startButtonText.setText('CHECKING REQUIREMENTS...');
            this.startButton.setFillStyle(0x95a5a6, 0.6);
            this.startButton.setAlpha(0.7);
        }
    }

    createInstructions() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        const instructions = 'HOW TO PLAY:\n\n' +
                           '🏠 DEFENDERS: Build defenses, sleep to earn money, survive the ghosts\n' +
                           '👻 GHOSTS: Hunt defenders, use abilities, steal their money\n\n' +
                           '1. Choose your role (Defender or Ghost)\n' +
                           '2. Click READY when you\'re set\n' +
                           '3. Wait for all players to be ready\n' +
                           '4. Game starts automatically!\n\n' +
                           'Note: If no players choose Ghost, AI ghosts will be used.';
        
        this.add.text(WIDTH - 50, HEIGHT/2, instructions, {
            fontSize: '12px',
            fill: '#cccccc',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: { x: 15, y: 15 },
            align: 'left',
            wordWrap: { width: 350 }
        }).setOrigin(1, 0);
    }

    // 8. Update the setupNetworkEvents method to be cleaner:
setupNetworkEvents() {
    if (!this.networkManager || !this.networkManager.socket) {
        console.error('NetworkManager or socket not available');
        return;
    }

    console.log('📡 Setting up network events for lobby');
    
    // Note: Most events are already handled in NetworkManager
    // Only add scene-specific handlers here if needed
    
    // Add any additional custom event handlers here
    this.networkManager.socket.on(SHARED_CONFIG.EVENTS.GAME_STARTED, (data) => {
    console.log("🎮 Game started event received:", data);

    // Switch to RoomSelectScene with role + game data
    this.scene.start("RoomSelectScene", { 
        playerRole: data.playerRole, 
        gameData: data.gameData,
        socketId: this.networkManager.getSocketId()
    });
});

}

    startGameCountdown(seconds) {
        this.startButtonText.setText(`STARTING IN ${seconds}...`);
        
        const countdown = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(countdown);
                this.startButtonText.setText('LOADING GAME...');
            } else {
                this.startButtonText.setText(`STARTING IN ${seconds}...`);
            }
        }, 1000);
    }

    showConnectionError(message = 'Connection lost') {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        if (this.errorMessage) {
            this.errorMessage.destroy();
        }
        
        this.errorMessage = this.add.container(WIDTH/2, HEIGHT/2);
        
        const bg = this.add.rectangle(0, 0, 400, 180, 0x000000, 0.9)
            .setStrokeStyle(2, 0xff0000);
            
        const title = this.add.text(0, -50, 'Connection Problem', {
            fontSize: '18px',
            fill: '#ff0000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const messageText = this.add.text(0, -10, message, {
            fontSize: '14px',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 350 }
        }).setOrigin(0.5);
        
        const retryButton = this.add.rectangle(-80, 40, 120, 30, 0x27ae60)
            .setInteractive()
            .setStrokeStyle(2, 0x2ecc71);
            
        const retryText = this.add.text(-80, 40, 'Retry', {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        const menuButton = this.add.rectangle(80, 40, 120, 30, 0xe74c3c)
            .setInteractive()
            .setStrokeStyle(2, 0xc0392b);
            
        const menuText = this.add.text(80, 40, 'Main Menu', {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        this.errorMessage.add([bg, title, messageText, retryButton, retryText, menuButton, menuText]);
        
        // Button interactions
        retryButton.on('pointerdown', () => {
            this.errorMessage.destroy();
            this.errorMessage = null;
            this.connectionRetries = 0;
            this.attemptLobbyConnection();
        });
        
        retryButton.on('pointerover', () => {
            retryButton.setFillStyle(0x2ecc71);
        });
        
        retryButton.on('pointerout', () => {
            retryButton.setFillStyle(0x27ae60);
        });

        menuButton.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });
        
        menuButton.on('pointerover', () => {
            menuButton.setFillStyle(0xc0392b);
        });
        
        menuButton.on('pointerout', () => {
            menuButton.setFillStyle(0xe74c3c);
        });
    }

    showInitializationError(error) {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        const errorContainer = this.add.container(WIDTH/2, HEIGHT/2);
        
        const bg = this.add.rectangle(0, 0, 400, 150, 0x000000, 0.9)
            .setStrokeStyle(2, 0xff0000);
            
        const title = this.add.text(0, -30, 'Initialization Error', {
            fontSize: '18px',
            fill: '#ff0000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const message = this.add.text(0, 10, `Failed to initialize: ${error.message}`, {
            fontSize: '14px',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 350 }
        }).setOrigin(0.5);
        
        const menuButton = this.add.rectangle(0, 50, 120, 30, 0xe74c3c)
            .setInteractive()
            .on('pointerdown', () => {
                this.scene.start('MenuScene');
            });
            
        const menuText = this.add.text(0, 50, 'Main Menu', {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        errorContainer.add([bg, title, message, menuButton, menuText]);
    }

    // 10. Update the destroy method to properly clean up:
destroy() {
    console.log('🗑️ Destroying LobbyScene');
    
    // Destroy network manager first
    if (this.networkManager) {
        this.networkManager.destroy();
        this.networkManager = null;
    }
    
    // Clean up UI elements
    if (this.rolePreview) {
        this.rolePreview.destroy();
        this.rolePreview = null;
    }
    if (this.errorMessage) {
        this.errorMessage.destroy();
        this.errorMessage = null;
    }
    if (this.retryDialog) {
        this.retryDialog.destroy();
        this.retryDialog = null;
    }
    if (this.loadingIndicator) {
        this.loadingIndicator.destroy();
        this.loadingIndicator = null;
    }
    
    // Clear player list
    if (this.playerList) {
        this.playerList.forEach(item => {
            if (item && item.destroy) item.destroy();
        });
        this.playerList = [];
    }
    
    // Stop any running tweens
    this.tweens.killAll();
    
    // Clear any remaining timeouts
    if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId);
    }
    
    // Call parent destroy
    if (super.destroy) {
        super.destroy();
    }
}

// 11. Add a method to handle network status changes:
handleNetworkStatusChange(status) {
    switch (status) {
        case 'connected':
            this.connectionState = 'connected';
            this.updateConnectionStatus('Connected', 'connected');
            break;
        case 'connecting':
            this.connectionState = 'connecting';
            this.updateConnectionStatus('Connecting...', 'connecting');
            break;
        case 'disconnected':
            this.connectionState = 'failed';
            this.updateConnectionStatus('Disconnected', 'failed');
            break;
        case 'reconnecting':
            this.connectionState = 'connecting';
            this.updateConnectionStatus('Reconnecting...', 'reconnecting');
            break;
    }
    
    // Update UI based on connection state
    this.updateReadyButton();
    this.updateStartButton();
}

// 12. Add better error handling for server messages:
handleServerError(error) {
    console.error('Server error received:', error);
    
    const errorMessage = error.message || error.toString();
    
    if (this.uiManager) {
        this.uiManager.showMessage(
            `Server Error: ${errorMessage}`,
            GAME_CONFIG.SCREEN.WIDTH / 2,
            100,
            5000 // Show for 5 seconds
        );
    }
    
    // Handle specific error types
    if (errorMessage.includes('lobby full')) {
        this.showConnectionError('Lobby is full. Please try again later.');
    } else if (errorMessage.includes('game already started')) {
        this.showConnectionError('Game has already started. Returning to menu.');
        this.time.delayedCall(3000, () => {
            this.scene.start('MenuScene');
        });
    }
}
}

window.LobbyScene = LobbyScene;