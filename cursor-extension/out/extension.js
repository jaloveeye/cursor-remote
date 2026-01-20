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
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const websocket_server_1 = require("./websocket-server");
const command_handler_1 = require("./command-handler");
let wsServer = null;
let commandHandler = null;
let statusBarItem;
let outputChannel;
let terminalOutputListener = null;
let terminalOutputFile = null;
let lastTerminalOutputSize = 0;
// 터미널별 출력 리스너 관리
const terminalDataListeners = new Map();
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
    // 터미널 출력 모니터링 비활성화 (prompt 사용으로 전환)
    // startTerminalOutputMonitoring(context);
    // 터미널 출력 파일 모니터링 비활성화 (prompt 사용으로 전환)
    // startTerminalOutputFileMonitoring(context);
    // HTTP 서버 시작 (hook에서 Gemini 응답을 받기 위해)
    startHttpServerForHooks();
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
let httpServer = null;
function deactivate() {
    if (terminalOutputFile) {
        fs.unwatchFile(terminalOutputFile);
        terminalOutputFile = null;
    }
    if (httpServer) {
        httpServer.close();
        httpServer = null;
    }
    if (terminalOutputListener) {
        terminalOutputListener.dispose();
        terminalOutputListener = null;
    }
    // 모든 터미널 출력 리스너 정리
    terminalDataListeners.forEach((listener) => {
        listener.dispose();
    });
    terminalDataListeners.clear();
    if (wsServer) {
        wsServer.stop();
    }
    if (commandHandler) {
        commandHandler.dispose();
    }
}
// 터미널 출력 파일 모니터링 시작
function startTerminalOutputFileMonitoring(context) {
    // 워크스페이스 루트 경로 가져오기
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        outputChannel.appendLine('[Terminal Output] No workspace folder found');
        return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const outputFile = path.join(workspaceRoot, '.cursor-remote-terminal-output.log');
    outputChannel.appendLine(`[Terminal Output] Monitoring file: ${outputFile}`);
    // 파일이 없으면 생성
    if (!fs.existsSync(outputFile)) {
        fs.writeFileSync(outputFile, '');
    }
    // 파일 크기 초기화
    try {
        const stats = fs.statSync(outputFile);
        lastTerminalOutputSize = stats.size;
    }
    catch (error) {
        lastTerminalOutputSize = 0;
    }
    // 파일 변경 감지
    terminalOutputFile = outputFile;
    fs.watchFile(outputFile, { interval: 500 }, (curr, prev) => {
        if (curr.size > lastTerminalOutputSize) {
            // 새 내용이 추가됨
            try {
                const fileContent = fs.readFileSync(outputFile, 'utf8');
                const newContent = fileContent.substring(lastTerminalOutputSize);
                if (newContent.trim().length > 0) {
                    outputChannel.appendLine(`[Terminal Output] New content detected (${newContent.length} bytes)`);
                    // WebSocket으로 클라이언트에 전송
                    if (wsServer) {
                        wsServer.sendFromHook({
                            type: 'terminal_output',
                            text: newContent,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                lastTerminalOutputSize = curr.size;
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                outputChannel.appendLine(`[Terminal Output] Error reading file: ${errorMsg}`);
            }
        }
    });
    // 파일 모니터링은 백업 방식으로 유지 (자동 캡처가 작동하지 않는 경우를 대비)
    outputChannel.appendLine(`[Terminal Output] File monitoring enabled as backup: ${outputFile}`);
}
// Hook에서 Gemini 응답을 받기 위한 HTTP 서버
function startHttpServerForHooks() {
    if (httpServer) {
        return;
    }
    httpServer = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/hook') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Received from hook: ${data.type || 'unknown'}`);
                    // WebSocket으로 클라이언트에 전송
                    if (wsServer) {
                        wsServer.sendFromHook(data);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Error processing hook data: ${errorMsg}`);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: errorMsg }));
                }
            });
        }
        else {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    httpServer.listen(8768, 'localhost', () => {
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] HTTP server for hooks started on port 8768`);
    });
    httpServer.on('error', (error) => {
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] HTTP server error: ${error.message}`);
    });
}
// 터미널 출력 모니터링 시작
function startTerminalOutputMonitoring(context) {
    // 기존 리스너가 있으면 제거
    if (terminalOutputListener) {
        terminalOutputListener.dispose();
    }
    // 터미널 활성화 변경 이벤트 모니터링
    terminalOutputListener = vscode.window.onDidChangeActiveTerminal((terminal) => {
        if (terminal) {
            setupTerminalOutputListener(terminal);
        }
    });
    context.subscriptions.push(terminalOutputListener);
    // 터미널 생성 이벤트 모니터링 (새 터미널이 생성될 때)
    const terminalCreateListener = vscode.window.onDidOpenTerminal((terminal) => {
        if (terminal) {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] New terminal created: ${terminal.name}`);
            setupTerminalOutputListener(terminal);
        }
    });
    context.subscriptions.push(terminalCreateListener);
    // 현재 활성 터미널이 있으면 모니터링 시작
    const activeTerminal = vscode.window.activeTerminal;
    if (activeTerminal) {
        setupTerminalOutputListener(activeTerminal);
    }
    // 모든 기존 터미널에 대해 모니터링 시작
    vscode.window.terminals.forEach((terminal) => {
        setupTerminalOutputListener(terminal);
    });
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const outputFile = workspaceFolders && workspaceFolders.length > 0
        ? path.join(workspaceFolders[0].uri.fsPath, '.cursor-remote-terminal-output.log')
        : 'N/A';
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Terminal output auto-capture enabled`);
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 💡 Commands sent via Extension will automatically capture output`);
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 💡 Output is captured to: ${outputFile}`);
}
// 터미널 출력 리스너 설정
function setupTerminalOutputListener(terminal) {
    // 이미 리스너가 설정된 터미널이면 스킵
    if (terminalDataListeners.has(terminal)) {
        return;
    }
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Terminal registered for auto-capture: ${terminal.name}`);
    // VS Code의 안정적인 API로는 터미널 출력을 직접 캡처할 수 없으므로,
    // insertToTerminal에서 명령을 보낼 때 자동으로 출력을 캡처하도록 처리
    // 터미널이 생성되거나 활성화될 때 등록만 하고, 실제 캡처는 insertToTerminal에서 처리
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
                        // Gemini CLI 모드인지 확인 (기본적으로 활성화)
                        // 일반 터미널에도 전송하되, Gemini CLI 프로세스에도 전송 시도
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