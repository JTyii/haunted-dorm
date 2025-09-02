// server/game/towers.js
const { SHARED_CONFIG } = require('../../shared/constants');
const { isValidBuildPosition, addTowerToRoom, getRoom } = require('./rooms');
const config = require('../config/serverConfig');

// Place a tower
function placeTower(gameState, socket, data) {
    const playerId = socket.id;
    const player = gameState.players[playerId];
    
    if (!player) {
        return { success: false, error: 'Player not found' };
    }
    
    // Validate input data
    if (!data.roomId || data.col === undefined || data.row === undefined) {
        return { success: false, error: 'Invalid tower placement data' };
    }
    
    // Get room
    const room = getRoom(gameState, data.roomId);
    if (!room) {
        return { success: false, error: 'Room not found' };
    }
    
    // Check if position is valid
    if (!isValidBuildPosition(room, data.col, data.row)) {
        return { success: false, error: 'Invalid build position' };
    }
    
    // Get tower type configuration
    const towerType = data.towerType || 'basic';
    const towerConfig = SHARED_CONFIG.TOWER_TYPES[towerType.toUpperCase()];
    
    if (!towerConfig) {
        return { success: false, error: 'Invalid tower type' };
    }
    
    // Check if player has enough money
    if (player.money < towerConfig.cost) {
        return { 
            success: false, 
            error: `Not enough money. Need $${towerConfig.cost}, have $${player.money}` 
        };
    }
    
    // Calculate tower position
    const towerX = room.x + (data.col * config.ROOM_GENERATION.TILE_SIZE) + (config.ROOM_GENERATION.TILE_SIZE / 2);
    const towerY = room.y + (data.row * config.ROOM_GENERATION.TILE_SIZE) + (config.ROOM_GENERATION.TILE_SIZE / 2);
    
    // Create tower
    const tower = {
        id: `tower_${Date.now()}_${playerId}`,
        type: towerConfig.type,
        x: towerX,
        y: towerY,
        col: data.col,
        row: data.row,
        roomId: data.roomId,
        playerId: playerId,
        cost: towerConfig.cost,
        damage: towerConfig.damage,
        range: towerConfig.range,
        fireRate: towerConfig.fireRate,
        health: towerConfig.health,
        maxHealth: towerConfig.health,
        lastFired: 0,
        kills: 0,
        createdAt: Date.now()
    };
    
    // Deduct money from player
    player.money -= towerConfig.cost;
    
    // Add tower to room
    if (!addTowerToRoom(gameState, data.roomId, tower)) {
        // Refund money if adding tower failed
        player.money += towerConfig.cost;
        return { success: false, error: 'Failed to place tower in room' };
    }
    
    console.log(`🔫 Player ${playerId} placed ${towerType} tower at (${data.col}, ${data.row}) in room ${data.roomId} for $${towerConfig.cost}`);
    
    return {
        success: true,
        tower: tower,
        playerMoney: player.money
    };
}

// Upgrade a tower
function upgradeTower(gameState, playerId, towerId) {
    const player = gameState.players[playerId];
    if (!player) {
        return { success: false, error: 'Player not found' };
    }
    
    // Find the tower
    let tower = null;
    let room = null;
    
    for (const r of gameState.rooms) {
        if (r.towers) {
            const foundTower = r.towers.find(t => t.id === towerId && t.playerId === playerId);
            if (foundTower) {
                tower = foundTower;
                room = r;
                break;
            }
        }
    }
    
    if (!tower) {
        return { success: false, error: 'Tower not found or not owned by player' };
    }
    
    // Determine next upgrade level
    let nextType = null;
    let upgradeCost = 0;
    
    if (tower.type === 'basic') {
        nextType = 'ADVANCED';
        upgradeCost = SHARED_CONFIG.TOWER_TYPES.ADVANCED.cost - SHARED_CONFIG.TOWER_TYPES.BASIC.cost;
    } else if (tower.type === 'advanced') {
        nextType = 'MEGA';
        upgradeCost = SHARED_CONFIG.TOWER_TYPES.MEGA.cost - SHARED_CONFIG.TOWER_TYPES.ADVANCED.cost;
    } else {
        return { success: false, error: 'Tower is already at maximum level' };
    }
    
    const nextConfig = SHARED_CONFIG.TOWER_TYPES[nextType];
    
    // Check if player has enough money
    if (player.money < upgradeCost) {
        return { 
            success: false, 
            error: `Not enough money for upgrade. Need $${upgradeCost}, have $${player.money}` 
        };
    }
    
    // Upgrade the tower
    player.money -= upgradeCost;
    tower.type = nextConfig.type;
    tower.damage = nextConfig.damage;
    tower.range = nextConfig.range;
    tower.fireRate = nextConfig.fireRate;
    tower.health = nextConfig.health;
    tower.maxHealth = nextConfig.health;
    tower.upgradedAt = Date.now();
    
    console.log(`⬆️ Player ${playerId} upgraded tower ${towerId} to ${nextType} for $${upgradeCost}`);
    
    return {
        success: true,
        tower: tower,
        playerMoney: player.money,
        upgradeCost: upgradeCost
    };
}

