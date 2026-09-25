import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
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
    if (specifier === "node:crypto") return { randomUUID };
    if (specifier === "node:net") return { isIP };
    throw new Error(`Unexpected runtime import: ${specifier}`);
  }, compiledModule);
  const bff = compiledModule.exports;
  const proxyHealthcareRequest = bff.proxyHealthcareRequest;
  bff.proxyHealthcareRequest = (request, pathSegments, options = {}) => {
    const { useRealChatLeaseControl = false, ...proxyOptions } = options;
    const fetchImpl = proxyOptions.fetchImpl ?? fetch;
    if (useRealChatLeaseControl) {
      return proxyHealthcareRequest(request, pathSegments, proxyOptions);
    }
    const fetchWithChatLeaseStub = async (target, init) => {
      const path = new URL(target).pathname;
      if (/^\/api\/v1\/internal\/ai\/chat-leases\/[0-9a-fA-F-]{36}\/open$/u.test(path)) {
        return Response.json({ renewalPermit: "test-open-renewal-permit-012345678901234567890123456789" });
      }
      if (/^\/api\/v1\/internal\/ai\/chat-leases\/[0-9a-fA-F-]{36}\/renew$/u.test(path)) {
        return Response.json({ renewalPermit: "test-next-renewal-permit-012345678901234567890123456789" });
      }
      return fetchImpl(target, init);
    };
    return proxyHealthcareRequest(request, pathSegments, { ...proxyOptions, fetchImpl: fetchWithChatLeaseStub });
  };
  return bff;
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
    "x-request-id",
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

  const forgedForwardedAuthority = await bff.proxyHealthcareRequest(
    new Request("http://localhost:3000/api/v1/auth/browser-sessions", {
      method: "POST",
      headers: {
        Origin: "https://attacker.test",
        "X-Forwarded-Host": "attacker.test",
        "X-Forwarded-Proto": "https",
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

  assert.equal(forgedForwardedAuthority.status, 403);
  assert.deepEqual(await forgedForwardedAuthority.json(), { code: "BFF_ORIGIN_INVALID" });
  assert.equal(fetchCalls, 1, "browser-controlled forwarded authority must not widen the origin allowlist");
});

test("BFF can forward a canonical backend origin for allowed custom domains", async () => {
  const bff = await loadBff({
    BACKEND_ORIGIN_OVERRIDE: "https://www.healthcare.id.vn",
  });
  const runtime = {
    ...runtimeConfig,
    publicOrigin: "https://www.healthcare.id.vn,https://healthcare.id.vn",
  };
  let observedOrigin = "";

  const response = await bff.proxyHealthcareRequest(
    new Request("https://www.healthcare.id.vn/api/v1/public/ai/chat", {
      method: "POST",
      headers: {
        Origin: "https://www.healthcare.id.vn",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "Xin chào" }),
    }),
    ["public", "ai", "chat"],
    {
      runtimeConfig: runtime,
      fetchImpl: async (_target, init) => {
        observedOrigin = new Headers(init?.headers).get("X-Healthcare-Original-Origin") ?? "";
        return Response.json({ answer: "ok" }, { status: 200 });
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(observedOrigin, "https://www.healthcare.id.vn");
});

test("BFF returns a safe public chat fallback when the AI upstream is unavailable", async () => {
  const bff = await loadBff();
  let upstreamCancelled = false;
  let upstreamCancelReason = "";

  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/public/ai/chat", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Xin chào" }),
    }),
    ["public", "ai", "chat"],
    {
      runtimeConfig,
      fetchImpl: async () => new Response(new ReadableStream({
        cancel(reason) {
          upstreamCancelled = true;
          upstreamCancelReason = String(reason);
        },
      }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, "HOSPITAL_SUPPORT");
  assert.equal(body.provenance, "local_fallback");
  assert.equal(body.safety_action, "INSUFFICIENT_EVIDENCE");
  assert.equal(Array.isArray(body.citations), true);
  assert.match(body.answer, /Trợ lý chưa thể trả lời lúc này/);
  assert.doesNotMatch(body.answer, /đã xác thực/);
  assert.deepEqual(body.suggested_actions, [
    { kind: "START_BOOKING", label: "Đặt lịch khám", href: "/dat-lich" },
    { kind: "VIEW_SOURCE", label: "Xem Chuyên khoa", href: "/specialties" },
    { kind: "VIEW_SOURCE", label: "Xem Cơ sở", href: "/branches" },
  ]);
  assert.doesNotMatch(body.answer, /backend|AI|gián đoạn/i);
  assert.equal(upstreamCancelled, true);
  assert.equal(upstreamCancelReason, "BFF_PUBLIC_AI_FALLBACK");
});

test("BFF keeps emergency guidance deterministic when public AI is unavailable", async () => {
  const bff = await loadBff();
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/public/ai/chat", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Tôi đang khó thở" }),
    }),
    ["public", "ai", "chat"],
    {
      runtimeConfig,
      fetchImpl: async () => Response.json({ unavailable: true }, { status: 503 }),
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.safety_action, "EMERGENCY");
  assert.deepEqual(body.suggested_actions, [
    { kind: "CALL_EMERGENCY", label: "Gọi 115", href: "tel:115" },
  ]);
  assert.match(body.answer, /115/);
});

