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
let wsServer = null;
let commandHandler = null;
let statusBarItem;
let outputChannel;
let terminalOutputListener = null;
function activate(context) {
    // Output 채널 생성
    outputChannel = vscode.window.createOutputChannel('Cursor Remote');
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine('Cursor Remote extension is now active!');
    console.log('Cursor Remote extension is now active!');
    // 상태 표시줄 아이템 생성
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'cursorRemote.toggle';
    statusBarItem.tooltip = 'Toggle Cursor Remote Server';
    context.subscriptions.push(statusBarItem);
    // WebSocket 서버 초기화
    wsServer = new websocket_server_1.WebSocketServer(8766, outputChannel);
    commandHandler = new command_handler_1.CommandHandler(outputChannel, wsServer);
    // 터미널 출력 모니터링 시작
    startTerminalOutputMonitoring();
    // WebSocket 메시지 핸들러
    wsServer.onMessage((message) => {
        try {
            const command = JSON.parse(message);
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Received command: ${command.type}`);
            handleCommand(command);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Error parsing message: ${errorMsg}`);
            console.error('Error parsing message:', error);
        }
    });
    // 클라이언트 연결/해제 이벤트 처리
    wsServer.onClientChange((connected) => {
        updateStatusBar(connected);
    });
    // 명령 등록
    const startCommand = vscode.commands.registerCommand('cursorRemote.start', () => {
        if (wsServer && !wsServer.isRunning()) {
            wsServer.start();
            updateStatusBar(false);
            vscode.window.showInformationMessage('Cursor Remote server started on port 8766');
        }
        else {
            vscode.window.showInformationMessage('Cursor Remote server is already running');
        }
    });
    const stopCommand = vscode.commands.registerCommand('cursorRemote.stop', () => {
        if (wsServer && wsServer.isRunning()) {
            wsServer.stop();
            updateStatusBar(false);
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
                updateStatusBar(false);
            }
            else {
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
function updateStatusBar(connected) {
    if (!statusBarItem)
        return;
    if (wsServer && wsServer.isRunning()) {
        if (connected) {
            statusBarItem.text = '$(cloud) Cursor Remote: Connected';
            statusBarItem.backgroundColor = undefined;
        }
        else {
            statusBarItem.text = '$(cloud) Cursor Remote: Waiting';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }
    else {
        statusBarItem.text = '$(cloud-off) Cursor Remote: Stopped';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
}
function deactivate() {
    if (terminalOutputListener) {
        terminalOutputListener.dispose();
        terminalOutputListener = null;
    }
    if (wsServer) {
        wsServer.stop();
    }
    if (commandHandler) {
        commandHandler.dispose();
    }
}
// 터미널 출력 모니터링 시작
function startTerminalOutputMonitoring() {
    // 기존 리스너가 있으면 제거
    if (terminalOutputListener) {
        terminalOutputListener.dispose();
    }
    // 터미널 생성 이벤트 모니터링
    terminalOutputListener = vscode.window.onDidChangeActiveTerminal((terminal) => {
        if (terminal) {
            setupTerminalOutputListener(terminal);
        }
    });
    // 현재 활성 터미널이 있으면 모니터링 시작
    const activeTerminal = vscode.window.activeTerminal;
    if (activeTerminal) {
        setupTerminalOutputListener(activeTerminal);
    }
}
// 터미널 출력 리스너 설정
function setupTerminalOutputListener(terminal) {
    // 터미널의 출력을 모니터링하여 모바일 앱으로 전송
    // 주의: VS Code API로는 터미널의 출력을 직접 읽을 수 없음
    // 대신 터미널이 활성화될 때마다 모니터링을 시도
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Monitoring terminal: ${terminal.name}`);
    // 터미널 프로세스 ID를 통해 출력을 읽을 수 없으므로,
    // 사용자가 터미널에서 명령을 실행할 때 출력을 확인하는 다른 방법이 필요
    // 현재는 터미널에 텍스트를 입력하는 기능만 제공
}
async function handleCommand(command) {
    if (!commandHandler || !wsServer) {
        return;
    }
    const commandId = command.id || Date.now().toString();
    try {
        let result = null;
        switch (command.type) {
            case 'insert_text':
                try {
                    // 디버깅: 명령 파라미터 확인
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] insert_text command - terminal: ${command.terminal} (type: ${typeof command.terminal}), prompt: ${command.prompt}, text length: ${command.text?.length || 0}`);
                    // terminal 옵션이 있으면 터미널에, prompt 옵션이 있으면 프롬프트 입력창에, 없으면 에디터에 삽입
                    // JSON 파싱 시 boolean이 문자열로 올 수 있으므로 안전하게 체크
                    const isTerminal = command.terminal === true || command.terminal === 'true';
                    const isPrompt = command.prompt === true || command.prompt === 'true';
                    if (isTerminal) {
                        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Routing to terminal`);
                        const execute = command.execute === true; // execute 옵션 확인
                        await commandHandler.insertToTerminal(command.text, execute);
                        result = { success: true, message: execute ? 'Text sent to terminal and executed' : 'Text sent to terminal' };
                    }
                    else if (isPrompt) {
                        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Routing to prompt`);
                        const execute = command.execute === true; // execute 옵션 확인
                        await commandHandler.insertToPrompt(command.text, execute);
                        result = { success: true, message: execute ? 'Text inserted to prompt and executed' : 'Text inserted to prompt' };
                    }
                    else {
                        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Routing to editor (fallback)`);
                        await commandHandler.insertText(command.text);
                        result = { success: true, message: 'Text inserted' };
                    }
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Error in insert_text: ${errorMsg}`);
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
            case 'stop_prompt':
                result = await commandHandler.stopPrompt();
                break;
            case 'execute_action':
                result = await commandHandler.executeAction(command.action);
                break;
            default:
                const errorMsg = `Unknown command type: ${command.type}`;
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${errorMsg}`);
                console.warn('Unknown command type:', command.type);
                wsServer.send(JSON.stringify({
                    id: commandId,
                    type: 'command_result',
                    success: false,
                    error: errorMsg
                }));
                return;
        }
        // 성공 응답 전송
        const successMsg = `Command ${command.type} executed successfully`;
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${successMsg}`);
        wsServer.send(JSON.stringify({
            id: commandId,
            type: 'command_result',
            success: true,
            ...result
        }));
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Error handling command: ${errorMsg}`);
        console.error('Error handling command:', error);
        wsServer.send(JSON.stringify({
            id: commandId,
            type: 'command_result',
            success: false,
            error: errorMsg
        }));
    }
}
//# sourceMappingURL=extension.js.map