// client/src/managers/GhostManager.js
class GhostManager {
    constructor(scene) {
        this.scene = scene;
        this.ghosts = {};
        this.isGhost = false;
        this.myGhost = null;
        this.ghostUI = null;
        this.ghostAbilityButtons = {};
        this.lastInputSent = 0;
        this.inputThrottle = 50; // ms between input sends
    }

    // Request to become a ghost
    requestGhostRole() {
        if (this.isGhost) {
            console.log('Already a ghost!');
            return;
        }

        this.scene.networkManager.sendGhostRequest();
    }

    // Stop being a ghost
    releaseGhostRole() {
        if (!this.isGhost) {
            console.log('Not a ghost!');
            return;
        }

        this.scene.networkManager.sendGhostRelease();
    }

    // Server confirms we became a ghost
    becomeGhost(ghostData) {
        console.log('👻 You are now a ghost!', ghostData);
        
        this.isGhost = true;
        this.myGhost = ghostData;
        
        // Hide regular player
        if (this.scene.playerManager.getMainPlayer()) {
            this.scene.playerManager.getMainPlayer().setVisible(false);
        }
        
        // Create ghost sprite
        this.createGhostSprite(ghostData);
        
        // Setup ghost UI
        this.createGhostUI();
        
        // Setup ghost controls
        this.setupGhostControls();
        
        // Switch camera to ghost
        this.scene.cameras.main.startFollow(this.ghosts[ghostData.id], true);
    }

    // Server confirms we stopped being a ghost
    stopBeingGhost() {
        console.log('☀️ You are no longer a ghost');
        
        this.isGhost = false;
        
        // Remove ghost sprite
        if (this.myGhost && this.ghosts[this.myGhost.id]) {
            this.ghosts[this.myGhost.id].destroy();
            delete this.ghosts[this.myGhost.id];
        }
        
        this.myGhost = null;
        
        // Show regular player again
        if (this.scene.playerManager.getMainPlayer()) {
            this.scene.playerManager.getMainPlayer().setVisible(true);
            this.scene.cameras.main.startFollow(this.scene.playerManager.getMainPlayer(), true);
        }
        
        // Remove ghost UI
        this.destroyGhostUI();
    }