test("BFF creates a UUID request id and returns the same trace handle to the browser", async () => {
  const bff = await loadBff();
  let upstreamRequestId = "";
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/public/ai/chat", {
      method: "POST",
      headers: {
        Origin: "https://beta.healthcare.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "Xin chào" }),
    }),
    ["public", "ai", "chat"],
    {
      runtimeConfig,
      fetchImpl: async (_target, init = {}) => {
        upstreamRequestId = new Headers(init.headers).get("X-Request-ID") ?? "";
        return Response.json({ answer: "ok" });
      },
    },
  );

  const browserRequestId = response.headers.get("X-Request-ID") ?? "";
  assert.match(browserRequestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(upstreamRequestId, browserRequestId);
  await response.body?.cancel();
});

test("BFF aborts its upstream fetch when the browser cancels a response body", async () => {
  const bff = await loadBff();
  let upstreamSignal;
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages/stream", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: "{}",
    }),
    ["ai", "conversations", "c-1", "messages", "stream"],
    {
      runtimeConfig: { ...runtimeConfig, streamRequestTimeoutMs: 1_000 },
      fetchImpl: async (target, init = {}) => {
        const path = new URL(target).pathname;
        if (path.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
          return new Response(null, { status: 204 });
        }
        upstreamSignal = init.signal;
        if (path.endsWith("/messages/prepare")) {
          return Response.json({ replayed: false, preparedPayload: "payload", commitPermit: "permit" });
        }
        if (path.endsWith("/messages/commit")) {
          return Response.json({
            userMessage: { id: "u" },
            assistantMessage: { content: "answer" },
            replayed: false,
          });
        }
        return new Response(new ReadableStream({ start() {} }), {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      },
    },
  );

  assert.equal(upstreamSignal?.aborted, false);
  await response.body.cancel("browser-navigation");
  assert.equal(upstreamSignal?.aborted, true);
});

test("BFF records a patient-chat prepare deadline as a timeout", async () => {
  const bff = await loadBff();
  const traceRecords = [];
  const originalConsoleInfo = console.info;
  console.info = (event, fields) => traceRecords.push({ event, fields });
  try {
    const response = await bff.proxyHealthcareRequest(
      browserRequest("/api/v1/ai/conversations/c-1/messages/stream", {
        method: "POST",
        headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
        body: "{}",
      }),
      ["ai", "conversations", "c-1", "messages", "stream"],
      {
        runtimeConfig: { ...runtimeConfig, streamRequestTimeoutMs: 20 },
        fetchImpl: async (target, init = {}) => {
          if (new URL(target).pathname.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
            return new Response(null, { status: 204 });
          }
          return await new Promise((_resolve, reject) => {
            const fail = () => reject(new DOMException("upstream timed out", "AbortError"));
            if (init.signal.aborted) fail();
            else init.signal.addEventListener("abort", fail, { once: true });
          });
        },
      },
    );

    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, "BFF_UPSTREAM_UNAVAILABLE");
  } finally {
    console.info = originalConsoleInfo;
  }

  const bffTrace = traceRecords.find(({ event }) => event === "healthcare_chat_stage");
  assert.equal(bffTrace?.fields.outcome, "timeout");
});

test("BFF aborts an in-flight public chat fetch when the browser disconnects", async () => {
  const bff = await loadBff();
  const browserController = new AbortController();
  let upstreamSignal;
  let upstreamStarted;
  const started = new Promise((resolve) => { upstreamStarted = resolve; });
  const responsePromise = bff.proxyHealthcareRequest(
    browserRequest("/api/v1/public/ai/chat", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Xin chào" }),
      signal: browserController.signal,
    }),
    ["public", "ai", "chat"],
    {
      runtimeConfig,
      fetchImpl: async (target, init = {}) => {
        if (new URL(target).pathname.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
          return new Response(null, { status: 204 });
        }
        upstreamSignal = init.signal;
        upstreamStarted();
        return await new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      },
    },
  );

  await started;
  browserController.abort("browser-navigation");
  const response = await responsePromise;
  assert.equal(upstreamSignal?.aborted, true);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).safety_action, "INSUFFICIENT_EVIDENCE");
});

