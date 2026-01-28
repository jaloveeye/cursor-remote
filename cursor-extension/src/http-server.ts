/**
 * HTTP server module for receiving chat responses from hooks
 */

import * as vscode from 'vscode';
import * as http from 'http';
import * as net from 'net';
import { WebSocketServer } from './websocket-server';
import { CONFIG } from './config';

export class HttpServer {
    private server: http.Server | null = null;
    private port: number | null = null;
    private outputChannel: vscode.OutputChannel;
    private wsServer: WebSocketServer;

    constructor(outputChannel: vscode.OutputChannel, wsServer: WebSocketServer) {
        this.outputChannel = outputChannel;
        this.wsServer = wsServer;
    }

    private log(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.log(logMessage);
    }

    private logError(message: string, error?: any) {
        const timestamp = new Date().toLocaleTimeString();
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const logMessage = `[${timestamp}] ❌ ${message}: ${errorMsg}`;
        this.outputChannel.appendLine(logMessage);
        console.error(logMessage);
    }

    /**
     * Find available port
     */
    private async findAvailablePort(startPort: number, maxAttempts: number = CONFIG.PORT_SEARCH_MAX_ATTEMPTS): Promise<number | null> {
        return new Promise((resolve) => {
            let currentPort = startPort;
            let attempts = 0;

            const tryPort = (port: number) => {
                const server = net.createServer();

                server.listen(port, () => {
                    server.once('close', () => {
                        resolve(port);
                    });
                    server.close();
                });

                server.on('error', (err: NodeJS.ErrnoException) => {
                    if (err.code === 'EADDRINUSE') {
                        attempts++;
                        if (attempts < maxAttempts) {
                            tryPort(port + 1);
                        } else {
                            resolve(null);
                        }
                    } else {
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
    async start(): Promise<void> {
        // Close existing server if any
        if (this.server) {
            try {
                this.server.close();
                this.server = null;
                this.port = null;
                this.log('🔄 Closing existing HTTP server to restart...');
            } catch (error) {
                // Ignore and continue
            }
        }

        // Find available port
        const httpPort = CONFIG.HTTP_PORT;
        const availablePort = await this.findAvailablePort(httpPort);

        if (availablePort === null) {
            const errorMsg = `포트 ${httpPort}부터 ${httpPort + CONFIG.PORT_SEARCH_MAX_ATTEMPTS}까지 모두 사용 중입니다. 다른 프로세스를 종료하거나 Cursor를 재시작해주세요.`;
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
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                        this.logError('Error processing hook data', error);
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: errorMsg }));
                    }
                });
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        this.port = availablePort;

        // Start server
        return new Promise((resolve, reject) => {
            this.server!.listen(availablePort, 'localhost', () => {
                this.log(`✅ HTTP server for hooks started on port ${availablePort}`);
                this.log('💡 Waiting for Rules-based chat responses...');
                resolve();
            });

            this.server!.on('error', (error: NodeJS.ErrnoException) => {
                const errorMsg = error.code === 'EADDRINUSE'
                    ? `포트 ${availablePort}가 사용 중입니다. Cursor를 재시작해주세요.`
                    : error.message;
                this.logError('HTTP server error', errorMsg);
                if (error.code === 'EADDRINUSE') {
                    vscode.window.showErrorMessage(`Cursor Remote: ${errorMsg}`);
                    this.server = null;
                    this.port = null;
                } else {
                    vscode.window.showErrorMessage(`Cursor Remote: HTTP 서버 오류 - ${errorMsg}`);
                }
                reject(new Error(errorMsg));
            });
        });
    }

    /**
     * Get current HTTP server port
     */
    getPort(): number | null {
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
