import type { VercelRequest, VercelResponse } from '@vercel/node';
import { receiveMessages, getSession, getDeviceSession } from '../lib/redis.js';
import { ApiResponse, RelayMessage, DeviceType } from '../lib/types.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Device-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24시간
  
  // CORS preflight - OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id, X-Device-Type',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  if (req.method !== 'GET') {
    const response: ApiResponse = {
      success: false,
      error: 'Method not allowed',
      timestamp: Date.now(),
    };
    return res.status(405).json(response);
  }

  try {
    const { sessionId: querySessionId, deviceId, deviceType, limit } = req.query;
    
    // 입력 검증
    if (!deviceType || typeof deviceType !== 'string') {
      const response: ApiResponse = {
        success: false,
        error: 'deviceType is required',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }
    
    if (deviceType !== 'mobile' && deviceType !== 'pc') {
      const response: ApiResponse = {
        success: false,
        error: 'deviceType must be "mobile" or "pc"',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }
    
    // 세션 ID 결정
    let sessionId = querySessionId as string | undefined;
    if (!sessionId && deviceId && typeof deviceId === 'string') {
      sessionId = await getDeviceSession(deviceId) || undefined;
    }
    
    if (!sessionId) {
      const response: ApiResponse = {
        success: false,
        error: 'sessionId or deviceId is required',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }
    
    // 세션 존재 확인
    const session = await getSession(sessionId);
    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
        timestamp: Date.now(),
      };
      return res.status(404).json(response);
    }
    
    // 메시지 가져오기
    const maxLimit = Math.min(parseInt(limit as string) || 10, 50);
    // deviceId가 있으면 개별 큐에서 메시지 수신 (멀티 클라이언트 지원)
    const messages = await receiveMessages(
      sessionId, 
      deviceType as DeviceType, 
      maxLimit,
      deviceId as string | undefined
    );
    
    const response: ApiResponse<{ messages: RelayMessage[]; count: number }> = {
      success: true,
      data: { 
        messages,
        count: messages.length,
      },
      timestamp: Date.now(),
    };
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Poll API error:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
