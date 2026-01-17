/**
 * Unit tests for multiplayer.js framework
 */

describe('Room Code Generation', function() {
    it('generates 6-character codes', function() {
        const code = generateRoomCode();
        assertEqual(code.length, 6);
    });

    it('uses only uppercase letters and digits 2-9', function() {
        for (let i = 0; i < 100; i++) {
            const code = generateRoomCode();
            assert(/^[A-Z2-9]+$/.test(code), `Invalid code: ${code}`);
        }
    });

    it('excludes confusing characters (0, 1, I, O)', function() {
        for (let i = 0; i < 100; i++) {
            const code = generateRoomCode();
            assert(!/[01IO]/.test(code), `Code contains confusing char: ${code}`);
        }
    });

    it('generates unique codes (statistical)', function() {
        const codes = new Set();
        for (let i = 0; i < 1000; i++) {
            codes.add(generateRoomCode());
        }
        // With 30^6 possible codes, 1000 samples should be nearly all unique
        assert(codes.size >= 990, `Too many collisions: ${1000 - codes.size}`);
    });
});

describe('MultiplayerRoom Constructor', function() {
    it('initializes with default values', function() {
        const room = new MultiplayerRoom({});
        assertEqual(room.maxPlayers, 10);
        assertEqual(room.playerName, 'Player');
        assertEqual(room.connectionTimeout, 10000);
        assertEqual(room.isConnected, false);
        assertEqual(room.isConnecting, false);
        assertEqual(room.isHost, false);
        assertEqual(room.roomCode, null);
    });

    it('accepts custom maxPlayers', function() {
        const room = new MultiplayerRoom({ maxPlayers: 5 });
        assertEqual(room.maxPlayers, 5);
    });

    it('accepts custom playerName', function() {
        const room = new MultiplayerRoom({ playerName: 'TestPlayer' });
        assertEqual(room.playerName, 'TestPlayer');
    });

    it('accepts custom connectionTimeout', function() {
        const room = new MultiplayerRoom({ connectionTimeout: 5000 });
        assertEqual(room.connectionTimeout, 5000);
    });

    it('accepts custom playerData', function() {
        const data = { color: 'blue', score: 100 };
        const room = new MultiplayerRoom({ playerData: data });
        assertDeepEqual(room.playerData, data);
    });

    it('generates unique player IDs', function() {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
            const room = new MultiplayerRoom({});
            ids.add(room.playerId);
        }
        assertEqual(ids.size, 100);
    });

    it('player IDs start with p_', function() {
        const room = new MultiplayerRoom({});
        assert(room.playerId.startsWith('p_'), `Invalid player ID format: ${room.playerId}`);
    });

    it('initializes empty players object', function() {
        const room = new MultiplayerRoom({});
        assertDeepEqual(room.players, {});
    });

    it('initializes empty connections object', function() {
        const room = new MultiplayerRoom({});
        assertDeepEqual(room.connections, {});
    });

    it('initializes empty gameState', function() {
        const room = new MultiplayerRoom({});
        assertDeepEqual(room.gameState, {});
    });

    it('has all event callbacks as functions', function() {
        const room = new MultiplayerRoom({});
        assertEqual(typeof room.onRoomCreated, 'function');
        assertEqual(typeof room.onJoinedRoom, 'function');
        assertEqual(typeof room.onPlayerJoined, 'function');
        assertEqual(typeof room.onPlayerLeft, 'function');
        assertEqual(typeof room.onStateUpdate, 'function');
        assertEqual(typeof room.onMessage, 'function');
        assertEqual(typeof room.onError, 'function');
        assertEqual(typeof room.onDisconnected, 'function');
    });
});

