import assert from "node:assert/strict";
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
    if (specifier === "node:net") return { isIP };
    throw new Error(`Unexpected runtime import: ${specifier}`);
  }, compiledModule);
  return compiledModule.exports;
}

function browserRequest(path, init = {}) {
  return new Request(`https://beta.healthcare.test${path}`, init);
}

function responseCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const combined = headers.get("set-cookie");
  return combined ? combined.split(/,(?=\s*[!#$%&'*+.^_`|~0-9A-Za-z-]+=)/u) : [];
}

test("BFF rejects structural path encodings, traversal, absolute targets and control characters", async () => {
  const bff = await loadBff();
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return Response.json({ unexpected: true });
  };
  const cases = [
    ["/api/v1/%2Fadmin", ["%2Fadmin"]],
    ["/api/v1/%252e%252e", ["%252e%252e"]],
    ["/api/v1/%252fadmin", ["%252fadmin"]],
    ["/api/v1//evil", ["", "evil"]],
    ["/api/v1/safe", [".."]],
    ["/api/v1/safe", ["a\\b"]],
    ["/api/v1/http:", ["http:"]],
    ["/api/v1/safe", ["//evil.test"]],
    ["/api/v1/safe", ["safe\u0000suffix"]],
  ];

  for (const [path, segments] of cases) {
    const response = await bff.proxyHealthcareRequest(
      browserRequest(path),
      segments,
      { fetchImpl, runtimeConfig },
    );
    assert.equal(response.status, 400, `${path} with ${JSON.stringify(segments)} must be rejected`);
    assert.deepEqual(await response.json(), { code: "BFF_PATH_INVALID" });
  }
  assert.equal(fetchCalls, 0);
});

test("BFF rejects TRACE and CONNECT before reading or forwarding the request", async () => {
  const bff = await loadBff();
  for (const method of ["TRACE", "CONNECT"]) {
    const response = await bff.proxyHealthcareRequest(
      { method },
      [],
      { runtimeConfig },
    );
    assert.equal(response.status, 405);
    assert.doesNotMatch(response.headers.get("allow") ?? "", /TRACE|CONNECT/);
  }
});

test("BFF hard-denies only exact legacy bearer-mint routes before body reads or upstream calls", async () => {
  const bff = await loadBff();
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return Response.json({ unexpected: true });
  };
  const blockedCases = [
    ["/api/v1/auth/login", ["auth", "login"]],
    ["/api/v1/AUTH/LOGIN", ["AUTH", "LOGIN"]],
    ["/api/v1/auth/%6cogin", ["auth", "%6cogin"]],
    ["/api/v1/auth/%256cogin", ["auth", "%256cogin"]],
    ["/api/v1/auth/refresh?next=%2Fpatient", ["auth", "refresh"]],
    ["/api/v1/auth/email-verifications/confirm", ["auth", "email-verifications", "confirm"]],
    ["/api/v1/auth/verify-email", ["auth", "verify-email"]],
    ["/api/v1/auth/confirm-email", ["auth", "confirm-email"]],
  ];

  for (const method of ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]) {
    const [path, segments] = blockedCases[0];
    const response = await bff.proxyHealthcareRequest(
      browserRequest(path, {
        method,
        ...(method === "GET" || method === "HEAD"
          ? {}
          : { headers: { Origin: "https://beta.healthcare.test" }, body: method === "OPTIONS" ? undefined : "secret-body" }),
      }),
      segments,
      { fetchImpl, runtimeConfig },
    );
    assert.equal(response.status, 404, `${method} ${path}`);
    if (method !== "HEAD") {
      assert.deepEqual(await response.json(), { code: "BFF_ROUTE_UNAVAILABLE" });
    }
  }

  for (const [path, segments] of blockedCases.slice(1)) {
    const response = await bff.proxyHealthcareRequest(
      browserRequest(path, {
        method: "POST",
        headers: { Origin: "https://beta.healthcare.test" },
        body: "must-not-be-read",
      }),
      segments,
      { fetchImpl, runtimeConfig },
    );
    assert.equal(response.status, 404, path);
  }
  assert.equal(fetchCalls, 0);

  let bodyReads = 0;
  const unreadableBodyRequest = {
    get body() {
      bodyReads += 1;
      throw new Error("blocked route body must not be read");
    },
    method: "POST",
    url: "https://beta.healthcare.test/api/v1/auth/login",
  };
  const unreadableBodyResponse = await bff.proxyHealthcareRequest(
    unreadableBodyRequest,
    ["auth", "login"],
    { fetchImpl, runtimeConfig },
  );
  assert.equal(unreadableBodyResponse.status, 404);
  assert.equal(bodyReads, 0);
  assert.equal(fetchCalls, 0);

  for (const [path, segments] of [
    ["/api/v1/auth/login-help", ["auth", "login-help"]],
    ["/api/v1/auth/login/confirm", ["auth", "login", "confirm"]],
    ["/api/v1/auth/browser-sessions", ["auth", "browser-sessions"]],
    ["/api/v1/auth/email-verifications/resend", ["auth", "email-verifications", "resend"]],
    ["/api/v1/auth/password-reset-requests", ["auth", "password-reset-requests"]],
  ]) {
    const response = await bff.proxyHealthcareRequest(
      browserRequest(path, {
        method: "POST",
        headers: { Origin: "https://beta.healthcare.test" },
        body: "{}",
      }),
      segments,
      {
        runtimeConfig,
        fetchImpl: async () => {
          fetchCalls += 1;
          return Response.json({ allowed: true });
        },
      },
    );
    assert.equal(response.status, 200, path);
  }
  assert.equal(fetchCalls, 5);
});

