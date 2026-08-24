import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("patient consultation UI keeps private-channel boundaries visible", () => {
  const page = read("app/patient/consultations/[id]/page.tsx");
  const client = read("lib/api-client.ts");
  assert.match(page, /Idempotency|sendPatientConsultationMessage/);
  assert.match(page, /Không gửi ảnh\/PDF cho chatbot/);
  assert.match(client, /\/patient\/consultations/);
  assert.match(page, /aria-live/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
});

test("common-disease routes are real backend-driven routes", () => {
  const hub = read("app/benh-pho-bien/page.tsx");
  const detail = read("app/benh-pho-bien/[slug]/page.tsx");
  assert.match(hub, /DISEASE_GUIDE/);
  assert.match(hub, /fetchPublishedHealthQuestions/);
  assert.match(hub, /reportPublishedHealthQuestion/);
  assert.match(hub, /Báo cáo nội dung/);
  assert.match(detail, /fetchArticleBySlug/);
  assert.match(detail, /Thử tải lại/);
});

test("doctor consultation and Q&A surfaces keep independent-review copy", () => {
  const doctorConsultation = read("app/doctor/consultations/[id]/page.tsx");
  const doctorQuestions = read("app/doctor/health-questions/page.tsx");
  const adminQuestions = read("app/admin/health-questions/page.tsx");
  assert.match(doctorConsultation, /handoffDoctorConsultation/);
  assert.match(doctorConsultation, /Không gọi AI/);
  assert.match(doctorQuestions, /bác sĩ khác phải duyệt độc lập/);
  assert.match(adminQuestions, /Không xuất bản trực tiếp từ AI/);
  assert.match(adminQuestions, /adminListHealthQuestionReports/);
  assert.match(adminQuestions, /Gỡ nội dung/);
});

test("patient Q&A route keeps PII guard and moderation lifecycle visible", () => {
  const page = read("app/patient/health-questions/page.tsx");
  const client = read("lib/api-client.ts");
  assert.match(page, /createPatientHealthQuestion/);
  assert.match(page, /Không nhập số điện thoại, email, CCCD/);
  assert.match(page, /PENDING_MODERATION/);
  assert.match(page, /không thay thế thăm khám/);
  assert.match(client, /fetchPatientHealthQuestions/);
  assert.match(client, /reportPublishedHealthQuestion/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
});
