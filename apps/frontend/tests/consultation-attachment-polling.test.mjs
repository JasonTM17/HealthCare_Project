import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../lib/consultation-attachment-polling.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const harnessModule = { exports: {} };
vm.runInNewContext(`(function(exports, module) {${compiled.outputText}\n})`,
  { Set, Promise, DOMException, setTimeout, clearTimeout })(harnessModule.exports, harnessModule);
const { pollConsultationAttachments: poll, waitForAttachmentPoll: wait } = harnessModule.exports;
const attachment = (id, scanStatus) => ({ id, scanStatus, mimeType: "application/pdf", sizeBytes: 10 });

test("poll waits for trusted CLEAN and stops requesting terminal attachments", async () => {
  const calls = [];
  const updates = [];
  const outcome = await poll({ ids: ["a", "b"], signal: new AbortController().signal, delayMs: 0,
    fetchStatus: async (id) => { calls.push(id); return attachment(id, id === "a" ? "REJECTED" : calls.length > 2 ? "CLEAN" : "PENDING"); },
    onUpdate: (items) => updates.push(...items),
  });
  assert.equal(outcome, "complete");
  assert.deepEqual(calls, ["a", "b", "b"]);
  assert.equal(updates.filter((item) => item.scanStatus === "CLEAN").length, 1);
});

test("outage and mismatched identity stay pending within the attempt budget", async () => {
  let calls = 0;
  const updates = [];
  const outcome = await poll({ ids: ["a"], signal: new AbortController().signal, maxAttempts: 3, delayMs: 0,
    fetchStatus: async () => { if (++calls < 3) throw new Error("private provider error"); return attachment("other", "CLEAN"); },
    onUpdate: (items) => updates.push(...items),
  });
  assert.equal(outcome, "pending");
  assert.equal(calls, 3);
  assert.equal(updates.length, 0);
});

test("aborted old thread cannot commit a late CLEAN response", async () => {
  const controller = new AbortController();
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  const updates = [];
  const job = poll({ ids: ["a"], signal: controller.signal,
    fetchStatus: () => pending, onUpdate: (items) => updates.push(...items) });
  controller.abort();
  resolve(attachment("a", "CLEAN"));
  await assert.rejects(job, { name: "AbortError" });
  assert.equal(updates.length, 0);
});

test("abort cancels the scheduled next poll immediately", async () => {
  const controller = new AbortController();
  const waiting = wait(60_000, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: "AbortError" });
});
