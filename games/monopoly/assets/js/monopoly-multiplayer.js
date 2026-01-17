/**
 * Monopoly Multiplayer Module
 * Handles both local (hot-seat) and online (WebRTC) multiplayer
 * 100% frontend-only implementation
 */

const MonopolyMultiplayer = {
    // Connection state
    mode: 'local', // 'local' or 'online'
    isHost: false,
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

    // WebRTC configuration
    rtcConfig: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    },

    // Initialize for local play
    initLocal() {
        this.mode = 'local';
        this.isHost = true;
        this.localPlayerId = 0;
        console.log('Multiplayer: Local mode initialized');
    },

    // Initialize as host for online play
    async initAsHost(playerInfo) {
        this.mode = 'online';
        this.isHost = true;
        this.localPlayerId = 0;
        this.roomCode = this.generateRoomCode();
        this.pendingConnections = new Map();

        console.log('Multiplayer: Host mode initialized, room code:', this.roomCode);
        return this.roomCode;
    },

    // Generate a random room code
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    // Create offer for a new connection (host)
    async createOffer() {
        const pc = new RTCPeerConnection(this.rtcConfig);
        const connectionId = Date.now().toString();

        // Create data channel
        const dc = pc.createDataChannel('game', {
            ordered: true
        });

        this.setupDataChannel(dc, connectionId);

        // Handle ICE candidates
        const iceCandidates = [];
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                iceCandidates.push(event.candidate);
            }
        };

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering to complete
        await new Promise((resolve) => {
            if (pc.iceGatheringState === 'complete') {
                resolve();
            } else {
                pc.onicegatheringstatechange = () => {
                    if (pc.iceGatheringState === 'complete') {
                        resolve();
                    }
                };
                // Timeout after 5 seconds
                setTimeout(resolve, 5000);
            }
        });

        // Store pending connection
        this.pendingConnections.set(connectionId, {
            pc,
            dc,
            iceCandidates
        });

        // Encode the offer and candidates
        const offerData = {
            type: 'offer',
            connectionId,
            roomCode: this.roomCode,
            sdp: pc.localDescription,
            candidates: iceCandidates
        };

        return this.encodeConnectionData(offerData);
    },

    // Process answer from guest (host)
    async processAnswer(answerCode) {
        try {
            const answerData = this.decodeConnectionData(answerCode);

            if (!answerData || answerData.type !== 'answer') {
                throw new Error('Invalid answer code');
            }

            const pending = this.pendingConnections.get(answerData.connectionId);
            if (!pending) {
                throw new Error('Connection not found');
            }

            const { pc } = pending;

            // Set remote description
            await pc.setRemoteDescription(answerData.sdp);

            // Add ICE candidates
            for (const candidate of answerData.candidates) {
                await pc.addIceCandidate(candidate);
            }

            // Move to active connections
            this.connections.push({
                id: answerData.connectionId,
                pc,
                dc: pending.dc,
                playerId: this.connections.length + 1,
                playerInfo: answerData.playerInfo
            });

            this.pendingConnections.delete(answerData.connectionId);

            console.log('Multiplayer: Guest connected', answerData.playerInfo);

            if (this.onPlayerJoined) {
                this.onPlayerJoined({
                    playerId: this.connections.length,
                    playerInfo: answerData.playerInfo
                });
            }

            return true;
        } catch (error) {
            console.error('Error processing answer:', error);
            if (this.onConnectionError) {
                this.onConnectionError(error.message);
            }
            return false;
        }
    },

    // Initialize as guest for online play
    async initAsGuest(offerCode, playerInfo) {
        this.mode = 'online';
        this.isHost = false;

        try {
            const offerData = this.decodeConnectionData(offerCode);

            if (!offerData || offerData.type !== 'offer') {
                throw new Error('Invalid room code');
            }

            this.roomCode = offerData.roomCode;

            const pc = new RTCPeerConnection(this.rtcConfig);

            // Handle incoming data channel
            pc.ondatachannel = (event) => {
                this.setupDataChannel(event.channel, offerData.connectionId);
            };

            // Handle ICE candidates
            const iceCandidates = [];
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    iceCandidates.push(event.candidate);
                }
            };

            // Set remote description (offer)
            await pc.setRemoteDescription(offerData.sdp);

            // Add ICE candidates from offer
            for (const candidate of offerData.candidates) {
                await pc.addIceCandidate(candidate);
            }

            // Create answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Wait for ICE gathering
            await new Promise((resolve) => {
                if (pc.iceGatheringState === 'complete') {
                    resolve();
                } else {
                    pc.onicegatheringstatechange = () => {
                        if (pc.iceGatheringState === 'complete') {
                            resolve();
                        }
                    };
                    setTimeout(resolve, 5000);
                }
            });

            // Store connection
            this.connections.push({
                id: offerData.connectionId,
                pc,
                dc: null, // Will be set when data channel opens
                playerId: 0, // Host
                isHost: true
            });

            // Encode answer
            const answerData = {
                type: 'answer',
                connectionId: offerData.connectionId,
                sdp: pc.localDescription,
                candidates: iceCandidates,
                playerInfo
            };

            return this.encodeConnectionData(answerData);
        } catch (error) {
            console.error('Error joining room:', error);
            if (this.onConnectionError) {
                this.onConnectionError(error.message);
            }
            return null;
        }
    },

    // Setup data channel handlers
    setupDataChannel(dc, connectionId) {
        dc.onopen = () => {
            console.log('Data channel opened:', connectionId);

            // Update connection with data channel
            const conn = this.connections.find(c => c.id === connectionId);
            if (conn) {
                conn.dc = dc;
            }

            if (this.onConnectionReady) {
                this.onConnectionReady(connectionId);
            }
        };

        dc.onclose = () => {
            console.log('Data channel closed:', connectionId);
            this.handleDisconnection(connectionId);
        };

        dc.onerror = (error) => {
            console.error('Data channel error:', error);
            if (this.onConnectionError) {
                this.onConnectionError('Connection error');
            }
        };

        dc.onmessage = (event) => {
            this.handleMessage(event.data, connectionId);
        };
    },

    // Handle incoming messages
    handleMessage(data, fromConnectionId) {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'gameState':
                    if (this.onGameStateReceived) {
                        this.onGameStateReceived(message.state);
                    }
                    break;

                case 'action':
                    if (this.onActionReceived) {
                        this.onActionReceived(message.action, message.playerId);
                    }
                    break;

                case 'chat':
                    if (this.onChatReceived) {
                        this.onChatReceived(message.text, message.playerId);
                    }
                    break;

                case 'playerInfo':
                    // Update player info
                    const conn = this.connections.find(c => c.id === fromConnectionId);
                    if (conn) {
                        conn.playerInfo = message.info;
                        if (this.onPlayerJoined) {
                            this.onPlayerJoined({
                                playerId: conn.playerId,
                                playerInfo: message.info
                            });
                        }
                    }
                    break;

                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    },

    // Handle disconnection
    handleDisconnection(connectionId) {
        const index = this.connections.findIndex(c => c.id === connectionId);
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
        const data = JSON.stringify(message);
        for (const conn of this.connections) {
            if (conn.dc && conn.dc.readyState === 'open') {
                conn.dc.send(data);
            }
        }
    },

    // Send message to specific peer
    sendTo(connectionId, message) {
        const conn = this.connections.find(c => c.id === connectionId);
        if (conn && conn.dc && conn.dc.readyState === 'open') {
            conn.dc.send(JSON.stringify(message));
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

        if (this.isHost) {
            // Host processes locally and broadcasts
            this.broadcast(message);
        } else {
            // Guest sends to host
            this.broadcast(message);
        }
    },

    // Send chat message
    sendChat(text) {
        this.broadcast({
            type: 'chat',
            text,
            playerId: this.localPlayerId
        });
    },

    // Encode connection data to shareable string
    encodeConnectionData(data) {
        try {
            const json = JSON.stringify(data);
            // Use base64 encoding
            return btoa(encodeURIComponent(json));
        } catch (error) {
            console.error('Error encoding connection data:', error);
            return null;
        }
    },

    // Decode connection data from string
    decodeConnectionData(encoded) {
        try {
            const json = decodeURIComponent(atob(encoded));
            return JSON.parse(json);
        } catch (error) {
            console.error('Error decoding connection data:', error);
            return null;
        }
    },

    // Check if we're in online mode
    isOnline() {
        return this.mode === 'online';
    },

    // Get connected player count
    getConnectedCount() {
        return this.connections.filter(c => c.dc && c.dc.readyState === 'open').length;
    },

    // Cleanup
    disconnect() {
        for (const conn of this.connections) {
            if (conn.dc) {
                conn.dc.close();
            }
            if (conn.pc) {
                conn.pc.close();
            }
        }
        this.connections = [];

        if (this.pendingConnections) {
            for (const [id, pending] of this.pendingConnections) {
                if (pending.dc) pending.dc.close();
                if (pending.pc) pending.pc.close();
            }
            this.pendingConnections.clear();
        }

        this.mode = 'local';
        this.isHost = false;
        this.roomCode = null;
    }
};

