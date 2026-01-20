import * as WebSocket from 'ws';
import * as vscode from 'vscode';

type WebSocketClient = WebSocket;

export class WebSocketServer {
    private wss: WebSocket.Server | null = null;
    private port: number;
    private messageHandlers: ((message: string) => void)[] = [];
    private clientChangeHandlers: ((connected: boolean) => void)[] = [];
    private clients: Set<WebSocketClient> = new Set();
    private outputChannel: vscode.OutputChannel | null = null;

    constructor(port: number, outputChannel?: vscode.OutputChannel) {
        this.port = port;
        this.outputChannel = outputChannel || null;
    }

    private log(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        }
        console.log(logMessage);
    }

    private logError(message: string, error?: any) {
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

        this.wss.on('connection', (ws: WebSocketClient) => {
            this.clients.add(ws);
            this.log('Client connected to Cursor Remote');
            this.notifyClientChange(true);

            ws.on('message', (message: Buffer) => {
                const messageStr = message.toString();
                this.log(`Received message: ${messageStr.substring(0, 100)}${messageStr.length > 100 ? '...' : ''}`);
                
                // 모든 핸들러에 메시지 전달
                this.messageHandlers.forEach(handler => {
                    try {
                        handler(messageStr);
                    } catch (error) {
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

    isRunning(): boolean {
        return this.wss !== null;
    }

    onMessage(handler: (message: string) => void) {
        this.messageHandlers.push(handler);
    }

    onClientChange(handler: (connected: boolean) => void) {
        this.clientChangeHandlers.push(handler);
    }

    private notifyClientChange(connected: boolean) {
        this.clientChangeHandlers.forEach(handler => {
            try {
                handler(connected);
            } catch (error) {
                console.error('Error in client change handler:', error);
            }
        });
    }

    getClientCount(): number {
        return this.clients.size;
    }

    send(message: string) {
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
    sendFromHook(data: any) {
        const message = JSON.stringify(data);
        this.send(message);
        this.log(`Message sent from hook: ${data.type || 'unknown'}`);
    }

    private sendToClient(ws: WebSocketClient, message: string) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    }
}
