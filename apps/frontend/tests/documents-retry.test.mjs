import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

/**
 * Regression for the stuck-user report on /patient/documents: a FAILED card only
 * showed passive copy plus a locked "Tải PDF" button, and the only physical
 * retry path lived in the source panels above (useless once the source record
 * is no longer ACTIVE / listed). BE already supports in-place retry of a FAILED
 * row under the same idempotency key (DocumentService.java:116-139) and keeps
 * the row FAILED on a 503 storage failure, so the FE needs exactly one control:
 * a "Thử tạo lại" button on the FAILED card that reuses handleGenerate.
 *
 * Extract the <button> element whose label mentions `anchor`, so assertions pin
 * the retry control itself instead of some other button on the page. A missing
 * anchor is the RED state (pre-fix page.tsx) and fails loudly here.
 */
function buttonBlock(page, anchor) {
  const at = page.indexOf(anchor);
  assert.notEqual(at, -1, `page.tsx phải chứa "${anchor}"`);
  const start = page.lastIndexOf("<button", at);
  assert.notEqual(start, -1, `không tìm thấy thẻ <button> cho "${anchor}"`);
  const end = page.indexOf("</button>", at);
  assert.notEqual(end, -1, `button của "${anchor}" chưa đóng`);
  return page.slice(start, end);
}

test("FAILED document card exposes a retry control that reuses handleGenerate", async () => {
  const page = await read("app/patient/documents/page.tsx");

  // (d) The passive FAILED copy stays (users still need to know the row is
  // recorded for a safe retry) — the fix adds a control beside it.
  assert.match(page, /Tệp tạo lỗi đã được ghi nhận để thử lại an toàn\./);
  assert.match(page, /Thử tạo lại/);

  // (a) The retry renders only on FAILED rows, as a second FAILED-gated branch
  // in the same card: the status test now appears twice (copy + button), and
  // the button follows the acknowledgement copy within the card.
  const failedChecks = page.match(/document\.status === "FAILED"/g) ?? [];
  assert.ok(
    failedChecks.length >= 2,
    'nút "Thử tạo lại" phải được render có điều kiện theo document.status === "FAILED"',
  );
  assert.match(
    page,
    /document\.status === "FAILED" && !\(document\.sourceType === "APPOINTMENT_REMINDER" && document\.sourceEligible === false\) \? \(\s*<button/,
    "nhánh retry phải là conditional JSX trên FAILED và chặn reminder không còn hiệu lực",
  );
  const copyAt = page.indexOf("Tệp tạo lỗi đã được ghi nhận để thử lại an toàn");
  const retryAt = page.indexOf("Thử tạo lại");
  assert.ok(retryAt > copyAt, "nhãn retry phải đứng sau copy FAILED");
  assert.ok(
    !page.slice(copyAt, retryAt).includes("</article>"),
    "retry phải nằm trong cùng card với copy FAILED (không rơi sang section khác)",
  );

  // (b) Wiring: same outline-button styling and the same generation gate +
  // single-flight flag as the panel create buttons; payload comes straight off
  // the row (sourceType + sourceRecordId are exactly the two fields of
  // GeneratePatientDocumentPayload), so it works even when the source record
  // has left the visible lists.
  const retry = buttonBlock(page, "Thử tạo lại");
  assert.match(retry, /className="outline-button outline-button--small"/);
  assert.match(
    retry,
    /disabled=\{!DOCUMENT_GENERATION_ENABLED \|\| generatingKey !== null\}/,
    "retry phải honour cùng storage gate + single-flight như các nút tạo PDF khác",
  );
  assert.match(
    retry,
    /onClick=\{\(\) => void handleGenerate\(document\.sourceType, document\.sourceRecordId\)\}/,
    "retry phải gọi handleGenerate(document.sourceType, document.sourceRecordId)",
  );

  // Busy label keys off the per-row action id, matching the
  // `${sourceType}:${sourceRecordId}` generatingKey set in handleGenerate.
  assert.match(
    retry,
    /generatingKey === `\$\{document\.sourceType\}:\$\{document\.sourceRecordId\}` \? "Đang tạo lại…"/,
    'label busy "Đang tạo lại…" phải gate trên generatingKey khớp đúng row này',
  );
  assert.match(retry, /: "Thử tạo lại"/);
});

test("retry never unlocks download for a row that is not AVAILABLE", async () => {
  const page = await read("app/patient/documents/page.tsx");

  // (c) Download guard unchanged: a FAILED row stays non-downloadable (BE
  // answers 409 until storage succeeds); a successful retry flips the card via
  // upsertDocument -> AVAILABLE, which is the only way the button lights up.
  const download = buttonBlock(page, '"Tải PDF"');
  assert.match(
    download,
    /disabled=\{document\.status !== "AVAILABLE" \|\| document\.sourceCurrent === false \|\| downloadingId === document\.id\}/,
    "nút Tải PDF phải giữ guard status !== AVAILABLE và chặn tệp đã lỗi thời nguồn",
  );
  assert.doesNotMatch(
    download,
    /Thử tạo lại|sourceRecordId|handleGenerate/,
    "đường retry không được trộn vào control tải xuống",
  );
});

test("retry error path stays fail-closed and 503 storage outage maps to Vietnamese copy", async () => {
  const [page, present] = await Promise.all([
    read("app/patient/documents/page.tsx"),
    read("lib/present-api-error.ts"),
  ]);

  // handleGenerate's catch keeps the list untouched (row stays FAILED for the
  // next press) and routes errors through the code-owned presenter only.
  assert.match(page, /presentApiError\(error\.code, error\.status\)/);
  assert.doesNotMatch(page, /\b(?:error|reason|cause|exception)\.message\b/iu);
  assert.doesNotMatch(page, /\bfetch\(/);

  // (e) BE contract: storage disabled -> generate answers 503 with code
  // SERVICE_UNAVAILABLE (ApiError.java:37, ErrorCodes.java:64). Both the code
  // map and the status fallback must keep Vietnamese copy, so a retry pressed
  // against a downed store shows a sane notice instead of raw provider text.
  assert.match(present, /SERVICE_UNAVAILABLE:\s*"Dịch vụ đang tạm thời gián đoạn\. Vui lòng thử lại sau\."/);
  assert.match(present, /503:\s*"Hệ thống đang tạm gián đoạn\. Vui lòng thử lại sau\."/);
});
