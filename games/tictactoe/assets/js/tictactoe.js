// Tic Tac Toe - Simple Version

var board = [null,null,null,null,null,null,null,null,null];
var currentPlayer = 0;
var players = [
    { name: 'Player 1', symbol: 'X', score: 0 },
    { name: 'Player 2', symbol: 'O', score: 0 }
];
var gameOver = false;
var mode = 'local';
var multiplayer = null;
var localPlayerId = 0;

var winPatterns = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
];

// Wait for DOM
document.addEventListener('DOMContentLoaded', function() {
    multiplayer = new GameMultiplayer({ maxPlayers: 2 });
    setupMultiplayer();
    bindEvents();
});

function setupMultiplayer() {
    multiplayer.onPlayerJoined = function(data) {
        players[1].name = data.playerInfo.name;
        document.querySelector('.host-waiting').innerHTML = '<i class="fas fa-check"></i> ' + data.playerInfo.name + ' joined!';
        setTimeout(startOnlineGame, 1000);
    };

    multiplayer.onPlayerLeft = function() {
        if (mode === 'online') {
            alert('Opponent disconnected');
            returnToMenu();
        }
    };

    multiplayer.onGameStart = function(state) {
        players = state.players;
        localPlayerId = multiplayer.localPlayerId;
        startGame();
    };

    multiplayer.onGameStateReceived = function(state) {
        applyGameState(state);
    };

    multiplayer.onConnectionError = function(msg) {
        var el = document.getElementById('join-status');
        el.textContent = msg;
        el.classList.remove('hidden');
    };

    multiplayer.onConnectionReady = function() {
        var el = document.getElementById('join-status');
        el.innerHTML = '<i class="fas fa-check"></i> Connected! Waiting for host...';
    };
}

function bindEvents() {
    // Mode buttons
    document.getElementById('local-mode-btn').onclick = function() { selectMode('local'); };
    document.getElementById('online-mode-btn').onclick = function() { selectMode('online'); };

    // Local start
    document.getElementById('start-local-btn').onclick = startLocalGame;

    // Online buttons
    document.getElementById('host-game-btn').onclick = hostGame;
    document.getElementById('join-game-btn').onclick = showJoinPanel;
    document.getElementById('cancel-host-btn').onclick = cancelHost;
    document.getElementById('copy-code-btn').onclick = copyCode;
    document.getElementById('connect-room-btn').onclick = connectToRoom;
    document.getElementById('back-from-join-btn').onclick = showOnlineOptions;

    // Game buttons
    document.getElementById('play-again-btn').onclick = playAgain;
    document.getElementById('back-btn').onclick = returnToMenu;
    document.getElementById('restart-btn').onclick = playAgain;

    // Board cells
    var cells = document.querySelectorAll('.cell');
    for (var i = 0; i < cells.length; i++) {
        (function(index) {
            cells[index].onclick = function() { cellClick(index); };
        })(i);
    }

    // Room code input
    var input = document.getElementById('room-code-input');
    input.oninput = function() {
        this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    };
    input.onkeypress = function(e) {
        if (e.key === 'Enter') connectToRoom();
    };
}

function selectMode(m) {
    mode = m;
    document.getElementById('local-mode-btn').classList.toggle('active', m === 'local');
    document.getElementById('online-mode-btn').classList.toggle('active', m === 'online');
    document.getElementById('local-setup').classList.toggle('hidden', m !== 'local');
    document.getElementById('online-setup').classList.toggle('hidden', m !== 'online');
    if (m === 'online') showOnlineOptions();
}

function showOnlineOptions() {
    multiplayer.disconnect();
    document.getElementById('online-options-panel').classList.remove('hidden');
    document.getElementById('host-game-panel').classList.add('hidden');
    document.getElementById('join-game-panel').classList.add('hidden');
}

function showJoinPanel() {
    document.getElementById('online-options-panel').classList.add('hidden');
    document.getElementById('join-game-panel').classList.remove('hidden');
    document.getElementById('join-status').classList.add('hidden');
    document.getElementById('room-code-input').value = '';
    document.getElementById('room-code-input').focus();
}

function hostGame() {
    var name = document.getElementById('online-name').value.trim() || 'Player 1';
    players[0].name = name;

    document.getElementById('online-options-panel').classList.add('hidden');
    document.getElementById('host-game-panel').classList.remove('hidden');
    document.getElementById('host-status').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating room...';
    document.getElementById('host-status').classList.remove('hidden');
    document.getElementById('host-info').classList.add('hidden');

    multiplayer.initAsHost({ name: name }).then(function(roomCode) {
        localPlayerId = 0;
        document.getElementById('host-status').classList.add('hidden');
        document.getElementById('host-info').classList.remove('hidden');
        document.getElementById('host-room-code').textContent = roomCode;
    }).catch(function(err) {
        document.getElementById('host-status').innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + (err.message || 'Failed');
    });
}

function copyCode() {
    var code = document.getElementById('host-room-code').textContent;
    if (!code) return;

    // Try modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function() {
            showCopied();
        }).catch(function() {
            fallbackCopy(code);
        });
    } else {
        fallbackCopy(code);
    }
}

function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showCopied();
    } catch(e) {
        alert('Copy failed. Code: ' + text);
    }
    document.body.removeChild(ta);
}

