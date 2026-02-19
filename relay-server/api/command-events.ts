import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSession, listCommandEvents } from "../lib/store.js";
import type { ApiResponse, CommandEvent } from "../lib/types.js";
import { extractApprovalId, projectFinalStatus } from "../lib/command-event-projection.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
    const { sessionId: rawSessionId, limit, approvalId: rawApprovalId } =
      req.query;
    if (!rawSessionId || typeof rawSessionId !== "string") {
      const response: ApiResponse = {
        success: false,
        error: "sessionId is required",
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    const sessionId = rawSessionId.trim().toUpperCase();
    const session = await getSession(sessionId);
    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: "Session not found",
        timestamp: Date.now(),
      };
      return res.status(404).json(response);
    }

    const parsedLimit = typeof limit === "string" ? parseInt(limit, 10) : 50;
    const normalizedLimit = Number.isFinite(parsedLimit) ? parsedLimit : 50;
    const approvalIdFilter =
      typeof rawApprovalId === "string" && rawApprovalId.trim()
        ? rawApprovalId.trim()
        : null;

    // approvalId 필터가 있으면 더 넓게 읽어온 뒤 필터링하여
    // 다른 이벤트에 밀려 해당 체인이 잘리는 현상을 줄임
    const fetchLimit = approvalIdFilter ? Math.max(normalizedLimit, 200) : normalizedLimit;
    const events = await listCommandEvents(
      sessionId,
      fetchLimit
    );
    const projected = projectFinalStatus(events);
    const filtered = approvalIdFilter
      ? projected.filter((event) => extractApprovalId(event) === approvalIdFilter)
      : projected;
    const sliced = filtered.slice(0, normalizedLimit);

    const response: ApiResponse<{ events: CommandEvent[]; count: number }> = {
      success: true,
      data: {
        events: sliced,
        count: sliced.length,
      },
      timestamp: Date.now(),
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error("command-events API error:", error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
