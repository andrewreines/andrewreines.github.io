/**
 * Tic Tac Toe Game
 * Supports local and online multiplayer
 * Mobile-first design with QR code sharing
 */

class TicTacToe {
    constructor() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 0; // 0 = X, 1 = O
        this.players = [
            { name: 'Player 1', symbol: 'X', score: 0 },
            { name: 'Player 2', symbol: 'O', score: 0 }
        ];
        this.gameOver = false;
        this.winner = null;
        this.winningLine = null;

        // Multiplayer
        this.multiplayer = new GameMultiplayer({
            maxPlayers: 2,
            gameType: 'tictactoe'
        });
        this.mode = 'local';
        this.localPlayerId = 0;

        // Base URL for sharing
        this.baseUrl = 'https://www.andrewreines.com/games/tictactoe/';

        // Winning combinations
        this.winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
            [0, 4, 8], [2, 4, 6]              // diagonals
        ];

        this.initUI();
        this.setupMultiplayerCallbacks();
        this.bindEvents();
        this.checkUrlForRoom();
    }

    initUI() {
        this.ui = {
            // Screens
            setupScreen: document.getElementById('setup-screen'),
            gameScreen: document.getElementById('game-screen'),

            // Mode buttons
            localModeBtn: document.getElementById('local-mode-btn'),
            onlineModeBtn: document.getElementById('online-mode-btn'),

            // Setup sections
            localSetup: document.getElementById('local-setup'),
            onlineSetup: document.getElementById('online-setup'),

            // Player inputs (local)
            player1Name: document.getElementById('player1-name'),
            player2Name: document.getElementById('player2-name'),

            // Online options panel
            onlineOptionsPanel: document.getElementById('online-options-panel'),
            onlineName: document.getElementById('online-name'),
            hostGameBtn: document.getElementById('host-game-btn'),
            joinGameBtn: document.getElementById('join-game-btn'),

            // Host game panel
            hostGamePanel: document.getElementById('host-game-panel'),
            hostStatus: document.getElementById('host-status'),
            hostInfo: document.getElementById('host-info'),
            hostRoomCode: document.getElementById('host-room-code'),
            qrCode: document.getElementById('qr-code'),
            copyCodeBtn: document.getElementById('copy-code-btn'),
            shareLinkBtn: document.getElementById('share-link-btn'),
            cancelHostBtn: document.getElementById('cancel-host-btn'),

            // Join game panel
            joinGamePanel: document.getElementById('join-game-panel'),
            roomCodeInput: document.getElementById('room-code-input'),
            connectRoomBtn: document.getElementById('connect-room-btn'),
            joinStatus: document.getElementById('join-status'),
            backFromJoinBtn: document.getElementById('back-from-join-btn'),

            // Start buttons
            startLocalBtn: document.getElementById('start-local-btn'),

            // Game elements
            board: document.getElementById('board'),
            cells: document.querySelectorAll('.cell'),
            turnIndicator: document.getElementById('turn-indicator'),

            // Player info
            playerX: document.getElementById('player-x'),
            playerO: document.getElementById('player-o'),
            playerXName: document.getElementById('player-x-name'),
            playerOName: document.getElementById('player-o-name'),
            playerXScore: document.getElementById('player-x-score'),
            playerOScore: document.getElementById('player-o-score'),

            // Result
            gameResult: document.getElementById('game-result'),
            resultText: document.getElementById('result-text'),

            // Buttons
            playAgainBtn: document.getElementById('play-again-btn'),
            backBtn: document.getElementById('back-btn'),
            restartBtn: document.getElementById('restart-btn')
        };
    }

    setupMultiplayerCallbacks() {
        this.multiplayer.onPlayerJoined = (data) => {
            this.players[1].name = data.playerInfo.name;
            // Update host info panel
            const waitingEl = this.ui.hostInfo?.querySelector('.host-waiting');
            if (waitingEl) {
                waitingEl.innerHTML = `<i class="fas fa-check"></i> ${data.playerInfo.name} joined! Starting game...`;
            }
            // Auto-start when player joins
            setTimeout(() => this.startOnlineGame(), 1000);
        };

        this.multiplayer.onPlayerLeft = () => {
            if (this.mode === 'online') {
                alert('Opponent disconnected');
                this.returnToMenu();
            }
        };

        this.multiplayer.onGameStart = (state) => {
            this.players = state.players;
            this.localPlayerId = this.multiplayer.localPlayerId;
            this.startGame();
        };

        this.multiplayer.onGameStateReceived = (state) => {
            this.applyGameState(state);
        };

        this.multiplayer.onConnectionError = (msg) => {
            if (this.ui.joinStatus) {
                this.ui.joinStatus.textContent = msg;
                this.ui.joinStatus.classList.remove('hidden');
            }
        };

        this.multiplayer.onConnectionReady = () => {
            if (this.ui.joinStatus) {
                this.ui.joinStatus.innerHTML = '<i class="fas fa-check"></i> Connected! Waiting for host to start...';
            }
        };
    }

    bindEvents() {
        const addClickHandler = (element, handler, name) => {
            if (element) {
                element.addEventListener('click', handler);
            } else {
                console.warn(`Button element not found: ${name}`);
            }
        };

        // Mode selection
        addClickHandler(this.ui.localModeBtn, () => this.selectMode('local'), 'local-mode-btn');
        addClickHandler(this.ui.onlineModeBtn, () => this.selectMode('online'), 'online-mode-btn');

        // Online options
        addClickHandler(this.ui.hostGameBtn, () => this.hostGame(), 'host-game-btn');
        addClickHandler(this.ui.joinGameBtn, () => this.showJoinPanel(), 'join-game-btn');

        // Host panel
        addClickHandler(this.ui.cancelHostBtn, () => this.cancelHost(), 'cancel-host-btn');
        addClickHandler(this.ui.copyCodeBtn, () => this.copyRoomCode(), 'copy-code-btn');
        addClickHandler(this.ui.shareLinkBtn, () => this.shareLink(), 'share-link-btn');

        // Join panel
        addClickHandler(this.ui.connectRoomBtn, () => this.connectToRoom(), 'connect-room-btn');
        addClickHandler(this.ui.backFromJoinBtn, () => this.showOnlineOptions(), 'back-from-join-btn');

        // Start buttons
        addClickHandler(this.ui.startLocalBtn, () => this.startLocalGame(), 'start-local-btn');

        // Board cells
        if (this.ui.cells && this.ui.cells.length > 0) {
            this.ui.cells.forEach((cell, index) => {
                cell.addEventListener('click', () => this.handleCellClick(index));
            });
        }

        // Game buttons
        addClickHandler(this.ui.playAgainBtn, () => this.playAgain(), 'play-again-btn');
        addClickHandler(this.ui.backBtn, () => this.returnToMenu(), 'back-btn');
        addClickHandler(this.ui.restartBtn, () => this.playAgain(), 'restart-btn');

        // Room code input - auto uppercase and filter
        if (this.ui.roomCodeInput) {
            this.ui.roomCodeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            });

            // Allow enter key to submit
            this.ui.roomCodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.connectToRoom();
                }
            });
        }
    }

    // Check URL for room parameter and auto-join
    checkUrlForRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');

        if (roomCode && roomCode.length === 6) {
            // Auto-switch to online mode and join room
            this.selectMode('online');
            this.showJoinPanel();
            if (this.ui.roomCodeInput) {
                this.ui.roomCodeInput.value = roomCode.toUpperCase();
            }
            // Small delay to let UI update, then auto-connect
            setTimeout(() => this.connectToRoom(), 500);
        }
    }

    selectMode(mode) {
        this.mode = mode;

        if (this.ui.localModeBtn) this.ui.localModeBtn.classList.toggle('active', mode === 'local');
        if (this.ui.onlineModeBtn) this.ui.onlineModeBtn.classList.toggle('active', mode === 'online');

        if (this.ui.localSetup) this.ui.localSetup.classList.toggle('hidden', mode !== 'local');
        if (this.ui.onlineSetup) this.ui.onlineSetup.classList.toggle('hidden', mode !== 'online');

        if (mode === 'online') {
            this.showOnlineOptions();
        }
    }

    showOnlineOptions() {
        if (this.multiplayer) this.multiplayer.disconnect();
        if (this.ui.onlineOptionsPanel) this.ui.onlineOptionsPanel.classList.remove('hidden');
        if (this.ui.hostGamePanel) this.ui.hostGamePanel.classList.add('hidden');
        if (this.ui.joinGamePanel) this.ui.joinGamePanel.classList.add('hidden');
        if (this.ui.joinStatus) this.ui.joinStatus.classList.add('hidden');
    }

    showJoinPanel() {
        if (this.ui.onlineOptionsPanel) this.ui.onlineOptionsPanel.classList.add('hidden');
        if (this.ui.joinGamePanel) this.ui.joinGamePanel.classList.remove('hidden');
        if (this.ui.joinStatus) this.ui.joinStatus.classList.add('hidden');
        if (this.ui.roomCodeInput) {
            this.ui.roomCodeInput.value = '';
            this.ui.roomCodeInput.focus();
        }
    }

    // Host a game
    async hostGame() {
        const playerName = (this.ui.onlineName?.value?.trim()) || 'Player 1';
        this.players[0].name = playerName;

        // Show host panel
        if (this.ui.onlineOptionsPanel) this.ui.onlineOptionsPanel.classList.add('hidden');
        if (this.ui.hostGamePanel) this.ui.hostGamePanel.classList.remove('hidden');
        if (this.ui.hostStatus) {
            this.ui.hostStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating room...';
            this.ui.hostStatus.classList.remove('hidden');
        }
        if (this.ui.hostInfo) this.ui.hostInfo.classList.add('hidden');

        try {
            const roomCode = await this.multiplayer.initAsHost({ name: playerName });
            this.localPlayerId = 0;

            if (this.ui.hostStatus) this.ui.hostStatus.classList.add('hidden');
            if (this.ui.hostInfo) this.ui.hostInfo.classList.remove('hidden');
            if (this.ui.hostRoomCode) this.ui.hostRoomCode.textContent = roomCode;

            // Generate QR code
            this.generateQRCode(roomCode);

        } catch (err) {
            console.error('Host error:', err);
            if (this.ui.hostStatus) {
                this.ui.hostStatus.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message || 'Failed to create room'}`;
            }
        }
    }

    // Generate QR code for room
    generateQRCode(roomCode) {
        const url = `${this.baseUrl}?room=${roomCode}`;

        if (this.ui.qrCode && typeof QRCode !== 'undefined') {
            // Clear any existing QR code
            this.ui.qrCode.innerHTML = '';

            QRCode.toCanvas(this.ui.qrCode, url, {
                width: 150,
                margin: 2,
                color: {
                    dark: '#1a1a2e',
                    light: '#ffffff'
                }
            }, (error) => {
                if (error) {
                    console.error('QR Code generation error:', error);
                    // Fallback: just show the URL
                    this.ui.qrCode.innerHTML = `<small style="word-break: break-all;">${url}</small>`;
                }
            });
        }
    }

    // Copy room code to clipboard
    copyRoomCode() {
        const code = this.ui.hostRoomCode?.textContent || '';
        navigator.clipboard.writeText(code).then(() => {
            if (this.ui.copyCodeBtn) {
                const originalHTML = this.ui.copyCodeBtn.innerHTML;
                this.ui.copyCodeBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    if (this.ui.copyCodeBtn) {
                        this.ui.copyCodeBtn.innerHTML = originalHTML;
                    }
                }, 2000);
            }
        });
    }

    // Share link using Web Share API or clipboard
    shareLink() {
        const code = this.ui.hostRoomCode?.textContent || '';
        const url = `${this.baseUrl}?room=${code}`;

        // Try Web Share API first (works great on mobile)
        if (navigator.share) {
            navigator.share({
                title: 'Join my Tic Tac Toe game!',
                text: `Join my game with code: ${code}`,
                url: url
            }).catch((err) => {
                // User cancelled or error - fall back to clipboard
                if (err.name !== 'AbortError') {
                    this.copyLinkToClipboard(url);
                }
            });
        } else {
            // Fallback to clipboard
            this.copyLinkToClipboard(url);
        }
    }

    copyLinkToClipboard(url) {
        navigator.clipboard.writeText(url).then(() => {
            if (this.ui.shareLinkBtn) {
                const originalHTML = this.ui.shareLinkBtn.innerHTML;
                this.ui.shareLinkBtn.innerHTML = '<i class="fas fa-check"></i> Link Copied!';
                setTimeout(() => {
                    if (this.ui.shareLinkBtn) {
                        this.ui.shareLinkBtn.innerHTML = originalHTML;
                    }
                }, 2000);
            }
        });
    }

    // Cancel hosting
    cancelHost() {
        if (this.multiplayer) this.multiplayer.disconnect();
        this.showOnlineOptions();
    }

    // Connect to room by code
    async connectToRoom() {
        const roomCode = (this.ui.roomCodeInput?.value?.trim() || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (!roomCode || roomCode.length !== 6) {
            if (this.ui.joinStatus) {
                this.ui.joinStatus.textContent = 'Please enter a valid 6-character room code';
                this.ui.joinStatus.classList.remove('hidden');
            }
            return;
        }

        const playerName = (this.ui.onlineName?.value?.trim()) || 'Player 2';
        if (this.ui.joinStatus) {
            this.ui.joinStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            this.ui.joinStatus.classList.remove('hidden');
        }

        try {
            await this.multiplayer.initAsGuest(roomCode, { name: playerName });
            this.players[1].name = playerName;
            this.localPlayerId = 1;
        } catch (err) {
            // Error handled by callback
        }
    }

    startLocalGame() {
        this.mode = 'local';
        this.players[0].name = (this.ui.player1Name?.value?.trim()) || 'Player 1';
        this.players[1].name = (this.ui.player2Name?.value?.trim()) || 'Player 2';
        if (this.multiplayer) this.multiplayer.initLocal();
        this.startGame();
    }

    startOnlineGame() {
        if (!this.multiplayer?.isHost) return;

        this.multiplayer.startGame({
            players: this.players
        });
        this.startGame();
    }

    startGame() {
        if (this.ui.setupScreen) this.ui.setupScreen.classList.remove('active');
        if (this.ui.gameScreen) this.ui.gameScreen.classList.add('active');

        this.resetBoard();
        this.updatePlayerInfo();
        this.updateTurnIndicator();
    }

    resetBoard() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 0;
        this.gameOver = false;
        this.winner = null;
        this.winningLine = null;

        if (this.ui.cells) {
            this.ui.cells.forEach(cell => {
                cell.textContent = '';
                cell.className = 'cell';
            });
        }

        if (this.ui.gameResult) this.ui.gameResult.classList.add('hidden');
        this.updateTurnIndicator();
        this.updateActivePlayer();
    }

    updatePlayerInfo() {
        if (this.ui.playerXName) this.ui.playerXName.textContent = this.players[0].name;
        if (this.ui.playerOName) this.ui.playerOName.textContent = this.players[1].name;
        if (this.ui.playerXScore) this.ui.playerXScore.textContent = this.players[0].score;
        if (this.ui.playerOScore) this.ui.playerOScore.textContent = this.players[1].score;
    }

    updateTurnIndicator() {
        const player = this.players[this.currentPlayer];
        const symbolClass = player.symbol.toLowerCase();
        if (this.ui.turnIndicator) {
            this.ui.turnIndicator.innerHTML = `<span class="player-symbol ${symbolClass}">${player.symbol}</span> ${player.name}'s Turn`;
        }
    }

    updateActivePlayer() {
        if (this.ui.playerX) this.ui.playerX.classList.toggle('active', this.currentPlayer === 0);
        if (this.ui.playerO) this.ui.playerO.classList.toggle('active', this.currentPlayer === 1);
    }

    handleCellClick(index) {
        if (this.gameOver) return;
        if (this.board[index] !== null) return;

        // Online: only allow moves on your turn
        if (this.multiplayer?.isOnline() && this.currentPlayer !== this.localPlayerId) {
            return;
        }

        this.makeMove(index);

        // Sync with remote player
        if (this.multiplayer?.isOnline()) {
            this.multiplayer.sendGameState(this.getGameState());
        }
    }

    makeMove(index) {
        const symbol = this.players[this.currentPlayer].symbol;
        this.board[index] = symbol;

        const cell = this.ui.cells?.[index];
        if (cell) {
            cell.textContent = symbol;
            cell.classList.add('taken', symbol.toLowerCase());
        }

        const result = this.checkWin();
        if (result) {
            this.endGame(result);
        } else if (this.board.every(cell => cell !== null)) {
            this.endGame('draw');
        } else {
            this.currentPlayer = 1 - this.currentPlayer;
            this.updateTurnIndicator();
            this.updateActivePlayer();
        }
    }

    checkWin() {
        for (const pattern of this.winPatterns) {
            const [a, b, c] = pattern;
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                this.winningLine = pattern;
                return this.board[a];
            }
        }
        return null;
    }

    endGame(result) {
        this.gameOver = true;

        if (result === 'draw') {
            if (this.ui.resultText) {
                this.ui.resultText.textContent = "It's a draw!";
                this.ui.resultText.className = 'result-text draw';
            }
        } else {
            this.winner = this.currentPlayer;
            const player = this.players[this.winner];
            player.score++;
            this.updatePlayerInfo();

            if (this.ui.resultText) {
                this.ui.resultText.textContent = `${player.name} wins!`;
                this.ui.resultText.className = `result-text win-${result.toLowerCase()}`;
            }

            // Highlight winning cells
            if (this.winningLine && this.ui.cells) {
                this.winningLine.forEach(index => {
                    if (this.ui.cells[index]) {
                        this.ui.cells[index].classList.add('winning');
                    }
                });
            }
        }

        if (this.ui.gameResult) this.ui.gameResult.classList.remove('hidden');
    }

    playAgain() {
        this.resetBoard();

        if (this.multiplayer?.isOnline() && this.multiplayer?.isHost) {
            this.multiplayer.sendGameState(this.getGameState());
        }
    }

    getGameState() {
        return {
            board: this.board,
            currentPlayer: this.currentPlayer,
            players: this.players,
            gameOver: this.gameOver,
            winner: this.winner,
            winningLine: this.winningLine
        };
    }

    applyGameState(state) {
        this.board = state.board;
        this.currentPlayer = state.currentPlayer;
        this.players = state.players;
        this.gameOver = state.gameOver;
        this.winner = state.winner;
        this.winningLine = state.winningLine;

        // Update UI
        if (this.ui.cells) {
            this.ui.cells.forEach((cell, index) => {
                const value = this.board[index];
                cell.textContent = value || '';
                cell.className = 'cell';
                if (value) {
                    cell.classList.add('taken', value.toLowerCase());
                }
            });
        }

        this.updatePlayerInfo();
        this.updateTurnIndicator();
        this.updateActivePlayer();

        if (this.gameOver) {
            if (this.winningLine && this.ui.cells) {
                this.winningLine.forEach(index => {
                    if (this.ui.cells[index]) {
                        this.ui.cells[index].classList.add('winning');
                    }
                });
            }

            if (this.winner !== null) {
                const player = this.players[this.winner];
                if (this.ui.resultText) {
                    this.ui.resultText.textContent = `${player.name} wins!`;
                    this.ui.resultText.className = `result-text win-${player.symbol.toLowerCase()}`;
                }
            } else {
                if (this.ui.resultText) {
                    this.ui.resultText.textContent = "It's a draw!";
                    this.ui.resultText.className = 'result-text draw';
                }
            }
            if (this.ui.gameResult) this.ui.gameResult.classList.remove('hidden');
        } else {
            if (this.ui.gameResult) this.ui.gameResult.classList.add('hidden');
        }
    }

    returnToMenu() {
        if (this.multiplayer) this.multiplayer.disconnect();
        this.players[0].score = 0;
        this.players[1].score = 0;

        if (this.ui.gameScreen) this.ui.gameScreen.classList.remove('active');
        if (this.ui.setupScreen) this.ui.setupScreen.classList.add('active');

        // Reset online UI
        this.showOnlineOptions();
        if (this.ui.roomCodeInput) this.ui.roomCodeInput.value = '';

        // Clear URL parameter
        const url = new URL(window.location);
        url.searchParams.delete('room');
        window.history.replaceState({}, '', url);
    }
}

// Initialize game when DOM is ready
function initGame() {
    try {
        window.game = new TicTacToe();
        console.log('TicTacToe game initialized successfully');
    } catch (error) {
        console.error('Failed to initialize TicTacToe game:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