test("BFF notifies the backend over a separate socket when patient chat is cancelled", async () => {
  const backend = createServer();
  const started = new Promise((resolve) => { backend.once("request", resolve); });
  let releaseProvider;
  let providerFinished = false;
  let cancelReceived = false;
  let finishProvider;
  const blockedProvider = new Promise((resolve) => { finishProvider = resolve; });
  const providerRelease = new Promise((resolve) => { releaseProvider = resolve; });
  let resolveCancel;
  const cancelSignal = new Promise((resolve) => { resolveCancel = resolve; });

  backend.on("request", async (incoming, outgoing) => {
    if (incoming.url?.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
      const operationId = incoming.url.split("/").at(-1);
      cancelReceived = true;
      resolveCancel(incoming.headers["x-request-id"] ?? "");
      outgoing.writeHead(operationId === incoming.headers["x-request-id"] ? 204 : 400).end();
      return;
    }
    incoming.on("close", () => {
      if (!incoming.complete) finishProvider();
    });
    await Promise.race([providerRelease, cancelSignal]);
    providerFinished = cancelReceived;
    if (!outgoing.destroyed) outgoing.writeHead(200).end("event: done\ndata: {}\n\n");
  });

  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const address = backend.address();
  assert.ok(address && typeof address === "object");
  const bff = await loadBff();
  const browserController = new AbortController();
  const responsePromise = bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages/stream", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: "{}",
      signal: browserController.signal,
    }),
    ["ai", "conversations", "c-1", "messages", "stream"],
    {
      runtimeConfig: {
        ...runtimeConfig,
        backendOrigin: `http://127.0.0.1:${address.port}`,
        streamRequestTimeoutMs: 2_000,
      },
      fetchImpl: fetch,
    },
  );

  try {
    await started;
    browserController.abort("browser-navigation");
    const cancelledRequestId = await Promise.race([
      cancelSignal,
      new Promise((resolve) => setTimeout(() => resolve(""), 750)),
    ]);
    assert.match(cancelledRequestId, /^[0-9a-f-]{36}$/i, "BFF must send the original server-owned trace id");
    await responsePromise;
    assert.equal(providerFinished, true, "blocked provider work must observe the backend cancellation signal");
  } finally {
    releaseProvider();
    finishProvider();
    await responsePromise.catch(() => {});
    backend.closeAllConnections();
    await new Promise((resolve) => backend.close(resolve));
  }
});

test("BFF notifies the backend over a separate socket when public chat is cancelled", async () => {
  const backend = createServer();
  const started = new Promise((resolve) => { backend.once("request", resolve); });
  let requestId = "";
  let cancelRequestId = "";
  let outgoingSocketClosed = false;
  let resolveProviderDisconnected;
  const providerDisconnectSignal = new Promise((resolve) => { resolveProviderDisconnected = resolve; });
  let resolveCancel;
  const cancelSignal = new Promise((resolve) => { resolveCancel = resolve; });

  backend.on("request", async (incoming, outgoing) => {
    if (incoming.url?.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
      cancelRequestId = incoming.headers["x-request-id"] ?? "";
      resolveCancel();
      outgoing.writeHead(204).end();
      return;
    }
    requestId = incoming.headers["x-request-id"] ?? "";
    outgoing.on("close", () => {
      outgoingSocketClosed = true;
      resolveProviderDisconnected();
    });
    await cancelSignal;
    if (!outgoing.destroyed) outgoing.writeHead(200).end("{}");
  });

  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const address = backend.address();
  assert.ok(address && typeof address === "object");
  const bff = await loadBff();
  const browserController = new AbortController();
  const responsePromise = bff.proxyHealthcareRequest(
    browserRequest("/api/v1/public/ai/chat", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Bệnh viện có những chuyên khoa nào?" }),
      signal: browserController.signal,
    }),
    ["public", "ai", "chat"],
    {
      runtimeConfig: {
        ...runtimeConfig,
        backendOrigin: `http://127.0.0.1:${address.port}`,
        publicAiRequestTimeoutMs: 2_000,
      },
      fetchImpl: fetch,
    },
  );

  try {
    await started;
    browserController.abort("browser-navigation");
    await Promise.race([cancelSignal, new Promise((resolve) => setTimeout(resolve, 750))]);
    await responsePromise;
    await Promise.race([providerDisconnectSignal, new Promise((resolve) => setTimeout(resolve, 750))]);
    assert.match(requestId, /^[0-9a-f-]{36}$/i);
    assert.equal(cancelRequestId, requestId, "guest cancellation must address the same backend request");
    assert.equal(outgoingSocketClosed, true, "guest provider work must lose its backend socket");
  } finally {
    await responsePromise.catch(() => {});
    backend.closeAllConnections();
    await new Promise((resolve) => backend.close(resolve));
  }
});

test("BFF waits for backend cancellation acknowledgement before returning from an aborted chat request", async () => {
  const backend = createServer();
  let resolveStarted;
  const started = new Promise((resolve) => { resolveStarted = resolve; });
  let cancelAckSent = false;

  backend.on("request", async (incoming, outgoing) => {
    if (incoming.url?.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      cancelAckSent = true;
      outgoing.writeHead(204).end();
      return;
    }
    resolveStarted();
    incoming.on("close", () => {
      if (!incoming.complete) outgoing.destroy();
    });
  });

  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const address = backend.address();
  assert.ok(address && typeof address === "object");
  const bff = await loadBff();
  const browserController = new AbortController();
  const responsePromise = bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages/stream", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: "{}",
      signal: browserController.signal,
    }),
    ["ai", "conversations", "c-1", "messages", "stream"],
    {
      runtimeConfig: {
        ...runtimeConfig,
        backendOrigin: `http://127.0.0.1:${address.port}`,
        streamRequestTimeoutMs: 2_000,
      },
      fetchImpl: fetch,
    },
  );

  try {
    await started;
    browserController.abort("browser-navigation");
    const response = await responsePromise;
    assert.equal(response.status, 502);
    assert.equal(
      cancelAckSent,
      true,
      "the BFF handler must stay alive until the cancellation endpoint acknowledges the tombstone",
    );
  } finally {
    backend.closeAllConnections();
    await new Promise((resolve) => backend.close(resolve));
  }
});

