import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("patient documents route is a real PDF workflow, not a dashboard alias", async () => {
  const page = await read("app/patient/documents/page.tsx");

  assert.match(page, /"use client"/);
  assert.match(page, /PatientDocumentsPage/);
  assert.doesNotMatch(page, /redirect\(/);
  assert.doesNotMatch(page, /\/patient\/dashboard#records/);
  assert.match(page, /PortalChrome/);
  assert.match(page, /LoginRequiredState nextPath="\/patient\/documents"/);
  assert.match(page, /ForbiddenState/);
  assert.match(page, /fetchPatientDocuments/);
  assert.match(page, /generatePatientDocument/);
  assert.match(page, /downloadPatientDocument/);
  assert.match(page, /VISIT_SUMMARY/);
  assert.match(page, /PRESCRIPTION/);
  assert.match(page, /STATUS_LABEL/);
  assert.match(page, /Sẵn sàng tải/);
  assert.match(page, /Tạo lỗi/);
  assert.match(page, /Đã thay thế/);
  assert.match(page, /chưa phải giấy tờ ký số pháp lý/);
  assert.match(page, /Không dùng thay thế/);
});

test("patient documents page fails closed and never renders raw caught errors", async () => {
  const page = await read("app/patient/documents/page.tsx");

  assert.match(page, /presentApiError\(error\.code, error\.status\)/);
  assert.match(page, /if \(getErrorStatus\(error\) === 401\) clearAuthSession\(\)/);
  assert.match(page, /aria-live=\{notice\.tone === "error" \? "assertive" : "polite"\}/);
  assert.match(page, /role=\{notice\.tone === "error" \? "alert" : "status"\}/);
  assert.doesNotMatch(page, /\b(?:error|reason|cause|exception)\.message\b/iu);
  assert.doesNotMatch(page, /sessionStorage|localStorage|document\.cookie|Authorization|Bearer|accessToken|refreshToken|tokenType/iu);
});

test("api client exposes patient document APIs through same-origin BFF only", async () => {
  const [apiClient, hospitalTypes, bff] = await Promise.all([
    read("lib/api-client.ts"),
    read("types/hospital.ts"),
    read("lib/server/healthcare-bff.ts"),
  ]);

  assert.match(hospitalTypes, /export type PatientDocumentSourceType = "VISIT_SUMMARY" \| "PRESCRIPTION"/);
  assert.match(hospitalTypes, /export type PatientDocumentStatus = "PENDING" \| "AVAILABLE" \| "FAILED" \| "SUPERSEDED" \| "REVOKED"/);
  assert.match(apiClient, /export interface GeneratePatientDocumentPayload/);
  assert.match(apiClient, /fetchPatientDocuments\(patientId: string\): Promise<PatientDocument\[\]>/);
  assert.match(apiClient, /generatePatientDocument\(\s*patientId: string,[\s\S]*payload: GeneratePatientDocumentPayload,[\s\S]*\): Promise<PatientDocument>/);
  assert.match(apiClient, /downloadPatientDocument\(\s*patientId: string,[\s\S]*documentId: string/);
  assert.match(apiClient, /`\/patients\/\$\{encodeURIComponent\(patientId\)\}\/documents`/);
  assert.match(apiClient, /\/documents\/\$\{encodeURIComponent\(documentId\)\}\/download/);
  assert.match(apiClient, /credentials: "same-origin"/);
  assert.match(apiClient, /URL\.createObjectURL/);
  assert.match(apiClient, /anchor\.download = filename/);
  assert.match(bff, /"content-disposition"/);
  assert.match(bff, /"content-type"/);
  assert.doesNotMatch(apiClient, /presigned|publicUrl|window\.open/iu);
});
