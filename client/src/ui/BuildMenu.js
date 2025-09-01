class BuildMenu {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.isOpen = false;
        this.selectedTile = null;
    }

    open(x, y, roomId, col, row) {
        if (this.isOpen) {
            this.close();
            return;
        }

        // Check if tile is occupied
        if (this.scene.roomManager.isTileOccupied(roomId, col, row)) {
            this.scene.uiManager.showMessage('Tile is occupied!', x, y);
            return;
        }

        console.log(`🔨 Opening build menu at tile (${col}, ${row}) in room ${roomId}`);

        this.selectedTile = { x, y, roomId, col, row };
        this.isOpen = true;

        this.createMenuUI(x, y);
        this.setupEventListeners();
    }

    createMenuUI(x, y) {
        this.container = this.scene.add.container(x, y - 80);
        
        const menuBg = this.scene.add.rectangle(0, 0, 200, 80, 0x000000, 0.9)
            .setStrokeStyle(2, 0xffffff);
        
        const titleText = this.scene.add.text(0, -25, 'Build Defense', {
            fontSize: '14px',
            fill: '#fff'
        }).setOrigin(0.5);

        // Basic Turret option
        this.turretButton = this.scene.add.rectangle(-60, 10, 50, 30, 0x4CAF50)
            .setStrokeStyle(1, 0xffffff)
            .setInteractive();
        
        const turretText = this.scene.add.text(-60, 10, `Turret\n$${GAME_CONFIG.ECONOMY.TURRET_COST}`, {
            fontSize: '10px',
            fill: '#fff',
            align: 'center'
        }).setOrigin(0.5);

        // Cancel button
        this.cancelButton = this.scene.add.rectangle(60, 10, 50, 30, 0xf44336)
            .setStrokeStyle(1, 0xffffff)
            .setInteractive();
            
        const cancelText = this.scene.add.text(60, 10, 'Cancel', {
            fontSize: '12px',
            fill: '#fff'
        }).setOrigin(0.5);

        this.container.add([menuBg, titleText, this.turretButton, turretText, this.cancelButton, cancelText]);
    }

    setupEventListeners() {
        // Turret button interactions
        this.turretButton.on('pointerdown', () => {
            this.buyTurret(GAME_CONFIG.ECONOMY.TURRET_COST);
        });

        this.turretButton.on('pointerover', () => {
            this.turretButton.setFillStyle(0x66BB6A);
        });

        this.turretButton.on('pointerout', () => {
            this.turretButton.setFillStyle(0x4CAF50);
        });

        // Cancel button interactions
        this.cancelButton.on('pointerdown', () => {
            this.close();
        });

        this.cancelButton.on('pointerover', () => {
            this.cancelButton.setFillStyle(0xef5350);
        });

        this.cancelButton.on('pointerout', () => {
            this.cancelButton.setFillStyle(0xf44336);
        });

        // Auto-close when clicking elsewhere
        this.scene.input.on('pointerdown', (pointer, currentlyOver) => {
            if (this.isOpen && currentlyOver.length === 0) {
                this.close();
            }
        });
    }

    buyTurret(cost) {
        if (!this.scene.playerManager.canAfford(cost)) {
            this.scene.uiManager.showMessage('Not enough money!', this.selectedTile.x, this.selectedTile.y, 1500);
            this.close();
            return;
        }

        if (!this.selectedTile) return;

        const { x, y, roomId, col, row } = this.selectedTile;
        
        // Process purchase through player manager
        this.scene.playerManager.spendMoney(cost);
        
        // Place turret visually
        this.scene.roomManager.placeTurretVisual(roomId, col, row, x, y);
        
        // Send to server
        this.scene.networkManager.sendPlaceTower(roomId, col, row, cost, SHARED_CONFIG.TOWER_TYPES.BASIC.type);
        
        console.log(`🔫 Placed turret at (${col}, ${row}) in room ${roomId} for $${cost}`);
        this.scene.uiManager.showMessage(`Turret built! -$${cost}`, x, y, 1500);
        
        this.close();
    }

    close() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        this.isOpen = false;
        this.selectedTile = null;
        console.log('🔨 Build menu closed');
    }

    destroy() {
        this.close();
    }
}