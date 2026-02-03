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
/** 연결 정보 Webview 패널 (열려 있을 때만 갱신용) */
let connectionsPanel = null;
/** 패널 열린 동안 주기 갱신 타이머 (dispose 시 해제) */
let connectionsPanelRefreshInterval = null;
/** 연결 정보 Webview용 HTML 생성 */
function getConnectionsViewHtml(data) {
    const { serverRunning, serverPort, relaySessionId, localClientIds } = data;
    const relaySection = relaySessionId != null
        ? `
    <section class="section">
      <h2>📡 릴레이</h2>
      <p class="status connected">릴레이 서버를 통해 접속 중</p>
      <p class="session-id"><strong>세션 ID:</strong> <code>${escapeHtml(relaySessionId)}</code></p>
    </section>`
        : `
    <section class="section">
      <h2>📡 릴레이</h2>
      <p class="status disconnected">연결 안 됨</p>
    </section>`;
    const localSection = localClientIds.length > 0
        ? `
    <section class="section">
      <h2>🖥️ 로컬 클라이언트 (${localClientIds.length}개)</h2>
      <ul>${localClientIds
            .map((id) => `<li><code>${escapeHtml(id)}</code></li>`)
            .join("")}</ul>
    </section>`
        : `
    <section class="section">
      <h2>🖥️ 로컬 클라이언트</h2>
      <p class="status disconnected">연결 없음</p>
    </section>`;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); padding: 1rem; color: var(--vscode-foreground); }
    h1 { font-size: 1.2rem; margin-bottom: 1rem; }
    h2 { font-size: 1rem; margin: 1rem 0 0.5rem; color: var(--vscode-descriptionForeground); }
    .section { margin-bottom: 1.25rem; }
    .status.connected { color: var(--vscode-testing-iconPassed); }
    .status.disconnected { color: var(--vscode-descriptionForeground); }
    code { background: var(--vscode-textBlockQuote-background); padding: 0.2em 0.4em; border-radius: 4px; }
    ul { margin: 0.25rem 0; padding-left: 1.25rem; }
  </style>
</head>
<body>
  <h1>Cursor Remote - 연결 정보</h1>
  <section class="section">
    <h2>🔌 서버</h2>
    <p class="status ${serverRunning ? "connected" : "disconnected"}">
      ${serverRunning ? `포트 ${serverPort ?? "-"}에서 실행 중` : "중지됨"}
    </p>
  </section>
  ${relaySection}
  ${localSection}