test("BFF rejects browser authority headers and cross-origin mutations", async () => {
  const bff = await loadBff();
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return Response.json({ unexpected: true });
  };

  for (const name of [
    "authorization",
    "x-csrf-token",
    "x-healthcare-bff-token",
    "x-healthcare-client-ip",
    "x-healthcare-original-origin",
  ]) {
    const response = await bff.proxyHealthcareRequest(
      browserRequest("/api/v1/users/me", { headers: { [name]: "browser-controlled" } }),
      ["users", "me"],
      { fetchImpl, runtimeConfig },
    );
    assert.equal(response.status, 400, `${name} must be rejected`);
  }

  const crossOrigin = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/users/me", {
      method: "PATCH",
      headers: { Origin: "https://attacker.test", "Content-Type": "application/json" },
      body: "{}",
    }),
    ["users", "me"],
    { fetchImpl, runtimeConfig },
  );
  assert.equal(crossOrigin.status, 403);

  const missingOrigin = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
    ["users", "me"],
    { fetchImpl, runtimeConfig },
  );
  assert.equal(missingOrigin.status, 403);
  assert.equal(fetchCalls, 0);
});

test("BFF trusts only a single Vercel-overwritten IP literal", async () => {
  const vercelBff = await loadBff({ VERCEL: "1" });
  const localBff = await loadBff();

  async function forwardedClientIp(bff, value) {
    let observedHeaders;
    const response = await bff.proxyHealthcareRequest(
      browserRequest("/api/v1/hospital/branches", {
        headers: {
          "X-Forwarded-For": "203.0.113.90",
          "X-Real-IP": "203.0.113.91",
          "X-Vercel-Forwarded-For": value,
        },
      }),
      ["hospital", "branches"],
      {
        runtimeConfig,
        fetchImpl: async (_target, init) => {
          observedHeaders = new Headers(init.headers);
          return Response.json({ ok: true });
        },
      },
    );
    assert.equal(response.status, 200);
    assert.equal(observedHeaders.get("x-forwarded-for"), null);
    assert.equal(observedHeaders.get("x-real-ip"), null);
    assert.equal(observedHeaders.get("x-vercel-forwarded-for"), null);
    return observedHeaders.get("x-healthcare-client-ip");
  }

  assert.equal(await forwardedClientIp(vercelBff, "203.0.113.42"), "203.0.113.42");
  assert.equal(await forwardedClientIp(vercelBff, "2001:db8::42"), "2001:db8::42");
  for (const malformed of [
    "203.0.113.42, 198.51.100.7",
    "host.example.test",
    "fe80::1%eth0",
  ]) {
    assert.equal(await forwardedClientIp(vercelBff, malformed), null);
  }
  assert.equal(
    await forwardedClientIp(localBff, "203.0.113.42"),
    null,
    "local and non-Vercel runtimes must not trust forwarded client IP headers",
  );
});

