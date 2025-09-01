function placeTower(gameState, socket, data) {
    const { roomId, col, row, cost, type } = data;
    const player = gameState.players[socket.id];
    if (!player) return;

    if (player.money < cost) {
        socket.emit('errorMessage', 'Not enough money');
        return;
    }

    player.money -= cost;
    const tower = { roomId, col, row, type, owner: socket.id };
    player.towers.push(tower);

    socket.emit('moneyUpdate', player.money);
    socket.broadcast.emit('towerPlaced', tower);
    socket.emit('towerPlaced', tower); // make sure placer sees it too
}

module.exports = { placeTower };
