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

// 재연결 관리
let reconnectAttempts = 0;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectDelay = CONFIG.RECONNECT_DELAY;

// Extension WebSocket 클라이언트 연결 (Extension이 서버를 열면 연결)
function connectToExtension() {
    // 이미 연결된 Extension이 있으면 재연결하지 않음 (여러 Extension 지원)
    if (extensionClients.size > 0) {
        const activeClients = Array.from(extensionClients.entries())
            .filter(([_, ws]) => ws.readyState === WebSocket.OPEN);
        if (activeClients.length > 0) {
            console.log(`Extension already connected (${activeClients.length} active)`);
            return;
        }
    }
    
    // 재시도 횟수 확인
    if (CONFIG.RECONNECT_MAX_ATTEMPTS > 0 && reconnectAttempts >= CONFIG.RECONNECT_MAX_ATTEMPTS) {
        console.error(`❌ Maximum reconnection attempts (${CONFIG.RECONNECT_MAX_ATTEMPTS}) reached. Stopping reconnection.`);
        // 모바일 클라이언트에 에러 전송
        if (localMobileClient && localMobileClient.readyState === WebSocket.OPEN) {
            localMobileClient.send(JSON.stringify({
                type: 'error',
                message: `Extension connection failed after ${CONFIG.RECONNECT_MAX_ATTEMPTS} attempts`,
                errorType: 'max_retries_exceeded'
            }));
        }
        return;
    }
    
    const extensionUrl = `ws://localhost:${CONFIG.EXTENSION_WS_PORT}`;
    console.log(`Attempting to connect to extension at ${extensionUrl}... (Attempt ${reconnectAttempts + 1}${CONFIG.RECONNECT_MAX_ATTEMPTS > 0 ? `/${CONFIG.RECONNECT_MAX_ATTEMPTS}` : ''})`);

    const extensionClient = new WebSocket(extensionUrl);
    const clientId = `ext-${Date.now()}`;
    extensionClients.set(clientId, extensionClient);

    extensionClient.on('open', () => {
        console.log(`✅ Connected to Cursor Extension (${clientId})`);
        // 가장 최근 연결된 Extension을 활성 Extension으로 설정
        activeExtensionId = clientId;
        
        // 재연결 성공 시 재시도 카운터 및 딜레이 리셋
        reconnectAttempts = 0;
        reconnectDelay = CONFIG.RECONNECT_DELAY;
        
        // 모바일 클라이언트에 연결 성공 알림
        if (localMobileClient && localMobileClient.readyState === WebSocket.OPEN) {
            localMobileClient.send(JSON.stringify({
                type: 'connection_status',
                status: 'connected',
                source: 'extension',
                message: 'Extension connected successfully'
            }));
        }
        
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
            
            // 로그 메시지는 PC 서버 로그도 추가하여 전달
            if (parsed.type === 'log') {
                // PC 서버에서도 로그를 출력
                const logLevel = parsed.level || 'info';
                const logMessage = `[Extension] ${parsed.message}`;
                if (logLevel === 'error') {
                    console.error(logMessage);
                } else if (logLevel === 'warn') {
                    console.warn(logMessage);
                } else {
                    console.log(logMessage);
                }
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

    extensionClient.on('close', (code: number, reason: Buffer) => {
        const reasonStr = reason.toString();
        console.log(`Extension connection closed (${clientId}). Code: ${code}, Reason: ${reasonStr || 'none'}`);
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
        
        // 모바일 클라이언트에 연결 끊김 알림
        if (localMobileClient && localMobileClient.readyState === WebSocket.OPEN) {
            localMobileClient.send(JSON.stringify({
                type: 'connection_status',
                status: 'disconnected',
                source: 'extension',
                message: `Extension disconnected (code: ${code})`,
                errorCode: code
            }));
        }
        
        // 모든 Extension이 닫혔으면 재연결 시도
        if (extensionClients.size === 0) {
            scheduleReconnect();
        }
    });

    extensionClient.on('error', (error: Error & { code?: string }) => {
        const errorCode = error.code || 'UNKNOWN';
        const errorMessage = error.message || 'Unknown error';
        console.error(`Extension connection error (${clientId}):`, errorMessage, `Code: ${errorCode}`);
        extensionClients.delete(clientId);
        if (activeExtensionId === clientId) {
            activeExtensionId = null;
        }
        
        // 모바일 클라이언트에 에러 알림
        if (localMobileClient && localMobileClient.readyState === WebSocket.OPEN) {
            localMobileClient.send(JSON.stringify({
                type: 'connection_status',
                status: 'error',
                source: 'extension',
                message: `Extension connection error: ${errorMessage}`,
                errorCode: errorCode,
                errorType: getErrorType(errorCode)
            }));
        }
        
        // Extension이 아직 시작되지 않았을 수 있으므로 재시도
        if (extensionClients.size === 0) {
            scheduleReconnect();
        }
    });
}

// 에러 타입 분류
function getErrorType(errorCode: string): string {
    if (errorCode === 'ECONNREFUSED' || errorCode === 'EPERM') {
        return 'connection_refused';
    } else if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNRESET') {
        return 'timeout';
    } else if (errorCode === 'ENOTFOUND' || errorCode === 'EAI_AGAIN') {
        return 'dns_error';
    } else {
        return 'unknown';
    }
}

// 재연결 스케줄링 (지수 백오프)
function scheduleReconnect() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    
    reconnectAttempts++;
    const delay = Math.min(reconnectDelay, CONFIG.RECONNECT_MAX_DELAY);
    
    console.log(`🔄 Scheduling reconnection in ${delay}ms (Attempt ${reconnectAttempts}${CONFIG.RECONNECT_MAX_ATTEMPTS > 0 ? `/${CONFIG.RECONNECT_MAX_ATTEMPTS}` : ''})`);
    
    reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.floor(reconnectDelay * CONFIG.RECONNECT_BACKOFF_MULTIPLIER);
        connectToExtension();
    }, delay);
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

