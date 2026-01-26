import WebSocket from 'ws';
import express from 'express';
import { getLocalIPAddress } from './utils';
import { CONFIG } from './config';

// Relay 서버 URL
const RELAY_SERVER_URL = CONFIG.RELAY_SERVER_URL;

// HTTP 서버
const app = express();
app.use(express.json());

let extensionClient: WebSocket | null = null;
let localMobileClient: WebSocket | null = null; // 로컬 모바일 클라이언트
let sessionId: string | null = null;
let deviceId: string = `pc-${Date.now()}`;
let pollInterval: NodeJS.Timeout | null = null;
let isConnected = false;
let isLocalMode = false; // 로컬 모드 여부

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

    extensionClient.on('message', async (message: Buffer) => {
        const messageStr = message.toString();
        console.log('Received from extension:', messageStr);
        
        // 로컬 모드: 모바일 클라이언트로 직접 전달
        if (isLocalMode && localMobileClient && localMobileClient.readyState === WebSocket.OPEN) {
            localMobileClient.send(messageStr);
        }
        // 릴레이 모드: relay 서버로 전달
        else if (sessionId && isConnected) {
            await sendToRelay(messageStr);
        }
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

// Relay 서버로 메시지 전송
async function sendToRelay(message: string) {
    if (!sessionId) {
        console.error('No session ID');
        return;
    }
    
    try {
        const parsed = JSON.parse(message);
        const response = await fetch(`${RELAY_SERVER_URL}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                deviceId,
                deviceType: 'pc',
                type: parsed.type || 'message',
                data: parsed,
            }),
        });
        
        const data = await response.json() as any;
        if (data.success) {
            console.log('✅ Message sent to relay');
        } else {
            console.error('❌ Failed to send to relay:', data.error);
        }
    } catch (error) {
        console.error('Error sending to relay:', error);
    }
}

// 로컬 모바일 클라이언트로 메시지 전송
function sendToLocalMobile(message: string) {
    if (localMobileClient && localMobileClient.readyState === WebSocket.OPEN) {
        localMobileClient.send(message);
        console.log('✅ Message sent to local mobile client');
    } else {
        console.error('❌ Local mobile client not connected');
    }
}

// Relay 서버에서 메시지 폴링
async function pollMessages() {
    if (!sessionId || !isConnected) {
        console.log(`⚠️ Polling skipped: sessionId=${sessionId}, isConnected=${isConnected}`);
        return;
    }
    
    try {
        const pollUrl = `${RELAY_SERVER_URL}/api/poll?sessionId=${sessionId}&deviceType=pc`;
        const response = await fetch(pollUrl);
        
        const data = await response.json() as any;
        if (data.success && data.data?.messages) {
            const messages = data.data.messages;
            if (messages.length > 0) {
                console.log(`📥 Received ${messages.length} message(s) from relay`);
            }
            
            for (const msg of messages) {
                console.log('📨 Message from relay:', JSON.stringify(msg, null, 2));
                
                // Extension으로 전달
                if (extensionClient && extensionClient.readyState === WebSocket.OPEN) {
                    const commandData = msg.data || msg;
                    console.log(`📤 Sending to extension:`, JSON.stringify(commandData, null, 2));
                    extensionClient.send(JSON.stringify(commandData));
                } else {
                    console.error(`❌ Extension not connected! readyState: ${extensionClient?.readyState}`);
                }
            }
        } else if (!data.success) {
            console.error(`❌ Poll failed:`, data.error);
        }
    } catch (error) {
        console.error('❌ Polling error:', error);
        if (error instanceof Error) {
            console.error(`   Error: ${error.message}`);
        }
    }
}

// 세션에 연결
async function connectToSession(sid: string) {
    console.log(`\n🔗 Connecting to session ${sid}...`);
    console.log(`   Relay Server: ${RELAY_SERVER_URL}`);
    console.log(`   Device ID: ${deviceId}`);
    
    try {
        const response = await fetch(`${RELAY_SERVER_URL}/api/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: sid,
                deviceId,
                deviceType: 'pc',
            }),
        });
        
        console.log(`   HTTP Status: ${response.status}`);
        const data = await response.json() as any;
        console.log(`   Response:`, JSON.stringify(data, null, 2));
        
        if (data.success) {
            sessionId = sid;
            isConnected = true;
            isLocalMode = false; // 릴레이 모드로 설정
            console.log(`\n✅ Connected to session: ${sessionId}`);
            console.log(`🔄 Starting message polling...`);
            
            // 폴링 시작
            startPolling();
            console.log(`✅ Message polling started (every ${CONFIG.POLL_INTERVAL / 1000} seconds)`);
        } else {
            console.error(`\n❌ Failed to connect: ${data.error}`);
            if (data.error) {
                console.error(`   Error details:`, data);
            }
        }
    } catch (error) {
        console.error('\n❌ Error connecting to session:', error);
        if (error instanceof Error) {
            console.error(`   Error message: ${error.message}`);
            console.error(`   Error stack: ${error.stack}`);
        }
    }
}

