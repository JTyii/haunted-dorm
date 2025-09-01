const { generateRooms } = require('./rooms');
const GhostLogic = require('./ghostLogic');
const config = require('../config/serverConfig');

// Initialize ghost logic
const ghostLogic = new GhostLogic();
ghostLogic.initializeGhosts();

let gameState = {
    players: {},
    ghosts: ghostLogic.getGhosts(),
    rooms: generateRooms(config.GAME.ROOM_COUNT),
    gameTime: 0,
    waveNumber: 1,
    nextWaveTime: 30000, // 30 seconds
    gameStatus: 'playing' // playing, paused, ended
};

// Game loop function to update ghosts and game logic
function updateGameState() {
    gameState.gameTime += 1000; // Increment by 1 second
    
    // Update ghosts
    ghostLogic.updateGhosts(gameState);
    gameState.ghosts = ghostLogic.getGhosts();
    
    // Check for wave progression
    if (gameState.gameTime >= gameState.nextWaveTime) {
        gameState.waveNumber++;
        gameState.nextWaveTime += 45000; // Next wave in 45 seconds
        console.log(`🌊 Wave ${gameState.waveNumber} starting!`);
        
        // Spawn additional ghosts for new wave
        for (let i = 0; i < gameState.waveNumber; i++) {
            ghostLogic.ghosts.push({
                id: ghostLogic.ghostIdCounter++,
                x: Math.random() * -200 - 50,
                y: Math.random() * 400 + 200,
                health: 30 + (gameState.waveNumber * 5), // Stronger ghosts each wave
                maxHealth: 30 + (gameState.waveNumber * 5),
                speed: 20 + (gameState.waveNumber * 2),
                target: null,
                state: 'seeking'
            });
        }
    }
    
    return gameState;
}

// Export both the state and update function
module.exports = { 
    gameState, 
    updateGameState,
    ghostLogic 
};