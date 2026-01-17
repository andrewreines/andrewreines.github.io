/**
 * Shared Multiplayer Module
 * Reusable peer-to-peer multiplayer using PeerJS
 * Can be used by any game in the arcade
 */

class GameMultiplayer {
    constructor(options = {}) {
        this.mode = 'local';
        this.isHost = false;
        this.peer = null;
        this.connections = [];
        this.localPlayerId = null;
        this.roomCode = null;
        this.playerInfo = null;
        this.maxPlayers = options.maxPlayers || 2;
        this.codeLength = options.codeLength || 12;

        // Callbacks - set these after instantiation
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onGameStateReceived = null;
        this.onMessage = null;
        this.onConnectionReady = null;
        this.onConnectionError = null;
        this.onGameStart = null;
    }

    // Generate room code
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < this.codeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Initialize for local play
    initLocal() {
        this.mode = 'local';
        this.isHost = true;
        this.localPlayerId = 0;
        return Promise.resolve();
    }

    // Initialize as host
    async initAsHost(playerInfo) {
        this.mode = 'online';
        this.isHost = true;
        this.localPlayerId = 0;
        this.playerInfo = playerInfo;
        this.roomCode = this.generateRoomCode();

        return new Promise((resolve, reject) => {
            this.peer = new Peer(this.roomCode, { debug: 0 });

            this.peer.on('open', (id) => {
                console.log('Host ready:', id);
                resolve(this.roomCode);
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                if (err.type === 'unavailable-id') {
                    this.roomCode = this.generateRoomCode();
                    this.peer.destroy();
                    this.initAsHost(playerInfo).then(resolve).catch(reject);
                } else {
                    if (this.onConnectionError) {
                        this.onConnectionError(err.message || 'Connection error');
                    }
                    reject(err);
                }
            });

            setTimeout(() => {
                if (!this.peer || !this.peer.open) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    // Handle incoming connection (host only)
    handleIncomingConnection(conn) {
        if (this.connections.length >= this.maxPlayers - 1) {
            conn.close();
            return;
        }

        conn.on('open', () => {
            const playerId = this.connections.length + 1;
            const connData = {
                id: conn.peer,
                conn: conn,
                playerId: playerId,
                playerInfo: null
            };
            this.connections.push(connData);

            conn.send({ type: 'requestInfo' });

            conn.on('data', (data) => this.handleMessage(data, conn.peer));
            conn.on('close', () => this.handleDisconnection(conn.peer));
        });
    }

    // Initialize as guest
    async initAsGuest(roomCode, playerInfo) {
        this.mode = 'online';
        this.isHost = false;
        this.playerInfo = playerInfo;
        this.roomCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

        return new Promise((resolve, reject) => {
            this.peer = new Peer({ debug: 0 });

            this.peer.on('open', () => {
                const conn = this.peer.connect(this.roomCode, { reliable: true });

                conn.on('open', () => {
                    this.connections.push({
                        id: this.roomCode,
                        conn: conn,
                        playerId: 0,
                        isHost: true
                    });

                    conn.on('data', (data) => this.handleMessage(data, this.roomCode));
                    conn.on('close', () => this.handleDisconnection(this.roomCode));
                    resolve(true);
                });

                conn.on('error', (err) => {
                    if (this.onConnectionError) {
                        this.onConnectionError('Could not connect to room');
                    }
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                let errorMsg = 'Connection error';
                if (err.type === 'peer-unavailable') {
                    errorMsg = 'Room not found. Check the code and try again.';
                }
                if (this.onConnectionError) {
                    this.onConnectionError(errorMsg);
                }
                reject(new Error(errorMsg));
            });

            setTimeout(() => {
                if (this.connections.length === 0) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    // Handle messages
    handleMessage(data, fromPeerId) {
        switch (data.type) {
            case 'requestInfo':
                this.sendTo(fromPeerId, { type: 'playerInfo', info: this.playerInfo });
                break;

            case 'playerInfo':
                const conn = this.connections.find(c => c.id === fromPeerId);
                if (conn) {
                    conn.playerInfo = data.info;
                    if (this.onPlayerJoined) {
                        this.onPlayerJoined({ playerId: conn.playerId, playerInfo: data.info });
                    }
                }
                if (this.onConnectionReady) {
                    this.onConnectionReady(fromPeerId);
                }
                break;

            case 'gameState':
                if (this.onGameStateReceived) {
                    this.onGameStateReceived(data.state);
                }
                break;

            case 'assignPlayerId':
                this.localPlayerId = data.playerId;
                break;

            case 'gameStart':
                if (this.onGameStart) {
                    this.onGameStart(data.state);
                }
                break;

            case 'gameMessage':
                if (this.onMessage) {
                    this.onMessage(data.payload, data.playerId);
                }
                break;

            default:
                if (this.onMessage) {
                    this.onMessage(data, fromPeerId);
                }
        }
    }

    // Handle disconnection
    handleDisconnection(peerId) {
        const index = this.connections.findIndex(c => c.id === peerId);
        if (index !== -1) {
            const conn = this.connections[index];
            this.connections.splice(index, 1);
            if (this.onPlayerLeft) {
                this.onPlayerLeft(conn.playerId);
            }
        }
    }

    // Send to all
    broadcast(message) {
        for (const conn of this.connections) {
            if (conn.conn && conn.conn.open) {
                conn.conn.send(message);
            }
        }
    }

    // Send to specific peer
    sendTo(peerId, message) {
        const conn = this.connections.find(c => c.id === peerId);
        if (conn && conn.conn && conn.conn.open) {
            conn.conn.send(message);
        }
    }

    // Send game state (host)
    sendGameState(state) {
        if (!this.isHost) return;
        this.broadcast({ type: 'gameState', state });
    }

    // Send game message
    sendMessage(payload) {
        this.broadcast({
            type: 'gameMessage',
            payload,
            playerId: this.localPlayerId
        });
    }

    // Start game (host)
    startGame(state) {
        if (!this.isHost) return;
        this.connections.forEach((conn, i) => {
            conn.playerId = i + 1;
            this.sendTo(conn.id, { type: 'assignPlayerId', playerId: i + 1 });
        });
        this.broadcast({ type: 'gameStart', state });
    }

    // Getters
    isOnline() { return this.mode === 'online'; }
    getConnectedCount() { return this.connections.filter(c => c.conn && c.conn.open).length; }
    getConnectedPlayers() {
        return this.connections
            .filter(c => c.conn && c.conn.open && c.playerInfo)
            .map(c => ({ playerId: c.playerId, ...c.playerInfo }));
    }

    // Cleanup
    disconnect() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connections = [];
        this.mode = 'local';
        this.isHost = false;
        this.roomCode = null;
    }
}

// Export globally
window.GameMultiplayer = GameMultiplayer;
