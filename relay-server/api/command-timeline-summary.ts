import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSession,
  listCommandEvents,
  listCommandApprovals,
  getCommandApproval,
} from "../lib/store.js";
import { extractApprovalId, projectFinalStatus } from "../lib/command-event-projection.js";
import type { ApiResponse, CommandEvent } from "../lib/types.js";

interface CommandTimelineSummary {
  chain_id: string;
  chain_kind: "approval" | "command" | "event";
  approval_id: string | null;
  command_id: string | null;
  command_id_source: "direct" | "inferred" | "none";
  command_raw: string;
  requested_by: string | null;
  resolved_by: string | null;
  risk_level: string;
  policy_decision: string;
  approval_status: string;
  final_status: string;
  exit_code: number | null;
  duration_ms: number;
  error_message: string | null;
  latest_timestamp: number;
  event_count: number;
}

function extractCommandId(event: CommandEvent): string | null {
  if (typeof event.metadata?.command_id === "string") {
    return event.metadata.command_id as string;
  }

  const payload = event.metadata?.result_payload as
    | { id?: unknown }
    | undefined;
  if (typeof payload?.id === "string") {
    return payload.id;
  }
  return null;
}

function resolveCommandIdWithSource(
  events: CommandEvent[]
): { commandId: string | null; source: "direct" | "inferred" | "none" } {
  const direct = extractCommandId(events[0]);
  if (direct) {
    return { commandId: direct, source: "direct" };
  }

  const unique = new Set<string>();
  for (const event of events) {
    const commandId = extractCommandId(event);
    if (commandId) unique.add(commandId);
  }

  if (unique.size === 1) {
    return { commandId: Array.from(unique)[0], source: "inferred" };
  }

  return { commandId: null, source: "none" };
}

function resolveRequestedBy(events: CommandEvent[]): string | null {
  for (const event of events) {
    if (typeof event.metadata?.sender_device_id === "string") {
      return event.metadata.sender_device_id as string;
    }
  }
  return null;
}

function resolveResolvedBy(events: CommandEvent[]): string | null {
  const latest = events[0];
  if (typeof latest.approval?.approved_by === "string") {
    return latest.approval.approved_by;
  }

  for (const event of events) {
    if (typeof event.metadata?.resolved_by === "string") {
      return event.metadata.resolved_by as string;
    }
  }

  return null;
}

function makeChainKey(event: CommandEvent): {
  chainId: string;
  chainKind: "approval" | "command" | "event";
} {
  const approvalId = extractApprovalId(event);
  if (approvalId) {
    return { chainId: approvalId, chainKind: "approval" };
  }

  const commandId = extractCommandId(event);
  if (commandId) {
    return { chainId: commandId, chainKind: "command" };
  }

  return { chainId: event.event_id, chainKind: "event" };
}

function summarizeChain(
  chainId: string,
  chainKind: "approval" | "command" | "event",
  events: CommandEvent[]
): CommandTimelineSummary {
  const latest = events[0];
  const terminal = events.find((event) =>
    ["success", "error", "cancelled", "timeout"].includes(event.result.status)
  );
  const finalEvent = terminal ?? latest;
  const commandIdResolved = resolveCommandIdWithSource(events);

  return {
    chain_id: chainId,
    chain_kind: chainKind,
    approval_id: extractApprovalId(latest),
    command_id: commandIdResolved.commandId,
    command_id_source: commandIdResolved.source,
    command_raw: latest.command.raw,
    requested_by: resolveRequestedBy(events),
    resolved_by: resolveResolvedBy(events),
    risk_level: latest.risk.level,
    policy_decision: latest.policy.decision,
    approval_status: latest.approval.status,
    final_status: finalEvent.result.status,
    exit_code: finalEvent.result.exit_code ?? null,
    duration_ms: finalEvent.result.duration_ms ?? 0,
    error_message: finalEvent.result.error_message ?? null,
    latest_timestamp: latest.timestamp,
    event_count: events.length,
  };
}

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

    const parsedLimit = typeof limit === "string" ? parseInt(limit, 10) : 20;
    const normalizedLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 200)
      : 20;

    const approvalIdFilter =
      typeof rawApprovalId === "string" && rawApprovalId.trim()
        ? rawApprovalId.trim()
        : null;

    const fetchLimit = approvalIdFilter ? 500 : 300;
    const projected = projectFinalStatus(
      await listCommandEvents(sessionId, fetchLimit)
    );
    const filtered = approvalIdFilter
      ? projected.filter((event) => extractApprovalId(event) === approvalIdFilter)
      : projected;

    const chains = new Map<
      string,
      { kind: "approval" | "command" | "event"; events: CommandEvent[] }
    >();
    for (const event of filtered) {
      const { chainId, chainKind } = makeChainKey(event);
      if (!chains.has(chainId)) {
        chains.set(chainId, { kind: chainKind, events: [] });
      }
      chains.get(chainId)!.events.push(event);
    }

    const summaries = Array.from(chains.entries())
      .map(([chainId, group]) =>
        summarizeChain(chainId, group.kind, group.events)
      )
      .sort((a, b) => b.latest_timestamp - a.latest_timestamp)
      .slice(0, normalizedLimit);

    let summariesWithBackfill = summaries;
    if (
      summaries.some(
        (summary) =>
          summary.approval_id &&
          (summary.resolved_by == null || summary.requested_by == null)
      )
    ) {
      const approvalMap = new Map<
        string,
        { requested_by: string; resolved_by: string | null | undefined }
      >();
      const approvals = await listCommandApprovals(sessionId, fetchLimit);
      for (const approval of approvals) {
        approvalMap.set(approval.approval_id, {
          requested_by: approval.requested_by,
          resolved_by: approval.resolved_by,
        });
      }

      summariesWithBackfill = summaries.map((summary) => {
        if (!summary.approval_id) return summary;
        const approval = approvalMap.get(summary.approval_id);
        if (!approval) return summary;
        return {
          ...summary,
          requested_by: summary.requested_by ?? approval.requested_by ?? null,
          resolved_by: summary.resolved_by ?? approval.resolved_by ?? null,
        };
      });
    }

    // 특정 approvalId 조회 시에는 단건 조회로 한 번 더 보강 (이전 데이터 호환)
    if (
      approvalIdFilter &&
      summariesWithBackfill.length === 1 &&
      summariesWithBackfill[0].approval_id === approvalIdFilter &&
      (summariesWithBackfill[0].resolved_by == null ||
        summariesWithBackfill[0].requested_by == null)
    ) {
      const approval = await getCommandApproval(approvalIdFilter);
      if (approval) {
        summariesWithBackfill = [
          {
            ...summariesWithBackfill[0],
            requested_by:
              summariesWithBackfill[0].requested_by ?? approval.requested_by,
            resolved_by:
              summariesWithBackfill[0].resolved_by ?? approval.resolved_by ?? null,
          },
        ];
      }
    }

    const response: ApiResponse<{
      summaries: CommandTimelineSummary[];
      count: number;
    }> = {
      success: true,
      data: {
        summaries: summariesWithBackfill,
        count: summariesWithBackfill.length,
      },
      timestamp: Date.now(),
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error("command-timeline-summary API error:", error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
