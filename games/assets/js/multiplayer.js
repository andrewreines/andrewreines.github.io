/**
 * Multiplayer Framework - WebRTC-based peer-to-peer multiplayer
 * Uses PeerJS for signaling, supports room codes and state broadcasting
 */

(function(global) {
    'use strict';

    // Storage key for session persistence
    var STORAGE_KEY = 'multiplayer_session';

    // Generate a random 6-character alphanumeric code
    function generateRoomCode() {
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: I,O,0,1
        var code = '';
        for (var i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Generate unique player ID
    function generatePlayerId() {
        return 'p_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Session management - persist room data for reconnection
     */
    var Session = {
        save: function(data) {
            try {
                var session = {
                    roomCode: data.roomCode,
                    playerId: data.playerId,
                    playerName: data.playerName,
                    isHost: data.isHost,
                    gameState: data.gameState || {},
                    timestamp: Date.now()
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
            } catch (e) {
                console.warn('[Multiplayer] Failed to save session:', e);
            }
        },

        load: function() {
            try {
                var data = localStorage.getItem(STORAGE_KEY);
                if (!data) return null;

                var session = JSON.parse(data);
                // Session expires after 30 minutes
                var maxAge = 30 * 60 * 1000;
                if (Date.now() - session.timestamp > maxAge) {
                    Session.clear();
                    return null;
                }
                return session;
            } catch (e) {
                console.warn('[Multiplayer] Failed to load session:', e);
                return null;
            }
        },

        clear: function() {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (e) {}
        },

        exists: function() {
            return Session.load() !== null;
        }
    };

    /**
     * MultiplayerRoom - Core multiplayer room management
     * @param {Object} options - Configuration options
     * @param {number} options.maxPlayers - Maximum players allowed (default: 10)
     * @param {string} options.playerName - This player's display name
     * @param {Object} options.playerData - Additional player data
     * @param {number} options.connectionTimeout - Timeout in ms (default: 10000)
     * @param {boolean} options.persistSession - Save session for reconnection (default: true)
     * @param {number} options.reconnectDelay - Delay before host reclaim attempt (default: 2000)
     */
    function MultiplayerRoom(options) {
        options = options || {};

        this.maxPlayers = options.maxPlayers || 10;
        this.playerName = options.playerName || 'Player';
        this.playerData = options.playerData || {};
        this.connectionTimeout = options.connectionTimeout || 10000;
        this.persistSession = options.persistSession !== false;
        this.reconnectDelay = options.reconnectDelay || 2000;

        this.roomCode = null;
        this.isHost = false;
        this.peer = null;
        this.playerId = generatePlayerId();
        this.isReconnecting = false;

        // Host: map of peerId -> connection
        this.connections = {};
        // Host: map of peerId -> player info
        this.players = {};
        // Guest: connection to host
        this.hostConnection = null;

        // State
        this.gameState = {};
        this.isConnected = false;
        this.isConnecting = false;

        // Internal
        this._connectionTimer = null;
        this._createAttempts = 0;
        this._maxCreateAttempts = 3;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 3;

        // Event callbacks (override these)
        this.onRoomCreated = function(roomCode) {};
        this.onJoinedRoom = function(roomCode, players) {};
        this.onPlayerJoined = function(player, allPlayers) {};
        this.onPlayerLeft = function(player, allPlayers) {};
        this.onStateUpdate = function(state, fromPlayer) {};
        this.onMessage = function(type, data, fromPlayer) {};
        this.onError = function(error) {};
        this.onDisconnected = function(reason) {};
        this.onReconnecting = function(attempt, maxAttempts) {};
        this.onReconnected = function() {};
    }

    /**
     * Check if there's a saved session to reconnect to
     */
    MultiplayerRoom.prototype.hasSession = function() {
        return Session.exists();
    };

    /**
     * Get saved session data
     */
    MultiplayerRoom.prototype.getSession = function() {
        return Session.load();
    };

    /**
     * Clear saved session
     */
    MultiplayerRoom.prototype.clearSession = function() {
        Session.clear();
    };

    /**
     * Save current session
     */
    MultiplayerRoom.prototype._saveSession = function() {
        if (!this.persistSession) return;
        Session.save({
            roomCode: this.roomCode,
            playerId: this.playerId,
            playerName: this.playerName,
            isHost: this.isHost,
            gameState: this.gameState
        });
    };

    /**
     * Attempt to reconnect using saved session
     * @returns {boolean} true if reconnection was attempted, false if no session
     */
    MultiplayerRoom.prototype.reconnect = function() {
        var session = Session.load();
        if (!session) {
            return false;
        }

        // Restore session data
        this.playerId = session.playerId;
        this.playerName = session.playerName;
        this.gameState = session.gameState || {};
        this.isReconnecting = true;
        this._reconnectAttempts = 0;

        if (session.isHost) {
            this._reconnectAsHost(session.roomCode);
        } else {
            this._reconnectAsGuest(session.roomCode);
        }

        return true;
    };

    /**
     * Reconnect as host - reclaim the room
     */
    MultiplayerRoom.prototype._reconnectAsHost = function(roomCode) {
        var self = this;
        this._reconnectAttempts++;
        this.onReconnecting(this._reconnectAttempts, this._maxReconnectAttempts);

        console.log('[Multiplayer] Attempting to reclaim room:', roomCode, 'attempt:', this._reconnectAttempts);

        this.isConnecting = true;
        this.isHost = true;
        this.roomCode = roomCode;

        var peerId = 'gr_' + roomCode;

        try {
            this.peer = new Peer(peerId, {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });
        } catch (e) {
            this._handleReconnectError('peer_create_failed', e.message);
            return;
        }

        this._connectionTimer = setTimeout(function() {
            if (self.isConnecting) {
                self._clearConnection();
                self._handleReconnectError('timeout', 'Connection timed out');
            }
        }, this.connectionTimeout);

        this.peer.on('open', function(id) {
            console.log('[Multiplayer] Reclaimed room:', roomCode);
            self._clearTimer();
            self.isConnecting = false;
            self.isConnected = true;
            self.isReconnecting = false;
            self._reconnectAttempts = 0;

            // Add self to players
            self.players[self.playerId] = {
                id: self.playerId,
                name: self.playerName,
                isHost: true,
                data: self.playerData
            };

            self._saveSession();
            self.onReconnected();
            self.onRoomCreated(self.roomCode);
        });

        this.peer.on('connection', function(conn) {
            self._handleIncomingConnection(conn);
        });

        this.peer.on('error', function(err) {
            console.error('[Multiplayer] Reconnect error:', err);
            if (err.type === 'unavailable-id') {
                // Room ID still taken - wait and retry
                self._clearConnection();
                if (self._reconnectAttempts < self._maxReconnectAttempts) {
                    console.log('[Multiplayer] Room still occupied, retrying in', self.reconnectDelay, 'ms');
                    setTimeout(function() {
                        self._reconnectAsHost(roomCode);
                    }, self.reconnectDelay);
                } else {
                    self._handleReconnectError('reclaim_failed', 'Could not reclaim room. It may still be active.');
                }
            } else {
                self._handleReconnectError(err.type, err.message);
            }
        });

        this.peer.on('disconnected', function() {
            if (self.isConnected) {
                self.isConnected = false;
                self.onDisconnected('peer_disconnected');
            }
        });
    };

    /**
     * Reconnect as guest - rejoin the room
     */
    MultiplayerRoom.prototype._reconnectAsGuest = function(roomCode) {
        var self = this;
        this._reconnectAttempts++;
        this.onReconnecting(this._reconnectAttempts, this._maxReconnectAttempts);

        console.log('[Multiplayer] Attempting to rejoin room:', roomCode, 'attempt:', this._reconnectAttempts);

        // Use joinRoom but with the restored playerId
        this.isConnecting = true;
        this.isHost = false;
        this.roomCode = roomCode;

        try {
            this.peer = new Peer({
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });
        } catch (e) {
            this._handleReconnectError('peer_create_failed', e.message);
            return;
        }

        this._connectionTimer = setTimeout(function() {
            if (self.isConnecting) {
                self._clearConnection();
                if (self._reconnectAttempts < self._maxReconnectAttempts) {
                    setTimeout(function() {
                        self._reconnectAsGuest(roomCode);
                    }, self.reconnectDelay);
                } else {
                    self._handleReconnectError('timeout', 'Could not reconnect to room');
                }
            }
        }, this.connectionTimeout);

        this.peer.on('open', function(id) {
            var hostPeerId = 'gr_' + self.roomCode;
            self.hostConnection = self.peer.connect(hostPeerId, {
                reliable: true,
                metadata: {
                    playerId: self.playerId,
                    playerName: self.playerName,
                    playerData: self.playerData,
                    isReconnecting: true
                }
            });

            self.hostConnection.on('open', function() {
                // Wait for welcome message
            });

            self.hostConnection.on('data', function(data) {
                if (data.type === 'welcome') {
                    self._clearTimer();
                    self.isConnecting = false;
                    self.isConnected = true;
                    self.isReconnecting = false;
                    self._reconnectAttempts = 0;
                    self.players = data.players;
                    self.gameState = data.gameState;
                    self._saveSession();
                    self.onReconnected();
                    self.onJoinedRoom(data.roomCode, data.players);
                } else {
                    self._handleMessageFromHost(data);
                }
            });

            self.hostConnection.on('close', function() {
                self._clearTimer();
                if (self.isConnected) {
                    self.isConnected = false;
                    self.onDisconnected('host_disconnected');
                } else if (self.isReconnecting && self._reconnectAttempts < self._maxReconnectAttempts) {
                    // Host might be reconnecting too, retry
                    setTimeout(function() {
                        self._reconnectAsGuest(roomCode);
                    }, self.reconnectDelay);
                }
            });

            self.hostConnection.on('error', function(err) {
                self._clearTimer();
                if (self._reconnectAttempts < self._maxReconnectAttempts) {
                    setTimeout(function() {
                        self._reconnectAsGuest(roomCode);
                    }, self.reconnectDelay);
                } else {
                    self._handleReconnectError('connection_error', err.message || 'Connection failed');
                }
            });
        });

        this.peer.on('error', function(err) {
            console.error('[Multiplayer] Reconnect error:', err);
            if (err.type === 'peer-unavailable') {
                // Room doesn't exist yet (host might be reconnecting)
                self._clearConnection();
                if (self._reconnectAttempts < self._maxReconnectAttempts) {
                    setTimeout(function() {
                        self._reconnectAsGuest(roomCode);
                    }, self.reconnectDelay);
                } else {
                    self._handleReconnectError('room_not_found', 'Room no longer exists');
                }
            } else {
                self._handleReconnectError(err.type, err.message);
            }
        });
    };

    /**
     * Handle reconnection error
     */
    MultiplayerRoom.prototype._handleReconnectError = function(type, message) {
        this.isConnecting = false;
        this.isReconnecting = false;
        Session.clear();
        this.onError({ type: type, message: message, isReconnectError: true });
    };

    /**
     * Create a new room as host
     */
    MultiplayerRoom.prototype.createRoom = function() {
        var self = this;

        if (this.isConnecting || this.isConnected) {
            this.onError({ type: 'already_connected', message: 'Already in a room' });
            return;
        }

        this.isConnecting = true;
        this.isHost = true;
        this._createAttempts++;
        this.roomCode = generateRoomCode();

        // Create peer with room code as ID (prefixed to avoid collisions)
        var peerId = 'gr_' + this.roomCode;

        try {
            this.peer = new Peer(peerId, {
                debug: 1, // Enable debug logging
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });
        } catch (e) {
            this.isConnecting = false;
            this.onError({ type: 'peer_create_failed', message: 'Failed to create connection: ' + e.message });
            return;
        }

        // Set connection timeout
        this._connectionTimer = setTimeout(function() {
            if (self.isConnecting) {
                console.warn('[Multiplayer] Connection timeout - no response from signaling server');
                self._clearConnection();
                self.onError({ type: 'timeout', message: 'Connection timed out. Please try again.' });
            }
        }, this.connectionTimeout);

        this.peer.on('open', function(id) {
            console.log('[Multiplayer] Connected to signaling server, room:', self.roomCode);
            self._clearTimer();
            self.isConnecting = false;
            self.isConnected = true;

            // Add self to players
            self.players[self.playerId] = {
                id: self.playerId,
                name: self.playerName,
                isHost: true,
                data: self.playerData
            };

            self._saveSession();
            self.onRoomCreated(self.roomCode);
        });

        this.peer.on('connection', function(conn) {
            self._handleIncomingConnection(conn);
        });

        this.peer.on('error', function(err) {
            console.error('[Multiplayer] Peer error:', err);
            self._handlePeerError(err);
        });

        this.peer.on('disconnected', function() {
            console.warn('[Multiplayer] Disconnected from signaling server');
            if (self.isConnected) {
                self.isConnected = false;
                self.onDisconnected('peer_disconnected');
            }
        });
    };

    /**
     * Clear connection timeout timer
     */
    MultiplayerRoom.prototype._clearTimer = function() {
        if (this._connectionTimer) {
            clearTimeout(this._connectionTimer);
            this._connectionTimer = null;
        }
    };

    /**
     * Clear connection state without triggering callbacks
     */
    MultiplayerRoom.prototype._clearConnection = function() {
        this._clearTimer();
        this.isConnecting = false;
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
            this.peer = null;
        }
    };

    /**
     * Join an existing room
     * @param {string} roomCode - 6-character room code
     */
    MultiplayerRoom.prototype.joinRoom = function(roomCode) {
        var self = this;

        if (this.isConnecting || this.isConnected) {
            this.onError({ type: 'already_connected', message: 'Already in a room' });
            return;
        }

        this.isConnecting = true;
        this.isHost = false;
        this.roomCode = roomCode.toUpperCase();

        // Create peer with random ID
        try {
            this.peer = new Peer({
                debug: 1, // Enable debug logging
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });
        } catch (e) {
            this.isConnecting = false;
            this.onError({ type: 'peer_create_failed', message: 'Failed to create connection: ' + e.message });
            return;
        }

        // Set connection timeout
        this._connectionTimer = setTimeout(function() {
            if (self.isConnecting) {
                self._clearConnection();
                self.onError({ type: 'timeout', message: 'Connection timed out. Room may not exist.' });
            }
        }, this.connectionTimeout);

        this.peer.on('open', function(id) {
            // Connect to host
            var hostPeerId = 'gr_' + self.roomCode;
            self.hostConnection = self.peer.connect(hostPeerId, {
                reliable: true,
                metadata: {
                    playerId: self.playerId,
                    playerName: self.playerName,
                    playerData: self.playerData
                }
            });

            self.hostConnection.on('open', function() {
                // Don't clear timer yet - wait for welcome message
            });

            self.hostConnection.on('data', function(data) {
                self._handleMessageFromHost(data);
            });

            self.hostConnection.on('close', function() {
                self._clearTimer();
                if (self.isConnected) {
                    self.isConnected = false;
                    self.onDisconnected('host_disconnected');
                }
            });

            self.hostConnection.on('error', function(err) {
                self._clearTimer();
                self.onError({ type: 'connection_error', message: err.message || 'Connection failed' });
            });
        });

        this.peer.on('error', function(err) {
            self._handlePeerError(err);
        });
    };

    /**
     * Host: Handle incoming connection from a guest
     */
    MultiplayerRoom.prototype._handleIncomingConnection = function(conn) {
        var self = this;

        conn.on('open', function() {
            // Check if room is full (get current count at time of connection)
            var playerCount = Object.keys(self.players).length;
            if (playerCount >= self.maxPlayers) {
                conn.send({ type: 'room_full' });
                setTimeout(function() { conn.close(); }, 100);
                return;
            }

            var metadata = conn.metadata || {};
            var playerId = metadata.playerId || generatePlayerId();
            var playerName = metadata.playerName || 'Guest';
            var playerData = metadata.playerData || {};

            // Store connection and player info
            self.connections[playerId] = conn;
            self.players[playerId] = {
                id: playerId,
                name: playerName,
                isHost: false,
                data: playerData
            };

            // Send welcome message with current state
            conn.send({
                type: 'welcome',
                playerId: playerId,
                players: self.players,
                gameState: self.gameState,
                roomCode: self.roomCode
            });

            // Broadcast new player to all others
            self._broadcastToOthers(playerId, {
                type: 'player_joined',
                player: self.players[playerId],
                players: self.players
            });

            self.onPlayerJoined(self.players[playerId], self.players);

            // Handle messages from this guest
            conn.on('data', function(data) {
                self._handleMessageFromGuest(playerId, data);
            });

            conn.on('close', function() {
                self._handleGuestDisconnect(playerId);
            });
        });
    };

    /**
     * Host: Handle message from a guest
     */
    MultiplayerRoom.prototype._handleMessageFromGuest = function(playerId, data) {
        if (!data || !data.type) return;

        var player = this.players[playerId];

        switch (data.type) {
            case 'state_update':
                this.gameState = data.state;
                // Broadcast to all other players
                this._broadcastToOthers(playerId, {
                    type: 'state_update',
                    state: data.state,
                    fromPlayer: player
                });
                this.onStateUpdate(data.state, player);
                break;

            case 'message':
                // Broadcast custom message to all
                this._broadcastToOthers(playerId, {
                    type: 'message',
                    messageType: data.messageType,
                    data: data.data,
                    fromPlayer: player
                });
                this.onMessage(data.messageType, data.data, player);
                break;

            case 'broadcast':
                // Broadcast to everyone including sender
                this._broadcastToAll({
                    type: 'message',
                    messageType: data.messageType,
                    data: data.data,
                    fromPlayer: player
                });
                this.onMessage(data.messageType, data.data, player);
                break;
        }
    };

    /**
     * Guest: Handle message from host
     */
    MultiplayerRoom.prototype._handleMessageFromHost = function(data) {
        if (!data || !data.type) return;

        switch (data.type) {
            case 'welcome':
                this._clearTimer();
                this.isConnecting = false;
                this.isConnected = true;
                this.players = data.players;
                this.gameState = data.gameState;
                this._saveSession();
                this.onJoinedRoom(data.roomCode, data.players);
                break;

            case 'room_full':
                this._clearTimer();
                this.isConnecting = false;
                this.onError({ type: 'room_full', message: 'Room is full' });
                this.disconnect();
                break;

            case 'player_joined':
                this.players = data.players;
                this.onPlayerJoined(data.player, data.players);
                break;

            case 'player_left':
                this.players = data.players;
                this.onPlayerLeft(data.player, data.players);
                break;

            case 'state_update':
                this.gameState = data.state;
                this.onStateUpdate(data.state, data.fromPlayer);
                break;

            case 'message':
                this.onMessage(data.messageType, data.data, data.fromPlayer);
                break;

            case 'host_closing':
                this.onDisconnected('host_closed');
                this.disconnect();
                break;
        }
    };

    /**
     * Host: Handle guest disconnect
     */
    MultiplayerRoom.prototype._handleGuestDisconnect = function(playerId) {
        var player = this.players[playerId];

        delete this.connections[playerId];
        delete this.players[playerId];

        // Notify others
        this._broadcastToAll({
            type: 'player_left',
            player: player,
            players: this.players
        });

        this.onPlayerLeft(player, this.players);
    };

    /**
     * Host: Broadcast message to all guests except one
     */
    MultiplayerRoom.prototype._broadcastToOthers = function(excludePlayerId, data) {
        var self = this;
        Object.keys(this.connections).forEach(function(playerId) {
            if (playerId !== excludePlayerId && self.connections[playerId]) {
                try {
                    self.connections[playerId].send(data);
                } catch (e) {
                    console.warn('Failed to send to', playerId, e);
                }
            }
        });
    };

    /**
     * Host: Broadcast message to all guests
     */
    MultiplayerRoom.prototype._broadcastToAll = function(data) {
        var self = this;
        Object.keys(this.connections).forEach(function(playerId) {
            if (self.connections[playerId]) {
                try {
                    self.connections[playerId].send(data);
                } catch (e) {
                    console.warn('Failed to send to', playerId, e);
                }
            }
        });
    };

    /**
     * Handle PeerJS errors
     */
    MultiplayerRoom.prototype._handlePeerError = function(err) {
        this._clearTimer();

        var errorType = err.type || 'unknown';
        var message = err.message || 'Connection error';

        if (errorType === 'peer-unavailable') {
            message = 'Room not found';
            errorType = 'room_not_found';
            this.isConnecting = false;
            this.onError({ type: errorType, message: message });
        } else if (errorType === 'unavailable-id') {
            // Room code collision - auto-retry if we haven't exceeded attempts
            if (this.isHost && this._createAttempts < this._maxCreateAttempts) {
                this._clearConnection();
                this.createRoom(); // Try again with new code
                return;
            }
            message = 'Failed to create room. Please try again.';
            errorType = 'room_create_failed';
            this.isConnecting = false;
            this.onError({ type: errorType, message: message });
        } else {
            this.isConnecting = false;
            this.onError({ type: errorType, message: message });
        }
    };

    /**
     * Send a game state update to all players
     * @param {Object} state - The new game state
     */
    MultiplayerRoom.prototype.sendState = function(state) {
        this.gameState = state;
        this._saveSession(); // Persist updated state

        if (this.isHost) {
            // Broadcast to all guests
            this._broadcastToAll({
                type: 'state_update',
                state: state,
                fromPlayer: this.players[this.playerId]
            });
            this.onStateUpdate(state, this.players[this.playerId]);
        } else if (this.hostConnection) {
            // Send to host for relay
            this.hostConnection.send({
                type: 'state_update',
                state: state
            });
        }
    };

    /**
     * Send a custom message to all players
     * @param {string} messageType - Type identifier for the message
     * @param {*} data - Message payload
     */
    MultiplayerRoom.prototype.sendMessage = function(messageType, data) {
        var message = {
            type: 'broadcast',
            messageType: messageType,
            data: data
        };

        if (this.isHost) {
            // Handle locally and broadcast
            this._broadcastToAll({
                type: 'message',
                messageType: messageType,
                data: data,
                fromPlayer: this.players[this.playerId]
            });
            this.onMessage(messageType, data, this.players[this.playerId]);
        } else if (this.hostConnection) {
            this.hostConnection.send(message);
        }
    };

    /**
     * Get current player info
     */
    MultiplayerRoom.prototype.getMyPlayer = function() {
        return this.players[this.playerId];
    };

    /**
     * Get all players
     */
    MultiplayerRoom.prototype.getPlayers = function() {
        return this.players;
    };

    /**
     * Get player count
     */
    MultiplayerRoom.prototype.getPlayerCount = function() {
        return Object.keys(this.players).length;
    };

    /**
     * Disconnect and clean up
     * @param {Object} options - Disconnect options
     * @param {boolean} options.clearSession - Clear saved session (default: true)
     */
    MultiplayerRoom.prototype.disconnect = function(options) {
        var self = this;
        options = options || {};
        var shouldClearSession = options.clearSession !== false;

        this._clearTimer();

        if (this.isHost) {
            // Notify all guests
            this._broadcastToAll({ type: 'host_closing' });

            // Close all connections
            Object.keys(this.connections).forEach(function(playerId) {
                try {
                    self.connections[playerId].close();
                } catch (e) {}
            });
        } else if (this.hostConnection) {
            try {
                this.hostConnection.close();
            } catch (e) {}
        }

        if (this.peer) {
            try {
                this.peer.destroy();
            } catch (e) {}
        }

        this.isConnected = false;
        this.isConnecting = false;
        this.connections = {};
        this.players = {};
        this.hostConnection = null;
        this.peer = null;
        this._createAttempts = 0;

        if (shouldClearSession) {
            Session.clear();
        }
    };

    // Export
    global.MultiplayerRoom = MultiplayerRoom;
    global.MultiplayerSession = Session;
    global.generateRoomCode = generateRoomCode;

})(typeof window !== 'undefined' ? window : this);
