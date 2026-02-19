import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const schemaPath = path.join(root, "schemas", "command-event.schema.json");
const examplePath = path.join(
  root,
  "schemas",
  "examples",
  "command-event.example.json"
);

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const example = JSON.parse(fs.readFileSync(examplePath, "utf8"));

function fail(message) {
  throw new Error(message);
}

function assertObject(value, name) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${name} must be an object`);
  }
}

function assertRequired(target, required, name) {
  for (const key of required) {
    if (!(key in target)) {
      fail(`${name}.${key} is required`);
    }
  }
}

function assertNoExtra(target, allowedKeys, name) {
  for (const key of Object.keys(target)) {
    if (!allowedKeys.includes(key)) {
      fail(`${name}.${key} is not allowed by schema`);
    }
  }
}

function assertEnum(value, allowed, name) {
  if (!allowed.includes(value)) {
    fail(`${name} must be one of: ${allowed.join(", ")}`);
  }
}

assertObject(example, "command_event");
assertRequired(example, schema.required, "command_event");
assertNoExtra(example, Object.keys(schema.properties), "command_event");

assertObject(example.tool, "tool");
assertEnum(example.tool.provider, schema.properties.tool.properties.provider.enum, "tool.provider");

assertObject(example.risk, "risk");
assertEnum(example.risk.level, schema.properties.risk.properties.level.enum, "risk.level");
if (!Array.isArray(example.risk.reasons)) {
  fail("risk.reasons must be an array");
}

assertObject(example.policy, "policy");
assertEnum(example.policy.decision, schema.properties.policy.properties.decision.enum, "policy.decision");

assertObject(example.approval, "approval");
assertEnum(
  example.approval.status,
  schema.properties.approval.properties.status.enum,
  "approval.status"
);
if (typeof example.approval.required !== "boolean") {
  fail("approval.required must be boolean");
}

assertObject(example.result, "result");
assertEnum(example.result.status, schema.properties.result.properties.status.enum, "result.status");

if (typeof example.event_id !== "string" || !example.event_id.trim()) {
  fail("event_id must be a non-empty string");
}
if (typeof example.session_id !== "string" || !example.session_id.trim()) {
  fail("session_id must be a non-empty string");
}
if (!Number.isInteger(example.timestamp) || example.timestamp < 0) {
  fail("timestamp must be a non-negative integer");
}

console.log("[OK] command_event example passed baseline validation");
