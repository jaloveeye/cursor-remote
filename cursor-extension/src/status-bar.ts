/**
 * Status bar management for Cursor Remote extension
 */

import * as vscode from 'vscode';
import { WebSocketServer } from './websocket-server';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private wsServer: WebSocketServer | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'cursorRemote.toggle';
        this.statusBarItem.tooltip = 'Toggle Cursor Remote Server';
        context.subscriptions.push(this.statusBarItem);
    }

    /**
     * Set WebSocket server reference
     */
    setWebSocketServer(wsServer: WebSocketServer) {
        this.wsServer = wsServer;
    }

    /**
     * Update status bar based on connection state
     */
    update(connected: boolean) {
        if (!this.statusBarItem) return;

        if (this.wsServer && this.wsServer.isRunning()) {
            if (connected) {
                this.statusBarItem.text = '$(cloud) Cursor Remote: Connected';
                this.statusBarItem.backgroundColor = undefined;
            } else {
                this.statusBarItem.text = '$(cloud) Cursor Remote: Waiting';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            }
        } else {
            this.statusBarItem.text = '$(cloud-off) Cursor Remote: Stopped';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }

    /**
     * Show status bar
     */
    show() {
        this.statusBarItem.show();
    }
}
