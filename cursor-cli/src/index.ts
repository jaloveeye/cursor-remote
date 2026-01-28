#!/usr/bin/env node

/**
 * Cursor CLI - Command line interface for Cursor Remote
 * 
 * Usage:
 *   cursor-chat "프롬프트"              # 채팅에 프롬프트 입력
 *   cursor-chat "프롬프트" --execute   # 프롬프트 입력 및 실행
 *   cursor-chat --stop                 # 실행 중인 프롬프트 중지
 *   cursor-chat --last "프롬프트"      # 마지막 세션으로 접속
 */

import { Command } from 'commander';
import WebSocket from 'ws';
import * as readline from 'readline';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

// 세션 정보 저장 파일 경로
const SESSION_FILE = path.join(os.homedir(), '.cursor-chat-session.json');

interface SessionInfo {
    host: string;
    port: number;
    lastConnected: string;
    connectionCount: number;
}

// 세션 정보 로드
function loadSession(): SessionInfo | null {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            const data = fs.readFileSync(SESSION_FILE, 'utf-8');
            return JSON.parse(data) as SessionInfo;
        }
    } catch (error) {
        // 파일이 없거나 파싱 실패
    }
    return null;
}

// 세션 정보 저장
function saveSession(host: string, port: number): void {
    try {
        const existingSession = loadSession();
        const session: SessionInfo = {
            host,
            port,
            lastConnected: new Date().toISOString(),
            connectionCount: (existingSession?.connectionCount || 0) + 1
        };
        fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    } catch (error) {
        // 저장 실패는 무시
    }
}

// 마지막 세션 정보 표시
function showLastSession(quiet: boolean = false): SessionInfo | null {
    const session = loadSession();
    if (session && !quiet) {
        const lastDate = new Date(session.lastConnected);
        const timeAgo = getTimeAgo(lastDate);
        console.log('');
        console.log('📋 마지막 접속 세션:');
        console.log(`   호스트: ${session.host}:${session.port}`);
        console.log(`   접속 시간: ${lastDate.toLocaleString()} (${timeAgo})`);
        console.log(`   총 접속 횟수: ${session.connectionCount}회`);
        console.log('');
        console.log('💡 --last 또는 -l 옵션으로 마지막 세션에 빠르게 접속할 수 있습니다.');
        console.log('');
    }
    return session;
}

// 시간 경과 표시
function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}일 전`;
    if (diffHours > 0) return `${diffHours}시간 전`;
    if (diffMins > 0) return `${diffMins}분 전`;
    return '방금 전';
}

const program = new Command();

program
  .name('cursor-chat')
  .description('CLI client for Cursor Remote - Control Cursor IDE chat from command line')
  .version('1.0.0');

// 기본 명령: 프롬프트 입력 (기본적으로 자동 실행)
program
  .argument('[prompt]', '프롬프트 텍스트')
  .option('-e, --execute', '프롬프트를 입력하고 자동 실행 (기본값: true)', true)
  .option('--no-execute', '프롬프트만 입력하고 실행하지 않음')
  .option('-s, --stop', '실행 중인 프롬프트 중지')
  .option('-p, --port <port>', 'WebSocket 서버 포트', '8766')
  .option('-H, --host <host>', 'WebSocket 서버 호스트', 'localhost')
  .option('-l, --last', '마지막 접속 세션으로 접속')
  .option('-q, --quiet', '조용한 모드 (에러만 출력)')
  .option('--show-session', '마지막 세션 정보만 표시')
  .action(async (prompt: string | undefined, options) => {
    const quiet = options.quiet || false;

    // 세션 정보만 표시
    if (options.showSession) {
      const session = showLastSession(false);
      if (!session) {
        console.log('📋 저장된 세션 정보가 없습니다.');
      }
      return;
    }

    // --last 옵션: 마지막 세션 정보 사용
    let host = options.host || 'localhost';
    let port = parseInt(options.port || '8766');

    if (options.last) {
      const session = loadSession();
      if (session) {
        host = session.host;
        port = session.port;
        if (!quiet) {
          console.log(`📋 마지막 세션 사용: ${host}:${port}`);
        }
      } else {
        if (!quiet) {
          console.log('⚠️ 저장된 세션이 없습니다. 기본값 사용: localhost:8766');
        }
      }
    } else if (!quiet && !options.stop && !prompt) {
      // 프롬프트 없이 실행 시 마지막 세션 정보 표시
      showLastSession(quiet);
    }

    const url = `ws://${host}:${port}`;

    if (options.stop) {
      await sendStopCommand(url, quiet);
      return;
    }

    if (!prompt) {
      // 프롬프트가 제공되지 않으면 stdin에서 읽기
      prompt = await readStdin();
    }

    if (!prompt || prompt.trim().length === 0) {
      if (!quiet) {
        console.error('❌ Error: 프롬프트가 제공되지 않았습니다.');
        program.help();
      }
      process.exit(1);
    }

    // 기본적으로 execute는 true (Gemini CLI 통합을 위해)
    const execute = options.execute !== false;
    await sendPrompt(url, prompt, execute, quiet, host, port);
  });