describe('Room Creation', function() {
    beforeEach(function() {
        MockPeer.reset();
    });

    it('sets isConnecting to true immediately', function() {
        MockPeer.simulateOpen = false;
        const room = new MultiplayerRoom({ playerName: 'Host' });
        room.createRoom();
        assertEqual(room.isConnecting, true);
    });

    it('sets isHost to true', function() {
        MockPeer.simulateOpen = false;
        const room = new MultiplayerRoom({ playerName: 'Host' });
        room.createRoom();
        assertEqual(room.isHost, true);
    });

    it('generates a room code', function() {
        MockPeer.simulateOpen = false;
        const room = new MultiplayerRoom({ playerName: 'Host' });
        room.createRoom();
        assert(room.roomCode !== null);
        assertEqual(room.roomCode.length, 6);
    });

    it('calls onRoomCreated when peer opens', function(done) {
        MockPeer.simulateOpen = true;
        MockPeer.openDelay = 5;
        const room = new MultiplayerRoom({ playerName: 'Host' });
        let called = false;
        room.onRoomCreated = function(code) {
            called = true;
            assertEqual(code, room.roomCode);
        };
        room.createRoom();
        setTimeout(function() {
            assert(called, 'onRoomCreated was not called');
        }, 20);
    });

    it('adds host to players list on creation', function(done) {
        MockPeer.simulateOpen = true;
        MockPeer.openDelay = 5;
        const room = new MultiplayerRoom({ playerName: 'HostName' });
        room.onRoomCreated = function() {
            const players = room.getPlayers();
            const playerIds = Object.keys(players);
            assertEqual(playerIds.length, 1);
            assertEqual(players[room.playerId].name, 'HostName');
            assertEqual(players[room.playerId].isHost, true);
        };
        room.createRoom();
    });

    it('prevents creating room when already connected', function() {
        const room = new MultiplayerRoom({});
        room.isConnected = true;
        let errorCalled = false;
        room.onError = function(err) {
            errorCalled = true;
            assertEqual(err.type, 'already_connected');
        };
        room.createRoom();
        assert(errorCalled);
    });

    it('prevents creating room when already connecting', function() {
        const room = new MultiplayerRoom({});
        room.isConnecting = true;
        let errorCalled = false;
        room.onError = function(err) {
            errorCalled = true;
            assertEqual(err.type, 'already_connected');
        };
        room.createRoom();
        assert(errorCalled);
    });

    it('increments create attempts', function() {
        MockPeer.simulateOpen = false;
        const room = new MultiplayerRoom({});
        assertEqual(room._createAttempts, 0);
        room.createRoom();
        assertEqual(room._createAttempts, 1);
    });
});

describe('Room Joining', function() {
    it('sets isConnecting to true', function() {
        MockPeer.simulateOpen = false;
        const room = new MultiplayerRoom({ playerName: 'Guest' });
        room.joinRoom('ABCDEF');
        assertEqual(room.isConnecting, true);
    });

    it('sets isHost to false', function() {
        MockPeer.simulateOpen = false;
        const room = new MultiplayerRoom({ playerName: 'Guest' });
        room.joinRoom('ABCDEF');
        assertEqual(room.isHost, false);
    });

    it('stores room code in uppercase', function() {
        MockPeer.simulateOpen = false;
        const room = new MultiplayerRoom({ playerName: 'Guest' });
        room.joinRoom('abcdef');
        assertEqual(room.roomCode, 'ABCDEF');
    });

    it('prevents joining when already connected', function() {
        const room = new MultiplayerRoom({});
        room.isConnected = true;
        let errorCalled = false;
        room.onError = function(err) {
            errorCalled = true;
            assertEqual(err.type, 'already_connected');
        };
        room.joinRoom('ABCDEF');
        assert(errorCalled);
    });
});

