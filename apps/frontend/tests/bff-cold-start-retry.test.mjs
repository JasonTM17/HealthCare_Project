import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const helperPath = new URL("../lib/server/healthcare-bff.ts", import.meta.url);
const runtimeConfig = Object.freeze({
  backendOrigin: "https://backend.internal",
  serviceToken: "synthetic-bff-service-token-at-least-32-bytes",
  requestTimeoutMs: 1_000,
});
// Production gives this layer 25 s (DEFAULT_REQUEST_TIMEOUT_MS) and a retry
// needs more than 1 s of remaining budget, so retry exercises use a budget the
// same rule accepts.
const retryRuntime = Object.freeze({ ...runtimeConfig, requestTimeoutMs: 5_000 });

async function loadBff(env = {}) {
  const source = await readFile(helperPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "healthcare-bff.ts",
    reportDiagnostics: true,
  });
  const errors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "BFF helper must transpile without diagnostics");

  const compiledModule = { exports: {} };
  const context = vm.createContext({
    AbortController,
    ArrayBuffer,
    clearTimeout,
    console,
    fetch,
    Headers,
    module: compiledModule,
    process: { env: { ...env } },
    Request,
    ReadableStream,
    Response,
    setTimeout,
    URL,
  });
  const load = new vm.Script(
    `(function (exports, require, module) {${transpiled.outputText}\n})`,
    { filename: "healthcare-bff.compiled.cjs" },
  ).runInContext(context);
  load(compiledModule.exports, (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "node:buffer") return { Buffer };
    if (specifier === "node:crypto") return { randomUUID };
    if (specifier === "node:net") return { isIP };
    throw new Error(`Unexpected runtime import: ${specifier}`);
  });
  return compiledModule.exports;
}

function browserRequest(path, init = {}) {
  return new Request(`https://beta.healthcare.test${path}`, init);
}

function captureRetryLogs(records) {
  const original = console.warn;
  console.warn = (event, fields) => records.push({ event, fields });
  return () => { console.warn = original; };
}

test("BFF retries one safe read when a cold upstream answers 502", async () => {
  const bff = await loadBff();
  const attempts = [];
  const retryLogs = [];
  const restore = captureRetryLogs(retryLogs);
  try {
    const response = await bff.proxyHealthcareRequest(
      browserRequest("/api/v1/hospital/doctors?page=0&size=12"),
      ["hospital", "doctors"],
      {
        runtimeConfig: retryRuntime,
        fetchImpl: async (target, init = {}) => {
          attempts.push({ target: String(target), init });
          if (attempts.length === 1) {
            return Response.json({ code: "cold" }, { status: 502, headers: { "Content-Type": "application/json" } });
          }
          return Response.json({ content: [] }, { status: 200 });
        },
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { content: [] });
    assert.equal(attempts.length, 2, "a 502 on a GET must be retried exactly once");
    assert.equal(attempts[1].init.method, "GET");
    assert.equal(attempts[1].init.body, undefined, "a retried safe read must not invent a body");
    assert.equal(
      new Headers(attempts[1].init.headers).get("X-Request-ID"),
      new Headers(attempts[0].init.headers).get("X-Request-ID"),
      "both attempts stay inside one browser request id",
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    restore();
  }

  assert.equal(retryLogs.length, 1, "the retry must be observable without leaking content");
  assert.equal(retryLogs[0].event, "healthcare_bff_upstream_retry");
  assert.equal(retryLogs[0].fields.reason, "upstream_status");
  assert.equal(retryLogs[0].fields.status, 502);
  assert.equal(retryLogs[0].fields.attempt, 2);
  assert.doesNotMatch(JSON.stringify(retryLogs[0].fields), /doctors|page=|hospital/);
});

test("BFF retries one safe read when the upstream fetch fails at the network layer", async () => {
  const bff = await loadBff();
  let attempts = 0;
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/health"),
    ["health"],
    {
      runtimeConfig: retryRuntime,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError("fetch failed");
        return Response.json({ status: "UP" });
      },
    },
  );

  assert.equal(attempts, 2);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "UP" });
});

