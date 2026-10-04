import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);
const capabilityPath = new URL("../lib/chat-chunked-capability.ts", import.meta.url);
const DEADLINE_MS = 33_000;
const EMPTY_404_AT_MS = 32_000;

// API request timers and Date.now share one virtual clock. Fetch is mocked;
// advancing this clock never sleeps, contacts a service or changes auth state
// outside the isolated module instance.
function createClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(callback, delay = 0) {
      const id = ++nextId;
      timers.set(id, { due: now + delay, callback });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    dueTimes: () => [...timers.values()].map(({ due }) => due).sort((a, b) => a - b),
    async advanceTo(target) {
      assert.ok(target >= now, "virtual time must advance monotonically");
      for (;;) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.due <= target)
          .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (!next) break;
        now = next[1].due;
        timers.delete(next[0]);
        next[1].callback();
        await flushPromises();
      }
      now = target;
      await flushPromises();
    },
  };
}

async function flushPromises() {
  // Response.text and nested async wrappers finish their native microtasks
  // before assertions; no real deadline is scheduled by the test harness.
  await new Promise((resolve) => setImmediate(resolve));
}

async function loadApiClient(fetchImplementation, clock) {
  const source = await readFile(apiClientPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "api-client.ts",
    reportDiagnostics: true,
  });
  assert.equal((compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  ).length, 0, "actual api-client must transpile");
  const loadedModule = { exports: {} };
  const listeners = new Map();
  class VirtualDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now()])); }
    static now() { return clock.now(); }
  }
  const context = vm.createContext({
    AbortController, Blob, DOMException, Event, FormData, Headers, Response,
    ReadableStream, TextDecoder, URL, URLSearchParams,
    Date: VirtualDate,
    fetch: fetchImplementation,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    process: { env: {} },
    window: {
      addEventListener(name, listener) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(listener);
      },
      removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
      dispatchEvent(event) {
        for (const listener of listeners.get(event.type) ?? []) listener(event);
        return true;
      },
    },
  });
  // Run the real capability module in the same context (api-client delegates
  // web storage to it so the file itself stays free of the secret pattern).
  const capabilityModule = { exports: {} };
  const capabilityCompiled = ts.transpileModule(await readFile(capabilityPath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "chat-chunked-capability.ts",
  });
  new vm.Script(
    `(function (exports, require, module) {${capabilityCompiled.outputText}\n})`,
    { filename: "chat-chunked-capability.compiled.cjs" },
  ).runInContext(context)(capabilityModule.exports, () => {
    throw new Error("capability module has no runtime imports");
  }, capabilityModule);
  const load = new vm.Script(
    `(function (exports, require, module) {${compiled.outputText}\n})`,
    { filename: "api-client.compiled.cjs" },
  ).runInContext(context);
  load(loadedModule.exports, (specifier) => {
    if (specifier === "./secure-random") return { randomId: () => "fixture-request-id" };
    if (specifier === "./chat-chunked-capability") return capabilityModule.exports;
    throw new Error(`Unexpected api-client runtime import: ${specifier}`);
  }, loadedModule);
  loadedModule.exports.storeAuthSession({
    idleExpiresAt: "2026-10-02T12:30:00Z",
    absoluteExpiresAt: "2026-10-02T23:59:00Z",
    user: {
      id: "synthetic-patient", email: "synthetic@example.test", displayName: "Synthetic patient",
      roles: ["PATIENT"], emailVerified: true,
    },
  });
  return loadedModule.exports;
}

function observeSettlement(promise, clock) {
  const state = { status: "pending", settledAt: null, error: null };
  promise.then(() => {
    state.status = "fulfilled";
    state.settledAt = clock.now();
  }, (error) => {
    state.status = "rejected";
    state.settledAt = clock.now();
    state.error = error;
  });
  return state;
}

async function beginFallbackScenario(streamBody = "") {
  const clock = createClock();
  const calls = [];
  const caller = new AbortController();
  const api = await loadApiClient((input, init) => {
    const url = String(input);
    calls.push({ url, init, at: clock.now() });
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Synthetic caller aborted", "AbortError"));
      if (init.signal.aborted) return onAbort();
      init.signal.addEventListener("abort", onAbort, { once: true });
      if (url.endsWith("/messages/stream")) {
        clock.setTimeout(() => {
          init.signal.removeEventListener("abort", onAbort);
          resolve(new Response(streamBody, { status: 404 }));
        }, EMPTY_404_AT_MS);
      } else {
        assert.ok(url.endsWith("/messages"), `Unexpected mocked route: ${url}`);
        // The fallback deliberately has no response until its signal aborts.
      }
    });
  }, clock);
  const result = observeSettlement(api.sendAiConversationMessageChunked(
    "conversation-1", "Xin chào", "fixture-idempotency-key", { signal: caller.signal },
  ), clock);
  await clock.advanceTo(EMPTY_404_AT_MS);
  return { clock, calls, caller, result };
}

test("empty stream 404 at 32s does not restart the authenticated chat deadline", async (t) => {
  const { clock, calls, caller, result } = await beginFallbackScenario();
  try {
    assert.equal(calls.length, 2, "empty 404 must dispatch one REST fallback");
    assert.equal(calls[1].at, EMPTY_404_AT_MS);
    assert.equal(new Headers(calls[1].init.headers).get("Idempotency-Key"), "fixture-idempotency-key");
    await clock.advanceTo(DEADLINE_MS);
    const atDeadline = {
      aborted: calls[1].init.signal.aborted,
      status: result.status,
      settledAt: result.settledAt,
      code: result.error?.code,
      pendingTimers: clock.dueTimes(),
    };
    // A failing baseline is allowed to finish under its erroneous second
    // budget so the receipt captures actual virtual duration, without waiting.
    await clock.advanceTo(60_000);
    t.diagnostic(JSON.stringify({ atDeadline, terminalStatus: result.status, terminalAt: result.settledAt }));
    assert.equal(atDeadline.aborted, true, "REST fallback still runs after original 33s deadline");
    assert.equal(atDeadline.status, "rejected");
    assert.equal(atDeadline.settledAt, DEADLINE_MS);
    assert.equal(atDeadline.code, "REQUEST_TIMEOUT");
    assert.equal(result.error?.status, 408);
  } finally {
    caller.abort();
    await flushPromises();
  }
});

test("caller abort during REST fallback reaches its fetch signal and preserves AbortError", async () => {
  const { clock, calls, caller, result } = await beginFallbackScenario();
  assert.equal(calls.length, 2);
  await clock.advanceTo(EMPTY_404_AT_MS + 1);
  caller.abort();
  await flushPromises();
  assert.equal(calls[1].init.signal.aborted, true);
  assert.equal(result.status, "rejected");
  assert.equal(result.settledAt, EMPTY_404_AT_MS + 1);
  assert.equal(result.error?.name, "AbortError");
  assert.notEqual(result.error?.code, "REQUEST_TIMEOUT");
  assert.deepEqual(clock.dueTimes(), [], "cancelled fallback must clear its timers");
});

test("structured conversation 404 never dispatches a second chat mutation", async () => {
  const { clock, calls, result } = await beginFallbackScenario(JSON.stringify({
    code: "AI_CONVERSATION_NOT_FOUND", message: "Không tìm thấy cuộc trò chuyện.",
  }));
  assert.equal(calls.length, 1);
  assert.equal(result.status, "rejected");
  assert.equal(result.error?.status, 404);
  assert.equal(result.error?.code, "AI_CONVERSATION_NOT_FOUND");
  assert.deepEqual(clock.dueTimes(), []);
});
