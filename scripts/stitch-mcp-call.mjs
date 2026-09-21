#!/usr/bin/env node
/**
 * Stitch MCP helper.
 *
 * ZCode only loads MCP servers at session start, so a freshly registered
 * `stitch` server has no native tools in the current session. This script
 * speaks the same stdio JSON-RPC protocol the MCP client uses, against the
 * registered launcher (which resolves STITCH_API_KEY from the Windows user
 * store itself), so the Stitch design tools stay usable without restarting.
 *
 * Usage:
 *   node scripts/stitch-mcp-call.mjs list_tools
 *   node scripts/stitch-mcp-call.mjs call <tool_name> '<json args>'
 *   node scripts/stitch-mcp-call.mjs call-file <tool_name> <path-to-json>
 *
 * Exit code is non-zero on protocol or tool errors; tool errors print the
 * server's message so failures are inspectable rather than silent.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const launcher = join(homedir(), ".zcode", "mcp", "stitch-mcp-launcher.mjs");
const [command, ...rest] = process.argv.slice(2);
if (!command) {
  console.error("usage: list_tools | call <tool> <json> | call-file <tool> <path>");
  process.exit(2);
}

let toolName = null;
let toolArgs = {};
if (command === "call") {
  toolName = rest[0];
  toolArgs = JSON.parse(rest[1] ?? "{}");
} else if (command === "call-file") {
  toolName = rest[0];
  toolArgs = JSON.parse(readFileSync(rest[1], "utf8"));
} else if (command !== "list_tools") {
  console.error(`unknown command: ${command}`);
  process.exit(2);
}

const child = spawn(process.execPath, [launcher], { stdio: ["pipe", "pipe", "pipe"] });
let buffer = "";
let settled = false;

const finish = (code, payload) => {
  if (settled) return;
  settled = true;
  if (payload !== undefined) console.log(payload);
  child.kill();
  process.exit(code);
};

const send = (message) => child.stdin.write(JSON.stringify(message) + "\n");

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    if (message.id === 1) {
      if (message.error) finish(1, "initialize failed: " + JSON.stringify(message.error));
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      if (command === "list_tools") {
        send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      } else {
        send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: toolName, arguments: toolArgs } });
      }
    } else if (message.id === 2) {
      if (message.error) finish(1, "tool error: " + JSON.stringify(message.error));
      const result = message.result ?? {};
      const text = (result.content ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      finish(result.isError ? 1 : 0, text || JSON.stringify(result));
    }
  }
});

child.stderr.on("data", (chunk) => {
  const text = chunk.toString().trim();
  if (text) console.error("[stitch]", text.slice(0, 400));
});
child.on("exit", (code) => {
  if (!settled) finish(1, `launcher exited with code ${code} before responding`);
});

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "healthcare-stitch-helper", version: "1.0.0" },
  },
});

setTimeout(() => finish(1, "timeout: no response within 120s"), 120_000).unref();
