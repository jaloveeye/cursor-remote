import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSession, getSession } from '../lib/redis';
import { ApiResponse, Session } from '../lib/types';

// 랜덤 세션 ID 생성 (6자리)
function generateSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동되는 문자 제외
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // POST: 새 세션 생성
    if (req.method === 'POST') {
      const sessionId = generateSessionId();
      const session = await createSession(sessionId);
      
      const response: ApiResponse<Session> = {
        success: true,
        data: session,
        timestamp: Date.now(),
      };
      
      return res.status(201).json(response);
    }
    
    // GET: 세션 조회
    if (req.method === 'GET') {
      const { sessionId } = req.query;
      
      if (!sessionId || typeof sessionId !== 'string') {
        const response: ApiResponse = {
          success: false,
          error: 'sessionId is required',
          timestamp: Date.now(),
        };
        return res.status(400).json(response);
      }
      
      const session = await getSession(sessionId);
      
      if (!session) {
        const response: ApiResponse = {
          success: false,
          error: 'Session not found',
          timestamp: Date.now(),
        };
        return res.status(404).json(response);
      }
      
      const response: ApiResponse<Session> = {
        success: true,
        data: session,
        timestamp: Date.now(),
      };
      
      return res.status(200).json(response);
    }
    
    // Method not allowed
    const response: ApiResponse = {
      success: false,
      error: 'Method not allowed',
      timestamp: Date.now(),
    };
    return res.status(405).json(response);
    
  } catch (error) {
    console.error('Session API error:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