test("BFF waits for cancellation acknowledgement after a guest-chat deadline", async () => {
  const backend = createServer();
  let resolveStarted;
  const started = new Promise((resolve) => { resolveStarted = resolve; });
  let cancelAckSent = false;

  backend.on("request", async (incoming, outgoing) => {
    if (incoming.url?.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      cancelAckSent = true;
      outgoing.writeHead(204).end();
      return;
    }
    resolveStarted();
    incoming.on("close", () => {
      if (!incoming.complete) outgoing.destroy();
    });
  });

  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const address = backend.address();
  assert.ok(address && typeof address === "object");
  const bff = await loadBff();
  const responsePromise = bff.proxyHealthcareRequest(
    browserRequest("/api/v1/public/ai/chat", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Bệnh viện có những chuyên khoa nào?" }),
    }),
    ["public", "ai", "chat"],
    {
      runtimeConfig: {
        ...runtimeConfig,
        backendOrigin: `http://127.0.0.1:${address.port}`,
        publicAiRequestTimeoutMs: 60,
      },
      fetchImpl: fetch,
    },
  );

  try {
    await started;
    const response = await responsePromise;
    assert.equal(response.status, 200);
    assert.equal(
      cancelAckSent,
      true,
      "the BFF deadline response must wait for its private cancellation tombstone acknowledgement",
    );
  } finally {
    backend.closeAllConnections();
    await new Promise((resolve) => backend.close(resolve));
  }
});

test("BFF stream cancellation awaits the cancellation side-call before settling its body", async () => {
  const backend = createServer();
  let resolveStarted;
  const started = new Promise((resolve) => { resolveStarted = resolve; });
  let cancelAckSent = false;

  backend.on("request", async (incoming, outgoing) => {
    if (incoming.url?.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      cancelAckSent = true;
      outgoing.writeHead(204).end();
      return;
    }
    resolveStarted();
    if (incoming.url?.endsWith("/messages/prepare")) {
      incoming.resume();
      outgoing.writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ replayed: false, preparedPayload: "payload", commitPermit: "permit" }));
      return;
    }
    if (incoming.url?.endsWith("/messages/commit")) {
      incoming.resume();
      outgoing.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
        userMessage: { id: "u" },
        assistantMessage: { content: "answer" },
        replayed: false,
      }));
      return;
    }
    outgoing.writeHead(404).end();
  });

  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const address = backend.address();
  assert.ok(address && typeof address === "object");
  const bff = await loadBff();
  const responsePromise = bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages/stream", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: "{}",
    }),
    ["ai", "conversations", "c-1", "messages", "stream"],
    {
      runtimeConfig: {
        ...runtimeConfig,
        backendOrigin: `http://127.0.0.1:${address.port}`,
        streamRequestTimeoutMs: 2_000,
      },
      fetchImpl: fetch,
    },
  );

  try {
    await started;
    const response = await responsePromise;
    assert.equal(response.status, 200);
    await response.body.cancel("browser-navigation");
    assert.equal(
      cancelAckSent,
      true,
      "ReadableStream cancellation must await the side-call while the route owns the live response body",
    );
  } finally {
    backend.closeAllConnections();
    await new Promise((resolve) => backend.close(resolve));
  }
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
  const runtime = { ...runtimeConfig, requestTimeoutMs: 10, streamRequestTimeoutMs: 100 };
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages/stream", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
      body: "{}",
    }),
    ["ai", "conversations", "c-1", "messages", "stream"],
    {
      runtimeConfig: runtime,
      fetchImpl: async (target, init) => {
        capturedSignal = init.signal;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 20);
          init.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("aborted", "AbortError"));
          }, { once: true });
        });
        if (new URL(target).pathname.endsWith("/messages/prepare")) {
          return Response.json({ replayed: false, preparedPayload: "payload", commitPermit: "permit" });
        }
        return Response.json({
          userMessage: { id: "u" },
          assistantMessage: { content: "answer" },
          replayed: false,
        });
      },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(capturedSignal.aborted, false);
  await response.body?.cancel("test-complete");
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

test("BFF accepts multiple comma-separated public origins and custom domains", async () => {
  const bff = await loadBff();
  const multiOriginRuntime = {
    ...runtimeConfig,
    publicOrigin: "https://www.healthcare.id.vn,https://healthcare.id.vn",
  };

  for (const origin of [
    "https://healthcare.id.vn",
    "https://www.healthcare.id.vn",
  ]) {
    const res = await bff.proxyHealthcareRequest(
      new Request("https://www.healthcare.id.vn/api/v1/auth/browser-sessions", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "patient@example.test", password: "pwd" }),
      }),
      ["auth", "browser-sessions"],
      {
        runtimeConfig: multiOriginRuntime,
        fetchImpl: async () => Response.json({ ok: true }, { status: 200 }),
      },
    );
    assert.equal(res.status, 200, `Expected 200 for allowed origin ${origin}`);
  }

  const rejected = await bff.proxyHealthcareRequest(
    new Request("https://www.healthcare.id.vn/api/v1/auth/browser-sessions", {
      method: "POST",
      headers: {
        Origin: "https://evil.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "patient@example.test", password: "pwd" }),
    }),
    ["auth", "browser-sessions"],
    {
      runtimeConfig: multiOriginRuntime,
      fetchImpl: async () => Response.json({ ok: true }),
    },
  );
  assert.equal(rejected.status, 403);
});

