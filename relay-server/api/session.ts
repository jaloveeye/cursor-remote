import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSession, getSession } from '../lib/redis.js';
import { ApiResponse, Session } from '../lib/types.js';

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

  try {
    // POST: 새 세션 생성
    if (req.method === 'POST') {
      try {
        const sessionId = generateSessionId();
        const session = await createSession(sessionId);
        
        const response: ApiResponse<Session> = {
          success: true,
          data: session,
          timestamp: Date.now(),
        };
        
        return res.status(201).json(response);
      } catch (createError) {
        console.error('Failed to create session:', createError);
        const errorMessage = createError instanceof Error 
          ? createError.message 
          : 'Failed to create session';
        const response: ApiResponse = {
          success: false,
          error: errorMessage,
          timestamp: Date.now(),
        };
        return res.status(500).json(response);
      }
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
    const errorMessage = error instanceof Error 
      ? `${error.name}: ${error.message}` 
      : 'Internal server error';
    
    // Redis 연결 오류인지 확인
    const isRedisError = errorMessage.includes('Redis') || errorMessage.includes('UPSTASH');
    
    const response: ApiResponse = {
      success: false,
      error: isRedisError 
        ? 'Database connection error. Please check server configuration.'
        : errorMessage,
      errorStack: process.env.NODE_ENV === 'development' && error instanceof Error 
        ? error.stack 
        : undefined,
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
