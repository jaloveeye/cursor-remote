/**
 * Type definitions for Cursor Remote Extension
 */

import * as vscode from 'vscode';
import { CommandHandler } from './command-handler';
import { WebSocketServer } from './websocket-server';

// Cursor Agent 모드 타입
export type AgentMode = 'agent' | 'ask' | 'plan' | 'debug' | 'auto';

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
    clientId?: string; // 클라이언트 식별자 (세션 격리용)
    newSession?: boolean; // 새 세션 시작 여부 (클라이언트에서 결정)
    sessionId?: string; // 세션 ID (대화 히스토리 조회용)
    limit?: number; // 조회 제한 (대화 히스토리 조회용)
    agentMode?: AgentMode; // 에이전트 모드 (agent, ask, plan, debug, auto)
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
    sessionId?: string; // 현재 세션 ID (클라이언트가 추적 가능)
    clientId?: string; // 클라이언트 ID (어떤 클라이언트의 세션인지)
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
