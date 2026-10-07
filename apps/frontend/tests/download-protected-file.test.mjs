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

async function loadApiClient({ contentDisposition, bodyBytes } = {}) {
  const source = await readFile(apiClientPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "api-client.ts",
    reportDiagnostics: true,
  });
  const compileErrors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(compileErrors.length, 0, "api-client.ts must transpile for the download harness");

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
    inBodyAtClick: null,
    click() {
      anchor.inBodyAtClick = body.children.has(anchor);
      events.push("click");
    },
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

  const timers = [];
  const window = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
    setTimeout(fn, _ms) {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout() {},
  };

  const created = [];
  const revoked = [];
  class FakeURL extends URL {
    static createObjectURL(blob) {
      created.push(blob);
      return `blob:test-${created.length}`;
    }
    static revokeObjectURL(url) {
      revoked.push(url);
      events.push("revoke");
    }
  }

  const headers = new Headers();
  if (contentDisposition !== undefined) headers.set("Content-Disposition", contentDisposition);
  const fetchImpl = async () =>
    new Response(bodyBytes ?? new Uint8Array([1, 2, 3]), { status: 200, headers });

  const compiledModule = { exports: {} };
  const context = vm.createContext({
    AbortController,
    Blob,
    crypto,
    clearTimeout,
    console,
    DOMException,
    Event,
    fetch: fetchImpl,
    Headers,
    module: compiledModule,
    process: { env: {} },
    Response,
    ReadableStream,
    setTimeout,
    TextDecoder,
    URL: FakeURL,
    URLSearchParams,
    window,
    document,
  });
  const capabilityModule = { exports: {} };
  const capabilityTranspiled = ts.transpileModule(await readFile(capabilityPath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "chat-chunked-capability.ts",
  });
  new vm.Script(
    `(function (exports, require, module) {${capabilityTranspiled.outputText}\n})`,
    { filename: "chat-chunked-capability.compiled.cjs" },
  ).runInContext(context)(capabilityModule.exports, () => {
    throw new Error("capability module has no runtime imports");
  }, capabilityModule);
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
  api.storeAuthSession(browserSession("download-account"));

  return {
    api,
    anchor,
    events,
    created,
    revoked,
    flush() {
      for (const fn of timers.splice(0)) fn();
    },
  };
}

// Mirrors Spring ContentDisposition.attachment().filename(name, UTF_8) as sent by
// FileController.download (apps/backend .../storage/controller/FileController.java).
const RFC5987_HEADER =
  "attachment; filename*=UTF-8''T%E1%BB%95ng%20ph%C3%A2n%20t%C3%ADch%20t%E1%BA%BF%20b%C3%A0o%20m%C3%A1u.pdf";

test("downloadProtectedFile keeps the server RFC 5987 filename and defers revoke", async () => {
  const harness = await loadApiClient({ contentDisposition: RFC5987_HEADER });
  await harness.api.downloadProtectedFile("/files/abc-123", "Tổng phân tích tế bào máu");

  assert.equal(
    harness.anchor.download,
    "Tổng phân tích tế bào máu.pdf",
    "filename* from Content-Disposition must win over the caller fallback (which has no extension)",
  );
  assert.equal(harness.anchor.rel, "noopener");
  assert.equal(harness.anchor.inBodyAtClick, true, "anchor must be in document.body before click()");
  assert.equal(harness.created.length, 1);
  assert.deepEqual(harness.events, ["append", "click", "remove"], "revoke must not run synchronously");
  assert.equal(harness.revoked.length, 0, "URL.revokeObjectURL must not fire before the deferred callback");
  harness.flush();
  assert.deepEqual(harness.revoked, ["blob:test-1"], "revoke must run via window.setTimeout(...,0)");
});

test("downloadProtectedFile falls back to the basic filename= parameter", async () => {
  const harness = await loadApiClient({
    contentDisposition: 'attachment; filename="ket-qua-xet-nghiem.pdf"',
  });
  await harness.api.downloadProtectedFile("/files/abc-456", "Tổng hợp");
  assert.equal(harness.anchor.download, "ket-qua-xet-nghiem.pdf");
});

test("downloadProtectedFile prefers filename* over filename= when both are present", async () => {
  const harness = await loadApiClient({
    contentDisposition: `attachment; filename="fall-back.pdf"; ${RFC5987_HEADER}`,
  });
  await harness.api.downloadProtectedFile("/files/abc-789", "Tổng hợp");
  assert.equal(harness.anchor.download, "Tổng phân tích tế bào máu.pdf");
});

test("downloadProtectedFile uses the caller filename only when the header is absent", async () => {
  const harness = await loadApiClient({ contentDisposition: undefined });
  await harness.api.downloadProtectedFile("/files/abc-000", "ket-qua");
  assert.equal(harness.anchor.download, "ket-qua");
});

test("downloadProtectedFile survives a broken percent-encoded filename*", async () => {
  const harness = await loadApiClient({
    contentDisposition: "attachment; filename*=UTF-8''%E0%A4%A; filename=\"report.pdf\"",
  });
  await harness.api.downloadProtectedFile("/files/abc-bad", "ket-qua");
  assert.equal(harness.anchor.download, "report.pdf");
});

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7 integrity-check-fixture");

test("downloadPatientDocument rejects bytes whose digest differs from the record sha256", async () => {
  const harness = await loadApiClient({ bodyBytes: PDF_BYTES });
  await assert.rejects(
    harness.api.downloadPatientDocument("patient-1", "doc-1", "ho-so.pdf", {
      byteSize: PDF_BYTES.length,
      sha256: "0".repeat(64),
    }),
    (error) => error.code === "DOWNLOAD_HASH_MISMATCH",
  );
  assert.equal(harness.created.length, 0, "a corrupted download must never reach the save dialog");
});

test("downloadPatientDocument saves bytes whose digest matches the record sha256", async () => {
  const digest = await crypto.subtle.digest("SHA-256", PDF_BYTES);
  const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const harness = await loadApiClient({ bodyBytes: PDF_BYTES });
  await harness.api.downloadPatientDocument("patient-1", "doc-1", "ho-so.pdf", {
    byteSize: PDF_BYTES.length,
    sha256,
  });
  assert.equal(harness.created.length, 1);
  assert.equal(harness.anchor.download, "ho-so.pdf");
});
