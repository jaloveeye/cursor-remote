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
const relay_client_1 = require("./relay-client");
const config_1 = require("./config");
let wsServer = null;
let commandHandler = null;
let commandRouter = null;
let chatCapture = null;
let httpServer = null;
let rulesManager = null;
let statusBarManager = null;
let relayClient = null;
let outputChannel;
async function activate(context) {
    // Output channel creation
    outputChannel = vscode.window.createOutputChannel("Cursor Remote");
    context.subscriptions.push(outputChannel);
    outputChannel.show(true);
    // 로그를 클라이언트에 전송하는 헬퍼 함수
    const sendLogToClients = (level, message, error) => {
        if (wsServer) {
            const logData = {
                level,
                message,
                timestamp: new Date().toISOString(),
                source: "extension",
                ...(error && {
                    error: error instanceof Error ? error.message : String(error),
                }),
            };
            wsServer.send(JSON.stringify({
                type: "log",
                ...logData,
            }));
        }
    };
    outputChannel.appendLine("Cursor Remote extension is now active!");
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 🔄 Extension activation started`);
    console.log("Cursor Remote extension is now active!");
    sendLogToClients("info", "Cursor Remote extension is now active!");
    // Status bar manager
    statusBarManager = new status_bar_1.StatusBarManager(context);
    // WebSocket server initialization
    wsServer = new websocket_server_1.WebSocketServer(config_1.CONFIG.WEBSOCKET_PORT, outputChannel);
    statusBarManager.setWebSocketServer(wsServer);
    // CLI mode is always enabled (IDE mode is deprecated)
    const useCLIMode = true;
    commandHandler = new command_handler_1.CommandHandler(outputChannel, wsServer, useCLIMode);
    commandRouter = new command_router_1.CommandRouter(commandHandler, wsServer, outputChannel);
    outputChannel.appendLine("[Cursor Remote] CLI mode is enabled - using Cursor CLI");
    // HTTP server for hooks
    httpServer = new http_server_1.HttpServer(outputChannel, wsServer);
    await httpServer.start().catch((error) => {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start HTTP server: ${errorMsg}`);
        vscode.window.showErrorMessage(`Cursor Remote: HTTP server start failed - ${errorMsg}`);
    });
    // Rules manager (CHAT_SUMMARY hook 제거됨 - stdout 응답만 사용)
    // rulesManager는 hooks.json 관리를 위해 유지하지만, CHAT_SUMMARY 감시는 제거
    rulesManager = new rules_manager_1.RulesManager(outputChannel, httpServer);
    // Chat capture
    chatCapture = new chat_capture_1.ChatCapture(outputChannel, wsServer);
    chatCapture.setup(context);
    // WebSocket message handler
    wsServer.onMessage((message) => {
        try {
            const command = JSON.parse(message);
            const clientId = command.clientId || "none";
            const source = command.source || "local";
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Received command: ${command.type} from client: ${clientId} (source: ${source})`);
            // Handle command locally (whether from local WebSocket or relay)
            if (commandRouter) {
                commandRouter.handleCommand(command);
            }
            // If message is from local WebSocket client (not from relay), forward to relay
            if (source !== "relay" &&
                relayClient &&
                relayClient.isConnectedToSession()) {
                relayClient.sendMessage(message).catch((error) => {
                    const errorMsg = error instanceof Error ? error.message : "Unknown error";
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to send to relay: ${errorMsg}`);
                });
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Error parsing message: ${errorMsg}`);
            console.error("Error parsing message:", error);
        }
    });
    // Client connection/disconnection event handling
    wsServer.onClientChange((connected) => {
        if (statusBarManager) {
            statusBarManager.update(connected);
        }
        if (connected) {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Client connected - Ready to receive commands`);
            // 연결 상태 전송
            if (wsServer) {
                wsServer.sendConnectionStatus();
            }
        }
        else {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Client disconnected`);
            // 연결 상태 전송
            if (wsServer) {
                wsServer.sendConnectionStatus();
            }
        }
    });
    // Register commands
    const startCommand = vscode.commands.registerCommand("cursorRemote.start", () => {
        if (wsServer && !wsServer.isRunning()) {
            wsServer
                .start()
                .then(() => {
                if (statusBarManager) {
                    statusBarManager.update(false);
                }
                vscode.window.showInformationMessage(`Cursor Remote server started on port ${config_1.CONFIG.WEBSOCKET_PORT}`);
            })
                .catch((error) => {
                const errorMsg = error instanceof Error ? error.message : "Unknown error";
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start WebSocket server: ${errorMsg}`);
                vscode.window.showErrorMessage(`Cursor Remote: Server start failed - ${errorMsg}`);
                if (statusBarManager) {
                    statusBarManager.update(false);
                }
            });
        }
        else {
            vscode.window.showInformationMessage("Cursor Remote server is already running");
        }
    });
    const stopCommand = vscode.commands.registerCommand("cursorRemote.stop", () => {
        if (wsServer && wsServer.isRunning()) {
            wsServer.stop();
            if (statusBarManager) {
                statusBarManager.update(false);
            }
            vscode.window.showInformationMessage("Cursor Remote server stopped");
        }
        else {
            vscode.window.showInformationMessage("Cursor Remote server is not running");
        }
    });
    const toggleCommand = vscode.commands.registerCommand("cursorRemote.toggle", () => {
        if (wsServer) {
            if (wsServer.isRunning()) {
                wsServer.stop();
                if (statusBarManager) {
                    statusBarManager.update(false);
                }
            }
            else {
                wsServer
                    .start()
                    .then(() => {
                    if (statusBarManager) {
                        statusBarManager.update(false);
                    }
                })
                    .catch((error) => {
                    const errorMsg = error instanceof Error ? error.message : "Unknown error";
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
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 🔄 Creating RelayClient instance...`);
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 🔄 Relay Server URL: ${config_1.CONFIG.RELAY_SERVER_URL}`);
    relayClient = new relay_client_1.RelayClient(config_1.CONFIG.RELAY_SERVER_URL, outputChannel);
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ RelayClient instance created`);
    // Set relay client in WebSocket server for automatic message forwarding
    if (wsServer && relayClient) {
        wsServer.setRelayClient(relayClient);
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Relay client set in WebSocket server`);
    }
    // Status bar: reflect relay connection (클라이언트 접속 시 "Connected" 표시)
    if (statusBarManager && relayClient) {
        statusBarManager.setRelayClient(relayClient);
        relayClient.setOnSessionConnected(() => {
            if (statusBarManager)
                statusBarManager.refresh();
        });
    }
    // Set up message forwarding: Relay Server -> Extension WebSocket
    relayClient.setOnMessage((message) => {
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] === RELAY: 메시지 수신됨 (길이: ${message.length}) ===`);
        // Mark message as from relay to prevent loop
        try {
            const parsed = JSON.parse(message);
            parsed.source = "relay";
            // clientId가 없으면 'relay'로 설정
            if (!parsed.clientId) {
                parsed.clientId = "relay-client";
            }
            const relayMessage = JSON.stringify(parsed);
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 📥 Message from relay, forwarding to command handler... (type: ${parsed.type})`);
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 📋 Relay message: ${relayMessage.substring(0, 300)}`);
            // Directly trigger the message handlers to process the command
            // This is the same handler that processes WebSocket client messages
            if (wsServer) {
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 🔄 Calling triggerMessageHandlers...`);
                wsServer.triggerMessageHandlers(relayMessage);
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ triggerMessageHandlers called`);
            }
            else {
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ WebSocket server is null - cannot process relay message`);
            }
        }
        catch (error) {
            // If message is not JSON, send as-is but mark source
            const relayMessage = JSON.stringify({
                type: "message",
                data: message,
                source: "relay",
                clientId: "relay-client",
            });
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 📥 Message from relay (non-JSON), forwarding to command handler...`);
            if (wsServer) {
                wsServer.triggerMessageHandlers(relayMessage);
            }
            else {
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ WebSocket server is null - cannot process relay message`);
            }
        }
    });
    // Auto start
    wsServer
        .start()
        .then(async () => {
        if (statusBarManager) {
            statusBarManager.update(false); // Client not connected yet
        }
        // Start relay client after WebSocket server is ready
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 🔄 Initializing relay client...`);
        if (relayClient) {
            try {
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 🔄 Starting relay client...`);
                await relayClient.start();
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Relay client started - waiting for mobile client to create session...`);
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : "Unknown error";
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ Failed to start relay client: ${errorMsg}`);
                if (error instanceof Error && error.stack) {
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Stack: ${error.stack}`);
                }
                // Don't show error to user - relay is optional
            }
        }
        else {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ Relay client is null - not initialized`);
        }
    })
        .catch((error) => {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
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
//# sourceMappingURL=extension.js.map