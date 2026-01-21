import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendMessage, getSession, getDeviceSession } from '../lib/redis';
import { ApiResponse, RelayMessage, DeviceType } from '../lib/types';

interface SendRequest {
  sessionId?: string;
  deviceId: string;
  deviceType: DeviceType;
  type: string;
  data: Record<string, unknown>;
}

// UUID 생성
function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
    const { sessionId: providedSessionId, deviceId, deviceType, type, data } = req.body as SendRequest;
    
    // 입력 검증
    if (!deviceId || !deviceType || !type) {
      const response: ApiResponse = {
        success: false,
        error: 'deviceId, deviceType, and type are required',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }
    
    // 세션 ID 결정 (제공된 것 또는 디바이스에서 조회)
    let sessionId = providedSessionId;
    if (!sessionId) {
      sessionId = await getDeviceSession(deviceId) || undefined;
    }
    
    if (!sessionId) {
      const response: ApiResponse = {
        success: false,
        error: 'sessionId is required or device must be connected to a session',
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
    
    // 대상 디바이스 타입 결정
    const targetType: DeviceType = deviceType === 'pc' ? 'mobile' : 'pc';
    
    // 메시지 생성
    const message: RelayMessage = {
      id: generateMessageId(),
      type,
      from: deviceType,
      to: targetType,
      data: data || {},
      timestamp: Date.now(),
    };
    
    // 메시지 큐에 추가
    await sendMessage(sessionId, message);
    
    const response: ApiResponse<{ messageId: string }> = {
      success: true,
      data: { messageId: message.id },
      timestamp: Date.now(),
    };
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Send API error:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