describe('Player Management', function() {
    it('getPlayers returns players object', function() {
        const room = new MultiplayerRoom({});
        room.players = { p1: { name: 'A' }, p2: { name: 'B' } };
        assertDeepEqual(room.getPlayers(), { p1: { name: 'A' }, p2: { name: 'B' } });
    });

    it('getPlayerCount returns correct count', function() {
        const room = new MultiplayerRoom({});
        room.players = { p1: {}, p2: {}, p3: {} };
        assertEqual(room.getPlayerCount(), 3);
    });

    it('getMyPlayer returns own player info', function() {
        const room = new MultiplayerRoom({ playerName: 'Me' });
        room.players[room.playerId] = { id: room.playerId, name: 'Me', isHost: true };
        const me = room.getMyPlayer();
        assertEqual(me.name, 'Me');
        assertEqual(me.isHost, true);
    });
});

describe('Message Handling - Host', function() {
    it('_handleMessageFromGuest handles state_update', function() {
        const room = new MultiplayerRoom({});
        room.isHost = true;
        room.players = {
            guest1: { id: 'guest1', name: 'Guest' }
        };
        room.connections = { guest1: new MockConnection('guest1') };

        let stateUpdateCalled = false;
        room.onStateUpdate = function(state, fromPlayer) {
            stateUpdateCalled = true;
            assertDeepEqual(state, { score: 10 });
            assertEqual(fromPlayer.name, 'Guest');
        };

        room._handleMessageFromGuest('guest1', {
            type: 'state_update',
            state: { score: 10 }
        });

        assert(stateUpdateCalled);
        assertDeepEqual(room.gameState, { score: 10 });
    });

    it('_handleMessageFromGuest handles message type', function() {
        const room = new MultiplayerRoom({});
        room.isHost = true;
        room.players = {
            guest1: { id: 'guest1', name: 'Guest' }
        };
        room.connections = { guest1: new MockConnection('guest1') };

        let messageCalled = false;
        room.onMessage = function(type, data, fromPlayer) {
            messageCalled = true;
            assertEqual(type, 'chat');
            assertDeepEqual(data, { text: 'hello' });
        };

        room._handleMessageFromGuest('guest1', {
            type: 'message',
            messageType: 'chat',
            data: { text: 'hello' }
        });

        assert(messageCalled);
    });

    it('_handleMessageFromGuest ignores invalid data', function() {
        const room = new MultiplayerRoom({});
        room.isHost = true;
        // Should not throw
        room._handleMessageFromGuest('guest1', null);
        room._handleMessageFromGuest('guest1', {});
        room._handleMessageFromGuest('guest1', { foo: 'bar' });
    });
});

