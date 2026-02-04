import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "crypto";
import {
  joinSession,
  getSession,
  setSessionPinHash,
  createSession,
} from "../lib/redis.js";
import { ApiResponse, Session, DeviceType } from "../lib/types.js";

interface ConnectRequest {
  sessionId: string;
  deviceId: string;
  deviceType: DeviceType;
  pin?: string;
}

function hashPin(pin: string): string {
  return createHash("sha256").update(pin.trim()).digest("hex");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Device-Id, X-Device-Type"
  );
  res.setHeader("Access-Control-Max-Age", "86400"); // 24시간

  // CORS preflight - OPTIONS 요청 처리
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Device-Id, X-Device-Type",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  if (req.method !== "POST") {
    const response: ApiResponse = {
      success: false,
      error: "Method not allowed",
      timestamp: Date.now(),
    };
    return res.status(405).json(response);
  }

  try {
    // Vercel/Node에서 body가 문자열로 올 수 있음
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body) as ConnectRequest;
      } catch (e) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid JSON body",
          timestamp: Date.now(),
        };
        return res.status(400).json(response);
      }
    }
    let { sessionId, deviceId, deviceType, pin } = (body ||
      {}) as ConnectRequest;

    // 세션 ID 정규화 (6자 영숫자, 대문자) — PC/모바일 동일 키 매칭
    if (sessionId && typeof sessionId === "string") {
      sessionId = sessionId.trim().toUpperCase();
    }

    // 입력 검증
    if (!sessionId || !deviceId || !deviceType) {
      const response: ApiResponse = {
        success: false,
        error: "sessionId, deviceId, and deviceType are required",
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    if (deviceType !== "mobile" && deviceType !== "pc") {
      const response: ApiResponse = {
        success: false,
        error: 'deviceType must be "mobile" or "pc"',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    // 세션 존재 확인 (없으면 PC 연결 시에만 해당 ID로 세션 생성)
    let existingSession: Session | null = null;
    try {
      existingSession = await getSession(sessionId);
    } catch (e) {
      console.error("getSession error:", e);
      return res.status(500).json({
        success: false,
        error:
          e instanceof Error ? e.message : "Redis error while loading session",
        timestamp: Date.now(),
      });
    }
    if (!existingSession) {
      if (deviceType === "pc") {
        // PC가 먼저 연결할 때: 사용자가 입력한 세션 ID로 세션 생성 (모바일이 나중에 같은 ID로 접속)
        if (/^[A-Z0-9]{6}$/.test(sessionId)) {
          try {
            await createSession(sessionId);
            existingSession = await getSession(sessionId);
          } catch (e) {
            console.error("createSession error:", e);
            return res.status(500).json({
              success: false,
              error:
                e instanceof Error ? e.message : "Failed to create session",
              timestamp: Date.now(),
            });
          }
        }
      }
      if (!existingSession) {
        return res.status(404).json({
          success: false,
          error: "Session not found",
          timestamp: Date.now(),
        });
      }
    }

    const effectiveSessionId = existingSession.sessionId;

    // 모바일 연결 시: PC(익스텐션)가 먼저 연결되어 있어야 함
    const PC_STALE_MS = 2 * 60 * 1000; // 2분
    if (deviceType === "mobile") {
      const noPc = !existingSession.pcDeviceId;
      const pcStale =
        existingSession.pcDeviceId &&
        (existingSession.pcLastSeenAt == null ||
          Date.now() - existingSession.pcLastSeenAt > PC_STALE_MS);
      if (noPc || pcStale) {
        const response: ApiResponse & { errorCode?: string } = {
          success: false,
          error:
            "PC(Extension) must connect first. Activate Cursor Remote from the status bar, then enter the same session ID here.",
          errorCode: "PC_MUST_CONNECT_FIRST",
          timestamp: Date.now(),
        };
        return res.status(403).json(response);
      }
    }

    // 모바일 연결 시: PC가 PIN을 설정했으면 PIN 검증 (세션 ID만으로 타인 접속 방지)
    if (deviceType === "mobile" && existingSession.pcPinHash) {
      if (!pin || typeof pin !== "string" || !pin.trim()) {
        const response: ApiResponse & { errorCode?: string } = {
          success: false,
          error: "PIN required to connect from mobile",
          errorCode: "PIN_REQUIRED",
          timestamp: Date.now(),
        };
        return res.status(403).json(response);
      }
      const pinHash = hashPin(pin);
      if (pinHash !== existingSession.pcPinHash) {
        const response: ApiResponse & { errorCode?: string } = {
          success: false,
          error: "Invalid PIN",
          errorCode: "INVALID_PIN",
          timestamp: Date.now(),
        };
        return res.status(403).json(response);
      }
    }

    // PC 연결 시: 이미 다른 PC가 최근에 사용 중이면 409 (중복 사용)
    if (deviceType === "pc" && existingSession.pcDeviceId) {
      const now = Date.now();
      const pcActive =
        existingSession.pcLastSeenAt != null &&
        now - existingSession.pcLastSeenAt <= PC_STALE_MS;
      if (pcActive) {
        const response: ApiResponse & { errorCode?: string } = {
          success: false,
          error: "Session already in use by another PC",
          errorCode: "PC_IN_USE",
          timestamp: Date.now(),
        };
        return res.status(409).json(response);
      }
    }

    // 세션에 디바이스 연결
    let session: Session | null = null;
    try {
      session = await joinSession(effectiveSessionId, deviceId, deviceType);
    } catch (e) {
      console.error("joinSession error:", e);
      return res.status(500).json({
        success: false,
        error: e instanceof Error ? e.message : "Failed to join session",
        timestamp: Date.now(),
      });
    }
    if (!session) {
      return res.status(500).json({
        success: false,
        error: "Failed to join session (session not found after join)",
        timestamp: Date.now(),
      });
    }

    // PC 연결 시 PIN 설정 (설정하면 모바일은 이 PIN을 알아야만 접속 가능)
    if (deviceType === "pc" && pin && typeof pin === "string" && pin.trim()) {
      const pinHash = hashPin(pin);
      await setSessionPinHash(effectiveSessionId, pinHash);
      session.pcPinHash = pinHash;
    }

    // 클라이언트에 PIN 해시 노출하지 않음
    const { pcPinHash: _, ...sessionWithoutPinHash } = session;
    const response: ApiResponse<Session> = {
      success: true,
      data: sessionWithoutPinHash as Session,
      timestamp: Date.now(),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Connect API error:", error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
