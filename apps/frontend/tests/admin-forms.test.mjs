import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);
const adminRoot = new URL("../app/admin/", import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, adminRoot), "utf8");
}

function functionBody(sourceText, name) {
  const start = sourceText.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const next = sourceText.indexOf("\nexport async function ", start + 1);
  return sourceText.slice(start, next === -1 ? sourceText.length : next);
}

test("admin health question and consultation helpers pass page and size query params", async () => {
  const [api, healthQuestions, consultations] = await Promise.all([
    readFile(apiClientPath, "utf8"),
    source("health-questions/page.tsx"),
    source("consultations/page.tsx"),
  ]);

  const healthQuestionsHelper = functionBody(api, "adminListHealthQuestions");
  const consultationsHelper = functionBody(api, "fetchAdminConsultationQueue");

  assert.match(healthQuestionsHelper, /options:\s*\{ state\?: string; page\?: number; size\?: number \} = \{\}/);
  assert.match(healthQuestionsHelper, /toQuery\(\{ state: options\.state, page: options\.page, size: options\.size \}\)/);
  assert.match(consultationsHelper, /options:\s*\{ page\?: number; size\?: number \} = \{\}/);
  assert.match(consultationsHelper, /toQuery\(\{ page: options\.page, size: options\.size \}\)/);

  assert.match(healthQuestions, /const ADMIN_QUEUE_PAGE_SIZE = 20/);
  assert.match(healthQuestions, /adminListHealthQuestions\(\{ page, size: ADMIN_QUEUE_PAGE_SIZE \}\)/);
  assert.match(healthQuestions, /items\.length === ADMIN_QUEUE_PAGE_SIZE/);
  assert.match(healthQuestions, /aria-label="Phân trang câu hỏi sức khỏe"/);

  assert.match(consultations, /const CONSULTATION_QUEUE_PAGE_SIZE = 20/);
  assert.match(consultations, /fetchAdminConsultationQueue\(\{ page, size: CONSULTATION_QUEUE_PAGE_SIZE \}\)/);
  assert.match(consultations, /items\.length === CONSULTATION_QUEUE_PAGE_SIZE/);
  assert.match(consultations, /aria-label="Phân trang hàng đợi tư vấn"/);
});

test("doctor admin form validates optional linked userId and sends it only when present", async () => {
  const doctors = await source("doctors/page.tsx");

  assert.match(doctors, /userId: string/);
  assert.match(doctors, /USER_ID_UUID_PATTERN = \/\^\[0-9a-f\]\{8\}-/);
  assert.match(doctors, /const linkedUserId = form\.userId\.trim\(\)/);
  assert.match(doctors, /linkedUserId && !USER_ID_UUID_PATTERN\.test\(linkedUserId\)/);
  assert.match(doctors, /setFormError\("User ID liên kết phải là UUID hợp lệ\."\)/);
  assert.match(doctors, /const userId = form\.userId\.trim\(\)/);
  assert.match(doctors, /\.\.\.\(userId \? \{ userId \} : \{\}\)/);
  assert.match(doctors, /htmlFor="doctor-user-id">User ID liên kết \(tùy chọn\)<\/label>/);
  assert.match(doctors, /setForm\(\{ \.\.\.form, userId: event\.target\.value \}\)/);
});

test("specialty admin form maps clinical fields accepted by the backend", async () => {
  const specialties = await source("specialties/page.tsx");

  assert.match(specialties, /commonSymptoms: string/);
  assert.match(specialties, /preparationSteps: string/);
  assert.match(specialties, /carePathway: string/);
  assert.match(specialties, /function csvToList\(value: string\): string\[\]/);
  assert.match(specialties, /value\.split\(","\)\.map\(\(item\) => item\.trim\(\)\)\.filter\(Boolean\)/);
  assert.match(specialties, /commonSymptoms: \(specialty\.commonSymptoms \?\? \[\]\)\.join\(", "\)/);
  assert.match(specialties, /preparationSteps: \(specialty\.preparationSteps \?\? \[\]\)\.join\(", "\)/);
  assert.match(specialties, /carePathway: specialty\.carePathway \?\? ""/);
  assert.match(specialties, /commonSymptoms: csvToList\(form\.commonSymptoms\)/);
  assert.match(specialties, /preparationSteps: csvToList\(form\.preparationSteps\)/);
  assert.match(specialties, /carePathway: form\.carePathway\.trim\(\) \|\| null/);
  assert.match(specialties, /htmlFor="specialty-common-symptoms">Triệu chứng thường gặp<\/label>/);
  assert.match(specialties, /htmlFor="specialty-preparation-steps">Các bước chuẩn bị<\/label>/);
  assert.match(specialties, /htmlFor="specialty-care-pathway">Lộ trình chăm sóc<\/label>/);
});