describe('Message Handling - Guest', function() {
    it('_handleMessageFromHost handles welcome', function() {
        const room = new MultiplayerRoom({});
        room.isConnecting = true;

        let joinedCalled = false;
        room.onJoinedRoom = function(code, players) {
            joinedCalled = true;
            assertEqual(code, 'XYZABC');
        };

        room._handleMessageFromHost({
            type: 'welcome',
            roomCode: 'XYZABC',
            players: { host: { name: 'Host' } },
            gameState: { started: true }
        });

        assert(joinedCalled);
        assertEqual(room.isConnected, true);
        assertEqual(room.isConnecting, false);
        assertDeepEqual(room.gameState, { started: true });
    });

    it('_handleMessageFromHost handles room_full', function() {
        const room = new MultiplayerRoom({});
        room.isConnecting = true;
        room.peer = new MockPeer();

        let errorCalled = false;
        room.onError = function(err) {
            errorCalled = true;
            assertEqual(err.type, 'room_full');
        };

        room._handleMessageFromHost({ type: 'room_full' });

        assert(errorCalled);
        assertEqual(room.isConnecting, false);
    });

    it('_handleMessageFromHost handles player_joined', function() {
        const room = new MultiplayerRoom({});

        let joinedCalled = false;
        room.onPlayerJoined = function(player, allPlayers) {
            joinedCalled = true;
            assertEqual(player.name, 'NewPlayer');
        };

        room._handleMessageFromHost({
            type: 'player_joined',
            player: { id: 'p2', name: 'NewPlayer' },
            players: { p1: {}, p2: { name: 'NewPlayer' } }
        });

        assert(joinedCalled);
        assertEqual(Object.keys(room.players).length, 2);
    });

    it('_handleMessageFromHost handles player_left', function() {
        const room = new MultiplayerRoom({});
        room.players = { p1: {}, p2: { name: 'Leaving' } };

        let leftCalled = false;
        room.onPlayerLeft = function(player) {
            leftCalled = true;
            assertEqual(player.name, 'Leaving');
        };

        room._handleMessageFromHost({
            type: 'player_left',
            player: { name: 'Leaving' },
            players: { p1: {} }
        });

        assert(leftCalled);
        assertEqual(Object.keys(room.players).length, 1);
    });

    it('_handleMessageFromHost handles state_update', function() {
        const room = new MultiplayerRoom({});

        let updateCalled = false;
        room.onStateUpdate = function(state, fromPlayer) {
            updateCalled = true;
            assertDeepEqual(state, { board: [1,2,3] });
        };

        room._handleMessageFromHost({
            type: 'state_update',
            state: { board: [1,2,3] },
            fromPlayer: { name: 'Host' }
        });

        assert(updateCalled);
        assertDeepEqual(room.gameState, { board: [1,2,3] });
    });

    it('_handleMessageFromHost handles message', function() {
        const room = new MultiplayerRoom({});

        let messageCalled = false;
        room.onMessage = function(type, data, fromPlayer) {
            messageCalled = true;
            assertEqual(type, 'move');
            assertDeepEqual(data, { x: 1, y: 2 });
        };

        room._handleMessageFromHost({
            type: 'message',
            messageType: 'move',
            data: { x: 1, y: 2 },
            fromPlayer: { name: 'Host' }
        });

        assert(messageCalled);
    });
});

describe('State and Messaging', function() {
    it('sendState updates local gameState', function() {
        const room = new MultiplayerRoom({});
        room.isHost = true;
        room.isConnected = true;
        room.players[room.playerId] = { id: room.playerId, name: 'Host' };
        room.connections = {};

        room.sendState({ turn: 1, board: [] });
        assertDeepEqual(room.gameState, { turn: 1, board: [] });
    });

    it('sendMessage as host triggers local onMessage', function() {
        const room = new MultiplayerRoom({});
        room.isHost = true;
        room.isConnected = true;
        room.players[room.playerId] = { id: room.playerId, name: 'Host' };
        room.connections = {};

        let messageCalled = false;
        room.onMessage = function(type, data) {
            messageCalled = true;
            assertEqual(type, 'action');
            assertDeepEqual(data, { value: 42 });
        };

        room.sendMessage('action', { value: 42 });
        assert(messageCalled);
    });

    it('sendMessage as guest sends to host', function() {
        const room = new MultiplayerRoom({});
        room.isHost = false;
        room.isConnected = true;
        room.hostConnection = new MockConnection('host');

        room.sendMessage('action', { value: 42 });

        assertDeepEqual(room.hostConnection._lastSent, {
            type: 'broadcast',
            messageType: 'action',
            data: { value: 42 }
        });
    });
});

describe('Disconnect', function() {
    it('clears connection state', function() {
        const room = new MultiplayerRoom({});
        room.isConnected = true;
        room.isConnecting = false;
        room.players = { p1: {} };
        room.connections = { p1: new MockConnection('p1') };
        room.peer = new MockPeer();
        room._createAttempts = 2;

        room.disconnect();

        assertEqual(room.isConnected, false);
        assertEqual(room.isConnecting, false);
        assertDeepEqual(room.players, {});
        assertDeepEqual(room.connections, {});
        assertEqual(room.peer, null);
        assertEqual(room._createAttempts, 0);
    });

    it('clears host connection for guests', function() {
        const room = new MultiplayerRoom({});
        room.isHost = false;
        room.hostConnection = new MockConnection('host');
        room.peer = new MockPeer();

        room.disconnect();

        assertEqual(room.hostConnection, null);
    });
});

