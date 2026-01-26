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
exports.CLIHandler = void 0;
const child_process = __importStar(require("child_process"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class CLIHandler {
    constructor(outputChannel, wsServer, workspaceRoot) {
        this.outputChannel = null;
        this.wsServer = null;
        this.currentProcess = null;
        this.workspaceRoot = null;
        this.processingOutput = false;
        this.lastChatId = null; // 마지막 채팅 세션 ID (대화형 모드 테스트용)
        this.clientSessions = new Map(); // 클라이언트별 세션 ID 관리
        this.chatHistoryFile = null; // 대화 히스토리 파일 경로
        this.outputChannel = outputChannel || null;
        this.wsServer = wsServer || null;
        this.workspaceRoot = workspaceRoot || null;
        // 대화 히스토리 파일 경로 설정
        if (workspaceRoot) {
            const cursorDir = path.join(workspaceRoot, '.cursor');
            if (!fs.existsSync(cursorDir)) {
                fs.mkdirSync(cursorDir, { recursive: true });
            }
            this.chatHistoryFile = path.join(cursorDir, 'CHAT_HISTORY.json');
        }
    }
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] [CLI] ${message}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        }
        console.log(logMessage);
    }
    logError(message, error) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] [CLI] ERROR: ${message}${error ? ` - ${error}` : ''}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        }
        console.error(logMessage);
    }
    /**
     * Cursor CLI가 설치되어 있는지 확인
     */
    async checkCLIInstalled() {
        return new Promise(async (resolve) => {
            // PATH에서 찾기
            child_process.exec('which agent', (error) => {
                if (!error) {
                    resolve(true);
                    return;
                }
                child_process.exec('which cursor-agent', (error2) => {
                    if (!error2) {
                        resolve(true);
                        return;
                    }
                    // 일반적인 설치 경로 확인
                    const os = require('os');
                    const homeDir = os.homedir();
                    const commonPaths = [
                        path.join(homeDir, '.local', 'bin', 'agent'),
                        path.join(homeDir, '.local', 'bin', 'cursor-agent'),
                        path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'bin', 'agent'),
                        path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'bin', 'cursor-agent'),
                    ];
                    // 파일 존재 여부 확인
                    const exists = commonPaths.some(cliPath => fs.existsSync(cliPath));
                    resolve(exists);
                });
            });
        });
    }
    /**
     * Cursor CLI 명령어 경로 찾기
     */
    async findCLICommand() {
        return new Promise((resolve) => {
            // 1. PATH에서 'agent' 찾기
            child_process.exec('which agent', (error, stdout) => {
                if (!error && stdout.trim()) {
                    resolve(stdout.trim());
                    return;
                }
                // 2. PATH에서 'cursor-agent' 찾기
                child_process.exec('which cursor-agent', (error2, stdout2) => {
                    if (!error2 && stdout2.trim()) {
                        resolve(stdout2.trim());
                        return;
                    }
                    // 3. 일반적인 설치 경로 확인
                    const os = require('os');
                    const homeDir = os.homedir();
                    const commonPaths = [
                        path.join(homeDir, '.local', 'bin', 'agent'),
                        path.join(homeDir, '.local', 'bin', 'cursor-agent'),
                        path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'bin', 'agent'),
                        path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'bin', 'cursor-agent'),
                    ];
                    // 파일 존재 여부 확인
                    let found = false;
                    for (const cliPath of commonPaths) {
                        if (fs.existsSync(cliPath)) {
                            resolve(cliPath);
                            found = true;
                            break;
                        }
                    }
                    // 4. 찾지 못한 경우 기본값 (PATH에 있다고 가정)
                    if (!found) {
                        resolve('agent');
                    }
                });
            });
        });
    }
    /**
     * Cursor CLI에 프롬프트 전송
     * @param text 프롬프트 텍스트
     * @param execute 실행 여부
     * @param clientId 클라이언트 ID (세션 격리용, 선택사항)
     * @param newSession 새 세션 시작 여부 (클라이언트에서 결정, 기본값: false)
     */
    async sendPrompt(text, execute = true, clientId, newSession = false) {
        this.log(`sendPrompt called - textLength: ${text.length}, execute: ${execute}, clientId: ${clientId || 'none'}, newSession: ${newSession}`);
        // 대화 히스토리 저장 (사용자 메시지 전송 시)
        // 세션 ID는 나중에 응답에서 받을 수 있으므로, 임시로 저장
        if (clientId) {
            const currentSessionId = this.clientSessions.get(clientId) || null;
            this.saveChatHistoryEntry({
                sessionId: currentSessionId || 'pending',
                clientId: clientId,
                userMessage: text,
                timestamp: new Date().toISOString()
            });
        }
        try {
            // CLI 설치 확인
            const isInstalled = await this.checkCLIInstalled();
            if (!isInstalled) {
                throw new Error('Cursor CLI (agent)가 설치되어 있지 않습니다. https://cursor.com/cli 에서 설치하세요.');
            }
            const cliCommand = await this.findCLICommand();
            this.log(`Using CLI command: ${cliCommand}`);
            // 테스트: 대화형 모드에서는 프로세스를 유지하거나 --continue 옵션 사용
            // 현재는 기존 프로세스 종료 로직 유지 (대화형 모드 테스트 후 결정)
            if (this.currentProcess) {
                this.log('Stopping previous CLI process');
                const previousProcess = this.currentProcess;
                this.currentProcess = null;
                // 프로세스 종료 (SIGTERM)
                previousProcess.kill('SIGTERM');
                // 프로세스가 완전히 종료될 때까지 최대 2초 대기
                await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        // 타임아웃 시 강제 종료
                        if (!previousProcess.killed) {
                            previousProcess.kill('SIGKILL');
                        }
                        resolve();
                    }, 2000);
                    previousProcess.once('close', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });
                this.log('Previous CLI process stopped');
            }
            // Cursor CLI 실행
            // 테스트: 대화형 모드 (--print 없이)
            // --output-format json: JSON 형식으로 출력 (대화형 모드에서도 작동하는지 테스트)
            // --force: 자동 실행 (승인 없이)
            // --continue: 이전 세션 재개 (대화 컨텍스트 유지)
            // 주의: -p 없이 실행하면 대화형 모드가 되지만, JSON 출력이 제대로 작동하는지 확인 필요
            const args = [];
            // 클라이언트에서 새 세션 시작 여부 결정
            if (newSession) {
                // 클라이언트가 명시적으로 새 세션을 요청한 경우
                this.log(`Starting new session (client requested) for client ${clientId || 'global'}`);
                // 기존 세션 ID는 무시하고 새로 시작
                if (clientId) {
                    // 클라이언트별 세션 맵에서 제거 (선택사항 - 나중에 재사용할 수도 있으므로 유지)
                    // this.clientSessions.delete(clientId);
                }
            }
            else {
                // 기존 세션 재개 시도
                let sessionId = null;
                if (clientId) {
                    sessionId = this.clientSessions.get(clientId) || null;
                }
                else {
                    // clientId가 없으면 전역 세션 사용 (하위 호환성)
                    sessionId = this.lastChatId;
                }
                if (sessionId) {
                    args.push('--resume', sessionId);
                    this.log(`Resuming chat session for client ${clientId || 'global'}: ${sessionId}`);
                }
                else {
                    // 세션이 없으면 새로 시작 (--continue 없이)
                    this.log(`Starting new chat session for client ${clientId || 'global'} (no existing session)`);
                }
            }
            args.push('--output-format', 'json', '--force', text);
            this.log(`Executing: ${cliCommand} ${args.join(' ')}`);
            // 현재 작업 디렉토리 설정
            const cwd = this.workspaceRoot || process.cwd();
            this.currentProcess = child_process.spawn(cliCommand, args, {
                cwd: cwd,
                stdio: ['ignore', 'pipe', 'pipe'], // stdin은 무시, stdout/stderr는 파이프
                shell: false,
                env: { ...process.env } // 환경 변수 전달
            });
            this.log(`CLI process spawned (PID: ${this.currentProcess.pid})`);
            this.log(`CLI process stdout: ${this.currentProcess.stdout ? 'exists' : 'null'}`);
            this.log(`CLI process stderr: ${this.currentProcess.stderr ? 'exists' : 'null'}`);
            let stdout = '';
            let stderr = '';
            let stdoutEnded = false;
            let stderrEnded = false;
            let processClosed = false;
            // 현재 프롬프트의 clientId를 클로저로 저장 (checkAndProcessOutput에서 사용)
            const currentClientId = clientId;
            // 디버깅: clientId가 제대로 전달되는지 로그
            if (clientId) {
                this.log(`🔑 Using clientId: ${clientId} for this prompt`);
                const existingSession = this.clientSessions.get(clientId);
                if (existingSession) {
                    this.log(`🔑 Found existing session for client ${clientId}: ${existingSession}`);
                }
                else {
                    this.log(`🔑 No existing session for client ${clientId}, will create new session`);
                }
            }
            else {
                this.log(`⚠️ No clientId provided, using global session (lastChatId: ${this.lastChatId || 'none'})`);
            }
            // stdout 수집
            if (this.currentProcess.stdout) {
                // 버퍼링 비활성화 (가능한 경우)
                this.currentProcess.stdout.setEncoding('utf8');
                this.currentProcess.stdout.on('data', (data) => {
                    const chunk = typeof data === 'string' ? data : data.toString();
                    stdout += chunk;
                    this.log(`CLI stdout chunk (${chunk.length} bytes): ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);
                    // 실시간으로 session_id 추출 시도 (대화형 모드)
                    // 주의: clientId는 sendPrompt 호출 시점에만 알 수 있으므로 여기서는 전역 저장하지 않음
                    // 클라이언트별 세션은 checkAndProcessOutput에서 처리
                    // 이 부분은 제거하거나 주석 처리 (클라이언트별 세션 관리로 인해 불필요)
                });
                this.currentProcess.stdout.on('end', () => {
                    this.log('CLI stdout stream ended');
                    stdoutEnded = true;
                    // 프로세스가 종료된 후에만 처리 (중복 방지)
                    if (processClosed) {
                        this.checkAndProcessOutput(stdout, stderr, currentClientId);
                    }
                });
                this.currentProcess.stdout.on('error', (error) => {
                    this.logError('CLI stdout stream error', error);
                });
            }
            else {
                this.logError('⚠️ CLI process stdout is null');
            }
            // stderr 수집
            if (this.currentProcess.stderr) {
                // 버퍼링 비활성화 (가능한 경우)
                this.currentProcess.stderr.setEncoding('utf8');
                this.currentProcess.stderr.on('data', (data) => {
                    const chunk = typeof data === 'string' ? data : data.toString();
                    stderr += chunk;
                    this.logError(`CLI stderr chunk (${chunk.length} bytes): ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);
                });
                this.currentProcess.stderr.on('end', () => {
                    this.log('CLI stderr stream ended');
                    stderrEnded = true;
                    // 프로세스가 종료된 후에만 처리 (중복 방지)
                    if (processClosed) {
                        this.checkAndProcessOutput(stdout, stderr, currentClientId);
                    }
                });
                this.currentProcess.stderr.on('error', (error) => {
                    this.logError('CLI stderr stream error', error);
                });
            }
            else {
                this.logError('⚠️ CLI process stderr is null');
            }
            // 프로세스 에러 처리
            this.currentProcess.on('error', (error) => {
                this.logError('CLI process spawn error', error);
                this.currentProcess = null;
                if (this.wsServer) {
                    this.wsServer.send(JSON.stringify({
                        type: 'error',
                        message: `CLI 실행 실패: ${error.message}`,
                        timestamp: new Date().toISOString()
                    }));
                }
            });
            // 프로세스 종료 처리
            this.currentProcess.on('close', (code, signal) => {
                this.log(`CLI process exited with code ${code}, signal: ${signal || 'none'}`);
                this.log(`Final stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
                this.log(`stdout ended: ${stdoutEnded}, stderr ended: ${stderrEnded}`);
                processClosed = true;
                if (stdout.length === 0 && stderr.length === 0) {
                    this.logError('⚠️ No output received from CLI process');
                    this.logError('⚠️ This might indicate the process was killed or did not produce output');
                }
                // 프로세스가 종료되었으므로 출력 처리 (한 번만)
                // 스트림이 아직 끝나지 않았어도 프로세스가 종료되었으므로 처리
                this.checkAndProcessOutput(stdout, stderr, currentClientId);
                this.currentProcess = null;
            });
            this.currentProcess.on('error', (error) => {
                this.logError('CLI process error', error);
                this.currentProcess = null;
                if (this.wsServer) {
                    this.wsServer.send(JSON.stringify({
                        type: 'error',
                        message: `CLI 실행 실패: ${error.message}`,
                        timestamp: new Date().toISOString()
                    }));
                }
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.logError(`Error in sendPrompt: ${errorMsg}`);
            throw new Error(`CLI 프롬프트 전송 실패: ${errorMsg}`);
        }
    }
    /**
     * CLI 출력 처리 및 WebSocket으로 전송
     * @param clientId 클라이언트 ID (세션 격리용, 선택사항)
     */
    checkAndProcessOutput(stdout, stderr, clientId) {
        // 중복 처리 방지
        if (this.processingOutput) {
            this.log('⚠️ Output processing already in progress, skipping duplicate call');
            return;
        }
        this.processingOutput = true;
        this.log(`Processing output - stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
        // JSON 출력 파싱 시도
        try {
            if (stdout.length > 0) {
                this.log(`CLI stdout content: ${stdout.substring(0, 500)}`);
            }
            // stdout에서 JSON 추출 시도
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonData = JSON.parse(jsonMatch[0]);
                this.log(`Parsed JSON data: ${JSON.stringify(jsonData).substring(0, 200)}`);
                // Cursor CLI 응답 형식: {"type":"result","result":"응답 텍스트",...}
                // 또는 {"text":"응답 텍스트",...}
                // 또는 {"response":"응답 텍스트",...}
                const responseText = jsonData.result || jsonData.text || jsonData.response || jsonData.message || stdout;
                // 대화형 모드: session_id 추출 및 저장
                const extractedSessionId = jsonData.session_id || jsonData.sessionId || jsonData.chatId || jsonData.chat_id;
                if (extractedSessionId) {
                    // 클라이언트별 세션 저장
                    if (clientId) {
                        this.clientSessions.set(clientId, extractedSessionId);
                        this.log(`💾 Saved session ID for client ${clientId}: ${extractedSessionId}`);
                        this.log(`💾 Total clients with sessions: ${this.clientSessions.size}`);
                        // 디버깅: 모든 클라이언트 세션 출력
                        this.clientSessions.forEach((session, cid) => {
                            this.log(`   - Client ${cid}: Session ${session}`);
                        });
                    }
                    else {
                        // 전역 세션 (하위 호환성) - 경고 로그
                        this.log(`⚠️ No clientId provided, saving to global session (this may cause session sharing!)`);
                        this.lastChatId = extractedSessionId;
                        this.log(`💾 Saved global session ID: ${extractedSessionId}`);
                    }
                }
                this.log(`Extracted response text length: ${responseText.length}`);
                // 대화 히스토리 저장 (응답 수신 시)
                const currentSessionId = extractedSessionId || (clientId ? this.clientSessions.get(clientId) : this.lastChatId);
                if (currentSessionId && clientId) {
                    // 마지막 사용자 메시지를 찾아서 히스토리에 저장
                    // (사용자 메시지는 sendPrompt에서 저장되어야 함)
                    this.saveChatHistoryEntry({
                        sessionId: currentSessionId,
                        clientId: clientId,
                        assistantResponse: responseText,
                        timestamp: new Date().toISOString()
                    });
                }
                // WebSocket으로 응답 전송
                if (this.wsServer && responseText) {
                    const responseMessage = {
                        type: 'chat_response',
                        text: responseText,
                        timestamp: new Date().toISOString(),
                        source: 'cli',
                        sessionId: currentSessionId || undefined,
                        clientId: clientId || undefined
                    };
                    this.log(`Sending chat_response: ${JSON.stringify(responseMessage).substring(0, 200)}`);
                    if (currentSessionId) {
                        this.log(`   Session ID: ${currentSessionId}, Client ID: ${clientId || 'none'}`);
                    }
                    this.wsServer.send(JSON.stringify(responseMessage));
                    this.log('✅ Chat response sent to WebSocket');
                }
                else {
                    this.logError('wsServer is null or responseText is empty');
                }
            }
            else {
                // JSON이 없으면 전체 stdout을 응답으로 사용
                this.log('No JSON match found, using stdout as text');
                if (this.wsServer && stdout.trim()) {
                    const responseMessage = {
                        type: 'chat_response',
                        text: stdout.trim(),
                        timestamp: new Date().toISOString(),
                        source: 'cli'
                    };
                    this.log(`Sending chat_response (from stdout): ${JSON.stringify(responseMessage).substring(0, 200)}`);
                    this.wsServer.send(JSON.stringify(responseMessage));
                    this.log('✅ Chat response sent to WebSocket (from stdout)');
                }
                else {
                    this.logError('wsServer is null or stdout is empty');
                }
            }
        }
        catch (parseError) {
            // JSON 파싱 실패 시 전체 출력을 텍스트로 전송
            const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown error';
            this.logError(`JSON parsing error: ${errorMsg}`);
            this.logError(`stdout: ${stdout.substring(0, 500)}`);
            if (this.wsServer) {
                const responseMessage = {
                    type: 'chat_response',
                    text: stdout || stderr || 'CLI 실행 완료',
                    timestamp: new Date().toISOString(),
                    source: 'cli'
                };
                this.log(`Sending chat_response (fallback): ${JSON.stringify(responseMessage).substring(0, 200)}`);
                this.wsServer.send(JSON.stringify(responseMessage));
                this.log('✅ Chat response sent to WebSocket (fallback)');
            }
        }
        finally {
            this.processingOutput = false;
        }
    }
    /**
     * 실행 중인 CLI 프로세스 중지
     */
    async stopPrompt() {
        this.log('stopPrompt called');
        if (this.currentProcess) {
            try {
                this.currentProcess.kill('SIGINT');
                this.currentProcess = null;
                this.log('CLI process stopped');
                return { success: true };
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                this.logError(`Error stopping CLI process: ${errorMsg}`);
                return { success: false };
            }
        }
        return { success: true };
    }
    /**
     * CLI 핸들러 정리
     */
    dispose() {
        if (this.currentProcess) {
            this.currentProcess.kill();
            this.currentProcess = null;
        }
    }
    /**
     * 대화 히스토리 저장
     */
    saveChatHistoryEntry(entry) {
        if (!this.chatHistoryFile) {
            return;
        }
        try {
            let history = { entries: [], lastUpdated: new Date().toISOString() };
            // 기존 히스토리 로드
            if (fs.existsSync(this.chatHistoryFile)) {
                const content = fs.readFileSync(this.chatHistoryFile, 'utf8');
                try {
                    history = JSON.parse(content);
                }
                catch (e) {
                    this.logError('Failed to parse chat history', e);
                    history = { entries: [], lastUpdated: new Date().toISOString() };
                }
            }
            // 새 엔트리 생성
            const newEntry = {
                id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
                sessionId: entry.sessionId || 'unknown',
                clientId: entry.clientId,
                userMessage: entry.userMessage || '',
                assistantResponse: entry.assistantResponse || '',
                timestamp: entry.timestamp
            };
            // 마지막 엔트리 업데이트 또는 새로 추가
            const lastEntry = history.entries[history.entries.length - 1];
            if (lastEntry &&
                lastEntry.sessionId === newEntry.sessionId &&
                lastEntry.clientId === newEntry.clientId &&
                Math.abs(new Date(lastEntry.timestamp).getTime() - new Date(newEntry.timestamp).getTime()) < 5000) {
                // 5초 이내면 업데이트 (사용자 메시지 후 응답 받은 경우)
                lastEntry.userMessage = newEntry.userMessage || lastEntry.userMessage;
                lastEntry.assistantResponse = newEntry.assistantResponse || lastEntry.assistantResponse;
            }
            else {
                // 새 엔트리 추가
                history.entries.push(newEntry);
            }
            // 최대 100개만 유지
            if (history.entries.length > 100) {
                history.entries = history.entries.slice(-100);
            }
            history.lastUpdated = new Date().toISOString();
            // 파일 저장
            fs.writeFileSync(this.chatHistoryFile, JSON.stringify(history, null, 2), 'utf8');
            this.log(`💾 Chat history saved (${history.entries.length} entries)`);
        }
        catch (error) {
            this.logError('Failed to save chat history', error);
        }
    }
    /**
     * 대화 히스토리 조회
     */
    getChatHistory(clientId, sessionId, limit = 50) {
        if (!this.chatHistoryFile || !fs.existsSync(this.chatHistoryFile)) {
            return [];
        }
        try {
            const content = fs.readFileSync(this.chatHistoryFile, 'utf8');
            const history = JSON.parse(content);
            let filtered = history.entries;
            // 클라이언트 ID로 필터링
            if (clientId) {
                filtered = filtered.filter(entry => entry.clientId === clientId);
            }
            // 세션 ID로 필터링
            if (sessionId) {
                filtered = filtered.filter(entry => entry.sessionId === sessionId);
            }
            // 최신순으로 정렬하고 제한
            filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return filtered.slice(0, limit);
        }
        catch (error) {
            this.logError('Failed to load chat history', error);
            return [];
        }
    }
}
exports.CLIHandler = CLIHandler;
//# sourceMappingURL=cli-handler.js.map