test("BFF accepts the 127.0.0.1 loopback origin when the runtime URL is localhost", async () => {
  const bff = await loadBff();
  const runtime = {
    ...runtimeConfig,
    publicOrigin: "http://localhost:3000,http://127.0.0.1:3000",
  };
  let observedOrigin = "";
  const response = await bff.proxyHealthcareRequest(
    new Request("http://localhost:3000/api/v1/hospital/branches", {
      headers: { Origin: "http://127.0.0.1:3000" },
    }),
    ["hospital", "branches"],
    {
      runtimeConfig: runtime,
      fetchImpl: async (_target, init) => {
        observedOrigin = new Headers(init?.headers).get("X-Healthcare-Original-Origin") ?? "";
        return Response.json({ ok: true });
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(observedOrigin, "http://127.0.0.1:3000");
});

test("patient chat hides the private prepare permit and preserves the public JSON exchange", async () => {
  const bff = await loadBff();
  const exchange = {
    userMessage: { id: "user-1", content: "hello" },
    assistantMessage: { id: "assistant-1", content: "A safe reply." },
    replayed: false,
  };
  const calls = [];
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json", "Idempotency-Key": "chat-json-0001" },
      body: JSON.stringify({ content: "hello" }),
    }),
    ["ai", "conversations", "c-1", "messages"],
    {
      runtimeConfig,
      fetchImpl: async (target, init = {}) => {
        const path = new URL(target).pathname;
        calls.push({ path, init });
        if (path.endsWith("/messages/prepare")) {
          return Response.json({
            replayed: false,
            exchange: null,
            preparedPayload: "private-answer-payload",
            commitPermit: "private-signed-permit",
          });
        }
        assert.equal(path.endsWith("/messages/commit"), true);
        return Response.json(exchange);
      },
    },
  );

  assert.equal(response.status, 200);
  const publicPayload = await response.text();
  assert.deepEqual(JSON.parse(publicPayload), exchange);
  assert.deepEqual(calls.map(({ path }) => path), [
    "/api/v1/ai/conversations/c-1/messages/prepare",
    "/api/v1/ai/conversations/c-1/messages/commit",
  ]);
  assert.equal(calls[1].init.headers.get("Idempotency-Key"), "chat-json-0001");
  const committedBody = JSON.parse(calls[1].init.body);
  assert.equal(committedBody.preparedPayload, "private-answer-payload");
  assert.equal(committedBody.commitPermit, "private-signed-permit");
  assert.equal(publicPayload.includes("private-signed-permit"), false);
  assert.equal(publicPayload.includes("private-answer-payload"), false);
});

test("BFF refuses direct browser access to private patient-chat prepare and commit routes", async () => {
  const bff = await loadBff();
  let upstreamCalls = 0;

  for (const operation of ["prepare", "commit"]) {
    const response = await bff.proxyHealthcareRequest(
      browserRequest(`/api/v1/ai/conversations/c-1/messages/${operation}`, {
        method: "POST",
        headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json" },
        body: JSON.stringify({ preparedPayload: "browser-controlled", commitPermit: "forged" }),
      }),
      ["ai", "conversations", "c-1", "messages", operation],
      {
        runtimeConfig,
        fetchImpl: async () => {
          upstreamCalls += 1;
          return Response.json({ unexpected: true });
        },
      },
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { code: "BFF_ROUTE_UNAVAILABLE" });
  }

  assert.equal(upstreamCalls, 0, "private chat routes must stop before trusted BFF credentials reach Spring");
});

