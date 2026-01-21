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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const websocket_server_1 = require("./websocket-server");
const command_handler_1 = require("./command-handler");
const command_router_1 = require("./command-router");
const chat_capture_1 = require("./chat-capture");
const http_server_1 = require("./http-server");
const rules_manager_1 = require("./rules-manager");
const status_bar_1 = require("./status-bar");
const config_1 = require("./config");
let wsServer = null;
let commandHandler = null;
let commandRouter = null;
let chatCapture = null;
let httpServer = null;
let rulesManager = null;
let statusBarManager = null;
let outputChannel;
async function activate(context) {
    // Output channel creation
    outputChannel = vscode.window.createOutputChannel('Cursor Remote');
    context.subscriptions.push(outputChannel);
    outputChannel.show(true);
    outputChannel.appendLine('Cursor Remote extension is now active!');
    console.log('Cursor Remote extension is now active!');
    // Status bar manager
    statusBarManager = new status_bar_1.StatusBarManager(context);
    // WebSocket server initialization
    wsServer = new websocket_server_1.WebSocketServer(config_1.CONFIG.WEBSOCKET_PORT, outputChannel);
    statusBarManager.setWebSocketServer(wsServer);
    // CLI mode configuration check
    const config = vscode.workspace.getConfiguration('cursorRemote');
    const useCLIMode = config.get('useCLIMode', false);
    commandHandler = new command_handler_1.CommandHandler(outputChannel, wsServer, useCLIMode);
    commandRouter = new command_router_1.CommandRouter(commandHandler, wsServer, outputChannel);
    if (useCLIMode) {
        outputChannel.appendLine('[Cursor Remote] CLI mode is enabled - using Cursor CLI instead of IDE');
    }
    else {
        outputChannel.appendLine('[Cursor Remote] IDE mode is enabled - using Cursor IDE extension');
    }
    // HTTP server for hooks
    httpServer = new http_server_1.HttpServer(outputChannel, wsServer);
    await httpServer.start().catch((error) => {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start HTTP server: ${errorMsg}`);
        vscode.window.showErrorMessage(`Cursor Remote: HTTP server start failed - ${errorMsg}`);
    });
    // Rules manager
    rulesManager = new rules_manager_1.RulesManager(outputChannel, httpServer);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        rulesManager.ensureRulesFile(workspaceRoot);
        rulesManager.startChatFileWatcher(context, workspaceRoot, wsServer);
    }
    // Chat capture
    chatCapture = new chat_capture_1.ChatCapture(outputChannel, wsServer);
    chatCapture.setup(context);
    // WebSocket message handler
    wsServer.onMessage((message) => {
        try {
            const command = JSON.parse(message);
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Received command: ${command.type}`);
            if (commandRouter) {
                commandRouter.handleCommand(command);
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Error parsing message: ${errorMsg}`);
            console.error('Error parsing message:', error);
        }
    });
    // Client connection/disconnection event handling
    wsServer.onClientChange((connected) => {
        if (statusBarManager) {
            statusBarManager.update(connected);
        }
        if (connected) {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Client connected - Rules-based chat capture is active`);
        }
        else {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Client disconnected`);
        }
    });
    // Register commands
    const startCommand = vscode.commands.registerCommand('cursorRemote.start', () => {
        if (wsServer && !wsServer.isRunning()) {
            wsServer.start().then(() => {
                if (statusBarManager) {
                    statusBarManager.update(false);
                }
                vscode.window.showInformationMessage(`Cursor Remote server started on port ${config_1.CONFIG.WEBSOCKET_PORT}`);
            }).catch((error) => {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start WebSocket server: ${errorMsg}`);
                vscode.window.showErrorMessage(`Cursor Remote: Server start failed - ${errorMsg}`);
                if (statusBarManager) {
                    statusBarManager.update(false);
                }
            });
        }
        else {
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
        }
        else {
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
            }
            else {
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
    // Auto start
    wsServer.start().then(() => {
        if (statusBarManager) {
            statusBarManager.update(false); // Client not connected yet
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
function deactivate() {
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
//# sourceMappingURL=extension.js.map