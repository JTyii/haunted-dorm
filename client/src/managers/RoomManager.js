import { GAME_CONFIG } from '../config/gameConfig.js';
import { SHARED_CONFIG } from '../../../shared/constants.js';

export class RoomManager {
    constructor(scene) {
        this.scene = scene;
        this.roomRects = {};
        this.roomBeds = {};
        this.placedTurrets = {};
        this.bedOverlapsSetup = false;
    }

    createRoom(room, index, totalRooms) {
        const { WIDTH: screenWidth, HEIGHT: screenHeight } = GAME_CONFIG.SCREEN;
        const tileSize = GAME_CONFIG.ROOM.TILE_SIZE;
        
        const roomCols = room.cols || GAME_CONFIG.ROOM.DEFAULT_COLS;
        const roomRows = room.rows || GAME_CONFIG.ROOM.DEFAULT_ROWS;
        const roomWidth = roomCols * tileSize;
        const roomHeight = roomRows * tileSize;
        
        // Calculate room position with dynamic spacing
        const { roomX, isStuckToPrevious } = this.calculateRoomPosition(
            index, totalRooms, screenWidth, roomWidth
        );
        const roomY = screenHeight / 2;

        // Create room background
        const rect = this.scene.add.rectangle(roomX, roomY, roomWidth, roomHeight, GAME_CONFIG.COLORS.ROOM_BG)
            .setStrokeStyle(2, GAME_CONFIG.COLORS.ROOM_BORDER)
            .setOrigin(0.5, 0.5);

        this.roomRects[room.id] = { 
            rect, 
            x: roomX, 
            y: roomY, 
            width: roomWidth, 
            height: roomHeight, 
            tiles: [], 
            isStuckToPrevious 
        };

        // Create tiles
        this.createRoomTiles(room, roomX, roomY, roomWidth, roomHeight, roomCols, roomRows, tileSize);
        
        // Create room label
        this.scene.add.text(roomX, roomY - roomHeight / 2 - 20, `Room ${room.id}`, { 
            fontSize: '14px', 
            fill: '#fff' 
        }).setOrigin(0.5);

        // Create beds
        this.createRoomBeds(room, roomX, roomY, roomWidth, roomHeight, roomCols, roomRows, tileSize);
        
        // Create walls with doors
        this.createWalls(room, roomX, roomY, roomWidth, roomHeight, roomCols, roomRows, tileSize, isStuckToPrevious);
    }

    calculateRoomPosition(index, totalRooms, screenWidth, roomWidth) {
        let roomX;
        let isStuckToPrevious = false;
        
        if (index === 0) {
            roomX = screenWidth / (totalRooms + 1);
        } else {
            const prevRoom = this.roomRects[index] || Object.values(this.roomRects)[index - 1];
            const shouldStick = Math.random() < SHARED_CONFIG.ROOM_GENERATION.STICK_PROBABILITY;
            
            if (shouldStick && prevRoom) {
                roomX = prevRoom.x + prevRoom.width / 2 + roomWidth / 2 + SHARED_CONFIG.ROOM_GENERATION.MIN_SPACING;
                isStuckToPrevious = true;
            } else {
                const extraSpace = GAME_CONFIG.ROOM.DEFAULT_COLS * 20 + Math.random() * SHARED_CONFIG.ROOM_GENERATION.MAX_EXTRA_SPACING;
                roomX = prevRoom ? (prevRoom.x + prevRoom.width / 2 + roomWidth / 2 + extraSpace) : (screenWidth / (totalRooms + 1));
            }
        }
        
        return { roomX, isStuckToPrevious };
    }

    createRoomTiles(room, roomX, roomY, roomWidth, roomHeight, roomCols, roomRows, tileSize) {
        for (let row = 0; row < roomRows; row++) {
            for (let col = 0; col < roomCols; col++) {
                const tileX = roomX - roomWidth / 2 + col * tileSize + tileSize / 2;
                const tileY = roomY - roomHeight / 2 + row * tileSize + tileSize / 2;

                const tile = this.scene.add.rectangle(tileX, tileY, tileSize - 4, tileSize - 4, GAME_CONFIG.COLORS.TILE_BG)
                    .setStrokeStyle(1, GAME_CONFIG.COLORS.TILE_BORDER)
                    .setOrigin(0.5, 0.5)
                    .setInteractive();

                tile.on('pointerdown', () => {
                    this.scene.buildMenu.open(tileX, tileY, room.id, col, row);
                });

                this.roomRects[room.id].tiles.push({ col, row, tile });
            }
        }
    }