test("patient chat observed abort sends no commit even when both cancel notifications are rejected", async () => {
  const bff = await loadBff();
  const browserController = new AbortController();
  let resolvePrepareStarted;
  const prepareStarted = new Promise((resolve) => { resolvePrepareStarted = resolve; });
  let prepareCalls = 0;
  let commitCalls = 0;
  let cancellationAttempts = 0;
  const responsePromise = bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json", "Idempotency-Key": "chat-abort-0001" },
      body: JSON.stringify({ content: "hello" }),
      signal: browserController.signal,
    }),
    ["ai", "conversations", "c-1", "messages"],
    {
      runtimeConfig,
      fetchImpl: async (target, init = {}) => {
        const path = new URL(target).pathname;
        if (path.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
          cancellationAttempts += 1;
          return new Response(null, { status: 503 });
        }
        if (path.endsWith("/messages/prepare")) {
          prepareCalls += 1;
          resolvePrepareStarted();
          return await new Promise((_resolve, reject) => {
            init.signal.addEventListener(
              "abort",
              () => reject(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          });
        }
        if (path.endsWith("/messages/commit")) commitCalls += 1;
        throw new Error(`Unexpected patient chat target ${path}`);
      },
    },
  );

  const didEnterPrepare = await Promise.race([
    prepareStarted.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 250)),
  ]);
  if (!didEnterPrepare) {
    browserController.abort("test-cleanup");
    await responsePromise;
    assert.equal(prepareCalls, 1, "patient chat must enter the private prepare stage");
    return;
  }
  browserController.abort("user-cancelled");
  const response = await responsePromise;

  assert.equal(response.status, 502);
  assert.equal(prepareCalls, 1, "patient chat must enter the private prepare stage");
  assert.equal(cancellationAttempts, 2, "the BFF retains its bounded idempotent cancel retries");
  assert.equal(commitCalls, 0, "an abort observed by this BFF invocation must prevent commit dispatch");
});

test("patient chat SSE keeps delta and done events after private commit", async () => {
  const bff = await loadBff();
  const exchange = {
    userMessage: { id: "user-1", content: "hello" },
    assistantMessage: { id: "assistant-1", content: "x".repeat(50) },
    replayed: false,
  };
  const paths = [];
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages/stream", {
      method: "POST",
      headers: { Origin: "https://beta.healthcare.test", "Content-Type": "application/json", "Idempotency-Key": "chat-sse-0001" },
      body: JSON.stringify({ content: "hello" }),
    }),
    ["ai", "conversations", "c-1", "messages", "stream"],
    {
      runtimeConfig,
      fetchImpl: async (target) => {
        const path = new URL(target).pathname;
        paths.push(path);
        if (path.endsWith("/messages/prepare")) {
          return Response.json({ replayed: false, preparedPayload: "payload", commitPermit: "permit" });
        }
        return Response.json(exchange);
      },
    },
  );
  const stream = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/event-stream; charset=utf-8");
  assert.deepEqual(paths, [
    "/api/v1/ai/conversations/c-1/messages/prepare",
    "/api/v1/ai/conversations/c-1/messages/commit",
  ]);
  assert.ok(stream.includes(`event: delta\ndata: ${"x".repeat(48)}\n\n`));
  assert.ok(stream.includes(`event: delta\ndata: xx\n\n`));
  assert.ok(stream.includes(`event: done\ndata: ${JSON.stringify(exchange)}\n\n`));
  assert.equal(stream.includes("permit"), false);
});

test("guest chat opens a private lease before provider dispatch without exposing prompt data", async () => {
  const bff = await loadBff();
  const calls = [];
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/public/ai/chat", {
      method: "POST",
      headers: {
        Origin: "https://beta.healthcare.test",
        "Content-Type": "application/json",
        Cookie: "__Host-healthcare_session=opaque-guest-session",
      },
      body: JSON.stringify({ message: "synthetic guest question" }),
    }),
    ["public", "ai", "chat"],
    {
      runtimeConfig,
      useRealChatLeaseControl: true,
      fetchImpl: async (target, init = {}) => {
        const path = new URL(target).pathname;
        calls.push({ path, init });
        if (path.endsWith("/open")) {
          return Response.json({ renewalPermit: "guest-initial-permit-012345678901234567890123456789" });
        }
        if (path === "/api/v1/public/ai/chat") return Response.json({ answer: "safe guest answer" });
        throw new Error(`Unexpected guest chat target ${path}`);
      },
    },
  );
  const publicBody = await response.text();
  const openCall = calls[0];
  const providerCall = calls[1];
  const openRequestId = openCall.init.headers.get("X-Request-ID");

  assert.equal(response.status, 200);
  assert.deepEqual(calls.map(({ path }) => path), [
    `/api/v1/internal/ai/chat-leases/${openRequestId}/open`,
    "/api/v1/public/ai/chat",
  ]);
  assert.match(openRequestId, /^[0-9a-f-]{36}$/iu);
  assert.deepEqual(JSON.parse(openCall.init.body), { scope: "PUBLIC_CHAT" });
  assert.equal(openCall.init.headers.get("Authorization"), null);
  assert.equal(openCall.init.headers.get("Cookie"), null);
  assert.equal(openCall.init.headers.get("X-Healthcare-Bff-Token"), runtimeConfig.serviceToken);
  assert.equal(providerCall.init.headers.get("X-Request-ID"), openRequestId);
  assert.equal(JSON.parse(Buffer.from(providerCall.init.body).toString()).message, "synthetic guest question");
  assert.equal(publicBody.includes("guest-initial-permit"), false);
});

