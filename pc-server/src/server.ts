import WebSocket from 'ws';
import express from 'express';
import { getLocalIPAddress, isPortAvailable } from './utils';
import { CONFIG } from './config';

// Relay 서버 URL
const RELAY_SERVER_URL = CONFIG.RELAY_SERVER_URL;

// HTTP 서버
const app = express();
app.use(express.json());

// 여러 Extension 인스턴스 관리
const extensionClients = new Map<string, WebSocket>(); // deviceId -> WebSocket
let activeExtensionId: string | null = null; // 현재 활성 Extension
let localMobileClient: WebSocket | null = null; // 로컬 모바일 클라이언트
let sessionId: string | null = null;
let deviceId: string = `pc-${Date.now()}`;
let pollInterval: NodeJS.Timeout | null = null;
let isConnected = false;
let isLocalMode = false; // 로컬 모드 여부

// Extension WebSocket 클라이언트 연결 (Extension이 서버를 열면 연결)
function connectToExtension() {
    // 이미 연결된 Extension이 있으면 재연결하지 않음 (여러 Extension 지원)
    const extensionUrl = `ws://localhost:${CONFIG.EXTENSION_WS_PORT}`;
    console.log(`Attempting to connect to extension at ${extensionUrl}...`);

    const extensionClient = new WebSocket(extensionUrl);
    const clientId = `ext-${Date.now()}`;
    extensionClients.set(clientId, extensionClient);

    extensionClient.on('open', () => {
        console.log(`✅ Connected to Cursor Extension (${clientId})`);
        // 가장 최근 연결된 Extension을 활성 Extension으로 설정
        activeExtensionId = clientId;
        
        // 기존 Extension이 있으면 정리 (선택사항 - 여러 Extension 지원 시 주석 처리)
        // extensionClients.forEach((ws, id) => {
        //     if (id !== clientId && ws.readyState === WebSocket.OPEN) {
        //         ws.close();
        //         extensionClients.delete(id);
        //     }
        // });
    });

    extensionClient.on('message', async (message: Buffer) => {
        const messageStr = message.toString();
        console.log('Received from extension:', messageStr);
        
        // 연결 메시지는 무시 (타이밍 문제로 인한 경고 방지)
        try {
            const parsed = JSON.parse(messageStr);
            if (parsed.type === 'connected' || parsed.message === 'Connected to Cursor Remote') {
                console.log('📥 Extension connection message received (ignored)');
                return;
            }
        } catch (e) {
            // JSON 파싱 실패 시 계속 진행
        }
        
        // 로컬 모바일 클라이언트가 연결되어 있으면 로컬 모드로 전달
        if (localMobileClient && localMobileClient.readyState === WebSocket.OPEN) {
            console.log('📤 Sending to local mobile client (local mode)');
            localMobileClient.send(messageStr);
        }
        // 릴레이 모드: relay 서버로 전달 (로컬 클라이언트가 없을 때만)
        else if (sessionId && isConnected && !localMobileClient) {
            console.log('📤 Sending to relay server (relay mode)');
            await sendToRelay(messageStr);
        } else {
            // 연결 메시지가 아닌 경우에만 경고
            console.log('⚠️ No destination for message - local client:', !!localMobileClient, 'relay session:', !!sessionId);
        }
    });

    extensionClient.on('close', () => {
        console.log(`Extension connection closed (${clientId}). Removing from active clients...`);
        extensionClients.delete(clientId);
        if (activeExtensionId === clientId) {
            activeExtensionId = null;
            // 다른 활성 Extension이 있으면 가장 최근 것으로 설정
            const activeClients = Array.from(extensionClients.entries())
                .filter(([_, ws]) => ws.readyState === WebSocket.OPEN);
            if (activeClients.length > 0) {
                activeExtensionId = activeClients[activeClients.length - 1][0];
                console.log(`Switched to active Extension: ${activeExtensionId}`);
            }
        }
        // 모든 Extension이 닫혔으면 재연결 시도
        if (extensionClients.size === 0) {
            setTimeout(connectToExtension, CONFIG.RECONNECT_DELAY);
        }
    });

    extensionClient.on('error', (error) => {
        console.error(`Extension connection error (${clientId}):`, error);
        extensionClients.delete(clientId);
        if (activeExtensionId === clientId) {
            activeExtensionId = null;
        }
        // Extension이 아직 시작되지 않았을 수 있으므로 재시도
        if (extensionClients.size === 0) {
            setTimeout(connectToExtension, CONFIG.RECONNECT_DELAY);
        }
    });
}

