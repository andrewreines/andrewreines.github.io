/**
 * Monopoly Game Engine
 * Main game logic, UI handling, and state management
 * 100% frontend-only implementation
 */

const MonopolyGame = {
    // Game state
    state: {
        players: [],
        currentPlayerIndex: 0,
        properties: {}, // propertyId -> { owner, houses, mortgaged }
        chanceCards: [],
        communityCards: [],
        freeParkingPot: 0,
        gameStarted: false,
        gameOver: false,
        winner: null,
        doublesCount: 0,
        awaitingAction: null, // Current action player must take
        lastDiceRoll: [0, 0]
    },

    // UI Elements cache
    ui: {},

    // Mode
    mode: 'local', // 'local' or 'online'

    // Initialize the game
    init() {
        this.cacheUIElements();
        this.setupEventListeners();
        this.initPlayerSetup();
        this.initTokenSelection();
        console.log('Monopoly Game initialized');
    },

    // Cache UI elements for performance
    cacheUIElements() {
        this.ui = {
            // Screens
            setupScreen: document.getElementById('setup-screen'),
            gameScreen: document.getElementById('game-screen'),

            // Setup elements
            localModeBtn: document.getElementById('local-mode-btn'),
            onlineModeBtn: document.getElementById('online-mode-btn'),
            localSetup: document.getElementById('local-setup'),
            onlineSetup: document.getElementById('online-setup'),
            playerSetup: document.getElementById('player-setup'),
            addPlayerBtn: document.getElementById('add-player-btn'),
            removePlayerBtn: document.getElementById('remove-player-btn'),
            startLocalBtn: document.getElementById('start-local-btn'),

            // Online setup
            createRoomBtn: document.getElementById('create-room-btn'),
            joinRoomBtn: document.getElementById('join-room-btn'),
            createRoomPanel: document.getElementById('create-room-panel'),
            joinRoomPanel: document.getElementById('join-room-panel'),
            hostName: document.getElementById('host-name'),
            hostTokenSelection: document.getElementById('host-token-selection'),
            generateRoomBtn: document.getElementById('generate-room-btn'),
            roomCodeDisplay: document.getElementById('room-code-display'),
            roomCode: document.getElementById('room-code'),
            copyCodeBtn: document.getElementById('copy-code-btn'),
            connectedPlayers: document.getElementById('connected-players'),
            startOnlineBtn: document.getElementById('start-online-btn'),
            joinName: document.getElementById('join-name'),
            joinTokenSelection: document.getElementById('join-token-selection'),
            roomCodeInput: document.getElementById('room-code-input'),
            connectRoomBtn: document.getElementById('connect-room-btn'),
            joinStatus: document.getElementById('join-status'),
            joinStatusText: document.getElementById('join-status-text'),

            // Game elements
            gameBoard: document.getElementById('game-board'),
            playerPanel: document.getElementById('player-panel'),
            currentTurnDisplay: document.getElementById('current-turn-display'),
            die1: document.getElementById('die1'),
            die2: document.getElementById('die2'),
            diceTotal: document.getElementById('dice-total'),
            rollDiceBtn: document.getElementById('roll-dice-btn'),
            endTurnBtn: document.getElementById('end-turn-btn'),
            gameLogList: document.getElementById('game-log-list'),

            // Modals
            gameMenuModal: document.getElementById('game-menu-modal'),
            propertyModal: document.getElementById('property-modal'),
            cardModal: document.getElementById('card-modal'),
            auctionModal: document.getElementById('auction-modal'),
            tradeModal: document.getElementById('trade-modal'),
            tradeResponseModal: document.getElementById('trade-response-modal'),
            propertyManagementModal: document.getElementById('property-management-modal'),
            bankruptcyModal: document.getElementById('bankruptcy-modal'),
            gameoverModal: document.getElementById('gameover-modal'),

            // Menu buttons
            menuBtn: document.getElementById('menu-btn'),
            resumeGameBtn: document.getElementById('resume-game-btn'),
            tradeBtn: document.getElementById('trade-btn'),
            mortgageBtn: document.getElementById('mortgage-btn'),
            quitGameBtn: document.getElementById('quit-game-btn'),
            fullscreenBtn: document.getElementById('fullscreen-btn'),

            // Property modal
            modalPropertyCard: document.getElementById('modal-property-card'),
            modalPropertyHeader: document.getElementById('modal-property-header'),
            modalPropertyName: document.getElementById('modal-property-name'),
            modalPropertyPrice: document.getElementById('modal-property-price'),
            modalRentBase: document.getElementById('modal-rent-base'),
            modalRent1: document.getElementById('modal-rent-1'),
            modalRent2: document.getElementById('modal-rent-2'),
            modalRent3: document.getElementById('modal-rent-3'),
            modalRent4: document.getElementById('modal-rent-4'),
            modalRentHotel: document.getElementById('modal-rent-hotel'),
            modalHouseCost: document.getElementById('modal-house-cost'),
            buyPropertyBtn: document.getElementById('buy-property-btn'),
            auctionPropertyBtn: document.getElementById('auction-property-btn'),
            closePropertyModalBtn: document.getElementById('close-property-modal-btn'),

            // Card modal
            cardType: document.getElementById('card-type'),
            cardText: document.getElementById('card-text'),
            closeCardModalBtn: document.getElementById('close-card-modal-btn'),

            // Auction
            auctionPropertyDisplay: document.getElementById('auction-property-display'),
            currentBid: document.getElementById('current-bid'),
            highestBidder: document.getElementById('highest-bidder'),
            bidAmount: document.getElementById('bid-amount'),
            placeBidBtn: document.getElementById('place-bid-btn'),
            passAuctionBtn: document.getElementById('pass-auction-btn'),

            // Trade
            tradeOfferMoney: document.getElementById('trade-offer-money'),
            tradeOfferProperties: document.getElementById('trade-offer-properties'),
            tradePartnerSelect: document.getElementById('trade-partner-select'),
            tradeWantMoney: document.getElementById('trade-want-money'),
            tradeWantProperties: document.getElementById('trade-want-properties'),
            proposeTrade: document.getElementById('propose-trade-btn'),
            cancelTrade: document.getElementById('cancel-trade-btn'),

            // Trade response
            tradeProposalDetails: document.getElementById('trade-proposal-details'),
            acceptTradeBtn: document.getElementById('accept-trade-btn'),
            rejectTradeBtn: document.getElementById('reject-trade-btn'),

            // Property management
            ownedPropertiesList: document.getElementById('owned-properties-list'),
            closeManagementBtn: document.getElementById('close-management-btn'),

            // Bankruptcy
            bankruptcyMessage: document.getElementById('bankruptcy-message'),
            mortgageToPayBtn: document.getElementById('mortgage-to-pay-btn'),
            declareBankruptcyBtn: document.getElementById('declare-bankruptcy-btn'),

            // Game over
            winnerName: document.getElementById('winner-name'),
            finalStandings: document.getElementById('final-standings'),
            newGameBtn: document.getElementById('new-game-btn')
        };
    },

    // Setup event listeners
    setupEventListeners() {
        // Mode selection
        this.ui.localModeBtn.addEventListener('click', () => this.selectMode('local'));
        this.ui.onlineModeBtn.addEventListener('click', () => this.selectMode('online'));

        // Local setup
        this.ui.addPlayerBtn.addEventListener('click', () => this.addPlayer());
        this.ui.removePlayerBtn.addEventListener('click', () => this.removePlayer());
        this.ui.startLocalBtn.addEventListener('click', () => this.startLocalGame());

        // Online setup
        this.ui.createRoomBtn.addEventListener('click', () => this.showCreateRoom());
        this.ui.joinRoomBtn.addEventListener('click', () => this.showJoinRoom());
        this.ui.generateRoomBtn.addEventListener('click', () => this.generateRoom());
        this.ui.copyCodeBtn.addEventListener('click', () => this.copyRoomCode());
        this.ui.connectRoomBtn.addEventListener('click', () => this.connectToRoom());
        this.ui.startOnlineBtn.addEventListener('click', () => this.startOnlineGame());

        // Game controls
        this.ui.rollDiceBtn.addEventListener('click', () => this.rollDice());
        this.ui.endTurnBtn.addEventListener('click', () => this.endTurn());

        // Menu
        this.ui.menuBtn.addEventListener('click', () => this.showModal(this.ui.gameMenuModal));
        this.ui.resumeGameBtn.addEventListener('click', () => this.hideModal(this.ui.gameMenuModal));
        this.ui.tradeBtn.addEventListener('click', () => this.openTradeModal());
        this.ui.mortgageBtn.addEventListener('click', () => this.openPropertyManagement());
        this.ui.quitGameBtn.addEventListener('click', () => this.quitGame());
        this.ui.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Property modal
        this.ui.buyPropertyBtn.addEventListener('click', () => this.buyProperty());
        this.ui.auctionPropertyBtn.addEventListener('click', () => this.startAuction());
        this.ui.closePropertyModalBtn.addEventListener('click', () => this.closePropertyModal());

        // Card modal
        this.ui.closeCardModalBtn.addEventListener('click', () => this.closeCardModal());

        // Auction
        this.ui.placeBidBtn.addEventListener('click', () => this.placeBid());
        this.ui.passAuctionBtn.addEventListener('click', () => this.passAuction());

        // Trade
        this.ui.proposeTrade.addEventListener('click', () => this.proposeTrade());
        this.ui.cancelTrade.addEventListener('click', () => this.hideModal(this.ui.tradeModal));
        this.ui.acceptTradeBtn.addEventListener('click', () => this.acceptTrade());
        this.ui.rejectTradeBtn.addEventListener('click', () => this.rejectTrade());

        // Property management
        this.ui.closeManagementBtn.addEventListener('click', () => this.hideModal(this.ui.propertyManagementModal));

        // Bankruptcy
        this.ui.mortgageToPayBtn.addEventListener('click', () => this.openPropertyManagement());
        this.ui.declareBankruptcyBtn.addEventListener('click', () => this.declareBankruptcy());

        // Game over
        this.ui.newGameBtn.addEventListener('click', () => this.newGame());

        // Trade partner selection
        this.ui.tradePartnerSelect.addEventListener('change', () => this.updateTradePartnerProperties());
    },

    // Initialize player setup
    initPlayerSetup() {
        // Start with 2 players
        this.playerCount = 2;
        this.renderPlayerInputs();
    },

    // Initialize token selection for online mode
    initTokenSelection() {
        const tokens = MonopolyData.tokens;

        // Host token selection
        let hostHtml = '';
        let joinHtml = '';

        tokens.forEach((token, index) => {
            const selected = index === 0 ? 'selected' : '';
            hostHtml += `<div class="token-option ${selected}" data-token="${token.id}">${token.emoji}</div>`;
            joinHtml += `<div class="token-option ${index === 1 ? 'selected' : ''}" data-token="${token.id}">${token.emoji}</div>`;
        });

        this.ui.hostTokenSelection.innerHTML = hostHtml;
        this.ui.joinTokenSelection.innerHTML = joinHtml;

        // Add click handlers
        this.ui.hostTokenSelection.querySelectorAll('.token-option').forEach(el => {
            el.addEventListener('click', (e) => this.selectToken(e.target, 'host'));
        });
        this.ui.joinTokenSelection.querySelectorAll('.token-option').forEach(el => {
            el.addEventListener('click', (e) => this.selectToken(e.target, 'join'));
        });
    },

    // Select token
    selectToken(element, type) {
        const container = type === 'host' ? this.ui.hostTokenSelection : this.ui.joinTokenSelection;
        container.querySelectorAll('.token-option').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
    },

    // Render player input fields
    renderPlayerInputs() {
        let html = '';
        for (let i = 0; i < this.playerCount; i++) {
            const color = MonopolyData.playerColors[i];
            const token = MonopolyData.tokens[i];
            html += `
                <div class="player-input" data-player="${i}">
                    <div class="player-number" style="background: ${color}; color: #fff;">${i + 1}</div>
                    <input type="text" placeholder="Player ${i + 1}" maxlength="15" value="Player ${i + 1}">
                    <div class="token-selector">
                        ${MonopolyData.tokens.map((t, ti) => `
                            <div class="token-option ${ti === i ? 'selected' : ''}"
                                 data-token="${t.id}"
                                 title="${t.name}">${t.emoji}</div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        this.ui.playerSetup.innerHTML = html;

        // Add token selection handlers
        this.ui.playerSetup.querySelectorAll('.player-input').forEach(input => {
            input.querySelectorAll('.token-option').forEach(token => {
                token.addEventListener('click', (e) => {
                    input.querySelectorAll('.token-option').forEach(t => t.classList.remove('selected'));
                    e.target.classList.add('selected');
                    this.updateTokenAvailability();
                });
            });
        });

        this.updateTokenAvailability();
    },

    // Update token availability
    updateTokenAvailability() {
        const selectedTokens = new Set();

        this.ui.playerSetup.querySelectorAll('.player-input').forEach(input => {
            const selected = input.querySelector('.token-option.selected');
            if (selected) {
                selectedTokens.add(selected.dataset.token);
            }
        });

        this.ui.playerSetup.querySelectorAll('.player-input').forEach(input => {
            const thisSelected = input.querySelector('.token-option.selected')?.dataset.token;
            input.querySelectorAll('.token-option').forEach(token => {
                if (token.dataset.token !== thisSelected && selectedTokens.has(token.dataset.token)) {
                    token.classList.add('taken');
                } else {
                    token.classList.remove('taken');
                }
            });
        });
    },

    // Add player
    addPlayer() {
        if (this.playerCount < 6) {
            this.playerCount++;
            this.renderPlayerInputs();
        }
    },

    // Remove player
    removePlayer() {
        if (this.playerCount > 2) {
            this.playerCount--;
            this.renderPlayerInputs();
        }
    },

    // Select game mode
    selectMode(mode) {
        this.mode = mode;

        this.ui.localModeBtn.classList.toggle('active', mode === 'local');
        this.ui.onlineModeBtn.classList.toggle('active', mode === 'online');

        this.ui.localSetup.classList.toggle('hidden', mode !== 'local');
        this.ui.onlineSetup.classList.toggle('hidden', mode !== 'online');

        // Reset online panels
        this.ui.createRoomPanel.classList.add('hidden');
        this.ui.joinRoomPanel.classList.add('hidden');
    },

    // Show create room panel
    showCreateRoom() {
        this.ui.createRoomPanel.classList.remove('hidden');
        this.ui.joinRoomPanel.classList.add('hidden');
    },

    // Show join room panel
    showJoinRoom() {
        this.ui.joinRoomPanel.classList.remove('hidden');
        this.ui.createRoomPanel.classList.add('hidden');
    },

    // Generate room code
    async generateRoom() {
        const name = this.ui.hostName.value.trim() || 'Host';
        const tokenEl = this.ui.hostTokenSelection.querySelector('.token-option.selected');
        const tokenId = tokenEl ? tokenEl.dataset.token : MonopolyData.tokens[0].id;

        this.ui.generateRoomBtn.disabled = true;
        this.ui.generateRoomBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        try {
            // Setup callbacks before initializing
            this.setupMultiplayerCallbacks();

            const roomCode = await MonopolyMultiplayer.initAsHost({
                name,
                token: tokenId
            });

            this.ui.roomCode.textContent = roomCode;
            this.ui.roomCodeDisplay.classList.remove('hidden');
            this.ui.generateRoomBtn.innerHTML = '<i class="fas fa-check"></i> Room Created';

        } catch (error) {
            console.error('Error creating room:', error);
            alert('Failed to create room. Please try again.');
            this.ui.generateRoomBtn.disabled = false;
            this.ui.generateRoomBtn.innerHTML = '<i class="fas fa-key"></i> Create Room';
        }
    },

    // Copy room code
    async copyRoomCode() {
        const code = this.ui.roomCode.textContent;
        try {
            await navigator.clipboard.writeText(code);
            this.ui.copyCodeBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                this.ui.copyCodeBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Code';
            }, 2000);
        } catch (error) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = code;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.ui.copyCodeBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                this.ui.copyCodeBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Code';
            }, 2000);
        }
    },

    // Connect to room
    async connectToRoom() {
        const roomCode = this.ui.roomCodeInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const name = this.ui.joinName.value.trim() || 'Guest';
        const tokenEl = this.ui.joinTokenSelection.querySelector('.token-option.selected');
        const tokenId = tokenEl ? tokenEl.dataset.token : MonopolyData.tokens[1].id;

        if (!roomCode || roomCode.length !== 12) {
            alert('Please enter a valid 12-character room code');
            return;
        }

        this.ui.joinStatus.classList.remove('hidden');
        this.ui.joinStatusText.textContent = 'Connecting...';
        this.ui.connectRoomBtn.disabled = true;

        try {
            // Setup callbacks before connecting
            this.setupMultiplayerCallbacks();

            await MonopolyMultiplayer.initAsGuest(roomCode, {
                name,
                token: tokenId
            });

            this.ui.joinStatusText.innerHTML = `
                <i class="fas fa-check-circle" style="color: #27ae60; font-size: 2rem;"></i>
                <p style="margin-top: 10px;">Connected! Waiting for host to start the game...</p>
            `;

        } catch (error) {
            console.error('Error connecting:', error);
            this.ui.joinStatusText.innerHTML = `
                <i class="fas fa-times-circle" style="color: #e74c3c; font-size: 2rem;"></i>
                <p style="margin-top: 10px;">${error.message || 'Connection failed. Check the code and try again.'}</p>
            `;
            this.ui.connectRoomBtn.disabled = false;
        }
    },

    // Setup multiplayer callbacks
    setupMultiplayerCallbacks() {
        MonopolyMultiplayer.onPlayerJoined = (data) => {
            console.log('Player joined:', data);
            this.updateConnectedPlayersList();
        };

        MonopolyMultiplayer.onPlayerLeft = (playerId) => {
            console.log('Player left:', playerId);
            this.addToLog(`Player ${playerId + 1} disconnected`, true);
        };

        MonopolyMultiplayer.onGameStateReceived = (state) => {
            this.state = state;
            this.renderGame();
        };

        MonopolyMultiplayer.onActionReceived = (action, playerId) => {
            this.processAction(action, playerId);
        };

        MonopolyMultiplayer.onConnectionReady = () => {
            this.updateConnectedPlayersList();
            this.checkCanStartOnline();
        };
    },

    // Update connected players list
    updateConnectedPlayersList() {
        const count = MonopolyMultiplayer.getConnectedCount();
        let html = `<li>You (Host)</li>`;

        MonopolyMultiplayer.connections.forEach((conn, i) => {
            if (conn.playerInfo) {
                const token = MonopolyData.tokens.find(t => t.id === conn.playerInfo.token);
                html += `<li>${token?.emoji || ''} ${conn.playerInfo.name}</li>`;
            } else {
                html += `<li>Player ${i + 2}</li>`;
            }
        });

        this.ui.connectedPlayers.innerHTML = html;
        this.checkCanStartOnline();
    },

    // Check if online game can start
    checkCanStartOnline() {
        const count = MonopolyMultiplayer.getConnectedCount();
        this.ui.startOnlineBtn.disabled = count < 1;
        this.ui.startOnlineBtn.innerHTML = `<i class="fas fa-play"></i> Start Game (${count + 1} players)`;
    },

    // Start local game
    startLocalGame() {
        const players = [];
        const usedTokens = new Set();

        this.ui.playerSetup.querySelectorAll('.player-input').forEach((input, index) => {
            const name = input.querySelector('input').value.trim() || `Player ${index + 1}`;
            const tokenEl = input.querySelector('.token-option.selected');
            const tokenId = tokenEl ? tokenEl.dataset.token : MonopolyData.tokens[index].id;

            players.push({
                id: index,
                name,
                token: tokenId,
                money: MonopolyData.startingMoney,
                position: 0,
                inJail: false,
                jailTurns: 0,
                getOutOfJailCards: 0,
                bankrupt: false
            });
        });

        this.initGame(players, 'local');
    },

    // Start online game
    startOnlineGame() {
        // Gather all player info from connections
        const players = [];

        // Add host
        const hostToken = this.ui.hostTokenSelection.querySelector('.token-option.selected');
        players.push({
            id: 0,
            name: this.ui.hostName.value.trim() || 'Host',
            token: hostToken ? hostToken.dataset.token : MonopolyData.tokens[0].id,
            money: MonopolyData.startingMoney,
            position: 0,
            inJail: false,
            jailTurns: 0,
            getOutOfJailCards: 0,
            bankrupt: false,
            isLocal: true
        });

        // Add connected players
        MonopolyMultiplayer.connections.forEach((conn, i) => {
            if (conn.playerInfo) {
                players.push({
                    id: i + 1,
                    name: conn.playerInfo.name,
                    token: conn.playerInfo.token,
                    money: MonopolyData.startingMoney,
                    position: 0,
                    inJail: false,
                    jailTurns: 0,
                    getOutOfJailCards: 0,
                    bankrupt: false,
                    connectionId: conn.id
                });
            }
        });

        this.initGame(players, 'online');

        // Broadcast game state to all players
        MonopolyMultiplayer.sendGameState(this.state);
    },

    // Initialize the game
    initGame(players, mode) {
        this.mode = mode;

        // Initialize state
        this.state = {
            players,
            currentPlayerIndex: 0,
            properties: {},
            chanceCards: MonopolyData.shuffleArray([...MonopolyData.chanceCards]),
            communityCards: MonopolyData.shuffleArray([...MonopolyData.communityChestCards]),
            freeParkingPot: 0,
            gameStarted: true,
            gameOver: false,
            winner: null,
            doublesCount: 0,
            awaitingAction: null,
            lastDiceRoll: [0, 0]
        };

        // Switch to game screen
        this.ui.setupScreen.classList.remove('active');
        this.ui.gameScreen.classList.add('active');

        // Render the game
        this.renderBoard();
        this.renderPlayerPanel();
        this.updateTurnDisplay();
        this.clearLog();
        this.addToLog('Game started!', true);
        this.addToLog(`${this.getCurrentPlayer().name}'s turn`);
    },

    // Render the game board
    renderBoard() {
        let html = '';

        MonopolyData.squares.forEach((square, index) => {
            const isCorner = square.corner;
            const colorClass = square.group ? `color-${square.group.replace(/([A-Z])/g, '-$1').toLowerCase()}` : '';

            html += `
                <div class="board-square sq-${index} ${isCorner ? 'corner' : ''}" data-square="${index}">
                    ${square.type === 'property' ? `<div class="color-bar" style="background-color: ${MonopolyData.getGroupColor(square.group)}"></div>` : ''}
                    <div class="square-name">${this.getSquareDisplayName(square)}</div>
                    ${square.price ? `<div class="square-price">$${square.price}</div>` : ''}
                    <div class="square-tokens" id="tokens-${index}"></div>
                    <div class="square-buildings" id="buildings-${index}"></div>
                </div>
            `;
        });

        this.ui.gameBoard.innerHTML = html;

        // Add click handlers for properties
        this.ui.gameBoard.querySelectorAll('.board-square').forEach(sq => {
            sq.addEventListener('click', () => {
                const squareId = parseInt(sq.dataset.square);
                this.showSquareInfo(squareId);
            });
        });

        // Update tokens
        this.updateTokenPositions();
    },

    // Get display name for square
    getSquareDisplayName(square) {
        const name = square.shortName || square.name;
        if (name.length > 15) {
            return name.split(' ').map(w => w.length > 4 ? w.substring(0, 4) + '.' : w).join(' ');
        }
        return name;
    },

    // Update token positions on board
    updateTokenPositions() {
        // Clear all token containers
        for (let i = 0; i < 40; i++) {
            const container = document.getElementById(`tokens-${i}`);
            if (container) container.innerHTML = '';
        }

        // Place tokens
        this.state.players.forEach(player => {
            if (player.bankrupt) return;

            const container = document.getElementById(`tokens-${player.position}`);
            if (container) {
                const token = MonopolyData.tokens.find(t => t.id === player.token);
                const tokenEl = document.createElement('div');
                tokenEl.className = 'board-token';
                tokenEl.style.backgroundColor = MonopolyData.playerColors[player.id];
                tokenEl.textContent = token ? token.emoji : '●';
                tokenEl.title = player.name;
                container.appendChild(tokenEl);
            }
        });
    },

    // Update buildings on board
    updateBuildings() {
        // Clear all building containers
        for (let i = 0; i < 40; i++) {
            const container = document.getElementById(`buildings-${i}`);
            if (container) container.innerHTML = '';
        }

        // Place buildings
        for (const [propId, propState] of Object.entries(this.state.properties)) {
            if (propState.houses > 0) {
                const container = document.getElementById(`buildings-${propId}`);
                if (container) {
                    if (propState.houses === 5) {
                        // Hotel
                        container.innerHTML = '<div class="hotel"></div>';
                    } else {
                        // Houses
                        container.innerHTML = '<div class="house"></div>'.repeat(propState.houses);
                    }
                }
            }
        }
    },

    // Render player panel
    renderPlayerPanel() {
        let html = '';

        this.state.players.forEach((player, index) => {
            const token = MonopolyData.tokens.find(t => t.id === player.token);
            const isActive = index === this.state.currentPlayerIndex;
            const properties = this.getPlayerProperties(player.id);

            html += `
                <div class="player-card ${isActive ? 'active' : ''} ${player.bankrupt ? 'bankrupt' : ''}" data-player="${player.id}">
                    <div class="player-card-header">
                        <div class="player-token" style="background: ${MonopolyData.playerColors[player.id]}">${token ? token.emoji : '●'}</div>
                        <span class="player-name">${player.name}</span>
                    </div>
                    <div class="player-money">${player.bankrupt ? 'BANKRUPT' : '$' + player.money.toLocaleString()}</div>
                    <div class="player-properties">
                        ${properties.map(p => {
                const square = MonopolyData.squares[p.id];
                const color = MonopolyData.getGroupColor(square.group);
                const mortgaged = this.state.properties[p.id]?.mortgaged;
                return `<div class="property-dot ${mortgaged ? 'mortgaged' : ''}" style="background: ${color}" title="${square.name}"></div>`;
            }).join('')}
                    </div>
                </div>
            `;
        });

        this.ui.playerPanel.innerHTML = html;
    },

    // Get player properties
    getPlayerProperties(playerId) {
        const props = [];
        for (const [propId, propState] of Object.entries(this.state.properties)) {
            if (propState.owner === playerId) {
                props.push({ id: parseInt(propId), ...propState });
            }
        }
        return props;
    },

    // Update turn display
    updateTurnDisplay() {
        const player = this.getCurrentPlayer();
        const token = MonopolyData.tokens.find(t => t.id === player.token);
        this.ui.currentTurnDisplay.innerHTML = `${token ? token.emoji : ''} ${player.name}'s Turn`;
    },

    // Get current player
    getCurrentPlayer() {
        return this.state.players[this.state.currentPlayerIndex];
    },

    // Roll dice
    rollDice() {
        const player = this.getCurrentPlayer();

        // Check if it's this player's turn (for online mode)
        if (this.mode === 'online' && !this.isMyTurn()) {
            return;
        }

        // Check if in jail
        if (player.inJail) {
            this.handleJailTurn();
            return;
        }

        // Roll the dice
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const isDoubles = die1 === die2;
        const total = die1 + die2;

        this.state.lastDiceRoll = [die1, die2];

        // Animate dice
        this.animateDice(die1, die2);

        // Check for doubles
        if (isDoubles) {
            this.state.doublesCount++;
            if (this.state.doublesCount >= 3) {
                // Go to jail for 3 doubles
                this.addToLog(`${player.name} rolled doubles 3 times - Go to Jail!`, true);
                this.sendToJail(player);
                this.state.doublesCount = 0;
                this.endTurn();
                return;
            }
            this.addToLog(`${player.name} rolled doubles (${die1}+${die2}=${total})!`);
        } else {
            this.state.doublesCount = 0;
            this.addToLog(`${player.name} rolled ${die1}+${die2}=${total}`);
        }

        // Move player
        this.movePlayer(player, total);

        // If online, broadcast action
        if (this.mode === 'online' && MonopolyMultiplayer.isHost) {
            MonopolyMultiplayer.sendGameState(this.state);
        }
    },

    // Animate dice roll
    animateDice(value1, value2) {
        this.ui.die1.classList.add('rolling');
        this.ui.die2.classList.add('rolling');

        setTimeout(() => {
            this.ui.die1.classList.remove('rolling');
            this.ui.die2.classList.remove('rolling');
            this.renderDieFace(this.ui.die1.querySelector('.die-face'), value1);
            this.renderDieFace(this.ui.die2.querySelector('.die-face'), value2);
            this.ui.diceTotal.textContent = value1 + value2;
        }, 500);
    },

    // Render die face
    renderDieFace(container, value) {
        const patterns = {
            1: [4],
            2: [0, 8],
            3: [0, 4, 8],
            4: [0, 2, 6, 8],
            5: [0, 2, 4, 6, 8],
            6: [0, 2, 3, 5, 6, 8]
        };

        let html = '';
        for (let i = 0; i < 9; i++) {
            if (patterns[value].includes(i)) {
                html += '<div class="die-dot"></div>';
            } else {
                html += '<div></div>';
            }
        }
        container.innerHTML = html;
    },

    // Move player
    movePlayer(player, spaces) {
        const oldPosition = player.position;
        let newPosition = (oldPosition + spaces) % 40;

        // Check if passing GO
        if (newPosition < oldPosition && spaces > 0) {
            player.money += MonopolyData.goSalary;
            this.addToLog(`${player.name} passed GO and collected $${MonopolyData.goSalary}`);
        }

        player.position = newPosition;
        this.updateTokenPositions();
        this.renderPlayerPanel();

        // Handle landing on square
        setTimeout(() => {
            this.handleLanding(player, newPosition);
        }, 300);
    },

    // Handle landing on a square
    handleLanding(player, position) {
        const square = MonopolyData.squares[position];

        switch (square.type) {
            case 'property':
            case 'railroad':
            case 'utility':
                this.handlePropertyLanding(player, square);
                break;

            case 'chance':
                this.drawCard('chance', player);
                break;

            case 'community':
                this.drawCard('community', player);
                break;

            case 'tax':
                this.payTax(player, square);
                break;

            case 'gotojail':
                this.sendToJail(player);
                break;

            case 'go':
            case 'jail':
            case 'parking':
                // Safe squares - no action
                this.enableEndTurn();
                break;
        }
    },

    // Handle landing on property
    handlePropertyLanding(player, square) {
        const propState = this.state.properties[square.id];

        if (!propState || propState.owner === undefined) {
            // Unowned - offer to buy
            this.showPropertyPurchaseModal(square);
        } else if (propState.owner !== player.id && !propState.mortgaged) {
            // Owned by another player - pay rent
            const rent = this.calculateRent(square, propState);
            const owner = this.state.players[propState.owner];

            if (player.money >= rent) {
                player.money -= rent;
                owner.money += rent;
                this.addToLog(`${player.name} paid $${rent} rent to ${owner.name}`);
                this.renderPlayerPanel();
                this.enableEndTurn();
            } else {
                // Can't afford rent - bankruptcy handling
                this.handleBankruptcy(player, owner, rent);
            }
        } else {
            // Own property or mortgaged
            this.enableEndTurn();
        }
    },

    // Calculate rent
    calculateRent(square, propState) {
        const owner = this.state.players[propState.owner];

        if (square.type === 'railroad') {
            const railroadsOwned = this.countOwnedInGroup('railroad', propState.owner);
            return MonopolyData.railroadRent[railroadsOwned - 1];
        }

        if (square.type === 'utility') {
            const utilitiesOwned = this.countOwnedInGroup('utility', propState.owner);
            const multiplier = MonopolyData.utilityMultipliers[utilitiesOwned - 1];
            const diceTotal = this.state.lastDiceRoll[0] + this.state.lastDiceRoll[1];
            return diceTotal * multiplier;
        }

        // Regular property
        if (propState.houses === 0) {
            // Check if owner has monopoly
            const hasMonopoly = this.hasMonopoly(propState.owner, square.group);
            return hasMonopoly ? square.rent[0] * 2 : square.rent[0];
        }

        return square.rent[propState.houses];
    },

    // Count properties owned in group
    countOwnedInGroup(group, playerId) {
        const groupProps = MonopolyData.propertyGroups[group].properties;
        return groupProps.filter(propId =>
            this.state.properties[propId]?.owner === playerId
        ).length;
    },

    // Check if player has monopoly
    hasMonopoly(playerId, group) {
        const groupProps = MonopolyData.propertyGroups[group].properties;
        return groupProps.every(propId =>
            this.state.properties[propId]?.owner === playerId
        );
    },

    // Show property purchase modal
    showPropertyPurchaseModal(square) {
        this.currentPropertySquare = square;

        // Update modal content
        this.ui.modalPropertyName.textContent = square.name;
        this.ui.modalPropertyHeader.style.backgroundColor = MonopolyData.getGroupColor(square.group);
        this.ui.modalPropertyPrice.textContent = square.price;

        if (square.rent) {
            this.ui.modalRentBase.textContent = square.rent[0];
            this.ui.modalRent1.textContent = square.rent[1];
            this.ui.modalRent2.textContent = square.rent[2];
            this.ui.modalRent3.textContent = square.rent[3];
            this.ui.modalRent4.textContent = square.rent[4];
            this.ui.modalRentHotel.textContent = square.rent[5];
            this.ui.modalHouseCost.textContent = square.houseCost;
            document.querySelector('.rent-table').style.display = 'block';
            document.querySelector('.house-cost').style.display = 'block';
        } else {
            document.querySelector('.rent-table').style.display = 'none';
            document.querySelector('.house-cost').style.display = 'none';
        }

        const player = this.getCurrentPlayer();
        this.ui.buyPropertyBtn.disabled = player.money < square.price;

        this.showModal(this.ui.propertyModal);
        this.state.awaitingAction = 'buyProperty';
    },

    // Buy property
    buyProperty() {
        if (!this.currentPropertySquare) return;

        const player = this.getCurrentPlayer();
        const square = this.currentPropertySquare;

        if (player.money >= square.price) {
            player.money -= square.price;
            this.state.properties[square.id] = {
                owner: player.id,
                houses: 0,
                mortgaged: false
            };

            this.addToLog(`${player.name} bought ${square.name} for $${square.price}`, true);
            this.renderPlayerPanel();
            this.hideModal(this.ui.propertyModal);
            this.enableEndTurn();

            if (this.mode === 'online' && MonopolyMultiplayer.isHost) {
                MonopolyMultiplayer.sendGameState(this.state);
            }
        }
    },

    // Start auction
    startAuction() {
        const square = this.currentPropertySquare;
        this.hideModal(this.ui.propertyModal);

        this.auctionState = {
            property: square,
            currentBid: 0,
            highestBidder: null,
            currentBidderIndex: this.state.currentPlayerIndex,
            passedPlayers: new Set()
        };

        this.showAuctionModal();
    },

    // Show auction modal
    showAuctionModal() {
        const square = this.auctionState.property;
        this.ui.auctionPropertyDisplay.innerHTML = `
            <div style="background: ${MonopolyData.getGroupColor(square.group)}; padding: 10px; color: #fff;">
                ${square.name}
            </div>
            <p>Starting price: $1</p>
        `;

        this.updateAuctionDisplay();
        this.showModal(this.ui.auctionModal);
    },

    // Update auction display
    updateAuctionDisplay() {
        this.ui.currentBid.textContent = this.auctionState.currentBid;
        this.ui.highestBidder.textContent = this.auctionState.highestBidder !== null
            ? this.state.players[this.auctionState.highestBidder].name
            : 'None';

        const currentBidder = this.state.players[this.auctionState.currentBidderIndex];
        this.ui.bidAmount.placeholder = `Min bid: $${this.auctionState.currentBid + 1}`;
        this.ui.bidAmount.min = this.auctionState.currentBid + 1;
        this.ui.bidAmount.value = '';

        // Check if current bidder can bid
        const minBid = this.auctionState.currentBid + 1;
        this.ui.placeBidBtn.disabled = currentBidder.money < minBid || currentBidder.bankrupt;
    },

    // Place bid
    placeBid() {
        const bidAmount = parseInt(this.ui.bidAmount.value);
        const player = this.state.players[this.auctionState.currentBidderIndex];

        if (bidAmount > this.auctionState.currentBid && bidAmount <= player.money) {
            this.auctionState.currentBid = bidAmount;
            this.auctionState.highestBidder = player.id;
            this.auctionState.passedPlayers.clear();

            this.addToLog(`${player.name} bid $${bidAmount}`);
            this.nextAuctionBidder();
        }
    },

    // Pass on auction
    passAuction() {
        const player = this.state.players[this.auctionState.currentBidderIndex];
        this.auctionState.passedPlayers.add(player.id);
        this.addToLog(`${player.name} passed`);
        this.nextAuctionBidder();
    },

    // Next auction bidder
    nextAuctionBidder() {
        // Find next eligible bidder
        let nextIndex = this.auctionState.currentBidderIndex;
        let attempts = 0;

        do {
            nextIndex = (nextIndex + 1) % this.state.players.length;
            attempts++;
        } while (
            (this.auctionState.passedPlayers.has(this.state.players[nextIndex].id) ||
                this.state.players[nextIndex].bankrupt) &&
            attempts < this.state.players.length
        );

        // Check if auction is over
        const activeBidders = this.state.players.filter(p =>
            !p.bankrupt && !this.auctionState.passedPlayers.has(p.id)
        );

        if (activeBidders.length <= 1 || attempts >= this.state.players.length) {
            this.endAuction();
        } else {
            this.auctionState.currentBidderIndex = nextIndex;
            this.updateAuctionDisplay();
        }
    },

    // End auction
    endAuction() {
        const square = this.auctionState.property;

        if (this.auctionState.highestBidder !== null && this.auctionState.currentBid > 0) {
            const winner = this.state.players[this.auctionState.highestBidder];
            winner.money -= this.auctionState.currentBid;
            this.state.properties[square.id] = {
                owner: winner.id,
                houses: 0,
                mortgaged: false
            };

            this.addToLog(`${winner.name} won ${square.name} for $${this.auctionState.currentBid}`, true);
        } else {
            this.addToLog(`${square.name} was not sold`);
        }

        this.hideModal(this.ui.auctionModal);
        this.renderPlayerPanel();
        this.enableEndTurn();

        if (this.mode === 'online' && MonopolyMultiplayer.isHost) {
            MonopolyMultiplayer.sendGameState(this.state);
        }
    },

    // Close property modal (decline to buy)
    closePropertyModal() {
        this.hideModal(this.ui.propertyModal);
        this.startAuction();
    },

    // Draw card
    drawCard(type, player) {
        const cards = type === 'chance' ? this.state.chanceCards : this.state.communityCards;
        const card = cards.shift();
        cards.push(card); // Put back at bottom

        this.addToLog(`${player.name} drew a ${type === 'chance' ? 'Chance' : 'Community Chest'} card`);

        // Show card modal
        this.ui.cardType.textContent = type === 'chance' ? 'Chance' : 'Community Chest';
        this.ui.cardType.style.color = type === 'chance' ? '#ff9800' : '#2196f3';
        this.ui.cardText.textContent = card.text;

        this.currentCard = card;
        this.showModal(this.ui.cardModal);
    },

    // Close card modal and execute card action
    closeCardModal() {
        this.hideModal(this.ui.cardModal);
        this.executeCardAction(this.currentCard, this.getCurrentPlayer());
    },

    // Execute card action
    executeCardAction(card, player) {
        switch (card.action) {
            case 'moveTo':
                const oldPos = player.position;
                if (card.collectGo && card.destination < oldPos) {
                    player.money += MonopolyData.goSalary;
                    this.addToLog(`${player.name} passed GO and collected $${MonopolyData.goSalary}`);
                }
                player.position = card.destination;
                this.updateTokenPositions();
                this.handleLanding(player, card.destination);
                break;

            case 'moveToNearest':
                const nearestPos = this.findNearestOfType(player.position, card.type);
                if (nearestPos < player.position) {
                    player.money += MonopolyData.goSalary;
                    this.addToLog(`${player.name} passed GO and collected $${MonopolyData.goSalary}`);
                }
                player.position = nearestPos;
                this.updateTokenPositions();
                this.handleLanding(player, nearestPos);
                break;

            case 'moveBack':
                player.position = (player.position - card.spaces + 40) % 40;
                this.updateTokenPositions();
                this.handleLanding(player, player.position);
                break;

            case 'collect':
                player.money += card.amount;
                this.addToLog(`${player.name} collected $${card.amount}`);
                this.renderPlayerPanel();
                this.enableEndTurn();
                break;

            case 'pay':
                if (player.money >= card.amount) {
                    player.money -= card.amount;
                    this.state.freeParkingPot += card.amount;
                    this.addToLog(`${player.name} paid $${card.amount}`);
                    this.renderPlayerPanel();
                    this.enableEndTurn();
                } else {
                    this.handleBankruptcy(player, null, card.amount);
                }
                break;

            case 'goToJail':
                this.sendToJail(player);
                break;

            case 'getOutOfJailFree':
                player.getOutOfJailCards++;
                this.addToLog(`${player.name} got a Get Out of Jail Free card`);
                this.enableEndTurn();
                break;

            case 'repairs':
                const houses = this.countPlayerBuildings(player.id, 'houses');
                const hotels = this.countPlayerBuildings(player.id, 'hotels');
                const repairCost = (houses * card.houseCost) + (hotels * card.hotelCost);

                if (player.money >= repairCost) {
                    player.money -= repairCost;
                    this.addToLog(`${player.name} paid $${repairCost} for repairs`);
                    this.renderPlayerPanel();
                    this.enableEndTurn();
                } else {
                    this.handleBankruptcy(player, null, repairCost);
                }
                break;

            case 'payEachPlayer':
                const totalPay = card.amount * (this.state.players.filter(p => !p.bankrupt).length - 1);
                if (player.money >= totalPay) {
                    this.state.players.forEach(p => {
                        if (!p.bankrupt && p.id !== player.id) {
                            p.money += card.amount;
                            player.money -= card.amount;
                        }
                    });
                    this.addToLog(`${player.name} paid $${card.amount} to each player`);
                    this.renderPlayerPanel();
                    this.enableEndTurn();
                } else {
                    this.handleBankruptcy(player, null, totalPay);
                }
                break;

            case 'collectFromEachPlayer':
                this.state.players.forEach(p => {
                    if (!p.bankrupt && p.id !== player.id) {
                        if (p.money >= card.amount) {
                            p.money -= card.amount;
                            player.money += card.amount;
                        }
                    }
                });
                this.addToLog(`${player.name} collected $${card.amount} from each player`);
                this.renderPlayerPanel();
                this.enableEndTurn();
                break;
        }

        if (this.mode === 'online' && MonopolyMultiplayer.isHost) {
            MonopolyMultiplayer.sendGameState(this.state);
        }
    },

    // Find nearest property of type
    findNearestOfType(position, type) {
        const targets = type === 'utility'
            ? [12, 28]
            : [5, 15, 25, 35];

        for (let i = 1; i <= 40; i++) {
            const checkPos = (position + i) % 40;
            if (targets.includes(checkPos)) {
                return checkPos;
            }
        }
        return targets[0];
    },

    // Count player buildings
    countPlayerBuildings(playerId, type) {
        let houses = 0;
        let hotels = 0;

        for (const [propId, propState] of Object.entries(this.state.properties)) {
            if (propState.owner === playerId) {
                if (propState.houses === 5) {
                    hotels++;
                } else {
                    houses += propState.houses;
                }
            }
        }

        return type === 'hotels' ? hotels : houses;
    },

    // Pay tax
    payTax(player, square) {
        if (player.money >= square.amount) {
            player.money -= square.amount;
            this.state.freeParkingPot += square.amount;
            this.addToLog(`${player.name} paid $${square.amount} tax`);
            this.renderPlayerPanel();
            this.enableEndTurn();
        } else {
            this.handleBankruptcy(player, null, square.amount);
        }
    },

    // Send player to jail
    sendToJail(player) {
        player.position = MonopolyData.jailPosition;
        player.inJail = true;
        player.jailTurns = 0;
        this.state.doublesCount = 0;

        this.addToLog(`${player.name} went to Jail!`, true);
        this.updateTokenPositions();
        this.renderPlayerPanel();
        this.enableEndTurn();
    },

    // Handle jail turn
    handleJailTurn() {
        const player = this.getCurrentPlayer();
        player.jailTurns++;

        // Options: Pay bail, use card, or try to roll doubles
        const options = [`Roll for doubles (Attempt ${player.jailTurns}/3)`];

        if (player.money >= MonopolyData.jailBail) {
            options.push(`Pay $${MonopolyData.jailBail} bail`);
        }

        if (player.getOutOfJailCards > 0) {
            options.push('Use Get Out of Jail Free card');
        }

        // For simplicity, auto-roll for now
        // TODO: Show jail options modal

        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;

        this.animateDice(die1, die2);

        if (die1 === die2) {
            player.inJail = false;
            player.jailTurns = 0;
            this.addToLog(`${player.name} rolled doubles and got out of Jail!`);
            this.movePlayer(player, die1 + die2);
        } else if (player.jailTurns >= MonopolyData.maxJailTurns) {
            // Must pay bail after 3 turns
            if (player.money >= MonopolyData.jailBail) {
                player.money -= MonopolyData.jailBail;
                player.inJail = false;
                player.jailTurns = 0;
                this.addToLog(`${player.name} paid $${MonopolyData.jailBail} bail after 3 turns`);
                this.renderPlayerPanel();
                this.movePlayer(player, die1 + die2);
            } else {
                this.handleBankruptcy(player, null, MonopolyData.jailBail);
            }
        } else {
            this.addToLog(`${player.name} failed to roll doubles (${die1}+${die2})`);
            this.enableEndTurn();
        }
    },

    // Handle bankruptcy
    handleBankruptcy(player, creditor, amountOwed) {
        this.bankruptcyInfo = { player, creditor, amountOwed };
        this.ui.bankruptcyMessage.textContent = `You owe $${amountOwed} but only have $${player.money}!`;
        this.showModal(this.ui.bankruptcyModal);
    },

    // Declare bankruptcy
    declareBankruptcy() {
        const { player, creditor } = this.bankruptcyInfo;

        player.bankrupt = true;

        // Transfer all properties
        for (const [propId, propState] of Object.entries(this.state.properties)) {
            if (propState.owner === player.id) {
                if (creditor) {
                    propState.owner = creditor.id;
                } else {
                    delete this.state.properties[propId];
                }
            }
        }

        // Transfer money
        if (creditor) {
            creditor.money += player.money;
        }
        player.money = 0;

        this.addToLog(`${player.name} declared bankruptcy!`, true);
        this.hideModal(this.ui.bankruptcyModal);
        this.renderPlayerPanel();

        // Check for game over
        const activePlayers = this.state.players.filter(p => !p.bankrupt);
        if (activePlayers.length === 1) {
            this.endGame(activePlayers[0]);
        } else {
            this.endTurn();
        }
    },

    // End game
    endGame(winner) {
        this.state.gameOver = true;
        this.state.winner = winner;

        this.ui.winnerName.textContent = winner.name;

        // Show final standings
        const standings = [...this.state.players].sort((a, b) => {
            if (a.bankrupt && !b.bankrupt) return 1;
            if (!a.bankrupt && b.bankrupt) return -1;
            return this.calculateNetWorth(b) - this.calculateNetWorth(a);
        });

        let standingsHtml = '<h4>Final Standings</h4>';
        standings.forEach((player, index) => {
            const token = MonopolyData.tokens.find(t => t.id === player.token);
            standingsHtml += `
                <div class="standing-item">
                    <span class="standing-rank ${index === 0 ? 'first' : ''}">${index + 1}</span>
                    <span>${token?.emoji || ''} ${player.name}</span>
                    <span>${player.bankrupt ? 'Bankrupt' : '$' + this.calculateNetWorth(player).toLocaleString()}</span>
                </div>
            `;
        });

        this.ui.finalStandings.innerHTML = standingsHtml;
        this.showModal(this.ui.gameoverModal);
    },

    // Calculate net worth
    calculateNetWorth(player) {
        let worth = player.money;

        for (const [propId, propState] of Object.entries(this.state.properties)) {
            if (propState.owner === player.id) {
                const square = MonopolyData.squares[propId];
                worth += propState.mortgaged ? square.mortgage : square.price;
                if (propState.houses > 0) {
                    worth += propState.houses * square.houseCost;
                }
            }
        }

        return worth;
    },

    // Enable end turn button
    enableEndTurn() {
        this.state.awaitingAction = null;
        this.ui.rollDiceBtn.classList.add('hidden');
        this.ui.endTurnBtn.classList.remove('hidden');
    },

    // End turn
    endTurn() {
        // Check for doubles
        const [die1, die2] = this.state.lastDiceRoll;
        const isDoubles = die1 === die2;

        if (isDoubles && this.state.doublesCount > 0 && !this.getCurrentPlayer().inJail) {
            // Roll again
            this.ui.rollDiceBtn.classList.remove('hidden');
            this.ui.endTurnBtn.classList.add('hidden');
            this.addToLog(`${this.getCurrentPlayer().name} rolls again (doubles)!`);
            return;
        }

        // Move to next player
        this.state.doublesCount = 0;
        let nextIndex = this.state.currentPlayerIndex;

        do {
            nextIndex = (nextIndex + 1) % this.state.players.length;
        } while (this.state.players[nextIndex].bankrupt && nextIndex !== this.state.currentPlayerIndex);

        this.state.currentPlayerIndex = nextIndex;

        this.ui.rollDiceBtn.classList.remove('hidden');
        this.ui.endTurnBtn.classList.add('hidden');
        this.ui.diceTotal.textContent = '';

        this.updateTurnDisplay();
        this.renderPlayerPanel();
        this.addToLog(`${this.getCurrentPlayer().name}'s turn`);

        if (this.mode === 'online' && MonopolyMultiplayer.isHost) {
            MonopolyMultiplayer.sendGameState(this.state);
        }
    },

    // Check if it's my turn (for online mode)
    isMyTurn() {
        if (this.mode === 'local') return true;
        return this.state.currentPlayerIndex === MonopolyMultiplayer.localPlayerId;
    },

    // Open trade modal
    openTradeModal() {
        this.hideModal(this.ui.gameMenuModal);

        const currentPlayer = this.getCurrentPlayer();
        const myProperties = this.getPlayerProperties(currentPlayer.id);

        // Populate my properties
        let offerHtml = '';
        myProperties.forEach(prop => {
            const square = MonopolyData.squares[prop.id];
            offerHtml += `
                <div class="trade-property-item" data-property="${prop.id}">
                    <div class="trade-property-color" style="background: ${MonopolyData.getGroupColor(square.group)}"></div>
                    <span>${square.name}</span>
                </div>
            `;
        });
        this.ui.tradeOfferProperties.innerHTML = offerHtml || '<p>No properties</p>';

        // Populate trade partners
        let partnersHtml = '';
        this.state.players.forEach(player => {
            if (player.id !== currentPlayer.id && !player.bankrupt) {
                partnersHtml += `<option value="${player.id}">${player.name}</option>`;
            }
        });
        this.ui.tradePartnerSelect.innerHTML = partnersHtml;

        // Update partner properties
        this.updateTradePartnerProperties();

        // Add click handlers for property selection
        this.ui.tradeOfferProperties.querySelectorAll('.trade-property-item').forEach(item => {
            item.addEventListener('click', () => item.classList.toggle('selected'));
        });

        this.showModal(this.ui.tradeModal);
    },

    // Update trade partner properties
    updateTradePartnerProperties() {
        const partnerId = parseInt(this.ui.tradePartnerSelect.value);
        const partnerProperties = this.getPlayerProperties(partnerId);

        let wantHtml = '';
        partnerProperties.forEach(prop => {
            const square = MonopolyData.squares[prop.id];
            wantHtml += `
                <div class="trade-property-item" data-property="${prop.id}">
                    <div class="trade-property-color" style="background: ${MonopolyData.getGroupColor(square.group)}"></div>
                    <span>${square.name}</span>
                </div>
            `;
        });
        this.ui.tradeWantProperties.innerHTML = wantHtml || '<p>No properties</p>';

        // Add click handlers
        this.ui.tradeWantProperties.querySelectorAll('.trade-property-item').forEach(item => {
            item.addEventListener('click', () => item.classList.toggle('selected'));
        });
    },

    // Propose trade
    proposeTrade() {
        const currentPlayer = this.getCurrentPlayer();
        const partnerId = parseInt(this.ui.tradePartnerSelect.value);
        const partner = this.state.players[partnerId];

        const offerMoney = parseInt(this.ui.tradeOfferMoney.value) || 0;
        const wantMoney = parseInt(this.ui.tradeWantMoney.value) || 0;

        const offerProperties = [];
        this.ui.tradeOfferProperties.querySelectorAll('.trade-property-item.selected').forEach(item => {
            offerProperties.push(parseInt(item.dataset.property));
        });

        const wantProperties = [];
        this.ui.tradeWantProperties.querySelectorAll('.trade-property-item.selected').forEach(item => {
            wantProperties.push(parseInt(item.dataset.property));
        });

        if (offerMoney === 0 && wantMoney === 0 && offerProperties.length === 0 && wantProperties.length === 0) {
            alert('Please select something to trade');
            return;
        }

        if (offerMoney > currentPlayer.money) {
            alert('You don\'t have enough money');
            return;
        }

        this.pendingTrade = {
            from: currentPlayer.id,
            to: partnerId,
            offerMoney,
            wantMoney,
            offerProperties,
            wantProperties
        };

        this.hideModal(this.ui.tradeModal);

        // In local mode, show response modal for partner
        this.showTradeResponse(partner);
    },

    // Show trade response modal
    showTradeResponse(partner) {
        const trade = this.pendingTrade;
        const fromPlayer = this.state.players[trade.from];

        let detailsHtml = `<p><strong>${fromPlayer.name}</strong> offers:</p><ul>`;
        if (trade.offerMoney > 0) {
            detailsHtml += `<li>$${trade.offerMoney}</li>`;
        }
        trade.offerProperties.forEach(propId => {
            detailsHtml += `<li>${MonopolyData.squares[propId].name}</li>`;
        });
        detailsHtml += '</ul><p>In exchange for:</p><ul>';
        if (trade.wantMoney > 0) {
            detailsHtml += `<li>$${trade.wantMoney}</li>`;
        }
        trade.wantProperties.forEach(propId => {
            detailsHtml += `<li>${MonopolyData.squares[propId].name}</li>`;
        });
        detailsHtml += '</ul>';

        this.ui.tradeProposalDetails.innerHTML = detailsHtml;
        this.showModal(this.ui.tradeResponseModal);
    },

    // Accept trade
    acceptTrade() {
        const trade = this.pendingTrade;
        const fromPlayer = this.state.players[trade.from];
        const toPlayer = this.state.players[trade.to];

        // Transfer money
        fromPlayer.money -= trade.offerMoney;
        toPlayer.money += trade.offerMoney;
        fromPlayer.money += trade.wantMoney;
        toPlayer.money -= trade.wantMoney;

        // Transfer properties
        trade.offerProperties.forEach(propId => {
            this.state.properties[propId].owner = trade.to;
        });
        trade.wantProperties.forEach(propId => {
            this.state.properties[propId].owner = trade.from;
        });

        this.addToLog(`Trade completed between ${fromPlayer.name} and ${toPlayer.name}`, true);
        this.hideModal(this.ui.tradeResponseModal);
        this.renderPlayerPanel();

        if (this.mode === 'online' && MonopolyMultiplayer.isHost) {
            MonopolyMultiplayer.sendGameState(this.state);
        }
    },

    // Reject trade
    rejectTrade() {
        const trade = this.pendingTrade;
        const fromPlayer = this.state.players[trade.from];
        const toPlayer = this.state.players[trade.to];

        this.addToLog(`${toPlayer.name} rejected ${fromPlayer.name}'s trade offer`);
        this.hideModal(this.ui.tradeResponseModal);
        this.pendingTrade = null;
    },

    // Open property management
    openPropertyManagement() {
        this.hideModal(this.ui.gameMenuModal);
        this.hideModal(this.ui.bankruptcyModal);

        const currentPlayer = this.getCurrentPlayer();
        const myProperties = this.getPlayerProperties(currentPlayer.id);

        let html = '';
        myProperties.forEach(prop => {
            const square = MonopolyData.squares[prop.id];
            const propState = this.state.properties[prop.id];
            const hasMonopoly = this.hasMonopoly(currentPlayer.id, square.group);
            const canBuildHouse = hasMonopoly && square.type === 'property' && propState.houses < 5 && !propState.mortgaged;
            const canSellHouse = propState.houses > 0;

            html += `
                <div class="managed-property">
                    <div class="managed-property-color" style="background: ${MonopolyData.getGroupColor(square.group)}"></div>
                    <div class="managed-property-info">
                        <div class="managed-property-name">${square.name}</div>
                        <div class="managed-property-status">
                            ${propState.mortgaged ? 'MORTGAGED' : (propState.houses === 5 ? '1 Hotel' : propState.houses + ' Houses')}
                        </div>
                    </div>
                    <div class="managed-property-actions">
                        ${!propState.mortgaged && canBuildHouse ?
                    `<button class="btn btn-small btn-primary" onclick="MonopolyGame.buyHouse(${prop.id})">
                                +House ($${square.houseCost})
                            </button>` : ''}
                        ${canSellHouse ?
                    `<button class="btn btn-small btn-secondary" onclick="MonopolyGame.sellHouse(${prop.id})">
                                -House (+$${square.houseCost / 2})
                            </button>` : ''}
                        ${propState.mortgaged ?
                    `<button class="btn btn-small btn-primary" onclick="MonopolyGame.unmortgageProperty(${prop.id})">
                                Unmortgage ($${Math.floor(square.mortgage * 1.1)})
                            </button>` :
                    (propState.houses === 0 ?
                        `<button class="btn btn-small btn-secondary" onclick="MonopolyGame.mortgageProperty(${prop.id})">
                                    Mortgage (+$${square.mortgage})
                                </button>` : '')}
                    </div>
                </div>
            `;
        });

        this.ui.ownedPropertiesList.innerHTML = html || '<p>No properties owned</p>';
        this.showModal(this.ui.propertyManagementModal);
    },

    // Buy house
    buyHouse(propertyId) {
        const player = this.getCurrentPlayer();
        const square = MonopolyData.squares[propertyId];
        const propState = this.state.properties[propertyId];

        if (player.money >= square.houseCost && propState.houses < 5) {
            player.money -= square.houseCost;
            propState.houses++;
            this.addToLog(`${player.name} built a ${propState.houses === 5 ? 'hotel' : 'house'} on ${square.name}`);
            this.renderPlayerPanel();
            this.updateBuildings();
            this.openPropertyManagement(); // Refresh modal

            if (this.mode === 'online' && MonopolyMultiplayer.isHost) {
                MonopolyMultiplayer.sendGameState(this.state);
            }
        }
    },

    // Sell house
    sellHouse(propertyId) {
        const player = this.getCurrentPlayer();
        const square = MonopolyData.squares[propertyId];
        const propState = this.state.properties[propertyId];

        if (propState.houses > 0) {
            player.money += Math.floor(square.houseCost / 2);
            propState.houses--;
            this.addToLog(`${player.name} sold a house on ${square.name}`);
            this.renderPlayerPanel();
            this.updateBuildings();
            this.openPropertyManagement();

            if (this.mode === 'online' && MonopolyMultiplayer.isHost) {
                MonopolyMultiplayer.sendGameState(this.state);
            }
        }
    },

    // Mortgage property
    mortgageProperty(propertyId) {
        const player = this.getCurrentPlayer();
        const square = MonopolyData.squares[propertyId];
        const propState = this.state.properties[propertyId];

        if (!propState.mortgaged && propState.houses === 0) {
            player.money += square.mortgage;
            propState.mortgaged = true;
            this.addToLog(`${player.name} mortgaged ${square.name} for $${square.mortgage}`);
            this.renderPlayerPanel();
            this.openPropertyManagement();

            if (this.mode === 'online' && MonopolyMultiplayer.isHost) {
                MonopolyMultiplayer.sendGameState(this.state);
            }
        }
    },

    // Unmortgage property
    unmortgageProperty(propertyId) {
        const player = this.getCurrentPlayer();
        const square = MonopolyData.squares[propertyId];
        const propState = this.state.properties[propertyId];
        const cost = Math.floor(square.mortgage * 1.1);

        if (propState.mortgaged && player.money >= cost) {
            player.money -= cost;
            propState.mortgaged = false;
            this.addToLog(`${player.name} unmortgaged ${square.name}`);
            this.renderPlayerPanel();
            this.openPropertyManagement();

            if (this.mode === 'online' && MonopolyMultiplayer.isHost) {
                MonopolyMultiplayer.sendGameState(this.state);
            }
        }
    },

    // Show square info
    showSquareInfo(squareId) {
        const square = MonopolyData.squares[squareId];
        if (square.type === 'property' || square.type === 'railroad' || square.type === 'utility') {
            // Could show info modal here
            console.log('Square info:', square);
        }
    },

    // Toggle fullscreen
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            this.ui.fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            document.exitFullscreen();
            this.ui.fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        }
    },

    // Quit game
    quitGame() {
        if (confirm('Are you sure you want to quit the game?')) {
            MonopolyMultiplayer.disconnect();
            this.ui.gameScreen.classList.remove('active');
            this.ui.setupScreen.classList.add('active');
            this.hideModal(this.ui.gameMenuModal);
        }
    },

    // New game
    newGame() {
        this.hideModal(this.ui.gameoverModal);
        MonopolyMultiplayer.disconnect();
        this.ui.gameScreen.classList.remove('active');
        this.ui.setupScreen.classList.add('active');
    },

    // Render full game (for state sync)
    renderGame() {
        this.renderPlayerPanel();
        this.updateTokenPositions();
        this.updateBuildings();
        this.updateTurnDisplay();
    },

    // Process action from network
    processAction(action, playerId) {
        // Handle various action types from network
        switch (action.type) {
            case 'roll':
                // Replay dice roll
                break;
            case 'buy':
                // Process purchase
                break;
            // etc.
        }
    },

    // Show modal helper
    showModal(modal) {
        modal.classList.remove('hidden');
    },

    // Hide modal helper
    hideModal(modal) {
        modal.classList.add('hidden');
    },

    // Add to game log
    addToLog(message, important = false) {
        const li = document.createElement('li');
        li.textContent = message;
        if (important) li.classList.add('important');

        this.ui.gameLogList.insertBefore(li, this.ui.gameLogList.firstChild);

        // Keep only last 50 entries
        while (this.ui.gameLogList.children.length > 50) {
            this.ui.gameLogList.removeChild(this.ui.gameLogList.lastChild);
        }
    },

    // Clear log
    clearLog() {
        this.ui.gameLogList.innerHTML = '';
    }
};

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    MonopolyGame.init();
});
