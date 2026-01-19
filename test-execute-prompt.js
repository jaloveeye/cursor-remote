#!/usr/bin/env node

/**
 * Execute Prompt 테스트 스크립트
 * Cursor Remote 확장 프로그램의 Execute Prompt 기능을 테스트합니다.
 */

const WebSocket = require('ws');

const SERVER_URL = process.argv[2] || 'ws://localhost:8766';

console.log(`🔌 Connecting to Cursor Remote Extension at ${SERVER_URL}...\n`);

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
    console.log('✅ Connected to Cursor Remote Extension\n');
    
    // 연결 성공 메시지 수신 대기
    setTimeout(() => {
        console.log('📤 Testing Execute Prompt functionality...\n');
        
        // Execute Prompt 테스트 명령
        const executePromptCommand = {
            type: 'insert_text',
            id: Date.now().toString(),
            text: 'Hello from test script! Please respond.',
            prompt: true,
            execute: true
        };
        
        console.log('Sending command:');
        console.log(JSON.stringify(executePromptCommand, null, 2));
        console.log('\n⏳ Waiting for response...\n');
        
        ws.send(JSON.stringify(executePromptCommand));
        
        // 10초 후 종료
        setTimeout(() => {
            console.log('\n✅ Test completed. Closing connection...');
            ws.close();
            process.exit(0);
        }, 10000);
    }, 1000);
});

ws.on('message', (message) => {
    try {
        const data = JSON.parse(message.toString());
        console.log('📥 Received response:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.type === 'command_result') {
            if (data.success) {
                console.log('\n✅ Command executed successfully!');
                if (data.message) {
                    console.log(`   Message: ${data.message}`);
                }
            } else {
                console.log('\n❌ Command failed!');
                if (data.error) {
                    console.log(`   Error: ${data.error}`);
                }
            }
        } else if (data.type === 'connected') {
            console.log(`\n✅ ${data.message}`);
        }
    } catch (e) {
        console.log('📥 Received (raw):', message.toString());
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. Cursor IDE is running');
    console.error('   2. Cursor Remote extension is installed and active');
    console.error('   3. Extension WebSocket server is running on port 8766');
    process.exit(1);
});

ws.on('close', () => {
    console.log('\n🔌 Connection closed');
});
