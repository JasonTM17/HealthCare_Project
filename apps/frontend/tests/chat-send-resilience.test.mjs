import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

// The transpile-and-import harness follows tests/consultation-request-timeout.test.mjs.
// AssistantProvider itself pulls in React and the browser API client, so its
// import specifiers are rewritten to the shim modules below; the hook plumbing
// is exercised by invoking the provider once as a plain function and reading
// the context value off the returned element — no renderer is involved.

const reactShim = `
export function createContext() {
  return { Provider: function Provider() {} };
}
export function useCallback(fn, _deps) {
  return fn;
}
export function useContext(_context) {
  return null;
}
export function useEffect(_effect, _deps) {}
export function useMemo(factory, _deps) {
  return factory();
}
export function useRef(initial) {
  return { current: initial };
}
export function useState(initial) {
  let value = initial;
  const setValue = (next) => {
    value = typeof next === "function" ? next(value) : next;
  };
  return [value, setValue];
}
export const jsx = (type, props) => ({ type, props });
export const jsxs = jsx;
export const Fragment = "Fragment";
`;

// A faithful mirror of lib/api-client.ts's ApiError shape plus a send hook the
// tests control; the provider imports this module instead of the real client,
// which keeps the network out of the test while the attempt lifecycle runs for
// real inside the provider.
const apiClientShim = `
export class ApiError extends Error {
  constructor(message, status, path, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.code = options.code ?? null;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}
export const hooks = { onSend: null };
export async function sendAiConversationMessageChunked(conversationId, content, idempotencyKey, options = {}) {
  if (typeof hooks.onSend !== "function") {
    throw new Error("test harness: no send behavior configured");
  }
  return hooks.onSend({ conversationId, content, idempotencyKey, options });
}
export async function fetchAiChatPolicy() {
  throw new Error("test harness: fetchAiChatPolicy is not exercised here");
}
export async function updateAiConversationConsent() {
  throw new Error("test harness: updateAiConversationConsent is not exercised here");
}
`;

const secureRandomShim = `
let counter = 0;
export function randomId() {
  counter += 1;
  return "test-random-" + String(counter).padStart(6, "0");
}
`;

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}

function moduleUrl(code) {
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}

async function loadHarness() {
  const providerSource = await read("components/AssistantProvider.tsx");
  const reactUrl = moduleUrl(reactShim);
  const apiClientUrl = moduleUrl(apiClientShim);
  const secureRandomUrl = moduleUrl(secureRandomShim);
  // The jsx-runtime specifier must be rewritten before the plain "react" one,
  // otherwise the "react" replace consumes its prefix.
  const providerCode = transpile(providerSource)
    .replace(/from "react\/jsx-runtime"/g, `from "${reactUrl}"`)
    .replace(/from "react"/g, `from "${reactUrl}"`)
    .replace(/from "\.\.\/lib\/api-client"/g, `from "${apiClientUrl}"`)
    .replace(/from "\.\.\/lib\/secure-random"/g, `from "${secureRandomUrl}"`);
  const [provider, apiClient] = await Promise.all([
    import(moduleUrl(providerCode)),
    import(apiClientUrl),
  ]);
  const element = provider.AssistantProvider({ children: null, initialMode: "HOSPITAL_SUPPORT" });
  const context = element?.props?.value;
  assert.ok(context, "the provider must expose its context value");
  assert.equal(typeof context.sendMessage, "function");
  assert.equal(typeof context.assistantFailureFromError, "function");
  return { provider, apiClient, context };
}

test("a timed-out chat send retries with the same idempotency key", async () => {
  const { apiClient, context } = await loadHarness();
  const seenKeys = [];
  apiClient.hooks.onSend = async ({ idempotencyKey }) => {
    seenKeys.push(idempotencyKey);
    throw new apiClient.ApiError(
      "Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại sau.",
      408,
      "/ai/conversations/conv-1/messages/stream",
      { code: "REQUEST_TIMEOUT" },
    );
  };

  await assert.rejects(() => context.sendMessage("conv-1", "Tôi bị đau đầu nên khám khoa nào?", {}));
  // A retry of the same logical attempt (same conversation + same content)
  // must reuse the retained key so the backend dedupes instead of double
  // charging credits.
  await assert.rejects(() => context.sendMessage("conv-1", "Tôi bị đau đầu nên khám khoa nào?", {}));
  assert.equal(seenKeys.length, 2);
  assert.match(seenKeys[0], /^chat-/);
  assert.equal(seenKeys[1], seenKeys[0], "timeout must not rotate the idempotency key");

  // A genuinely new question (different content) must get a fresh key.
  await assert.rejects(() => context.sendMessage("conv-1", "Câu hỏi khác hẳn", {}));
  assert.equal(seenKeys.length, 3);
  assert.notEqual(seenKeys[2], seenKeys[0]);
});

