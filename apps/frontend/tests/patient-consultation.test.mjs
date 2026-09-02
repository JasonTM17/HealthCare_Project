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

test("patient consultation list and eligible appointments fail and retry independently", () => {
  const page = read("app/patient/consultations/page.tsx");
  const eligibility = page.match(/const ELIGIBLE_APPOINTMENT_STATUSES = new Set\(\[([^\]]+)]\)/)?.[1] ?? "";

  assert.match(eligibility, /"CONFIRMED"/);
  assert.match(eligibility, /"CHECKED_IN"/);
  assert.match(eligibility, /"COMPLETED"/);
  assert.doesNotMatch(eligibility, /IN_PROGRESS/);
  assert.doesNotMatch(page, /Promise\.all\(\[fetchPatientConsultations\(\), fetchPatientAppointments/);
  assert.match(page, /fetchPatientConsultations\(\)[\s\S]*setConsultationsError/);
  assert.match(page, /fetchPatientAppointments\(0, 50\)[\s\S]*setAppointmentsError/);
  assert.match(page, /setConsultationsRetry\(\(value\) => value \+ 1\)/);
  assert.match(page, /setAppointmentsRetry\(\(value\) => value \+ 1\)/);
  assert.match(page, /Đang tải danh sách tư vấn/);
  assert.match(page, /Đang tải lịch hẹn đủ điều kiện/);
  assert.match(page, /<div className="grid min-w-0 gap-4 md:grid-cols-2">/);
  assert.match(page, /className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3"/);
});

test("patient consultation detail keeps cursor, read-state and attachment gates explicit", () => {
  const page = read("app/patient/consultations/[id]/page.tsx");
  assert.match(page, /throughMessageId/);
  assert.match(page, /serverReadWatermark\.threadId !== id[\s\S]*\|\| !messagesComplete[\s\S]*\|\| messagePageError/);
  assert.match(page, /reconcileConsultationServerPage/);
  assert.match(page, /snapshot\.stalled/);
  assert.match(page, /isActiveThread\(threadId, epoch\)/);
  assert.match(page, /requestEpochRef\.current === epoch/);
  assert.match(page, /requestThreadRef\.current === threadId/);
  assert.match(page, /pageControllerRef\.current\?\.abort\(\)/);
  assert.match(page, /signal: controller\.signal/);
  assert.match(page, /nextCursor/);
  assert.match(page, /messages: \[\.\.\.current\.messages, \.\.\.newer\]/);
  assert.doesNotMatch(page, /messages: \[\.\.\.older, \.\.\.current\.messages\]/);
  assert.match(page, /attachments\/intents/);
  assert.match(page, /requestConsultationJson<ConsultationDetail>.*patient\/consultations/);
  assert.match(page, /fetchConsultationUploadResponse/);
  assert.match(page, /CONSULTATION_UPLOAD_TIMEOUT_MS/);
  assert.match(page, /Yêu cầu tư vấn mất quá nhiều thời gian/);
  assert.match(page, /sha256/);
  assert.match(page, /scanStatus === \"CLEAN\"/);
  assert.match(page, /resolved\.scanStatus !== "CLEAN" \|\| !resolved\.downloadUrl/);
  assert.match(page, /pollConsultationAttachments/);
  assert.match(page, /serverMessagesRef\.current = merge\(serverMessagesRef\.current\)/);
  assert.match(page, /window\.matchMedia\(\"\(prefers-reduced-motion: reduce\)\"\)/);
  assert.doesNotMatch(page, /error\.message/);
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
  const client = read("lib/api-client.ts");
  const doctorQuestions = read("app/doctor/health-questions/page.tsx");
  const adminQuestions = read("app/admin/health-questions/page.tsx");
  assert.match(doctorConsultation, /handoffDoctorConsultation/);
  assert.match(doctorConsultation, /Không gọi AI/);
  assert.match(doctorConsultation, /fetchDoctorConsultationMessagePage/);
  assert.match(doctorConsultation, /messages: \[\.\.\.current\.messages, \.\.\.newer\]/);
  assert.match(doctorConsultation, /markDoctorConsultationRead/);
  assert.match(doctorConsultation, /hasMore/);
  assert.match(doctorConsultation, /serverReadWatermark\.threadId !== id[\s\S]*\|\| !messagesComplete[\s\S]*\|\| messagePageError/);
  assert.match(doctorConsultation, /reconcileConsultationServerPage/);
  assert.match(doctorConsultation, /snapshot\.stalled/);
  assert.match(doctorConsultation, /isActiveThread\(threadId, epoch\)/);
  assert.match(doctorConsultation, /requestEpochRef\.current === epoch/);
  assert.match(doctorConsultation, /requestThreadRef\.current === threadId/);
  assert.match(doctorConsultation, /pageControllerRef\.current\?\.abort\(\)/);
  assert.match(client, /\/doctor\/consultations\/\$\{encodeURIComponent\(id\)\}\/messages/);
  assert.match(client, /resolveDoctorConsultation/);
  assert.match(client, /reopenDoctorConsultation/);
  assert.match(doctorConsultation, /scanStatus === "CLEAN"/);
  assert.match(doctorConsultation, /pollConsultationAttachments/);
  assert.match(doctorConsultation, /fetchDoctorConsultationAttachmentStatus/);
  assert.match(client, /\/doctor\/consultations\/\$\{encodeURIComponent\(id\)\}\/attachments\/\$\{encodeURIComponent\(attachmentId\)\}/);
  assert.match(client, /fetchDoctorConsultationAttachmentStatus[\s\S]*cache: "no-store"/);
  assert.doesNotMatch(doctorConsultation, /error\.message/);
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
