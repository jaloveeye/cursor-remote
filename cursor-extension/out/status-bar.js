"use strict";
/**
 * Status bar management for Cursor Remote extension
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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarManager {
    constructor(context) {
        this.wsServer = null;
        this.relayClient = null;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = "cursorRemote.statusBarClick";
        this.statusBarItem.tooltip =
            "Cursor Remote: 클릭 시 릴레이 연결(세션 ID·PIN) 또는 연결 정보 보기";
        context.subscriptions.push(this.statusBarItem);
    }
    /**
     * Set WebSocket server reference
     */
    setWebSocketServer(wsServer) {
        this.wsServer = wsServer;
    }
    /**
     * Set relay client reference (for status when connected via relay)
     */
    setRelayClient(relayClient) {
        this.relayClient = relayClient;
    }
    /**
     * Refresh status bar from current state (local WebSocket + relay)
     */
    refresh() {
        if (!this.statusBarItem)
            return;
        const hasLocalClient = this.wsServer
            ? this.wsServer.getClientCount() > 0
            : false;
        const hasRelaySession = this.relayClient
            ? this.relayClient.isConnectedToSession()
            : false;
        const connected = hasLocalClient || hasRelaySession;
        if (this.wsServer && this.wsServer.isRunning()) {
            if (connected) {
                if (hasRelaySession && this.relayClient) {
                    const sessionId = this.relayClient.getSessionId();
                    this.statusBarItem.text =
                        sessionId != null
                            ? `$(cloud) Cursor Remote: Connected (세션: ${sessionId})`
                            : "$(cloud) Cursor Remote: Connected";
                    this.statusBarItem.tooltip =
                        (sessionId != null
                            ? `Cursor Remote: 릴레이 세션 ${sessionId}`
                            : "Cursor Remote: 릴레이 세션에 연결됨") +
                            " · 클릭: 연결 정보 보기";
                }
                else {
                    this.statusBarItem.text = "$(cloud) Cursor Remote: Connected";
                    this.statusBarItem.tooltip =
                        "Cursor Remote: 클라이언트 연결됨 · 클릭: 연결 정보 보기";
                }
                this.statusBarItem.backgroundColor = undefined;
            }
            else if (!hasRelaySession) {
                this.statusBarItem.text = "$(cloud) Cursor Remote: 비활성";
                this.statusBarItem.tooltip =
                    "Cursor Remote: 릴레이 끔 · 클릭: 세션 ID·PIN 입력하여 연결";
                this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
            }
            else {
                this.statusBarItem.text =
                    "$(cloud) Cursor Remote: Ready (waiting for client)";
                this.statusBarItem.tooltip =
                    "Cursor Remote: 클라이언트 대기 중 · 클릭: 연결 정보 보기";
                this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
            }
        }
        else {
            this.statusBarItem.text = "$(cloud-off) Cursor Remote: Stopped";
            this.statusBarItem.tooltip =
                "Cursor Remote: 서버 중지됨 · 클릭: 연결 정보 보기";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        }
        this.statusBarItem.show();
    }
    /**
     * Update status bar (called when WebSocket client connects/disconnects)
     */
    update(connected) {
        this.refresh();
    }
    /**
     * Show status bar
     */
    show() {
        this.statusBarItem.show();
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=status-bar.js.map