    createRoomBeds(room, roomX, roomY, roomWidth, roomHeight, roomCols, roomRows, tileSize) {
        this.roomBeds[room.id] = [];
        
        for (let i = 0; i < room.bedCount; i++) {
            const bedCol = i;
            const bedRow = roomRows - 1;
            const bedX = roomX - roomWidth / 2 + bedCol * tileSize + tileSize / 2;
            const bedY = roomY - roomHeight / 2 + bedRow * tileSize + tileSize / 2;

            const bedSprite = this.scene.add.image(bedX, bedY, 'bed').setScale(0.4);
            this.scene.physics.add.existing(bedSprite, true);

            this.roomBeds[room.id].push(bedSprite);
            console.log(`🛏️ Created bed ${i} at (${bedX}, ${bedY}) in room ${room.id}`);
        }
    }

    createWalls(room, roomX, roomY, roomWidth, roomHeight, roomCols, roomRows, tileSize, isStuckToPrevious = false) {
        let availableSides = [...SHARED_CONFIG.DOORS.SIDES];
        
        // Smart door placement logic
        if (isStuckToPrevious) {
            availableSides = availableSides.filter(side => side !== "left");
            console.log(`🚪 Room ${room.id} is stuck to previous room - avoiding left door`);
        }
        
        const nextRoomWillStick = Math.random() < SHARED_CONFIG.ROOM_GENERATION.STICK_PROBABILITY;
        if (nextRoomWillStick && room.id < 3) {
            availableSides = availableSides.filter(side => side !== "right");
            console.log(`🚪 Room ${room.id} expects next room to stick - avoiding right door`);
        }
        
        if (availableSides.length === 0) {
            availableSides = ["top", "bottom"];
            console.log(`🚪 Room ${room.id} fallback - using top/bottom doors`);
        }
        
        const doorSide = Phaser.Utils.Array.GetRandom(availableSides);
        console.log(`🚪 Creating door on ${doorSide} side for room ${room.id}`);

        const walls = this.createWallsForSide(doorSide, roomX, roomY, roomWidth, roomHeight, roomCols, roomRows, tileSize);
        this.roomRects[room.id].walls = walls;
    }

    createWallsForSide(doorSide, roomX, roomY, roomWidth, roomHeight, roomCols, roomRows, tileSize) {
        const walls = [];
        
        // Create walls based on door side
        switch (doorSide) {
            case "top":
                walls.push(...this.createTopWallWithDoor(roomX, roomY, roomWidth, roomHeight, roomCols, tileSize));
                walls.push(this.createWall(roomX, roomY + roomHeight / 2, roomWidth, 10)); // bottom
                walls.push(this.createWall(roomX - roomWidth / 2, roomY, 10, roomHeight)); // left
                walls.push(this.createWall(roomX + roomWidth / 2, roomY, 10, roomHeight)); // right
                break;
                
            case "bottom":
                walls.push(this.createWall(roomX, roomY - roomHeight / 2, roomWidth, 10)); // top
                walls.push(...this.createBottomWallWithDoor(roomX, roomY, roomWidth, roomHeight, roomCols, tileSize));
                walls.push(this.createWall(roomX - roomWidth / 2, roomY, 10, roomHeight)); // left
                walls.push(this.createWall(roomX + roomWidth / 2, roomY, 10, roomHeight)); // right
                break;
                
            case "left":
                walls.push(this.createWall(roomX, roomY - roomHeight / 2, roomWidth, 10)); // top
                walls.push(this.createWall(roomX, roomY + roomHeight / 2, roomWidth, 10)); // bottom
                walls.push(...this.createLeftWallWithDoor(roomX, roomY, roomWidth, roomHeight, roomRows, tileSize));
                walls.push(this.createWall(roomX + roomWidth / 2, roomY, 10, roomHeight)); // right
                break;
                
            case "right":
                walls.push(this.createWall(roomX, roomY - roomHeight / 2, roomWidth, 10)); // top
                walls.push(this.createWall(roomX, roomY + roomHeight / 2, roomWidth, 10)); // bottom
                walls.push(this.createWall(roomX - roomWidth / 2, roomY, 10, roomHeight)); // left
                walls.push(...this.createRightWallWithDoor(roomX, roomY, roomWidth, roomHeight, roomRows, tileSize));
                break;
        }
        
        return walls;
    }

