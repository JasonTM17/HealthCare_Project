import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const helperPath = new URL("../lib/server/healthcare-bff.ts", import.meta.url);

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

test("BFF automatically fails over to backup backend when primary returns 502", async () => {
  const bff = await loadBff();
  bff.markPrimaryBackendUp();

  const calls = [];
  const mockFetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://primary-backend.example.com")) {
      return new Response("Bad Gateway", { status: 502 });
    }
    if (url.startsWith("https://backup-backend.example.com")) {
      return new Response(JSON.stringify({ branches: 23, from: "backup" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Not Found", { status: 404 });
  };

  const runtimeConfig = {
    backendOrigin: "https://primary-backend.example.com",
    backupBackendOrigin: "https://backup-backend.example.com",
    serviceToken: "synthetic-bff-service-token-at-least-32-bytes",
    requestTimeoutMs: 5_000,
  };

  const request = new Request("https://www.healthcare.id.vn/api/v1/hospital/branches", {
    method: "GET",
  });

  const response = await bff.proxyHealthcareRequest(request, ["hospital", "branches"], {
    fetchImpl: mockFetch,
    runtimeConfig,
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data, { branches: 23, from: "backup" });

  assert.equal(calls.length, 2);
  assert.match(calls[0], /^https:\/\/primary-backend\.example\.com/);
  assert.match(calls[1], /^https:\/\/backup-backend\.example\.com/);
});

test("BFF automatically fails over to backup backend on network error", async () => {
  const bff = await loadBff();
  bff.markPrimaryBackendUp();

  const calls = [];
  const mockFetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://primary-backend.example.com")) {
      throw new Error("Connection refused: primary is sleeping or dead");
    }
    if (url.startsWith("https://backup-backend.example.com")) {
      return new Response(JSON.stringify({ status: "backup_recovered" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Not Found", { status: 404 });
  };

  const runtimeConfig = {
    backendOrigin: "https://primary-backend.example.com",
    backupBackendOrigin: "https://backup-backend.example.com",
    serviceToken: "synthetic-bff-service-token-at-least-32-bytes",
    requestTimeoutMs: 5_000,
  };

  const request = new Request("https://www.healthcare.id.vn/api/v1/hospital/branches", {
    method: "GET",
  });

  const response = await bff.proxyHealthcareRequest(request, ["hospital", "branches"], {
    fetchImpl: mockFetch,
    runtimeConfig,
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data, { status: "backup_recovered" });

  assert.equal(calls.length, 2);
  assert.match(calls[0], /^https:\/\/primary-backend\.example\.com/);
  assert.match(calls[1], /^https:\/\/backup-backend\.example\.com/);
});

test("BFF routes immediately to backup backend during active primary outage window", async () => {
  const bff = await loadBff();
  // Mark primary as down for 10 seconds:
  bff.markPrimaryBackendDown(10_000);

  const calls = [];
  const mockFetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://backup-backend.example.com")) {
      return new Response(JSON.stringify({ status: "direct_backup" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Not Found", { status: 404 });
  };

  const runtimeConfig = {
    backendOrigin: "https://primary-backend.example.com",
    backupBackendOrigin: "https://backup-backend.example.com",
    serviceToken: "synthetic-bff-service-token-at-least-32-bytes",
    requestTimeoutMs: 5_000,
  };

  const request = new Request("https://www.healthcare.id.vn/api/v1/hospital/branches", {
    method: "GET",
  });

  const response = await bff.proxyHealthcareRequest(request, ["hospital", "branches"], {
    fetchImpl: mockFetch,
    runtimeConfig,
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data, { status: "direct_backup" });

  // During outage, call goes directly to backup without wasting time on primary:
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/backup-backend\.example\.com/);
});
