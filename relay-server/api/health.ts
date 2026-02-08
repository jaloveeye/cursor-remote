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
  
  const useSupabase = !!process.env.SUPABASE_URL;
  const hasRedisUrl = !!process.env.UPSTASH_REDIS_REST_URL;
  const hasRedisToken = !!process.env.UPSTASH_REDIS_REST_TOKEN;
  const hasSupabaseKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

  const response: ApiResponse<{
    status: string;
    version: string;
    store: 'supabase' | 'redis';
    redis?: { urlSet: boolean; tokenSet: boolean };
    supabase?: { urlSet: boolean; keySet: boolean };
  }> = {
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      store: useSupabase ? 'supabase' : 'redis',
      ...(useSupabase
        ? { supabase: { urlSet: true, keySet: hasSupabaseKey } }
        : { redis: { urlSet: hasRedisUrl, tokenSet: hasRedisToken } }),
    },
    timestamp: Date.now(),
  };
  
  return res.status(200).json(response);
}
