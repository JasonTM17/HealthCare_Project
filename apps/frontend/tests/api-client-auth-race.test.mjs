import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createBrowserWindow() {
  const listeners = new Map();
  return {
    addEventListener(name, listener) {
      const current = listeners.get(name) ?? new Set();
      current.add(listener);
      listeners.set(name, current);
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return true;
    },
    removeEventListener(name, listener) {
      listeners.get(name)?.delete(listener);
    },
  };
}

async function loadApiClient(fetchImplementation) {
  const source = await readFile(apiClientPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "api-client.ts",
    reportDiagnostics: true,
  });
  const compileErrors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(compileErrors.length, 0, "api-client.ts must transpile for the race harness");

  const compiledModule = { exports: {} };
  const context = vm.createContext({
    AbortController,
    Blob,
    clearTimeout,
    Event,
    fetch: fetchImplementation,
    FormData,
    Headers,
    module: compiledModule,
    process: { env: {} },
    Response,
    setTimeout,
    URL,
    URLSearchParams,
    window: createBrowserWindow(),
  });
  const loadModule = new vm.Script(
    `(function (exports, require, module) {${transpiled.outputText}\n})`,
    { filename: "api-client.compiled.cjs" },
  ).runInContext(context);
  loadModule(compiledModule.exports, (specifier) => {
    throw new Error(`Unexpected runtime import: ${specifier}`);
  }, compiledModule);
  return { api: compiledModule.exports, window: context.window };
}

