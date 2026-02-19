import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionIds,
  findSessionsWaitingForPC,
} from "../lib/store.js";
import { ApiResponse } from "../lib/types.js";

/**
 * 디버그용: Redis 세션 목록 개수와 PC 대기 중인 세션 개수 반환
 * 문제 원인 파악용 (배포 후 브라우저에서 GET /api/debug-sessions 호출)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.writeHead(200).end();
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
    const sessionIds = await getSessionIds();
    const waitingForPc = await findSessionsWaitingForPC();
    const totalSessions = Array.isArray(sessionIds) ? sessionIds.length : 0;
    const waitingCount = waitingForPc.length;
    const sessionsWithPc = totalSessions - waitingCount;

    const response: ApiResponse<{
      totalSessions: number;
      waitingForPc: number;
      sessionsWithPc: number;
      hint: string;
    }> = {
      success: true,
      data: {
        totalSessions,
        waitingForPc: waitingCount,
        sessionsWithPc,
        hint:
          totalSessions === 0
            ? '모바일에서 "새 세션"으로 세션을 먼저 생성해야 합니다.'
            : waitingCount === 0
            ? '모든 세션이 이미 PC와 연결된 상태입니다. 모바일에서 "새 세션"으로 새로 만든 뒤, 그 세션으로 연결하면 PC가 발견합니다.'
            : "PC 익스텐션이 이 세션들을 발견해 연결할 수 있습니다.",
      },
      timestamp: Date.now(),
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error("debug-sessions error:", error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
