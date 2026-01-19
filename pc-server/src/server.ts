import WebSocket from 'ws';
import express from 'express';
import { getLocalIPAddress } from './utils';

const PORT = 8766;
const HTTP_PORT = 8765;

// WebSocket 서버
const wss = new WebSocket.Server({ port: PORT });

// HTTP 서버 (Extension과 통신)
const app = express();
app.use(express.json());

// WebSocket 클라이언트 관리
const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
    console.log('Mobile client connected');
    clients.add(ws);

    ws.on('message', (message: string) => {
        console.log('Received from mobile:', message.toString());
        
        // Extension으로 메시지 전달 (HTTP POST)
        forwardToExtension(message.toString());
    });

    ws.on('close', () => {
        console.log('Mobile client disconnected');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    // 연결 성공 메시지
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Cursor Remote server'
    }));
});

// Extension에서 오는 메시지를 모바일로 전달
app.post('/', (req, res) => {
    const message = JSON.stringify(req.body);
    console.log('Received from extension:', message);
    
    // 모든 모바일 클라이언트에 전달
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });

    res.json({ success: true });
});

app.listen(HTTP_PORT, () => {
    console.log(`HTTP server listening on port ${HTTP_PORT}`);
});

function forwardToExtension(message: string) {
    // Extension의 HTTP 엔드포인트로 전달
    // 실제 구현은 Extension의 HTTP 서버 주소에 따라 달라짐
    // TODO: Extension HTTP 서버 연동
    console.log('Forwarding to extension:', message);
}

// 서버 시작
const localIP = getLocalIPAddress();
console.log(`\n✅ Cursor Remote Server started!`);
console.log(`📱 Mobile app should connect to: ${localIP}:${PORT}`);
console.log(`🔌 WebSocket server: ws://${localIP}:${PORT}`);
console.log(`🌐 HTTP server: http://${localIP}:${HTTP_PORT}\n`);
