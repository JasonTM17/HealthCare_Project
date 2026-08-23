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

function createSession(account, suffix = "") {
  const normalizedSuffix = suffix ? `-${suffix}` : "";
  return {
    accessToken: `access-${account}${normalizedSuffix}`,
    refreshToken: `refresh-${account}${normalizedSuffix}`,
    tokenType: "Bearer",
    expiresIn: 900,
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

function createSessionStorageWindow() {
  const values = new Map();
  return {
    addEventListener() {},
    dispatchEvent() {},
    removeEventListener() {},
    sessionStorage: {
      getItem(key) {
        return values.get(key) ?? null;
      },
      removeItem(key) {
        values.delete(key);
      },
      setItem(key, value) {
        values.set(key, String(value));
      },
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
    process: { env: { NEXT_PUBLIC_API_BASE_URL: "/api/v1" } },
    Response,
    setTimeout,
    URL,
    URLSearchParams,
    window: createSessionStorageWindow(),
  });
  const loadModule = new vm.Script(
    `(function (exports, require, module) {${transpiled.outputText}\n})`,
    { filename: "api-client.compiled.cjs" },
  ).runInContext(context);
  loadModule(compiledModule.exports, (specifier) => {
    throw new Error(`Unexpected runtime import: ${specifier}`);
  }, compiledModule);
  return compiledModule.exports;
}

function createFetchHarness() {
  const refreshA = deferred();
  const refreshB = deferred();
  const refreshRequests = [];
  const protectedRequests = [];
  const sessionB = createSession("b");

  const fetchImplementation = (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/auth/login")) return jsonResponse(sessionB);
    if (url.endsWith("/auth/logout")) return new Response(null, { status: 204 });
    if (url.endsWith("/auth/refresh")) {
      const refreshToken = JSON.parse(String(init.body)).refreshToken;
      refreshRequests.push(refreshToken);
      if (refreshToken === "refresh-a") return refreshA.promise;
      if (refreshToken === "refresh-b") return refreshB.promise;
      throw new Error(`Unexpected refresh token: ${refreshToken}`);
    }
    if (url.endsWith("/users/me")) {
      const authorization = new Headers(init.headers).get("Authorization");
      protectedRequests.push(authorization);
      if (authorization === "Bearer access-a" || authorization === "Bearer access-b") {
        return jsonResponse({ message: "expired" }, 401);
      }
      if (authorization === "Bearer access-a-refreshed") {
        return jsonResponse({ id: "a", roles: ["PATIENT"] });
      }
      if (authorization === "Bearer access-b-refreshed") {
        return jsonResponse({ id: "b", roles: ["PATIENT"] });
      }
      throw new Error(`Unexpected authorization: ${authorization}`);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  return {
    fetchImplementation,
    protectedRequests,
    refreshA,
    refreshB,
    refreshRequests,
    sessionB,
  };
}

async function waitForRefreshCount(harness, count) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (harness.refreshRequests.length >= count) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test("late refresh A cannot overwrite login B or clear B's refresh flight", async () => {
  const harness = createFetchHarness();
  const api = await loadApiClient(harness.fetchImplementation);
  api.storeAuthSession(createSession("a"));

  const requestA = api.fetchCurrentUser();
  await waitForRefreshCount(harness, 1);
  await api.login({ email: "b@example.test", password: "not-used" });
  const requestB = api.fetchCurrentUser();

  try {
    await waitForRefreshCount(harness, 2);
    assert.deepEqual(harness.refreshRequests, ["refresh-a", "refresh-b"]);

    harness.refreshA.resolve(jsonResponse(createSession("a", "refreshed")));
    await assert.rejects(
      requestA,
      (error) => error instanceof api.ApiError && error.status === 401,
    );
    assert.equal(api.readAuthSession()?.user.id, "b");
    assert.equal(api.readAuthSession()?.accessToken, "access-b");

    const secondRequestB = api.fetchCurrentUser();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(
      harness.refreshRequests,
      ["refresh-a", "refresh-b"],
      "refresh A's finally handler must not clear B's active refresh flight",
    );

    harness.refreshB.resolve(jsonResponse(createSession("b", "refreshed")));
    const [profileB, secondProfileB] = await Promise.all([requestB, secondRequestB]);
    assert.equal(profileB.id, "b");
    assert.equal(secondProfileB.id, "b");
    assert.equal(api.readAuthSession()?.user.id, "b");
    assert.equal(api.readAuthSession()?.accessToken, "access-b-refreshed");
  } finally {
    harness.refreshA.resolve(jsonResponse(createSession("a", "refreshed")));
    harness.refreshB.resolve(jsonResponse(createSession("b", "refreshed")));
    await Promise.allSettled([requestA, requestB]);
  }
});

test("logout invalidates an in-flight refresh so its late result cannot restore the session", async () => {
  const harness = createFetchHarness();
  const api = await loadApiClient(harness.fetchImplementation);
  api.storeAuthSession(createSession("a"));

  const protectedRequest = api.fetchCurrentUser();
  await waitForRefreshCount(harness, 1);

  try {
    await api.logoutCurrentUser();
    assert.equal(api.readAuthSession(), null);

    harness.refreshA.resolve(jsonResponse(createSession("a", "refreshed")));
    await assert.rejects(
      protectedRequest,
      (error) => error instanceof api.ApiError && error.status === 401,
    );
    assert.equal(api.readAuthSession(), null);
  } finally {
    harness.refreshA.resolve(jsonResponse(createSession("a", "refreshed")));
    await Promise.allSettled([protectedRequest]);
  }
});