// 활성 Extension으로 메시지 전송
function sendToActiveExtension(message: string) {
    if (!activeExtensionId) {
        console.error('❌ No active Extension found');
        return false;
    }
    
    const extensionClient = extensionClients.get(activeExtensionId);
    if (extensionClient && extensionClient.readyState === WebSocket.OPEN) {
        extensionClient.send(message);
        return true;
    } else {
        console.error(`❌ Active Extension (${activeExtensionId}) not connected`);
        // 활성 Extension이 닫혔으면 다른 것으로 전환
        const activeClients = Array.from(extensionClients.entries())
            .filter(([_, ws]) => ws.readyState === WebSocket.OPEN);
        if (activeClients.length > 0) {
            activeExtensionId = activeClients[activeClients.length - 1][0];
            console.log(`Switched to active Extension: ${activeExtensionId}`);
            return sendToActiveExtension(message);
        }
        return false;
    }
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

// Extension으로 메시지 전송 (로컬 모드용)
function sendToExtension(message: string) {
    sendToActiveExtension(message);
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
                const commandData = msg.data || msg;
                console.log(`📤 Sending to extension:`, JSON.stringify(commandData, null, 2));
                if (!sendToActiveExtension(JSON.stringify(commandData))) {
                    console.error(`❌ Failed to send to Extension`);
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
        isLocalMode,
        localMobileConnected: localMobileClient !== null && localMobileClient.readyState === WebSocket.OPEN,
        extensionConnected: activeExtensionId !== null && extensionClients.has(activeExtensionId) && extensionClients.get(activeExtensionId)?.readyState === WebSocket.OPEN,
        activeExtensionCount: extensionClients.size
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
// 포트 사용 가능 여부 확인 후 서버 생성
let localWSServer: WebSocket.Server | null = null;

async function startLocalWebSocketServer() {
    const portAvailable = await isPortAvailable(CONFIG.LOCAL_WS_PORT);
    
    if (!portAvailable) {
        console.error(`\n❌ Port ${CONFIG.LOCAL_WS_PORT} is already in use or permission denied.`);
        console.error(`   This port is required for mobile app connection (local mode).`);
        console.error(`   To find the process: lsof -i :${CONFIG.LOCAL_WS_PORT}`);
        console.error(`   Please stop the process or restart Cursor IDE.\n`);
        return;
    }
    
    try {
        localWSServer = new WebSocket.Server({ port: CONFIG.LOCAL_WS_PORT });
        console.log(`✅ Local WebSocket server started on port ${CONFIG.LOCAL_WS_PORT}`);
        
        localWSServer.on('error', (error: Error & { code?: string }) => {
            console.error('Local WebSocket server error:', error);
        });
        
        setupLocalWebSocketHandlers();
    } catch (error) {
        console.error('Failed to create local WebSocket server:', error);
    }
}

function setupLocalWebSocketHandlers() {
    if (!localWSServer) return;

    localWSServer.on('connection', (ws: WebSocket) => {
        console.log('📱 Local mobile client connected');
        localMobileClient = ws;
        
        // 로컬 클라이언트가 연결되면 로컬 모드로 전환
        // 단, 세션 ID가 CLI 인자로 제공된 경우는 릴레이 모드 유지
        const args = process.argv.slice(2);
        if (args.length === 0 || !args[0]) {
            // 세션 ID가 없으면 로컬 모드로 전환
            isLocalMode = true;
            isConnected = true;
            
            // 기존 릴레이 연결 정리
            if (sessionId) {
                console.log('🔄 Switching from relay mode to local mode');
                stopPolling();
                sessionId = null;
            }
        } else {
            // 세션 ID가 있으면 릴레이 모드 유지 (로컬 클라이언트는 무시)
            console.log('⚠️  Session ID provided - Relay mode active. Local client will be ignored.');
            isLocalMode = false;
        }
        
        ws.on('message', (message: Buffer) => {
            const messageStr = message.toString();
            console.log('Received from local mobile:', messageStr);
            
            // Extension으로 전달
            try {
                const commandData = JSON.parse(messageStr);
                if (!sendToActiveExtension(JSON.stringify(commandData))) {
                    console.error('❌ Extension not connected');
                }
            } catch (error) {
                console.error('Error parsing message from mobile:', error);
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
}

// HTTP 서버 시작 (포트 사용 가능 여부 확인)
let httpServer: any = null;

async function startHttpServer() {
    const portAvailable = await isPortAvailable(CONFIG.HTTP_PORT);
    
    if (!portAvailable) {
        console.error(`\n❌ Port ${CONFIG.HTTP_PORT} is already in use or permission denied.`);
        console.error(`   This port is required for HTTP API.`);
        console.error(`   To find the process: lsof -i :${CONFIG.HTTP_PORT}`);
        console.error(`   Please stop the process or use a different port.\n`);
        return;
    }
    
    try {
        httpServer = app.listen(CONFIG.HTTP_PORT, () => {
            console.log(`✅ HTTP server listening on port ${CONFIG.HTTP_PORT}`);
        });
        
        httpServer.on('error', (error: NodeJS.ErrnoException) => {
            console.error('HTTP server error:', error);
        });
    } catch (error) {
        console.error('Failed to start HTTP server:', error);
    }
}

// 서버 초기화 및 시작
async function initializeServer() {
    // 포트 사용 가능 여부 확인 후 서버 시작
    await startLocalWebSocketServer();
    await startHttpServer();
    
    // Extension 연결 시도
    connectToExtension();
    
    // CLI 인자로 세션 ID가 제공되면 해당 세션에 연결
    const args = process.argv.slice(2);
    if (args.length > 0 && args[0]) {
        const providedSessionId = args[0];
        console.log(`\n🔗 Session ID provided: ${providedSessionId}`);
        console.log(`⚠️  Relay mode will be activated. Local mode will be disabled.`);
        console.log(`⏳ Connecting to relay server in 2 seconds...`);
        setTimeout(() => {
            console.log(`🔄 Starting connection to session: ${providedSessionId}`);
            connectToSession(providedSessionId).catch((error) => {
                console.error(`❌ Failed to connect to session: ${error}`);
            });
        }, 2000);
    } else {
        console.log(`\n💡 No session ID provided - Local mode is available`);
        console.log(`   To use relay mode, start with: npm start <SESSION_ID>`);
    }
    
    // 서버 시작 메시지
    const localIP = getLocalIPAddress();
    console.log(`\n✅ Cursor Remote PC Server started!`);
    console.log(`🌐 Relay Server: ${RELAY_SERVER_URL}`);
    if (httpServer) {
        console.log(`🌐 Local HTTP: http://${localIP}:${CONFIG.HTTP_PORT}`);
    } else {
        console.log(`⚠️  HTTP server not started (port ${CONFIG.HTTP_PORT} unavailable)`);
    }
    console.log(`🔗 Extension WebSocket: ws://localhost:${CONFIG.EXTENSION_WS_PORT}`);
    if (localWSServer) {
        console.log(`📱 Local Mobile WebSocket: ws://${localIP}:${CONFIG.LOCAL_WS_PORT}`);
    } else {
        console.log(`⚠️  Local WebSocket server not started (port ${CONFIG.LOCAL_WS_PORT} unavailable)`);
        console.log(`   Local mode is not available. Use relay mode instead.`);
    }
}

// 서버 초기화 실행
initializeServer().then(() => {
    const localIP = getLocalIPAddress();
    console.log(`\n💡 Usage:`);
    console.log(`   - Local mode: Connect mobile app to ws://${localIP}:${CONFIG.LOCAL_WS_PORT}`);
    console.log(`   - Relay mode:`);
    console.log(`     - Create new session: curl -X POST http://localhost:${CONFIG.HTTP_PORT}/session/create`);
    console.log(`     - Connect to session: curl -X POST http://localhost:${CONFIG.HTTP_PORT}/session/connect -H "Content-Type: application/json" -d '{"sessionId": "ABC123"}'`);
    console.log(`   - Check status: curl http://localhost:${CONFIG.HTTP_PORT}/status\n`);
}).catch((error) => {
    console.error('Failed to initialize server:', error);
});