</body>
</html>`;
}
function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
/** 연결 정보가 바뀌었을 때 열려 있는 패널 내용 갱신 */
function updateConnectionsView() {
    if (!connectionsPanel)
        return;
    const serverStatus = wsServer
        ? wsServer.getConnectionStatus()
        : {
            isRunning: false,
            clientCount: 0,
            port: null,
        };
    const relaySessionId = relayClient?.isConnectedToSession() === true
        ? relayClient.getSessionId()
        : null;
    const localClientIds = wsServer ? wsServer.getClientIds() : [];
    connectionsPanel.webview.html = getConnectionsViewHtml({
        serverRunning: serverStatus.isRunning,
        serverPort: serverStatus.port,
        relaySessionId,
        localClientIds,
    });
}
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
        updateConnectionsView();
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
                updateConnectionsView();
                vscode.window.showInformationMessage(`Cursor Remote server started on port ${config_1.CONFIG.WEBSOCKET_PORT}`);
            })
                .catch((error) => {
                const errorMsg = error instanceof Error ? error.message : "Unknown error";
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start WebSocket server: ${errorMsg}`);
                vscode.window.showErrorMessage(`Cursor Remote: Server start failed - ${errorMsg}`);
                if (statusBarManager) {
                    statusBarManager.update(false);
                }
                updateConnectionsView();
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
            updateConnectionsView();
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
                updateConnectionsView();
            }
            else {
                wsServer
                    .start()
                    .then(() => {
                    if (statusBarManager) {
                        statusBarManager.update(false);
                    }
                    updateConnectionsView();
                })
                    .catch((error) => {
                    const errorMsg = error instanceof Error ? error.message : "Unknown error";
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start WebSocket server: ${errorMsg}`);
                    vscode.window.showErrorMessage(`Cursor Remote: Server start failed - ${errorMsg}`);
                    if (statusBarManager) {
                        statusBarManager.update(false);
                    }
                    updateConnectionsView();
                });
            }
        }
    });
    /** 연결 정보 뷰 (상태바 클릭 시 표시 - Git Graph처럼) */
    const checkRelayServerCommand = vscode.commands.registerCommand("cursorRemote.checkRelayServer", async () => {
        if (relayClient) {
            await relayClient.checkServerStatus();
            outputChannel.show();
        }
        else {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] [Relay] ⚠️ Relay client not initialized`);
            outputChannel.show();
        }
    });
    const connectToRelaySessionByIdCommand = vscode.commands.registerCommand("cursorRemote.connectToRelaySessionById", async () => {
        if (!relayClient) {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] [Relay] ⚠️ Relay client not initialized`);
            outputChannel.show();
            return;
        }
        const sid = await vscode.window.showInputBox({
            title: "Cursor Remote: 릴레이 세션 ID",
            prompt: "모바일에서 연결한 세션 ID 6자 입력 (예: 3ZUESK)",
            placeHolder: "3ZUESK",
            validateInput: (value) => {
                const v = value?.trim().toUpperCase() ?? "";
                if (!v)
                    return "세션 ID를 입력하세요.";
                if (!/^[A-Z0-9]{6}$/.test(v))
                    return "6자 영숫자 (예: 3ZUESK)";
                return null;
            },
        });
        if (!sid)
            return;
        const pin = await vscode.window.showInputBox({
            title: "Cursor Remote: PIN (선택)",
            prompt: "PC가 이 세션에 PIN을 설정했다면 4~6자리 PIN 입력. (설정 안 했으면 공백)",
            placeHolder: "1234",
            password: true,
            validateInput: (v) => {
                const t = (v ?? "").trim();
                if (!t)
                    return null;
                if (!/^\d{4,6}$/.test(t))
                    return "4~6자리 숫자";
                return null;
            },
        });
        const pinToUse = pin != null && pin.trim() ? pin.trim() : undefined;
        await relayClient.connectToSessionById(sid, pinToUse);
        outputChannel.show();
    });
    const setRelaySessionIdCommand = vscode.commands.registerCommand("cursorRemote.setRelaySessionId", async () => {
        const sid = await vscode.window.showInputBox({
            title: "Cursor Remote: 릴레이 세션 ID 설정",
            prompt: "다음 릴레이 시작 시 사용할 세션 ID 6자 (모바일에서 같은 ID로 연결)",
            placeHolder: "3ZUESK",
            value: context.globalState.get("cursorRemote.sessionId") ?? "",
            validateInput: (value) => {
                const v = (value ?? "").trim().toUpperCase();
                if (!v)
                    return "세션 ID를 입력하세요.";
                if (!/^[A-Z0-9]{6}$/.test(v))
                    return "6자 영숫자 (예: 3ZUESK)";
                return null;
            },
        });
        if (sid) {
            await context.globalState.update("cursorRemote.sessionId", sid.trim().toUpperCase());
            vscode.window.showInformationMessage(`Cursor Remote: 세션 ID가 ${sid
                .trim()
                .toUpperCase()}로 저장되었습니다. (다음 릴레이 시작 시 사용)`);
        }
    });
    const showConnectionsCommand = vscode.commands.registerCommand("cursorRemote.showConnections", () => {
        const serverStatus = wsServer
            ? wsServer.getConnectionStatus()
            : {
                isRunning: false,
                clientCount: 0,
                port: null,
            };
        const relaySessionId = relayClient?.isConnectedToSession() === true
            ? relayClient.getSessionId()
            : null;
        const localClientIds = wsServer ? wsServer.getClientIds() : [];
        const html = getConnectionsViewHtml({
            serverRunning: serverStatus.isRunning,
            serverPort: serverStatus.port,
            relaySessionId,
            localClientIds,
        });
        const panel = vscode.window.createWebviewPanel("cursorRemote.connections", "Cursor Remote - 연결 정보", vscode.ViewColumn.One, { enableScripts: false });
        panel.webview.html = html;
        connectionsPanel = panel;
        panel.onDidDispose(() => {
            connectionsPanel = null;
        });
    });
    /** 상태줄 클릭: 릴레이 비활성 시 세션 ID·PIN 입력 후 연결, 활성 시 연결 정보 패널 */
    const statusBarClickCommand = vscode.commands.registerCommand("cursorRemote.statusBarClick", async () => {
        const relayConnected = relayClient != null && relayClient.isConnectedToSession();
        if (relayConnected) {
            vscode.commands.executeCommand("cursorRemote.showConnections");
            return;
        }
        if (!relayClient) {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] [Relay] ⚠️ Relay client not initialized`);
            outputChannel.show();
            return;
        }
        const sid = await vscode.window.showInputBox({
            title: "Cursor Remote: 릴레이 세션 ID",
            prompt: "모바일에서 연결할 세션 ID 6자 입력 (같은 ID를 모바일에서 입력하면 연결됩니다)",
            placeHolder: "3ZUESK",
            value: context.globalState.get("cursorRemote.sessionId") ?? "",
            validateInput: (value) => {
                const v = (value ?? "").trim().toUpperCase();
                if (!v)
                    return "세션 ID를 입력하세요.";
                if (!/^[A-Z0-9]{6}$/.test(v))
                    return "6자 영숫자 (예: 3ZUESK)";
                return null;
            },
        });
        if (!sid)
            return;
        const sidTrimmed = sid.trim().toUpperCase();
        await context.globalState.update("cursorRemote.sessionId", sidTrimmed);
        const pin = await vscode.window.showInputBox({
            title: "Cursor Remote: PIN (선택)",
            prompt: "4~6자리 PIN을 설정하면 모바일에서 이 PIN을 알아야만 접속할 수 있습니다. (공백으로 두면 PIN 없음)",
            placeHolder: "1234",
            password: true,
            validateInput: (v) => {
                const t = (v ?? "").trim();
                if (!t)
                    return null;
                if (!/^\d{4,6}$/.test(t))
                    return "4~6자리 숫자";
                return null;
            },
        });
        const pinToUse = pin != null && pin.trim() ? pin.trim() : undefined;
        try {
            await relayClient.start(sidTrimmed, pinToUse);
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Relay 연결됨 - 세션: ${sidTrimmed}${pinToUse ? " (PIN 설정됨)" : ""}`);
            outputChannel.show();
            if (statusBarManager)
                statusBarManager.refresh();
            updateConnectionsView();
            vscode.window.showInformationMessage(`Cursor Remote: 세션 ${sidTrimmed}에 연결되었습니다.`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ 릴레이 연결 실패: ${errorMsg}`);
            outputChannel.show();
            vscode.window.showErrorMessage(`Cursor Remote: 릴레이 연결 실패 - ${errorMsg}`);
        }
    });
    context.subscriptions.push(startCommand, stopCommand, toggleCommand, checkRelayServerCommand, connectToRelaySessionByIdCommand, setRelaySessionIdCommand, showConnectionsCommand, statusBarClickCommand);
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
    // 릴레이 모드일 때 챗 히스토리 저장 시 relaySessionId 포함하도록 getter 설정
    if (commandHandler) {
        commandHandler.setGetRelaySessionId(() => relayClient?.getSessionId() ?? null);
    }
    // Status bar: reflect relay connection (클라이언트 접속 시 "Connected" 표시)
    if (statusBarManager && relayClient) {
        statusBarManager.setRelayClient(relayClient);
        relayClient.setOnSessionConnected(() => {
            if (statusBarManager)
                statusBarManager.refresh();
            updateConnectionsView(); // 연결 정보 패널이 열려 있으면 즉시 갱신
            const sessionId = relayClient?.getSessionId();
            if (sessionId) {
                context.globalState.update("cursorRemote.sessionId", sessionId);
            }
            vscode.window.showInformationMessage(sessionId != null
                ? `Cursor Remote: 익스텐션은 릴레이 서버를 통해 세션 ${sessionId}에 접속했습니다.`
                : "Cursor Remote: 익스텐션은 릴레이 서버에 연결되었습니다.");
        });
        // 복수 세션 발견 시 사용자가 선택할 수 있도록 QuickPick 표시
        relayClient.setOnSessionsDiscovered(async (sessions) => {
            const picked = await vscode.window.showQuickPick(sessions.map((s) => ({
                label: s.sessionId,
                description: "세션 ID",
            })), {
                title: "Cursor Remote: 연결할 릴레이 세션 선택",
                placeHolder: "대기 중인 세션이 여러 개입니다. 모바일에서 연결한 세션을 선택하세요.",
            });
            return picked?.label ?? null;
        });
    }
    // 상태바 즉시 표시 (서버/릴레이 시작 전에 한 번 그려서 늦게 뜨는 현상 완화)
    if (statusBarManager) {
        statusBarManager.refresh();
        statusBarManager.show();
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
    // Auto start WebSocket server only (릴레이는 상태줄 클릭 시 세션 ID·PIN 입력 후 연결)
    wsServer
        .start()
        .then(async () => {
        if (statusBarManager) {
            statusBarManager.update(false); // Client not connected yet
        }
        updateConnectionsView();
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] [Relay] 릴레이 비활성. 상태줄 'Cursor Remote' 클릭 → 세션 ID·PIN 입력하여 연결`);
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