// 새 세션 생성
async function createSession(): Promise<string | null> {
    console.log('Creating new session...');
    
    try {
        const response = await fetch(`${RELAY_SERVER_URL}/api/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        
        const data = await response.json() as any;
        if (data.success && data.data?.sessionId) {
            console.log(`✅ Session created: ${data.data.sessionId}`);
            return data.data.sessionId;
        } else {
            console.error(`❌ Failed to create session: ${data.error}`);
            return null;
        }
    } catch (error) {
        console.error('Error creating session:', error);
        return null;
    }
}

function startPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
    pollInterval = setInterval(pollMessages, CONFIG.POLL_INTERVAL);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// HTTP 엔드포인트
app.get('/status', (req, res) => {
    res.json({
        relayServer: RELAY_SERVER_URL,
        sessionId,
        isConnected,
        extensionConnected: extensionClient !== null && extensionClient.readyState === WebSocket.OPEN
    });
});

// 세션 생성 엔드포인트
app.post('/session/create', async (req, res) => {
    const newSessionId = await createSession();
    if (newSessionId) {
        await connectToSession(newSessionId);
        res.json({ success: true, sessionId: newSessionId });
    } else {
        res.status(500).json({ success: false, error: 'Failed to create session' });
    }
});

// 세션 연결 엔드포인트
app.post('/session/connect', async (req, res) => {
    const { sessionId: sid } = req.body;
    if (!sid) {
        res.status(400).json({ success: false, error: 'sessionId is required' });
        return;
    }
    
    await connectToSession(sid);
    res.json({ success: true, sessionId: sid, isConnected });
});

// 연결 해제 엔드포인트
app.post('/session/disconnect', (req, res) => {
    stopPolling();
    sessionId = null;
    isConnected = false;
    res.json({ success: true });
});

// 로컬 WebSocket 서버 (모바일 앱 직접 연결용)
const localWSServer = new WebSocket.Server({ port: CONFIG.LOCAL_WS_PORT });

localWSServer.on('error', (error: Error & { code?: string }) => {
    if (error.code === 'EADDRINUSE' || error.code === 'EPERM') {
        console.error(`\n❌ Port ${CONFIG.LOCAL_WS_PORT} is already in use or permission denied.`);
        console.error(`   This port is required for mobile app connection.`);
        console.error(`   Port ${CONFIG.LOCAL_WS_PORT} is currently used by Cursor Extension.`);
        console.error(`   Please restart Cursor IDE or disable the extension temporarily.`);
        console.error(`   To find the process: lsof -i :${CONFIG.LOCAL_WS_PORT}\n`);
        // 서버는 계속 실행하되, 로컬 모드는 사용 불가
    } else {
        console.error('Local WebSocket server error:', error);
    }
});

localWSServer.on('connection', (ws: WebSocket) => {
    console.log('📱 Local mobile client connected');
    localMobileClient = ws;
    isLocalMode = true;
    isConnected = true;
    
    // 기존 릴레이 연결 정리
    if (sessionId) {
        stopPolling();
        sessionId = null;
    }
    
    ws.on('message', (message: Buffer) => {
        const messageStr = message.toString();
        console.log('Received from local mobile:', messageStr);
        
        // Extension으로 전달
        if (extensionClient && extensionClient.readyState === WebSocket.OPEN) {
            try {
                const commandData = JSON.parse(messageStr);
                extensionClient.send(JSON.stringify(commandData));
            } catch (error) {
                console.error('Error parsing message from mobile:', error);
            }
        }
    });
    
    ws.on('close', () => {
        console.log('📱 Local mobile client disconnected');
        localMobileClient = null;
        isLocalMode = false;
        isConnected = false;
    });
    
    ws.on('error', (error) => {
        console.error('Local mobile client error:', error);
    });
});

const httpServer = app.listen(CONFIG.HTTP_PORT, () => {
    console.log(`HTTP server listening on port ${CONFIG.HTTP_PORT}`);
});

httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' || error.code === 'EPERM') {
        console.error(`\n❌ Port ${CONFIG.HTTP_PORT} is already in use or permission denied.`);
        console.error(`   This port is required for HTTP API.`);
        console.error(`   To find the process: lsof -i :${CONFIG.HTTP_PORT}\n`);
        // 서버는 계속 실행하되, HTTP API는 사용 불가
    } else {
        console.error('HTTP server error:', error);
    }
});

// Extension 연결 시도
connectToExtension();

// CLI 인자로 세션 ID가 제공되면 해당 세션에 연결
const args = process.argv.slice(2);
if (args.length > 0 && args[0]) {
    const providedSessionId = args[0];
    console.log(`\n🔗 Session ID provided: ${providedSessionId}`);
    console.log(`⏳ Connecting to relay server in 2 seconds...`);
    setTimeout(() => {
        console.log(`🔄 Starting connection to session: ${providedSessionId}`);
        connectToSession(providedSessionId).catch((error) => {
            console.error(`❌ Failed to connect to session: ${error}`);
        });
    }, 2000);
}

// 서버 시작
const localIP = getLocalIPAddress();
console.log(`\n✅ Cursor Remote PC Server started!`);
console.log(`🌐 Relay Server: ${RELAY_SERVER_URL}`);
console.log(`🌐 Local HTTP: http://${localIP}:${CONFIG.HTTP_PORT}`);
console.log(`🔗 Extension WebSocket: ws://localhost:${CONFIG.EXTENSION_WS_PORT}`);
console.log(`📱 Local Mobile WebSocket: ws://${localIP}:${CONFIG.LOCAL_WS_PORT}`);
console.log(`\n💡 Usage:`);
console.log(`   - Local mode: Connect mobile app to ws://${localIP}:${CONFIG.LOCAL_WS_PORT}`);
console.log(`   - Relay mode:`);
console.log(`     - Create new session: curl -X POST http://localhost:${CONFIG.HTTP_PORT}/session/create`);
console.log(`     - Connect to session: curl -X POST http://localhost:${CONFIG.HTTP_PORT}/session/connect -H "Content-Type: application/json" -d '{"sessionId": "ABC123"}'`);
console.log(`   - Check status: curl http://localhost:${CONFIG.HTTP_PORT}/status\n`);
