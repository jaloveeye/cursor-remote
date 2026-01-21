import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import { WebSocketServer } from './websocket-server';
import * as vscode from 'vscode';

export class CLIHandler {
    private outputChannel: vscode.OutputChannel | null = null;
    private wsServer: WebSocketServer | null = null;
    private currentProcess: child_process.ChildProcess | null = null;
    private workspaceRoot: string | null = null;
    private processingOutput: boolean = false;

    constructor(outputChannel?: vscode.OutputChannel, wsServer?: WebSocketServer, workspaceRoot?: string) {
        this.outputChannel = outputChannel || null;
        this.wsServer = wsServer || null;
        this.workspaceRoot = workspaceRoot || null;
    }

    private log(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] [CLI] ${message}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        }
        console.log(logMessage);
    }

    private logError(message: string, error?: any) {
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
    private async checkCLIInstalled(): Promise<boolean> {
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
    private async findCLICommand(): Promise<string> {
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
     */
    async sendPrompt(text: string, execute: boolean = true): Promise<void> {
        this.log(`sendPrompt called - textLength: ${text.length}, execute: ${execute}`);

        try {
            // CLI 설치 확인
            const isInstalled = await this.checkCLIInstalled();
            if (!isInstalled) {
                throw new Error('Cursor CLI (agent)가 설치되어 있지 않습니다. https://cursor.com/cli 에서 설치하세요.');
            }

            const cliCommand = await this.findCLICommand();
            this.log(`Using CLI command: ${cliCommand}`);

            // 실행 중인 프로세스가 있으면 종료 (하지만 새 프로세스 시작 전에 완전히 종료될 때까지 기다림)
            if (this.currentProcess) {
                this.log('Stopping previous CLI process');
                const previousProcess = this.currentProcess;
                this.currentProcess = null;
                
                // 프로세스 종료 (SIGTERM)
                previousProcess.kill('SIGTERM');
                
                // 프로세스가 완전히 종료될 때까지 최대 2초 대기
                await new Promise<void>((resolve) => {
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
            // -p: 비대화형 모드 (스크립트용)
            // --output-format json: JSON 형식으로 출력
            // --force: 자동 실행 (승인 없이)
            const args = ['-p', '--output-format', 'json', '--force', text];
            
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

            // stdout 수집
            if (this.currentProcess.stdout) {
                // 버퍼링 비활성화 (가능한 경우)
                this.currentProcess.stdout.setEncoding('utf8');
                
                this.currentProcess.stdout.on('data', (data: Buffer | string) => {
                    const chunk = typeof data === 'string' ? data : data.toString();
                    stdout += chunk;
                    this.log(`CLI stdout chunk (${chunk.length} bytes): ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);
                });
                
                this.currentProcess.stdout.on('end', () => {
                    this.log('CLI stdout stream ended');
                    stdoutEnded = true;
                    // 프로세스가 종료된 후에만 처리 (중복 방지)
                    if (processClosed) {
                        this.checkAndProcessOutput(stdout, stderr);
                    }
                });
                
                this.currentProcess.stdout.on('error', (error) => {
                    this.logError('CLI stdout stream error', error);
                });
            } else {
                this.logError('⚠️ CLI process stdout is null');
            }

            // stderr 수집
            if (this.currentProcess.stderr) {
                // 버퍼링 비활성화 (가능한 경우)
                this.currentProcess.stderr.setEncoding('utf8');
                
                this.currentProcess.stderr.on('data', (data: Buffer | string) => {
                    const chunk = typeof data === 'string' ? data : data.toString();
                    stderr += chunk;
                    this.logError(`CLI stderr chunk (${chunk.length} bytes): ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);
                });
                
                this.currentProcess.stderr.on('end', () => {
                    this.log('CLI stderr stream ended');
                    stderrEnded = true;
                    // 프로세스가 종료된 후에만 처리 (중복 방지)
                    if (processClosed) {
                        this.checkAndProcessOutput(stdout, stderr);
                    }
                });
                
                this.currentProcess.stderr.on('error', (error) => {
                    this.logError('CLI stderr stream error', error);
                });
            } else {
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
                this.checkAndProcessOutput(stdout, stderr);
                
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

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.logError(`Error in sendPrompt: ${errorMsg}`);
            throw new Error(`CLI 프롬프트 전송 실패: ${errorMsg}`);
        }
    }

    /**
     * CLI 출력 처리 및 WebSocket으로 전송
     */
    private checkAndProcessOutput(stdout: string, stderr: string) {
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
                
                this.log(`Extracted response text length: ${responseText.length}`);
                
                // WebSocket으로 응답 전송
                if (this.wsServer && responseText) {
                    const responseMessage = {
                        type: 'chat_response',
                        text: responseText,
                        timestamp: new Date().toISOString(),
                        source: 'cli'
                    };
                    
                    this.log(`Sending chat_response: ${JSON.stringify(responseMessage).substring(0, 200)}`);
                    this.wsServer.send(JSON.stringify(responseMessage));
                    this.log('✅ Chat response sent to WebSocket');
                } else {
                    this.logError('wsServer is null or responseText is empty');
                }
            } else {
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
                } else {
                    this.logError('wsServer is null or stdout is empty');
                }
            }
        } catch (parseError) {
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
        } finally {
            this.processingOutput = false;
        }
    }

    /**
     * 실행 중인 CLI 프로세스 중지
     */
    async stopPrompt(): Promise<{ success: boolean }> {
        this.log('stopPrompt called');
        
        if (this.currentProcess) {
            try {
                this.currentProcess.kill('SIGINT');
                this.currentProcess = null;
                this.log('CLI process stopped');
                return { success: true };
            } catch (error) {
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
}
