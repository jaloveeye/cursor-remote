import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSession, updatePcLastSeen } from "../lib/store.js";
import { ApiResponse } from "../lib/types.js";

/**
 * PC 익스텐션 "살아있음" 신호 (heartbeat)
 * - 주기적으로 호출하면 pcLastSeenAt 갱신
 * - 2분간 heartbeat 없으면 연결 끊김으로 간주, 같은 세션 ID로 다른 PC 접속 허용
 * - "접속 끊을게요" API 없이도 안전하게 세션 해제 판단 가능
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Device-Id"
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Device-Id",
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
    const { sessionId, deviceId } = req.query;
    if (
      !sessionId ||
      typeof sessionId !== "string" ||
      !deviceId ||
      typeof deviceId !== "string"
    ) {
      const response: ApiResponse = {
        success: false,
        error: "sessionId and deviceId are required",
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    const session = await getSession(sessionId);
    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: "Session not found",
        timestamp: Date.now(),
      };
      return res.status(404).json(response);
    }

    if (session.pcDeviceId !== deviceId) {
      const response: ApiResponse = {
        success: false,
        error: "Device not registered for this session",
        timestamp: Date.now(),
      };
      return res.status(403).json(response);
    }

    await updatePcLastSeen(sessionId, deviceId);

    const response: ApiResponse<{ ok: boolean }> = {
      success: true,
      data: { ok: true },
      timestamp: Date.now(),
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error("Heartbeat API error:", error);
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Internal server error",
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
