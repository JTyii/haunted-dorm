function createPlayer(id) {
    return {
        id,
        x: 50,
        y: 500,
        roomId: null,
        towers: [],
        isSleeping: false,
        bed: null,
        money: 100
    };
}

function removePlayer(gameState, playerId) {
    delete gameState.players[playerId];
}

module.exports = { createPlayer, removePlayer };
