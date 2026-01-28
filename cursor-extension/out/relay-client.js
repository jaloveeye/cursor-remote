"use strict";
/**
 * Relay Server Client for Cursor Remote Extension
 * Handles communication with the relay server for remote mobile client connections
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayClient = void 0;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const url_1 = require("url");
class RelayClient {
    constructor(relayServerUrl, outputChannel) {
        this.sessionId = null;
        this.pollInterval = null;
        this.isConnected = false;
        this.onMessageCallback = null;
        this.lastSessionDiscoveryTime = 0;
        this.SESSION_DISCOVERY_INTERVAL = 10000; // 10초마다 한 번만
        this.POLL_INTERVAL = 2000; // 2초마다 폴링
        this.relayServerUrl = relayServerUrl;
        this.deviceId = `pc-${Date.now()}`;
        this.outputChannel = outputChannel;
    }
    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] [Relay] ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.log(logMessage);
    }
    logError(message, error) {
        const errorMessage = error instanceof Error ? error.message : String(error || '');
        const logMessage = `[Relay] ERROR: ${message}${errorMessage ? ` - ${errorMessage}` : ''}`;
        this.outputChannel.appendLine(logMessage);
        console.error(logMessage, error);
    }
    /**
     * Set callback for receiving messages from relay server
     */
    setOnMessage(callback) {
        this.onMessageCallback = callback;
    }
    /**
     * Start relay client - begin session discovery and polling
     */
    async start() {
        this.log('Starting relay client...');
        this.log(`Relay Server: ${this.relayServerUrl}`);
        this.log(`Device ID: ${this.deviceId}`);
        // Start polling for session discovery
        this.startPolling();
        this.log('Relay client started - waiting for mobile client session...');
    }
    /**
     * Stop relay client
     */
    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isConnected = false;
        this.sessionId = null;
        this.log('Relay client stopped');
    }
    /**
     * Start polling for messages and session discovery
     */
    startPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.pollInterval = setInterval(() => {
            this.pollMessages();
        }, this.POLL_INTERVAL);
    }
    /**
     * Poll messages from relay server and discover sessions
     */
    async pollMessages() {
        // If no session, try to discover one
        if (!this.sessionId) {
            const discoveredSessionId = await this.discoverSession();
            if (discoveredSessionId) {
                this.log(`🔍 Found session waiting for PC: ${discoveredSessionId}`);
                await this.connectToSession(discoveredSessionId);
                return;
            }
            return; // No session found, try again next poll
        }
        // If session exists, poll for messages
        if (!this.sessionId || !this.isConnected) {
            this.log(`⚠️ Polling skipped: sessionId=${this.sessionId}, isConnected=${this.isConnected}`);
            return;
        }
        try {
            const pollUrl = `${this.relayServerUrl}/api/poll?sessionId=${this.sessionId}&deviceType=pc`;
            const data = await this.httpRequest(pollUrl);
            if (!data) {
                return;
            }
            if (data.success && data.data?.messages) {
                const messages = data.data.messages;
                if (messages.length > 0) {
                    this.log(`📥 Received ${messages.length} message(s) from relay`);
                }
                for (const msg of messages) {
                    // Forward message to callback (Extension WebSocket server)
                    if (this.onMessageCallback) {
                        const messageStr = typeof msg.data === 'string'
                            ? msg.data
                            : JSON.stringify(msg.data || msg);
                        this.onMessageCallback(messageStr);
                    }
                    else {
                        this.logError('⚠️ onMessageCallback is null - cannot forward message');
                    }
                }
            }
            else if (!data.success) {
                this.logError(`Poll failed: ${data.error}`);
            }
        }
        catch (error) {
            this.logError('Polling error', error);
        }
    }
    /**
     * Discover sessions waiting for PC connection
     */
    async discoverSession() {
        if (this.sessionId) {
            return null; // Already connected to a session
        }
        // Rate limiting
        const now = Date.now();
        if (now - this.lastSessionDiscoveryTime < this.SESSION_DISCOVERY_INTERVAL) {
            return null;
        }
        this.lastSessionDiscoveryTime = now;
        try {
            const discoveryUrl = `${this.relayServerUrl}/api/sessions-waiting-for-pc`;
            const data = await this.httpRequest(discoveryUrl);
            if (!data) {
                return null;
            }
            if (data.success && data.data?.sessions && data.data.sessions.length > 0) {
                const foundSession = data.data.sessions[0];
                if (foundSession.sessionId) {
                    return foundSession.sessionId;
                }
            }
            return null;
        }
        catch (error) {
            // Ignore errors (session may not exist yet)
            return null;
        }
    }
    /**
     * Connect to a relay session
     */
    async connectToSession(sid) {
        this.log(`🔗 Connecting to session ${sid}...`);
        try {
            const data = await this.httpRequest(`${this.relayServerUrl}/api/connect`, 'POST', {
                sessionId: sid,
                deviceId: this.deviceId,
                deviceType: 'pc',
            });
            if (!data) {
                return;
            }
            if (data.success) {
                this.sessionId = sid;
                this.isConnected = true;
                this.log(`✅ Connected to session: ${this.sessionId}`);
                this.log(`💡 Mobile client can now connect using session ID: ${this.sessionId}`);
            }
            else {
                this.logError(`Failed to connect: ${data.error}`);
            }
        }
        catch (error) {
            this.logError('Error connecting to session', error);
        }
    }
    /**
     * Send message to relay server
     */
    async sendMessage(message) {
        if (!this.sessionId || !this.isConnected) {
            this.logError('Cannot send message: not connected to session');
            return;
        }
        try {
            const parsed = JSON.parse(message);
            const data = await this.httpRequest(`${this.relayServerUrl}/api/send`, 'POST', {
                sessionId: this.sessionId,
                deviceId: this.deviceId,
                deviceType: 'pc',
                type: parsed.type || 'message',
                data: parsed,
            });
            if (!data) {
                return;
            }
            if (data.success) {
                this.log('✅ Message sent to relay');
            }
            else {
                this.logError(`Failed to send to relay: ${data.error}`);
            }
        }
        catch (error) {
            this.logError('Error sending to relay', error);
        }
    }
    /**
     * Get current session ID
     */
    getSessionId() {
        return this.sessionId;
    }
    /**
     * Check if connected to relay session
     */
    isConnectedToSession() {
        return this.isConnected && this.sessionId !== null;
    }
    /**
     * HTTP request helper (using Node.js http/https modules)
     */
    async httpRequest(url, method = 'GET', body) {
        return new Promise((resolve, reject) => {
            const urlObj = new url_1.URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const httpModule = isHttps ? https : http;
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
            };
            const req = httpModule.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const parsed = JSON.parse(data);
                            resolve(parsed);
                        }
                        catch (error) {
                            this.logError('Failed to parse response', error);
                            resolve(null);
                        }
                    }
                    else {
                        this.logError(`HTTP ${res.statusCode}: ${data}`);
                        resolve(null);
                    }
                });
            });
            req.on('error', (error) => {
                this.logError('Request error', error);
                resolve(null);
            });
            if (body && method === 'POST') {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }
}
exports.RelayClient = RelayClient;
//# sourceMappingURL=relay-client.js.map