import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findSessionsWaitingForPC } from '../lib/redis.js';
import { ApiResponse, Session } from '../lib/types.js';

/**
 * PC deviceId가 없는 세션 목록 조회
 * PC Server가 세션 ID 없이 시작했을 때, 모바일 클라이언트가 이미 연결한 세션을 찾기 위해 사용
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24시간
  
  // CORS preflight - OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    // PC deviceId가 없고 mobileDeviceId가 있는 세션 찾기
    const waitingSessions = await findSessionsWaitingForPC();
    
    const response: ApiResponse<{ sessions: Session[] }> = {
      success: true,
      data: {
        sessions: waitingSessions,
      },
      timestamp: Date.now(),
    };
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Sessions waiting for PC API error:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
