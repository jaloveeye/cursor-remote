import type { CommandEvent } from "./types.js";

export function extractApprovalId(event: CommandEvent): string | null {
  return typeof event.metadata?.approval_id === "string"
    ? (event.metadata.approval_id as string)
    : null;
}

export function projectFinalStatus(events: CommandEvent[]): CommandEvent[] {
  const finalByApprovalId = new Map<
    string,
    {
      status: CommandEvent["result"]["status"];
      errorMessage: string | null;
      durationMs: number;
      exitCode: number | null;
    }
  >();
  const approvalStateByApprovalId = new Map<string, CommandEvent["approval"]>();

  for (const event of events) {
    const approvalId = extractApprovalId(event);
    if (!approvalId) continue;

    if (!approvalStateByApprovalId.has(approvalId)) {
      approvalStateByApprovalId.set(approvalId, { ...event.approval });
    }

    if (finalByApprovalId.has(approvalId)) continue;
    if (
      event.result.status === "success" ||
      event.result.status === "error" ||
      event.result.status === "cancelled" ||
      event.result.status === "timeout"
    ) {
      finalByApprovalId.set(approvalId, {
        status: event.result.status,
        errorMessage: event.result.error_message ?? null,
        durationMs: event.result.duration_ms ?? 0,
        exitCode: event.result.exit_code ?? null,
      });
    }
  }

  return events.map((event) => {
    const approvalId = extractApprovalId(event);
    if (!approvalId) return event;
    const latestApproval = approvalStateByApprovalId.get(approvalId);
    const approvalProjected =
      latestApproval && latestApproval.status !== event.approval.status
        ? {
            ...event.approval,
            ...latestApproval,
          }
        : event.approval;

    if (event.result.status !== "pending") {
      if (approvalProjected === event.approval) return event;
      return {
        ...event,
        approval: approvalProjected,
      };
    }

    const isExecuteCommandPending =
      event.metadata?.message_type === "execute_command";
    const isApproveActionPending = event.metadata?.action === "approve";
    if (!isExecuteCommandPending && !isApproveActionPending) {
      if (approvalProjected === event.approval) return event;
      return {
        ...event,
        approval: approvalProjected,
      };
    }

    const final = finalByApprovalId.get(approvalId);
    if (!final) {
      if (approvalProjected === event.approval) return event;
      return {
        ...event,
        approval: approvalProjected,
      };
    }

    return {
      ...event,
      approval: approvalProjected,
      result: {
        ...event.result,
        status: final.status,
        duration_ms: final.durationMs,
        exit_code: final.exitCode,
        error_message:
          final.status === "success"
            ? null
            : final.errorMessage ?? event.result.error_message ?? null,
      },
    };
  });
}
