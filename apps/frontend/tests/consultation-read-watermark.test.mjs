import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const helperPath = new URL("../lib/consultation-read-watermark.ts", import.meta.url);

async function loadReconciler() {
  const source = await readFile(helperPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "consultation-read-watermark.ts",
    reportDiagnostics: true,
  });
  const compileErrors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(compileErrors.length, 0, "read-watermark helper must transpile for the behavior harness");

  const compiledModule = { exports: {} };
  const context = vm.createContext({ module: compiledModule, Set });
  const loadModule = new vm.Script(
    `(function (exports, require, module) {${transpiled.outputText}\n})`,
    { filename: "consultation-read-watermark.compiled.cjs" },
  ).runInContext(context);
  loadModule(compiledModule.exports, (specifier) => {
    throw new Error(`Unexpected runtime import: ${specifier}`);
  }, compiledModule);
  return compiledModule.exports.reconcileConsultationServerPage;
}

const reconcileConsultationServerPage = await loadReconciler();

const schedules = [
  {
    role: "patient",
    viewerUserId: "patient-user",
    remoteUserId: "doctor-user",
  },
  {
    role: "doctor",
    viewerUserId: "doctor-user",
    remoteUserId: "patient-user",
  },
];

for (const { role, viewerUserId, remoteUserId } of schedules) {
  test(`${role} watermark is derived from the completed server snapshot, not a later local own message`, () => {
    const loadedRemote = {
      id: `${role}-remote-n`,
      authorUserId: remoteUserId,
      sequenceNumber: 10,
    };
    const unseenRemote = {
      id: `${role}-remote-n-plus-1`,
      authorUserId: remoteUserId,
      sequenceNumber: 11,
    };
    const locallyAppendedOwn = {
      id: `${role}-own-n-plus-2`,
      authorUserId: viewerUserId,
      sequenceNumber: 12,
    };

    const serverSnapshot = reconcileConsultationServerPage(
      [],
      { items: [loadedRemote], nextCursor: null, hasMore: false },
      viewerUserId,
      null,
    );
    const renderedTranscript = [...serverSnapshot.messages, locallyAppendedOwn];

    assert.equal(serverSnapshot.complete, true);
    assert.equal(serverSnapshot.readWatermark, loadedRemote.id);
    assert.equal(renderedTranscript.at(-1)?.id, locallyAppendedOwn.id);
    assert.notEqual(serverSnapshot.readWatermark, locallyAppendedOwn.id);
    assert.equal(
      serverSnapshot.messages.some((message) => message.id === unseenRemote.id),
      false,
      "a remote message created after the completed response remains outside that response snapshot",
    );
  });

  test(`${role} fails closed when a continuing page repeats the requested cursor`, () => {
    const requestedCursor = `${role}-cursor-10`;
    const snapshot = reconcileConsultationServerPage(
      [{ id: `${role}-remote-10`, authorUserId: remoteUserId }],
      {
        items: [{ id: `${role}-remote-11`, authorUserId: remoteUserId }],
        nextCursor: requestedCursor,
        hasMore: true,
      },
      viewerUserId,
      requestedCursor,
    );

    assert.equal(snapshot.stalled, true);
    assert.equal(snapshot.complete, false);
    assert.equal(snapshot.readWatermark, null);
  });

  test(`${role} fails closed when the initial page claims more data without a cursor`, () => {
    const snapshot = reconcileConsultationServerPage(
      [],
      {
        items: [{ id: `${role}-remote-initial`, authorUserId: remoteUserId }],
        nextCursor: null,
        hasMore: true,
      },
      viewerUserId,
      null,
    );

    assert.equal(snapshot.stalled, true);
    assert.equal(snapshot.complete, false);
    assert.equal(snapshot.readWatermark, null);
  });

  test(`${role} completes an advancing final page, dedupes messages, and selects the latest remote watermark`, () => {
    const duplicate = { id: `${role}-remote-20`, authorUserId: remoteUserId };
    const firstPage = reconcileConsultationServerPage(
      [],
      {
        items: [duplicate],
        nextCursor: `${role}-cursor-20`,
        hasMore: true,
      },
      viewerUserId,
      null,
    );

    assert.equal(firstPage.stalled, false);
    assert.equal(firstPage.complete, false);
    assert.equal(firstPage.readWatermark, null);

    const ownMessage = { id: `${role}-own-21`, authorUserId: viewerUserId };
    const latestRemote = { id: `${role}-remote-22`, authorUserId: remoteUserId };
    const completed = reconcileConsultationServerPage(
      firstPage.messages,
      {
        items: [duplicate, ownMessage, latestRemote],
        nextCursor: null,
        hasMore: false,
      },
      viewerUserId,
      firstPage.nextCursor,
    );

    assert.equal(completed.stalled, false);
    assert.equal(completed.complete, true);
    assert.equal(completed.readWatermark, latestRemote.id);
    assert.deepEqual(
      Array.from(completed.messages, (message) => message.id),
      [duplicate.id, ownMessage.id, latestRemote.id],
    );
  });
}
