// client/scenes/LobbyScene.js - Fixed version
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
    }

    create() {
        console.log('👻 Creating LobbyScene');
        
        // Initialize managers
        this.networkManager = new NetworkManager(this);
        this.uiManager = new UIManager(this);
        
        // Game state
        this.selectedRole = SHARED_CONFIG.ROLES.DEFENDER; // Default role
        this.isReady = false;
        this.playerCount = 0;
        this.maxGhosts = 2;
        this.gameStarted = false;
        this.lobbyData = {};
        
        // Create UI
        this.createBackground();
        this.createTitle();
        this.createRoleSelection();
        this.createReadyButton();
        this.createPlayerList();
        this.createStartButton();
        this.createInstructions();
        
        // Setup networking
        this.setupNetworkEvents();
        
        // Join lobby after a short delay
        this.time.delayedCall(500, () => {
            this.networkManager.joinLobby();
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
            availabilityText = this.add.text(x, y + 85, 'Slots: 2/2', {
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
            card.setFillStyle(config.hoverColor, 1);
            this.showRolePreview(roleType);
        });
        
        card.on('pointerout', () => {
            card.setFillStyle(config.color, 0.9);
        });
        
        card.on('pointerdown', () => {
            this.selectRole(roleType);
        });
        
        // Default selection
        if (roleType === this.selectedRole) {
            this.updateRoleSelection();
        }
    }

    selectRole(roleType) {
        if (this.selectedRole === roleType) return;
        
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

        this.selectedRole = roleType;
        this.updateRoleSelection();
        this.networkManager.sendRoleSelection(roleType);
        
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
        } else {
            ghostCard.card.setAlpha(1);
            ghostCard.card.setFillStyle(ghostCard.config.color, 0.9);
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
            previewText = 'GHOST ABILITIES:\n\n' +
                         '• Speed Burst - Move faster temporarily\n' +
                         '• Phase Through - Pass through walls\n' +
                         '• Summon Minion - Create helper ghost\n' +
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
            this.toggleReady();
        });
        
        this.readyButton.on('pointerover', () => {
            if (this.isReady) {
                this.readyButton.setFillStyle(0xc0392b);
            } else {
                this.readyButton.setFillStyle(0x27ae60);
            }
        });
        
        this.readyButton.on('pointerout', () => {
            this.updateReadyButton();
        });
    }

    toggleReady() {
        this.isReady = !this.isReady;
        this.updateReadyButton();
        this.networkManager.sendReadyStatus(this.isReady);
        
        console.log(`Ready status: ${this.isReady}`);
    }

    updateReadyButton() {
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
        this.ghostSlotsText = this.add.text(250, HEIGHT/2 + 80, 'Ghost Slots: 0/2', {
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

    updatePlayerList(lobbyData) {
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
    }

    createStartButton() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        this.startButton = this.add.rectangle(WIDTH/2, HEIGHT - 80, 250, 50, 0x95a5a6, 0.5)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive();
            
        this.startButtonText = this.add.text(WIDTH/2, HEIGHT - 80, 'WAITING FOR PLAYERS', {
            fontSize: '16px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        this.startButton.on('pointerdown', () => {
            if (this.canStartGame()) {
                this.networkManager.requestGameStart();
            }
        });
        
        this.startButton.on('pointerover', () => {
            if (this.canStartGame()) {
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
        if (this.playerCount < 2) return false;
        return !this.gameStarted;
    }

    updateStartButton() {
        if (!this.lobbyData) return;

        if (this.canStartGame()) {
            this.startButtonText.setText('START GAME');
            this.startButton.setFillStyle(0x27ae60, 1);
            this.startButton.setAlpha(1);
        } else if (this.playerCount < 2) {
            this.startButtonText.setText('NEED MORE PLAYERS (2+)');
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

    setupNetworkEvents() {
        // Connection status
        this.networkManager.socket.on('connect', () => {
            console.log('✅ Connected to lobby');
        });
        
        this.networkManager.socket.on('disconnect', () => {
            console.log('❌ Disconnected from lobby');
            this.showConnectionError();
        });

        // Lobby updates
        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.LOBBY_UPDATE, (data) => {
            console.log('📊 Lobby update:', data);
            this.updatePlayerList(data);
        });
        
        // Role selection confirmed
        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.ROLE_SELECTED, (data) => {
            console.log(`Role selected: ${data.role}`);
        });

        // Role selection failed
        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.ROLE_SELECTION_FAILED, (data) => {
            console.log(`❌ Role selection failed: ${data.reason}`);
            this.uiManager.showMessage(
                data.reason, 
                GAME_CONFIG.SCREEN.WIDTH/2, 
                GAME_CONFIG.SCREEN.HEIGHT/2 - 50
            );
        });

        // Ready status confirmed
        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.READY_STATUS_UPDATED, (data) => {
            console.log(`Ready status updated: ${data.ready}`);
        });
        
        // Game starting
        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.GAME_STARTING, (data) => {
            this.gameStarted = true;
            this.startGameCountdown(data.countdown || 3);
        });
        
        // Game started
        this.networkManager.socket.on(SHARED_CONFIG.EVENTS.GAME_STARTED, (data) => {
            console.log('🎮 Game started! My role:', data.playerRole);
            this.scene.start('RoomSelectScene', { 
                playerRole: data.playerRole,
                gameData: data 
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

    showConnectionError() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        if (this.errorMessage) return;
        
        this.errorMessage = this.add.container(WIDTH/2, HEIGHT/2);
        
        const bg = this.add.rectangle(0, 0, 400, 150, 0x000000, 0.9)
            .setStrokeStyle(2, 0xff0000);
            
        const title = this.add.text(0, -30, 'Connection Lost', {
            fontSize: '18px',
            fill: '#ff0000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const message = this.add.text(0, 10, 'Lost connection to server.\nPlease refresh the page.', {
            fontSize: '14px',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        const retryButton = this.add.rectangle(0, 50, 120, 30, 0x27ae60)
            .setInteractive()
            .on('pointerdown', () => {
                location.reload();
            });
            
        const retryText = this.add.text(0, 50, 'Retry', {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        this.errorMessage.add([bg, title, message, retryButton, retryText]);
    }

    // Clean up when scene is destroyed
    destroy() {
        console.log('🗑️ Destroying LobbyScene');
        
        if (this.networkManager) {
            this.networkManager.destroy();
        }
        if (this.rolePreview) {
            this.rolePreview.destroy();
        }
        if (this.errorMessage) {
            this.errorMessage.destroy();
        }
        
        // Clear player list
        this.playerList.forEach(item => {
            if (item && item.destroy) item.destroy();
        });
        this.playerList = [];
    }
}

window.LobbyScene = LobbyScene;