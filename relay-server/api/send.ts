import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  sendMessage,
  getSession,
  getDeviceSession,
  appendCommandEvent,
  createCommandApproval,
  listCommandApprovals,
} from "../lib/store.js";
import { evaluateCommandPolicy } from "../lib/command-policy.js";
import {
  ApiResponse,
  RelayMessage,
  DeviceType,
  CommandEvent,
  CommandApprovalRequest,
} from "../lib/types.js";

interface SendRequest {
  sessionId?: string;
  deviceId: string;
  deviceType: DeviceType;
  type: string;
  data: Record<string, unknown>;
  targetDeviceId?: string; // 유니캐스트 응답용 - 특정 클라이언트에게만 전송
}

// UUID 생성
function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateApprovalId(): string {
  return `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractCommandRaw(
  type: string,
  data: Record<string, unknown>
): string | undefined {
  if (type !== "execute_command") return undefined;
  const candidates = [data?.command, data?.raw, data?.cmd];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

function normalizeDataWithCommandId(
  type: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const normalized = { ...(data || {}) };
  if (type !== "execute_command") return normalized;
  if (typeof normalized.id === "string" && normalized.id.trim()) {
    return normalized;
  }
  normalized.id = `cmd_${generateMessageId()}`;
  return normalized;
}

function extractCommandId(data: Record<string, unknown>): string | null {
  return typeof data.id === "string" && data.id.trim() ? data.id : null;
}

function buildCommandResultEvent(
  sessionId: string,
  approval: CommandApprovalRequest,
  resultData: Record<string, unknown>
): CommandEvent {
  const success = resultData.success === true;
  const errorMessage =
    typeof resultData.error_message === "string"
      ? resultData.error_message
      : typeof resultData.errorMessage === "string"
      ? resultData.errorMessage
      : typeof resultData.error === "string"
      ? resultData.error
      : typeof resultData.message === "string" && !success
      ? resultData.message
      : null;
  const commandRaw =
    typeof approval.command_message?.data?.command === "string"
      ? (approval.command_message.data.command as string)
      : typeof approval.command_message?.data?.raw === "string"
      ? (approval.command_message.data.raw as string)
      : approval.command_message.type;

  return {
    event_id: `evt_${generateMessageId()}`,
    session_id: sessionId,
    timestamp: Date.now(),
    tool: {
      provider: "cursor",
      name: "relay-server",
    },
    command: {
      raw: commandRaw,
      cwd:
        typeof approval.command_message?.data?.cwd === "string"
          ? (approval.command_message.data.cwd as string)
          : undefined,
    },
    risk: {
      level: approval.policy.risk_level,
      reasons: approval.policy.reasons,
    },
    policy: {
      decision: approval.policy.decision,
      rule_id: approval.policy.rule_id,
    },
    approval: {
      required: true,
      status: "approved",
      approved_by: approval.resolved_by ?? null,
      approved_at: approval.resolved_at ?? null,
      reason: approval.resolution_reason ?? null,
    },
    result: {
      status: success ? "success" : "error",
      exit_code:
        typeof resultData.exitCode === "number"
          ? resultData.exitCode
          : typeof resultData.exit_code === "number"
          ? (resultData.exit_code as number)
          : null,
      duration_ms:
        typeof resultData.durationMs === "number"
          ? resultData.durationMs
          : typeof resultData.duration_ms === "number"
          ? (resultData.duration_ms as number)
          : 0,
      error_message: success ? null : errorMessage,
    },
    metadata: {
      approval_id: approval.approval_id,
      source: "command_result",
      command_id: extractCommandId(approval.command_message.data) ?? null,
      result_payload: resultData,
    },
  };
}

async function appendCommandResultEventIfMatched(
  sessionId: string,
  data: Record<string, unknown>
): Promise<void> {
  const commandId = extractCommandId(data);
  if (!commandId) return;

  const approvals = await listCommandApprovals(sessionId, 100);
  const matched = approvals.find((approval) => {
    const approvalCommandId = extractCommandId(approval.command_message.data);
    return approvalCommandId === commandId;
  });
  if (!matched) return;
  if (matched.status !== "approved") return;

  const event = buildCommandResultEvent(sessionId, matched, data);
  await appendCommandEvent(sessionId, event);
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
        body = JSON.parse(body) as SendRequest;
      } catch (e) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid JSON body",
          timestamp: Date.now(),
        };
        return res.status(400).json(response);
      }
    }
    const {
      sessionId: providedSessionId,
      deviceId,
      deviceType,
      type,
      data: rawData,
      targetDeviceId: providedTargetDeviceId,
    } = (body || {}) as SendRequest;
    const data = normalizeDataWithCommandId(type, rawData || {});

    // 입력 검증
    if (!deviceId || !deviceType || !type) {
      const response: ApiResponse = {
        success: false,
        error: "deviceId, deviceType, and type are required",
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    // 세션 ID 결정 (connect와 동일하게 대문자 정규화 — PC/모바일 동일 키 매칭)
    let sessionId =
      providedSessionId && typeof providedSessionId === "string"
        ? providedSessionId.trim().toUpperCase()
        : undefined;
    if (!sessionId) {
      sessionId = (await getDeviceSession(deviceId)) || undefined;
    }

    if (!sessionId) {
      const response: ApiResponse = {
        success: false,
        error: "sessionId is required or device must be connected to a session",
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    // 세션 존재 확인
    const session = await getSession(sessionId);
    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: "Session not found",
        timestamp: Date.now(),
      };
      return res.status(404).json(response);
    }

    // 대상 디바이스 타입 결정
    const targetType: DeviceType = deviceType === "pc" ? "mobile" : "pc";

    // targetDeviceId 결정 (body에서 직접 전달받거나 data에서 추출)
    const targetDeviceId = providedTargetDeviceId || (data?.targetDeviceId as string | undefined);

    // 실행 결과(command_result)를 approval 흐름과 연결
    if (deviceType === "pc" && type === "command_result") {
      try {
        await appendCommandResultEventIfMatched(sessionId, data);
      } catch (error) {
        console.error("Failed to append command_result-linked event:", error);
      }
    }

    // 정책 평가 (Day1: execute_command 기준 게이팅)
    const commandRaw = extractCommandRaw(type, data || {});
    const policy = evaluateCommandPolicy({ messageType: type, commandRaw });
    const approvalId =
      policy.decision === "approval_required" ? generateApprovalId() : undefined;

    const commandEvent: CommandEvent | null = commandRaw
      ? {
          event_id: `evt_${generateMessageId()}`,
          session_id: sessionId,
          timestamp: Date.now(),
          tool: {
            provider: "cursor",
            name: "relay-server",
          },
          command: {
            raw: commandRaw,
            cwd: typeof data?.cwd === "string" ? data.cwd : undefined,
          },
          risk: {
            level: policy.riskLevel,
            reasons: policy.reasons,
          },
          policy: {
            decision: policy.decision,
            rule_id: policy.ruleId,
          },
          approval: {
            required: policy.decision === "approval_required",
            status:
              policy.decision === "approval_required"
                ? "pending"
                : "not_required",
            approved_by: null,
            approved_at: null,
            reason: null,
          },
          result: {
            status:
              policy.decision === "deny"
                ? "error"
                : policy.decision === "approval_required"
                ? "pending"
                : "success",
            error_message:
              policy.decision === "deny"
                ? "Command denied by policy"
                : policy.decision === "approval_required"
                ? "Approval required before execution"
                : null,
            duration_ms: 0,
            exit_code: null,
          },
          metadata: {
            sender_device_id: deviceId,
            target_device_id: targetDeviceId || null,
            message_type: type,
            approval_id: approvalId ?? null,
            command_id: extractCommandId(data),
          },
        }
      : null;

    if (commandEvent) {
      try {
        await appendCommandEvent(sessionId, commandEvent);
      } catch (error) {
        console.error("Failed to persist command event:", error);
      }
      console.info("[command_event]", JSON.stringify(commandEvent));
    }

    if (policy.decision === "deny") {
      const response: ApiResponse<{
        policyDecision: string;
        riskLevel: string;
        reasons: string[];
      }> = {
        success: false,
        error: "Command blocked by security policy",
        data: {
          policyDecision: policy.decision,
          riskLevel: policy.riskLevel,
          reasons: policy.reasons,
        },
        timestamp: Date.now(),
      };
      return res.status(403).json(response);
    }

    if (policy.decision === "approval_required") {
      const pendingMessage: RelayMessage = {
        id: generateMessageId(),
        type,
        from: deviceType,
        to: targetType,
        data: data || {},
        timestamp: Date.now(),
        senderDeviceId: deviceId,
        targetDeviceId: targetDeviceId,
      };

      const approvalRequest: CommandApprovalRequest = {
        approval_id: approvalId!,
        session_id: sessionId,
        created_at: Date.now(),
        status: "pending",
        requested_by: deviceId,
        command_message: pendingMessage,
        policy: {
          decision: "approval_required",
          rule_id: policy.ruleId,
          risk_level: policy.riskLevel,
          reasons: policy.reasons,
        },
        resolved_at: null,
        resolved_by: null,
        resolution_reason: null,
      };

      await createCommandApproval(sessionId, approvalRequest);

      const response: ApiResponse<{
        approvalId: string;
        commandId: string | null;
        policyDecision: string;
        riskLevel: string;
        reasons: string[];
      }> = {
        success: false,
        error: "Approval required before command dispatch",
        data: {
          approvalId: approvalId!,
          commandId: extractCommandId(data),
          policyDecision: policy.decision,
          riskLevel: policy.riskLevel,
          reasons: policy.reasons,
        },
        timestamp: Date.now(),
      };
      return res.status(403).json(response);
    }

    // 메시지 생성
    const message: RelayMessage = {
      id: generateMessageId(),
      type,
      from: deviceType,
      to: targetType,
      data: data || {},
      timestamp: Date.now(),
      senderDeviceId: deviceId,  // 요청자 ID 포함 (유니캐스트 응답용)
      targetDeviceId: targetDeviceId,  // 유니캐스트 응답용 - 특정 클라이언트에게만 전송
    };

    // 메시지 큐에 추가
    await sendMessage(sessionId, message);

    const response: ApiResponse<{
      messageId: string;
      commandId: string | null;
      policyDecision: string;
      riskLevel: string;
      reasons: string[];
    }> = {
      success: true,
      data: {
        messageId: message.id,
        commandId: extractCommandId(data),
        policyDecision: policy.decision,
        riskLevel: policy.riskLevel,
        reasons: policy.reasons,
      },
      timestamp: Date.now(),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Send API error:", error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}
