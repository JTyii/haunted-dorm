// client/src/managers/PlayerManager.js - COMPLETE FIXED VERSION
class PlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.players = {};
        this.playerTargets = {};
        this.sleeping = {};
        this.zzzTexts = {};
        this.sleepTweens = {};
        this.moneyTimers = {};
        this.playerMoney = GAME_CONFIG.ECONOMY.STARTING_MONEY;
        this.mainPlayer = null;
        this.mainPlayerId = null;
        this.movementEnabled = false; // Start disabled until properly setup
        
        // Movement state tracking
        this.lastMovementSent = 0;
        this.movementThrottle = 50; // Only send every 50ms
        
        // Store socket ID for reliable comparison
        this.mySocketId = null;
        this.updateSocketId();
        
        console.log('🔧 PlayerManager initialized');
    }

    updateSocketId() {
        if (this.scene.networkManager && this.scene.networkManager.getSocketId) {
            const newSocketId = this.scene.networkManager.getSocketId();
            if (newSocketId && newSocketId !== this.mySocketId) {
                this.mySocketId = newSocketId;
                console.log('🆔 Socket ID updated:', this.mySocketId);
                
                // If we already have a player for this ID, set it as main player
                if (this.players[this.mySocketId] && !this.mainPlayer) {
                    this.setMainPlayer(this.mySocketId);
                }
            }
        }
    }

    createPlayer(playerData) {
        console.log('👤 Creating player:', {
            id: playerData.id,
            position: `(${playerData.x}, ${playerData.y})`,
            isMe: playerData.id === this.mySocketId
        });

        // Don't recreate if already exists
        if (this.players[playerData.id]) {
            console.log(`⚠️ Player ${playerData.id} already exists, updating position`);
            this.updatePlayerPosition(playerData.id, playerData.x, playerData.y);
            return this.players[playerData.id];
        }

        // Update socket ID before creating player
        this.updateSocketId();
        
        // Create physics sprite
        const sprite = this.scene.physics.add.sprite(
            playerData.x || 100, 
            playerData.y || 400, 
            'player'
        );
        
        // Configure sprite properties
        sprite.setCollideWorldBounds(true);
        sprite.setDrag(400, 400);
        sprite.setMaxVelocity(GAME_CONFIG.PLAYER.SPEED, GAME_CONFIG.PLAYER.SPEED);
        sprite.setDepth(10); // Ensure players are visible
        
        // Configure physics body
        if (sprite.body) {
            sprite.body.setSize(28, 40);
            sprite.body.setOffset(2, 8);
            sprite.body.immovable = false;
            sprite.body.moves = true;
            sprite.body.enable = true;
            sprite.body.debugShowBody = window.DEBUG_MODE || false;
        }
        
        // Store player reference
        this.players[playerData.id] = sprite;
        sprite.playerId = playerData.id; // Store ID on sprite for reference
        
        // Check if this should be the main player
        const isMainPlayer = playerData.id === this.mySocketId;
        
        console.log('🔍 Player creation check:', {
            playerId: playerData.id,
            mySocketId: this.mySocketId,
            isMainPlayer: isMainPlayer,
            hasMainPlayer: !!this.mainPlayer
        });
        
        if (isMainPlayer) {
            this.setMainPlayer(playerData.id);
        }
        
        return sprite;
    }

    setMainPlayer(playerId) {
        const sprite = this.players[playerId];
        if (!sprite) {
            console.error('❌ Cannot set main player - sprite not found:', playerId);
            return false;
        }

        console.log('🎮 Setting main player:', playerId);
        
        this.mainPlayer = sprite;
        this.mainPlayerId = playerId;
        
        // Setup main player with delay to ensure scene is ready
        this.scene.time.delayedCall(100, () => {
            this.setupMainPlayer();
        });
        
        return true;
    }

    setupMainPlayer() {
        if (!this.mainPlayer || !this.mainPlayer.body) {
            console.error('❌ Cannot setup main player - invalid state');
            return;
        }

        console.log('🔧 Setting up main player physics and camera...');
        
        // Reset physics state
        this.mainPlayer.setVelocity(0, 0);
        this.mainPlayer.body.enable = true;
        this.mainPlayer.body.moves = true;
        this.mainPlayer.body.immovable = false;
        
        // Setup camera following
        const camera = this.scene.cameras.main;
        camera.stopFollow();
        camera.startFollow(this.mainPlayer, true, 0.08, 0.08);
        camera.setDeadzone(80, 80);
        camera.setZoom(1);
        
        // Enable movement after a short delay
        this.scene.time.delayedCall(200, () => {
            this.movementEnabled = true;
            console.log('✅ Main player setup complete - movement enabled');
        });
    }

    updatePlayer(playerData) {
        const existingSprite = this.players[playerData.id];
        if (!existingSprite) return null;

        // Update position
        existingSprite.setPosition(playerData.x, playerData.y);
        return existingSprite;
    }

    getPlayer(playerId) {
        return this.players[playerId];
    }

    getMainPlayer() {
        return this.mainPlayer;
    }

    enableMovement() {
        this.movementEnabled = true;
        console.log('✅ Player movement enabled');
    }

    disableMovement() {
        this.movementEnabled = false;
        if (this.mainPlayer) {
            this.mainPlayer.setVelocity(0, 0);
        }
        console.log('⏸️ Player movement disabled');
    }

    updatePlayerPosition(playerId, x, y) {
        // Don't update main player position from network
        if (playerId === this.mainPlayerId) {
            return;
        }
        
        const sprite = this.players[playerId];
        if (!sprite) return;
        
        // Store target for smooth interpolation
        this.playerTargets[playerId] = { x, y, timestamp: Date.now() };
    }

    interpolatePlayerMovement() {
        const now = Date.now();
        
        Object.keys(this.playerTargets).forEach(playerId => {
            if (playerId === this.mainPlayerId) return;
            
            const target = this.playerTargets[playerId];
            const sprite = this.players[playerId];
            
            if (!sprite || !target) return;
            
            // Skip very old targets
            if (now - target.timestamp > 1000) {
                delete this.playerTargets[playerId];
                return;
            }
            
            // Smooth interpolation
            const lerp = 0.15;
            const dx = target.x - sprite.x;
            const dy = target.y - sprite.y;
            
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                sprite.x += dx * lerp;
                sprite.y += dy * lerp;
            }
        });
    }

    snapPlayerToBed(playerId, bedX, bedY, roomId) {
        console.log(`📨 Snapping player ${playerId} to bed at (${bedX}, ${bedY})`);
        this.makePlayerSleep(playerId, bedX, bedY);

        if (playerId === this.mainPlayerId) {
            this.startEarningMoney(playerId);
        }
    }

    makePlayerSleep(playerId, x, y) {
        const sprite = this.players[playerId];
        if (!sprite) {
            console.log(`❌ Cannot make player ${playerId} sleep - sprite not found`);
            return;
        }

        console.log(`😴 Making player ${playerId} sleep at (${x}, ${y})`);

        sprite.setPosition(x, y);
        sprite.setVelocity(0, 0);
        
        if (sprite.body) {
            sprite.body.immovable = true;
            sprite.body.moves = false;
        }
        
        sprite.setTint(GAME_CONFIG.COLORS.SLEEPING_TINT);
        this.sleeping[playerId] = true;

        // Disable movement for main player if they're sleeping
        if (playerId === this.mainPlayerId) {
            this.movementEnabled = false;
        }

        if (this.sleepTweens[playerId]) {
            this.sleepTweens[playerId].stop();
        }
        
        this.sleepTweens[playerId] = this.scene.tweens.add({
            targets: sprite,
            y: sprite.y - 5,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.createSleepEffects(playerId, sprite);
    }

    createSleepEffects(playerId, sprite) {
        if (!this.zzzTexts[playerId]) {
            this.zzzTexts[playerId] = this.scene.add.text(sprite.x, sprite.y - 30, 'Zzz', { 
                fontSize: '16px', fill: '#00f' 
            }).setOrigin(0.5);
        }
        this.zzzTexts[playerId].setVisible(true);
        this.zzzTexts[playerId].setPosition(sprite.x, sprite.y - 30);

        this.scene.tweens.add({
            targets: this.zzzTexts[playerId],
            y: sprite.y - 50,
            alpha: 0,
            duration: 1500,
            repeat: -1,
            onRepeat: (tween, target) => {
                target.setY(sprite.y - 30);
                target.setAlpha(1);
            }
        });
    }

    wakePlayer(playerId) {
        const sprite = this.players[playerId];
        if (!sprite) return;

        console.log(`☀️ Waking up player ${playerId}`);

        sprite.clearTint();
        if (sprite.body) {
            sprite.body.immovable = false;
            sprite.body.moves = true;
        }

        this.sleeping[playerId] = false;

        // Re-enable movement for main player
        if (playerId === this.mainPlayerId) {
            this.movementEnabled = true;
        }

        if (this.sleepTweens[playerId]) {
            this.sleepTweens[playerId].stop();
            this.sleepTweens[playerId] = null;
        }
        
        if (this.zzzTexts[playerId]) {
            this.zzzTexts[playerId].setVisible(false);
        }

        this.stopEarningMoney(playerId);
    }

    startEarningMoney(playerId) {
        if (this.moneyTimers[playerId]) {
            clearInterval(this.moneyTimers[playerId]);
        }

        console.log(`💰 Player ${playerId} started earning money`);
        
        this.moneyTimers[playerId] = setInterval(() => {
            if (this.sleeping[playerId]) {
                if (playerId === this.mainPlayerId) {
                    this.playerMoney += GAME_CONFIG.ECONOMY.SLEEP_EARNINGS;
                    if (this.scene.uiManager) {
                        this.scene.uiManager.updateMoneyDisplay(this.playerMoney);
                    }
                }
                if (this.scene.uiManager) {
                    this.scene.uiManager.showFloatingCoin(playerId);
                }
            }
        }, GAME_CONFIG.ECONOMY.SLEEP_INTERVAL);
    }

    stopEarningMoney(playerId) {
        if (this.moneyTimers[playerId]) {
            clearInterval(this.moneyTimers[playerId]);
            delete this.moneyTimers[playerId];
        }
    }

    isSleeping(playerId) {
        return this.sleeping[playerId] || false;
    }

    canAfford(cost) {
        return this.playerMoney >= cost;
    }

    spendMoney(amount) {
        this.playerMoney -= amount;
        if (this.scene.uiManager) {
            this.scene.uiManager.updateMoneyDisplay(this.playerMoney);
        }
    }

    getMoney() {
        return this.playerMoney;
    }

    handleMovementInput() {
        // Early returns for invalid state
        if (!this.mainPlayer || !this.mainPlayer.body) {
            this.updateSocketId(); // Try to recover
            return;
        }
        
        if (!this.movementEnabled || this.sleeping[this.mainPlayerId]) {
            this.mainPlayer.setVelocity(0, 0);
            return;
        }

        // Get input
        const cursors = this.scene.cursors;
        const wasd = this.scene.wasd;
        
        if (!cursors || !wasd) {
            console.warn('⚠️ Input not properly initialized');
            return;
        }

        let velocityX = 0;
        let velocityY = 0;
        let isMoving = false;

        // Calculate movement
        if (cursors.left.isDown || wasd.left.isDown) {
            velocityX = -GAME_CONFIG.PLAYER.SPEED;
            isMoving = true;
        } else if (cursors.right.isDown || wasd.right.isDown) {
            velocityX = GAME_CONFIG.PLAYER.SPEED;
            isMoving = true;
        }
        
        if (cursors.up.isDown || wasd.up.isDown) {
            velocityY = -GAME_CONFIG.PLAYER.SPEED;
            isMoving = true;
        } else if (cursors.down.isDown || wasd.down.isDown) {
            velocityY = GAME_CONFIG.PLAYER.SPEED;
            isMoving = true;
        }

        // Apply movement
        this.mainPlayer.setVelocity(velocityX, velocityY);

        // Send to server with throttling
        if (isMoving && this.scene.networkManager) {
            const now = Date.now();
            if (now - this.lastMovementSent > this.movementThrottle) {
                this.scene.networkManager.sendPlayerMove(
                    this.mainPlayer.x,
                    this.mainPlayer.y
                );
                this.lastMovementSent = now;
            }
        }
    }

    // Emergency recovery methods
    forceRecoverMainPlayer() {
        console.log('🚨 EMERGENCY: Attempting to recover main player');
        
        this.updateSocketId();
        
        if (this.mySocketId && this.players[this.mySocketId]) {
            const sprite = this.players[this.mySocketId];
            
            // Reset main player reference
            this.mainPlayer = sprite;
            this.mainPlayerId = this.mySocketId;
            
            // Reset physics
            if (sprite.body) {
                sprite.body.enable = true;
                sprite.body.moves = true;
                sprite.body.immovable = false;
            }
            
            // Re-setup
            this.setupMainPlayer();
            
            console.log('✅ Main player recovery attempted');
            return true;
        }
        
        console.error('❌ Could not recover main player');
        return false;
    }

    // Force reset player physics (useful for debugging)
    resetMainPlayerPhysics() {
        if (!this.mainPlayer) {
            console.log('❌ Cannot reset - no main player found');
            return;
        }

        console.log('🔄 Resetting main player physics');
        
        // Reset physics properties
        this.mainPlayer.setVelocity(0, 0);
        this.mainPlayer.setAcceleration(0, 0);
        this.mainPlayer.setAngularVelocity(0);
        
        if (this.mainPlayer.body) {
            this.mainPlayer.body.reset(this.mainPlayer.x, this.mainPlayer.y);
            this.mainPlayer.body.enable = true;
            this.mainPlayer.body.moves = true;
            this.mainPlayer.body.immovable = false;
        }

        // Re-enable movement
        this.movementEnabled = true;
        
        console.log('✅ Physics reset complete');
    }

    // Debug method to check player state
     debugPlayerState() {
        console.log('🔍 Player Debug State:', {
            mySocketId: this.mySocketId,
            mainPlayerId: this.mainPlayerId,
            mainPlayerExists: !!this.mainPlayer,
            mainPlayerBodyExists: !!(this.mainPlayer && this.mainPlayer.body),
            mainPlayerBodyEnabled: !!(this.mainPlayer && this.mainPlayer.body && this.mainPlayer.body.enable),
            movementEnabled: this.movementEnabled,
            totalPlayers: Object.keys(this.players).length,
            playerIds: Object.keys(this.players),
            sleeping: this.sleeping[this.mainPlayerId] || false,
            position: this.mainPlayer ? `(${Math.round(this.mainPlayer.x)}, ${Math.round(this.mainPlayer.y)})` : 'N/A',
            velocity: this.mainPlayer && this.mainPlayer.body ? 
                `(${Math.round(this.mainPlayer.body.velocity.x)}, ${Math.round(this.mainPlayer.body.velocity.y)})` : 'N/A'
        });
    }

    // Force find and set main player
    forceSetMainPlayer() {
        if (!this.mySocketId) {
            console.log('❌ No socket ID available');
            return false;
        }
        
        const playerSprite = this.players[this.mySocketId];
        if (playerSprite) {
            this.mainPlayer = playerSprite;
            this.mainPlayerId = this.mySocketId;
            this.setupMainPlayer();
            console.log('✅ Forced main player setup complete');
            return true;
        }
        
        console.log('❌ Could not find player sprite for socket ID:', this.mySocketId);
        return false;
    }

     destroy() {
        console.log('🗑️ Destroying PlayerManager');

        // Clean up timers and tweens
        Object.values(this.moneyTimers).forEach(timer => clearInterval(timer));
        Object.values(this.sleepTweens).forEach(tween => tween && tween.stop());
        Object.values(this.zzzTexts).forEach(text => text && text.destroy());

        // Destroy sprites
        Object.values(this.players).forEach(sprite => sprite && sprite.destroy());
        
        // Clear references
        this.players = {};
        this.playerTargets = {};
        this.sleeping = {};
        this.zzzTexts = {};
        this.sleepTweens = {};
        this.moneyTimers = {};
        this.mainPlayer = null;
        this.mainPlayerId = null;
        
        console.log('✅ PlayerManager destroyed');
    }
}