test("late current-session hydration cannot overwrite a newer password login", async () => {
  const oldHydration = deferred();
  const requests = [];
  const { api, window } = await loadApiClient(async (input, init = {}) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/auth/browser-sessions/current")) return oldHydration.promise;
    if (url.endsWith("/auth/browser-sessions") && init.method === "POST") {
      return jsonResponse(browserSession("account-b"));
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const hydration = api.hydrateAuthSession();
  await new Promise((resolve) => setImmediate(resolve));
  const loggedIn = await api.login({ email: "b@example.test", password: "not-real" });
  oldHydration.resolve(jsonResponse(browserSession("account-a")));
  await hydration;

  assert.equal(loggedIn.user.id, "account-b");
  assert.equal(api.readAuthSession()?.user.id, "account-b");
  assert.equal(api.getAuthHydrationSnapshot(), "settled");
  assert.equal("sessionStorage" in window, false);

  const loginRequest = requests.find(({ url }) => url.endsWith("/auth/browser-sessions"));
  assert.deepEqual(JSON.parse(String(loginRequest.init.body)), {
    grantType: "PASSWORD",
    email: "b@example.test",
    password: "not-real",
  });
  assert.equal(new Headers(loginRequest.init.headers).get("authorization"), null);
});

test("logout invalidates an in-flight hydration and cannot be undone by its late result", async () => {
  const oldHydration = deferred();
  const requests = [];
  const { api } = await loadApiClient(async (input, init = {}) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/auth/browser-sessions/current") && init.method === "GET") {
      return oldHydration.promise;
    }
    if (url.endsWith("/auth/browser-sessions/current") && init.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  api.storeAuthSession(browserSession("account-a"));
  const hydration = api.hydrateAuthSession(true);
  await new Promise((resolve) => setImmediate(resolve));
  const outcome = await api.logoutCurrentUser();
  oldHydration.resolve(jsonResponse(browserSession("account-a")));
  await hydration;

  assert.equal(api.readAuthSession(), null);
  assert.equal(api.getAuthHydrationSnapshot(), "settled");
  assert.equal(outcome.status, "LOGGED_OUT");
  assert.equal(outcome.authority, "DELETE_ACK");
  assert.equal(
    requests.filter(({ url, init }) => url.endsWith("/auth/browser-sessions/current") && init.method === "DELETE").length,
    1,
  );
});

test("failed logout preserves the session only after GET confirms the same active authority", async () => {
  const activeSession = browserSession("account-a");
  const deletion = deferred();
  const reconciledSession = {
    ...activeSession,
    idleExpiresAt: "2026-08-25T12:45:00Z",
  };
  let currentSessionRequests = 0;
  const { api } = await loadApiClient(async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/auth/browser-sessions/current") && init.method === "DELETE") {
      return deletion.promise;
    }
    if (url.endsWith("/auth/browser-sessions/current") && init.method === "GET") {
      currentSessionRequests += 1;
      return jsonResponse(reconciledSession);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  api.storeAuthSession(activeSession);

  const logout = api.logoutCurrentUser();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(api.readAuthSession()?.user.id, "account-a");
  assert.equal(api.getAuthHydrationSnapshot(), "settled");
  deletion.resolve(jsonResponse({ message: "private upstream detail" }, 502));
  const outcome = await logout;
  assert.equal(outcome.status, "SESSION_ACTIVE");
  assert.equal(outcome.authority, "RECONCILED_ACTIVE");
  assert.equal(api.readAuthSession()?.user.id, "account-a");
  assert.equal(api.readAuthSession()?.idleExpiresAt, reconciledSession.idleExpiresAt);
  assert.equal(api.getAuthHydrationSnapshot(), "settled");
  assert.equal(currentSessionRequests, 1);

  const { api: reloadedApi } = await loadApiClient(async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/auth/browser-sessions/current") && init.method === "GET") {
      return jsonResponse(activeSession);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  const reloadedSession = await reloadedApi.hydrateAuthSession();
  assert.equal(reloadedSession?.user.id, "account-a");
  assert.equal(reloadedApi.getAuthHydrationSnapshot(), "settled");
});

test("lost DELETE acknowledgement reconciles a committed server revocation as an explicit logout", async () => {
  const requests = [];
  const { api } = await loadApiClient(async (input, init = {}) => {
    const url = String(input);
    requests.push(`${init.method ?? "GET"} ${url}`);
    if (url.endsWith("/auth/browser-sessions/current") && init.method === "DELETE") {
      throw new Error("connection lost after server commit");
    }
    if (url.endsWith("/auth/browser-sessions/current") && init.method === "GET") {
      return jsonResponse({ code: "AUTHENTICATION_REQUIRED" }, 401);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  api.storeAuthSession(browserSession("account-a"));

  const outcome = await api.logoutCurrentUser();

  assert.equal(outcome.status, "LOGGED_OUT");
  assert.equal(outcome.authority, "RECONCILED_401");
  assert.equal(api.readAuthSession(), null);
  assert.equal(api.getAuthHydrationSnapshot(), "settled");
  assert.deepEqual(requests, [
    "DELETE /api/v1/auth/browser-sessions/current",
    "GET /api/v1/auth/browser-sessions/current",
  ]);
});

test("failed DELETE plus failed reconciliation enters a privacy-blocking state until retry succeeds", async () => {
  let reconciliationAttempts = 0;
  const activeSession = browserSession("account-a");
  const { api } = await loadApiClient(async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/auth/browser-sessions/current") && init.method === "DELETE") {
      return jsonResponse({ code: "BFF_UPSTREAM_UNAVAILABLE" }, 502);
    }
    if (url.endsWith("/auth/browser-sessions/current") && init.method === "GET") {
      reconciliationAttempts += 1;
      if (reconciliationAttempts === 1) {
        return jsonResponse({ code: "BFF_UPSTREAM_UNAVAILABLE" }, 502);
      }
      return jsonResponse(activeSession);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  api.storeAuthSession(activeSession);

  await assert.rejects(api.logoutCurrentUser(), (error) => {
    assert.equal(error.code, "BROWSER_SESSION_AUTHORITY_INDETERMINATE");
    assert.doesNotMatch(error.message, /BFF_UPSTREAM_UNAVAILABLE/i);
    return true;
  });
  assert.equal(api.readAuthSession(), null);
  assert.equal(api.getAuthHydrationSnapshot(), "indeterminate");

  const recovered = await api.hydrateAuthSession(true);
  assert.equal(recovered?.user.id, "account-a");
  assert.equal(api.getAuthHydrationSnapshot(), "settled");
  assert.equal(reconciliationAttempts, 2);
});

test("logout reconciliation refuses a different user or different absolute session lifetime", async () => {
  const activeSession = browserSession("account-a");
  const mismatches = [
    browserSession("account-b"),
    { ...activeSession, absoluteExpiresAt: "2026-08-26T23:59:00Z" },
  ];

  for (const reconciledSession of mismatches) {
    const { api } = await loadApiClient(async (input, init = {}) => {
      const url = String(input);
      if (url.endsWith("/auth/browser-sessions/current") && init.method === "DELETE") {
        return jsonResponse({ code: "BFF_UPSTREAM_UNAVAILABLE" }, 502);
      }
      if (url.endsWith("/auth/browser-sessions/current") && init.method === "GET") {
        return jsonResponse(reconciledSession);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    api.storeAuthSession(activeSession);

    await assert.rejects(api.logoutCurrentUser(), (error) => {
      assert.equal(error.code, "BROWSER_SESSION_AUTHORITY_INDETERMINATE");
      return true;
    });
    assert.equal(api.readAuthSession(), null);
    assert.equal(api.getAuthHydrationSnapshot(), "indeterminate");
  }
});

test("an aborted logout cannot clear or restore over a newer successful login", async () => {
  const { api } = await loadApiClient(async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/auth/browser-sessions/current") && init.method === "DELETE") {
      return new Promise((_resolve, reject) => {
        const rejectAbort = () => {
          const error = new Error("private abort detail");
          error.name = "AbortError";
          reject(error);
        };
        if (init.signal?.aborted) rejectAbort();
        else init.signal?.addEventListener("abort", rejectAbort, { once: true });
      });
    }
    if (url.endsWith("/auth/browser-sessions") && init.method === "POST") {
      return jsonResponse(browserSession("account-b"));
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  api.storeAuthSession(browserSession("account-a"));

  const obsoleteLogout = api.logoutCurrentUser();
  const obsoleteLogoutRejected = assert.rejects(obsoleteLogout, (error) => {
    assert.equal(error.code, "AUTH_MUTATION_SUPERSEDED");
    assert.doesNotMatch(error.message, /private abort detail/i);
    return true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  const loggedIn = await api.login({ email: "b@example.test", password: "not-real" });
  await obsoleteLogoutRejected;

  assert.equal(loggedIn.user.id, "account-b");
  assert.equal(api.readAuthSession()?.user.id, "account-b");
  assert.equal(api.getAuthHydrationSnapshot(), "settled");
});

test("email verification creates a browser session grant without bearer material", async () => {
  let observed;
  const { api } = await loadApiClient(async (input, init = {}) => {
    observed = { input: String(input), init };
    return jsonResponse(browserSession("verified-patient"));
  });

  const session = await api.verifyEmail({ email: "patient@example.test", code: "123456" });
  assert.equal(observed.input, "/api/v1/auth/browser-sessions");
  assert.deepEqual(JSON.parse(String(observed.init.body)), {
    grantType: "EMAIL_VERIFICATION",
    email: "patient@example.test",
    code: "123456",
  });
  assert.deepEqual(Object.keys(session).sort(), ["absoluteExpiresAt", "idleExpiresAt", "user"]);
  assert.doesNotMatch(JSON.stringify(session), /accessToken|refreshToken|tokenType|Bearer/i);
});
