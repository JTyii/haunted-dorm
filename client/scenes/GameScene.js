class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    preload() {
        this.load.image('tower', 'assets/tower.png');
        this.load.image('ghost', 'assets/ghost.png');
    }

    create() {
        this.socket = io();
        this.ghosts = this.add.group();
        this.towers = this.add.group();

        this.socket.on('gameState', state => this.updateGame(state));

        this.input.on('pointerdown', pointer => {
            this.socket.emit('placeTower', { x: pointer.x, y: pointer.y });
        });
    }

    updateGame(state) {
        this.ghosts.clear(true, true);
        state.ghosts.forEach(g => this.ghosts.create(g.x, g.y, 'ghost'));

        this.towers.clear(true, true);
        Object.values(state.players).forEach(p => {
            p.towers.forEach(t => this.towers.create(t.x, t.y, 'tower'));
        });
    }
}

window.GameScene = GameScene;
