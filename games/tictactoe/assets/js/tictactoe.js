/**
 * Tic Tac Toe Game
 * Supports local and online multiplayer
 */

class TicTacToe {
    constructor() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 0;
        this.players = [
            { name: 'Player 1', symbol: 'X', score: 0 },
            { name: 'Player 2', symbol: 'O', score: 0 }
        ];
        this.gameOver = false;
        this.winner = null;
        this.winningLine = null;

        this.multiplayer = new GameMultiplayer({ maxPlayers: 2 });
        this.mode = 'local';
        this.localPlayerId = 0;

        this.winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        this.initUI();
        this.setupMultiplayerCallbacks();
        this.bindEvents();
    }

    initUI() {
        this.ui = {
            setupScreen: document.getElementById('setup-screen'),
            gameScreen: document.getElementById('game-screen'),
            localModeBtn: document.getElementById('local-mode-btn'),
            onlineModeBtn: document.getElementById('online-mode-btn'),
            localSetup: document.getElementById('local-setup'),
            onlineSetup: document.getElementById('online-setup'),
            player1Name: document.getElementById('player1-name'),
            player2Name: document.getElementById('player2-name'),
            onlineOptionsPanel: document.getElementById('online-options-panel'),
            onlineName: document.getElementById('online-name'),
            hostGameBtn: document.getElementById('host-game-btn'),
            joinGameBtn: document.getElementById('join-game-btn'),
            hostGamePanel: document.getElementById('host-game-panel'),
            hostStatus: document.getElementById('host-status'),
            hostInfo: document.getElementById('host-info'),
            hostRoomCode: document.getElementById('host-room-code'),
            copyCodeBtn: document.getElementById('copy-code-btn'),
            cancelHostBtn: document.getElementById('cancel-host-btn'),
            joinGamePanel: document.getElementById('join-game-panel'),
            roomCodeInput: document.getElementById('room-code-input'),
            connectRoomBtn: document.getElementById('connect-room-btn'),
            joinStatus: document.getElementById('join-status'),
            backFromJoinBtn: document.getElementById('back-from-join-btn'),
            startLocalBtn: document.getElementById('start-local-btn'),
            board: document.getElementById('board'),
            cells: document.querySelectorAll('.cell'),
            turnIndicator: document.getElementById('turn-indicator'),
            playerX: document.getElementById('player-x'),
            playerO: document.getElementById('player-o'),
            playerXName: document.getElementById('player-x-name'),
            playerOName: document.getElementById('player-o-name'),
            playerXScore: document.getElementById('player-x-score'),
            playerOScore: document.getElementById('player-o-score'),
            gameResult: document.getElementById('game-result'),
            resultText: document.getElementById('result-text'),
            playAgainBtn: document.getElementById('play-again-btn'),
            backBtn: document.getElementById('back-btn'),
            restartBtn: document.getElementById('restart-btn')
        };
    }

    setupMultiplayerCallbacks() {
        this.multiplayer.onPlayerJoined = (data) => {
            this.players[1].name = data.playerInfo.name;
            const waitingEl = this.ui.hostInfo?.querySelector('.host-waiting');
            if (waitingEl) {
                waitingEl.innerHTML = `<i class="fas fa-check"></i> ${data.playerInfo.name} joined!`;
            }
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
                this.ui.joinStatus.innerHTML = '<i class="fas fa-check"></i> Connected! Waiting for host...';
            }
        };
    }

    bindEvents() {
        const on = (el, handler) => el?.addEventListener('click', handler);

        on(this.ui.localModeBtn, () => this.selectMode('local'));
        on(this.ui.onlineModeBtn, () => this.selectMode('online'));
        on(this.ui.hostGameBtn, () => this.hostGame());
        on(this.ui.joinGameBtn, () => this.showJoinPanel());
        on(this.ui.cancelHostBtn, () => this.cancelHost());
        on(this.ui.copyCodeBtn, () => this.copyCode());
        on(this.ui.connectRoomBtn, () => this.connectToRoom());
        on(this.ui.backFromJoinBtn, () => this.showOnlineOptions());
        on(this.ui.startLocalBtn, () => this.startLocalGame());
        on(this.ui.playAgainBtn, () => this.playAgain());
        on(this.ui.backBtn, () => this.returnToMenu());
        on(this.ui.restartBtn, () => this.playAgain());

        this.ui.cells?.forEach((cell, i) => {
            cell.addEventListener('click', () => this.handleCellClick(i));
        });

        this.ui.roomCodeInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });

        this.ui.roomCodeInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.connectToRoom();
        });
    }

    selectMode(mode) {
        this.mode = mode;
        this.ui.localModeBtn?.classList.toggle('active', mode === 'local');
        this.ui.onlineModeBtn?.classList.toggle('active', mode === 'online');
        this.ui.localSetup?.classList.toggle('hidden', mode !== 'local');
        this.ui.onlineSetup?.classList.toggle('hidden', mode !== 'online');
        if (mode === 'online') this.showOnlineOptions();
    }

    showOnlineOptions() {
        this.multiplayer?.disconnect();
        this.ui.onlineOptionsPanel?.classList.remove('hidden');
        this.ui.hostGamePanel?.classList.add('hidden');
        this.ui.joinGamePanel?.classList.add('hidden');
        this.ui.joinStatus?.classList.add('hidden');
    }

    showJoinPanel() {
        this.ui.onlineOptionsPanel?.classList.add('hidden');
        this.ui.joinGamePanel?.classList.remove('hidden');
        this.ui.joinStatus?.classList.add('hidden');
        if (this.ui.roomCodeInput) {
            this.ui.roomCodeInput.value = '';
            this.ui.roomCodeInput.focus();
        }
    }

    async hostGame() {
        const playerName = this.ui.onlineName?.value?.trim() || 'Player 1';
        this.players[0].name = playerName;

        this.ui.onlineOptionsPanel?.classList.add('hidden');
        this.ui.hostGamePanel?.classList.remove('hidden');
        if (this.ui.hostStatus) {
            this.ui.hostStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating room...';
            this.ui.hostStatus.classList.remove('hidden');
        }
        this.ui.hostInfo?.classList.add('hidden');

        try {
            const roomCode = await this.multiplayer.initAsHost({ name: playerName });
            this.localPlayerId = 0;
            this.ui.hostStatus?.classList.add('hidden');
            this.ui.hostInfo?.classList.remove('hidden');
            if (this.ui.hostRoomCode) this.ui.hostRoomCode.textContent = roomCode;
        } catch (err) {
            if (this.ui.hostStatus) {
                this.ui.hostStatus.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message || 'Failed to create room'}`;
            }
        }
    }

    copyCode() {
        const code = this.ui.hostRoomCode?.textContent;
        if (!code) return;

        navigator.clipboard.writeText(code).then(() => {
            const btn = this.ui.copyCodeBtn;
            if (btn) {
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => { btn.innerHTML = original; }, 2000);
            }
        }).catch(() => {
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = code;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);

            const btn = this.ui.copyCodeBtn;
            if (btn) {
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => { btn.innerHTML = original; }, 2000);
            }
        });
    }

    cancelHost() {
        this.multiplayer?.disconnect();
        this.showOnlineOptions();
    }

    async connectToRoom() {
        const roomCode = (this.ui.roomCodeInput?.value?.trim() || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (!roomCode || roomCode.length !== 6) {
            if (this.ui.joinStatus) {
                this.ui.joinStatus.textContent = 'Enter a 6-character room code';
                this.ui.joinStatus.classList.remove('hidden');
            }
            return;
        }

        const playerName = this.ui.onlineName?.value?.trim() || 'Player 2';
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
        this.players[0].name = this.ui.player1Name?.value?.trim() || 'Player 1';
        this.players[1].name = this.ui.player2Name?.value?.trim() || 'Player 2';
        this.multiplayer?.initLocal();
        this.startGame();
    }

    startOnlineGame() {
        if (!this.multiplayer?.isHost) return;
        this.multiplayer.startGame({ players: this.players });
        this.startGame();
    }

    startGame() {
        this.ui.setupScreen?.classList.remove('active');
        this.ui.gameScreen?.classList.add('active');
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

        this.ui.cells?.forEach(cell => {
            cell.textContent = '';
            cell.className = 'cell';
        });

        this.ui.gameResult?.classList.add('hidden');
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
        if (this.ui.turnIndicator) {
            this.ui.turnIndicator.innerHTML = `<span class="player-symbol ${player.symbol.toLowerCase()}">${player.symbol}</span> ${player.name}'s Turn`;
        }
    }

    updateActivePlayer() {
        this.ui.playerX?.classList.toggle('active', this.currentPlayer === 0);
        this.ui.playerO?.classList.toggle('active', this.currentPlayer === 1);
    }

    handleCellClick(index) {
        if (this.gameOver || this.board[index] !== null) return;
        if (this.multiplayer?.isOnline() && this.currentPlayer !== this.localPlayerId) return;

        this.makeMove(index);
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
        } else if (this.board.every(c => c !== null)) {
            this.endGame('draw');
        } else {
            this.currentPlayer = 1 - this.currentPlayer;
            this.updateTurnIndicator();
            this.updateActivePlayer();
        }
    }

    checkWin() {
        for (const [a, b, c] of this.winPatterns) {
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                this.winningLine = [a, b, c];
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

            this.winningLine?.forEach(i => {
                this.ui.cells?.[i]?.classList.add('winning');
            });
        }

        this.ui.gameResult?.classList.remove('hidden');
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

        this.ui.cells?.forEach((cell, i) => {
            const value = this.board[i];
            cell.textContent = value || '';
            cell.className = 'cell';
            if (value) cell.classList.add('taken', value.toLowerCase());
        });

        this.updatePlayerInfo();
        this.updateTurnIndicator();
        this.updateActivePlayer();

        if (this.gameOver) {
            this.winningLine?.forEach(i => {
                this.ui.cells?.[i]?.classList.add('winning');
            });

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
            this.ui.gameResult?.classList.remove('hidden');
        } else {
            this.ui.gameResult?.classList.add('hidden');
        }
    }

    returnToMenu() {
        this.multiplayer?.disconnect();
        this.players[0].score = 0;
        this.players[1].score = 0;
        this.ui.gameScreen?.classList.remove('active');
        this.ui.setupScreen?.classList.add('active');
        this.showOnlineOptions();
        if (this.ui.roomCodeInput) this.ui.roomCodeInput.value = '';
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.game = new TicTacToe(); });
} else {
    window.game = new TicTacToe();
}
