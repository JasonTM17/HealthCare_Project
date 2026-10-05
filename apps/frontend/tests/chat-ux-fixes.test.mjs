import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);
const capabilityPath = new URL("../lib/chat-chunked-capability.ts", import.meta.url);

function browserSession(account) {
  return {
    idleExpiresAt: "2026-08-25T12:30:00Z",
    absoluteExpiresAt: "2026-08-25T23:59:00Z",
    user: {
      id: account,
      email: `${account}@example.test`,
      displayName: `Account ${account}`,
      roles: ["PATIENT"],
      emailVerified: true,
    },
  };
}

function exchangeFixture(answer = "OK") {
  return {
    userMessage: {
      id: "u-1", role: "USER", status: "COMPLETED",
      content: "Xin chào", sequence: 1, citations: [],
      createdAt: "2026-10-02T00:00:00Z",
    },
    assistantMessage: {
      id: "a-1", role: "ASSISTANT", status: "COMPLETED",
      content: answer, sequence: 2, citations: [],
      createdAt: "2026-10-02T00:00:00Z",
    },
    replayed: false,
  };
}

// Same vm harness shape as tests/download-protected-file.test.mjs and
// tests/chat-fallback-deadline.behavior.test.mjs: the real transpiled client
// runs against a stubbed fetch/document and an injectable sessionStorage.
async function loadApiClient({ fetch: fetchImpl, sessionStorageSeed } = {}) {
  const source = await readFile(apiClientPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "api-client.ts",
    reportDiagnostics: true,
  });
  const compileErrors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(compileErrors.length, 0, "api-client.ts must transpile for the chat-ux harness");

  const storageMap = new Map(Object.entries(sessionStorageSeed ?? {}));
  const sessionStorage = {
    getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
    setItem: (key, value) => { storageMap.set(key, String(value)); },
    removeItem: (key) => { storageMap.delete(key); },
    clear: () => storageMap.clear(),
  };

  const events = [];
  const body = {
    children: new Set(),
    append(el) {
      body.children.add(el);
      events.push("append");
    },
  };
  const anchor = {
    href: "",
    download: "",
    rel: "",
    click() { events.push("click"); },
    remove() {
      body.children.delete(anchor);
      events.push("remove");
    },
  };
  const document = {
    body,
    createElement(tag) {
      assert.equal(tag, "a");
      return anchor;
    },
  };
  const window = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    setTimeout: (fn, _ms) => setTimeout(fn, 0),
    clearTimeout() {},
  };
  class FakeURL extends URL {
    static createObjectURL() { return "blob:test-1"; }
    static revokeObjectURL() {}
  }

  const compiledModule = { exports: {} };
  const context = vm.createContext({
    AbortController,
    Blob,
    clearTimeout,
    console,
    DOMException,
    Event,
    fetch: fetchImpl ?? (async () => new Response("{}", { status: 200 })),
    FormData,
    Headers,
    module: compiledModule,
    process: { env: {} },
    Response,
    ReadableStream,
    sessionStorage,
    setTimeout,
    TextDecoder,
    URL: FakeURL,
    URLSearchParams,
    window,
    document,
  });
  // The capability flag lives in its own module (portal secret gate keeps
  // api-client.ts free of web-storage identifiers); run the real module in the
  // same VM context so the injected sessionStorage stub still governs it.
  const capabilitySource = await readFile(capabilityPath, "utf8");
  const capabilityTranspiled = ts.transpileModule(capabilitySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "chat-chunked-capability.ts",
  });
  const capabilityModule = { exports: {} };
  new vm.Script(
    `(function (exports, require, module) {${capabilityTranspiled.outputText}\n})`,
    { filename: "chat-chunked-capability.compiled.cjs" },
  ).runInContext(context)(
    capabilityModule.exports,
    () => { throw new Error("capability module has no runtime imports"); },
    capabilityModule,
  );

  const loadModule = new vm.Script(
    `(function (exports, require, module) {${transpiled.outputText}\n})`,
    { filename: "api-client.compiled.cjs" },
  ).runInContext(context);
  loadModule(compiledModule.exports, (specifier) => {
    if (specifier === "./secure-random") return { randomId: () => "test-random-id" };
    if (specifier === "./chat-chunked-capability") return capabilityModule.exports;
    throw new Error(`Unexpected runtime import: ${specifier}`);
  }, compiledModule);
  const api = compiledModule.exports;
  api.storeAuthSession(browserSession("chat-ux-account"));
  return { api, anchor, storageMap, sessionStorage };
}

const CHUNKED_FLAG_KEY = "hc.chat.chunked";

