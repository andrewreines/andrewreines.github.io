/**
 * Integration tests - simulate actual room creation and joining flows
 */

// Enhanced mock that simulates full PeerJS behavior
var mockRooms = {}; // Simulates the signaling server's room registry

class IntegrationMockPeer {
    constructor(id, options) {
        this.id = id || 'peer_' + Math.random().toString(36).substr(2, 9);
        this.options = options;
        this._handlers = {};
        this._destroyed = false;
        this._connections = [];

        var self = this;

        // Simulate async connection to signaling server
        setTimeout(function() {
            if (self._destroyed) return;

            // Check if ID already taken
            if (self.id && mockRooms[self.id]) {
                if (self._handlers.error) {
                    self._handlers.error({ type: 'unavailable-id', message: 'ID is taken' });
                }
                return;
            }

            // Register this peer
            if (self.id) {
                mockRooms[self.id] = self;
            }

            if (self._handlers.open) {
                self._handlers.open(self.id);
            }
        }, 5);
    }

    on(event, handler) {
        this._handlers[event] = handler;
    }

    connect(peerId, options) {
        var self = this;
        var conn = new IntegrationMockConnection(this, peerId, options);
        this._connections.push(conn);

        // Simulate connection attempt
        setTimeout(function() {
            if (self._destroyed) return;

            var targetPeer = mockRooms[peerId];
            if (!targetPeer) {
                if (self._handlers.error) {
                    self._handlers.error({ type: 'peer-unavailable', message: 'Peer not found' });
                }
                return;
            }

            // Notify the target peer of incoming connection
            conn._targetPeer = targetPeer;
            conn._open = true;

            // Create the reverse connection on the host side
            var hostConn = new IntegrationMockConnection(targetPeer, self.id, { metadata: options.metadata });
            hostConn._remotePeer = conn;
            hostConn._open = true;
            conn._remotePeer = hostConn;

            // Notify host of incoming connection
            if (targetPeer._handlers.connection) {
                targetPeer._handlers.connection(hostConn);
            }
        }, 10);

        return conn;
    }

    destroy() {
        this._destroyed = true;
        if (this.id && mockRooms[this.id] === this) {
            delete mockRooms[this.id];
        }
        this._connections.forEach(function(conn) {
            conn.close();
        });
    }
}

class IntegrationMockConnection {
    constructor(localPeer, remotePeerId, options) {
        this.peer = remotePeerId;
        this.metadata = options?.metadata;
        this._handlers = {};
        this._open = false;
        this._localPeer = localPeer;
        this._remotePeer = null;
        this._closed = false;
    }

    on(event, handler) {
        this._handlers[event] = handler;

        // If already open and registering open handler, fire it
        if (event === 'open' && this._open && !this._closed) {
            var self = this;
            setTimeout(function() {
                if (self._handlers.open) self._handlers.open();
            }, 5);
        }
    }

    send(data) {
        if (this._closed || !this._remotePeer) return;

        var remote = this._remotePeer;
        setTimeout(function() {
            if (remote._handlers.data) {
                remote._handlers.data(data);
            }
        }, 5);
    }

    close() {
        if (this._closed) return;
        this._closed = true;
        this._open = false;

        var self = this;
        setTimeout(function() {
            if (self._handlers.close) self._handlers.close();
            if (self._remotePeer && self._remotePeer._handlers.close) {
                self._remotePeer._handlers.close();
            }
        }, 5);
    }
}

