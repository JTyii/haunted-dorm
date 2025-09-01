import { GAME_CONFIG } from './config/gameConfig.js';

const config = {
    type: Phaser.AUTO,
    width: GAME_CONFIG.SCREEN.WIDTH,
    height: GAME_CONFIG.SCREEN.HEIGHT,
    physics: {
        default: GAME_CONFIG.PHYSICS.DEFAULT,
        arcade: { debug: GAME_CONFIG.PHYSICS.DEBUG }
    },
    scene: [RoomSelectScene] // RoomSelectScene will be loaded via script tag for now
};

new Phaser.Game(config);