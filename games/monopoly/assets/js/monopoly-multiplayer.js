/**
 * Monopoly Multiplayer Module
 * Extends the shared GameMultiplayer class with Monopoly-specific features
 */

const MonopolyMultiplayer = {
    // Internal GameMultiplayer instance
    _mp: new GameMultiplayer({ maxPlayers: 6, codeLength: 12 }),

    // Expose state
    get mode() { return this._mp.mode; },
    get isHost() { return this._mp.isHost; },
    get localPlayerId() { return this._mp.localPlayerId; },
    set localPlayerId(val) { this._mp.localPlayerId = val; },
    get roomCode() { return this._mp.roomCode; },

    // Callbacks - pass through to internal instance
    set onPlayerJoined(fn) { this._mp.onPlayerJoined = fn; },
    set onPlayerLeft(fn) { this._mp.onPlayerLeft = fn; },
    set onGameStateReceived(fn) { this._mp.onGameStateReceived = fn; },
    set onConnectionError(fn) { this._mp.onConnectionError = fn; },
    set onConnectionReady(fn) { this._mp.onConnectionReady = fn; },
    set onGameStart(fn) { this._mp.onGameStart = fn; },

    // Monopoly-specific callbacks
    onActionReceived: null,
    onChatReceived: null,

    // Initialize for local play
    initLocal() {
        this._mp.initLocal();
    },

    // Initialize as host for online play
    async initAsHost(playerInfo) {
        this._setupMessageHandler();
        return this._mp.initAsHost(playerInfo);
    },

    // Initialize as guest for online play
    async initAsGuest(roomCode, playerInfo) {
        this._setupMessageHandler();
        return this._mp.initAsGuest(roomCode, playerInfo);
    },

    // Set up custom message handling for Monopoly-specific messages
    _setupMessageHandler() {
        this._mp.onMessage = (data, playerId) => {
            if (data.type === 'action' && this.onActionReceived) {
                this.onActionReceived(data.action, data.playerId);
            } else if (data.type === 'chat' && this.onChatReceived) {
                this.onChatReceived(data.text, data.playerId);
            }
        };
    },

    // Send game state (host only)
    sendGameState(state) {
        this._mp.sendGameState(state);
    },

    // Send action to host/all
    sendAction(action) {
        this._mp.broadcast({
            type: 'action',
            action,
            playerId: this._mp.localPlayerId
        });
    },

    // Send chat message
    sendChat(text) {
        this._mp.broadcast({
            type: 'chat',
            text,
            playerId: this._mp.localPlayerId
        });
    },

    // Start the game (host only)
    startGame(state) {
        this._mp.startGame(state);
    },

    // Check if we're in online mode
    isOnline() {
        return this._mp.isOnline();
    },

    // Get connected player count
    getConnectedCount() {
        return this._mp.getConnectedCount();
    },

    // Get all connected player info
    getConnectedPlayers() {
        return this._mp.getConnectedPlayers();
    },

    // Cleanup
    disconnect() {
        this._mp.disconnect();
        // Reset the internal instance for potential reuse
        this._mp = new GameMultiplayer({ maxPlayers: 6, codeLength: 12 });
    }
};

// Export for use in main game
window.MonopolyMultiplayer = MonopolyMultiplayer;
