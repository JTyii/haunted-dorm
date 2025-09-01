import { SHARED_CONFIG } from '../../../shared/constants.js';

export class NetworkManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = io();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Game state updates
        this.socket.on(SHARED_CONFIG.EVENTS.GAME_STATE, (state) => {
            this.scene.handleGameState(state);
        });

        // Player movement
        this.socket.on(SHARED_CONFIG.EVENTS.PLAYER_MOVE, ({ playerId, x, y }) => {
            this.scene.playerManager.updatePlayerPosition(playerId, x, y);
        });

        // New player joined
        this.socket.on(SHARED_CONFIG.EVENTS.PLAYER_JOIN, (playerData) => {
            this.scene.playerManager.createPlayer(playerData);
        });

        // Player snapped to bed
        this.socket.on(SHARED_CONFIG.EVENTS.SNAP_TO_BED, ({ playerId, bedX, bedY, roomId }) => {
            this.scene.playerManager.snapPlayerToBed(playerId, bedX, bedY, roomId);
        });

        // Room messages
        this.socket.on(SHARED_CONFIG.EVENTS.ROOM_MESSAGE, ({ text, x, y }) => {
            this.scene.uiManager.showMessage(text, x, y);
        });

        // Tower placement
        this.socket.on(SHARED_CONFIG.EVENTS.TOWER_PLACED, (tower) => {
            this.scene.roomManager.placeTurret(tower.roomId, tower.col, tower.row, tower.type);
        });
    }

    // Send player movement to server
    sendPlayerMove(x, y) {
        this.socket.emit(SHARED_CONFIG.EVENTS.PLAYER_MOVE, { x, y });
    }

    // Send room entry request
    sendEnterRoom(roomId, bedIndex, bedX, bedY) {
        this.socket.emit(SHARED_CONFIG.EVENTS.ENTER_ROOM, {
            roomId: parseInt(roomId),
            bedIndex: bedIndex,
            bedX: bedX,
            bedY: bedY
        });
    }

    // Send tower placement request
    sendPlaceTower(roomId, col, row, cost, type) {
        this.socket.emit(SHARED_CONFIG.EVENTS.PLACE_TOWER, {
            roomId: roomId,
            col: col,
            row: row,
            cost: cost,
            type: type
        });
    }

    getSocketId() {
        return this.socket.id;
    }
}