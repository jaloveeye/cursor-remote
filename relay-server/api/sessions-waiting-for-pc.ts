import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../lib/redis.js';
import { REDIS_KEYS } from '../lib/types.js';
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
    // 모든 세션 키 패턴으로 검색 (session:*)
    // Redis에서 모든 세션 키를 가져오는 것은 비효율적이지만,
    // 현재 구조에서는 세션 목록을 저장하는 별도 키가 없으므로 이 방법 사용
    // TODO: 세션 목록을 별도 Set에 저장하여 성능 개선 가능
    
    // Redis SCAN을 사용하여 모든 세션 키 찾기
    // 하지만 @upstash/redis는 SCAN을 직접 지원하지 않으므로,
    // 대신 모든 세션을 순회하는 것은 비효율적
    
    // 임시 해결책: 최근 생성된 세션만 확인 (실제로는 모든 세션을 확인해야 함)
    // 현재는 세션 목록을 저장하는 별도 구조가 없으므로, 이 API는 제한적
    
    // 실제 구현: Redis에 세션 목록을 Set으로 저장하거나,
    // 또는 PC Server가 특정 세션 ID를 시도하도록 하는 것이 더 나을 수 있음
    
    // 현재는 빈 배열 반환 (구현 필요)
    const response: ApiResponse<{ sessions: Session[] }> = {
      success: true,
      data: {
        sessions: [],
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
