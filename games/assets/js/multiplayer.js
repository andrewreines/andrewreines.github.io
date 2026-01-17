// Simple Multiplayer Module using PeerJS

function GameMultiplayer(options) {
    this.mode = 'local';
    this.isHost = false;
    this.peer = null;
    this.conn = null;
    this.roomCode = null;
    this.localPlayerId = 0;
    this.maxPlayers = (options && options.maxPlayers) || 2;

    // Callbacks - set these after creating instance
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onGameStateReceived = null;
    this.onConnectionReady = null;
    this.onConnectionError = null;
    this.onGameStart = null;
}

GameMultiplayer.prototype.generateRoomCode = function() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

GameMultiplayer.prototype.initLocal = function() {
    this.mode = 'local';
    this.isHost = true;
    this.localPlayerId = 0;
};

GameMultiplayer.prototype.initAsHost = function(playerInfo) {
    var self = this;
    this.mode = 'online';
    this.isHost = true;
    this.localPlayerId = 0;
    this.roomCode = this.generateRoomCode();

    return new Promise(function(resolve, reject) {
        self.peer = new Peer(self.roomCode, {
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        self.peer.on('open', function() {
            resolve(self.roomCode);
        });

        self.peer.on('connection', function(conn) {
            self.conn = conn;

            conn.on('open', function() {
                conn.send({ type: 'requestInfo' });
            });

            conn.on('data', function(data) {
                self.handleMessage(data);
            });

            conn.on('close', function() {
                if (self.onPlayerLeft) self.onPlayerLeft();
            });
        });

        self.peer.on('error', function(err) {
            if (err.type === 'unavailable-id') {
                // Code taken, try again
                self.roomCode = self.generateRoomCode();
                self.peer.destroy();
                self.initAsHost(playerInfo).then(resolve).catch(reject);
            } else {
                if (self.onConnectionError) self.onConnectionError(err.message);
                reject(err);
            }
        });

        setTimeout(function() {
            if (!self.peer || !self.peer.open) {
                reject(new Error('Connection timeout'));
            }
        }, 15000);
    });
};

GameMultiplayer.prototype.initAsGuest = function(roomCode, playerInfo) {
    var self = this;
    this.mode = 'online';
    this.isHost = false;
    this.playerInfo = playerInfo;
    this.roomCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

    return new Promise(function(resolve, reject) {
        self.peer = new Peer({
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        self.peer.on('open', function() {
            self.conn = self.peer.connect(self.roomCode, { reliable: true });

            self.conn.on('open', function() {
                self.conn.on('data', function(data) {
                    self.handleMessage(data);
                });

                self.conn.on('close', function() {
                    if (self.onPlayerLeft) self.onPlayerLeft();
                });

                resolve();
            });

            self.conn.on('error', function(err) {
                if (self.onConnectionError) self.onConnectionError('Could not connect');
                reject(err);
            });
        });

        self.peer.on('error', function(err) {
            var msg = 'Connection error';
            if (err.type === 'peer-unavailable') {
                msg = 'Room not found';
            }
            if (self.onConnectionError) self.onConnectionError(msg);
            reject(new Error(msg));
        });

        setTimeout(function() {
            if (!self.conn || !self.conn.open) {
                reject(new Error('Connection timeout'));
            }
        }, 15000);
    });
};

GameMultiplayer.prototype.handleMessage = function(data) {
    if (data.type === 'requestInfo') {
        this.conn.send({ type: 'playerInfo', info: this.playerInfo });
    }
    else if (data.type === 'playerInfo') {
        if (this.onPlayerJoined) {
            this.onPlayerJoined({ playerId: 1, playerInfo: data.info });
        }
        this.conn.send({ type: 'connectionReady' });
        if (this.onConnectionReady) this.onConnectionReady();
    }
    else if (data.type === 'connectionReady') {
        if (this.onConnectionReady) this.onConnectionReady();
    }
    else if (data.type === 'gameStart') {
        if (this.onGameStart) this.onGameStart(data.state);
    }
    else if (data.type === 'gameState') {
        if (this.onGameStateReceived) this.onGameStateReceived(data.state);
    }
    else if (data.type === 'assignPlayerId') {
        this.localPlayerId = data.playerId;
    }
};

GameMultiplayer.prototype.startGame = function(state) {
    if (!this.isHost || !this.conn) return;
    this.conn.send({ type: 'assignPlayerId', playerId: 1 });
    this.conn.send({ type: 'gameStart', state: state });
};

GameMultiplayer.prototype.sendGameState = function(state) {
    if (this.conn && this.conn.open) {
        this.conn.send({ type: 'gameState', state: state });
    }
};

GameMultiplayer.prototype.isOnline = function() {
    return this.mode === 'online';
};

GameMultiplayer.prototype.disconnect = function() {
    if (this.peer) {
        this.peer.destroy();
        this.peer = null;
    }
    this.conn = null;
    this.mode = 'local';
    this.isHost = false;
    this.roomCode = null;
};

// Export
window.GameMultiplayer = GameMultiplayer;
