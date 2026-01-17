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
        this.proximityPrecision = options.proximityPrecision || 4; // ~100m grid cells
        this.gameType = options.gameType || 'game';

        // Callbacks - set these after instantiation
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onGameStateReceived = null;
        this.onMessage = null;
        this.onConnectionReady = null;
        this.onConnectionError = null;
        this.onGameStart = null;
        this.onProximitySearching = null;
        this.onProximityFound = null;
        this.onProximityNotFound = null;
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

    // Get current geolocation
    async getLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                (error) => {
                    let msg = 'Location access denied';
                    if (error.code === 2) msg = 'Location unavailable';
                    if (error.code === 3) msg = 'Location timeout';
                    reject(new Error(msg));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    // Generate a proximity code from coordinates
    // Uses geohash-style encoding to group nearby locations
    generateProximityCode(lat, lng) {
        // Round to grid precision (~100m at precision 4)
        const precision = this.proximityPrecision;
        const latRounded = Math.round(lat * Math.pow(10, precision)) / Math.pow(10, precision);
        const lngRounded = Math.round(lng * Math.pow(10, precision)) / Math.pow(10, precision);

        // Create a deterministic code from coordinates
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const combined = `${latRounded},${lngRounded},${this.gameType}`;

        // Simple hash function
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        // Convert hash to a code
        let code = '';
        let absHash = Math.abs(hash);
        for (let i = 0; i < 12; i++) {
            code += chars[absHash % chars.length];
            absHash = Math.floor(absHash / chars.length) + (absHash % 17);
        }

        return code;
    }

    // Get all adjacent proximity codes (for boundary handling)
    getAdjacentProximityCodes(lat, lng) {
        const codes = [];
        const precision = this.proximityPrecision;
        const step = 1 / Math.pow(10, precision);

        // Generate codes for current position and 8 adjacent cells
        for (let dLat = -1; dLat <= 1; dLat++) {
            for (let dLng = -1; dLng <= 1; dLng++) {
                codes.push(this.generateProximityCode(
                    lat + (dLat * step),
                    lng + (dLng * step)
                ));
            }
        }

        return [...new Set(codes)]; // Remove duplicates
    }

    // Initialize proximity-based room finding
    async initProximity(playerInfo) {
        this.mode = 'online';
        this.playerInfo = playerInfo;

        if (this.onProximitySearching) {
            this.onProximitySearching();
        }

        try {
            const location = await this.getLocation();
            const primaryCode = this.generateProximityCode(location.lat, location.lng);
            const adjacentCodes = this.getAdjacentProximityCodes(location.lat, location.lng);

            // Try to join existing rooms first (check all adjacent cells)
            for (const code of adjacentCodes) {
                try {
                    const joined = await this.tryJoinRoom(code, playerInfo);
                    if (joined) {
                        if (this.onProximityFound) {
                            this.onProximityFound({ asHost: false });
                        }
                        return { success: true, isHost: false, roomCode: code };
                    }
                } catch (e) {
                    // Room doesn't exist or is full, continue checking
                }
            }

            // No existing room found, create one with the primary code
            const roomCode = await this.initAsHostWithCode(primaryCode, playerInfo);
            if (this.onProximityFound) {
                this.onProximityFound({ asHost: true });
            }
            return { success: true, isHost: true, roomCode: roomCode };

        } catch (error) {
            if (this.onProximityNotFound) {
                this.onProximityNotFound(error.message);
            }
            throw error;
        }
    }

    // Try to join an existing room (returns quickly if room doesn't exist)
    async tryJoinRoom(roomCode, playerInfo) {
        return new Promise((resolve, reject) => {
            const testPeer = new Peer({
                debug: 0,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            const timeout = setTimeout(() => {
                testPeer.destroy();
                reject(new Error('Timeout'));
            }, 3000);

            testPeer.on('open', () => {
                const conn = testPeer.connect(roomCode, { reliable: true });

                conn.on('open', () => {
                    clearTimeout(timeout);
                    // Successfully connected - transfer to main connection
                    testPeer.destroy();
                    // Now do the real connection
                    this.initAsGuest(roomCode, playerInfo).then(() => {
                        resolve(true);
                    }).catch(reject);
                });

                conn.on('error', () => {
                    clearTimeout(timeout);
                    testPeer.destroy();
                    reject(new Error('Connection failed'));
                });
            });

            testPeer.on('error', (err) => {
                clearTimeout(timeout);
                testPeer.destroy();
                reject(err);
            });
        });
    }

    // Initialize as host with a specific room code
    async initAsHostWithCode(roomCode, playerInfo) {
        this.mode = 'online';
        this.isHost = true;
        this.localPlayerId = 0;
        this.playerInfo = playerInfo;
        this.roomCode = roomCode;

        return new Promise((resolve, reject) => {
            let timeoutId = null;
            let settled = false;

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
            };

            const safeResolve = (value) => {
                if (!settled) {
                    settled = true;
                    cleanup();
                    resolve(value);
                }
            };

            const safeReject = (err) => {
                if (!settled) {
                    settled = true;
                    cleanup();
                    reject(err);
                }
            };

            this.peer = new Peer(this.roomCode, {
                debug: 0,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Host ready with proximity code:', id);
                safeResolve(this.roomCode);
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                if (err.type === 'unavailable-id') {
                    // Room already exists - try to join it instead
                    cleanup();
                    this.peer.destroy();
                    this.peer = null;
                    safeReject(new Error('Room exists'));
                } else {
                    if (this.onConnectionError) {
                        this.onConnectionError(err.message || 'Connection error');
                    }
                    safeReject(err);
                }
            });

            timeoutId = setTimeout(() => {
                if (!this.peer || !this.peer.open) {
                    safeReject(new Error('Connection timeout'));
                }
            }, 15000);
        });
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
            let timeoutId = null;
            let settled = false;

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
            };

            const safeResolve = (value) => {
                if (!settled) {
                    settled = true;
                    cleanup();
                    resolve(value);
                }
            };

            const safeReject = (err) => {
                if (!settled) {
                    settled = true;
                    cleanup();
                    reject(err);
                }
            };

            this.peer = new Peer(this.roomCode, {
                debug: 0,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Host ready:', id);
                safeResolve(this.roomCode);
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                if (err.type === 'unavailable-id') {
                    cleanup();
                    this.roomCode = this.generateRoomCode();
                    this.peer.destroy();
                    this.initAsHost(playerInfo).then(safeResolve).catch(safeReject);
                } else {
                    if (this.onConnectionError) {
                        this.onConnectionError(err.message || 'Connection error');
                    }
                    safeReject(err);
                }
            });

            timeoutId = setTimeout(() => {
                if (!this.peer || !this.peer.open) {
                    safeReject(new Error('Connection timeout'));
                }
            }, 15000);
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
            let timeoutId = null;
            let settled = false;

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
            };

            const safeResolve = (value) => {
                if (!settled) {
                    settled = true;
                    cleanup();
                    resolve(value);
                }
            };

            const safeReject = (err) => {
                if (!settled) {
                    settled = true;
                    cleanup();
                    reject(err);
                }
            };

            this.peer = new Peer({
                debug: 0,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

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
                    safeResolve(true);
                });

                conn.on('error', (err) => {
                    if (this.onConnectionError) {
                        this.onConnectionError('Could not connect to room');
                    }
                    safeReject(err);
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
                safeReject(new Error(errorMsg));
            });

            timeoutId = setTimeout(() => {
                if (this.connections.length === 0) {
                    safeReject(new Error('Connection timeout'));
                }
            }, 15000);
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
                    // Send acknowledgment back to guest so they know connection is ready
                    this.sendTo(fromPeerId, { type: 'connectionReady' });
                }
                if (this.onConnectionReady) {
                    this.onConnectionReady(fromPeerId);
                }
                break;

            case 'connectionReady':
                // Guest receives this after host confirms connection
                if (this.onConnectionReady) {
                    this.onConnectionReady(fromPeerId);
                }
                break;

            case 'gameState':
                // Process the game state locally
                if (this.onGameStateReceived) {
                    this.onGameStateReceived(data.state);
                }
                // If we're the host and received state from a guest, relay to other guests
                if (this.isHost && data.fromPlayerId !== undefined) {
                    this.relayGameState(data.state, fromPeerId);
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

    // Send game state (works for both host and guest)
    sendGameState(state) {
        if (this.isHost) {
            // Host broadcasts to all connected guests
            this.broadcast({ type: 'gameState', state });
        } else {
            // Guest sends to host (host will relay to other guests if needed)
            this.broadcast({
                type: 'gameState',
                state,
                fromPlayerId: this.localPlayerId
            });
        }
    }

    // Relay game state to all guests except the sender (host only)
    relayGameState(state, excludePeerId) {
        if (!this.isHost) return;
        for (const conn of this.connections) {
            if (conn.conn && conn.conn.open && conn.id !== excludePeerId) {
                conn.conn.send({ type: 'gameState', state });
            }
        }
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