test("an aborted chat send keeps its idempotency key; only terminal codes rotate it", async () => {
  const { apiClient, context } = await loadHarness();
  const seenKeys = [];
  apiClient.hooks.onSend = async ({ idempotencyKey }) => {
    seenKeys.push(idempotencyKey);
    throw Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
  };

  await assert.rejects(() => context.sendMessage("conv-2", "Câu hỏi bị hủy giữa đường", {}));
  await assert.rejects(() => context.sendMessage("conv-2", "Câu hỏi bị hủy giữa đường", {}));
  assert.equal(seenKeys.length, 2);
  assert.equal(seenKeys[1], seenKeys[0], "an abort must not clear the retained attempt");

  apiClient.hooks.onSend = async ({ idempotencyKey }) => {
    seenKeys.push(idempotencyKey);
    throw new apiClient.ApiError(
      "Trợ lý tạm thời chưa thể phản hồi.",
      502,
      "/ai/conversations/conv-2/messages/stream",
      { code: "AI_UNAVAILABLE" },
    );
  };
  await assert.rejects(() => context.sendMessage("conv-2", "Câu hỏi bị hủy giữa đường", {}));
  await assert.rejects(() => context.sendMessage("conv-2", "Câu hỏi bị hủy giữa đường", {}));
  assert.equal(seenKeys.length, 4);
  assert.notEqual(seenKeys[3], seenKeys[2], "a terminal idempotency code must rotate the key");
});

test("a completed chat send clears its attempt so the next question gets a fresh key", async () => {
  const { apiClient, context } = await loadHarness();
  const seenKeys = [];
  const settledExchange = { userMessage: { id: "u1" }, assistantMessage: { id: "a1" }, replayed: false };
  apiClient.hooks.onSend = async ({ idempotencyKey }) => {
    seenKeys.push(idempotencyKey);
    return settledExchange;
  };

  await context.sendMessage("conv-3", "Câu hỏi thứ nhất", {});
  await context.sendMessage("conv-3", "Câu hỏi thứ hai", {});
  assert.equal(seenKeys.length, 2);
  assert.notEqual(seenKeys[1], seenKeys[0]);
  const exchange = await context.sendMessage("conv-3", "Câu hỏi thứ nhất", {});
  assert.equal(exchange, settledExchange);
  assert.equal(seenKeys.length, 3);
  // Same content as the first send, but its attempt was cleared on success, so
  // a fresh key is generated rather than replaying the settled one.
  assert.notEqual(seenKeys[2], seenKeys[0]);
});

test("assistantFailureFromError classifies abort/timeout failures as retryable", async () => {
  const { apiClient, context } = await loadHarness();

  // A raw AbortError that escapes to a chat surface is treated like any other
  // transient outage: visible and retryable, never a silent swallow.
  const abortLike = Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
  const abortFailure = context.assistantFailureFromError(abortLike);
  assert.equal(abortFailure.retryable, true);
  assert.equal(abortFailure.kind, "unavailable");

  const timeoutError = new apiClient.ApiError(
    "Hết thời gian chờ phản hồi từ trợ lý. Vui lòng thử lại.",
    408,
    "/ai/conversations/conv-1/messages/stream",
    { code: "CHAT_REQUEST_TIMEOUT" },
  );
  const timeoutFailure = context.assistantFailureFromError(timeoutError);
  assert.equal(timeoutFailure.code, "CHAT_REQUEST_TIMEOUT");
  assert.equal(timeoutFailure.retryable, true);
  assert.equal(timeoutFailure.message, "Hết thời gian chờ phản hồi từ trợ lý. Vui lòng thử lại.");
});