test("BFF adds only server authority, cookie CSRF and an allowlisted request surface", async () => {
  const bff = await loadBff();
  let observed;
  const fetchImpl = async (target, init) => {
    observed = { target: String(target), init };
    return Response.json({ ok: true });
  };
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/patient/consultations/thread-1/messages?cursor=opaque", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Connection: "content-type, x-forwarded-for",
        "Content-Type": "application/json",
        Cookie: "preference=teal; __Host-healthcare_session=session-secret; analytics=opaque; __Host-healthcare_csrf=csrf-secret",
        Forwarded: "for=attacker",
        Host: "attacker.test",
        "Idempotency-Key": "message-attempt-1",
        Origin: "https://beta.healthcare.test",
        "X-Forwarded-For": "127.0.0.1",
        "X-Forwarded-Host": "attacker.test",
        "X-Forwarded-Proto": "https",
      },
      body: JSON.stringify({ body: "Xin chào bác sĩ" }),
    }),
    ["patient", "consultations", "thread-1", "messages"],
    { fetchImpl, runtimeConfig },
  );

  assert.equal(response.status, 200);
  assert.equal(observed.target, "https://backend.internal/api/v1/patient/consultations/thread-1/messages?cursor=opaque");
  const headers = new Headers(observed.init.headers);
  assert.equal(headers.get("x-healthcare-bff-token"), runtimeConfig.serviceToken);
  assert.equal(headers.get("x-healthcare-original-origin"), "https://beta.healthcare.test");
  assert.equal(headers.get("x-csrf-token"), "csrf-secret");
  assert.equal(
    headers.get("cookie"),
    "__Host-healthcare_session=session-secret; __Host-healthcare_csrf=csrf-secret",
  );
  assert.doesNotMatch(headers.get("cookie") ?? "", /preference|analytics/);
  assert.equal(headers.get("idempotency-key"), "message-attempt-1");
  assert.equal(headers.get("authorization"), null);
  assert.equal(headers.get("host"), null);
  assert.equal(headers.get("forwarded"), null);
  assert.equal(headers.get("x-forwarded-for"), null);
  assert.equal(headers.get("x-forwarded-host"), null);
  assert.equal(headers.get("x-forwarded-proto"), null);
  assert.equal(headers.get("connection"), null);
  assert.equal(headers.get("content-type"), null, "Connection-scoped headers must not be forwarded");
  assert.deepEqual(JSON.parse(Buffer.from(observed.init.body).toString("utf8")), { body: "Xin chào bác sĩ" });
});

test("BFF rejects duplicate or malformed healthcare security cookies", async () => {
  const bff = await loadBff();
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return Response.json({ unexpected: true });
  };
  const invalidCookieHeaders = [
    "__Host-healthcare_session=first; __Host-healthcare_session=second",
    "__Host-healthcare_csrf=first; __Host-healthcare_csrf=second",
    "__Host-healthcare_session",
    "__Host-healthcare_session=",
  ];

  for (const cookie of invalidCookieHeaders) {
    const response = await bff.proxyHealthcareRequest(
      browserRequest("/api/v1/users/me", { headers: { Cookie: cookie } }),
      ["users", "me"],
      { fetchImpl, runtimeConfig },
    );
    assert.equal(response.status, 400, cookie);
    assert.deepEqual(await response.json(), { code: "BFF_COOKIE_INVALID" });
  }
  assert.equal(fetchCalls, 0);
});

test("BFF preserves only allowlisted secure cookies without exposing its service token", async () => {
  const bff = await loadBff();
  const upstreamHeaders = new Headers({ "Content-Type": "application/json; charset=utf-8", Server: "internal" });
  upstreamHeaders.append(
    "Set-Cookie",
    "__Host-healthcare_session=session-value; Path=/; Secure; HttpOnly; SameSite=Lax",
  );
  upstreamHeaders.append(
    "Set-Cookie",
    "__Host-healthcare_csrf=csrf-value; Path=/; Secure; SameSite=Lax",
  );
  upstreamHeaders.append("Set-Cookie", "analytics=track-me; Path=/; Secure; SameSite=Lax");
  upstreamHeaders.append("Set-Cookie", "__Host-healthcare_session=weak; Path=/; SameSite=Lax");
  upstreamHeaders.append("Set-Cookie", "__Host-healthcare_csrf=domain-leak; Domain=evil.test; Path=/; Secure; SameSite=Lax");
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/auth/browser-sessions", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: JSON.stringify({ grantType: "PASSWORD", email: "patient@example.test", password: "not-real" }),
    }),
    ["auth", "browser-sessions"],
    {
      runtimeConfig,
      fetchImpl: async () => new Response(JSON.stringify({ user: { id: "patient-1" } }), {
        status: 201,
        headers: upstreamHeaders,
      }),
    },
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("server"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(responseCookies(response.headers).length, 2);
  assert.match(responseCookies(response.headers)[0], /^__Host-healthcare_session=session-value;/u);
  assert.match(responseCookies(response.headers)[1], /^__Host-healthcare_csrf=csrf-value;/u);
  assert.doesNotMatch(JSON.stringify([...response.headers]), /synthetic-bff-service-token/);
  assert.doesNotMatch(await response.text(), /synthetic-bff-service-token/);
});