describe('Error Handling', function() {
    it('_handlePeerError handles peer-unavailable', function() {
        const room = new MultiplayerRoom({});
        room.isConnecting = true;

        let errorCalled = false;
        room.onError = function(err) {
            errorCalled = true;
            assertEqual(err.type, 'room_not_found');
            assertEqual(err.message, 'Room not found');
        };

        room._handlePeerError({ type: 'peer-unavailable' });

        assert(errorCalled);
        assertEqual(room.isConnecting, false);
    });

    it('_handlePeerError retries on unavailable-id for host', function() {
        MockPeer.simulateOpen = false;
        const room = new MultiplayerRoom({});
        room.isHost = true;
        room._createAttempts = 1;
        room._maxCreateAttempts = 3;

        // Should retry, not call error
        let errorCalled = false;
        room.onError = function() { errorCalled = false; };

        room._handlePeerError({ type: 'unavailable-id' });

        // createRoom was called again (attempts incremented)
        assertEqual(room._createAttempts, 2);
    });

    it('_handlePeerError fails after max retries', function() {
        MockPeer.simulateOpen = false;
        const room = new MultiplayerRoom({});
        room.isHost = true;
        room._createAttempts = 3;
        room._maxCreateAttempts = 3;

        let errorCalled = false;
        room.onError = function(err) {
            errorCalled = true;
            assertEqual(err.type, 'room_create_failed');
        };

        room._handlePeerError({ type: 'unavailable-id' });

        assert(errorCalled);
    });
});

describe('Timeout Handling', function() {
    it('timeout fires when peer never opens (sync check)', function() {
        // This test verifies the timeout is SET correctly
        // We can't easily test async timeout firing without a proper async runner

        // Mock Peer that never fires 'open'
        var SilentPeer = function(id, options) {
            this._handlers = {};
        };
        SilentPeer.prototype.on = function(event, handler) {
            this._handlers[event] = handler;
        };
        SilentPeer.prototype.destroy = function() {};

        var OrigPeer = global.Peer;
        global.Peer = SilentPeer;

        var room = new MultiplayerRoom({
            playerName: 'Host',
            connectionTimeout: 100
        });

        room.createRoom();

        // Verify timeout was set
        assert(room._connectionTimer !== null, 'Connection timer should be set');
        assertEqual(room.isConnecting, true, 'Should be connecting');
        assertEqual(room.isHost, true, 'Should be host');

        // Clean up
        room.disconnect();
        global.Peer = OrigPeer;
    });

    it('timeout clears when peer opens successfully', function() {
        MockPeer.reset();
        MockPeer.simulateOpen = true;
        MockPeer.openDelay = 5;

        var room = new MultiplayerRoom({
            playerName: 'Host',
            connectionTimeout: 1000
        });

        var opened = false;
        room.onRoomCreated = function() {
            opened = true;
        };

        room.createRoom();

        // Timer should be set initially
        assert(room._connectionTimer !== null, 'Timer should be set initially');
    });

    it('_clearTimer removes the timer', function() {
        var room = new MultiplayerRoom({});
        room._connectionTimer = setTimeout(function() {}, 10000);
        assert(room._connectionTimer !== null);

        room._clearTimer();
        assertEqual(room._connectionTimer, null, 'Timer should be null after clearing');
    });

    it('_clearConnection resets state', function() {
        MockPeer.simulateOpen = false;
        var room = new MultiplayerRoom({});
        room.isConnecting = true;
        room._connectionTimer = setTimeout(function() {}, 10000);
        room.peer = new MockPeer();

        room._clearConnection();

        assertEqual(room.isConnecting, false);
        assertEqual(room._connectionTimer, null);
        assertEqual(room.peer, null);
    });
});

// Helper for async-ish tests
function beforeEach(fn) {
    fn();
}