test("empty stream 404 marks chunked disabled: the next send goes straight to /messages", async () => {
  const calls = [];
  const { api, storageMap } = await loadApiClient({
    fetch: async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/messages/stream")) return new Response("", { status: 404 });
      assert.ok(url.endsWith("/messages"), `unexpected request: ${url}`);
      return new Response(JSON.stringify(exchangeFixture()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  await api.sendAiConversationMessageChunked("conv-1", "Xin chào", "key-1", {});
  assert.deepEqual(calls.map((url) => url.split("/").slice(-1)[0]), ["stream", "messages"]);
  assert.equal(storageMap.get(CHUNKED_FLAG_KEY), "0", "empty-404 must seed the disabled flag");

  const exchange = await api.sendAiConversationMessageChunked("conv-1", "Câu hỏi thứ hai", "key-2", {});
  assert.equal(exchange.assistantMessage.content, "OK");
  assert.deepEqual(
    calls.map((url) => url.split("/").slice(-1)[0]),
    ["stream", "messages", "messages"],
    "a cached disabled capability must skip the doomed stream probe",
  );
});

test("a 404 with an error body is a real failure, never a capability signal", async () => {
  const calls = [];
  const { api, storageMap } = await loadApiClient({
    fetch: async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/messages/stream")) {
        return new Response(JSON.stringify({ code: "AI_CONVERSATION_NOT_FOUND", message: "Không tìm thấy." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      assert.ok(url.endsWith("/messages"), `unexpected request: ${url}`);
      return new Response(JSON.stringify(exchangeFixture()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  await assert.rejects(
    () => api.sendAiConversationMessageChunked("conv-404", "Xin chào", "key-1", {}),
    (error) => error.status === 404 && error.code === "AI_CONVERSATION_NOT_FOUND",
  );
  assert.equal(storageMap.has(CHUNKED_FLAG_KEY), false, "a structured 404 must not mark the capability");

  await assert.rejects(
    () => api.sendAiConversationMessageChunked("conv-404", "Thử lại", "key-2", {}),
    (error) => error.status === 404,
  );
  assert.deepEqual(
    calls.map((url) => url.split("/").slice(-1)[0]),
    ["stream", "stream"],
    "without the flag every send still probes the stream route",
  );
});

test("a pre-seeded session flag skips the stream probe on a fresh module", async () => {
  const calls = [];
  const { api } = await loadApiClient({
    sessionStorageSeed: { [CHUNKED_FLAG_KEY]: "0" },
    fetch: async (input) => {
      const url = String(input);
      calls.push(url);
      assert.ok(url.endsWith("/messages"), `unexpected request: ${url}`);
      return new Response(JSON.stringify(exchangeFixture("Trả lời từ máy chủ")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const deltas = [];
  const exchange = await api.sendAiConversationMessageChunked("conv-1", "Xin chào", "key-1", {
    onDelta: (delta) => deltas.push(delta),
  });
  assert.deepEqual(calls.map((url) => url.split("/").slice(-1)[0]), ["messages"]);
  assert.equal(exchange.assistantMessage.content, "Trả lời từ máy chủ");
  assert.equal(deltas.join(""), "Trả lời từ máy chủ", "non-streamed answers reveal through onDelta");
});

test("downloadPatientDocument prefers Content-Disposition and drops the demo name", async () => {
  const { api, anchor } = await loadApiClient({
    fetch: async () => new Response(new TextEncoder().encode("%PDF-1.7 fake"), {
      status: 200,
      headers: { "Content-Disposition": 'attachment; filename="ho-so-tong-hop.pdf"' },
    }),
  });
  await api.downloadPatientDocument("patient-1", "doc-1");
  assert.equal(anchor.download, "ho-so-tong-hop.pdf");
});

test("downloadPatientDocument falls back to a clean default when no header is sent", async () => {
  const { api, anchor } = await loadApiClient({
    fetch: async () => new Response(new TextEncoder().encode("%PDF-1.7 fake"), { status: 200 }),
  });
  await api.downloadPatientDocument("patient-1", "doc-2");
  assert.equal(anchor.download, "tai-lieu-tong-hop.pdf");
  assert.doesNotMatch(anchor.download, /demo/i, "the test-artifact name must not reach users");
});

test("hotline constants keep the display copy and tel: digits in sync", async () => {
  const source = await readFile(new URL("../lib/hotline.ts", import.meta.url), "utf8");
  assert.match(source, /PUBLIC_HOTLINE_DISPLAY = "028 1800 0001"/);
  assert.match(source, /PUBLIC_HOTLINE_E164 = "02818000001"/);
});
