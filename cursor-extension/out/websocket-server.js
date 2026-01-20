"use strict";
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
exports.WebSocketServer = void 0;
const WebSocket = __importStar(require("ws"));
const vscode = __importStar(require("vscode"));
class WebSocketServer {
    constructor(port, outputChannel) {
        this.wss = null;
        this.messageHandlers = [];
        this.clientChangeHandlers = [];
        this.clients = new Set();
        this.outputChannel = null;
        this.port = port;
        this.outputChannel = outputChannel || null;
    }
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        }
        console.log(logMessage);
    }
    logError(message, error) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ERROR: ${message}${error ? ` - ${error}` : ''}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        }
        console.error(logMessage);
    }
    start() {
        if (this.wss) {
            this.log('WebSocket server is already running');
            return;
        }
        this.wss = new WebSocket.Server({ port: this.port });
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            this.log('Client connected to Cursor Remote');
            this.notifyClientChange(true);
            ws.on('message', (message) => {
                const messageStr = message.toString();
                this.log(`Received message: ${messageStr.substring(0, 100)}${messageStr.length > 100 ? '...' : ''}`);
                // 모든 핸들러에 메시지 전달
                this.messageHandlers.forEach(handler => {
                    try {
                        handler(messageStr);
                    }
                    catch (error) {
                        this.logError('Error in message handler', error);
                    }
                });
            });
            ws.on('close', () => {
                this.log('Client disconnected from Cursor Remote');
                this.clients.delete(ws);
                this.notifyClientChange(this.clients.size > 0);
            });
            ws.on('error', (error) => {
                this.logError('WebSocket error', error);
            });
            // 연결 성공 메시지 전송
            this.sendToClient(ws, JSON.stringify({
                type: 'connected',
                message: 'Connected to Cursor Remote'
            }));
        });
        this.wss.on('error', (error) => {
            this.logError('WebSocket server error', error);
            vscode.window.showErrorMessage(`Cursor Remote server error: ${error.message}`);
        });
        this.log(`WebSocket server started on port ${this.port}`);
    }
    stop() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
            this.log('WebSocket server stopped');
        }
    }
    isRunning() {
        return this.wss !== null;
    }
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    onClientChange(handler) {
        this.clientChangeHandlers.push(handler);
    }
    notifyClientChange(connected) {
        this.clientChangeHandlers.forEach(handler => {
            try {
                handler(connected);
            }
            catch (error) {
                console.error('Error in client change handler:', error);
            }
        });
    }
    getClientCount() {
        return this.clients.size;
    }
    send(message) {
        if (!this.wss) {
            this.log('WARNING: WebSocket server is not running');
            return;
        }
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    // HTTP POST 요청으로 메시지 수신 (hook에서 사용)
    sendFromHook(data) {
        const message = JSON.stringify(data);
        this.send(message);
        this.log(`Message sent from hook: ${data.type || 'unknown'}`);
    }
    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    }
}
exports.WebSocketServer = WebSocketServer;
//# sourceMappingURL=websocket-server.js.map