// Alternative simple approach using clipboard for signaling
const SimpleSignaling = {
    // Store the current offer/answer for copy
    currentOffer: null,
    currentAnswer: null,

    // Create a shareable game invite (host)
    async createInvite(hostInfo) {
        MonopolyMultiplayer.initAsHost(hostInfo);
        const offerCode = await MonopolyMultiplayer.createOffer();
        this.currentOffer = offerCode;
        return {
            roomCode: MonopolyMultiplayer.roomCode,
            offerCode
        };
    },

    // Join with invite code (guest)
    async joinWithInvite(offerCode, guestInfo) {
        const answerCode = await MonopolyMultiplayer.initAsGuest(offerCode, guestInfo);
        this.currentAnswer = answerCode;
        return answerCode;
    },

    // Complete connection (host receives answer)
    async completeConnection(answerCode) {
        return await MonopolyMultiplayer.processAnswer(answerCode);
    },

    // Copy to clipboard helper
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            } catch (e) {
                document.body.removeChild(textarea);
                return false;
            }
        }
    },

    // Paste from clipboard helper
    async pasteFromClipboard() {
        try {
            return await navigator.clipboard.readText();
        } catch (error) {
            return null;
        }
    }
};

// Export for use in main game
window.MonopolyMultiplayer = MonopolyMultiplayer;
window.SimpleSignaling = SimpleSignaling;