function showCopied() {
    var btn = document.getElementById('copy-code-btn');
    var orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(function() { btn.innerHTML = orig; }, 2000);
}

function cancelHost() {
    multiplayer.disconnect();
    showOnlineOptions();
}

function connectToRoom() {
    var code = document.getElementById('room-code-input').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    var status = document.getElementById('join-status');

    if (code.length !== 6) {
        status.textContent = 'Enter a 6-character code';
        status.classList.remove('hidden');
        return;
    }

    var name = document.getElementById('online-name').value.trim() || 'Player 2';
    status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    status.classList.remove('hidden');

    multiplayer.initAsGuest(code, { name: name }).then(function() {
        players[1].name = name;
        localPlayerId = 1;
    }).catch(function() {
        // Error shown via callback
    });
}

function startLocalGame() {
    mode = 'local';
    players[0].name = document.getElementById('player1-name').value.trim() || 'Player 1';
    players[1].name = document.getElementById('player2-name').value.trim() || 'Player 2';
    multiplayer.initLocal();
    startGame();
}

function startOnlineGame() {
    if (!multiplayer.isHost) return;
    multiplayer.startGame({ players: players });
    startGame();
}

function startGame() {
    document.getElementById('setup-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    resetBoard();
    updateUI();
}

function resetBoard() {
    board = [null,null,null,null,null,null,null,null,null];
    currentPlayer = 0;
    gameOver = false;

    var cells = document.querySelectorAll('.cell');
    for (var i = 0; i < cells.length; i++) {
        cells[i].textContent = '';
        cells[i].className = 'cell';
    }

    document.getElementById('game-result').classList.add('hidden');
    updateUI();
}

function updateUI() {
    // Player names and scores
    document.getElementById('player-x-name').textContent = players[0].name;
    document.getElementById('player-o-name').textContent = players[1].name;
    document.getElementById('player-x-score').textContent = players[0].score;
    document.getElementById('player-o-score').textContent = players[1].score;

    // Turn indicator
    var p = players[currentPlayer];
    document.getElementById('turn-indicator').innerHTML =
        '<span class="player-symbol ' + p.symbol.toLowerCase() + '">' + p.symbol + '</span> ' + p.name + "'s Turn";

    // Active player highlight
    document.getElementById('player-x').classList.toggle('active', currentPlayer === 0);
    document.getElementById('player-o').classList.toggle('active', currentPlayer === 1);
}

function cellClick(index) {
    if (gameOver || board[index] !== null) return;
    if (multiplayer.isOnline() && currentPlayer !== localPlayerId) return;

    makeMove(index);

    if (multiplayer.isOnline()) {
        multiplayer.sendGameState(getState());
    }
}

function makeMove(index) {
    var symbol = players[currentPlayer].symbol;
    board[index] = symbol;

    var cell = document.querySelectorAll('.cell')[index];
    cell.textContent = symbol;
    cell.classList.add('taken', symbol.toLowerCase());

    var winner = checkWin();
    if (winner) {
        endGame(winner);
    } else if (board.indexOf(null) === -1) {
        endGame('draw');
    } else {
        currentPlayer = 1 - currentPlayer;
        updateUI();
    }
}

function checkWin() {
    for (var i = 0; i < winPatterns.length; i++) {
        var a = winPatterns[i][0], b = winPatterns[i][1], c = winPatterns[i][2];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            // Highlight winning cells
            var cells = document.querySelectorAll('.cell');
            cells[a].classList.add('winning');
            cells[b].classList.add('winning');
            cells[c].classList.add('winning');
            return board[a];
        }
    }
    return null;
}

function endGame(result) {
    gameOver = true;
    var text = document.getElementById('result-text');

    if (result === 'draw') {
        text.textContent = "It's a draw!";
        text.className = 'result-text draw';
    } else {
        var p = players[currentPlayer];
        p.score++;
        text.textContent = p.name + ' wins!';
        text.className = 'result-text win-' + result.toLowerCase();
        updateUI();
    }

    document.getElementById('game-result').classList.remove('hidden');
}

function playAgain() {
    resetBoard();
    if (multiplayer.isOnline() && multiplayer.isHost) {
        multiplayer.sendGameState(getState());
    }
}

function getState() {
    return {
        board: board,
        currentPlayer: currentPlayer,
        players: players,
        gameOver: gameOver
    };
}

function applyGameState(state) {
    board = state.board;
    currentPlayer = state.currentPlayer;
    players = state.players;
    gameOver = state.gameOver;

    var cells = document.querySelectorAll('.cell');
    for (var i = 0; i < cells.length; i++) {
        var val = board[i];
        cells[i].textContent = val || '';
        cells[i].className = 'cell';
        if (val) cells[i].classList.add('taken', val.toLowerCase());
    }

    updateUI();

    if (gameOver) {
        checkWin(); // Re-highlight winner
        var text = document.getElementById('result-text');
        if (board.indexOf(null) === -1 && !checkWin()) {
            text.textContent = "It's a draw!";
            text.className = 'result-text draw';
        }
        document.getElementById('game-result').classList.remove('hidden');
    } else {
        document.getElementById('game-result').classList.add('hidden');
    }
}

function returnToMenu() {
    multiplayer.disconnect();
    players[0].score = 0;
    players[1].score = 0;
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('setup-screen').classList.add('active');
    showOnlineOptions();
}
