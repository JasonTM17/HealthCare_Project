import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const doctorPagePath = new URL("../app/doctor/dashboard/page.tsx", import.meta.url);

function loadFunction(source, name) {
  const sourceFile = ts.createSourceFile(
    "doctor-dashboard.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declaration = sourceFile.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `${name} must exist in the doctor dashboard`);

  const snippet = declaration.getText(sourceFile).replace(/^export\s+/, "");
  const compiled = ts.transpileModule(
    `${snippet}\nmodule.exports = ${name};`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("out-of-order patient responses can commit only the latest patient context", async () => {
  const source = await readFile(doctorPagePath, "utf8");
  const createPatientLookupFence = loadFunction(source, "createPatientLookupFence");
  const fence = createPatientLookupFence();
  const patientA = deferred();
  const patientB = deferred();
  const committed = [];

  const load = async (patientId, response) => {
    const requestId = fence.begin();
    const phi = await response;
    if (fence.isCurrent(requestId)) committed.push({ patientId, phi });
  };

  const requestA = load("patient-a", patientA.promise);
  const requestB = load("patient-b", patientB.promise);
  patientB.resolve("patient-b-records");
  await requestB;
  patientA.resolve("patient-a-records");
  await requestA;

  assert.deepEqual(committed, [{ patientId: "patient-b", phi: "patient-b-records" }]);

  const invalidatedRequest = fence.begin();
  fence.invalidate();
  assert.equal(fence.isCurrent(invalidatedRequest), false);

  const loadPatientStart = source.indexOf("const loadPatient = async");
  const loadPatientEnd = source.indexOf("const handleLookup", loadPatientStart);
  const loadPatient = source.slice(loadPatientStart, loadPatientEnd);
  assert.match(loadPatient, /const requestId = patientLookupFence\.begin\(\)/);
  assert.match(loadPatient, /if \(!patientLookupFence\.isCurrent\(requestId\)\) return;/);
  assert.ok(
    loadPatient.indexOf("patientLookupFence.isCurrent(requestId)")
      < loadPatient.indexOf("const unauthorized"),
    "a stale unauthorized response must be fenced before it can clear the active session",
  );
});