// Helper to wait for async operations
function wait(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

// Reset mock state between tests
function resetMockRooms() {
    mockRooms = {};
}

// Replace global Peer with integration mock for these tests
var OriginalPeer = global.Peer;
global.Peer = IntegrationMockPeer;

describe('Integration: Room Creation', function() {
    beforeEach(resetMockRooms);

    it('host can create room and receive room code', function(done) {
        var room = new MultiplayerRoom({
            playerName: 'Host',
            connectionTimeout: 1000
        });

        var roomCreated = false;
        room.onRoomCreated = function(code) {
            roomCreated = true;
            assert(code.length === 6, 'Room code should be 6 characters');
            assert(room.isConnected, 'Should be connected');
            assert(room.isHost, 'Should be host');
            assertEqual(room.getPlayerCount(), 1, 'Should have 1 player (host)');
        };

        room.onError = function(err) {
            throw new Error('Unexpected error: ' + err.message);
        };

        room.createRoom();

        setTimeout(function() {
            assert(roomCreated, 'onRoomCreated should have been called');
            room.disconnect();
        }, 50);
    });

    it('host appears in player list with correct info', function(done) {
        var room = new MultiplayerRoom({
            playerName: 'TestHost',
            playerData: { color: 'blue' }
        });

        room.onRoomCreated = function(code) {
            var me = room.getMyPlayer();
            assertEqual(me.name, 'TestHost');
            assertEqual(me.isHost, true);
            assertDeepEqual(me.data, { color: 'blue' });
        };

        room.createRoom();

        setTimeout(function() {
            room.disconnect();
        }, 50);
    });
});

describe('Integration: Room Joining', function() {
    beforeEach(resetMockRooms);

    it('guest can join existing room', function(done) {
        // Create host room first
        var hostRoom = new MultiplayerRoom({
            playerName: 'Host',
            maxPlayers: 5
        });

        var guestRoom = new MultiplayerRoom({
            playerName: 'Guest'
        });

        var hostSawGuest = false;
        var guestJoined = false;

        hostRoom.onRoomCreated = function(code) {
            // Now have guest join
            guestRoom.onJoinedRoom = function(roomCode, players) {
                guestJoined = true;
                assertEqual(roomCode, code);
                assert(Object.keys(players).length >= 1, 'Should see at least host in players');
            };

            guestRoom.joinRoom(code);
        };

        hostRoom.onPlayerJoined = function(player, allPlayers) {
            hostSawGuest = true;
            assertEqual(player.name, 'Guest');
            assertEqual(Object.keys(allPlayers).length, 2);
        };

        hostRoom.createRoom();

        setTimeout(function() {
            assert(guestJoined, 'Guest should have joined');
            assert(hostSawGuest, 'Host should have seen guest join');
            hostRoom.disconnect();
            guestRoom.disconnect();
        }, 100);
    });

    it('guest receives current game state on join', function(done) {
        var hostRoom = new MultiplayerRoom({ playerName: 'Host' });
        var guestRoom = new MultiplayerRoom({ playerName: 'Guest' });

        hostRoom.onRoomCreated = function(code) {
            // Set some game state before guest joins
            hostRoom.gameState = { level: 5, score: 100 };

            guestRoom.onJoinedRoom = function(roomCode, players) {
                // Guest should receive the game state
                assertDeepEqual(guestRoom.gameState, { level: 5, score: 100 });
            };

            guestRoom.joinRoom(code);
        };

        hostRoom.createRoom();

        setTimeout(function() {
            hostRoom.disconnect();
            guestRoom.disconnect();
        }, 100);
    });

    it('joining non-existent room triggers error', function(done) {
        var guestRoom = new MultiplayerRoom({
            playerName: 'Guest',
            connectionTimeout: 500
        });

        var errorReceived = false;
        guestRoom.onError = function(err) {
            errorReceived = true;
            assertEqual(err.type, 'room_not_found');
        };

        guestRoom.joinRoom('ZZZZZZ');

        setTimeout(function() {
            assert(errorReceived, 'Should have received error');
            guestRoom.disconnect();
        }, 100);
    });
});

describe('Integration: Messaging', function() {
    beforeEach(resetMockRooms);

    it('host can send message to guest', function(done) {
        var hostRoom = new MultiplayerRoom({ playerName: 'Host' });
        var guestRoom = new MultiplayerRoom({ playerName: 'Guest' });

        var guestReceivedMessage = false;

        hostRoom.onRoomCreated = function(code) {
            guestRoom.onJoinedRoom = function() {
                // Guest is connected, host sends message
                setTimeout(function() {
                    hostRoom.sendMessage('chat', { text: 'Hello guest!' });
                }, 20);
            };

            guestRoom.onMessage = function(type, data, fromPlayer) {
                guestReceivedMessage = true;
                assertEqual(type, 'chat');
                assertEqual(data.text, 'Hello guest!');
                assertEqual(fromPlayer.name, 'Host');
            };

            guestRoom.joinRoom(code);
        };

        hostRoom.createRoom();

        setTimeout(function() {
            assert(guestReceivedMessage, 'Guest should have received message');
            hostRoom.disconnect();
            guestRoom.disconnect();
        }, 150);
    });

    it('guest can send message to host', function(done) {
        var hostRoom = new MultiplayerRoom({ playerName: 'Host' });
        var guestRoom = new MultiplayerRoom({ playerName: 'Guest' });

        var hostReceivedMessage = false;

        hostRoom.onMessage = function(type, data, fromPlayer) {
            hostReceivedMessage = true;
            assertEqual(type, 'action');
            assertEqual(data.move, 'left');
            assertEqual(fromPlayer.name, 'Guest');
        };

        hostRoom.onRoomCreated = function(code) {
            guestRoom.onJoinedRoom = function() {
                setTimeout(function() {
                    guestRoom.sendMessage('action', { move: 'left' });
                }, 20);
            };

            guestRoom.joinRoom(code);
        };

        hostRoom.createRoom();

        setTimeout(function() {
            assert(hostReceivedMessage, 'Host should have received message');
            hostRoom.disconnect();
            guestRoom.disconnect();
        }, 150);
    });

    it('messages broadcast to all players', function(done) {
        var hostRoom = new MultiplayerRoom({ playerName: 'Host', maxPlayers: 5 });
        var guest1Room = new MultiplayerRoom({ playerName: 'Guest1' });
        var guest2Room = new MultiplayerRoom({ playerName: 'Guest2' });

        var guest1Received = false;
        var guest2Received = false;

        hostRoom.onRoomCreated = function(code) {
            var joinedCount = 0;

            function onBothJoined() {
                // Host broadcasts message
                setTimeout(function() {
                    hostRoom.sendMessage('announce', { msg: 'Hello all!' });
                }, 30);
            }

            guest1Room.onJoinedRoom = function() {
                joinedCount++;
                if (joinedCount === 2) onBothJoined();
            };

            guest2Room.onJoinedRoom = function() {
                joinedCount++;
                if (joinedCount === 2) onBothJoined();
            };

            guest1Room.onMessage = function(type, data) {
                if (type === 'announce') guest1Received = true;
            };

            guest2Room.onMessage = function(type, data) {
                if (type === 'announce') guest2Received = true;
            };

            guest1Room.joinRoom(code);
            setTimeout(function() {
                guest2Room.joinRoom(code);
            }, 30);
        };

        hostRoom.createRoom();

        setTimeout(function() {
            assert(guest1Received, 'Guest1 should have received broadcast');
            assert(guest2Received, 'Guest2 should have received broadcast');
            hostRoom.disconnect();
            guest1Room.disconnect();
            guest2Room.disconnect();
        }, 250);
    });
});

describe('Integration: State Sync', function() {
    beforeEach(resetMockRooms);

    it('state updates are received by all players', function(done) {
        var hostRoom = new MultiplayerRoom({ playerName: 'Host' });
        var guestRoom = new MultiplayerRoom({ playerName: 'Guest' });

        var guestReceivedState = false;

        hostRoom.onRoomCreated = function(code) {
            guestRoom.onJoinedRoom = function() {
                setTimeout(function() {
                    hostRoom.sendState({ board: [1, 2, 3], turn: 'X' });
                }, 20);
            };

            guestRoom.onStateUpdate = function(state, fromPlayer) {
                guestReceivedState = true;
                assertDeepEqual(state, { board: [1, 2, 3], turn: 'X' });
                assertEqual(fromPlayer.name, 'Host');
            };

            guestRoom.joinRoom(code);
        };

        hostRoom.createRoom();

        setTimeout(function() {
            assert(guestReceivedState, 'Guest should have received state');
            hostRoom.disconnect();
            guestRoom.disconnect();
        }, 150);
    });
});

describe('Integration: Player Disconnect', function() {
    beforeEach(resetMockRooms);

    it('host notified when guest leaves', function(done) {
        var hostRoom = new MultiplayerRoom({ playerName: 'Host' });
        var guestRoom = new MultiplayerRoom({ playerName: 'Guest' });

        var hostSawLeave = false;

        hostRoom.onPlayerLeft = function(player, allPlayers) {
            hostSawLeave = true;
            assertEqual(player.name, 'Guest');
            assertEqual(Object.keys(allPlayers).length, 1); // Just host left
        };

        hostRoom.onRoomCreated = function(code) {
            guestRoom.onJoinedRoom = function() {
                // Guest disconnects after short delay
                setTimeout(function() {
                    guestRoom.disconnect();
                }, 30);
            };

            guestRoom.joinRoom(code);
        };

        hostRoom.createRoom();

        setTimeout(function() {
            assert(hostSawLeave, 'Host should have seen guest leave');
            hostRoom.disconnect();
        }, 150);
    });

    it('guest notified when host closes room', function(done) {
        var hostRoom = new MultiplayerRoom({ playerName: 'Host' });
        var guestRoom = new MultiplayerRoom({ playerName: 'Guest' });

        var guestDisconnected = false;

        guestRoom.onDisconnected = function(reason) {
            guestDisconnected = true;
            // Reason could be 'host_disconnected' or 'host_closed'
            assert(reason.includes('host'), 'Reason should mention host');
        };

        hostRoom.onRoomCreated = function(code) {
            guestRoom.onJoinedRoom = function() {
                // Host closes after short delay
                setTimeout(function() {
                    hostRoom.disconnect();
                }, 30);
            };

            guestRoom.joinRoom(code);
        };

        hostRoom.createRoom();

        setTimeout(function() {
            assert(guestDisconnected, 'Guest should have been notified of disconnect');
            guestRoom.disconnect();
        }, 150);
    });
});

describe('Integration: Room Full', function() {
    beforeEach(resetMockRooms);

    it('joining full room triggers error', function(done) {
        var hostRoom = new MultiplayerRoom({ playerName: 'Host', maxPlayers: 2 });
        var guest1Room = new MultiplayerRoom({ playerName: 'Guest1' });
        var guest2Room = new MultiplayerRoom({ playerName: 'Guest2' });

        var guest2Error = false;

        hostRoom.onRoomCreated = function(code) {
            guest1Room.onJoinedRoom = function() {
                // Room now has 2 players (max), guest2 tries to join
                guest2Room.onError = function(err) {
                    guest2Error = true;
                    assertEqual(err.type, 'room_full');
                };

                setTimeout(function() {
                    guest2Room.joinRoom(code);
                }, 30);
            };

            guest1Room.joinRoom(code);
        };

        hostRoom.createRoom();

        setTimeout(function() {
            assert(guest2Error, 'Guest2 should have received room_full error');
            hostRoom.disconnect();
            guest1Room.disconnect();
            guest2Room.disconnect();
        }, 200);
    });
});

// Restore original Peer mock
global.Peer = OriginalPeer;

// Helper for beforeEach
function beforeEach(fn) {
    fn();
}
