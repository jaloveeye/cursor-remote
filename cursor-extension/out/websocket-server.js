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
const net = __importStar(require("net"));
class WebSocketServer {
    constructor(port, outputChannel) {
        this.wss = null;
        this.actualPort = null;
        this.messageHandlers = [];
        this.clientChangeHandlers = [];
        this.clients = new Set();
        this.outputChannel = null;
        this.relayClient = null;
        this.port = port;
        this.outputChannel = outputChannel || null;
    }
    log(message, level = "info") {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        }
        console.log(logMessage);
        // 실시간 로그를 클라이언트에 전송
        this.sendLogToClients({
            level,
            message,
            timestamp: new Date().toISOString(),
            source: "extension",
        });
    }
    logError(message, error) {
        const timestamp = new Date().toLocaleTimeString();
        const errorMessage = error instanceof Error ? error.message : String(error || "");
        const logMessage = `[${timestamp}] ERROR: ${message}${errorMessage ? ` - ${errorMessage}` : ""}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        }
        console.error(logMessage);
        // 에러 로그를 클라이언트에 전송
        this.sendLogToClients({
            level: "error",
            message: `${message}${errorMessage ? ` - ${errorMessage}` : ""}`,
            timestamp: new Date().toISOString(),
            source: "extension",
            error: errorMessage,
        });
    }
    sendLogToClients(logData) {
        const logMessage = JSON.stringify({
            type: "log",
            ...logData,
        });
        // 로컬 WebSocket 클라이언트에 전송
        if (this.wss && this.clients.size > 0) {
            this.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(logMessage);
                }
            });
        }
        // 릴레이 서버에도 전송 (연결되어 있는 경우)
        if (this.relayClient && this.relayClient.isConnectedToSession()) {
            this.relayClient.sendMessage(logMessage).catch(() => {
                // 로그 전송 실패는 무시 (무한 루프 방지)
            });
        }
    }
    async findAvailablePort(startPort, maxAttempts = 10) {
        return new Promise((resolve) => {
            let currentPort = startPort;
            let attempts = 0;
            const tryPort = (port) => {
                const server = net.createServer();
                server.listen(port, () => {
                    server.once("close", () => {
                        resolve(port);
                    });
                    server.close();
                });
                server.on("error", (err) => {
                    if (err.code === "EADDRINUSE") {
                        attempts++;
                        if (attempts < maxAttempts) {
                            tryPort(port + 1);
                        }
                        else {
                            resolve(null);
                        }
                    }
                    else {
                        resolve(null);
                    }
                });
            };
            tryPort(currentPort);
        });
    }
    async start() {
        if (this.wss) {
            this.log("WebSocket server is already running");
            return;
        }
        // 포트가 사용 중인지 확인하고 사용 가능한 포트 찾기
        const availablePort = await this.findAvailablePort(this.port);
        if (availablePort === null) {
            const errorMsg = `포트 ${this.port}부터 ${this.port + 10}까지 모두 사용 중입니다. 다른 프로세스를 종료하거나 포트를 변경해주세요.`;
            this.logError(errorMsg);
            vscode.window.showErrorMessage(`Cursor Remote: ${errorMsg}`);
            throw new Error(errorMsg);
        }
        if (availablePort !== this.port) {
            this.log(`⚠️ 포트 ${this.port}가 사용 중이어서 포트 ${availablePort}를 사용합니다.`);
            vscode.window.showWarningMessage(`Cursor Remote: 포트 ${this.port}가 사용 중이어서 포트 ${availablePort}로 시작합니다.`);
        }
        this.actualPort = availablePort;
        this.wss = new WebSocket.Server({ port: availablePort });
        // Promise로 서버 시작 완료 대기
        return new Promise((resolve, reject) => {
            this.wss.on("connection", (ws) => {
                // 클라이언트 ID 생성 (연결 시점)
                const clientId = `client-${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(7)}`;
                ws.clientId = clientId; // WebSocket 객체에 clientId 저장
                this.clients.add(ws);
                this.log(`Client connected to Cursor Remote (ID: ${clientId})`);
                this.notifyClientChange(true);
                ws.on("message", (message) => {
                    const messageStr = message.toString();
                    this.log(`Received message from ${clientId}: ${messageStr.substring(0, 100)}${messageStr.length > 100 ? "..." : ""}`);
                    // 메시지에 clientId 추가
                    try {
                        const parsed = JSON.parse(messageStr);
                        parsed.clientId = clientId;
                        const messageWithClientId = JSON.stringify(parsed);
                        // 모든 핸들러에 clientId가 포함된 메시지 전달
                        this.messageHandlers.forEach((handler) => {
                            try {
                                handler(messageWithClientId);
                            }
                            catch (error) {
                                this.logError("Error in message handler", error);
                            }
                        });
                    }
                    catch (error) {
                        // JSON 파싱 실패 시 원본 메시지 전달
                        this.messageHandlers.forEach((handler) => {
                            try {
                                handler(messageStr);
                            }
                            catch (err) {
                                this.logError("Error in message handler", err);
                            }
                        });
                    }
                });
                ws.on("close", () => {
                    const disconnectedClientId = ws.clientId || "unknown";
                    this.log(`Client disconnected from Cursor Remote (ID: ${disconnectedClientId})`);
                    this.clients.delete(ws);
                    this.notifyClientChange(this.clients.size > 0);
                });
                ws.on("error", (error) => {
                    this.logError("WebSocket error", error);
                });
                // 연결 성공 메시지 전송
                this.sendToClient(ws, JSON.stringify({
                    type: "connected",
                    message: "Connected to Cursor Remote",
                }));
            });
            this.wss.on("error", (error) => {
                this.logError("WebSocket server error", error);
                if (error.code === "EADDRINUSE") {
                    const errorMsg = `포트 ${availablePort}가 사용 중입니다. 다른 프로세스를 종료하거나 Cursor를 재시작해주세요.`;
                    vscode.window.showErrorMessage(`Cursor Remote: ${errorMsg}`);
                    reject(new Error(errorMsg));
                }
                else {
                    vscode.window.showErrorMessage(`Cursor Remote server error: ${error.message}`);
                    reject(error);
                }
            });
            this.wss.on("listening", () => {
                this.log(`✅ WebSocket server started on port ${availablePort}`);
                resolve();
            });
            this.log(`WebSocket server starting on port ${availablePort}...`);
        });
    }
    stop() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
            this.actualPort = null;
            this.log("WebSocket server stopped");
        }
    }
    getActualPort() {
        return this.actualPort || (this.wss ? this.port : null);
    }
    isRunning() {
        return this.wss !== null;
    }
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    // Trigger message handlers directly (for relay messages)
    triggerMessageHandlers(message) {
        this.log(`Triggering ${this.messageHandlers.length} message handler(s) for relay message`);
        this.messageHandlers.forEach((handler, index) => {
            try {
                this.log(`Calling message handler ${index + 1}/${this.messageHandlers.length}`);
                handler(message);
                this.log(`Message handler ${index + 1} completed`);
            }
            catch (error) {
                this.logError(`Error in message handler ${index + 1}`, error);
            }
        });
        this.log(`All message handlers processed`);
    }
    onClientChange(handler) {
        this.clientChangeHandlers.push(handler);
    }
    notifyClientChange(connected) {
        this.clientChangeHandlers.forEach((handler) => {
            try {
                handler(connected);
            }
            catch (error) {
                console.error("Error in client change handler:", error);
            }
        });
    }
    getClientCount() {
        return this.clients.size;
    }
    getConnectionStatus() {
        return {
            isRunning: this.isRunning(),
            clientCount: this.clients.size,
            port: this.getActualPort(),
        };
    }
    // 연결 상태를 클라이언트에 전송
    sendConnectionStatus() {
        const status = this.getConnectionStatus();
        const statusMessage = JSON.stringify({
            type: "connection_status",
            status: status.isRunning ? "connected" : "disconnected",
            source: "extension",
            message: status.isRunning
                ? `WebSocket server running on port ${status.port} (${status.clientCount} client(s))`
                : "WebSocket server not running",
            data: status,
        });
        this.send(statusMessage);
    }
    /**
     * Set relay client for forwarding messages to relay server
     */
    setRelayClient(relayClient) {
        this.relayClient = relayClient;
    }
    send(message) {
        // Send to local WebSocket clients
        if (this.wss) {
            this.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
        // Also send to relay server if connected to relay session
        // Skip if message is from relay (to prevent loops)
        if (this.relayClient && this.relayClient.isConnectedToSession()) {
            try {
                const parsed = JSON.parse(message);
                // Only forward if message is not from relay
                if (parsed.source !== "relay") {
                    // Skip streaming chunks in relay mode - only send final responses
                    // This prevents duplicate/partial messages from reaching mobile app
                    if (parsed.type === "chat_response_chunk") {
                        // Don't send streaming chunks to relay - wait for final chat_response
                        return;
                    }
                    if (parsed.type === "chat_response") {
                        this.log(`Forwarding chat_response to relay (text length: ${(parsed.text || "").length})`);
                    }
                    this.relayClient.sendMessage(message).catch((error) => {
                        const errorMsg = error instanceof Error ? error.message : "Unknown error";
                        this.logError(`Failed to send to relay: ${errorMsg}`);
                    });
                }
            }
            catch (error) {
                // If message is not JSON, send as-is
                // But check if it's a log message (which we don't want to forward)
                if (!message.includes('"type":"log"')) {
                    this.relayClient.sendMessage(message).catch((error) => {
                        const errorMsg = error instanceof Error ? error.message : "Unknown error";
                        this.logError(`Failed to send to relay: ${errorMsg}`);
                    });
                }
            }
        }
    }
    /**
     * Broadcast message to all clients including relay (for logs)
     * Unlike send(), this also sends log messages to relay
     */
    broadcast(message) {
        // Send to local WebSocket clients
        if (this.wss) {
            this.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
        // Also send to relay server (including log messages)
        if (this.relayClient && this.relayClient.isConnectedToSession()) {
            this.relayClient.sendMessage(message).catch(() => {
                // Ignore errors for broadcast (to prevent infinite loops)
            });
        }
    }
    // HTTP POST 요청으로 메시지 수신 (hook에서 사용)
    sendFromHook(data) {
        const message = JSON.stringify(data);
        this.send(message);
        this.log(`Message sent from hook: ${data.type || "unknown"}`);
    }
    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    }
}
exports.WebSocketServer = WebSocketServer;
//# sourceMappingURL=websocket-server.js.map