// Repair a tower
function repairTower(gameState, playerId, towerId) {
    const player = gameState.players[playerId];
    if (!player) {
        return { success: false, error: 'Player not found' };
    }
    
    // Find the tower
    let tower = null;
    
    for (const room of gameState.rooms) {
        if (room.towers) {
            const foundTower = room.towers.find(t => t.id === towerId && t.playerId === playerId);
            if (foundTower) {
                tower = foundTower;
                break;
            }
        }
    }
    
    if (!tower) {
        return { success: false, error: 'Tower not found or not owned by player' };
    }
    
    if (tower.health >= tower.maxHealth) {
        return { success: false, error: 'Tower is already at full health' };
    }
    
    // Calculate repair cost (proportional to damage)
    const damageRatio = (tower.maxHealth - tower.health) / tower.maxHealth;
    const repairCost = Math.ceil(tower.cost * 0.3 * damageRatio); // 30% of tower cost max
    
    if (player.money < repairCost) {
        return { 
            success: false, 
            error: `Not enough money for repair. Need $${repairCost}, have $${player.money}` 
        };
    }
    
    // Repair the tower
    player.money -= repairCost;
    tower.health = tower.maxHealth;
    tower.repairedAt = Date.now();
    
    console.log(`🔧 Player ${playerId} repaired tower ${towerId} for $${repairCost}`);
    
    return {
        success: true,
        tower: tower,
        playerMoney: player.money,
        repairCost: repairCost
    };
}

// Sell a tower
function sellTower(gameState, playerId, towerId) {
    const player = gameState.players[playerId];
    if (!player) {
        return { success: false, error: 'Player not found' };
    }
    
    // Find and remove the tower
    let tower = null;
    let room = null;
    
    for (const r of gameState.rooms) {
        if (r.towers) {
            const towerIndex = r.towers.findIndex(t => t.id === towerId && t.playerId === playerId);
            if (towerIndex !== -1) {
                tower = r.towers[towerIndex];
                r.towers.splice(towerIndex, 1);
                room = r;
                break;
            }
        }
    }
    
    if (!tower) {
        return { success: false, error: 'Tower not found or not owned by player' };
    }
    
    // Calculate sell price (50% of original cost)
    const sellPrice = Math.floor(tower.cost * 0.5);
    player.money += sellPrice;
    
    console.log(`💰 Player ${playerId} sold tower ${towerId} for $${sellPrice}`);
    
    return {
        success: true,
        sellPrice: sellPrice,
        playerMoney: player.money,
        towerData: tower
    };
}

// Get tower info
function getTowerInfo(gameState, towerId) {
    for (const room of gameState.rooms) {
        if (room.towers) {
            const tower = room.towers.find(t => t.id === towerId);
            if (tower) {
                return tower;
            }
        }
    }
    return null;
}

// Update tower combat (called during game loop)
function updateTowerCombat(gameState) {
    const currentTime = Date.now();
    
    for (const room of gameState.rooms) {
        if (!room.towers) continue;
        
        for (const tower of room.towers) {
            // Check if tower can fire
            if (currentTime - tower.lastFired < tower.fireRate) continue;
            
            // Find targets in range (ghosts)
            const targets = gameState.ghosts.filter(ghost => {
                const distance = Math.sqrt(
                    Math.pow(ghost.x - tower.x, 2) + 
                    Math.pow(ghost.y - tower.y, 2)
                );
                return distance <= tower.range && ghost.health > 0;
            });
            
            if (targets.length > 0) {
                // Target closest ghost
                targets.sort((a, b) => {
                    const distA = Math.sqrt(Math.pow(a.x - tower.x, 2) + Math.pow(a.y - tower.y, 2));
                    const distB = Math.sqrt(Math.pow(b.x - tower.x, 2) + Math.pow(b.y - tower.y, 2));
                    return distA - distB;
                });
                
                const target = targets[0];
                
                // Deal damage
                target.health -= tower.damage;
                tower.lastFired = currentTime;
                
                console.log(`🔫 Tower ${tower.id} hit ghost ${target.id} for ${tower.damage} damage`);
                
                // Check if ghost is killed
                if (target.health <= 0) {
                    tower.kills++;
                    console.log(`💀 Tower ${tower.id} killed ghost ${target.id}`);
                }
            }
        }
    }
}

// Get all towers for a player
function getPlayerTowers(gameState, playerId) {
    const towers = [];
    
    for (const room of gameState.rooms) {
        if (room.towers) {
            const playerTowers = room.towers.filter(t => t.playerId === playerId);
            towers.push(...playerTowers);
        }
    }
    
    return towers;
}

module.exports = {
    placeTower,
    upgradeTower,
    repairTower,
    sellTower,
    getTowerInfo,
    updateTowerCombat,
    getPlayerTowers
};