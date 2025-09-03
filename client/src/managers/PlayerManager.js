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
        this.movementEnabled = true;
        
        // Store socket ID for reliable comparison
        this.mySocketId = null;
        if (this.scene.networkManager && this.scene.networkManager.getSocketId) {
            this.mySocketId = this.scene.networkManager.getSocketId();
        }
        
        console.log('🔧 PlayerManager initialized with socket ID:', this.mySocketId);
    }

    createPlayer(playerData) {
        console.log('🔍 DEBUG: createPlayer called with:', {
            playerId: playerData.id,
            mySocketId: this.mySocketId,
            playerExists: !!this.players[playerData.id]
        });

        if (this.players[playerData.id]) {
            console.log(`⚠️ Player ${playerData.id} already exists, updating instead`);
            return this.updatePlayer(playerData);
        }

        console.log(`👤 Creating player ${playerData.id} at (${playerData.x}, ${playerData.y})`);
        
        // Create physics sprite with proper setup
        const sprite = this.scene.physics.add.sprite(playerData.x, playerData.y, 'player');
        
        // Configure physics body
        sprite.setCollideWorldBounds(true);
        sprite.setDrag(300, 300); // Add drag to prevent sliding
        sprite.setMaxVelocity(GAME_CONFIG.PLAYER.SPEED, GAME_CONFIG.PLAYER.SPEED);
        
        // Ensure body is properly set up
        if (sprite.body) {
            sprite.body.setSize(32, 48); // Set collision box
            sprite.body.immovable = false;
            sprite.body.moves = true;
            sprite.body.enable = true;
        }
        
        // Store player reference
        this.players[playerData.id] = sprite;

        // Update socket ID if needed
        if (!this.mySocketId && this.scene.networkManager && this.scene.networkManager.getSocketId) {
            this.mySocketId = this.scene.networkManager.getSocketId();
        }

        // Check if this is the main player
        const isMainPlayer = playerData.id === this.mySocketId;
        console.log('🔍 Is main player check:', {
            playerId: playerData.id,
            mySocketId: this.mySocketId,
            isMainPlayer: isMainPlayer
        });

        // Set up main player
        if (isMainPlayer) {
            this.mainPlayer = sprite;
            this.mainPlayerId = playerData.id;
            console.log('🎮 Setting up main player with ID:', playerData.id);
            
            // Setup main player immediately
            this.time.delayedCall(50, () => {
                this.setupMainPlayer();
            });
            
            // Additional debug
            console.log('🔍 Main player setup complete:', {
                mainPlayer: !!this.mainPlayer,
                mainPlayerId: this.mainPlayerId,
                spriteExists: !!sprite,
                bodyExists: !!sprite.body
            });
        }

        return sprite;
    }

    setupMainPlayer() {
        if (!this.mainPlayer) {
            console.log('❌ Cannot setup main player - sprite not found');
            return;
        }

        console.log('🔧 Setting up main player...');

        // Enable camera following with smooth lerp
        this.scene.cameras.main.startFollow(this.mainPlayer, true, 0.05, 0.05);
        this.scene.cameras.main.setDeadzone(100, 100);
        
        // Ensure physics body is active and moveable
        if (this.mainPlayer.body) {
            this.mainPlayer.body.enable = true;
            this.mainPlayer.body.moves = true;
            this.mainPlayer.body.immovable = false;
            this.mainPlayer.setActive(true);
            this.mainPlayer.setVisible(true);
        }

        // Reset any previous movement state
        this.mainPlayer.setVelocity(0, 0);
        this.movementEnabled = true;
        
        console.log('✅ Main player physics setup complete');
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
        if (playerId === this.mainPlayerId) return; // Don't update main player from network
        if (!this.players[playerId]) return;
        
        this.playerTargets[playerId] = { x, y };
    }

    interpolatePlayerMovement() {
        Object.keys(this.playerTargets).forEach(playerId => {
            if (playerId === this.mainPlayerId) return; // Skip main player
            
            const target = this.playerTargets[playerId];
            const sprite = this.players[playerId];
            if (!sprite || !target) return;
            
            const lerp = 0.2;
            sprite.x += (target.x - sprite.x) * lerp;
            sprite.y += (target.y - sprite.y) * lerp;
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
        const me = this.mainPlayer;
        if (!me) {
            // Try to find main player if not set
            if (this.mySocketId && this.players[this.mySocketId]) {
                console.log('🔧 Recovering main player reference');
                this.mainPlayer = this.players[this.mySocketId];
                this.mainPlayerId = this.mySocketId;
                this.setupMainPlayer();
                return;
            }
            
            console.log('⚠️ No main player found for movement input');
            return;
        }

        // Check if movement is enabled
        if (!this.movementEnabled) {
            me.setVelocity(0, 0);
            return;
        }

        // Check if player is sleeping
        if (this.sleeping[this.mainPlayerId]) {
            me.setVelocity(0, 0);
            return;
        }

        // Ensure physics body is active
        if (!me.body || !me.body.enable) {
            console.log('⚠️ Player physics body not active');
            if (me.body) {
                me.body.enable = true;
                me.body.moves = true;
            }
            return;
        }

        // Reset velocity
        me.setVelocity(0, 0);
        let moved = false;

        const cursors = this.scene.cursors;
        const wasd = this.scene.wasd;

        // Check input and apply movement
        if (cursors.left.isDown || wasd.left.isDown) {
            me.setVelocityX(-GAME_CONFIG.PLAYER.SPEED); 
            moved = true;
        } else if (cursors.right.isDown || wasd.right.isDown) {
            me.setVelocityX(GAME_CONFIG.PLAYER.SPEED); 
            moved = true;
        }
        
        if (cursors.up.isDown || wasd.up.isDown) {
            me.setVelocityY(-GAME_CONFIG.PLAYER.SPEED); 
            moved = true;
        } else if (cursors.down.isDown || wasd.down.isDown) {
            me.setVelocityY(GAME_CONFIG.PLAYER.SPEED); 
            moved = true;
        }

        // Send movement to server if moved
        if (moved && this.scene.networkManager) {
            this.scene.networkManager.sendPlayerMove(me.x, me.y);
        }
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
        console.log('🔍 Debug Player State:', {
            mySocketId: this.mySocketId,
            mainPlayerId: this.mainPlayerId,
            mainPlayerExists: !!this.mainPlayer,
            playersCount: Object.keys(this.players).length,
            players: Object.keys(this.players),
            position: this.mainPlayer ? { x: this.mainPlayer.x, y: this.mainPlayer.y } : 'no player',
            velocity: this.mainPlayer && this.mainPlayer.body ? { x: this.mainPlayer.body.velocity.x, y: this.mainPlayer.body.velocity.y } : 'no body',
            movementEnabled: this.movementEnabled,
            sleeping: this.sleeping[this.mainPlayerId],
            bodyEnabled: this.mainPlayer && this.mainPlayer.body ? this.mainPlayer.body.enable : 'no body',
            bodyMoves: this.mainPlayer && this.mainPlayer.body ? this.mainPlayer.body.moves : 'no body'
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

        // Clean up money timers
        Object.values(this.moneyTimers).forEach(timer => {
            clearInterval(timer);
        });
        this.moneyTimers = {};

        // Stop tweens
        Object.values(this.sleepTweens).forEach(tween => {
            if (tween) tween.stop();
        });
        this.sleepTweens = {};

        // Remove Zzz texts
        Object.values(this.zzzTexts).forEach(text => {
            if (text) text.destroy();
        });
        this.zzzTexts = {};

        // Destroy player sprites
        Object.values(this.players).forEach(sprite => {
            if (sprite) sprite.destroy();
        });
        
        this.players = {};
        this.mainPlayer = null;
        this.mainPlayerId = null;

        console.log("✅ PlayerManager destroyed");
    }
}