// 세션 자동 감지 (PC deviceId가 없는 세션 찾기)
// 모바일 클라이언트가 이미 연결한 세션을 찾아서 자동으로 연결
let lastSessionDiscoveryTime = 0;
const SESSION_DISCOVERY_INTERVAL = 10000; // 10초마다 한 번만

async function discoverSession(): Promise<string | null> {
    if (sessionId || isLocalMode) {
        return null; // 이미 세션이 있거나 로컬 모드면 스킵
    }
    
    // 너무 자주 호출하지 않도록 제한
    const now = Date.now();
    if (now - lastSessionDiscoveryTime < SESSION_DISCOVERY_INTERVAL) {
        return null;
    }
    lastSessionDiscoveryTime = now;
    
    try {
        // 릴레이 서버에 PC deviceId가 없는 세션 찾기 요청
        const discoveryUrl = `${RELAY_SERVER_URL}/api/sessions-waiting-for-pc`;
        const response = await fetch(discoveryUrl);
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json() as any;
        if (data.success && data.data?.sessions && data.data.sessions.length > 0) {
            // 첫 번째 세션에 자동으로 연결
            const foundSession = data.data.sessions[0];
            if (foundSession.sessionId) {
                console.log(`\n🔍 Found session waiting for PC: ${foundSession.sessionId}`);
                console.log(`🔄 Auto-connecting to session...`);
                return foundSession.sessionId;
            }
        }
        
        return null;
    } catch (error) {
        // 에러는 무시 (세션이 없을 수 있음)
        return null;
    }
}

// Relay 서버에서 메시지 폴링 및 세션 자동 감지
async function pollMessages() {
    // 세션 ID가 없으면 세션 자동 감지 시도
    if (!sessionId && !isLocalMode) {
        const discoveredSessionId = await discoverSession();
        if (discoveredSessionId) {
            await connectToSession(discoveredSessionId);
            return; // 연결 후 다음 폴링에서 메시지 처리
        }
        return; // 세션을 찾지 못했으면 다음 폴링에서 다시 시도
    }
    
    // 세션 ID가 있으면 기존 로직대로 메시지 폴링
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
    const extensionStatus = activeExtensionId !== null && extensionClients.has(activeExtensionId) 
        ? extensionClients.get(activeExtensionId)?.readyState === WebSocket.OPEN 
        : false;
    
    res.json({
        relayServer: RELAY_SERVER_URL,
        sessionId,
        isConnected,
        isLocalMode,
        localMobileConnected: localMobileClient !== null && localMobileClient.readyState === WebSocket.OPEN,
        extensionConnected: extensionStatus,
        activeExtensionCount: extensionClients.size,
        reconnectAttempts: reconnectAttempts,
        isReconnecting: reconnectTimer !== null,
        connections: {
            extension: {
                connected: extensionStatus,
                activeCount: extensionClients.size,
                activeExtensionId: activeExtensionId
            },
            mobile: {
                connected: localMobileClient !== null && localMobileClient.readyState === WebSocket.OPEN
            },
            relay: {
                connected: isConnected && !isLocalMode,
                sessionId: sessionId
            }
        }
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
        
        // PC 서버 로그를 클라이언트에 전송하는 헬퍼 함수
        const sendPCLog = (level: 'info' | 'warn' | 'error', message: string, error?: any) => {
            if (ws.readyState === WebSocket.OPEN) {
                const logData = {
                    type: 'log',
                    level,
                    message,
                    timestamp: new Date().toISOString(),
                    source: 'pc-server',
                    ...(error && { error: error instanceof Error ? error.message : String(error) })
                };
                ws.send(JSON.stringify(logData));
            }
        };
        
        // PC 서버 로그를 전송
        sendPCLog('info', 'PC Server connected - Ready to receive commands');
        
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
        
        ws.on('close', (code: number, reason: Buffer) => {
            const reasonStr = reason.toString();
            console.log(`📱 Local mobile client disconnected. Code: ${code}, Reason: ${reasonStr || 'none'}`);
            localMobileClient = null;
            isLocalMode = false;
            isConnected = false;
        });
        
        ws.on('error', (error: Error & { code?: string }) => {
            const errorCode = error.code || 'UNKNOWN';
            const errorMessage = error.message || 'Unknown error';
            console.error(`📱 Local mobile client error: ${errorMessage} (Code: ${errorCode})`);
        });
        
        // 연결 상태 주기적 확인 (heartbeat)
        const heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.ping();
                } catch (error) {
                    console.error('Heartbeat ping failed:', error);
                    clearInterval(heartbeatInterval);
                }
            } else {
                clearInterval(heartbeatInterval);
            }
        }, 30000); // 30초마다 ping
        
        ws.on('pong', () => {
            // Pong 수신 - 연결 유지됨
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
        console.log(`   PC Server will automatically detect and connect to sessions created by mobile clients.`);
        console.log(`   To use relay mode manually, start with: npm start <SESSION_ID>`);
        console.log(`   Or use HTTP API: POST http://localhost:${CONFIG.HTTP_PORT}/session/connect with {"sessionId": "YOUR_SESSION_ID"}`);
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
