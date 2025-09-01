const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  physics: {
    default: "arcade",
    arcade: { debug: false }
  },
  scene: [RoomSelectScene]
};

new Phaser.Game(config);
