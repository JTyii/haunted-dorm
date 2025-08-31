let state = {
    players: {},
    ghosts: [{ x: 100, y: 100 }]
};

module.exports = {
    addPlayer: (id) => {
        state.players[id] = { towers: [] };
    },
    removePlayer: (id) => {
        delete state.players[id];
    },
    placeTower: (id, tower) => {
        if(state.players[id]) state.players[id].towers.push(tower);
    },
    updateGhosts: () => {
        state.ghosts.forEach(g => g.x += 5); // Simple ghost movement
    },
    getState: () => state
};
