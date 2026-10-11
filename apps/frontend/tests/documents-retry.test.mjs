import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

// Recovery uses a distinct fresh-copy endpoint; ordinary generation may still
// update a stale reminder. Keep download, actor/source and single-flight guards.
function buttonBlock(page, anchor) {
  const at = page.indexOf(anchor);
  assert.notEqual(at, -1, `Missing control: ${anchor}`);
  const start = page.lastIndexOf("<button", at);
  const end = page.indexOf("</button>", at);
  assert.ok(start !== -1 && end !== -1, `Missing button: ${anchor}`);
  return page.slice(start, end);
}

test("FAILED recovery creates a distinct copy and preserves original history", async () => {
  const [page, client] = await Promise.all([read("app/patient/documents/page.tsx"), read("lib/api-client.ts")]);
  assert.match(page, /Bản cũ chưa tạo thành công\..*lịch sử bản cũ vẫn được giữ\./);
  assert.match(page, /!replacementsByOriginal\.has\(document\.id\) && \(document\.status === "FAILED" \|\| downloadIssues\[document\.id\]\?\.recoverable\)/);
  assert.match(page, /\["AVAILABLE", "FAILED"\]\.includes\(document\.status\) && document\.sourceEligible !== false/);
  assert.match(page, /&& !downloadIssues\[document\.id\]\?\.refreshRequired/);
  const recovery = buttonBlock(page, '"Tạo lại PDF"');
  assert.match(recovery, /className="outline-button outline-button--small"/);
  assert.match(recovery, /disabled=\{!DOCUMENT_GENERATION_ENABLED \|\| generatingKey !== null \|\| downloadingId !== null\}/);
  assert.match(recovery, /onClick=\{\(\) => void handleRegenerate\(document\)\}/);
  assert.doesNotMatch(recovery, /handleGenerate/);
  assert.match(recovery, /generatingKey === `RECOVERY:\$\{document\.id\}` \? "Đang tạo lại…"/);
  const handler = page.slice(page.indexOf("const handleRegenerate"), page.indexOf("const handleDownload"));
  assert.match(handler, /actionInFlight\.current/);
  assert.match(handler, /document\.sourceEligible === false/);
  assert.match(handler, /regeneratePatientDocument\(profile\.data\.id, document\.id\)/);
  assert.match(handler, /isStale\(expectedSession, runId\)/);
  assert.match(page, /document\.regeneratedFromDocumentId/);
  assert.match(page, /Xem bản cũ trong lịch sử/);
  assert.match(page, /Xem bản PDF mới/);
  assert.match(client, /documents\/\$\{encodeURIComponent\(documentId\)\}\/regenerate/);
});

test("recovery never unlocks a non-AVAILABLE or stale-source download", async () => {
  const page = await read("app/patient/documents/page.tsx");
  const download = buttonBlock(page, '"Tải PDF"');
  assert.match(download, /disabled=\{document\.status !== "AVAILABLE" \|\| document\.sourceCurrent === false \|\| downloadingId !== null \|\| generatingKey !== null\}/);
  assert.doesNotMatch(download, /handleGenerate|handleRegenerate|sourceRecordId/);
  assert.match(page, /document\.status !== "AVAILABLE" \|\| document\.sourceCurrent === false \|\| actionInFlight\.current\) return/);
});

test("retry errors stay fail-closed with friendly transient503 and integrity copy", async () => {
  const [page, present] = await Promise.all([read("app/patient/documents/page.tsx"), read("lib/present-api-error.ts")]);
  assert.match(page, /presentApiError\(error\.code, error\.status\)/);
  assert.doesNotMatch(page, /\b(?:error|reason|cause|exception)\.message\b/iu);
  assert.doesNotMatch(page, /\bfetch\(/);
  assert.match(page, /error instanceof ApiError && \[\s*"DOCUMENT_CONTENT_UNAVAILABLE", "DOWNLOAD_HASH_MISMATCH", "DOWNLOAD_SIZE_MISMATCH",\s*\]\.includes\(error\.code \?\? ""\)/);
  assert.match(page, /refreshRequired: \[403, 404, 409\]\.includes/);
  assert.match(present, /SERVICE_UNAVAILABLE:\s*"Dịch vụ đang tạm thời gián đoạn\. Vui lòng thử lại sau\."/);
  assert.match(present, /503:\s*"Hệ thống đang tạm gián đoạn\. Vui lòng thử lại sau\."/);
});
