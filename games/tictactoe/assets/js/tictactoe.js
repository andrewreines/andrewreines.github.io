/**
 * Tic Tac Toe Game
 * Supports local and online multiplayer
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

        // Multiplayer with game type for proximity matching
        this.multiplayer = new GameMultiplayer({
            maxPlayers: 2,
            codeLength: 12,
            gameType: 'tictactoe',
            proximityPrecision: 4 // ~100m grid cells
        });
        this.mode = 'local';
        this.localPlayerId = 0;

        // Winning combinations
        this.winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
            [0, 4, 8], [2, 4, 6]              // diagonals
        ];

        this.initUI();
        this.setupMultiplayerCallbacks();
        this.bindEvents();
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
            findGamesBtn: document.getElementById('find-games-btn'),
            showCodeBtn: document.getElementById('show-code-btn'),

            // Host game panel
            hostGamePanel: document.getElementById('host-game-panel'),
            hostStatus: document.getElementById('host-status'),
            hostInfo: document.getElementById('host-info'),
            hostRoomCode: document.getElementById('host-room-code'),
            copyHostCodeBtn: document.getElementById('copy-host-code-btn'),
            cancelHostBtn: document.getElementById('cancel-host-btn'),

            // Find games panel
            findGamesPanel: document.getElementById('find-games-panel'),
            findStatus: document.getElementById('find-status'),
            gamesList: document.getElementById('games-list'),
            refreshGamesBtn: document.getElementById('refresh-games-btn'),
            cancelFindBtn: document.getElementById('cancel-find-btn'),

            // Code entry panel
            codeEntryPanel: document.getElementById('code-entry-panel'),
            roomCodeInput: document.getElementById('room-code-input'),
            connectRoomBtn: document.getElementById('connect-room-btn'),
            joinStatus: document.getElementById('join-status'),
            backFromCodeBtn: document.getElementById('back-from-code-btn'),

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
            const waitingEl = this.ui.hostInfo.querySelector('.host-waiting');
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
            // Update join status in code entry panel
            this.ui.joinStatus.textContent = msg;
            this.ui.joinStatus.classList.remove('hidden');
            // Also update find status if visible
            this.ui.findStatus.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        };

        this.multiplayer.onConnectionReady = () => {
            this.ui.joinStatus.innerHTML = '<i class="fas fa-check"></i> Connected! Waiting for host to start...';
            this.ui.findStatus.innerHTML = '<i class="fas fa-check"></i> Connected! Starting game...';
        };
    }

    bindEvents() {
        // Mode selection
        this.ui.localModeBtn.addEventListener('click', () => this.selectMode('local'));
        this.ui.onlineModeBtn.addEventListener('click', () => this.selectMode('online'));

        // Online options
        this.ui.hostGameBtn.addEventListener('click', () => this.hostGame());
        this.ui.findGamesBtn.addEventListener('click', () => this.findNearbyGames());
        this.ui.showCodeBtn.addEventListener('click', () => this.showCodeEntryPanel());

        // Host panel
        this.ui.cancelHostBtn.addEventListener('click', () => this.cancelHost());
        this.ui.copyHostCodeBtn.addEventListener('click', () => this.copyHostCode());

        // Find games panel
        this.ui.refreshGamesBtn.addEventListener('click', () => this.findNearbyGames());
        this.ui.cancelFindBtn.addEventListener('click', () => this.showOnlineOptions());

        // Code entry panel
        this.ui.connectRoomBtn.addEventListener('click', () => this.connectToRoom());
        this.ui.backFromCodeBtn.addEventListener('click', () => this.showOnlineOptions());

        // Start buttons
        this.ui.startLocalBtn.addEventListener('click', () => this.startLocalGame());

        // Board cells
        this.ui.cells.forEach((cell, index) => {
            cell.addEventListener('click', () => this.handleCellClick(index));
        });

        // Game buttons
        this.ui.playAgainBtn.addEventListener('click', () => this.playAgain());
        this.ui.backBtn.addEventListener('click', () => this.returnToMenu());
        this.ui.restartBtn.addEventListener('click', () => this.playAgain());

        // Room code input - auto uppercase and filter
        this.ui.roomCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
    }

    selectMode(mode) {
        this.mode = mode;

        this.ui.localModeBtn.classList.toggle('active', mode === 'local');
        this.ui.onlineModeBtn.classList.toggle('active', mode === 'online');

        this.ui.localSetup.classList.toggle('hidden', mode !== 'local');
        this.ui.onlineSetup.classList.toggle('hidden', mode !== 'online');

        // Reset online panels - show main options
        if (mode === 'online') {
            this.showOnlineOptions();
        }
    }

    // Show main online options panel
    showOnlineOptions() {
        this.multiplayer.disconnect(); // Clean up any existing connection
        this.ui.onlineOptionsPanel.classList.remove('hidden');
        this.ui.hostGamePanel.classList.add('hidden');
        this.ui.findGamesPanel.classList.add('hidden');
        this.ui.codeEntryPanel.classList.add('hidden');
        this.ui.joinStatus.classList.add('hidden');
    }

    // Host a game
    async hostGame() {
        const playerName = this.ui.onlineName.value.trim() || 'Player 1';
        this.players[0].name = playerName;

        // Show host panel
        this.ui.onlineOptionsPanel.classList.add('hidden');
        this.ui.hostGamePanel.classList.remove('hidden');
        this.ui.hostStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting your location...';
        this.ui.hostInfo.classList.add('hidden');

        try {
            // Get location and create proximity-based room
            const location = await this.multiplayer.getLocation();
            this.ui.hostStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating room...';

            const proximityCode = this.multiplayer.generateProximityCode(location.lat, location.lng);
            const roomCode = await this.multiplayer.initAsHostWithCode(proximityCode, { name: playerName });

            this.localPlayerId = 0;
            this.ui.hostStatus.classList.add('hidden');
            this.ui.hostInfo.classList.remove('hidden');
            this.ui.hostRoomCode.textContent = roomCode;
        } catch (err) {
            console.error('Host error:', err);
            this.ui.hostStatus.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message || 'Failed to create room'}`;
        }
    }

    // Cancel hosting
    cancelHost() {
        this.multiplayer.disconnect();
        this.showOnlineOptions();
    }

    // Copy host room code
    copyHostCode() {
        const code = this.ui.hostRoomCode.textContent;
        navigator.clipboard.writeText(code).then(() => {
            this.ui.copyHostCodeBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                this.ui.copyHostCodeBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);
        });
    }

    // Find nearby games
    async findNearbyGames() {
        const playerName = this.ui.onlineName.value.trim() || 'Player 2';
        this.players[1].name = playerName;

        // Show find panel
        this.ui.onlineOptionsPanel.classList.add('hidden');
        this.ui.findGamesPanel.classList.remove('hidden');
        this.ui.findStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting your location...';
        this.ui.findStatus.classList.remove('hidden');
        this.ui.gamesList.classList.add('hidden');
        this.ui.refreshGamesBtn.classList.add('hidden');

        try {
            const location = await this.multiplayer.getLocation();
            this.ui.findStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching for nearby games...';

            // Get all proximity codes to search
            const codes = this.multiplayer.getAdjacentProximityCodes(location.lat, location.lng);

            // Try to find any active room
            let foundRoom = null;
            for (const code of codes) {
                try {
                    const exists = await this.multiplayer.checkRoomExists(code);
                    if (exists) {
                        foundRoom = code;
                        break;
                    }
                } catch (e) {
                    // Room doesn't exist, continue
                }
            }

            if (foundRoom) {
                this.ui.findStatus.innerHTML = '<i class="fas fa-check"></i> Found a game! Connecting...';

                // Join the room
                await this.multiplayer.initAsGuest(foundRoom, { name: playerName });
                this.localPlayerId = 1;
            } else {
                this.ui.findStatus.innerHTML = '<i class="fas fa-info-circle"></i> No nearby games found';
                this.ui.refreshGamesBtn.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Find games error:', err);
            this.ui.findStatus.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message || 'Failed to search'}`;
            this.ui.refreshGamesBtn.classList.remove('hidden');
        }
    }

    // Show code entry panel
    showCodeEntryPanel() {
        this.ui.onlineOptionsPanel.classList.add('hidden');
        this.ui.codeEntryPanel.classList.remove('hidden');
        this.ui.joinStatus.classList.add('hidden');
        this.ui.roomCodeInput.value = '';
    }

    // Connect to room by code
    async connectToRoom() {
        const roomCode = this.ui.roomCodeInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (!roomCode || roomCode.length !== 12) {
            this.ui.joinStatus.textContent = 'Please enter a valid 12-character room code';
            this.ui.joinStatus.classList.remove('hidden');
            return;
        }

        const playerName = this.ui.onlineName.value.trim() || 'Player 2';
        this.ui.joinStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        this.ui.joinStatus.classList.remove('hidden');

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
        this.players[0].name = this.ui.player1Name.value.trim() || 'Player 1';
        this.players[1].name = this.ui.player2Name.value.trim() || 'Player 2';
        this.multiplayer.initLocal();
        this.startGame();
    }

    startOnlineGame() {
        if (!this.multiplayer.isHost) return;

        this.multiplayer.startGame({
            players: this.players
        });
        this.startGame();
    }

    startGame() {
        this.ui.setupScreen.classList.remove('active');
        this.ui.gameScreen.classList.add('active');

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

        this.ui.cells.forEach(cell => {
            cell.textContent = '';
            cell.className = 'cell';
        });

        this.ui.gameResult.classList.add('hidden');
        this.updateTurnIndicator();
        this.updateActivePlayer();
    }

    updatePlayerInfo() {
        this.ui.playerXName.textContent = this.players[0].name;
        this.ui.playerOName.textContent = this.players[1].name;
        this.ui.playerXScore.textContent = this.players[0].score;
        this.ui.playerOScore.textContent = this.players[1].score;
    }

    updateTurnIndicator() {
        const player = this.players[this.currentPlayer];
        const symbolClass = player.symbol.toLowerCase();
        this.ui.turnIndicator.innerHTML = `<span class="player-symbol ${symbolClass}">${player.symbol}</span> ${player.name}'s Turn`;
    }

    updateActivePlayer() {
        this.ui.playerX.classList.toggle('active', this.currentPlayer === 0);
        this.ui.playerO.classList.toggle('active', this.currentPlayer === 1);
    }

    handleCellClick(index) {
        if (this.gameOver) return;
        if (this.board[index] !== null) return;

        // Online: only allow moves on your turn
        if (this.multiplayer.isOnline() && this.currentPlayer !== this.localPlayerId) {
            return;
        }

        this.makeMove(index);

        // Sync with remote player
        if (this.multiplayer.isOnline()) {
            this.multiplayer.sendGameState(this.getGameState());
        }
    }

    makeMove(index) {
        const symbol = this.players[this.currentPlayer].symbol;
        this.board[index] = symbol;

        const cell = this.ui.cells[index];
        cell.textContent = symbol;
        cell.classList.add('taken', symbol.toLowerCase());

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
            this.ui.resultText.textContent = "It's a draw!";
            this.ui.resultText.className = 'result-text draw';
        } else {
            this.winner = this.currentPlayer;
            const player = this.players[this.winner];
            player.score++;
            this.updatePlayerInfo();

            this.ui.resultText.textContent = `${player.name} wins!`;
            this.ui.resultText.className = `result-text win-${result.toLowerCase()}`;

            // Highlight winning cells
            if (this.winningLine) {
                this.winningLine.forEach(index => {
                    this.ui.cells[index].classList.add('winning');
                });
            }
        }

        this.ui.gameResult.classList.remove('hidden');
    }

    playAgain() {
        this.resetBoard();

        if (this.multiplayer.isOnline() && this.multiplayer.isHost) {
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
        this.ui.cells.forEach((cell, index) => {
            const value = this.board[index];
            cell.textContent = value || '';
            cell.className = 'cell';
            if (value) {
                cell.classList.add('taken', value.toLowerCase());
            }
        });

        this.updatePlayerInfo();
        this.updateTurnIndicator();
        this.updateActivePlayer();

        if (this.gameOver) {
            if (this.winningLine) {
                this.winningLine.forEach(index => {
                    this.ui.cells[index].classList.add('winning');
                });
            }

            if (this.winner !== null) {
                const player = this.players[this.winner];
                this.ui.resultText.textContent = `${player.name} wins!`;
                this.ui.resultText.className = `result-text win-${player.symbol.toLowerCase()}`;
            } else {
                this.ui.resultText.textContent = "It's a draw!";
                this.ui.resultText.className = 'result-text draw';
            }
            this.ui.gameResult.classList.remove('hidden');
        } else {
            this.ui.gameResult.classList.add('hidden');
        }
    }

    returnToMenu() {
        this.multiplayer.disconnect();
        this.players[0].score = 0;
        this.players[1].score = 0;

        this.ui.gameScreen.classList.remove('active');
        this.ui.setupScreen.classList.add('active');

        // Reset online UI - show main options panel
        this.ui.onlineOptionsPanel.classList.remove('hidden');
        this.ui.hostGamePanel.classList.add('hidden');
        this.ui.findGamesPanel.classList.add('hidden');
        this.ui.codeEntryPanel.classList.add('hidden');
        this.ui.joinStatus.classList.add('hidden');
        this.ui.roomCodeInput.value = '';
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new TicTacToe();
});
