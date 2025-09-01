class RoomSelectScene extends Phaser.Scene {
    constructor() {
        super('RoomSelectScene');
    }

    preload() {
        this.load.image('player', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
        this.load.image('tower', 'https://labs.phaser.io/assets/sprites/block.png'); 
        this.load.image('bed', '../assets/single-bed.png');     
        this.load.image('coin', '../assets/goldCoin5.png');
        this.load.image('turret', 'https://labs.phaser.io/assets/sprites/block.png'); // ✅ Turret image
        this.load.image('menu-bg', '../assets/menuFrame.png'); // ✅ Menu background
    }

    showMessage(text, x, y, duration = 2000) {
        const msg = this.add.text(x, y - 40, text, {
            fontSize: '16px',
            fill: '#ffff00',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 6, y: 4 }
        }).setOrigin(0.5);

        this.tweens.add({
            targets: msg,
            y: msg.y - 30,
            alpha: 0,
            duration,
            ease: 'Power1',
            onComplete: () => msg.destroy()
        });
    }

    // ✅ Check if a tile is occupied by turret or bed
    isTileOccupied(roomId, col, row) {
        // Check for beds
        const room = this.roomRects[roomId];
        if (!room) return false;
        
        const roomRows = 4; // Default room height
        const bedSprites = this.roomBeds[roomId] || [];
        for (let bed of bedSprites) {
            if (Phaser.Math.Distance.Between(bed.x, bed.y, 
                this.roomRects[roomId].x - this.roomRects[roomId].width/2 + col * 60 + 30,
                this.roomRects[roomId].y - this.roomRects[roomId].height/2 + row * 60 + 30
            ) < 20) {
                return true; // Tile actually has a bed
            }
        }
        
        // Check for existing turrets
        const turretKey = `${roomId}-${col}-${row}`;
        return this.placedTurrets[turretKey] !== undefined;
    }

    // ✅ Open build menu at clicked tile
    openBuildMenu(x, y, roomId, col, row) {
        if (this.buildMenuOpen) {
            this.closeBuildMenu();
            return;
        }

        // Check if tile is occupied
        if (this.isTileOccupied(roomId, col, row)) {
            this.showMessage('Tile is occupied!', x, y);
            return;
        }

        console.log(`🔨 Opening build menu at tile (${col}, ${row}) in room ${roomId}`);

        this.selectedTile = { x, y, roomId, col, row };
        this.buildMenuOpen = true;

        // Create build menu background
        this.buildMenu = this.add.container(x, y - 80);
        
        const menuBg = this.add.rectangle(0, 0, 200, 80, 0x000000, 0.9)
            .setStrokeStyle(2, 0xffffff);
        
        const titleText = this.add.text(0, -25, 'Build Defense', {
            fontSize: '14px',
            fill: '#fff'
        }).setOrigin(0.5);

        // ✅ Basic Turret option
        const turretButton = this.add.rectangle(-60, 10, 50, 30, 0x4CAF50)
            .setStrokeStyle(1, 0xffffff)
            .setInteractive();
        
        const turretText = this.add.text(-60, 10, 'Turret\n$50', {
            fontSize: '10px',
            fill: '#fff',
            align: 'center'
        }).setOrigin(0.5);

        // ✅ Cancel button
        const cancelButton = this.add.rectangle(60, 10, 50, 30, 0xf44336)
            .setStrokeStyle(1, 0xffffff)
            .setInteractive();
            
        const cancelText = this.add.text(60, 10, 'Cancel', {
            fontSize: '12px',
            fill: '#fff'
        }).setOrigin(0.5);

        // Add all elements to container
        this.buildMenu.add([menuBg, titleText, turretButton, turretText, cancelButton, cancelText]);

        // ✅ Button interactions
        turretButton.on('pointerdown', () => {
            this.buyTurret(50); // Cost: $50
        });

        turretButton.on('pointerover', () => {
            turretButton.setFillStyle(0x66BB6A);
        });

        turretButton.on('pointerout', () => {
            turretButton.setFillStyle(0x4CAF50);
        });

        cancelButton.on('pointerdown', () => {
            this.closeBuildMenu();
        });

        cancelButton.on('pointerover', () => {
            cancelButton.setFillStyle(0xef5350);
        });

        cancelButton.on('pointerout', () => {
            cancelButton.setFillStyle(0xf44336);
        });

        // ✅ Auto-close when clicking elsewhere
        this.input.on('pointerdown', (pointer, currentlyOver) => {
            if (this.buildMenuOpen && currentlyOver.length === 0) {
                this.closeBuildMenu();
            }
        });
    }

    // ✅ Close build menu
    closeBuildMenu() {
        if (this.buildMenu) {
            this.buildMenu.destroy();
            this.buildMenu = null;
        }
        this.buildMenuOpen = false;
        this.selectedTile = null;
        console.log('🔨 Build menu closed');
    }

    // ✅ Buy and place turret
    buyTurret(cost) {
        if (this.playerMoney < cost) {
            this.showMessage('Not enough money!', this.selectedTile.x, this.selectedTile.y, 1500);
            this.closeBuildMenu();
            return;
        }

        if (!this.selectedTile) return;

        const { x, y, roomId, col, row } = this.selectedTile;
        
        // Deduct money
        this.playerMoney -= cost;
        this.updateMoneyDisplay();
        
        // Place turret visually
        const turret = this.add.image(tileX, tileY, 'turret')
            .setScale(0.6)
            .setTint(0x00ff00);
        
        // Store turret reference
        const turretKey = `${roomId}-${col}-${row}`;
        this.placedTurrets[turretKey] = turret;
        
        // Send to server
        this.socket.emit('placeTower', { 
            roomId: roomId, 
            col: col, 
            row: row,
            cost: cost,
            type: 'basic'
        });
        
        console.log(`🔫 Placed turret at (${col}, ${row}) in room ${roomId} for ${cost}`);
        this.showMessage(`Turret built! -${cost}`, x, y, 1500);
        
        this.closeBuildMenu();
    }

    create() {
        this.socket = io();

        this.players = {}; 
        this.playerTargets = {}; 
        this.roomRects = {}; 
        this.roomBeds = {};  
        this.towers = {}; 
        this.sleeping = {}; 
        this.zzzTexts = {}; 
        this.sleepTweens = {}; 
        this.bedOverlapsSetup = false;
        this.roomsCreated = false; 
        this.playerMoney = 100;
        this.moneyDisplay = null;
        this.coinAnimations = {};
        this.moneyTimers = {};
        this.buildMenu = null; // ✅ Build menu UI
        this.buildMenuOpen = false; // ✅ Track if build menu is open
        this.selectedTile = null; // ✅ Currently selected tile for building
        this.placedTurrets = {}; // ✅ Track placed turrets per room
        
        // 🔔 Listen for broadcasted room messages
        this.socket.on('roomMessage', ({ text, x, y }) => {
            console.log(`📢 Showing message: "${text}" at (${x}, ${y})`);
            this.showMessage(text, x, y);
        });

        const screenWidth = this.sys.game.config.width;
        const screenHeight = this.sys.game.config.height;
        const tileSize = 60;

        // --- receive full game state ---
        this.socket.on('gameState', (state) => {
            console.log('📦 Received game state:', state);

            // Create rooms first
            state.rooms.forEach((room, index) => {
                if (!this.roomRects[room.id]) {
                    console.log(`🏠 Creating room ${room.id}`);
                    this.createRoom(room, index, state.rooms.length, screenWidth, screenHeight, tileSize);
                }

                // Update bed occupancy visual
                this.updateBedOccupancy(room, state);
            });

            this.roomsCreated = true;

            // ✅ Create money display UI (fixed position on top right)
            if (!this.moneyDisplay) {
                this.moneyDisplay = this.add.text(screenWidth - 20, 20, `💰 ${this.playerMoney}`, {
                    fontSize: '24px',
                    fill: '#FFD700',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 12, y: 8 }
                }).setOrigin(1, 0).setScrollFactor(0); // ✅ Fixed to camera
            }

            // Create/update players
            Object.values(state.players).forEach(playerData => {
                if (!this.players[playerData.id]) {
                    console.log(`👤 Creating player ${playerData.id} at (${playerData.x}, ${playerData.y})`);
                    const sprite = this.physics.add.sprite(playerData.x, playerData.y, 'player');
                    sprite.setCollideWorldBounds(true);
                    this.players[playerData.id] = sprite;

                    if (playerData.id === this.socket.id) {
                        this.player = sprite;
                        this.cameras.main.startFollow(sprite, true);
                        console.log('🎮 Setting up physics for main player');
                        
                        // Set up physics interactions
                        this.setupWallCollisions();
                        this.setupBedOverlaps();
                    }
                } else {
                    // Update existing player
                    if (playerData.isSleeping && playerData.bed) {
                        // Player should be sleeping
                        const room = state.rooms.find(r => r.id === playerData.bed.roomId);
                        if (room) {
                            const bed = this.roomBeds[playerData.bed.roomId]?.[playerData.bed.bedIndex];
                            if (bed) {
                                this.makePlayerSleep(playerData.id, bed.x, bed.y);
                            }
                        }
                    } else {
                        // Player should be awake
                        if (playerData.id !== this.socket.id) {
                            this.playerTargets[playerData.id] = { x: playerData.x, y: playerData.y };
                        }
                        this.wakePlayer(playerData.id);
                    }
                }
            });
        });

        // other players movement
        this.socket.on('playerMove', ({ playerId, x, y }) => {
            if (playerId === this.socket.id) return;
            if (!this.players[playerId]) return;
            this.playerTargets[playerId] = { x, y };
        });

        // Listen for new towers placed
        this.socket.on('towerPlaced', (tower) => {
            // Example: assumes you have a function to add turrets
            this.placeTurret(tower.roomId, tower.col, tower.row, tower.type);
        });

        // ✅ Listen for snapToBed events
        this.socket.on('snapToBed', ({ playerId, bedX, bedY, roomId }) => {
            console.log(`📨 Received snapToBed for player ${playerId} at (${bedX}, ${bedY})`);
            if (!this.players[playerId]) return;
            this.makePlayerSleep(playerId, bedX, bedY);

            // ✅ Start earning money if it's the current player
            if (playerId === this.socket.id) {
                this.startEarningMoney(playerId);
            }
        });

        // controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        });
    }

    createRoom(room, index, totalRooms, screenWidth, screenHeight, tileSize) {
        const roomCols = room.cols || 6;
        const roomRows = room.rows || 4;
        const roomWidth = roomCols * tileSize;
        const roomHeight = roomRows * tileSize;
        
        // ✅ Dynamic spacing - some rooms stick together randomly
        let roomX;
        let isStuckToPrevious = false;
        
        if (index === 0) {
            // First room starts with base spacing
            roomX = screenWidth / (totalRooms + 1);
        } else {
            // Random chance to stick to previous room or add space
            const prevRoom = this.roomRects[room.id - 1] || this.roomRects[index]; // fallback
            const shouldStick = Math.random() < 0.4; // 40% chance to stick
            
            if (shouldStick && prevRoom) {
                // Stick to previous room with minimal gap
                roomX = prevRoom.x + prevRoom.width / 2 + roomWidth / 2 + 20;
                isStuckToPrevious = true;
            } else {
                // Add extra space (100-300px random)
                const extraSpace = 100 + Math.random() * 200;
                roomX = prevRoom ? (prevRoom.x + prevRoom.width / 2 + roomWidth / 2 + extraSpace) : (screenWidth / (totalRooms + 1));
            }
        }
        
        const roomY = screenHeight / 2;

        // room background
        const rect = this.add.rectangle(roomX, roomY, roomWidth, roomHeight, 0x222222)
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0.5, 0.5);

        this.roomRects[room.id] = { 
            rect, x: roomX, y: roomY, width: roomWidth, height: roomHeight, tiles: [], isStuckToPrevious 
        };

        // tiles
        for (let row = 0; row < roomRows; row++) {
            for (let col = 0; col < roomCols; col++) {
                const tileX = roomX - roomWidth / 2 + col * tileSize + tileSize / 2;
                const tileY = roomY - roomHeight / 2 + row * tileSize + tileSize / 2;

                const tile = this.add.rectangle(tileX, tileY, tileSize - 4, tileSize - 4, 0x555555)
                    .setStrokeStyle(1, 0x999999)
                    .setOrigin(0.5, 0.5)
                    .setInteractive();

                tile.on('pointerdown', () => {
                    this.openBuildMenu(tileX, tileY, room.id, col, row);
                });

                this.roomRects[room.id].tiles.push({ col, row, tile });
            }
        }

        this.add.text(roomX, roomY - roomHeight / 2 - 20, `Room ${room.id}`, { 
            fontSize: '14px', fill: '#fff' 
        }).setOrigin(0.5);

        // 🛏️ Create beds
        this.roomBeds[room.id] = [];
        for (let i = 0; i < room.bedCount; i++) {
            const bedCol = i;
            const bedRow = roomRows - 1;
            const bedX = roomX - roomWidth / 2 + bedCol * tileSize + tileSize / 2;
            const bedY = roomY - roomHeight / 2 + bedRow * tileSize + tileSize / 2;

            const bedSprite = this.add.image(bedX, bedY, 'bed').setScale(0.4); // ✅ Smaller bed
            this.physics.add.existing(bedSprite, true);

            this.roomBeds[room.id].push(bedSprite);
            console.log(`🛏️ Created bed ${i} at (${bedX}, ${bedY}) in room ${room.id}`);
        }

        // Create walls with smart door placement
        this.createWalls(room, roomX, roomY, roomWidth, roomHeight, roomCols, roomRows, tileSize, isStuckToPrevious);
    }

    createWalls(room, roomX, roomY, roomWidth, roomHeight, roomCols, roomRows, tileSize, isStuckToPrevious = false) {
        let availableSides = ["top", "bottom", "left", "right"];
        
        // ✅ Smart door placement logic
        if (isStuckToPrevious) {
            // If stuck to previous room, avoid placing door on the left side
            availableSides = ["top", "bottom", "right"];
            console.log(`🚪 Room ${room.id} is stuck to previous room - avoiding left door`);
        }
        
        // Check if next room will stick to this room
        const nextRoomWillStick = Math.random() < 0.4; // Same probability as sticking logic
        if (nextRoomWillStick && room.id < 3) { // Don't restrict last room
            // If next room will stick, avoid placing door on the right side  
            availableSides = availableSides.filter(side => side !== "right");
            console.log(`🚪 Room ${room.id} expects next room to stick - avoiding right door`);
        }
        
        // Always ensure at least one door option remains
        if (availableSides.length === 0) {
            availableSides = ["top", "bottom"];
            console.log(`🚪 Room ${room.id} fallback - using top/bottom doors`);
        }
        
        const doorSide = Phaser.Utils.Array.GetRandom(availableSides);
        let walls = [];

        console.log(`🚪 Creating door on ${doorSide} side for room ${room.id}`);

        if (doorSide === "top") {
            const doorCol = Math.floor(roomCols / 2);
            const doorX = roomX - roomWidth / 2 + doorCol * tileSize + tileSize / 2;

            const leftWall = this.add.rectangle(roomX - roomWidth / 4, roomY - roomHeight / 2, roomWidth / 2 - tileSize, 10, 0xff0000, 0);
            this.physics.add.existing(leftWall, true);
            walls.push(leftWall);

            const rightWall = this.add.rectangle(roomX + roomWidth / 4, roomY - roomHeight / 2, roomWidth / 2 - tileSize, 10, 0xff0000, 0);
            this.physics.add.existing(rightWall, true);
            walls.push(rightWall);

            this.add.rectangle(doorX, roomY - roomHeight / 2, tileSize, 10, 0x8B4513).setOrigin(0.5);
        } else {
            const wall = this.add.rectangle(roomX, roomY - roomHeight / 2, roomWidth, 10, 0xff0000, 0);
            this.physics.add.existing(wall, true);
            walls.push(wall);
        }

        if (doorSide === "bottom") {
            const doorCol = Math.floor(roomCols / 2);
            const doorX = roomX - roomWidth / 2 + doorCol * tileSize + tileSize / 2;

            const leftWall = this.add.rectangle(roomX - roomWidth / 4, roomY + roomHeight / 2, roomWidth / 2 - tileSize, 10, 0xff0000, 0);
            this.physics.add.existing(leftWall, true);
            walls.push(leftWall);

            const rightWall = this.add.rectangle(roomX + roomWidth / 4, roomY + roomHeight / 2, roomWidth / 2 - tileSize, 10, 0xff0000, 0);
            this.physics.add.existing(rightWall, true);
            walls.push(rightWall);

            this.add.rectangle(doorX, roomY + roomHeight / 2, tileSize, 10, 0x8B4513).setOrigin(0.5);
        } else {
            const wall = this.add.rectangle(roomX, roomY + roomHeight / 2, roomWidth, 10, 0xff0000, 0);
            this.physics.add.existing(wall, true);
            walls.push(wall);
        }

        if (doorSide === "left") {
            const doorRow = Math.floor(roomRows / 2);
            const doorY = roomY - roomHeight / 2 + doorRow * tileSize + tileSize / 2;

            const topWall = this.add.rectangle(roomX - roomWidth / 2, roomY - roomHeight / 4, 10, roomHeight / 2 - tileSize, 0xff0000, 0);
            this.physics.add.existing(topWall, true);
            walls.push(topWall);

            const bottomWall = this.add.rectangle(roomX - roomWidth / 2, roomY + roomHeight / 4, 10, roomHeight / 2 - tileSize, 0xff0000, 0);
            this.physics.add.existing(bottomWall, true);
            walls.push(bottomWall);

            this.add.rectangle(roomX - roomWidth / 2, doorY, 10, tileSize, 0x8B4513).setOrigin(0.5);
        } else {
            const wall = this.add.rectangle(roomX - roomWidth / 2, roomY, 10, roomHeight, 0xff0000, 0);
            this.physics.add.existing(wall, true);
            walls.push(wall);
        }

        if (doorSide === "right") {
            const doorRow = Math.floor(roomRows / 2);
            const doorY = roomY - roomHeight / 2 + doorRow * tileSize + tileSize / 2;

            const topWall = this.add.rectangle(roomX + roomWidth / 2, roomY - roomHeight / 4, 10, roomHeight / 2 - tileSize, 0xff0000, 0);
            this.physics.add.existing(topWall, true);
            walls.push(topWall);

            const bottomWall = this.add.rectangle(roomX + roomWidth / 2, roomY + roomHeight / 4, 10, roomHeight / 2 - tileSize, 0xff0000, 0);
            this.physics.add.existing(bottomWall, true);
            walls.push(bottomWall);

            this.add.rectangle(roomX + roomWidth / 2, doorY, 10, tileSize, 0x8B4513).setOrigin(0.5);
        } else {
            const wall = this.add.rectangle(roomX + roomWidth / 2, roomY, 10, roomHeight, 0xff0000, 0);
            this.physics.add.existing(wall, true);
            walls.push(wall);
        }

        this.roomRects[room.id].walls = walls;
    }

    updateBedOccupancy(room, state) {
        if (this.roomBeds[room.id]) {
            this.roomBeds[room.id].forEach((bed, i) => {
                const occupant = room.occupiedBeds.find(b => b.index === i);
                if (occupant) {
                    bed.setTint(0x777777);
                    const p = state.players[occupant.playerId];
                    if (p && p.isSleeping && this.players[p.id]) {
                        this.makePlayerSleep(p.id, bed.x, bed.y);
                    }
                } else {
                    bed.clearTint();
                }
            });
        }
    }

    setupWallCollisions() {
        if (!this.player) return;
        
        console.log('🧱 Setting up wall collisions');
        Object.values(this.roomRects).forEach(room => {
            if (room.walls) {
                room.walls.forEach(wall => {
                    this.physics.add.collider(this.player, wall);
                });
            }
        });
    }

    setupBedOverlaps() {
        if (!this.player) {
            console.log('❌ Cannot setup bed overlaps - no player sprite');
            return;
        }
        
        if (this.bedOverlapsSetup) {
            console.log('⚠️ Bed overlaps already set up, skipping');
            return;
        }
        
        console.log('🛏️ Setting up bed overlaps for', Object.keys(this.roomBeds).length, 'rooms');
        
        Object.entries(this.roomBeds).forEach(([roomId, beds]) => {
            beds.forEach((bedSprite, bedIndex) => {
                console.log(`🔗 Setting up overlap for bed ${bedIndex} in room ${roomId} at (${bedSprite.x}, ${bedSprite.y})`);
                
                this.physics.add.overlap(this.player, bedSprite, () => {
                    console.log(`💥 Bed overlap detected! Room ${roomId}, Bed ${bedIndex}`);
                    
                    if (!this.sleeping[this.socket.id]) {
                        console.log(`🛌 Sending enterRoom event: roomId=${roomId}, bedIndex=${bedIndex}`);
                        this.socket.emit('enterRoom', {
                            roomId: parseInt(roomId), // Ensure it's a number
                            bedIndex: bedIndex,
                            bedX: bedSprite.x,
                            bedY: bedSprite.y
                        });
                    } else {
                        console.log('😴 Player is already sleeping, ignoring overlap');
                    }
                });
            });
        });
        
        this.bedOverlapsSetup = true;
        console.log('✅ Bed overlaps setup complete');
    }

    placeTurret(roomId, col, row, type) {
        const room = this.rooms.find(r => r.id === roomId);
        if (!room) return;

        const tileSize = 40; // or whatever your grid uses
        const x = room.x + col * tileSize + tileSize / 2;
        const y = room.y + row * tileSize + tileSize / 2;

        const turret = this.add.sprite(x, y, type); // `type` should match your texture key
        turret.setOrigin(0.5);
        room.turrets = room.turrets || [];
        room.turrets.push(turret);
    }

    update() {
        const speed = 200;
        const me = this.players[this.socket.id];
        if (!me) return;

        // 🚫 If sleeping, freeze completely
        if (this.sleeping[this.socket.id]) {
            me.setVelocity(0);
            return;
        }

        // Movement control
        me.setVelocity(0);
        let moved = false;

        if (this.cursors.left.isDown || this.wasd.left.isDown) {
            me.setVelocityX(-speed); moved = true;
        } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
            me.setVelocityX(speed); moved = true;
        }
        if (this.cursors.up.isDown || this.wasd.up.isDown) {
            me.setVelocityY(-speed); moved = true;
        } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
            me.setVelocityY(speed); moved = true;
        }

        if (moved) {
            this.socket.emit('movePlayer', { x: me.x, y: me.y });
        }

        // interpolate other players
        Object.keys(this.playerTargets).forEach(playerId => {
            const target = this.playerTargets[playerId];
            const sprite = this.players[playerId];
            if (!sprite || !target) return;
            const lerp = 0.2;
            sprite.x += (target.x - sprite.x) * lerp;
            sprite.y += (target.y - sprite.y) * lerp;
        });
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
        sprite.setTint(0x3399ff);

        this.sleeping[playerId] = true;

        // Stop any existing sleep animation
        if (this.sleepTweens[playerId]) {
            this.sleepTweens[playerId].stop();
        }
        
        // Start floating animation
        this.sleepTweens[playerId] = this.tweens.add({
            targets: sprite,
            y: sprite.y - 5,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Create/show Zzz text
        if (!this.zzzTexts[playerId]) {
            this.zzzTexts[playerId] = this.add.text(sprite.x, sprite.y - 30, 'Zzz', { 
                fontSize: '16px', fill: '#00f' 
            }).setOrigin(0.5);
        }
        this.zzzTexts[playerId].setVisible(true);
        this.zzzTexts[playerId].setPosition(sprite.x, sprite.y - 30);

        // Animate Zzz text
        this.tweens.add({
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

    // ✅ Start earning money while sleeping
    startEarningMoney(playerId) {
        if (this.moneyTimers[playerId]) {
            clearInterval(this.moneyTimers[playerId]);
        }

        console.log(`💰 Player ${playerId} started earning money`);
        
        this.moneyTimers[playerId] = setInterval(() => {
            if (this.sleeping[playerId]) {
                // Earn 10 coins every 2 seconds
                if (playerId === this.socket.id) {
                    this.playerMoney += 5;
                    this.updateMoneyDisplay();
                }
                
                // Show floating coin animation
                this.showFloatingCoin(playerId);
            }
        }, 2000); // Every 2 seconds
    }

    // ✅ Show floating coin animation above sleeping player
    showFloatingCoin(playerId) {
        const sprite = this.players[playerId];
        if (!sprite) return;

        const coin = this.add.image(sprite.x + (Math.random() - 0.5) * 30, sprite.y - 20, 'coin')
            .setScale(0.3)
            .setAlpha(0);

        // Animate coin floating up and fading
        this.tweens.add({
            targets: coin,
            y: coin.y - 60,
            alpha: 1,
            duration: 800,
            ease: 'Power2'
        });

        this.tweens.add({
            targets: coin,
            alpha: 0,
            duration: 400,
            delay: 800,
            onComplete: () => coin.destroy()
        });

        // Add slight rotation and scale animation
        this.tweens.add({
            targets: coin,
            rotation: Math.PI * 2,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 1200,
            ease: 'Power1'
        });
    }

    // ✅ Update money display on screen
    updateMoneyDisplay() {
        if (this.moneyDisplay) {
            this.moneyDisplay.setText(`💰 ${this.playerMoney}`);
            
            // Add a little pulse animation when money increases
            this.tweens.add({
                targets: this.moneyDisplay,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 200,
                yoyo: true,
                ease: 'Power2'
            });
        }
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
    }
}

window.RoomSelectScene = RoomSelectScene;