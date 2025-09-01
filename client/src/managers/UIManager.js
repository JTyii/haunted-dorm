import { GAME_CONFIG } from '../config/gameConfig.js';

export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.moneyDisplay = null;
        this.coinAnimations = {};
    }

    createMoneyDisplay(initialMoney) {
        if (!this.moneyDisplay) {
            this.moneyDisplay = this.scene.add.text(
                GAME_CONFIG.SCREEN.WIDTH - 20, 
                20, 
                `💰 ${initialMoney}`, 
                {
                    fontSize: '24px',
                    fill: '#FFD700',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 12, y: 8 }
                }
            ).setOrigin(1, 0).setScrollFactor(0);
        }
    }

    updateMoneyDisplay(amount) {
        if (this.moneyDisplay) {
            this.moneyDisplay.setText(`💰 ${amount}`);
            
            // Pulse animation when money changes
            this.scene.tweens.add({
                targets: this.moneyDisplay,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 200,
                yoyo: true,
                ease: 'Power2'
            });
        }
    }

    showMessage(text, x, y, duration = 2000) {
        const msg = this.scene.add.text(x, y - 40, text, {
            fontSize: '16px',
            fill: '#ffff00',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 6, y: 4 }
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: msg,
            y: msg.y - 30,
            alpha: 0,
            duration,
            ease: 'Power1',
            onComplete: () => msg.destroy()
        });
    }

    showFloatingCoin(playerId) {
        const player = this.scene.playerManager.getPlayer(playerId);
        if (!player) return;

        const coin = this.scene.add.image(
            player.x + (Math.random() - 0.5) * 30, 
            player.y - 20, 
            'coin'
        ).setScale(0.3).setAlpha(0);

        // Animate coin floating up and fading
        this.scene.tweens.add({
            targets: coin,
            y: coin.y - 60,
            alpha: 1,
            duration: 800,
            ease: 'Power2'
        });

        this.scene.tweens.add({
            targets: coin,
            alpha: 0,
            duration: 400,
            delay: 800,
            onComplete: () => coin.destroy()
        });

        // Add rotation and scale animation
        this.scene.tweens.add({
            targets: coin,
            rotation: Math.PI * 2,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 1200,
            ease: 'Power1'
        });
    }

    destroy() {
        if (this.moneyDisplay) {
            this.moneyDisplay.destroy();
            this.moneyDisplay = null;
        }
        
        // Clear any ongoing coin animations
        Object.values(this.coinAnimations).forEach(animation => {
            if (animation && animation.destroy) {
                animation.destroy();
            }
        });
        this.coinAnimations = {};
    }
}