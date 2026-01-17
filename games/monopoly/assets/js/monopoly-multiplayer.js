/**
 * Monopoly Multiplayer Module
 * Handles both local (hot-seat) and online (PeerJS) multiplayer
 * 100% frontend-only implementation using PeerJS for signaling
 */

const MonopolyMultiplayer = {
    // Connection state
    mode: 'local', // 'local' or 'online'
    isHost: false,
    peer: null,
    connections: [], // Array of peer connections
    localPlayerId: null,
    roomCode: null,

    // Callbacks
    onPlayerJoined: null,
    onPlayerLeft: null,
    onGameStateReceived: null,
    onActionReceived: null,
    onChatReceived: null,
    onConnectionError: null,
    onConnectionReady: null,

    // Initialize for local play
    initLocal() {
        this.mode = 'local';
        this.isHost = true;
        this.localPlayerId = 0;
        console.log('Multiplayer: Local mode initialized');
    },

    // Generate a 12-character room code
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 12; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    // Initialize as host for online play
    async initAsHost(playerInfo) {
        this.mode = 'online';
        this.isHost = true;
        this.localPlayerId = 0;
        this.roomCode = this.generateRoomCode();
        this.hostInfo = playerInfo;

        return new Promise((resolve, reject) => {
            // Create peer with the room code as ID
            this.peer = new Peer(this.roomCode, {
                debug: 1
            });

            this.peer.on('open', (id) => {
                console.log('Multiplayer: Host ready with room code:', id);
                resolve(this.roomCode);
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                if (err.type === 'unavailable-id') {
                    // Room code already taken, generate a new one
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

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.peer || !this.peer.open) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    },

    // Handle incoming connection (host)
    handleIncomingConnection(conn) {
        console.log('Incoming connection from:', conn.peer);

        conn.on('open', () => {
            const playerId = this.connections.length + 1;

            this.connections.push({
                id: conn.peer,
                conn: conn,
                playerId: playerId,
                playerInfo: null
            });

            // Request player info
            conn.send({
                type: 'requestInfo'
            });

            conn.on('data', (data) => {
                this.handleMessage(data, conn.peer);
            });

            conn.on('close', () => {
                this.handleDisconnection(conn.peer);
            });
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
        });
    },

    // Initialize as guest for online play
    async initAsGuest(roomCode, playerInfo) {
        this.mode = 'online';
        this.isHost = false;
        this.roomCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        this.guestInfo = playerInfo;

        return new Promise((resolve, reject) => {
            // Create peer with random ID
            this.peer = new Peer({
                debug: 1
            });

            this.peer.on('open', (id) => {
                console.log('Multiplayer: Guest peer created:', id);

                // Connect to host
                const conn = this.peer.connect(this.roomCode, {
                    reliable: true
                });

                conn.on('open', () => {
                    console.log('Connected to host');

                    this.connections.push({
                        id: this.roomCode,
                        conn: conn,
                        playerId: 0,
                        isHost: true
                    });

                    conn.on('data', (data) => {
                        this.handleMessage(data, this.roomCode);
                    });

                    conn.on('close', () => {
                        this.handleDisconnection(this.roomCode);
                    });

                    resolve(true);
                });

                conn.on('error', (err) => {
                    console.error('Connection error:', err);
                    if (this.onConnectionError) {
                        this.onConnectionError('Could not connect to room');
                    }
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                let errorMsg = 'Connection error';
                if (err.type === 'peer-unavailable') {
                    errorMsg = 'Room not found. Check the code and try again.';
                }
                if (this.onConnectionError) {
                    this.onConnectionError(errorMsg);
                }
                reject(new Error(errorMsg));
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.connections.length === 0) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    },

    // Handle incoming messages
    handleMessage(data, fromPeerId) {
        try {
            switch (data.type) {
                case 'requestInfo':
                    // Host is requesting our info
                    this.sendTo(fromPeerId, {
                        type: 'playerInfo',
                        info: this.guestInfo
                    });
                    break;

                case 'playerInfo':
                    // Update player info
                    const conn = this.connections.find(c => c.id === fromPeerId);
                    if (conn) {
                        conn.playerInfo = data.info;
                        if (this.onPlayerJoined) {
                            this.onPlayerJoined({
                                odlayerId: conn.playerId,
                                playerInfo: data.info
                            });
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

                case 'action':
                    if (this.onActionReceived) {
                        this.onActionReceived(data.action, data.playerId);
                    }
                    break;

                case 'chat':
                    if (this.onChatReceived) {
                        this.onChatReceived(data.text, data.playerId);
                    }
                    break;

                case 'assignPlayerId':
                    this.localPlayerId = data.playerId;
                    console.log('Assigned player ID:', this.localPlayerId);
                    break;

                case 'gameStart':
                    if (this.onGameStart) {
                        this.onGameStart(data.state);
                    }
                    break;

                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    },

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
    },

    // Send message to all connected peers
    broadcast(message) {
        for (const conn of this.connections) {
            if (conn.conn && conn.conn.open) {
                conn.conn.send(message);
            }
        }
    },

    // Send message to specific peer
    sendTo(peerId, message) {
        const conn = this.connections.find(c => c.id === peerId);
        if (conn && conn.conn && conn.conn.open) {
            conn.conn.send(message);
        }
    },

    // Send game state (host only)
    sendGameState(state) {
        if (!this.isHost) return;
        this.broadcast({
            type: 'gameState',
            state
        });
    },

    // Send action to host/all
    sendAction(action) {
        const message = {
            type: 'action',
            action,
            playerId: this.localPlayerId
        };

        this.broadcast(message);
    },

    // Send chat message
    sendChat(text) {
        this.broadcast({
            type: 'chat',
            text,
            playerId: this.localPlayerId
        });
    },

    // Assign player IDs to connected players (host only)
    assignPlayerIds() {
        if (!this.isHost) return;

        this.connections.forEach((conn, index) => {
            const playerId = index + 1;
            conn.playerId = playerId;
            this.sendTo(conn.id, {
                type: 'assignPlayerId',
                playerId: playerId
            });
        });
    },

    // Start the game (host only)
    startGame(state) {
        if (!this.isHost) return;

        this.assignPlayerIds();
        this.broadcast({
            type: 'gameStart',
            state
        });
    },

    // Check if we're in online mode
    isOnline() {
        return this.mode === 'online';
    },

    // Get connected player count
    getConnectedCount() {
        return this.connections.filter(c => c.conn && c.conn.open).length;
    },

    // Get all connected player info
    getConnectedPlayers() {
        return this.connections
            .filter(c => c.conn && c.conn.open && c.playerInfo)
            .map(c => ({
                playerId: c.playerId,
                ...c.playerInfo
            }));
    },

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
};

// Export for use in main game
window.MonopolyMultiplayer = MonopolyMultiplayer;
