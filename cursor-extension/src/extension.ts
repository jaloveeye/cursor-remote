import * as vscode from 'vscode';
import { WebSocketServer } from './websocket-server';
import { CommandHandler } from './command-handler';

let wsServer: WebSocketServer | null = null;
let commandHandler: CommandHandler | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('Cursor Remote extension is now active!');

    // WebSocket 서버 초기화
    wsServer = new WebSocketServer(8766);
    commandHandler = new CommandHandler();

    // WebSocket 메시지 핸들러
    wsServer.onMessage((message: string) => {
        try {
            const command = JSON.parse(message);
            handleCommand(command);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    // 명령 등록
    const startCommand = vscode.commands.registerCommand('cursorRemote.start', () => {
        if (wsServer && !wsServer.isRunning()) {
            wsServer.start();
            vscode.window.showInformationMessage('Cursor Remote server started on port 8766');
        } else {
            vscode.window.showInformationMessage('Cursor Remote server is already running');
        }
    });

    const stopCommand = vscode.commands.registerCommand('cursorRemote.stop', () => {
        if (wsServer && wsServer.isRunning()) {
            wsServer.stop();
            vscode.window.showInformationMessage('Cursor Remote server stopped');
        } else {
            vscode.window.showInformationMessage('Cursor Remote server is not running');
        }
    });

    context.subscriptions.push(startCommand, stopCommand);

    // 자동 시작 (옵션)
    wsServer.start();
}

export function deactivate() {
    if (wsServer) {
        wsServer.stop();
    }
    if (commandHandler) {
        commandHandler.dispose();
    }
}

async function handleCommand(command: any) {
    if (!commandHandler) {
        return;
    }

    try {
        switch (command.type) {
            case 'insert_text':
                await commandHandler.insertText(command.text);
                break;
            case 'execute_command':
                await commandHandler.executeCommand(command.command, command.args);
                break;
            case 'get_ai_response':
                const response = await commandHandler.getAIResponse();
                if (wsServer) {
                    wsServer.send(JSON.stringify({ type: 'ai_response', data: response }));
                }
                break;
            default:
                console.warn('Unknown command type:', command.type);
        }
    } catch (error) {
        console.error('Error handling command:', error);
        if (wsServer) {
            wsServer.send(JSON.stringify({ 
                type: 'error', 
                message: error instanceof Error ? error.message : 'Unknown error' 
            }));
        }
    }
}
