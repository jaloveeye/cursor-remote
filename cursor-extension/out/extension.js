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
const net = __importStar(require("net"));
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
// Rules 기반 캡처는 hooks.json을 통해 자동으로 작동
async function activate(context) {
    // Output 채널 생성
    outputChannel = vscode.window.createOutputChannel('Cursor Remote');
    context.subscriptions.push(outputChannel);
    // Output 채널 자동 표시 (디버깅용)
    outputChannel.show(true);
    outputChannel.appendLine('Cursor Remote extension is now active!');
    console.log('Cursor Remote extension is now active!');
    // 상태 표시줄 아이템 생성
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'cursorRemote.toggle';
    statusBarItem.tooltip = 'Toggle Cursor Remote Server';
    context.subscriptions.push(statusBarItem);
    // WebSocket 서버 초기화
    wsServer = new websocket_server_1.WebSocketServer(8766, outputChannel);
    // CLI 모드 설정 확인 (기본값: false, IDE 모드)
    const config = vscode.workspace.getConfiguration('cursorRemote');
    const useCLIMode = config.get('useCLIMode', false);
    commandHandler = new command_handler_1.CommandHandler(outputChannel, wsServer, useCLIMode);
    if (useCLIMode) {
        outputChannel.appendLine('[Cursor Remote] CLI mode is enabled - using Cursor CLI instead of IDE');
    }
    else {
        outputChannel.appendLine('[Cursor Remote] IDE mode is enabled - using Cursor IDE extension');
    }
    // 터미널 출력 모니터링 비활성화 (prompt 사용으로 전환)
    // startTerminalOutputMonitoring(context);
    // 터미널 출력 파일 모니터링 비활성화 (prompt 사용으로 전환)
    // startTerminalOutputFileMonitoring(context);
    // Rules 기반 채팅 캡처 설정
    setupRulesBasedChatCapture(context);
    // HTTP 서버 시작 (hook에서 채팅 응답을 받기 위해)
    startHttpServerForHooks().catch((error) => {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start HTTP server: ${errorMsg}`);
        vscode.window.showErrorMessage(`Cursor Remote: HTTP 서버 시작 실패 - ${errorMsg}`);
    });
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
        if (connected) {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Client connected - Rules-based chat capture is active`);
        }
        else {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Client disconnected`);
        }
    });
    // 명령 등록
    const startCommand = vscode.commands.registerCommand('cursorRemote.start', () => {
        if (wsServer && !wsServer.isRunning()) {
            wsServer.start().then(() => {
                updateStatusBar(false);
                vscode.window.showInformationMessage('Cursor Remote server started on port 8766');
            }).catch((error) => {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start WebSocket server: ${errorMsg}`);
                vscode.window.showErrorMessage(`Cursor Remote: 서버 시작 실패 - ${errorMsg}`);
                updateStatusBar(false);
            });
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
                wsServer.start().then(() => {
                    updateStatusBar(false);
                }).catch((error) => {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start WebSocket server: ${errorMsg}`);
                    vscode.window.showErrorMessage(`Cursor Remote: 서버 시작 실패 - ${errorMsg}`);
                    updateStatusBar(false);
                });
            }
        }
    });
    context.subscriptions.push(startCommand, stopCommand, toggleCommand);
    // 자동 시작
    wsServer.start().then(() => {
        // WebSocket 서버가 성공적으로 시작된 후 상태 업데이트
        updateStatusBar(false); // 클라이언트는 아직 연결되지 않았으므로 false
    }).catch((error) => {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Failed to start WebSocket server: ${errorMsg}`);
        vscode.window.showErrorMessage(`Cursor Remote: 서버 시작 실패 - ${errorMsg}`);
        updateStatusBar(false); // 실패 시에도 상태 업데이트
    });
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
let httpServerPort = null;
function deactivate() {
    if (terminalOutputFile) {
        fs.unwatchFile(terminalOutputFile);
        terminalOutputFile = null;
    }
    if (httpServer) {
        httpServer.close();
        httpServer = null;
        httpServerPort = null;
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
    // 채팅 문서 모니터링 정리
    if (chatDocumentMonitorInterval) {
        clearInterval(chatDocumentMonitorInterval);
        chatDocumentMonitorInterval = null;
    }
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
// 채팅 문서 모니터링 방식으로 전환 (Rules 파일이 작동하지 않으므로)
function setupRulesBasedChatCapture(context) {
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Setting up chat document monitoring...`);
    outputChannel.show(true); // Output 채널 표시
    // Rules 파일도 생성/확인 (AI가 파일을 생성하도록 시도)
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        ensureRulesFile(workspaceRoot);
        // CHAT_SUMMARY 파일 감시 시작 (Rules 기반 캡처)
        startChatFileWatcher(context, workspaceRoot);
    }
    else {
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ No workspace folder found, skipping rules file creation`);
    }
    // 채팅 문서 모니터링 시작 (Rules가 작동하지 않을 경우를 대비한 백업)
    startChatDocumentMonitoring(context);
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Chat document monitoring setup complete`);
}
// 채팅 문서 직접 모니터링 (Rules 파일 대신)
let chatDocumentMonitorInterval = null;
let lastChatContent = '';
let currentChatUri = null;
let isProcessingChatContent = false;
let lastProcessedContentHash = '';
let processDebounceTimer = null;
function startChatDocumentMonitoring(context) {
    // 모든 열린 문서 모니터링 (디버깅용)
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 🔍 Checking all open documents...`);
    vscode.workspace.textDocuments.forEach((doc) => {
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 📄 Document: ${doc.uri.scheme}://${doc.uri.toString()}`);
    });
    // 활성 에디터 변경 감지
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            const uri = editor.document.uri;
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 🔄 Active editor changed: ${uri.scheme}://${uri.toString()}`);
            // 채팅 문서인지 확인 (더 넓은 범위로)
            const isChatDocument = uri.scheme === 'vscode' ||
                uri.scheme === 'cursor' ||
                uri.scheme === 'output' ||
                uri.fsPath.includes('chat') ||
                uri.toString().includes('chat') ||
                uri.toString().includes('Chat') ||
                editor.document.languageId === 'markdown' ||
                editor.document.fileName.includes('chat');
            if (isChatDocument) {
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 📝 Chat document detected: ${uri.toString()}`);
                currentChatUri = uri;
                lastChatContent = editor.document.getText();
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 📊 Initial content length: ${lastChatContent.length} bytes`);
                // 모니터링 시작
                if (!chatDocumentMonitorInterval) {
                    startPollingChatDocument();
                }
            }
            else {
                // 모든 문서를 모니터링하도록 변경 (디버깅)
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 📝 Monitoring any document: ${uri.toString()}`);
                currentChatUri = uri;
                lastChatContent = editor.document.getText();
                if (!chatDocumentMonitorInterval) {
                    startPollingChatDocument();
                }
            }
        }
    });
    context.subscriptions.push(editorChangeListener);
    // 초기 활성 에디터 확인
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const uri = activeEditor.document.uri;
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 📄 Initial active editor: ${uri.scheme}://${uri.toString()}`);
        currentChatUri = uri;
        lastChatContent = activeEditor.document.getText();
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 📊 Initial content: ${lastChatContent.length} bytes`);
        startPollingChatDocument();
    }
    else {
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ No active editor found`);
    }
    // 문서 변경 감지 (모든 문서)
    const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        const uri = event.document.uri;
        // output 채널의 변경은 무시 (무한 루프 방지)
        if (uri.scheme === 'output') {
            return;
        }
        // 처리 중이면 무시
        if (isProcessingChatContent) {
            return;
        }
        if (currentChatUri && event.document.uri.toString() === currentChatUri.toString()) {
            const newContent = event.document.getText();
            // 중복 처리 방지: 같은 내용이면 무시
            const contentHash = newContent.substring(Math.max(0, newContent.length - 1000));
            if (contentHash === lastProcessedContentHash && newContent.length === lastChatContent.length) {
                return;
            }
            if (newContent.length > lastChatContent.length) {
                // 디바운싱: 짧은 시간 내 여러 변경이 있으면 마지막 것만 처리
                if (processDebounceTimer) {
                    clearTimeout(processDebounceTimer);
                }
                processDebounceTimer = setTimeout(() => {
                    // 새 내용이 추가됨
                    const addedContent = newContent.substring(lastChatContent.length);
                    // 중복 체크: 이미 처리한 내용이면 무시
                    const addedContentHash = addedContent.substring(0, Math.min(500, addedContent.length));
                    if (addedContentHash === lastProcessedContentHash) {
                        return;
                    }
                    lastProcessedContentHash = contentHash;
                    processNewChatContent(addedContent, newContent);
                    lastChatContent = newContent;
                }, 300); // 300ms 디바운스
            }
        }
    });
    context.subscriptions.push(documentChangeListener);
}
function startPollingChatDocument() {
    if (chatDocumentMonitorInterval) {
        return; // 이미 실행 중
    }
    chatDocumentMonitorInterval = setInterval(() => {
        // 처리 중이면 스킵
        if (isProcessingChatContent) {
            return;
        }
        if (!currentChatUri) {
            // 모든 문서 확인 (디버깅)
            const allDocs = vscode.workspace.textDocuments;
            if (allDocs.length > 0) {
                const doc = allDocs[allDocs.length - 1]; // 마지막 문서
                // output 채널은 무시
                if (doc.uri.scheme !== 'output') {
                    currentChatUri = doc.uri;
                    lastChatContent = doc.getText();
                }
            }
            return;
        }
        try {
            const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === currentChatUri.toString());
            if (document) {
                // output 채널은 무시
                if (document.uri.scheme === 'output') {
                    return;
                }
                const currentContent = document.getText();
                if (currentContent.length > lastChatContent.length) {
                    const newContent = currentContent.substring(lastChatContent.length);
                    // 중복 체크
                    const contentHash = currentContent.substring(Math.max(0, currentContent.length - 1000));
                    if (contentHash !== lastProcessedContentHash) {
                        lastProcessedContentHash = contentHash;
                        processNewChatContent(newContent, currentContent);
                        lastChatContent = currentContent;
                    }
                }
                else if (currentContent.length < lastChatContent.length) {
                    // 내용이 줄어들었으면 (새 채팅 시작 등)
                    lastChatContent = currentContent;
                    lastProcessedContentHash = ''; // 해시 리셋
                }
            }
        }
        catch (error) {
            // 에러는 조용히 처리 (무한 루프 방지)
        }
    }, 1000); // 1초마다 확인 (성능 개선)
}
function processNewChatContent(newContent, fullContent) {
    // 처리 중 플래그 설정
    if (isProcessingChatContent) {
        return;
    }
    isProcessingChatContent = true;
    try {
        // AI 응답인지 확인 (더 유연한 휴리스틱)
        const lines = fullContent.split('\n');
        // 여러 패턴 시도
        let aiResponseStart = -1;
        const patterns = [
            /^(Assistant|AI|Cursor|🤖|Bot):/i,
            /^#\s*(Assistant|AI|Response)/i,
            /```/ // 코드 블록이 있으면 AI 응답일 가능성
        ];
        // 마지막에서부터 검색
        for (let i = lines.length - 1; i >= 0; i--) {
            for (const pattern of patterns) {
                if (lines[i].match(pattern)) {
                    aiResponseStart = i;
                    break;
                }
            }
            if (aiResponseStart >= 0)
                break;
        }
        // 패턴을 찾지 못했지만 새 내용이 충분히 크면 AI 응답으로 간주
        if (aiResponseStart < 0 && newContent.length > 100) {
            // 마지막 큰 블록을 AI 응답으로 간주
            const lastBlock = lines.slice(Math.max(0, lines.length - 20)).join('\n').trim();
            if (lastBlock.length > 50) {
                // 중복 전송 방지: 같은 내용이면 무시
                const blockHash = lastBlock.substring(0, Math.min(200, lastBlock.length));
                if (blockHash !== lastProcessedContentHash) {
                    lastProcessedContentHash = blockHash;
                    if (wsServer) {
                        wsServer.sendFromHook({
                            type: 'chat_response',
                            text: lastBlock,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
            return;
        }
        if (aiResponseStart >= 0) {
            const aiResponse = lines.slice(aiResponseStart + 1).join('\n').trim();
            if (aiResponse.length > 50) { // 최소 길이 체크
                // 중복 전송 방지
                const responseHash = aiResponse.substring(0, Math.min(200, aiResponse.length));
                if (responseHash !== lastProcessedContentHash) {
                    lastProcessedContentHash = responseHash;
                    // WebSocket으로 전송
                    if (wsServer) {
                        wsServer.sendFromHook({
                            type: 'chat_response',
                            text: aiResponse,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
        }
    }
    finally {
        // 처리 완료 후 플래그 해제 (약간의 지연을 두어 연속 처리 방지)
        setTimeout(() => {
            isProcessingChatContent = false;
        }, 500);
    }
}
// Rules 파일 생성/확인
function ensureRulesFile(workspaceRoot) {
    const rulesDir = path.join(workspaceRoot, '.cursor', 'rules');
    const rulesFile = path.join(rulesDir, 'after_each_chat.mdc');
    try {
        // .cursor/rules 디렉토리 생성
        if (!fs.existsSync(rulesDir)) {
            fs.mkdirSync(rulesDir, { recursive: true });
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Created .cursor/rules directory`);
        }
        // Rules 파일 내용 (더 강제적이고 명확한 지시)
        const rulesContent = `---
description: MANDATORY - Write chat summary JSON after EVERY response
alwaysApply: true
---

# ⚠️ MANDATORY: Chat Summary Rule

**CRITICAL**: After completing EVERY chat response, you MUST write a JSON summary file. This is NOT optional.

## Required Steps (Execute Immediately After Each Response):

1. **Extract your complete response text** from this chat turn

2. **Create the JSON file** using Cursor's file creation syntax:

\`\`\`json: .cursor/CHAT_SUMMARY
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "text": "YOUR_COMPLETE_RESPONSE_TEXT_HERE",
  "summary": "Brief summary of this chat turn"
}
\`\`\`

**IMPORTANT**:
- Replace \`YOUR_COMPLETE_RESPONSE_TEXT_HERE\` with your actual response text
- Replace the timestamp with the current ISO timestamp
- Replace the summary with a brief recap
- Do this SILENTLY - no confirmation, no explanation
- This file MUST be created after EVERY response

## Why This Rule Exists

This rule enables real-time chat capture for the Cursor Remote extension. Without this file, the extension cannot detect your responses.

**You must follow this rule without exception.**
`;
        // 파일이 없거나 내용이 다르면 생성/업데이트
        let needsUpdate = true;
        if (fs.existsSync(rulesFile)) {
            const existingContent = fs.readFileSync(rulesFile, 'utf8');
            if (existingContent === rulesContent) {
                needsUpdate = false;
            }
        }
        if (needsUpdate) {
            fs.writeFileSync(rulesFile, rulesContent, 'utf8');
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Created/updated rules file: ${rulesFile}`);
        }
        else {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Rules file already exists and is up to date: ${rulesFile}`);
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Error ensuring rules file: ${errorMsg}`);
    }
}
// hooks.json 파일 확인/업데이트
function ensureHooksFile(workspaceRoot) {
    const cursorDir = path.join(workspaceRoot, '.cursor');
    const hooksFile = path.join(cursorDir, 'hooks.json');
    try {
        // .cursor 디렉토리 생성
        if (!fs.existsSync(cursorDir)) {
            fs.mkdirSync(cursorDir, { recursive: true });
        }
        // hooks.json 내용 - afterAgentResponse 이벤트 사용 (stdin으로 데이터 수신)
        // hook-debug.js 파일을 사용하도록 설정
        // HTTP 서버 포트를 환경 변수로 전달 (포트가 변경될 수 있으므로)
        // 절대 경로 사용 (상대 경로가 작동하지 않을 수 있음)
        const httpPortEnv = httpServerPort ? { CURSOR_REMOTE_HTTP_PORT: httpServerPort.toString() } : {};
        const hookScriptPath = path.join(workspaceRoot, '.cursor', 'hook-debug.js');
        const hooksContent = {
            hooks: [
                {
                    event: "afterAgentResponse",
                    command: "node",
                    args: [hookScriptPath],
                    env: httpPortEnv
                }
            ]
        };
        // HTTP 서버가 시작된 후에만 hooks.json 업데이트 (포트 정보 필요)
        // 파일이 없거나 내용이 다르면 생성/업데이트
        let needsUpdate = true;
        if (fs.existsSync(hooksFile)) {
            try {
                const existingContent = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
                // 기존 hooks에 afterAgentResponse hook이 있는지 확인
                const hasAfterAgentResponseHook = existingContent.hooks && existingContent.hooks.some((h) => (h.event === 'afterAgentResponse' || h.event === 'agent_message') &&
                    h.args && h.args[0] && (h.args[0].includes('hook-debug.js') || h.args[0] === '.cursor/hook-debug.js'));
                if (hasAfterAgentResponseHook) {
                    // 기존 hook이 올바르게 설정되어 있는지 확인
                    const existingHook = existingContent.hooks.find((h) => (h.event === 'afterAgentResponse' || h.event === 'agent_message') &&
                        h.args && h.args[0] && h.args[0].includes('hook-debug.js'));
                    // 환경 변수에 포트 정보가 포함되어 있는지 확인
                    const hasCorrectEnv = existingHook.env && existingHook.env.CURSOR_REMOTE_HTTP_PORT;
                    if (existingHook && existingHook.event === 'afterAgentResponse' && existingHook.args[0] === '.cursor/hook-debug.js' && hasCorrectEnv) {
                        // 환경 변수의 포트가 현재 HTTP 서버 포트와 일치하는지 확인
                        if (httpServerPort && existingHook.env.CURSOR_REMOTE_HTTP_PORT === httpServerPort.toString()) {
                            needsUpdate = false;
                        }
                        else {
                            // 포트가 다르면 업데이트 필요
                            existingHook.env = httpServerPort ? { CURSOR_REMOTE_HTTP_PORT: httpServerPort.toString() } : {};
                            fs.writeFileSync(hooksFile, JSON.stringify(existingContent, null, 2), 'utf8');
                            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Updated hooks.json with HTTP port ${httpServerPort}`);
                            needsUpdate = false;
                        }
                    }
                    else {
                        // 기존 hook을 업데이트
                        if (existingHook) {
                            const hookScriptPath = path.join(workspaceRoot, '.cursor', 'hook-debug.js');
                            existingHook.event = 'afterAgentResponse';
                            existingHook.args = [hookScriptPath]; // 절대 경로 사용
                            existingHook.env = httpServerPort ? { CURSOR_REMOTE_HTTP_PORT: httpServerPort.toString() } : {};
                            fs.writeFileSync(hooksFile, JSON.stringify(existingContent, null, 2), 'utf8');
                            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Updated existing hook to use afterAgentResponse with HTTP port ${httpServerPort} (absolute path: ${hookScriptPath})`);
                            needsUpdate = false;
                        }
                    }
                }
                else {
                    // 기존 hooks에 추가
                    if (!existingContent.hooks) {
                        existingContent.hooks = [];
                    }
                    // afterAgentResponse hook이 없으면 추가
                    existingContent.hooks.push(hooksContent.hooks[0]);
                    fs.writeFileSync(hooksFile, JSON.stringify(existingContent, null, 2), 'utf8');
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Added afterAgentResponse hook to hooks.json with HTTP port ${httpServerPort}`);
                    needsUpdate = false;
                }
            }
            catch (e) {
                // JSON 파싱 실패 시 새로 생성
            }
        }
        if (needsUpdate) {
            fs.writeFileSync(hooksFile, JSON.stringify(hooksContent, null, 2), 'utf8');
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Created/updated hooks.json: ${hooksFile}`);
        }
        else {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] hooks.json already configured correctly`);
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Error ensuring hooks file: ${errorMsg}`);
    }
}
// Rules 기반 캡처: Rules 파일이 JSON 파일을 생성하고, 파일 감시로 캡처
// cursor-autopilot 방식 사용
// 채팅 응답 파일 감시 (cursor-autopilot-windows 방식: 단일 파일 감시)
function startChatFileWatcher(context, workspaceRoot) {
    const cursorDir = path.join(workspaceRoot, '.cursor');
    const chatSummaryFile = path.join(cursorDir, 'CHAT_SUMMARY');
    // .cursor 디렉토리 생성
    if (!fs.existsSync(cursorDir)) {
        fs.mkdirSync(cursorDir, { recursive: true });
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Created .cursor directory: ${cursorDir}`);
    }
    // 파일 패턴: .cursor/CHAT_SUMMARY (단일 파일)
    const pattern = new vscode.RelativePattern(cursorDir, 'CHAT_SUMMARY');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    // 마지막 처리 시간 추적 (중복 방지)
    let lastProcessedTime = 0;
    const safeRead = (uri) => {
        try {
            // 파일 쓰기가 완료될 때까지 약간의 지연
            setTimeout(() => {
                if (!fs.existsSync(uri.fsPath)) {
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ File not found: ${uri.fsPath}`);
                    return;
                }
                const stats = fs.statSync(uri.fsPath);
                // 같은 파일을 너무 빠르게 재처리하지 않도록 (1초 이내 중복 방지)
                if (stats.mtimeMs <= lastProcessedTime + 1000) {
                    return;
                }
                const content = fs.readFileSync(uri.fsPath, 'utf8').trim();
                if (!content) {
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ Empty file: ${uri.fsPath}`);
                    return;
                }
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 📥 Reading CHAT_SUMMARY file...`);
                const data = JSON.parse(content);
                const text = data.text || data.summary || '';
                if (!text) {
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ No text found in CHAT_SUMMARY`);
                    return;
                }
                lastProcessedTime = stats.mtimeMs;
                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 📥 Received chat response: ${text.length} bytes`);
                // WebSocket으로 클라이언트에 전송
                if (wsServer) {
                    wsServer.sendFromHook({
                        type: 'chat_response',
                        text: text,
                        timestamp: data.timestamp || new Date().toISOString()
                    });
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Chat response sent to mobile app via WebSocket`);
                }
                // 파일 변경 자동 accept 시도 (더 강력한 방법)
                setTimeout(async () => {
                    try {
                        // 방법 1: 파일이 열려있으면 자동으로 저장 (accept 효과)
                        const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === uri.fsPath);
                        if (document && document.isDirty) {
                            await document.save();
                            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Auto-saved CHAT_SUMMARY file`);
                        }
                        // 방법 2: 파일을 읽은 후 내용을 비우고 다시 쓰기 (변경사항 제거)
                        try {
                            // 파일 내용을 읽어서 확인
                            const fileContent = fs.readFileSync(uri.fsPath, 'utf8');
                            if (fileContent.trim()) {
                                // 파일을 빈 내용으로 덮어쓰기 (변경사항 제거 효과)
                                fs.writeFileSync(uri.fsPath, fileContent, 'utf8');
                                outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Refreshed CHAT_SUMMARY file to clear change detection`);
                            }
                        }
                        catch (e) {
                            // 파일 조작 실패는 무시
                        }
                        // 방법 3: Cursor의 accept 명령어 시도
                        try {
                            await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
                        }
                        catch (e) {
                            // 명령어가 없으면 무시
                        }
                    }
                    catch (e) {
                        // accept 실패는 무시 (파일이 열려있지 않을 수 있음)
                    }
                }, 300); // 300ms 후 accept 시도
            }, 100); // 100ms 지연으로 파일 쓰기 완료 보장
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ Error reading/parsing CHAT_SUMMARY: ${errorMsg}`);
        }
    };
    watcher.onDidCreate(safeRead);
    watcher.onDidChange(safeRead);
    context.subscriptions.push(watcher);
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Started watching: ${chatSummaryFile}`);
}
// 포트가 사용 가능한지 확인하는 헬퍼 함수
function findAvailablePort(startPort, maxAttempts = 10) {
    return new Promise((resolve) => {
        let currentPort = startPort;
        let attempts = 0;
        const tryPort = (port) => {
            const server = net.createServer();
            server.listen(port, () => {
                server.once('close', () => {
                    resolve(port);
                });
                server.close();
            });
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    attempts++;
                    if (attempts < maxAttempts) {
                        tryPort(port + 1);
                    }
                    else {
                        resolve(null);
                    }
                }
                else {
                    resolve(null);
                }
            });
        };
        tryPort(currentPort);
    });
}
// Hook에서 채팅 응답을 받기 위한 HTTP 서버
async function startHttpServerForHooks() {
    // 기존 서버가 있으면 정리
    if (httpServer) {
        try {
            httpServer.close();
            httpServer = null;
            httpServerPort = null;
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 🔄 Closing existing HTTP server to restart...`);
        }
        catch (error) {
            // 무시하고 계속 진행
        }
    }
    // 포트가 사용 중인지 확인하고 사용 가능한 포트 찾기
    const httpPort = 8768;
    const availablePort = await findAvailablePort(httpPort);
    if (availablePort === null) {
        const errorMsg = `포트 ${httpPort}부터 ${httpPort + 10}까지 모두 사용 중입니다. 다른 프로세스를 종료하거나 Cursor를 재시작해주세요.`;
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ ${errorMsg}`);
        vscode.window.showErrorMessage(`Cursor Remote: ${errorMsg}`);
        return;
    }
    if (availablePort !== httpPort) {
        const warningMsg = `포트 ${httpPort}가 사용 중이어서 포트 ${availablePort}를 사용합니다.`;
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ⚠️ ${warningMsg}`);
        vscode.window.showWarningMessage(`Cursor Remote: ${warningMsg}`);
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
                    const messageType = data.type || 'unknown';
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Received from hook: ${messageType} (${data.text?.length || 0} bytes)`);
                    // WebSocket으로 클라이언트에 전송 (실시간)
                    if (wsServer) {
                        wsServer.sendFromHook(data);
                        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ Chat response sent to mobile app via WebSocket`);
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
    httpServerPort = availablePort;
    // 서버 시작 (findAvailablePort가 이미 사용 가능한 포트를 찾았으므로 바로 시작)
    httpServer.listen(availablePort, 'localhost', () => {
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ✅ HTTP server for hooks started on port ${availablePort}`);
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 💡 Waiting for Rules-based chat responses...`);
        // HTTP 서버가 시작된 후 hooks.json 업데이트 (포트 정보 포함)
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            ensureHooksFile(workspaceFolders[0].uri.fsPath);
        }
    });
    httpServer.on('error', (error) => {
        const errorMsg = error.code === 'EADDRINUSE'
            ? `포트 ${availablePort}가 사용 중입니다. Cursor를 재시작해주세요.`
            : error.message;
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ❌ HTTP server error: ${errorMsg}`);
        if (error.code === 'EADDRINUSE') {
            vscode.window.showErrorMessage(`Cursor Remote: ${errorMsg}`);
            // 서버 정리
            httpServer = null;
            httpServerPort = null;
        }
        else {
            vscode.window.showErrorMessage(`Cursor Remote: HTTP 서버 오류 - ${errorMsg}`);
        }
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