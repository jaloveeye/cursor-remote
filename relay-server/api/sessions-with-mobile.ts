import type { VercelRequest, VercelResponse } from "@vercel/node";
import { findSessionsWithMobile } from "../lib/store.js";
import { ApiResponse, Session } from "../lib/types.js";

type DiscoverySession = {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  hasPc: boolean;
  mobileCount: number;
};

function toDiscoverySession(session: Session): DiscoverySession {
  return {
    sessionId: session.sessionId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    hasPc: !!session.pcDeviceId,
    mobileCount: session.mobileDeviceIds?.length ?? 0,
  };
}

/**
 * 모바일이 1명 이상 연결된 세션 목록
 * 익스텐션이 "연결 가능한 모든 세션"을 조회할 때 사용 (PC 유무와 무관)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  if (req.method !== "GET") {
    const response: ApiResponse = {
      success: false,
      error: "Method not allowed",
      timestamp: Date.now(),
    };
    return res.status(405).json(response);
  }

  try {
    const sessions = (await findSessionsWithMobile()).map(toDiscoverySession);
    const response: ApiResponse<{ sessions: DiscoverySession[] }> = {
      success: true,
      data: { sessions },
      timestamp: Date.now(),
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error("Sessions with mobile API error:", error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
