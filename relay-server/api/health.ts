import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ApiResponse } from '../lib/types.js';

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
  
  const hasRedisUrl = !!process.env.UPSTASH_REDIS_REST_URL;
  const hasRedisToken = !!process.env.UPSTASH_REDIS_REST_TOKEN;
  
  const response: ApiResponse<{ status: string; version: string; redis: { urlSet: boolean; tokenSet: boolean } }> = {
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      redis: {
        urlSet: hasRedisUrl,
        tokenSet: hasRedisToken,
      },
    },
    timestamp: Date.now(),
  };
  
  return res.status(200).json(response);
}
