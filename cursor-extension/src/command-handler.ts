import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class CommandHandler {
    private outputChannel: vscode.OutputChannel | null = null;
    private wsServer: any = null; // WebSocketServer 타입

    constructor(outputChannel?: vscode.OutputChannel, wsServer?: any) {
        this.outputChannel = outputChannel || null;
        this.wsServer = wsServer || null;
    }

    private log(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        }
        console.log(logMessage);
    }

    private logError(message: string, error?: any) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ERROR: ${message}${error ? ` - ${error}` : ''}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        }
        console.error(logMessage);
    }

    // 텍스트가 명령어인지 판단하는 헬퍼 함수
    private isLikelyCommand(text: string): boolean {
        if (!text || text.length === 0) {
            return false;
        }

        // 단일 단어만 있는 경우 (공백 없음) - 일반 텍스트로 간주
        if (!text.includes(' ') && !text.includes('\t')) {
            // 예외: 명령어로 보이는 패턴들
            const commandPatterns = [
                /^[a-z]+-[a-z]+/i,  // kebab-case (예: gemini-cli, npm-install)
                /^[a-z]+\.[a-z]+/i,  // dot notation (예: npm.test)
                /^[a-z]+:[a-z]+/i,  // colon notation
            ];
            
            // 패턴 매칭 확인
            for (const pattern of commandPatterns) {
                if (pattern.test(text)) {
                    return true;
                }
            }
            
            // 단일 단어는 일반 텍스트로 간주
            return false;
        }

        // 공백이 있으면 명령어로 간주 (명령어 + 인자 형태)
        // 하지만 특정 예외 패턴은 제외
        const plainTextPatterns = [
            /^hello\s*$/i,
            /^hi\s*$/i,
            /^hey\s*$/i,
        ];

        for (const pattern of plainTextPatterns) {
            if (pattern.test(text.trim())) {
                return false;
            }
        }

        return true;
    }

    async insertText(text: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor. Please open a file in Cursor IDE.');
        }

        const success = await editor.edit(editBuilder => {
            const position = editor.selection.active;
            editBuilder.insert(position, text);
        });

        if (!success) {
            throw new Error('Failed to insert text. The editor may be read-only or the edit was rejected.');
        }
    }

    async insertToTerminal(text: string, execute: boolean = false): Promise<void> {
        this.log(`[Cursor Remote] insertToTerminal called - textLength: ${text.length}, execute: ${execute}`);
        this.log(`[Cursor Remote] Text content: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
        
        try {
            // 출력 파일 경로 가져오기
            const workspaceFolders = vscode.workspace.workspaceFolders;
            let outputFile: string | null = null;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                outputFile = path.join(workspaceRoot, '.cursor-remote-terminal-output.log');
            }
            
            // 활성 터미널 가져오기
            let terminal = vscode.window.activeTerminal;
            this.log(`[Cursor Remote] Active terminal: ${terminal ? terminal.name : 'null'}`);
            
            if (!terminal) {
                // 활성 터미널이 없으면 새 터미널 생성
                this.log('[Cursor Remote] No active terminal, creating new terminal');
                terminal = vscode.window.createTerminal('Cursor Remote');
                this.log(`[Cursor Remote] Created terminal: ${terminal.name}`);
                terminal.show(true); // true: 터미널에 포커스를 강제로 이동
                this.log('[Cursor Remote] Terminal shown, waiting 800ms for activation...');
                await new Promise(resolve => setTimeout(resolve, 800));
            } else {
                // 활성 터미널에 포커스
                this.log(`[Cursor Remote] Using existing terminal: ${terminal.name}`);
                terminal.show(true); // true: 터미널에 포커스를 강제로 이동
                this.log('[Cursor Remote] Terminal shown, waiting 500ms for activation...');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // VS Code 명령을 사용하여 터미널에 포커스 강제 이동
            this.log('[Cursor Remote] Executing workbench.action.terminal.focus command...');
            await vscode.commands.executeCommand('workbench.action.terminal.focus');
            await new Promise(resolve => setTimeout(resolve, 300)); // 추가 대기 시간
            
            // 터미널이 실제로 활성화되었는지 확인
            const activeTerminalAfterWait = vscode.window.activeTerminal;
            if (activeTerminalAfterWait?.name !== terminal.name) {
                this.log(`[Cursor Remote] ⚠️ Warning: Terminal may not be active. Expected: ${terminal.name}, Active: ${activeTerminalAfterWait?.name || 'null'}`);
                // 터미널이 활성화되지 않았어도 계속 진행 (터미널이 여러 개일 수 있음)
            } else {
                this.log(`[Cursor Remote] ✅ Terminal is active: ${terminal.name}`);
            }
            
            // 터미널에 텍스트 전송
            // execute가 false면 newline을 추가하지 않고, true면 Enter 키를 시뮬레이션
            if (execute) {
                // 터미널이 포커스를 받았는지 확인하기 위해 추가 대기
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 출력 자동 캡처: 명령어처럼 보이는 경우에만 자동으로 출력을 파일로 리다이렉트
                let commandToSend = text;
                if (outputFile) {
                    // 명령어인지 판단하는 로직
                    const trimmedText = text.trim();
                    const isCommand = this.isLikelyCommand(trimmedText);
                    
                    if (isCommand) {
                        // 명령에 자동으로 출력 캡처 추가 (tee를 사용하여 터미널과 파일에 동시 출력)
                        // 단, 이미 tee나 리다이렉트가 포함된 명령은 그대로 사용
                        if (!text.includes('| tee') && !text.includes('>>') && !text.includes('>')) {
                            // 명령을 래핑하여 출력을 자동으로 캡처
                            commandToSend = `(${text}) 2>&1 | tee -a "${outputFile}"`;
                            this.log(`[Cursor Remote] Auto-capturing output to: ${outputFile}`);
                        } else {
                            this.log(`[Cursor Remote] Command already has output redirection, using as-is`);
                        }
                    } else {
                        // 일반 텍스트는 그대로 전송 (자동 캡처하지 않음)
                        this.log(`[Cursor Remote] Text appears to be plain text, not capturing output`);
                    }
                }
                
                // 방법: 텍스트를 newline 없이 먼저 보내고, 
                // 다음 sendText 호출 시 이전 텍스트가 실행되는 특성을 이용
                terminal.sendText(commandToSend, false); // false: newline 없이 텍스트만 전송
                this.log('[Cursor Remote] Text sent, waiting for execution trigger...');
                
                // 충분한 대기 후 줄바꿈을 보내서 이전 텍스트 실행 트리거
                // 터미널이 텍스트를 완전히 처리할 시간을 줌
                await new Promise(resolve => setTimeout(resolve, 500));
                this.log(`[Cursor Remote] Sending execution trigger (newline)`);
                terminal.sendText('\n', false); // 줄바꿈 전송으로 이전 텍스트 실행 트리거
                this.log('[Cursor Remote] ✅ Text sent to terminal with execution (triggered by newline)');
                
                // 사용자 메시지를 모바일 앱으로 전송 (대화 히스토리용)
                if (this.wsServer) {
                    this.wsServer.send(JSON.stringify({
                        type: 'user_message',
                        text: text,
                        timestamp: new Date().toISOString()
                    }));
                }
            } else {
                // 텍스트만 전송 (newline 없이)
                this.log(`[Cursor Remote] Sending text to terminal without execution (no newline)`);
                terminal.sendText(text, false);
                this.log('[Cursor Remote] ✅ Text sent to terminal (no execution)');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.logError(`[Cursor Remote] Error in insertToTerminal: ${errorMsg}`);
            this.logError(`[Cursor Remote] Error stack: ${error instanceof Error ? error.stack : 'N/A'}`);
            throw new Error(`터미널 입력 실패: ${errorMsg}`);
        }
    }


    async insertToPrompt(text: string, execute: boolean = false): Promise<void> {
        this.log(`[Cursor Remote] insertToPrompt called - textLength: ${text.length}, execute: ${execute}`);
        
        try {
            // 1단계: 채팅 패널 열기 (기존 채팅창이 있으면 포커스, 없으면 새로 생성)
            this.log('[Cursor Remote] Opening chat panel');
            await vscode.commands.executeCommand('workbench.action.chat.open');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 2단계: 텍스트 입력 (클립보드 방식)
            this.log('[Cursor Remote] Preparing text for clipboard');
            await vscode.env.clipboard.writeText(text);
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 채팅 패널이 완전히 열릴 때까지 대기
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 붙여넣기
            this.log('[Cursor Remote] Pasting text from clipboard');
            await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
            await new Promise(resolve => setTimeout(resolve, 500));

            // Rules 기반 캡처는 자동으로 작동하므로 별도 모니터링 불필요
            this.log('[Cursor Remote] Rules-based chat capture is active - responses will be automatically sent via hooks');

            if (execute) {
                // 3단계: 채팅 패널 재확인 (입력 완료 대기)
                this.log('[Cursor Remote] Waiting for input to complete before execution');
                await new Promise(resolve => setTimeout(resolve, 300));

                // 4단계: 여러 방식으로 Enter 시뮬레이션 시도
                const submitted = await this.trySubmitChat();
                
                if (submitted) {
                    this.log('[Cursor Remote] ✅ Prompt execution attempted successfully');
                } else {
                    this.logError('[Cursor Remote] ❌ Could not execute prompt. Tried all available methods.');
                    this.logError('[Cursor Remote] 💡 Note: The text was inserted but execution failed. You may need to manually press Enter.');
                }
            }
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.logError(`Error in insertToPrompt: ${errorMsg}`);
            throw new Error(`프롬프트 입력 실패: ${errorMsg}`);
        }
    }

    private async trySubmitChat(): Promise<boolean> {
        let submitted = false;

        // 방법 1: 채팅 제출 명령어들 시도 (가장 안전한 방법)
        const submitCommands = [
            'workbench.action.chat.acceptInput', // 가장 일반적인 명령어
            'cursor.chat.submit',
            'cursor.chat.send',
            'anysphere.chat.submit',
            'anysphere.chat.send',
            'workbench.action.chat.submit',
            'workbench.action.chat.send',
        ];

        for (const cmd of submitCommands) {
            try {
                this.log(`[Cursor Remote] Trying submit command: ${cmd}`);
                await vscode.commands.executeCommand(cmd);
                await new Promise(resolve => setTimeout(resolve, 300));
                submitted = true;
                this.log(`[Cursor Remote] ✅ Chat submission successful: ${cmd}`);
                break;
            } catch (e) {
                this.log(`[Cursor Remote] ❌ Command ${cmd} failed: ${e}`);
                continue;
            }
        }

        // 방법 2: 직접 Enter 키 입력 시뮬레이션 (명령어가 실패한 경우만)
        if (!submitted) {
            try {
                this.log('[Cursor Remote] Trying Enter key simulation');
                // 채팅 패널 재확인
                await vscode.commands.executeCommand('workbench.action.chat.open');
                await new Promise(resolve => setTimeout(resolve, 200));
                // Enter 키 시뮬레이션
                await vscode.commands.executeCommand('type', { text: '\n' });
                await new Promise(resolve => setTimeout(resolve, 300));
                submitted = true;
                this.log('[Cursor Remote] ✅ Enter key simulation successful');
            } catch (e) {
                this.log(`[Cursor Remote] ⚠️ Enter key simulation failed: ${e}`);
            }
        }

        return submitted;
    }

    async executeCommand(command: string, ...args: any[]): Promise<any> {
        return await vscode.commands.executeCommand(command, ...args);
    }

    async getActiveFile(): Promise<{ path: string; content: string } | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document) {
            return null;
        }

        return {
            path: editor.document.fileName,
            content: editor.document.getText()
        };
    }

    async saveFile(): Promise<{ success: boolean; path?: string }> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document) {
            throw new Error('No active editor');
        }

        await editor.document.save();
        return {
            success: true,
            path: editor.document.fileName
        };
    }

    async getAIResponse(): Promise<string> {
        // Cursor AI 응답을 가져오는 로직
        // 실제 구현은 Cursor API에 따라 달라질 수 있음
        // TODO: Cursor AI API 연동
        // 현재는 채팅 히스토리나 최근 AI 응답을 가져오는 방식으로 구현 가능
        return 'AI response placeholder - Cursor AI API integration needed';
    }

    async stopPrompt(): Promise<{ success: boolean }> {
        this.log('[Cursor Remote] stopPrompt called');
        try {
            // Cursor IDE의 프롬프트 중지 명령 시도
            const stopCommands = [
                'cursor.chat.stop',
                'cursor.chat.cancel',
                'workbench.action.chat.stop',
                'workbench.action.chat.cancel',
                'workbench.action.interrupt',
                'workbench.action.terminal.interrupt',
            ];

            for (const cmd of stopCommands) {
                try {
                    this.log(`[Cursor Remote] Trying stop command: ${cmd}`);
                    await vscode.commands.executeCommand(cmd);
                    this.log(`[Cursor Remote] ✅ Successfully executed stop command: ${cmd}`);
                    return { success: true };
                } catch (e) {
                    this.log(`[Cursor Remote] ❌ Stop command ${cmd} failed: ${e}`);
                    continue;
                }
            }

            // 명령이 없으면 Escape 키 시뮬레이션 시도
            try {
                this.log('[Cursor Remote] Trying Escape key simulation');
                // Escape 키를 type 명령으로 시뮬레이션
                await vscode.commands.executeCommand('type', { text: '\u001b' }); // Escape character
                this.log('[Cursor Remote] ✅ Successfully simulated Escape key');
                return { success: true };
            } catch (e) {
                this.log(`[Cursor Remote] ❌ Escape key simulation failed: ${e}`);
            }

            // 마지막 시도: 채팅 패널 닫기
            try {
                this.log('[Cursor Remote] Trying to close active editor as fallback');
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                this.log('[Cursor Remote] ✅ Closed active editor as fallback');
                return { success: true };
            } catch (e) {
                this.logError('[Cursor Remote] ❌ All stop methods failed', e);
                return { success: false };
            }
        } catch (error) {
            this.logError('[Cursor Remote] ❌ Error in stopPrompt', error);
            return { success: false };
        }
    }

    async executeAction(action: string): Promise<{ success: boolean }> {
        try {
            // Cursor IDE의 액션 실행 명령
            // action은 'undo', 'keep', 'accept', 'reject' 등
            const actionCommands = [
                `cursor.chat.${action}`,
                `workbench.action.chat.${action}`,
                `cursor.action.${action}`,
            ];

            for (const cmd of actionCommands) {
                try {
                    await vscode.commands.executeCommand(cmd);
                    return { success: true };
                } catch (e) {
                    continue;
                }
            }

            // 일반적인 액션 명령 시도
            try {
                await vscode.commands.executeCommand(action);
                return { success: true };
            } catch (e) {
                // 액션 버튼 클릭 시뮬레이션
                // Cursor IDE의 UI에서 액션 버튼을 찾아 클릭하는 것은 제한적
                // 대신 키보드 단축키나 명령으로 처리
                return { success: false };
            }
        } catch (error) {
            return { success: false };
        }
    }

    dispose() {
        // 정리 작업이 필요한 경우 여기에 추가
    }

    // 터미널 출력을 자동으로 캡처하기 위한 래퍼 스크립트 생성
    // 사용자는 터미널에서 직접 입력하고 출력을 볼 수 있으면서, 동시에 모바일 앱에도 전송됨
    async setupTerminalOutputCapture(): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('워크스페이스가 열려있지 않습니다');
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const outputFile = path.join(workspaceRoot, '.cursor-remote-terminal-output.log');
        const wrapperScript = path.join(workspaceRoot, '.cursor-remote-gemini-wrapper.sh');

        // 래퍼 스크립트 생성 (tee를 사용하여 터미널과 파일에 동시 출력)
        const scriptContent = `#!/bin/bash
# Cursor Remote Gemini CLI Wrapper
# 터미널에도 출력하고 파일에도 저장하여 모바일 앱으로 전송

OUTPUT_FILE="${outputFile}"
gemini-cli "$@" 2>&1 | tee -a "$OUTPUT_FILE"
`;

        fs.writeFileSync(wrapperScript, scriptContent);
        fs.chmodSync(wrapperScript, 0o755);

        this.log(`[Cursor Remote] Wrapper script created: ${wrapperScript}`);
        this.log(`[Cursor Remote] Output file: ${outputFile}`);
        
        return wrapperScript;
    }
}
