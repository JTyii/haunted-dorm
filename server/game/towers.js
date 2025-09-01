import { SHARED_CONFIG } from '../../shared/constants';

function placeTower(gameState, socket, data) {
    const { roomId, col, row, cost, type } = data;
    const player = gameState.players[socket.id];
    
    if (!player) {
        return { success: false, error: 'Player not found' };
    }

    // Check if player has enough money
    if (player.money < cost) {
        return { success: false, error: 'Not enough money!' };
    }

    // Find the room
    const room = gameState.rooms.find(r => r.id === roomId);
    if (!room) {
        return { success: false, error: 'Room not found' };
    }

    // Check if position is valid (within room bounds)
    if (col < 0 || col >= room.cols || row < 0 || row >= room.rows) {
        return { success: false, error: 'Invalid position' };
    }

    // Check if tile is already occupied by a tower
    if (!room.towers) {
        room.towers = [];
    }
    
    const existingTower = room.towers.find(t => t.col === col && t.row === row);
    if (existingTower) {
        return { success: false, error: 'Tile already occupied' };
    }

    // Check if position conflicts with beds
    const bedConflict = checkBedConflict(room, col, row);
    if (bedConflict) {
        return { success: false, error: 'Cannot place tower on bed' };
    }

    // Deduct money and create tower
    player.money -= cost;
    
    const tower = { 
        roomId, 
        col, 
        row, 
        type, 
        owner: socket.id,
        damage: SHARED_CONFIG.TOWER_TYPES.BASIC.damage,
        range: SHARED_CONFIG.TOWER_TYPES.BASIC.range,
        fireRate: SHARED_CONFIG.TOWER_TYPES.BASIC.fireRate,
        lastFired: 0
    };
    
    // Add to room's towers array
    room.towers.push(tower);
    
    // Add to player's towers array
    if (!player.towers) {
        player.towers = [];
    }
    player.towers.push(tower);

    console.log(`🔫 Player ${socket.id} placed ${type} tower at (${col}, ${row}) in room ${roomId} for $${cost}`);
    
    // Notify player about money update
    socket.emit('moneyUpdate', player.money);
    
    return { success: true, tower };
}

function checkBedConflict(room, col, row) {
    // Beds are typically placed in the bottom row
    const bedRow = room.rows - 1;
    
    // Check if the tower position conflicts with any bed
    if (row === bedRow && col < room.bedCount) {
        return true;
    }
    
    return false;
}

function getTowersInRange(gameState, targetX, targetY, range) {
    const towersInRange = [];
    
    gameState.rooms.forEach(room => {
        if (room.towers) {
            room.towers.forEach(tower => {
                // Calculate tower world position
                const towerX = room.x + (tower.col - room.cols/2) * 60 + 30;
                const towerY = room.y + (tower.row - room.rows/2) * 60 + 30;
                
                const distance = Math.sqrt(
                    (towerX - targetX) ** 2 + 
                    (towerY - targetY) ** 2
                );
                
                if (distance <= range) {
                    towersInRange.push({
                        ...tower,
                        worldX: towerX,
                        worldY: towerY,
                        distance
                    });
                }
            });
        }
    });
    
    return towersInRange;
}

function canTowerFire(tower, currentTime) {
    return currentTime - tower.lastFired >= tower.fireRate;
}

function fireTower(tower, target) {
    tower.lastFired = Date.now();
    console.log(`💥 Tower at (${tower.col}, ${tower.row}) fired at target`);
    return {
        damage: tower.damage,
        fromX: tower.worldX,
        fromY: tower.worldY,
        toX: target.x,
        toY: target.y
    };
}

module.exports = { 
    placeTower, 
    getTowersInRange, 
    canTowerFire, 
    fireTower,
    checkBedConflict 
};