test("patient chat opens its bound lease before prepare and never returns the renewal permit", async () => {
  const bff = await loadBff();
  const exchange = {
    userMessage: { id: "user-1", content: "hello" },
    assistantMessage: { id: "assistant-1", content: "A safe reply." },
    replayed: false,
  };
  const calls = [];
  const response = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages", {
      method: "POST",
      headers: {
        Origin: "https://beta.healthcare.test",
        "Content-Type": "application/json",
        Cookie: "__Host-healthcare_session=opaque-patient-session",
        "Idempotency-Key": "chat-lease-patient-0001",
      },
      body: JSON.stringify({ content: "hello" }),
    }),
    ["ai", "conversations", "c-1", "messages"],
    {
      runtimeConfig,
      useRealChatLeaseControl: true,
      fetchImpl: async (target, init = {}) => {
        const path = new URL(target).pathname;
        calls.push({ path, init });
        if (path.endsWith("/open")) {
          return Response.json({ renewalPermit: "patient-initial-permit-012345678901234567890123456789" });
        }
        if (path.endsWith("/messages/prepare")) {
          return Response.json({
            replayed: false,
            preparedPayload: "private-answer-payload",
            commitPermit: "private-signed-permit",
          });
        }
        if (path.endsWith("/messages/commit")) return Response.json(exchange);
        throw new Error(`Unexpected patient chat target ${path}`);
      },
    },
  );
  const publicBody = await response.text();
  const [openCall, prepareCall, commitCall] = calls;
  const requestId = openCall.init.headers.get("X-Request-ID");

  assert.equal(response.status, 200);
  assert.deepEqual(calls.map(({ path }) => path), [
    `/api/v1/internal/ai/chat-leases/${requestId}/open`,
    "/api/v1/ai/conversations/c-1/messages/prepare",
    "/api/v1/ai/conversations/c-1/messages/commit",
  ]);
  assert.deepEqual(JSON.parse(openCall.init.body), { scope: "PATIENT", conversationId: "c-1" });
  assert.equal(openCall.init.headers.get("Idempotency-Key"), "chat-lease-patient-0001");
  assert.equal(openCall.init.headers.get("Cookie"), "__Host-healthcare_session=opaque-patient-session");
  assert.equal(prepareCall.init.headers.get("X-Request-ID"), requestId);
  assert.equal(commitCall.init.headers.get("X-Request-ID"), requestId);
  assert.deepEqual(JSON.parse(publicBody), exchange);
  assert.equal(publicBody.includes("patient-initial-permit"), false);
  assert.equal(publicBody.includes("private-signed-permit"), false);
});

test("in-flight lease renewal is single-flight and browser abort sends no commit when cancel calls fail", async () => {
  const bff = await loadBff();
  const browserController = new AbortController();
  let resolvePrepareStarted;
  let resolveRenewalStarted;
  const prepareStarted = new Promise((resolve) => { resolvePrepareStarted = resolve; });
  const renewalStarted = new Promise((resolve) => { resolveRenewalStarted = resolve; });
  let prepareAborted = false;
  let commitCalls = 0;
  let cancellationAttempts = 0;
  let cancellationCookieHeader;
  let cancellationCsrfHeader;
  let renewalCalls = 0;
  let activeRenewals = 0;
  let maxActiveRenewals = 0;
  const responsePromise = bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages", {
      method: "POST",
      headers: {
        Origin: "https://beta.healthcare.test",
        "Content-Type": "application/json",
        "Idempotency-Key": "chat-lease-abort-0001",
        Cookie: "__Host-healthcare_session=opaque-patient-session",
      },
      body: JSON.stringify({ content: "hello" }),
      signal: browserController.signal,
    }),
    ["ai", "conversations", "c-1", "messages"],
    {
      runtimeConfig: { ...runtimeConfig, requestTimeoutMs: 5_000 },
      useRealChatLeaseControl: true,
      fetchImpl: async (target, init = {}) => {
        const path = new URL(target).pathname;
        if (path.endsWith("/open")) {
          return Response.json({ renewalPermit: "initial-permit-012345678901234567890123456789" });
        }
        if (path.endsWith("/renew")) {
          renewalCalls += 1;
          activeRenewals += 1;
          maxActiveRenewals = Math.max(maxActiveRenewals, activeRenewals);
          resolveRenewalStarted();
          try {
            return await new Promise((_resolve, reject) => {
              const fail = () => reject(new DOMException("renewal aborted", "AbortError"));
              if (init.signal.aborted) fail();
              else init.signal.addEventListener("abort", fail, { once: true });
            });
          } finally {
            activeRenewals -= 1;
          }
        }
        if (path.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
          cancellationAttempts += 1;
          cancellationCookieHeader = new Headers(init.headers).get("Cookie");
          cancellationCsrfHeader = new Headers(init.headers).get("X-CSRF-Token");
          return new Response(null, { status: 503 });
        }
        if (path.endsWith("/messages/prepare")) {
          resolvePrepareStarted();
          return await new Promise((_resolve, reject) => {
            const fail = () => {
              prepareAborted = true;
              reject(new DOMException("prepare aborted", "AbortError"));
            };
            if (init.signal.aborted) fail();
            else init.signal.addEventListener("abort", fail, { once: true });
          });
        }
        if (path.endsWith("/messages/commit")) commitCalls += 1;
        throw new Error(`Unexpected patient lease target ${path}`);
      },
    },
  );

  await Promise.all([prepareStarted, renewalStarted]);
  browserController.abort("browser-disconnect");
  const response = await responsePromise;
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(response.status, 502);
  assert.equal(prepareAborted, true);
  assert.equal(renewalCalls, 1, "an in-flight renewal must be aborted, not overlapped or retried");
  assert.equal(maxActiveRenewals, 1);
  assert.equal(cancellationAttempts, 2, "the failed cancellation path remains bounded to two attempts");
  assert.equal(cancellationCookieHeader, null, "the control-plane cancellation needs no patient session cookie");
  assert.equal(cancellationCsrfHeader, null, "the control-plane cancellation needs no patient CSRF token");
  assert.equal(commitCalls, 0, "the originating BFF must not commit after it observes browser abort");
});

