import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

async function loadPresenter() {
  const source = await read("lib/present-api-error.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("presentApiError exposes only closed Vietnamese copy", async () => {
  const { presentApiError } = await loadPresenter();

  assert.equal(
    presentApiError("AI_CONTENT_REVISION_STALE", 409),
    "Nội dung đã có phiên bản mới. Vui lòng tải lại trước khi tiếp tục.",
  );
  assert.equal(
    presentApiError("health_question_pii", 400),
    "Nội dung hỏi đáp có thông tin nhận dạng. Vui lòng xóa email, số điện thoại hoặc CCCD rồi thử lại.",
  );
  assert.equal(
    presentApiError("CONSULTATION_WINDOW_CLOSED", 409),
    "Cửa sổ tư vấn đã kết thúc. Vui lòng liên hệ bệnh viện nếu cần hỗ trợ thêm.",
  );
  assert.equal(
    presentApiError("UNKNOWN_SERVER_CODE", 503),
    "Hệ thống đang tạm gián đoạn. Vui lòng thử lại sau.",
  );
  assert.equal(
    presentApiError("BAD_REQUEST", 400),
    "Yêu cầu gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.",
  );
  assert.equal(
    presentApiError("SERVICE_UNAVAILABLE", 503),
    "Dịch vụ đang tạm thời gián đoạn. Vui lòng thử lại sau.",
  );
  assert.equal(
    presentApiError("RESOURCE_EXPIRED", 410),
    "Tài nguyên hoặc phiên làm việc đã hết hạn. Vui lòng thử lại.",
  );
  assert.equal(
    presentApiError("APPOINTMENT_CONFLICT", 409),
    "Khung giờ hoặc lịch hẹn đã có người đăng ký. Vui lòng chọn thời gian khác.",
  );
  assert.equal(
    presentApiError("DOCTOR_UNAVAILABLE", 409),
    "Bác sĩ hiện không có lịch tiếp nhận vào khung giờ này. Vui lòng chọn thời gian khác.",
  );
  assert.equal(
    presentApiError("PAYMENT_FAILED", 400),
    "Thanh toán không thành công. Vui lòng kiểm tra phương thức và thử lại.",
  );
  assert.equal(
    presentApiError("jdbc:postgresql://internal-db/patient", 418),
    "Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.",
  );
});

test("safe-error surfaces never render raw caught Error.message", async () => {
  const files = [
    "app/page.tsx",
    "app/search/SearchPageClient.tsx",
    "app/specialties/page.tsx",
    "app/packages/page.tsx",
    "app/services/page.tsx",
    "app/benh-pho-bien/page.tsx",
    "app/patient/health-questions/page.tsx",
    "app/admin/health-questions/page.tsx",
    "app/doctor/health-questions/page.tsx",
    "app/patient/consultations/page.tsx",
    "app/admin/ai-content-reviews/page.tsx",
    "app/doctor/ai-content-reviews/page.tsx",
  ];

  for (const file of files) {
    const source = await read(file);
    assert.match(source, /presentApiError\(/, `${file} must use the closed presenter`);
    assert.doesNotMatch(
      source,
      /\b(?:error|reason|cause|createError)\.message\b/,
      `${file} must not render a caught error message`,
    );
  }
});

test("CMS public and admin surfaces present only stable error kind and status copy", async () => {
  const [liveSlot, editor] = await Promise.all([
    read("components/cms/CmsLiveSlot.tsx"),
    read("components/cms/CmsEditor.tsx"),
  ]);

  assert.match(liveSlot, /switch \(error\.kind\)/);
  assert.doesNotMatch(liveSlot, /\b(?:error|nextError)\.message\b/);
  assert.match(editor, /case "validation":[\s\S]*Dữ liệu CMS chưa hợp lệ/);
  assert.match(editor, /error\.status === 429/);
  assert.doesNotMatch(editor, /\b(?:error|apiError|cmsError|historyLoadError)\.message\b/);
  assert.doesNotMatch(editor, /apiError\.fieldErrors/);
});
