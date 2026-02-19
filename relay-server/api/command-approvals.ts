import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSession, listPendingCommandApprovals } from "../lib/store.js";
import type { ApiResponse, CommandApprovalRequest } from "../lib/types.js";

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
    const { sessionId: rawSessionId, limit } = req.query;
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
    const approvals = await listPendingCommandApprovals(
      sessionId,
      Number.isFinite(parsedLimit) ? parsedLimit : 50
    );

    const response: ApiResponse<{
      approvals: CommandApprovalRequest[];
      count: number;
    }> = {
      success: true,
      data: {
        approvals,
        count: approvals.length,
      },
      timestamp: Date.now(),
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error("command-approvals API error:", error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}

