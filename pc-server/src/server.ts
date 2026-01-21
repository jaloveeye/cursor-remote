import WebSocket from 'ws';
import express from 'express';
import { getLocalIPAddress } from './utils';
import { CONFIG } from './config';

// WebSocket 서버 (모바일 앱과 통신)
const wss = new WebSocket.Server({ port: CONFIG.LOCAL_WS_PORT });

// HTTP 서버 (Extension과 통신 - 향후 확장용)
const app = express();
app.use(express.json());

// WebSocket 클라이언트 관리
const mobileClients = new Set<WebSocket>();
let extensionClient: WebSocket | null = null;

// Extension WebSocket 클라이언트 연결 (Extension이 서버를 열면 연결)
function connectToExtension() {
    if (extensionClient && extensionClient.readyState === WebSocket.OPEN) {
        return; // 이미 연결됨
    }

    const extensionUrl = `ws://localhost:${CONFIG.EXTENSION_WS_PORT}`;
    console.log(`Attempting to connect to extension at ${extensionUrl}...`);

    extensionClient = new WebSocket(extensionUrl);

    extensionClient.on('open', () => {
        console.log('✅ Connected to Cursor Extension');
    });

    extensionClient.on('message', (message: Buffer) => {
        const messageStr = message.toString();
        console.log('Received from extension:', messageStr);
        
        // 모든 모바일 클라이언트에 전달
        broadcastToMobile(messageStr);
    });

    extensionClient.on('close', () => {
        console.log('Extension connection closed. Reconnecting in 3 seconds...');
        extensionClient = null;
        setTimeout(connectToExtension, CONFIG.RECONNECT_DELAY);
    });

    extensionClient.on('error', (error) => {
        console.error('Extension connection error:', error);
        // Extension이 아직 시작되지 않았을 수 있으므로 재시도
        setTimeout(connectToExtension, CONFIG.RECONNECT_DELAY);
    });
}

// 모바일 클라이언트 연결 처리
wss.on('connection', (ws: WebSocket) => {
    console.log('📱 Mobile client connected');
    mobileClients.add(ws);

    ws.on('message', (message: Buffer) => {
        const messageStr = message.toString();
        console.log('Received from mobile:', messageStr);
        
        try {
            const command = JSON.parse(messageStr);
            
            // Extension으로 메시지 전달
            if (extensionClient && extensionClient.readyState === WebSocket.OPEN) {
                extensionClient.send(messageStr);
            } else {
                console.warn('Extension not connected. Attempting to connect...');
                connectToExtension();
                // Extension 연결 후 메시지 전송 시도
                setTimeout(() => {
                    if (extensionClient && extensionClient.readyState === WebSocket.OPEN) {
                        extensionClient.send(messageStr);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Extension not available'
                        }));
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });

    ws.on('close', () => {
        console.log('📱 Mobile client disconnected');
        mobileClients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('Mobile WebSocket error:', error);
    });

    // 연결 성공 메시지
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Cursor Remote server'
    }));
});

// 모바일 클라이언트에 브로드캐스트
function broadcastToMobile(message: string) {
    mobileClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// HTTP 엔드포인트 (Extension에서 사용 가능)
app.post('/', (req, res) => {
    const message = JSON.stringify(req.body);
    console.log('Received from extension (HTTP):', message);
    
    broadcastToMobile(message);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    res.json({
        mobileClients: mobileClients.size,
        extensionConnected: extensionClient !== null && extensionClient.readyState === WebSocket.OPEN
    });
});

app.listen(CONFIG.HTTP_PORT, () => {
    console.log(`HTTP server listening on port ${CONFIG.HTTP_PORT}`);
});

// Extension 연결 시도
connectToExtension();

// 서버 시작
const localIP = getLocalIPAddress();
console.log(`\n✅ Cursor Remote PC Server started!`);
console.log(`📱 Mobile app should connect to: ${localIP}:${CONFIG.LOCAL_WS_PORT}`);
console.log(`🔌 WebSocket server (Mobile): ws://${localIP}:${CONFIG.LOCAL_WS_PORT}`);
console.log(`🌐 HTTP server: http://${localIP}:${CONFIG.HTTP_PORT}`);
console.log(`🔗 Extension WebSocket: ws://localhost:${CONFIG.EXTENSION_WS_PORT}\n`);
