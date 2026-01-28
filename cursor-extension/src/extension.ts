import * as vscode from 'vscode';
import { WebSocketServer } from './websocket-server';
import { CommandHandler } from './command-handler';
import { CommandRouter } from './command-router';
import { ChatCapture } from './chat-capture';
import { HttpServer } from './http-server';
import { RulesManager } from './rules-manager';
import { StatusBarManager } from './status-bar';
import { RelayClient } from './relay-client';
import { CONFIG } from './config';

let wsServer: WebSocketServer | null = null;
let commandHandler: CommandHandler | null = null;
let commandRouter: CommandRouter | null = null;
let chatCapture: ChatCapture | null = null;
let httpServer: HttpServer | null = null;
let rulesManager: RulesManager | null = null;
let statusBarManager: StatusBarManager | null = null;
let relayClient: RelayClient | null = null;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
    // Output channel creation
    outputChannel = vscode.window.createOutputChannel('Cursor Remote');
    context.subscriptions.push(outputChannel);
    outputChannel.show(true);
    
    // 로그를 클라이언트에 전송하는 헬퍼 함수
    const sendLogToClients = (level: 'info' | 'warn' | 'error', message: string, error?: any) => {
        if (wsServer) {
            const logData = {
                level,
                message,
                timestamp: new Date().toISOString(),
                source: 'extension',
                ...(error && { error: error instanceof Error ? error.message : String(error) })
            };
            wsServer.send(JSON.stringify({
                type: 'log',
                ...logData
            }));
        }
    };
    
    outputChannel.appendLine('Cursor Remote extension is now active!');
    console.log('Cursor Remote extension is now active!');
    sendLogToClients('info', 'Cursor Remote extension is now active!');

    // Status bar manager
    statusBarManager = new StatusBarManager(context);

    // WebSocket server initialization
    wsServer = new WebSocketServer(CONFIG.WEBSOCKET_PORT, outputChannel);
    statusBarManager.setWebSocketServer(wsServer);
    
    // CLI mode is always enabled (IDE mode is deprecated)
    const useCLIMode = true;
    
    commandHandler = new CommandHandler(outputChannel, wsServer, useCLIMode);
    commandRouter = new CommandRouter(commandHandler, wsServer, outputChannel);
    
    outputChannel.appendLine('[Cursor Remote] CLI mode is enabled - using Cursor CLI');
    
    // HTTP server for hooks
    httpServer = new HttpServer(outputChannel, wsServer);
    await httpServer.start().catch((error) => {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start HTTP server: ${errorMsg}`);
        vscode.window.showErrorMessage(`Cursor Remote: HTTP server start failed - ${errorMsg}`);
    });

    // Rules manager (CHAT_SUMMARY hook 제거됨 - stdout 응답만 사용)
    // rulesManager는 hooks.json 관리를 위해 유지하지만, CHAT_SUMMARY 감시는 제거
    rulesManager = new RulesManager(outputChannel, httpServer);

    // Chat capture
    chatCapture = new ChatCapture(outputChannel, wsServer);
    chatCapture.setup(context);

    // WebSocket message handler
    wsServer.onMessage((message: string) => {
        try {
            const command = JSON.parse(message);
            const clientId = command.clientId || 'none';
            const source = command.source || 'local';
            
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Received command: ${command.type} from client: ${clientId} (source: ${source})`);
            
            // Handle command locally (whether from local WebSocket or relay)
            if (commandRouter) {
                commandRouter.handleCommand(command);
            }
            
            // If message is from local WebSocket client (not from relay), forward to relay
            if (source !== 'relay' && relayClient && relayClient.isConnectedToSession()) {
                relayClient.sendMessage(message).catch((error) => {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to send to relay: ${errorMsg}`);
                });
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Error parsing message: ${errorMsg}`);
            console.error('Error parsing message:', error);
        }
    });

    // Client connection/disconnection event handling
    wsServer.onClientChange((connected: boolean) => {
        if (statusBarManager) {
            statusBarManager.update(connected);
        }
        
        if (connected) {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Client connected - Ready to receive commands`);
            // 연결 상태 전송
            if (wsServer) {
                wsServer.sendConnectionStatus();
            }
        } else {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Client disconnected`);
            // 연결 상태 전송
            if (wsServer) {
                wsServer.sendConnectionStatus();
            }
        }
    });

    // Register commands
    const startCommand = vscode.commands.registerCommand('cursorRemote.start', () => {
        if (wsServer && !wsServer.isRunning()) {
            wsServer.start().then(() => {
                if (statusBarManager) {
                    statusBarManager.update(false);
                }
                vscode.window.showInformationMessage(`Cursor Remote server started on port ${CONFIG.WEBSOCKET_PORT}`);
            }).catch((error) => {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start WebSocket server: ${errorMsg}`);
                vscode.window.showErrorMessage(`Cursor Remote: Server start failed - ${errorMsg}`);
                if (statusBarManager) {
                    statusBarManager.update(false);
                }
            });
        } else {
            vscode.window.showInformationMessage('Cursor Remote server is already running');
        }
    });

    const stopCommand = vscode.commands.registerCommand('cursorRemote.stop', () => {
        if (wsServer && wsServer.isRunning()) {
            wsServer.stop();
            if (statusBarManager) {
                statusBarManager.update(false);
            }
            vscode.window.showInformationMessage('Cursor Remote server stopped');
        } else {
            vscode.window.showInformationMessage('Cursor Remote server is not running');
        }
    });

    const toggleCommand = vscode.commands.registerCommand('cursorRemote.toggle', () => {
        if (wsServer) {
            if (wsServer.isRunning()) {
                wsServer.stop();
                if (statusBarManager) {
                    statusBarManager.update(false);
                }
            } else {
                wsServer.start().then(() => {
                    if (statusBarManager) {
                        statusBarManager.update(false);
                    }
                }).catch((error) => {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start WebSocket server: ${errorMsg}`);
                    vscode.window.showErrorMessage(`Cursor Remote: Server start failed - ${errorMsg}`);
                    if (statusBarManager) {
                        statusBarManager.update(false);
                    }
                });
            }
        }
    });

    context.subscriptions.push(startCommand, stopCommand, toggleCommand);

    // Initialize relay client
    relayClient = new RelayClient(CONFIG.RELAY_SERVER_URL, outputChannel);
    
    // Set up message forwarding: Relay Server -> Extension WebSocket
    relayClient.setOnMessage((message: string) => {
        // Mark message as from relay to prevent loop
        try {
            const parsed = JSON.parse(message);
            parsed.source = 'relay';
            const relayMessage = JSON.stringify(parsed);
            
            // Forward message from relay to WebSocket server clients
            // This will trigger the onMessage handler above, which will process the command
            if (wsServer) {
                wsServer.send(relayMessage);
            }
        } catch (error) {
            // If message is not JSON, send as-is but mark source
            const relayMessage = JSON.stringify({
                type: 'message',
                data: message,
                source: 'relay'
            });
            if (wsServer) {
                wsServer.send(relayMessage);
            }
        }
    });

    // Auto start
    wsServer.start().then(async () => {
        if (statusBarManager) {
            statusBarManager.update(false); // Client not connected yet
        }
        
        // Start relay client after WebSocket server is ready
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 🔄 Initializing relay client...`);
        if (relayClient) {
            try {
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 🔄 Starting relay client...`);
                await relayClient.start();
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Relay client started - waiting for mobile client session...`);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ Failed to start relay client: ${errorMsg}`);
                if (error instanceof Error && error.stack) {
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Stack: ${error.stack}`);
                }
                // Don't show error to user - relay is optional
            }
        } else {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ Relay client is null - not initialized`);
        }
    }).catch((error) => {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start WebSocket server: ${errorMsg}`);
        vscode.window.showErrorMessage(`Cursor Remote: Server start failed - ${errorMsg}`);
        if (statusBarManager) {
            statusBarManager.update(false);
        }
    });
    
    if (statusBarManager) {
        statusBarManager.show();
    }
}

export function deactivate() {
    if (relayClient) {
        relayClient.stop();
        relayClient = null;
    }
    
    if (chatCapture) {
        chatCapture.dispose();
        chatCapture = null;
    }
    
    if (httpServer) {
        httpServer.stop();
        httpServer = null;
    }
    
    if (wsServer) {
        wsServer.stop();
        wsServer = null;
    }
    
    if (commandHandler) {
        commandHandler.dispose();
        commandHandler = null;
    }
    
    commandRouter = null;
    rulesManager = null;
    statusBarManager = null;
}