// Stop 명령
program
  .command('stop')
  .description('실행 중인 프롬프트 중지')
  .option('-p, --port <port>', 'WebSocket 서버 포트', '8766')
  .option('-H, --host <host>', 'WebSocket 서버 호스트', 'localhost')
  .option('-l, --last', '마지막 접속 세션으로 접속')
  .option('-q, --quiet', '조용한 모드 (에러만 출력)')
  .action(async (options) => {
    const quiet = options.quiet || false;
    let host = options.host || 'localhost';
    let port = parseInt(options.port || '8766');

    if (options.last) {
      const session = loadSession();
      if (session) {
        host = session.host;
        port = session.port;
        if (!quiet) {
          console.log(`📋 마지막 세션 사용: ${host}:${port}`);
        }
      } else {
        if (!quiet) {
          console.log('⚠️ 저장된 세션이 없습니다. 기본값 사용: localhost:8766');
        }
      }
    }

    const url = `ws://${host}:${port}`;
    await sendStopCommand(url, quiet);
  });

// stdin에서 읽기
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    let input = '';
    rl.on('line', (line) => {
      input += line + '\n';
    });

    rl.on('close', () => {
      resolve(input.trim());
    });

    rl.on('error', (err) => {
      reject(err);
    });
  });
}

// 프롬프트 전송
async function sendPrompt(url: string, text: string, execute: boolean, quiet: boolean = false, host?: string, port?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!quiet) {
      console.log(`🔌 Connecting to Cursor Remote at ${url}...`);
    }

    const ws = new WebSocket(url);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, 5000);

    ws.on('open', () => {
      if (!quiet) {
        console.log('✅ Connected to Cursor Remote');
      }
      clearTimeout(timeout);

      // 연결 성공 시 세션 저장
      if (host && port) {
        saveSession(host, port);
      }

      const command = {
        type: 'insert_text',
        id: Date.now().toString(),
        text: text,
        prompt: true,
        execute: execute
      };

      if (!quiet) {
        console.log(`📤 Sending prompt${execute ? ' (with execution)' : ''}...`);
      }
      ws.send(JSON.stringify(command));
    });

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'connected') {
          if (!quiet) {
            console.log(`✅ ${data.message}`);
          }
          return;
        }

        if (data.type === 'command_result') {
          if (data.success) {
            if (!quiet) {
              console.log('✅ Command executed successfully');
              if (data.message) {
                console.log(`   ${data.message}`);
              }
            }
            ws.close();
            resolve();
          } else {
            const errorMsg = data.error || 'Unknown error';
            console.error(`❌ Command failed: ${errorMsg}`);
            ws.close();
            reject(new Error(errorMsg));
          }
        }
      } catch (e) {
        console.error('❌ Error parsing response:', e);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.error('❌ WebSocket error:', error.message);
      if (!quiet) {
        console.error('\n💡 Make sure:');
        console.error('   1. Cursor IDE is running');
        console.error('   2. Cursor Remote extension is installed and active');
        console.error('   3. Extension WebSocket server is running on port', url.split(':')[2]);
      }
      reject(error);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// Stop 명령 전송
async function sendStopCommand(url: string, quiet: boolean = false): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!quiet) {
      console.log(`🔌 Connecting to Cursor Remote at ${url}...`);
    }

    const ws = new WebSocket(url);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, 5000);

    ws.on('open', () => {
      if (!quiet) {
        console.log('✅ Connected to Cursor Remote');
      }
      clearTimeout(timeout);

      const command = {
        type: 'stop_prompt',
        id: Date.now().toString()
      };

      if (!quiet) {
        console.log('📤 Sending stop command...');
      }
      ws.send(JSON.stringify(command));
    });

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'connected') {
          if (!quiet) {
            console.log(`✅ ${data.message}`);
          }
          return;
        }

        if (data.type === 'command_result') {
          if (data.success) {
            if (!quiet) {
              console.log('✅ Stop command executed successfully');
            }
            ws.close();
            resolve();
          } else {
            const errorMsg = data.error || 'Unknown error';
            console.error(`❌ Stop command failed: ${errorMsg}`);
            ws.close();
            reject(new Error(errorMsg));
          }
        }
      } catch (e) {
        console.error('❌ Error parsing response:', e);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// 프로그램 실행
program.parse(process.argv);
