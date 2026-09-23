import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

/**
 * The doctor dashboard maps every failed call through getErrorMessage. For a
 * while a rejected appointment update (the backend's 409 "Chỉ có thể tiếp nhận
 * lịch khám trong ngày hôm nay") was flattened to the generic "information
 * changed" line, so the doctor could not tell a stale-day booking from a real
 * conflict. These cases pin the pass-through for an authored Vietnamese 400/409
 * and the generic fallback for everything else.
 */

const doctorPagePath = new URL("../app/doctor/dashboard/page.tsx", import.meta.url);

function loadErrorMapper(source) {
  const sourceFile = ts.createSourceFile(
    "doctor-dashboard.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const wanted = new Set(["getErrorStatus", "backendMessage", "getErrorMessage"]);
  const bodies = [...sourceFile.statements]
    .filter((statement) => ts.isFunctionDeclaration(statement) && statement.name && wanted.has(statement.name.text))
    .map((statement) => statement.getText(sourceFile).replace(/^export\s+/, ""));
  assert.equal(bodies.length, wanted.size, "all three error helpers must exist in the dashboard");

  // The real page imports ApiError from api-client; the extracted copy needs a
  // same-scope class so `instanceof ApiError` resolves inside the VM.
  const compiled = ts.transpileModule(
    [
      "class ApiError extends Error {",
      "  constructor(message, status) { super(message); this.name = 'ApiError'; this.status = status; }",
      "}",
      ...bodies,
      "module.exports = { getErrorMessage, backendMessage, ApiError };",
    ].join("\n"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

const source = await readFile(doctorPagePath, "utf8");
const { getErrorMessage, backendMessage, ApiError } = loadErrorMapper(source);

test("an authored Vietnamese 409 surfaces verbatim on the appointment status action", () => {
  const error = new ApiError("Chỉ có thể tiếp nhận lịch khám trong ngày hôm nay", 409);
  assert.equal(getErrorMessage(error), "Chỉ có thể tiếp nhận lịch khám trong ngày hôm nay");
  assert.equal(backendMessage(error), "Chỉ có thể tiếp nhận lịch khám trong ngày hôm nay");
});

test("an authored Vietnamese 400 surfaces verbatim", () => {
  const error = new ApiError("Khoảng thời gian khám không hợp lệ.", 400);
  assert.equal(getErrorMessage(error), "Khoảng thời gian khám không hợp lệ.");
});

test("an unknown 500 falls back to the generic copy", () => {
  const error = new ApiError("Internal Server Error", 500);
  assert.equal(backendMessage(error), null);
  assert.equal(getErrorMessage(error), "Kết nối đang bị gián đoạn. Vui lòng thử lại sau ít phút.");
});

test("a non-Vietnamese or oversized 409 body does not override the generic line", () => {
  // The guard keeps server internals out of the UI: only real Vietnamese copy
  // the author can act on is surfaced; anything else uses the mapped table.
  assert.equal(
    getErrorMessage(new ApiError("STATUS_CONFLICT", 409)),
    "Thông tin đã thay đổi hoặc đã được ghi nhận. Vui lòng tải lại và kiểm tra.",
  );
  const longVietnamese = `Chỉ có thể tiếp nhận ${"lịch khám ".repeat(60)}`;
  assert.equal(backendMessage(new ApiError(longVietnamese, 409)), null);
});

test("an error that is not an ApiError uses the generic copy", () => {
  assert.equal(backendMessage(new Error("boom")), null);
  assert.equal(getErrorMessage(new Error("boom")), "Kết nối đang bị gián đoạn. Vui lòng thử lại sau ít phút.");
});
