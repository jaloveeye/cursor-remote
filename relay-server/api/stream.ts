import type { VercelRequest, VercelResponse } from '@vercel/node';
import { receiveMessages, getSession, getDeviceSession, hasMessages } from '../lib/redis';
import { DeviceType, RelayMessage } from '../lib/types';

// SSE 이벤트 포맷
function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId: querySessionId, deviceId, deviceType } = req.query;
  
  // 입력 검증
  if (!deviceType || typeof deviceType !== 'string') {
    return res.status(400).json({ error: 'deviceType is required' });
  }
  
  if (deviceType !== 'mobile' && deviceType !== 'pc') {
    return res.status(400).json({ error: 'deviceType must be "mobile" or "pc"' });
  }
  
  // 세션 ID 결정
  let sessionId = querySessionId as string | undefined;
  if (!sessionId && deviceId && typeof deviceId === 'string') {
    sessionId = await getDeviceSession(deviceId) || undefined;
  }
  
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId or deviceId is required' });
  }
  
  // 세션 존재 확인
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // 연결 확인 이벤트 전송
  res.write(formatSSE('connected', { 
    sessionId, 
    deviceType,
    timestamp: Date.now() 
  }));
  
  // Vercel Serverless Functions는 최대 실행 시간이 있음 (Free: 10초, Pro: 60초)
  // 따라서 Long polling 스타일로 구현
  const startTime = Date.now();
  const maxDuration = 25000; // 25초 (Vercel Pro 기준, 여유 두기)
  const pollInterval = 500; // 0.5초마다 체크
  
  try {
    while (Date.now() - startTime < maxDuration) {
      // 메시지 확인 및 전송
      const messages = await receiveMessages(sessionId, deviceType as DeviceType, 10);
      
      if (messages.length > 0) {
        for (const message of messages) {
          res.write(formatSSE('message', message));
        }
      }
      
      // 잠시 대기
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      // heartbeat 전송 (연결 유지)
      res.write(formatSSE('heartbeat', { timestamp: Date.now() }));
    }
    
    // 타임아웃 - 클라이언트가 재연결하도록 알림
    res.write(formatSSE('reconnect', { 
      reason: 'timeout',
      timestamp: Date.now() 
    }));
    
  } catch (error) {
    console.error('Stream error:', error);
    res.write(formatSSE('error', { 
      message: error instanceof Error ? error.message : 'Stream error',
      timestamp: Date.now()
    }));
  } finally {
    res.end();
  }
}
