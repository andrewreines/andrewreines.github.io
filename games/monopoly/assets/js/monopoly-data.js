/**
 * Monopoly Game Data
 * Contains all board properties, cards, and game constants
 * This file is 100% isolated and contains no external dependencies
 */

const MonopolyData = {
    // Player tokens available
    tokens: [
        { id: 'car', emoji: '🚗', name: 'Car' },
        { id: 'ship', emoji: '🚢', name: 'Ship' },
        { id: 'hat', emoji: '🎩', name: 'Top Hat' },
        { id: 'dog', emoji: '🐕', name: 'Dog' },
        { id: 'boot', emoji: '👢', name: 'Boot' },
        { id: 'cat', emoji: '🐱', name: 'Cat' }
    ],

    // Player colors
    playerColors: [
        '#e74c3c', // Red
        '#3498db', // Blue
        '#2ecc71', // Green
        '#f1c40f', // Yellow
        '#9b59b6', // Purple
        '#e67e22'  // Orange
    ],

    // Starting money
    startingMoney: 1500,

    // GO salary
    goSalary: 200,

    // Jail position and bail
    jailPosition: 10,
    jailBail: 50,
    maxJailTurns: 3,

    // Property groups
    propertyGroups: {
        brown: { color: '#8B4513', properties: [1, 3] },
        lightBlue: { color: '#87CEEB', properties: [6, 8, 9] },
        pink: { color: '#FF69B4', properties: [11, 13, 14] },
        orange: { color: '#FFA500', properties: [16, 18, 19] },
        red: { color: '#FF0000', properties: [21, 23, 24] },
        yellow: { color: '#FFFF00', properties: [26, 27, 29] },
        green: { color: '#008000', properties: [31, 32, 34] },
        darkBlue: { color: '#00008B', properties: [37, 39] },
        railroad: { color: '#000000', properties: [5, 15, 25, 35] },
        utility: { color: '#808080', properties: [12, 28] }
    },

    // Board squares (40 total, 0-39)
    squares: [
        // Bottom row (right to left)
        {
            id: 0,
            name: 'GO',
            type: 'go',
            corner: true
        },
        {
            id: 1,
            name: 'Mediterranean Avenue',
            type: 'property',
            group: 'brown',
            price: 60,
            rent: [2, 10, 30, 90, 160, 250],
            houseCost: 50,
            mortgage: 30
        },
        {
            id: 2,
            name: 'Community Chest',
            type: 'community',
            shortName: 'Community'
        },
        {
            id: 3,
            name: 'Baltic Avenue',
            type: 'property',
            group: 'brown',
            price: 60,
            rent: [4, 20, 60, 180, 320, 450],
            houseCost: 50,
            mortgage: 30
        },
        {
            id: 4,
            name: 'Income Tax',
            type: 'tax',
            amount: 200
        },
        {
            id: 5,
            name: 'Reading Railroad',
            type: 'railroad',
            group: 'railroad',
            price: 200,
            mortgage: 100
        },
        {
            id: 6,
            name: 'Oriental Avenue',
            type: 'property',
            group: 'lightBlue',
            price: 100,
            rent: [6, 30, 90, 270, 400, 550],
            houseCost: 50,
            mortgage: 50
        },
        {
            id: 7,
            name: 'Chance',
            type: 'chance'
        },
        {
            id: 8,
            name: 'Vermont Avenue',
            type: 'property',
            group: 'lightBlue',
            price: 100,
            rent: [6, 30, 90, 270, 400, 550],
            houseCost: 50,
            mortgage: 50
        },
        {
            id: 9,
            name: 'Connecticut Avenue',
            type: 'property',
            group: 'lightBlue',
            price: 120,
            rent: [8, 40, 100, 300, 450, 600],
            houseCost: 50,
            mortgage: 60
        },
        // Left side (bottom to top)
        {
            id: 10,
            name: 'Jail / Just Visiting',
            type: 'jail',
            corner: true
        },
        {
            id: 11,
            name: 'St. Charles Place',
            type: 'property',
            group: 'pink',
            price: 140,
            rent: [10, 50, 150, 450, 625, 750],
            houseCost: 100,
            mortgage: 70
        },
        {
            id: 12,
            name: 'Electric Company',
            type: 'utility',
            group: 'utility',
            price: 150,
            mortgage: 75
        },
        {
            id: 13,
            name: 'States Avenue',
            type: 'property',
            group: 'pink',
            price: 140,
            rent: [10, 50, 150, 450, 625, 750],
            houseCost: 100,
            mortgage: 70
        },
        {
            id: 14,
            name: 'Virginia Avenue',
            type: 'property',
            group: 'pink',
            price: 160,
            rent: [12, 60, 180, 500, 700, 900],
            houseCost: 100,
            mortgage: 80
        },
        {
            id: 15,
            name: 'Pennsylvania Railroad',
            type: 'railroad',
            group: 'railroad',
            price: 200,
            mortgage: 100
        },
        {
            id: 16,
            name: 'St. James Place',
            type: 'property',
            group: 'orange',
            price: 180,
            rent: [14, 70, 200, 550, 750, 950],
            houseCost: 100,
            mortgage: 90
        },
        {
            id: 17,
            name: 'Community Chest',
            type: 'community',
            shortName: 'Community'
        },
        {
            id: 18,
            name: 'Tennessee Avenue',
            type: 'property',
            group: 'orange',
            price: 180,
            rent: [14, 70, 200, 550, 750, 950],
            houseCost: 100,
            mortgage: 90
        },
        {
            id: 19,
            name: 'New York Avenue',
            type: 'property',
            group: 'orange',
            price: 200,
            rent: [16, 80, 220, 600, 800, 1000],
            houseCost: 100,
            mortgage: 100
        },
        // Top row (left to right)
        {
            id: 20,
            name: 'Free Parking',
            type: 'parking',
            corner: true
        },
        {
            id: 21,
            name: 'Kentucky Avenue',
            type: 'property',
            group: 'red',
            price: 220,
            rent: [18, 90, 250, 700, 875, 1050],
            houseCost: 150,
            mortgage: 110
        },
        {
            id: 22,
            name: 'Chance',
            type: 'chance'
        },
        {
            id: 23,
            name: 'Indiana Avenue',
            type: 'property',
            group: 'red',
            price: 220,
            rent: [18, 90, 250, 700, 875, 1050],
            houseCost: 150,
            mortgage: 110
        },
        {
            id: 24,
            name: 'Illinois Avenue',
            type: 'property',
            group: 'red',
            price: 240,
            rent: [20, 100, 300, 750, 925, 1100],
            houseCost: 150,
            mortgage: 120
        },
        {
            id: 25,
            name: 'B. & O. Railroad',
            type: 'railroad',
            group: 'railroad',
            price: 200,
            mortgage: 100
        },
        {
            id: 26,
            name: 'Atlantic Avenue',
            type: 'property',
            group: 'yellow',
            price: 260,
            rent: [22, 110, 330, 800, 975, 1150],
            houseCost: 150,
            mortgage: 130
        },
        {
            id: 27,
            name: 'Ventnor Avenue',
            type: 'property',
            group: 'yellow',
            price: 260,
            rent: [22, 110, 330, 800, 975, 1150],
            houseCost: 150,
            mortgage: 130
        },
        {
            id: 28,
            name: 'Water Works',
            type: 'utility',
            group: 'utility',
            price: 150,
            mortgage: 75
        },
        {
            id: 29,
            name: 'Marvin Gardens',
            type: 'property',
            group: 'yellow',
            price: 280,
            rent: [24, 120, 360, 850, 1025, 1200],
            houseCost: 150,
            mortgage: 140
        },
        // Right side (top to bottom)
        {
            id: 30,
            name: 'Go To Jail',
            type: 'gotojail',
            corner: true
        },
        {
            id: 31,
            name: 'Pacific Avenue',
            type: 'property',
            group: 'green',
            price: 300,
            rent: [26, 130, 390, 900, 1100, 1275],
            houseCost: 200,
            mortgage: 150
        },
        {
            id: 32,
            name: 'North Carolina Avenue',
            type: 'property',
            group: 'green',
            price: 300,
            rent: [26, 130, 390, 900, 1100, 1275],
            houseCost: 200,
            mortgage: 150
        },
        {
            id: 33,
            name: 'Community Chest',
            type: 'community',
            shortName: 'Community'
        },
        {
            id: 34,
            name: 'Pennsylvania Avenue',
            type: 'property',
            group: 'green',
            price: 320,
            rent: [28, 150, 450, 1000, 1200, 1400],
            houseCost: 200,
            mortgage: 160
        },
        {
            id: 35,
            name: 'Short Line',
            type: 'railroad',
            group: 'railroad',
            price: 200,
            mortgage: 100
        },
        {
            id: 36,
            name: 'Chance',
            type: 'chance'
        },
        {
            id: 37,
            name: 'Park Place',
            type: 'property',
            group: 'darkBlue',
            price: 350,
            rent: [35, 175, 500, 1100, 1300, 1500],
            houseCost: 200,
            mortgage: 175
        },
        {
            id: 38,
            name: 'Luxury Tax',
            type: 'tax',
            amount: 100
        },
        {
            id: 39,
            name: 'Boardwalk',
            type: 'property',
            group: 'darkBlue',
            price: 400,
            rent: [50, 200, 600, 1400, 1700, 2000],
            houseCost: 200,
            mortgage: 200
        }
    ],

    // Chance cards
    chanceCards: [
        {
            id: 1,
            text: 'Advance to GO. Collect $200.',
            action: 'moveTo',
            destination: 0,
            collectGo: true
        },
        {
            id: 2,
            text: 'Advance to Illinois Avenue. If you pass GO, collect $200.',
            action: 'moveTo',
            destination: 24,
            collectGo: true
        },
        {
            id: 3,
            text: 'Advance to St. Charles Place. If you pass GO, collect $200.',
            action: 'moveTo',
            destination: 11,
            collectGo: true
        },
        {
            id: 4,
            text: 'Advance to nearest Utility. If unowned, you may buy it. If owned, pay owner 10 times the dice roll.',
            action: 'moveToNearest',
            type: 'utility',
            multiplier: 10
        },
        {
            id: 5,
            text: 'Advance to nearest Railroad. If unowned, you may buy it. If owned, pay owner twice the rental.',
            action: 'moveToNearest',
            type: 'railroad',
            multiplier: 2
        },
        {
            id: 6,
            text: 'Bank pays you dividend of $50.',
            action: 'collect',
            amount: 50
        },
        {
            id: 7,
            text: 'Get Out of Jail Free. This card may be kept until needed.',
            action: 'getOutOfJailFree'
        },
        {
            id: 8,
            text: 'Go back 3 spaces.',
            action: 'moveBack',
            spaces: 3
        },
        {
            id: 9,
            text: 'Go to Jail. Go directly to Jail. Do not pass GO. Do not collect $200.',
            action: 'goToJail'
        },
        {
            id: 10,
            text: 'Make general repairs on all your property: Pay $25 per house and $100 per hotel.',
            action: 'repairs',
            houseCost: 25,
            hotelCost: 100
        },
        {
            id: 11,
            text: 'Pay poor tax of $15.',
            action: 'pay',
            amount: 15
        },
        {
            id: 12,
            text: 'Take a trip to Reading Railroad. If you pass GO, collect $200.',
            action: 'moveTo',
            destination: 5,
            collectGo: true
        },
        {
            id: 13,
            text: 'Advance to Boardwalk.',
            action: 'moveTo',
            destination: 39,
            collectGo: false
        },
        {
            id: 14,
            text: 'You have been elected Chairman of the Board. Pay each player $50.',
            action: 'payEachPlayer',
            amount: 50
        },
        {
            id: 15,
            text: 'Your building loan matures. Collect $150.',
            action: 'collect',
            amount: 150
        },
        {
            id: 16,
            text: 'You have won a crossword competition. Collect $100.',
            action: 'collect',
            amount: 100
        }
    ],

    // Community Chest cards
    communityChestCards: [
        {
            id: 1,
            text: 'Advance to GO. Collect $200.',
            action: 'moveTo',
            destination: 0,
            collectGo: true
        },
        {
            id: 2,
            text: 'Bank error in your favor. Collect $200.',
            action: 'collect',
            amount: 200
        },
        {
            id: 3,
            text: 'Doctor\'s fees. Pay $50.',
            action: 'pay',
            amount: 50
        },
        {
            id: 4,
            text: 'From sale of stock you get $50.',
            action: 'collect',
            amount: 50
        },
        {
            id: 5,
            text: 'Get Out of Jail Free. This card may be kept until needed.',
            action: 'getOutOfJailFree'
        },
        {
            id: 6,
            text: 'Go to Jail. Go directly to Jail. Do not pass GO. Do not collect $200.',
            action: 'goToJail'
        },
        {
            id: 7,
            text: 'Grand Opera Night. Collect $50 from every player.',
            action: 'collectFromEachPlayer',
            amount: 50
        },
        {
            id: 8,
            text: 'Holiday Fund matures. Collect $100.',
            action: 'collect',
            amount: 100
        },
        {
            id: 9,
            text: 'Income tax refund. Collect $20.',
            action: 'collect',
            amount: 20
        },
        {
            id: 10,
            text: 'It\'s your birthday. Collect $10 from every player.',
            action: 'collectFromEachPlayer',
            amount: 10
        },
        {
            id: 11,
            text: 'Life insurance matures. Collect $100.',
            action: 'collect',
            amount: 100
        },
        {
            id: 12,
            text: 'Hospital fees. Pay $50.',
            action: 'pay',
            amount: 50
        },
        {
            id: 13,
            text: 'School fees. Pay $50.',
            action: 'pay',
            amount: 50
        },
        {
            id: 14,
            text: 'Receive $25 consultancy fee.',
            action: 'collect',
            amount: 25
        },
        {
            id: 15,
            text: 'You are assessed for street repairs: Pay $40 per house and $115 per hotel.',
            action: 'repairs',
            houseCost: 40,
            hotelCost: 115
        },
        {
            id: 16,
            text: 'You have won second prize in a beauty contest. Collect $10.',
            action: 'collect',
            amount: 10
        },
        {
            id: 17,
            text: 'You inherit $100.',
            action: 'collect',
            amount: 100
        }
    ],

    // Railroad rent based on number owned
    railroadRent: [25, 50, 100, 200],

    // Utility multipliers based on number owned
    utilityMultipliers: [4, 10],

    // Get short name for display on board
    getShortName(square) {
        if (square.shortName) return square.shortName;
        if (square.name.length <= 12) return square.name;

        // Abbreviate long names
        const words = square.name.split(' ');
        if (words.length > 1) {
            return words.map(w => w.charAt(0) + '.').join(' ').slice(0, -1) + words[words.length - 1].slice(1);
        }
        return square.name.substring(0, 10) + '...';
    },

    // Get color for property group
    getGroupColor(group) {
        if (!group || !this.propertyGroups[group]) return '#808080';
        return this.propertyGroups[group].color;
    },

    // Shuffle array (Fisher-Yates)
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
};

// Freeze the data to prevent modifications
Object.freeze(MonopolyData);
Object.freeze(MonopolyData.squares);
Object.freeze(MonopolyData.chanceCards);
Object.freeze(MonopolyData.communityChestCards);
