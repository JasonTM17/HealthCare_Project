import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadRequestHelper() {
  const source = await readFile(new URL("../lib/consultation-request.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("consultation request helper bounds a stalled fetch", async () => {
  const { fetchConsultationResponse, ConsultationRequestTimeoutError } = await loadRequestHelper();
  const controller = new AbortController();
  const request = fetchConsultationResponse("/patient/consultations/thread-1/reopen", {
    method: "POST",
    signal: controller.signal,
  }, {
    timeoutMs: 20,
    fetchImpl: async (_url, init) => {
      return new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    },
  });

  await assert.rejects(request, (error) => error instanceof ConsultationRequestTimeoutError);
  assert.equal(controller.signal.aborted, false, "helper timeout must not abort the caller's controller");
});

test("consultation request helper preserves caller cancellation", async () => {
  const { fetchConsultationResponse, ConsultationRequestTimeoutError } = await loadRequestHelper();
  const caller = new AbortController();
  const request = fetchConsultationResponse("/patient/consultations/thread-1/reopen", {
    method: "POST",
    signal: caller.signal,
  }, {
    timeoutMs: 1_000,
    fetchImpl: async (_url, init) => new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }),
  });

  caller.abort();
  await assert.rejects(request, (error) => error instanceof DOMException && error.name === "AbortError");
});

test("consultation response body remains covered after response headers arrive", async () => {
  const { fetchConsultationResponseBody, ConsultationRequestTimeoutError } = await loadRequestHelper();
  const caller = new AbortController();
  const request = fetchConsultationResponseBody("/patient/consultations/thread-1", {
    signal: caller.signal,
  }, {
    timeoutMs: 20,
    fetchImpl: async (_url, init) => new Response(new ReadableStream({
      start(controller) {
        init.signal.addEventListener("abort", () => {
          controller.error(new DOMException("aborted", "AbortError"));
        }, { once: true });
      },
    }), { status: 200 }),
  });

  await assert.rejects(request, (error) => error instanceof ConsultationRequestTimeoutError);
  assert.equal(caller.signal.aborted, false, "body timeout must not abort the caller's controller");
});

test("caller cancellation still reaches a response body after headers arrive", async () => {
  const { fetchConsultationResponseBody } = await loadRequestHelper();
  const caller = new AbortController();
  let bodyStarted;
  const bodyReady = new Promise((resolve) => { bodyStarted = resolve; });
  const request = fetchConsultationResponseBody("/patient/consultations/thread-1", {
    signal: caller.signal,
  }, {
    timeoutMs: 1_000,
    fetchImpl: async (_url, init) => new Response(new ReadableStream({
      start(controller) {
        bodyStarted();
        init.signal.addEventListener("abort", () => {
          controller.error(new DOMException("aborted", "AbortError"));
        }, { once: true });
      },
    }), { status: 200 }),
  });

  await bodyReady;
  caller.abort();
  await assert.rejects(request, (error) => error instanceof DOMException && error.name === "AbortError");
});

test("direct signed upload helper bounds a stalled object-store response", async () => {
  const { fetchConsultationUploadResponse, ConsultationRequestTimeoutError } = await loadRequestHelper();
  let capturedCredentials;
  const request = fetchConsultationUploadResponse("https://objects.example.test/private/upload", {
    method: "PUT",
    body: "payload",
  }, {
    timeoutMs: 20,
    fetchImpl: async (_url, init) => {
      capturedCredentials = init.credentials;
      return new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    },
  });

  await assert.rejects(request, (error) => error instanceof ConsultationRequestTimeoutError);
  assert.equal(capturedCredentials, "omit", "signed object-store uploads must not receive session credentials");
});

test("consultation helper preserves an explicit credentials override", async () => {
  const { fetchConsultationResponse } = await loadRequestHelper();
  let capturedCredentials;
  const response = await fetchConsultationResponse("/patient/consultations/thread-1", {
    credentials: "omit",
  }, {
    fetchImpl: async (_url, init) => {
      capturedCredentials = init.credentials;
      return new Response("ok", { status: 200 });
    },
  });
  assert.equal(response.status, 200);
  assert.equal(capturedCredentials, "omit");
});
