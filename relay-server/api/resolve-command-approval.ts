import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSession,
  getCommandApproval,
  resolveCommandApproval,
  sendMessage,
  appendCommandEvent,
} from "../lib/store.js";
import type { ApiResponse, CommandEvent } from "../lib/types.js";

interface ResolveApprovalRequest {
  sessionId?: string;
  approvalId?: string;
  action?: "approve" | "reject";
  resolvedBy?: string;
  reason?: string;
}

function makeResolveEvent(args: {
  sessionId: string;
  approvalId: string;
  action: "approve" | "reject";
  commandRaw: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  reasons: string[];
  resolvedBy?: string;
  reason?: string;
}): CommandEvent {
  return {
    event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    session_id: args.sessionId,
    timestamp: Date.now(),
    tool: {
      provider: "cursor",
      name: "relay-server",
    },
    command: {
      raw: args.commandRaw,
    },
    risk: {
      level: args.riskLevel,
      reasons: args.reasons,
    },
    policy: {
      decision: "approval_required",
      rule_id: "risky-command-approval-required",
    },
    approval: {
      required: true,
      status: args.action === "approve" ? "approved" : "rejected",
      approved_by: args.action === "approve" ? args.resolvedBy ?? null : null,
      approved_at: args.action === "approve" ? Date.now() : null,
      reason: args.reason ?? null,
    },
    result: {
      status: args.action === "approve" ? "pending" : "cancelled",
      exit_code: null,
      duration_ms: 0,
      error_message:
        args.action === "approve"
          ? null
          : args.reason ?? "Rejected by approver",
    },
    metadata: {
      approval_id: args.approvalId,
      action: args.action,
      resolved_by: args.resolvedBy ?? null,
      resolution_reason: args.reason ?? null,
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.writeHead(200).end();
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
    const body = (typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {}) as ResolveApprovalRequest;

    if (!body.sessionId || !body.approvalId || !body.action) {
      const response: ApiResponse = {
        success: false,
        error: "sessionId, approvalId, and action are required",
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }
    if (body.action !== "approve" && body.action !== "reject") {
      const response: ApiResponse = {
        success: false,
        error: 'action must be "approve" or "reject"',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    const sessionId = body.sessionId.trim().toUpperCase();
    const session = await getSession(sessionId);
    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: "Session not found",
        timestamp: Date.now(),
      };
      return res.status(404).json(response);
    }

    const approval = await getCommandApproval(body.approvalId);
    if (!approval || approval.session_id !== sessionId) {
      const response: ApiResponse = {
        success: false,
        error: "Approval request not found",
        timestamp: Date.now(),
      };
      return res.status(404).json(response);
    }

    const resolved = await resolveCommandApproval(
      body.approvalId,
      sessionId,
      body.action,
      body.resolvedBy,
      body.reason
    );
    if (!resolved) {
      const response: ApiResponse = {
        success: false,
        error: "Failed to resolve approval request",
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    if (body.action === "approve" && approval.status === "pending") {
      await sendMessage(sessionId, approval.command_message);
    }

    const commandRaw =
      typeof approval.command_message?.data?.command === "string"
        ? (approval.command_message.data.command as string)
        : typeof approval.command_message?.data?.raw === "string"
        ? (approval.command_message.data.raw as string)
        : approval.command_message.type;

    const resolveEvent = makeResolveEvent({
      sessionId,
      approvalId: approval.approval_id,
      action: body.action,
      commandRaw,
      riskLevel: approval.policy.risk_level,
      reasons: approval.policy.reasons,
      resolvedBy: body.resolvedBy,
      reason: body.reason,
    });
    await appendCommandEvent(sessionId, resolveEvent);

    const response: ApiResponse<{
      approvalId: string;
      status: string;
    }> = {
      success: true,
      data: {
        approvalId: resolved.approval_id,
        status: resolved.status,
      },
      timestamp: Date.now(),
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error("resolve-command-approval API error:", error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