    createWall(x, y, width, height) {
        const wall = this.scene.add.rectangle(x, y, width, height, GAME_CONFIG.COLORS.WALL, 0);
        this.scene.physics.add.existing(wall, true);
        return wall;
    }

    createDoor(x, y, width, height) {
        return this.scene.add.rectangle(x, y, width, height, GAME_CONFIG.COLORS.DOOR).setOrigin(0.5);
    }

    createTopWallWithDoor(roomX, roomY, roomWidth, roomHeight, roomCols, tileSize) {
        const doorCol = Math.floor(roomCols / 2);
        const doorX = roomX - roomWidth / 2 + doorCol * tileSize + tileSize / 2;

        const leftWall = this.createWall(roomX - roomWidth / 4, roomY - roomHeight / 2, roomWidth / 2 - tileSize, 10);
        const rightWall = this.createWall(roomX + roomWidth / 4, roomY - roomHeight / 2, roomWidth / 2 - tileSize, 10);
        this.createDoor(doorX, roomY - roomHeight / 2, tileSize, 10);

        return [leftWall, rightWall];
    }

    createBottomWallWithDoor(roomX, roomY, roomWidth, roomHeight, roomCols, tileSize) {
        const doorCol = Math.floor(roomCols / 2);
        const doorX = roomX - roomWidth / 2 + doorCol * tileSize + tileSize / 2;

        const leftWall = this.createWall(roomX - roomWidth / 4, roomY + roomHeight / 2, roomWidth / 2 - tileSize, 10);
        const rightWall = this.createWall(roomX + roomWidth / 4, roomY + roomHeight / 2, roomWidth / 2 - tileSize, 10);
        this.createDoor(doorX, roomY + roomHeight / 2, tileSize, 10);

        return [leftWall, rightWall];
    }

    createLeftWallWithDoor(roomX, roomY, roomWidth, roomHeight, roomRows, tileSize) {
        const doorRow = Math.floor(roomRows / 2);
        const doorY = roomY - roomHeight / 2 + doorRow * tileSize + tileSize / 2;

        const topWall = this.createWall(roomX - roomWidth / 2, roomY - roomHeight / 4, 10, roomHeight / 2 - tileSize);
        const bottomWall = this.createWall(roomX - roomWidth / 2, roomY + roomHeight / 4, 10, roomHeight / 2 - tileSize);
        this.createDoor(roomX - roomWidth / 2, doorY, 10, tileSize);

        return [topWall, bottomWall];
    }

    createRightWallWithDoor(roomX, roomY, roomWidth, roomHeight, roomRows, tileSize) {
        const doorRow = Math.floor(roomRows / 2);
        const doorY = roomY - roomHeight / 2 + doorRow * tileSize + tileSize / 2;

        const topWall = this.createWall(roomX + roomWidth / 2, roomY - roomHeight / 4, 10, roomHeight / 2 - tileSize);
        const bottomWall = this.createWall(roomX + roomWidth / 2, roomY + roomHeight / 4, 10, roomHeight / 2 - tileSize);
        this.createDoor(roomX + roomWidth / 2, doorY, 10, tileSize);

        return [topWall, bottomWall];
    }

