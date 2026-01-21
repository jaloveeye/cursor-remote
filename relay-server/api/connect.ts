import type { VercelRequest, VercelResponse } from '@vercel/node';
import { joinSession, getSession } from '../lib/redis';
import { ApiResponse, Session, DeviceType } from '../lib/types';

interface ConnectRequest {
  sessionId: string;
  deviceId: string;
  deviceType: DeviceType;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    const response: ApiResponse = {
      success: false,
      error: 'Method not allowed',
      timestamp: Date.now(),
    };
    return res.status(405).json(response);
  }

  try {
    const { sessionId, deviceId, deviceType } = req.body as ConnectRequest;
    
    // 입력 검증
    if (!sessionId || !deviceId || !deviceType) {
      const response: ApiResponse = {
        success: false,
        error: 'sessionId, deviceId, and deviceType are required',
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
    
    // 세션 존재 확인
    const existingSession = await getSession(sessionId);
    if (!existingSession) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
        timestamp: Date.now(),
      };
      return res.status(404).json(response);
    }
    
    // 세션에 디바이스 연결
    const session = await joinSession(sessionId, deviceId, deviceType);
    
    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to join session',
        timestamp: Date.now(),
      };
      return res.status(500).json(response);
    }
    
    const response: ApiResponse<Session> = {
      success: true,
      data: session,
      timestamp: Date.now(),
    };
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Connect API error:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
