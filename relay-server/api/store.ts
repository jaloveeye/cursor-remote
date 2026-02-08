import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ApiResponse } from "../lib/types.js";

/**
 * 릴레이 서버가 사용 중인 저장소 정보 (Supabase / Upstash Redis)
 * GET /api/store → { store: "supabase" | "redis", storeLabel: "Supabase" | "Upstash Redis" }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.writeHead(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
      timestamp: Date.now(),
    });
  }

  const useSupabase = !!process.env.SUPABASE_URL;
  const store = useSupabase ? "supabase" : "redis";
  const storeLabel = useSupabase ? "Supabase" : "Upstash Redis";

  const response: ApiResponse<{ store: "supabase" | "redis"; storeLabel: string }> = {
    success: true,
    data: { store, storeLabel },
    timestamp: Date.now(),
  };
  return res.status(200).json(response);
}
