import { GAME_CONFIG } from '../config/gameConfig.js';

export class PlayerManager {
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
    }

    createPlayer(playerData) {
        if (this.players[playerData.id]) return;

        console.log(`👤 Creating player ${playerData.id} at (${playerData.x}, ${playerData.y})`);
        const sprite = this.scene.physics.add.sprite(playerData.x, playerData.y, 'player');
        sprite.setCollideWorldBounds(true);
        this.players[playerData.id] = sprite;

        if (playerData.id === this.scene.networkManager.getSocketId()) {
            this.mainPlayer = sprite;
            this.scene.cameras.main.startFollow(sprite, true);
            console.log('🎮 Setting up main player');
        }

        return sprite;
    }

    getPlayer(playerId) {
        return this.players[playerId];
    }

    getMainPlayer() {
        return this.mainPlayer;
    }

    updatePlayerPosition(playerId, x, y) {
        if (playerId === this.scene.networkManager.getSocketId()) return;
        if (!this.players[playerId]) return;
        
        this.playerTargets[playerId] = { x, y };
    }

    interpolatePlayerMovement() {
        Object.keys(this.playerTargets).forEach(playerId => {
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

        if (playerId === this.scene.networkManager.getSocketId()) {
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
        sprite.setVelocity(0);
        if (sprite.body) {
            sprite.body.immovable = true;
            sprite.body.moves = false;
        }
        sprite.setTint(GAME_CONFIG.COLORS.SLEEPING_TINT);

        this.sleeping[playerId] = true;

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
                if (playerId === this.scene.networkManager.getSocketId()) {
                    this.playerMoney += GAME_CONFIG.ECONOMY.SLEEP_EARNINGS;
                    this.scene.uiManager.updateMoneyDisplay(this.playerMoney);
                }
                this.scene.uiManager.showFloatingCoin(playerId);
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
        this.scene.uiManager.updateMoneyDisplay(this.playerMoney);
    }

    getMoney() {
        return this.playerMoney;
    }

    handleMovementInput() {
        const me = this.mainPlayer;
        if (!me) return;

        if (this.sleeping[this.scene.networkManager.getSocketId()]) {
            me.setVelocity(0);
            return;
        }

        me.setVelocity(0);
        let moved = false;

        const cursors = this.scene.cursors;
        const wasd = this.scene.wasd;

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

        if (moved) {
            this.scene.networkManager.sendPlayerMove(me.x, me.y);
        }
    }

    destroy() {
        // 🧹 Clean up money timers
        Object.values(this.moneyTimers).forEach(timer => {
            clearInterval(timer);
        });
        this.moneyTimers = {};

        // 🧹 Stop tweens
        Object.values(this.sleepTweens).forEach(tween => {
            if (tween) tween.stop();
        });
        this.sleepTweens = {};

        // 🧹 Remove Zzz texts
        Object.values(this.zzzTexts).forEach(text => {
            if (text) text.destroy();
        });
        this.zzzTexts = {};

        // 🧹 Destroy player sprites
        Object.values(this.players).forEach(sprite => {
            if (sprite) sprite.destroy();
        });
        this.players = {};
        this.mainPlayer = null;

        console.log("🗑️ PlayerManager destroyed");
    }
}