test("BFF gives up after exactly one retry and never loops on a persistent 502", async () => {
  const bff = await loadBff();
  let attempts = 0;
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/hospital/branches"),
    ["hospital", "branches"],
    {
      runtimeConfig: retryRuntime,
      fetchImpl: async () => {
        attempts += 1;
        return new Response(null, { status: 502 });
      },
    },
  );

  assert.equal(attempts, 2, "a persistent upstream failure must settle after two attempts");
  assert.equal(response.status, 502);
});

test("BFF surfaces its structured upstream error when the retry itself fails", async () => {
  const bff = await loadBff();
  let attempts = 0;
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/hospital/branches"),
    ["hospital", "branches"],
    {
      runtimeConfig: retryRuntime,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) return new Response(null, { status: 504 });
        throw new TypeError("fetch failed");
      },
    },
  );

  assert.equal(attempts, 2);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { code: "BFF_UPSTREAM_UNAVAILABLE" });
});

test("BFF never retries an unsafe method and keeps the public-chat fallback intact", async () => {
  const bff = await loadBff();
  let postAttempts = 0;
  const post = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/auth/browser-sessions", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: "{}",
    }),
    ["auth", "browser-sessions"],
    {
      runtimeConfig,
      fetchImpl: async () => {
        postAttempts += 1;
        return new Response(null, { status: 502 });
      },
    },
  );
  assert.equal(postAttempts, 1, "POST must never be retried");
  assert.equal(post.status, 502);

  let chatAttempts = 0;
  const chat = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/public/ai/chat", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Xin chào" }),
    }),
    ["public", "ai", "chat"],
    {
      runtimeConfig,
      fetchImpl: async () => {
        chatAttempts += 1;
        return new Response(null, { status: 502 });
      },
    },
  );
  assert.equal(chatAttempts, 1, "the public-chat fallback must stay a single attempt");
  assert.equal(chat.status, 200);
  assert.equal((await chat.json()).provenance, "local_fallback");
});

test("BFF retries HEAD reads without inventing a response body", async () => {
  const bff = await loadBff();
  let attempts = 0;
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/health", { method: "HEAD" }),
    ["health"],
    {
      runtimeConfig: retryRuntime,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) return new Response(null, { status: 502 });
        return new Response(null, { status: 204 });
      },
    },
  );

  assert.equal(attempts, 2);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
});

test("BFF refuses the retry once the remaining deadline budget is too small", async () => {
  const bff = await loadBff();
  let attempts = 0;
  const startedAt = Date.now();
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/hospital/branches"),
    ["hospital", "branches"],
    {
      // The first answer consumes 400 ms of a 1.2 s budget, leaving less than
      // the 1 s retry floor: no second attempt may run and the deadline stays
      // exactly where it was.
      runtimeConfig: { ...runtimeConfig, requestTimeoutMs: 1_200 },
      fetchImpl: async () => {
        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 400));
        return new Response(null, { status: 502 });
      },
    },
  );

  assert.equal(attempts, 1, "a retry must not start without budget for it");
  assert.equal(response.status, 502);
  assert.ok(Date.now() - startedAt < 1_200, "the first response must return inside the original deadline");
});

test("BFF does not retry after the browser disconnects", async () => {
  const bff = await loadBff();
  const controller = new AbortController();
  controller.abort();
  const abortedRequest = new Request("https://beta.healthcare.test/api/v1/hospital/branches", {
    signal: controller.signal,
  });
  let attempts = 0;
  const response = await bff.proxyHealthcareRequest(
    abortedRequest,
    ["hospital", "branches"],
    {
      runtimeConfig,
      fetchImpl: async () => {
        attempts += 1;
        return new Response(null, { status: 502 });
      },
    },
  );

  assert.equal(attempts, 1, "a disconnected browser must not trigger a second upstream call");
  assert.equal(response.status, 502);
});
