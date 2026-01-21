import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ApiResponse } from '../lib/types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const response: ApiResponse<{ status: string; version: string }> = {
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
    },
    timestamp: Date.now(),
  };
  
  return res.status(200).json(response);
}
