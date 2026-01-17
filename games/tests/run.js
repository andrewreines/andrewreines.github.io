/**
 * Simple test runner - no dependencies required
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

// Test state
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let currentSuite = '';

// Test API
global.describe = function(name, fn) {
    currentSuite = name;
    console.log(`\n${colors.cyan}${name}${colors.reset}`);
    fn();
};

global.it = function(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ${colors.green}✓${colors.reset} ${colors.dim}${name}${colors.reset}`);
    } catch (e) {
        failedTests++;
        console.log(`  ${colors.red}✗ ${name}${colors.reset}`);
        console.log(`    ${colors.red}${e.message}${colors.reset}`);
    }
};

global.assert = function(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
};

global.assertEqual = function(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
};

global.assertDeepEqual = function(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
};

global.assertThrows = function(fn, message) {
    let threw = false;
    try {
        fn();
    } catch (e) {
        threw = true;
    }
    if (!threw) {
        throw new Error(message || 'Expected function to throw');
    }
};

// Mock browser globals
global.window = global;
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;

// Mock PeerJS
class MockPeer {
    constructor(id, options) {
        this.id = id;
        this.options = options;
        this._handlers = {};
        this._destroyed = false;

        // Simulate async open
        if (MockPeer.simulateOpen) {
            setTimeout(() => {
                if (!this._destroyed && this._handlers.open) {
                    this._handlers.open(this.id || 'mock-peer-id');
                }
            }, MockPeer.openDelay || 10);
        }
    }

    on(event, handler) {
        this._handlers[event] = handler;
    }

    connect(peerId, options) {
        const conn = new MockConnection(peerId, options);
        return conn;
    }

    destroy() {
        this._destroyed = true;
    }

    // Static config for tests
    static simulateOpen = true;
    static openDelay = 10;
    static reset() {
        MockPeer.simulateOpen = true;
        MockPeer.openDelay = 10;
    }
}

class MockConnection {
    constructor(peerId, options) {
        this.peer = peerId;
        this.metadata = options?.metadata;
        this._handlers = {};
        this._open = false;
    }

    on(event, handler) {
        this._handlers[event] = handler;
    }

    send(data) {
        this._lastSent = data;
    }

    close() {
        this._open = false;
    }

    // Test helpers
    simulateOpen() {
        this._open = true;
        if (this._handlers.open) this._handlers.open();
    }

    simulateData(data) {
        if (this._handlers.data) this._handlers.data(data);
    }

    simulateClose() {
        if (this._handlers.close) this._handlers.close();
    }
}

global.Peer = MockPeer;
global.MockPeer = MockPeer;
global.MockConnection = MockConnection;

// Load multiplayer.js
const multiplayerPath = path.join(__dirname, '../assets/js/multiplayer.js');
const multiplayerCode = fs.readFileSync(multiplayerPath, 'utf8');
eval(multiplayerCode);

// Run tests
console.log(`${colors.cyan}Running multiplayer framework tests...${colors.reset}`);

// Load and run test files
const testFiles = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.test.js'))
    .sort();

for (const file of testFiles) {
    require(path.join(__dirname, file));
}

// Print summary
console.log('\n' + '─'.repeat(50));
if (failedTests === 0) {
    console.log(`${colors.green}All ${totalTests} tests passed!${colors.reset}`);
    process.exit(0);
} else {
    console.log(`${colors.red}${failedTests} of ${totalTests} tests failed${colors.reset}`);
    process.exit(1);
}