    // Create visual ghost sprite
    createGhostSprite(ghostData) {
        const sprite = this.scene.add.sprite(ghostData.x, ghostData.y, 'ghost')
            .setScale(0.8)
            .setTint(0x8844ff)
            .setAlpha(0.8);

        // Add physics if it's our ghost
        if (ghostData.playerId === this.scene.networkManager.getSocketId()) {
            this.scene.physics.add.existing(sprite);
            sprite.setCollideWorldBounds(true);
        }

        this.ghosts[ghostData.id] = sprite;
        
        // Add floating effect
        this.scene.tweens.add({
            targets: sprite,
            y: sprite.y - 10,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Add health bar
        this.createGhostHealthBar(ghostData);

        return sprite;
    }

    createGhostHealthBar(ghostData) {
        const sprite = this.ghosts[ghostData.id];
        if (!sprite) return;

        const healthBg = this.scene.add.rectangle(0, -25, 50, 6, 0x000000);
        const healthBar = this.scene.add.rectangle(0, -25, 45, 4, 0xff0000);
        
        sprite.healthBg = healthBg;
        sprite.healthBar = healthBar;
        
        // Update health bar
        this.updateGhostHealthBar(ghostData);
    }

    updateGhostHealthBar(ghostData) {
        const sprite = this.ghosts[ghostData.id];
        if (!sprite || !sprite.healthBar) return;

        const healthPercent = ghostData.health / ghostData.maxHealth;
        sprite.healthBar.setScale(healthPercent, 1);
        
        // Position health bars above ghost
        sprite.healthBg.setPosition(sprite.x, sprite.y - 25);
        sprite.healthBar.setPosition(sprite.x - (45 * (1 - healthPercent)) / 2, sprite.y - 25);
    }

    // Create ghost control UI
    createGhostUI() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        // Create container for ghost UI
        this.ghostUI = this.scene.add.container(0, 0).setScrollFactor(0);
        
        // Background panel
        const panel = this.scene.add.rectangle(WIDTH - 150, HEIGHT - 120, 280, 200, 0x000000, 0.8)
            .setStrokeStyle(2, 0x8844ff);
        
        // Title
        const title = this.scene.add.text(WIDTH - 150, HEIGHT - 200, '👻 GHOST MODE', {
            fontSize: '16px',
            fill: '#8844ff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Energy bar
        const energyBg = this.scene.add.rectangle(WIDTH - 150, HEIGHT - 170, 200, 12, 0x333333);
        this.energyBar = this.scene.add.rectangle(WIDTH - 150, HEIGHT - 170, 196, 8, 0x00ffff);
        
        const energyText = this.scene.add.text(WIDTH - 150, HEIGHT - 155, 'ENERGY', {
            fontSize: '12px',
            fill: '#00ffff'
        }).setOrigin(0.5);

        // Ability buttons
        this.createAbilityButton('speedBurst', WIDTH - 220, HEIGHT - 130, '💨', 'Speed Burst (Q)', 20);
        this.createAbilityButton('phaseThrough', WIDTH - 150, HEIGHT - 130, '👻', 'Phase Through (W)', 30);
        this.createAbilityButton('summonMinion', WIDTH - 80, HEIGHT - 130, '👥', 'Summon Minion (E)', 50);

        // Instructions
        const instructions = this.scene.add.text(WIDTH - 150, HEIGHT - 60, 
            'WASD: Move\nMouse: Target\nQ/W/E: Abilities\nESC: Quit Ghost', {
            fontSize: '10px',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        // Add all to container
        this.ghostUI.add([panel, title, energyBg, this.energyBar, energyText, instructions]);
        
        // Add ability buttons
        Object.values(this.ghostAbilityButtons).forEach(button => {
            this.ghostUI.add([button.bg, button.icon, button.costText]);
        });
    }

    createAbilityButton(abilityName, x, y, icon, tooltip, cost) {
        const bg = this.scene.add.circle(x, y, 20, 0x444444)
            .setStrokeStyle(2, 0x888888)
            .setInteractive();

        const iconText = this.scene.add.text(x, y - 5, icon, {
            fontSize: '16px'
        }).setOrigin(0.5);

        const costText = this.scene.add.text(x, y + 25, cost.toString(), {
            fontSize: '10px',
            fill: '#00ffff'
        }).setOrigin(0.5);

        // Button interactions
        bg.on('pointerdown', () => this.useAbility(abilityName));
        bg.on('pointerover', () => {
            bg.setStrokeStyle(2, 0x00ffff);
            this.showTooltip(tooltip, x, y - 40);
        });
        bg.on('pointerout', () => {
            bg.setStrokeStyle(2, 0x888888);
            this.hideTooltip();
        });

        this.ghostAbilityButtons[abilityName] = {
            bg, icon: iconText, costText, cost
        };
    }

    showTooltip(text, x, y) {
        this.hideTooltip();
        
        this.tooltip = this.scene.add.container(x, y).setScrollFactor(0);
        
        const bg = this.scene.add.rectangle(0, 0, text.length * 6, 20, 0x000000, 0.9)
            .setStrokeStyle(1, 0xffffff);
            
        const textObj = this.scene.add.text(0, 0, text, {
            fontSize: '10px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        this.tooltip.add([bg, textObj]);
        this.ghostUI.add(this.tooltip);
    }

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = null;
        }
    }

    setupGhostControls() {
        // Keyboard controls for abilities
        this.scene.input.keyboard.on('keydown-Q', () => this.useAbility('speedBurst'));
        this.scene.input.keyboard.on('keydown-W', () => this.useAbility('phaseThrough'));
        this.scene.input.keyboard.on('keydown-E', () => this.useAbility('summonMinion'));
        this.scene.input.keyboard.on('keydown-ESC', () => this.releaseGhostRole());

        // Mouse targeting
        this.scene.input.on('pointerdown', (pointer) => {
            if (this.isGhost) {
                const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
                this.sendGhostInput('target', null, null, worldPoint.x, worldPoint.y);
            }
        });
    }

    useAbility(abilityName) {
        if (!this.isGhost || !this.myGhost) return;

        const button = this.ghostAbilityButtons[abilityName];
        if (!button) return;

        // Check if we have enough energy
        if (this.myGhost.energy < button.cost) {
            this.scene.uiManager.showMessage('Not enough energy!', button.bg.x, button.bg.y);
            return;
        }

        // Check cooldown
        if (!this.canUseAbility(abilityName)) {
            this.scene.uiManager.showMessage('Ability on cooldown!', button.bg.x, button.bg.y);
            return;
        }

        this.sendGhostInput('ability', abilityName);
        console.log(`👻 Used ability: ${abilityName}`);
    }

    canUseAbility(abilityName) {
        if (!this.myGhost || !this.myGhost.abilities) return false;
        
        const ability = this.myGhost.abilities[abilityName];
        if (!ability) return false;
        
        const currentTime = Date.now();
        return (currentTime - ability.lastUsed) >= ability.cooldown;
    }

    handleGhostMovementInput() {
        if (!this.isGhost || !this.myGhost) return;

        const myGhostSprite = this.ghosts[this.myGhost.id];
        if (!myGhostSprite) return;

        myGhostSprite.setVelocity(0);
        let moved = false;

        const cursors = this.scene.cursors;
        const wasd = this.scene.wasd;
        const speed = this.myGhost.speed * 3; // Ghost movement speed

        if (cursors.left.isDown || wasd.left.isDown) {
            myGhostSprite.setVelocityX(-speed);
            moved = true;
        } else if (cursors.right.isDown || wasd.right.isDown) {
            myGhostSprite.setVelocityX(speed);
            moved = true;
        }
        
        if (cursors.up.isDown || wasd.up.isDown) {
            myGhostSprite.setVelocityY(-speed);
            moved = true;
        } else if (cursors.down.isDown || wasd.down.isDown) {
            myGhostSprite.setVelocityY(speed);
            moved = true;
        }

        // Throttle network updates
        const currentTime = Date.now();
        if (moved && (currentTime - this.lastInputSent) > this.inputThrottle) {
            this.sendGhostInput('move', null, myGhostSprite.x, myGhostSprite.y);
            this.lastInputSent = currentTime;
        }
    }

    sendGhostInput(action, abilityName = null, x = null, y = null, targetX = null, targetY = null) {
        this.scene.networkManager.sendGhostInput({
            action,
            abilityName,
            x,
            y,
            targetX,
            targetY
        });
    }

    // Handle ghost updates from server
    updateGhosts(ghostsData) {
        // Remove ghosts that no longer exist
        Object.keys(this.ghosts).forEach(ghostId => {
            const ghostExists = ghostsData.find(g => g.id == ghostId);
            if (!ghostExists) {
                this.removeGhost(ghostId);
            }
        });

        // Update or create ghosts
        ghostsData.forEach(ghostData => {
            if (this.ghosts[ghostData.id]) {
                this.updateExistingGhost(ghostData);
            } else {
                this.createGhostSprite(ghostData);
            }
        });
    }

    updateExistingGhost(ghostData) {
        const sprite = this.ghosts[ghostData.id];
        if (!sprite) return;

        // Only update position for non-player ghosts
        if (!ghostData.playerId || ghostData.playerId !== this.scene.networkManager.getSocketId()) {
            sprite.setPosition(ghostData.x, ghostData.y);
        }

        // Update health bar
        this.updateGhostHealthBar(ghostData);

        // Update my ghost data
        if (ghostData.playerId === this.scene.networkManager.getSocketId()) {
            this.myGhost = ghostData;
            this.updateGhostUI();
        }

        // Apply visual effects based on abilities
        if (ghostData.phasing) {
            sprite.setAlpha(0.3);
        } else {
            sprite.setAlpha(0.8);
        }
    }

    removeGhost(ghostId) {
        const sprite = this.ghosts[ghostId];
        if (sprite) {
            if (sprite.healthBg) sprite.healthBg.destroy();
            if (sprite.healthBar) sprite.healthBar.destroy();
            sprite.destroy();
            delete this.ghosts[ghostId];
        }
    }

    updateGhostUI() {
        if (!this.ghostUI || !this.myGhost) return;

        // Update energy bar
        const energyPercent = this.myGhost.energy / this.myGhost.maxEnergy;
        this.energyBar.setScale(energyPercent, 1);

        // Update ability button states
        Object.keys(this.ghostAbilityButtons).forEach(abilityName => {
            const button = this.ghostAbilityButtons[abilityName];
            const canUse = this.canUseAbility(abilityName) && this.myGhost.energy >= button.cost;
            
            if (canUse) {
                button.bg.setFillStyle(0x444444);
                button.icon.setAlpha(1);
            } else {
                button.bg.setFillStyle(0x222222);
                button.icon.setAlpha(0.5);
            }
        });
    }

    destroyGhostUI() {
        if (this.ghostUI) {
            this.ghostUI.destroy();
            this.ghostUI = null;
        }
        this.ghostAbilityButtons = {};
        
        if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = null;
        }
    }

    // Check if player can become a ghost
    canBecomeGhost(gameState) {
        const availableSlots = gameState.availableGhostSlots || 0;
        return availableSlots > 0 && !this.isGhost;
    }

    // Create ghost selection UI
    createGhostSelectionUI() {
        const { WIDTH, HEIGHT } = GAME_CONFIG.SCREEN;
        
        const button = this.scene.add.rectangle(50, HEIGHT - 50, 120, 40, 0x8844ff, 0.8)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive()
            .setScrollFactor(0);

        const buttonText = this.scene.add.text(50, HEIGHT - 50, '👻 Be Ghost', {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);

        button.on('pointerdown', () => {
            this.requestGhostRole();
        });

        button.on('pointerover', () => {
            button.setFillStyle(0xaa55ff);
        });

        button.on('pointerout', () => {
            button.setFillStyle(0x8844ff);
        });

        this.ghostSelectionButton = { button, text: buttonText };
    }

    updateGhostSelectionButton(gameState) {
        if (!this.ghostSelectionButton) return;

        const canBecome = this.canBecomeGhost(gameState);
        
        if (canBecome && !this.isGhost) {
            this.ghostSelectionButton.button.setVisible(true);
            this.ghostSelectionButton.text.setVisible(true);
        } else {
            this.ghostSelectionButton.button.setVisible(false);
            this.ghostSelectionButton.text.setVisible(false);
        }
    }

    // Visual effects for abilities
    showAbilityEffect(ghostId, abilityName) {
        const sprite = this.ghosts[ghostId];
        if (!sprite) return;

        switch (abilityName) {
            case 'speedBurst':
                this.showSpeedBurstEffect(sprite);
                break;
            case 'phaseThrough':
                this.showPhaseEffect(sprite);
                break;
            case 'summonMinion':
                this.showSummonEffect(sprite);
                break;
        }
    }

    showSpeedBurstEffect(sprite) {
        // Speed lines effect
        for (let i = 0; i < 5; i++) {
            const line = this.scene.add.line(
                sprite.x - 30, sprite.y,
                0, 0, 20, 0, 0x00ffff
            ).setLineWidth(2).setAlpha(0.8);

            this.scene.tweens.add({
                targets: line,
                x: sprite.x + 30,
                alpha: 0,
                duration: 500,
                delay: i * 50,
                onComplete: () => line.destroy()
            });
        }
    }

    showPhaseEffect(sprite) {
        // Ghostly phase effect
        this.scene.tweens.add({
            targets: sprite,
            alpha: 0.1,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 300,
            yoyo: true,
            repeat: 3
        });
    }

    showSummonEffect(sprite) {
        // Summoning circle effect
        const circle = this.scene.add.circle(sprite.x, sprite.y, 5, 0x8844ff, 0)
            .setStrokeStyle(3, 0x8844ff);

        this.scene.tweens.add({
            targets: circle,
            radius: 50,
            alpha: 0,
            duration: 1000,
            onComplete: () => circle.destroy()
        });
    }

    // Get all ghost sprites for collision detection, etc.
    getGhostSprites() {
        return Object.values(this.ghosts);
    }

    isControllingGhost() {
        return this.isGhost;
    }

    getMyGhost() {
        return this.myGhost;
    }

    destroy() {
        this.destroyGhostUI();
        
        // Destroy all ghost sprites
        Object.values(this.ghosts).forEach(sprite => {
            if (sprite.healthBg) sprite.healthBg.destroy();
            if (sprite.healthBar) sprite.healthBar.destroy();
            sprite.destroy();
        });
        
        this.ghosts = {};
        this.myGhost = null;
        this.isGhost = false;
        
        // Destroy selection button
        if (this.ghostSelectionButton) {
            this.ghostSelectionButton.button.destroy();
            this.ghostSelectionButton.text.destroy();
            this.ghostSelectionButton = null;
        }
    }
}

// Ghost networking additions for NetworkManager.js
class GhostNetworkExtension {
    constructor(networkManager) {
        this.networkManager = networkManager;
        this.setupGhostEvents();
    }

    setupGhostEvents() {
        const socket = this.networkManager.socket;

        // Ghost role management
        socket.on(SHARED_CONFIG.EVENTS.GHOST_ROLE_GRANTED, (ghostData) => {
            this.networkManager.scene.ghostManager.becomeGhost(ghostData);
        });

        socket.on(SHARED_CONFIG.EVENTS.GHOST_ROLE_DENIED, (reason) => {
            this.networkManager.scene.uiManager.showMessage(
                `Cannot become ghost: ${reason}`, 
                GAME_CONFIG.SCREEN.WIDTH / 2, 
                GAME_CONFIG.SCREEN.HEIGHT / 2
            );
        });

        socket.on(SHARED_CONFIG.EVENTS.GHOST_ROLE_RELEASED, () => {
            this.networkManager.scene.ghostManager.stopBeingGhost();
        });

        // Ghost updates
        socket.on(SHARED_CONFIG.EVENTS.GHOST_UPDATE, (ghostsData) => {
            this.networkManager.scene.ghostManager.updateGhosts(ghostsData);
        });

        socket.on(SHARED_CONFIG.EVENTS.GHOST_ABILITY_USED, ({ ghostId, abilityName }) => {
            this.networkManager.scene.ghostManager.showAbilityEffect(ghostId, abilityName);
        });

        socket.on(SHARED_CONFIG.EVENTS.GHOST_MINION_SPAWNED, (minionData) => {
            this.networkManager.scene.ghostManager.createGhostSprite(minionData);
        });
    }

    // Send ghost-related messages
    sendGhostRequest() {
        this.networkManager.socket.emit(SHARED_CONFIG.EVENTS.REQUEST_GHOST_ROLE);
    }

    sendGhostRelease() {
        this.networkManager.socket.emit(SHARED_CONFIG.EVENTS.RELEASE_GHOST_ROLE);
    }

    sendGhostInput(inputData) {
        this.networkManager.socket.emit(SHARED_CONFIG.EVENTS.GHOST_INPUT, inputData);
    }
}

// Export both classes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GhostManager, GhostNetworkExtension };
} else {
    window.GhostManager = GhostManager;
    window.GhostNetworkExtension = GhostNetworkExtension;
}