test("uncertain lease renewal aborts patient prepare and prevents commit", async () => {
  const bff = await loadBff();
  let resolveRenewalStarted;
  const renewalStarted = new Promise((resolve) => { resolveRenewalStarted = resolve; });
  let prepareAborted = false;
  let commitCalls = 0;
  let cancellationAttempts = 0;
  const responsePromise = bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages", {
      method: "POST",
      headers: {
        Origin: "https://beta.healthcare.test",
        "Content-Type": "application/json",
        "Idempotency-Key": "chat-lease-failure-0001",
      },
      body: JSON.stringify({ content: "hello" }),
    }),
    ["ai", "conversations", "c-1", "messages"],
    {
      runtimeConfig: { ...runtimeConfig, requestTimeoutMs: 5_000 },
      useRealChatLeaseControl: true,
      fetchImpl: async (target, init = {}) => {
        const path = new URL(target).pathname;
        if (path.endsWith("/open")) {
          return Response.json({ renewalPermit: "initial-permit-012345678901234567890123456789" });
        }
        if (path.endsWith("/renew")) {
          resolveRenewalStarted();
          return new Response(null, { status: 503 });
        }
        if (path.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
          cancellationAttempts += 1;
          return new Response(null, { status: 503 });
        }
        if (path.endsWith("/messages/prepare")) {
          return await new Promise((_resolve, reject) => {
            const fail = () => {
              prepareAborted = true;
              reject(new DOMException("prepare aborted after uncertain renewal", "AbortError"));
            };
            if (init.signal.aborted) fail();
            else init.signal.addEventListener("abort", fail, { once: true });
          });
        }
        if (path.endsWith("/messages/commit")) commitCalls += 1;
        throw new Error(`Unexpected patient lease target ${path}`);
      },
    },
  );

  await renewalStarted;
  const response = await responsePromise;

  assert.equal(response.status, 502);
  assert.equal(prepareAborted, true);
  assert.equal(cancellationAttempts, 2);
  assert.equal(commitCalls, 0, "an uncertain lease cannot authorize a patient commit");
});

test("lease heartbeat keeps its one-second cadence anchored to permit issuance", async () => {
  const bff = await loadBff();
  const browserController = new AbortController();
  let resolveRenewalStarted;
  const renewalStarted = new Promise((resolve) => { resolveRenewalStarted = resolve; });
  let openStartedAt = 0;
  let renewalStartedAt = 0;
  let commitCalls = 0;
  const responsePromise = bff.proxyHealthcareRequest(
    browserRequest("/api/v1/ai/conversations/c-1/messages", {
      method: "POST",
      headers: {
        Origin: "https://beta.healthcare.test",
        "Content-Type": "application/json",
        "Idempotency-Key": "chat-lease-cadence-0001",
      },
      body: JSON.stringify({ content: "hello" }),
      signal: browserController.signal,
    }),
    ["ai", "conversations", "c-1", "messages"],
    {
      runtimeConfig: { ...runtimeConfig, requestTimeoutMs: 3_000 },
      useRealChatLeaseControl: true,
      fetchImpl: async (target, init = {}) => {
        const path = new URL(target).pathname;
        if (path.endsWith("/open")) {
          openStartedAt = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 400));
          return Response.json({ renewalPermit: "cadence-initial-permit-012345678901234567890123456789" });
        }
        if (path.endsWith("/renew")) {
          renewalStartedAt = Date.now();
          resolveRenewalStarted();
          browserController.abort("cadence-test-complete");
          return Response.json({ renewalPermit: "cadence-next-permit-012345678901234567890123456789" });
        }
        if (path.startsWith("/api/v1/internal/ai/chat-cancellations/")) {
          return new Response(null, { status: 204 });
        }
        if (path.endsWith("/messages/prepare")) {
          return await new Promise((_resolve, reject) => {
            const fail = () => reject(new DOMException("prepare aborted", "AbortError"));
            if (init.signal.aborted) fail();
            else init.signal.addEventListener("abort", fail, { once: true });
          });
        }
        if (path.endsWith("/messages/commit")) commitCalls += 1;
        throw new Error(`Unexpected patient cadence target ${path}`);
      },
    },
  );

  await renewalStarted;
  const response = await responsePromise;

  assert.equal(response.status, 502);
  assert.ok(
    renewalStartedAt - openStartedAt <= 1_200,
    `first renewal arrived ${renewalStartedAt - openStartedAt}ms after lease open began`,
  );
  assert.equal(commitCalls, 0);
});
