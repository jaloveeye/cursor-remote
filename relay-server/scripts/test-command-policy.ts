import { evaluateCommandPolicy } from "../lib/command-policy.ts";

const cases = [
  {
    name: "safe execute command",
    input: { messageType: "execute_command", commandRaw: "git status" },
    expected: "allow",
  },
  {
    name: "approval required command",
    input: {
      messageType: "execute_command",
      commandRaw: "git reset --hard HEAD~1",
    },
    expected: "approval_required",
  },
  {
    name: "denied critical command",
    input: { messageType: "execute_command", commandRaw: "rm -rf /" },
    expected: "deny",
  },
  {
    name: "non execute message default allow",
    input: { messageType: "insert_text", commandRaw: "rm -rf /" },
    expected: "allow",
  },
] as const;

for (const testCase of cases) {
  const result = evaluateCommandPolicy(testCase.input);
  if (result.decision !== testCase.expected) {
    throw new Error(
      `[FAIL] ${testCase.name}: expected ${testCase.expected}, got ${result.decision}`
    );
  }
  console.log(`[OK] ${testCase.name} -> ${result.decision}`);
}
