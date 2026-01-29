/**
 * Status bar management for Cursor Remote extension
 */

import * as vscode from 'vscode';
import { WebSocketServer } from './websocket-server';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private wsServer: WebSocketServer | null = null;
    private relayClient: { isConnectedToSession: () => boolean } | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'cursorRemote.toggle';
        this.statusBarItem.tooltip = 'Toggle Cursor Remote (Extension WebSocket server)';
        context.subscriptions.push(this.statusBarItem);
    }

    /**
     * Set WebSocket server reference
     */
    setWebSocketServer(wsServer: WebSocketServer) {
        this.wsServer = wsServer;
    }

    /**
     * Set relay client reference (for status when connected via relay)
     */
    setRelayClient(relayClient: { isConnectedToSession: () => boolean } | null) {
        this.relayClient = relayClient;
    }

    /**
     * Refresh status bar from current state (local WebSocket + relay)
     */
    refresh() {
        if (!this.statusBarItem) return;

        const hasLocalClient = this.wsServer ? this.wsServer.getClientCount() > 0 : false;
        const hasRelaySession = this.relayClient ? this.relayClient.isConnectedToSession() : false;
        const connected = hasLocalClient || hasRelaySession;

        if (this.wsServer && this.wsServer.isRunning()) {
            if (connected) {
                this.statusBarItem.text = '$(cloud) Cursor Remote: Connected';
                this.statusBarItem.backgroundColor = undefined;
            } else {
                this.statusBarItem.text = '$(cloud) Cursor Remote: Ready (waiting for client)';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            }
        } else {
            this.statusBarItem.text = '$(cloud-off) Cursor Remote: Stopped';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }

    /**
     * Update status bar (called when WebSocket client connects/disconnects)
     */
    update(connected: boolean) {
        this.refresh();
    }

    /**
     * Show status bar
     */
    show() {
        this.statusBarItem.show();
    }
}