test("BFF binds CSRF origin to a server-owned public origin behind a reverse proxy", async () => {
  const bff = await loadBff();
  let observedOrigin = "";
  let fetchCalls = 0;
  const configuredRuntime = {
    ...runtimeConfig,
    publicOrigin: "https://beta.healthcare.test",
  };

  const accepted = await bff.proxyHealthcareRequest(
    new Request("http://localhost:3000/api/v1/auth/browser-sessions", {
      method: "POST",
      headers: {
        Origin: "https://beta.healthcare.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "patient@example.test", password: "not-real" }),
    }),
    ["auth", "browser-sessions"],
    {
      runtimeConfig: configuredRuntime,
      fetchImpl: async (_target, init) => {
        fetchCalls += 1;
        observedOrigin = new Headers(init?.headers).get("X-Healthcare-Original-Origin") ?? "";
        return Response.json({ ok: true }, { status: 201 });
      },
    },
  );

  assert.equal(accepted.status, 201);
  assert.equal(fetchCalls, 1);
  assert.equal(observedOrigin, "https://beta.healthcare.test");

  const rejected = await bff.proxyHealthcareRequest(
    new Request("http://localhost:3000/api/v1/auth/browser-sessions", {
      method: "POST",
      headers: {
        Origin: "https://attacker.test",
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
    ["auth", "browser-sessions"],
    {
      runtimeConfig: configuredRuntime,
      fetchImpl: async () => {
        fetchCalls += 1;
        return Response.json({ unexpected: true });
      },
    },
  );

  assert.equal(rejected.status, 403);
  assert.deepEqual(await rejected.json(), { code: "BFF_ORIGIN_INVALID" });
  assert.equal(fetchCalls, 1);
});

test("BFF bounds a slow chunked request body before contacting the backend", async () => {
  const bff = await loadBff();
  let fetchCalls = 0;
  const slowBody = new ReadableStream({ start() {} });
  const response = await bff.proxyHealthcareRequest(
    {
      method: "POST",
      url: "https://beta.healthcare.test/api/v1/auth/browser-sessions",
      headers: new Headers({ Origin: "https://beta.healthcare.test", "Content-Type": "application/json" }),
      body: slowBody,
      signal: new AbortController().signal,
    },
    ["auth", "browser-sessions"],
    {
      runtimeConfig: { ...runtimeConfig, requestTimeoutMs: 20 },
      fetchImpl: async () => {
        fetchCalls += 1;
        return Response.json({ unexpected: true });
      },
    },
  );
  assert.equal(response.status, 408);
  assert.deepEqual(await response.json(), { code: "BFF_BODY_TIMEOUT" });
  assert.equal(fetchCalls, 0);
});

test("BFF keeps its deadline active while forwarding an upstream response body", async () => {
  const bff = await loadBff();
  let upstreamSignal;
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/hospital/branches"),
    ["hospital", "branches"],
    {
      runtimeConfig: { ...runtimeConfig, requestTimeoutMs: 20 },
      fetchImpl: async (_target, init = {}) => {
        upstreamSignal = init.signal;
        return new Response(new ReadableStream({
          start(controller) {
            init.signal?.addEventListener("abort", () => {
              controller.error(new Error("upstream aborted"));
            }, { once: true });
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  );

  await assert.rejects(response.text(), /upstream aborted/);
  assert.equal(upstreamSignal?.aborted, true, "BFF deadline must abort the upstream body");
});

test("BFF fails closed on missing service credentials, oversized bodies and upstream redirects", async () => {
  const bff = await loadBff();
  const noToken = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/hospital/branches"),
    ["hospital", "branches"],
    { runtimeConfig: { ...runtimeConfig, serviceToken: "" } },
  );
  assert.equal(noToken.status, 503);
  assert.deepEqual(await noToken.json(), { code: "BFF_CONFIGURATION_UNAVAILABLE" });

  const shortToken = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/hospital/branches"),
    ["hospital", "branches"],
    { runtimeConfig: { ...runtimeConfig, serviceToken: "x".repeat(31) } },
  );
  assert.equal(shortToken.status, 503);
  assert.deepEqual(await shortToken.json(), { code: "BFF_CONFIGURATION_UNAVAILABLE" });

  let minimumTokenCalls = 0;
  const minimumToken = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/hospital/branches"),
    ["hospital", "branches"],
    {
      runtimeConfig: { ...runtimeConfig, serviceToken: "x".repeat(32) },
      fetchImpl: async () => {
        minimumTokenCalls += 1;
        return Response.json({ ok: true });
      },
    },
  );
  assert.equal(minimumToken.status, 200);
  assert.equal(minimumTokenCalls, 1);

  const oversized = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/auth/browser-sessions", {
      method: "POST",
      headers: {
        Origin: "https://beta.healthcare.test",
        "Content-Length": String(12 * 1024 * 1024 + 1),
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
    ["auth", "browser-sessions"],
    { runtimeConfig },
  );
  assert.equal(oversized.status, 413);

  const redirect = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/hospital/branches"),
    ["hospital", "branches"],
    {
      runtimeConfig,
      fetchImpl: async () => new Response(null, {
        status: 302,
        headers: { Location: "https://attacker.test/collect" },
      }),
    },
  );
  assert.equal(redirect.status, 502);
  assert.deepEqual(await redirect.json(), { code: "BFF_UPSTREAM_REDIRECT_REJECTED" });
  assert.equal(redirect.headers.get("location"), null);
});

test("BFF cancels a chunked request as soon as its streamed body exceeds 12 MiB", async () => {
  const bff = await loadBff();
  let fetchCalls = 0;
  let cancelled = false;
  const chunks = [
    new Uint8Array(6 * 1024 * 1024),
    new Uint8Array(6 * 1024 * 1024),
    new Uint8Array([1]),
  ];
  const baseRequest = browserRequest("/api/v1/auth/browser-sessions", {
    method: "POST",
    headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/octet-stream" },
    body: "placeholder",
  });
  const request = {
    body: {
      getReader() {
        return {
          async cancel() {
            cancelled = true;
          },
          async read() {
            const value = chunks.shift();
            return value ? { done: false, value } : { done: true, value: undefined };
          },
          releaseLock() {},
        };
      },
    },
    headers: baseRequest.headers,
    method: baseRequest.method,
    signal: baseRequest.signal,
    url: baseRequest.url,
  };
  const response = await bff.proxyHealthcareRequest(
    request,
    ["auth", "browser-sessions"],
    {
      runtimeConfig,
      fetchImpl: async () => {
        fetchCalls += 1;
        return Response.json({ unexpected: true });
      },
    },
  );

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { code: "BFF_BODY_TOO_LARGE" });
  assert.equal(cancelled, true);
  assert.equal(fetchCalls, 0);
});

test("BFF gives the chunked chat route its longer generation deadline", async () => {
  const bff = await loadBff();
  let capturedSignal;
  const runtime = { ...runtimeConfig, requestTimeoutMs: 10, streamRequestTimeoutMs: 40 };
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages/stream", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: "{}",
    }),
    ["ai", "conversations", "c-1", "messages", "stream"],
    {
      runtimeConfig: runtime,
      fetchImpl: async (_target, init) => {
        capturedSignal = init.signal;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 20);
          init.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("aborted", "AbortError"));
          }, { once: true });
        });
        return Response.json({ ok: true });
      },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(capturedSignal.aborted, false);
});

test("BFF gives public hospital-support chat a bounded cold-start deadline", async () => {
  const bff = await loadBff();
  let capturedSignal;
  const runtime = { ...runtimeConfig, requestTimeoutMs: 10, publicAiRequestTimeoutMs: 40 };
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/public/ai/chat", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Xin chào" }),
    }),
    ["public", "ai", "chat"],
    {
      runtimeConfig: runtime,
      fetchImpl: async (_target, init) => {
        capturedSignal = init.signal;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 20);
          init.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("aborted", "AbortError"));
          }, { once: true });
        });
        return Response.json({ ok: true });
      },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(capturedSignal.aborted, false);
});
