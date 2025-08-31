class RoomSelectScene extends Phaser.Scene {
    constructor() {
        super('RoomSelectScene');
    }

    preload() {
        this.load.image('player', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
        this.load.image('tower', 'https://labs.phaser.io/assets/sprites/block.png'); 
        this.load.image('bed', '../assets/single-bed.png');     
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
        this.roomsCreated = false; // Track if rooms are created
        
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

        // ✅ Listen for snapToBed events
        this.socket.on('snapToBed', ({ playerId, bedX, bedY, roomId }) => {
            console.log(`📨 Received snapToBed for player ${playerId} at (${bedX}, ${bedY})`);
            if (!this.players[playerId]) return;
            this.makePlayerSleep(playerId, bedX, bedY);
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
                    this.socket.emit('placeTower', { roomId: room.id, col, row });
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