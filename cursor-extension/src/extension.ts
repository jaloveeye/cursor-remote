import * as vscode from 'vscode';
import { WebSocketServer } from './websocket-server';
import { CommandHandler } from './command-handler';

let wsServer: WebSocketServer | null = null;
let commandHandler: CommandHandler | null = null;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('Cursor Remote extension is now active!');

    // 상태 표시줄 아이템 생성
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'cursorRemote.toggle';
    statusBarItem.tooltip = 'Toggle Cursor Remote Server';
    context.subscriptions.push(statusBarItem);

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

    // 클라이언트 연결/해제 이벤트 처리
    wsServer.onClientChange((connected: boolean) => {
        updateStatusBar(connected);
    });

    // 명령 등록
    const startCommand = vscode.commands.registerCommand('cursorRemote.start', () => {
        if (wsServer && !wsServer.isRunning()) {
            wsServer.start();
            updateStatusBar(false);
            vscode.window.showInformationMessage('Cursor Remote server started on port 8766');
        } else {
            vscode.window.showInformationMessage('Cursor Remote server is already running');
        }
    });

    const stopCommand = vscode.commands.registerCommand('cursorRemote.stop', () => {
        if (wsServer && wsServer.isRunning()) {
            wsServer.stop();
            updateStatusBar(false);
            vscode.window.showInformationMessage('Cursor Remote server stopped');
        } else {
            vscode.window.showInformationMessage('Cursor Remote server is not running');
        }
    });

    const toggleCommand = vscode.commands.registerCommand('cursorRemote.toggle', () => {
        if (wsServer) {
            if (wsServer.isRunning()) {
                wsServer.stop();
                updateStatusBar(false);
            } else {
                wsServer.start();
                updateStatusBar(false);
            }
        }
    });

    context.subscriptions.push(startCommand, stopCommand, toggleCommand);

    // 자동 시작
    wsServer.start();
    updateStatusBar(false);
    statusBarItem.show();
}

function updateStatusBar(connected: boolean) {
    if (!statusBarItem) return;
    
    if (wsServer && wsServer.isRunning()) {
        if (connected) {
            statusBarItem.text = '$(cloud) Cursor Remote: Connected';
            statusBarItem.backgroundColor = undefined;
        } else {
            statusBarItem.text = '$(cloud) Cursor Remote: Waiting';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    } else {
        statusBarItem.text = '$(cloud-off) Cursor Remote: Stopped';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
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
    if (!commandHandler || !wsServer) {
        return;
    }

    const commandId = command.id || Date.now().toString();

    try {
        let result: any = null;

        switch (command.type) {
            case 'insert_text':
                try {
                    // prompt 옵션이 있으면 프롬프트 입력창에, 없으면 에디터에 삽입
                    if (command.prompt === true) {
                        await commandHandler.insertToPrompt(command.text);
                        result = { success: true, message: 'Text inserted to prompt' };
                    } else {
                        await commandHandler.insertText(command.text);
                        result = { success: true, message: 'Text inserted' };
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    result = { success: false, error: errorMsg };
                    // 에러를 다시 throw하지 않고 result에 포함
                }
                break;
            case 'execute_command':
                result = await commandHandler.executeCommand(command.command, ...(command.args || []));
                result = { success: true, result: result };
                break;
            case 'get_ai_response':
                const response = await commandHandler.getAIResponse();
                result = { success: true, data: response };
                break;
            case 'get_active_file':
                result = await commandHandler.getActiveFile();
                break;
            case 'save_file':
                result = await commandHandler.saveFile();
                break;
            default:
                console.warn('Unknown command type:', command.type);
                wsServer.send(JSON.stringify({ 
                    id: commandId,
                    type: 'command_result', 
                    success: false,
                    error: `Unknown command type: ${command.type}`
                }));
                return;
        }

        // 성공 응답 전송
        wsServer.send(JSON.stringify({ 
            id: commandId,
            type: 'command_result', 
            success: true,
            ...result
        }));

    } catch (error) {
        console.error('Error handling command:', error);
        wsServer.send(JSON.stringify({ 
            id: commandId,
            type: 'command_result', 
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error' 
        }));
    }
}