    updateBedOccupancy(room, gameState) {
        if (this.roomBeds[room.id]) {
            this.roomBeds[room.id].forEach((bed, i) => {
                const occupant = room.occupiedBeds.find(b => b.index === i);
                if (occupant) {
                    bed.setTint(0x777777);
                    const player = gameState.players[occupant.playerId];
                    if (player && player.isSleeping) {
                        this.scene.playerManager.makePlayerSleep(player.id, bed.x, bed.y);
                    }
                } else {
                    bed.clearTint();
                }
            });
        }
    }

    setupBedOverlaps() {
        const mainPlayer = this.scene.playerManager.getMainPlayer();
        if (!mainPlayer) {
            console.log('❌ Cannot setup bed overlaps - no main player');
            return;
        }
        
        if (this.bedOverlapsSetup) {
            console.log('⚠️ Bed overlaps already set up, skipping');
            return;
        }
        
        console.log('🛏️ Setting up bed overlaps for', Object.keys(this.roomBeds).length, 'rooms');
        
        Object.entries(this.roomBeds).forEach(([roomId, beds]) => {
            beds.forEach((bedSprite, bedIndex) => {
                console.log(`🔗 Setting up overlap for bed ${bedIndex} in room ${roomId}`);
                
                this.scene.physics.add.overlap(mainPlayer, bedSprite, () => {
                    console.log(`💥 Bed overlap detected! Room ${roomId}, Bed ${bedIndex}`);
                    
                    if (!this.scene.playerManager.isSleeping(this.scene.networkManager.getSocketId())) {
                        console.log(`🛌 Sending enterRoom event: roomId=${roomId}, bedIndex=${bedIndex}`);
                        this.scene.networkManager.sendEnterRoom(roomId, bedIndex, bedSprite.x, bedSprite.y);
                    }
                });
            });
        });
        
        this.bedOverlapsSetup = true;
        console.log('✅ Bed overlaps setup complete');
    }

    setupWallCollisions() {
        const mainPlayer = this.scene.playerManager.getMainPlayer();
        if (!mainPlayer) return;
        
        console.log('🧱 Setting up wall collisions');
        Object.values(this.roomRects).forEach(room => {
            if (room.walls) {
                room.walls.forEach(wall => {
                    this.scene.physics.add.collider(mainPlayer, wall);
                });
            }
        });
    }

    isTileOccupied(roomId, col, row) {
        const room = this.roomRects[roomId];
        if (!room) return false;
        
        // Check for beds
        const bedSprites = this.roomBeds[roomId] || [];
        const targetX = room.x - room.width/2 + col * GAME_CONFIG.ROOM.TILE_SIZE + 30;
        const targetY = room.y - room.height/2 + row * GAME_CONFIG.ROOM.TILE_SIZE + 30;
        
        for (let bed of bedSprites) {
            if (Phaser.Math.Distance.Between(bed.x, bed.y, targetX, targetY) < 20) {
                return true;
            }
        }
        
        // Check for existing turrets
        const turretKey = `${roomId}-${col}-${row}`;
        return this.placedTurrets[turretKey] !== undefined;
    }

    placeTurretVisual(roomId, col, row, x, y) {
        const turret = this.scene.add.image(x, y, 'turret')
            .setScale(0.6)
            .setTint(GAME_CONFIG.COLORS.TURRET_TINT);
        
        const turretKey = `${roomId}-${col}-${row}`;
        this.placedTurrets[turretKey] = turret;
        
        return turret;
    }

    placeTurret(roomId, col, row, type) {
        const room = this.roomRects[roomId];
        if (!room) return;

        const tileSize = GAME_CONFIG.ROOM.TILE_SIZE;
        const x = room.x - room.width/2 + col * tileSize + tileSize/2;
        const y = room.y - room.height/2 + row * tileSize + tileSize/2;

        return this.placeTurretVisual(roomId, col, row, x, y);
    }

    getRoomRects() {
        return this.roomRects;
    }

    getRoomBeds() {
        return this.roomBeds;
    }

    destroy() {
        // Clean up turrets
        Object.values(this.placedTurrets).forEach(turret => {
            if (turret && turret.destroy) {
                turret.destroy();
            }
        });
        this.placedTurrets = {};
        
        // Reset state
        this.roomRects = {};
        this.roomBeds = {};
        this.bedOverlapsSetup = false;
    }
}