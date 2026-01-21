/**
 * Type definitions for Cursor Remote Extension
 */

import * as vscode from 'vscode';
import { CommandHandler } from './command-handler';
import { WebSocketServer } from './websocket-server';

export interface CommandMessage {
    id?: string;
    type: string;
    text?: string;
    terminal?: boolean | string;
    prompt?: boolean | string;
    execute?: boolean;
    command?: string;
    args?: any[];
    action?: string;
}

export interface CommandResult {
    success: boolean;
    command_type?: string;
    message?: string;
    result?: any;
    error?: string;
    path?: string;
    data?: any;
}

export interface ChatResponseMessage {
    type: 'chat_response';
    text: string;
    timestamp: string;
    source?: 'ide' | 'cli' | 'hook';
}

export interface TerminalOutputMessage {
    type: 'terminal_output';
    text: string;
    timestamp: string;
}

export interface UserMessage {
    type: 'user_message';
    text: string;
    timestamp: string;
}

export type WebSocketMessage = ChatResponseMessage | TerminalOutputMessage | UserMessage | CommandResult;

export interface ExtensionContext {
    outputChannel: vscode.OutputChannel;
    wsServer: WebSocketServer;
    commandHandler: CommandHandler;
    statusBarItem: vscode.StatusBarItem;
}

export interface ChatDocumentMonitor {
    interval: NodeJS.Timeout | null;
    lastContent: string;
    currentUri: vscode.Uri | null;
    isProcessing: boolean;
    lastProcessedHash: string;
    debounceTimer: NodeJS.Timeout | null;
}
