#!/usr/bin/env node

/**
 * Cursor CLI - Command line interface for Cursor Remote
 * 
 * Usage:
 *   cursor-chat "프롬프트"              # 채팅에 프롬프트 입력
 *   cursor-chat "프롬프트" --execute   # 프롬프트 입력 및 실행
 *   cursor-chat --stop                 # 실행 중인 프롬프트 중지
 */

import { Command } from 'commander';
import WebSocket from 'ws';
import * as readline from 'readline';

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
  .option('-h, --host <host>', 'WebSocket 서버 호스트', 'localhost')
  .option('-q, --quiet', '조용한 모드 (에러만 출력)')
  .action(async (prompt: string | undefined, options) => {
    const port = parseInt(options.port);
    const host = options.host;
    const url = `ws://${host}:${port}`;
    const quiet = options.quiet || false;

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
    await sendPrompt(url, prompt, execute, quiet);
  });

// Stop 명령
program
  .command('stop')
  .description('실행 중인 프롬프트 중지')
  .option('-p, --port <port>', 'WebSocket 서버 포트', '8766')
  .option('-h, --host <host>', 'WebSocket 서버 호스트', 'localhost')
  .option('-q, --quiet', '조용한 모드 (에러만 출력)')
  .action(async (options) => {
    const port = parseInt(options.port);
    const host = options.host;
    const url = `ws://${host}:${port}`;
    await sendStopCommand(url, options.quiet || false);
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
async function sendPrompt(url: string, text: string, execute: boolean, quiet: boolean = false): Promise<void> {
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
