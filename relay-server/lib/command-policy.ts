import type { PolicyDecision, RiskLevel } from "./types.js";

export interface CommandPolicyInput {
  messageType: string;
  commandRaw?: string;
}

export interface CommandPolicyResult {
  riskLevel: RiskLevel;
  reasons: string[];
  decision: PolicyDecision;
  ruleId: string;
}

const CRITICAL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bmkfs\b/i, reason: "filesystem-format-command" },
  { pattern: /\bdd\s+if=.*\sof=\/dev\//i, reason: "raw-disk-write-command" },
  { pattern: /\brm\s+-rf\s+\/(\s|$)/i, reason: "root-destructive-delete-command" },
  { pattern: /\bshutdown\b|\breboot\b|\bpoweroff\b/i, reason: "system-power-command" },
];

const HIGH_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bsudo\b/i, reason: "privilege-escalation-command" },
  { pattern: /\bgit\s+reset\s+--hard\b/i, reason: "git-hard-reset-command" },
  { pattern: /\bgit\s+clean\s+-f[d|x]*/i, reason: "git-clean-force-command" },
  { pattern: /\bgit\s+push\b.*\s--force(?:-with-lease)?\b/i, reason: "git-force-push-command" },
  { pattern: /\bgit\s+branch\s+-D\b/i, reason: "git-force-branch-delete-command" },
  { pattern: /\brm\s+-rf\b/i, reason: "recursive-force-delete-command" },
];

const MEDIUM_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bchmod\s+777\b/i, reason: "overly-permissive-chmod-command" },
  { pattern: /\bchown\b/i, reason: "ownership-change-command" },
  { pattern: /\bdocker\s+(?:stop|rm|rmi|system prune)\b/i, reason: "container-destructive-command" },
];

function evaluateRisk(commandRaw: string): { level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];

  for (const item of CRITICAL_PATTERNS) {
    if (item.pattern.test(commandRaw)) reasons.push(item.reason);
  }
  if (reasons.length > 0) return { level: "critical", reasons };

  for (const item of HIGH_PATTERNS) {
    if (item.pattern.test(commandRaw)) reasons.push(item.reason);
  }
  if (reasons.length > 0) return { level: "high", reasons };

  for (const item of MEDIUM_PATTERNS) {
    if (item.pattern.test(commandRaw)) reasons.push(item.reason);
  }
  if (reasons.length > 0) return { level: "medium", reasons };

  return { level: "low", reasons: [] };
}

export function evaluateCommandPolicy(
  input: CommandPolicyInput
): CommandPolicyResult {
  if (!input.commandRaw || input.messageType !== "execute_command") {
    return {
      riskLevel: "low",
      reasons: [],
      decision: "allow",
      ruleId: "non-execute-command-default-allow",
    };
  }

  const risk = evaluateRisk(input.commandRaw);
  if (risk.level === "critical") {
    return {
      riskLevel: risk.level,
      reasons: risk.reasons,
      decision: "deny",
      ruleId: "critical-command-deny",
    };
  }

  if (risk.level === "high" || risk.level === "medium") {
    return {
      riskLevel: risk.level,
      reasons: risk.reasons,
      decision: "approval_required",
      ruleId: "risky-command-approval-required",
    };
  }

  return {
    riskLevel: "low",
    reasons: [],
    decision: "allow",
    ruleId: "safe-command-allow",
  };
}

