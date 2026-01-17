/**
 * Multiplayer Framework - WebRTC-based peer-to-peer multiplayer
 * Uses PeerJS for signaling, supports room codes and state broadcasting
 */

(function(global) {
    'use strict';

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
     * MultiplayerRoom - Core multiplayer room management
     * @param {Object} options - Configuration options
     * @param {number} options.maxPlayers - Maximum players allowed (default: 10)
     * @param {string} options.playerName - This player's display name
     * @param {Object} options.playerData - Additional player data
     */
    function MultiplayerRoom(options) {
        options = options || {};

        this.maxPlayers = options.maxPlayers || 10;
        this.playerName = options.playerName || 'Player';
        this.playerData = options.playerData || {};

        this.roomCode = null;
        this.isHost = false;
        this.peer = null;
        this.playerId = generatePlayerId();

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

        // Event callbacks (override these)
        this.onRoomCreated = function(roomCode) {};
        this.onJoinedRoom = function(roomCode, players) {};
        this.onPlayerJoined = function(player, allPlayers) {};
        this.onPlayerLeft = function(player, allPlayers) {};
        this.onStateUpdate = function(state, fromPlayer) {};
        this.onMessage = function(type, data, fromPlayer) {};
        this.onError = function(error) {};
        this.onDisconnected = function(reason) {};
    }

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
        this.roomCode = generateRoomCode();

        // Create peer with room code as ID (prefixed to avoid collisions)
        var peerId = 'gr_' + this.roomCode;

        this.peer = new Peer(peerId, {
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', function(id) {
            self.isConnecting = false;
            self.isConnected = true;

            // Add self to players
            self.players[self.playerId] = {
                id: self.playerId,
                name: self.playerName,
                isHost: true,
                data: self.playerData
            };

            self.onRoomCreated(self.roomCode);
        });

        this.peer.on('connection', function(conn) {
            self._handleIncomingConnection(conn);
        });

        this.peer.on('error', function(err) {
            self._handlePeerError(err);
        });

        this.peer.on('disconnected', function() {
            if (self.isConnected) {
                self.isConnected = false;
                self.onDisconnected('peer_disconnected');
            }
        });
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
        this.peer = new Peer({
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

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
                self.isConnecting = false;
                self.isConnected = true;
            });

            self.hostConnection.on('data', function(data) {
                self._handleMessageFromHost(data);
            });

            self.hostConnection.on('close', function() {
                self.isConnected = false;
                self.onDisconnected('host_disconnected');
            });

            self.hostConnection.on('error', function(err) {
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
        var playerCount = Object.keys(this.players).length;

        conn.on('open', function() {
            // Check if room is full
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
                this.players = data.players;
                this.gameState = data.gameState;
                this.onJoinedRoom(data.roomCode, data.players);
                break;

            case 'room_full':
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
        this.isConnecting = false;

        var errorType = err.type || 'unknown';
        var message = err.message || 'Connection error';

        if (errorType === 'peer-unavailable') {
            message = 'Room not found';
            errorType = 'room_not_found';
        } else if (errorType === 'unavailable-id') {
            message = 'Room code already in use, try again';
            errorType = 'room_exists';
        }

        this.onError({ type: errorType, message: message });
    };

    /**
     * Send a game state update to all players
     * @param {Object} state - The new game state
     */
    MultiplayerRoom.prototype.sendState = function(state) {
        this.gameState = state;

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
     */
    MultiplayerRoom.prototype.disconnect = function() {
        var self = this;

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
    };

    // Export
    global.MultiplayerRoom = MultiplayerRoom;
    global.generateRoomCode = generateRoomCode;

})(typeof window !== 'undefined' ? window : this);
