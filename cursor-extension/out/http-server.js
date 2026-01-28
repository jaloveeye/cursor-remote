"use strict";
/**
 * HTTP server module for receiving chat responses from hooks
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
exports.HttpServer = void 0;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const net = __importStar(require("net"));
const config_1 = require("./config");
class HttpServer {
    constructor(outputChannel, wsServer) {
        this.server = null;
        this.port = null;
        this.outputChannel = outputChannel;
        this.wsServer = wsServer;
    }
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.log(logMessage);
    }
    logError(message, error) {
        const timestamp = new Date().toLocaleTimeString();
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const logMessage = `[${timestamp}] ❌ ${message}: ${errorMsg}`;
        this.outputChannel.appendLine(logMessage);
        console.error(logMessage);
    }
    /**
     * Find available port
     */
    async findAvailablePort(startPort, maxAttempts = config_1.CONFIG.PORT_SEARCH_MAX_ATTEMPTS) {
        return new Promise((resolve) => {
            let currentPort = startPort;
            let attempts = 0;
            const tryPort = (port) => {
                const server = net.createServer();
                server.listen(port, () => {
                    server.once('close', () => {
                        resolve(port);
                    });
                    server.close();
                });
                server.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
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
    /**
     * Start HTTP server
     */
    async start() {
        // Close existing server if any
        if (this.server) {
            try {
                this.server.close();
                this.server = null;
                this.port = null;
                this.log('🔄 Closing existing HTTP server to restart...');
            }
            catch (error) {
                // Ignore and continue
            }
        }
        // Find available port
        const httpPort = config_1.CONFIG.HTTP_PORT;
        const availablePort = await this.findAvailablePort(httpPort);
        if (availablePort === null) {
            const errorMsg = `포트 ${httpPort}부터 ${httpPort + config_1.CONFIG.PORT_SEARCH_MAX_ATTEMPTS}까지 모두 사용 중입니다. 다른 프로세스를 종료하거나 Cursor를 재시작해주세요.`;
            this.logError(errorMsg);
            vscode.window.showErrorMessage(`Cursor Remote: ${errorMsg}`);
            return;
        }
        if (availablePort !== httpPort) {
            const warningMsg = `포트 ${httpPort}가 사용 중이어서 포트 ${availablePort}를 사용합니다.`;
            this.log(`⚠️ ${warningMsg}`);
            vscode.window.showWarningMessage(`Cursor Remote: ${warningMsg}`);
        }
        // Create HTTP server
        this.server = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/hook') {
                let body = '';
                req.on('data', (chunk) => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        const messageType = data.type || 'unknown';
                        this.log(`Received from hook: ${messageType} (${data.text?.length || 0} bytes)`);
                        // Send to WebSocket client
                        if (this.wsServer) {
                            this.wsServer.sendFromHook(data);
                            this.log('✅ Chat response sent to mobile app via WebSocket');
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }
                    catch (error) {
                        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                        this.logError('Error processing hook data', error);
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: errorMsg }));
                    }
                });
            }
            else {
                res.writeHead(404);
                res.end('Not found');
            }
        });
        this.port = availablePort;
        // Start server
        return new Promise((resolve, reject) => {
            this.server.listen(availablePort, 'localhost', () => {
                this.log(`✅ HTTP server for hooks started on port ${availablePort}`);
                this.log('💡 Waiting for Rules-based chat responses...');
                resolve();
            });
            this.server.on('error', (error) => {
                const errorMsg = error.code === 'EADDRINUSE'
                    ? `포트 ${availablePort}가 사용 중입니다. Cursor를 재시작해주세요.`
                    : error.message;
                this.logError('HTTP server error', errorMsg);
                if (error.code === 'EADDRINUSE') {
                    vscode.window.showErrorMessage(`Cursor Remote: ${errorMsg}`);
                    this.server = null;
                    this.port = null;
                }
                else {
                    vscode.window.showErrorMessage(`Cursor Remote: HTTP 서버 오류 - ${errorMsg}`);
                }
                reject(new Error(errorMsg));
            });
        });
    }
    /**
     * Get current HTTP server port
     */
    getPort() {
        return this.port;
    }
    /**
     * Stop HTTP server
     */
    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.port = null;
            this.log('HTTP server stopped');
        }
    }
}
exports.HttpServer = HttpServer;
//# sourceMappingURL=http-server.js.map