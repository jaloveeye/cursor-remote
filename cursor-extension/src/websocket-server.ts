import * as WebSocket from 'ws';
import * as vscode from 'vscode';

export class WebSocketServer {
    private wss: WebSocket.Server | null = null;
    private port: number;
    private messageHandlers: ((message: string) => void)[] = [];

    constructor(port: number) {
        this.port = port;
    }

    start() {
        if (this.wss) {
            console.log('WebSocket server is already running');
            return;
        }

        this.wss = new WebSocket.Server({ port: this.port });

        this.wss.on('connection', (ws: WebSocket) => {
            console.log('Client connected to Cursor Remote');

            ws.on('message', (message: Buffer) => {
                const messageStr = message.toString();
                console.log('Received message:', messageStr);
                
                // 모든 핸들러에 메시지 전달
                this.messageHandlers.forEach(handler => {
                    try {
                        handler(messageStr);
                    } catch (error) {
                        console.error('Error in message handler:', error);
                    }
                });
            });

            ws.on('close', () => {
                console.log('Client disconnected from Cursor Remote');
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

            // 연결 성공 메시지 전송
            this.sendToClient(ws, JSON.stringify({ 
                type: 'connected', 
                message: 'Connected to Cursor Remote' 
            }));
        });

        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
            vscode.window.showErrorMessage(`Cursor Remote server error: ${error.message}`);
        });

        console.log(`Cursor Remote WebSocket server started on port ${this.port}`);
    }

    stop() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
            console.log('Cursor Remote WebSocket server stopped');
        }
    }

    isRunning(): boolean {
        return this.wss !== null;
    }

    onMessage(handler: (message: string) => void) {
        this.messageHandlers.push(handler);
    }

    send(message: string) {
        if (!this.wss) {
            console.warn('WebSocket server is not running');
            return;
        }

        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    private sendToClient(ws: WebSocket, message: string) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    }
}
