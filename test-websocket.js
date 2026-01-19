#!/usr/bin/env node

/**
 * 간단한 WebSocket 클라이언트 테스트 스크립트
 * PC 서버의 WebSocket 연결을 테스트합니다.
 */

const WebSocket = require('ws');

const SERVER_URL = process.argv[2] || 'ws://localhost:8766';

console.log(`Connecting to ${SERVER_URL}...`);

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
    console.log('✅ Connected to server');
    
    // 연결 성공 메시지 수신 대기
    setTimeout(() => {
        // 테스트 명령 전송
        console.log('\n📤 Sending test commands...\n');
        
        // 1. 텍스트 삽입 명령
        const insertTextCommand = {
            type: 'insert_text',
            id: Date.now().toString(),
            text: '// Test from WebSocket client\n'
        };
        console.log('1. Sending insert_text command:', JSON.stringify(insertTextCommand, null, 2));
        ws.send(JSON.stringify(insertTextCommand));
        
        // 2. 활성 파일 가져오기
        setTimeout(() => {
            const getFileCommand = {
                type: 'get_active_file',
                id: (Date.now() + 1).toString()
            };
            console.log('\n2. Sending get_active_file command:', JSON.stringify(getFileCommand, null, 2));
            ws.send(JSON.stringify(getFileCommand));
        }, 1000);
        
        // 3. 파일 저장 명령
        setTimeout(() => {
            const saveCommand = {
                type: 'save_file',
                id: (Date.now() + 2).toString()
            };
            console.log('\n3. Sending save_file command:', JSON.stringify(saveCommand, null, 2));
            ws.send(JSON.stringify(saveCommand));
        }, 2000);
        
        // 4. 종료
        setTimeout(() => {
            console.log('\n✅ Test completed. Closing connection...');
            ws.close();
            process.exit(0);
        }, 5000);
    }, 1000);
});

ws.on('message', (message) => {
    try {
        const data = JSON.parse(message.toString());
        console.log('\n📥 Received:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.log('\n📥 Received (raw):', message.toString());
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('\n🔌 Connection closed');
});

// 타임아웃 처리
setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
        console.error('❌ Connection timeout');
        process.exit(1);
    }
}, 5000);
