import { createHash } from "node:crypto";
import { expect, test, type BrowserContext, type Route } from "@playwright/test";
import type { MedicalRecord, PatientDocument, PatientProfile, Prescription } from "../../types/hospital";
import {
  assertNoSensitiveBrowserStorage,
  browserSessionFixture,
  installMockBrowserSession,
} from "./helpers/browser-session";

type PageEnvelope<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
};

const PATIENT_ID = "patient-documents-e2e";
const RECORD_ID = "record-documents-e2e";
const ACTIVE_PRESCRIPTION_ID = "prescription-documents-active";
const CANCELLED_PRESCRIPTION_ID = "prescription-documents-cancelled";
const AVAILABLE_DOCUMENT_ID = "document-available-e2e";
// The download path is fail-closed on declared byteSize — the fixture must
// agree with the bytes the mocked route actually serves.
const AVAILABLE_PDF_BYTES = Buffer.from("%PDF-1.7\n% synthetic patient document e2e\n%%EOF", "utf8");
// The download path is fail-closed on the record sha256 too — fixtures that a
// test actually downloads must carry the real digest of the served bytes.
const sha256Hex = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const AVAILABLE_PDF_SHA256 = sha256Hex(AVAILABLE_PDF_BYTES);

const SESSION = browserSessionFixture("PATIENT", PATIENT_ID, "Bệnh nhân PDF");

const PROFILE: PatientProfile = {
  id: PATIENT_ID,
  fullName: "Bệnh nhân PDF",
  phone: "0900000005",
  email: "documents.e2e@example.com",
  dateOfBirth: null,
  gender: null,
  address: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  avatarUrl: null,
  medicalHistory: null,
  allergies: null,
  bloodType: null,
  patientTier: "STANDARD",
  aiCredits: 12,
  updatedAt: "2026-09-10T02:00:00Z",
};

const MEDICAL_RECORDS: MedicalRecord[] = [
  {
    id: RECORD_ID,
    appointmentId: "appointment-documents-e2e",
    bookingCode: "APT-PDF-001",
    patientId: PATIENT_ID,
    patientName: "Bệnh nhân PDF",
    patientPhone: "0900000005",
    doctorId: "doctor-documents-e2e",
    doctorName: "BS. Nguyễn Minh",
    doctorTitle: "Nội tổng quát",
    diagnosis: "Tổng kết kiểm thử",
    symptomsSummary: "Dữ liệu kiểm thử synthetic",
    treatmentPlan: "Theo dõi và tái khám đúng lịch",
    doctorNotes: null,
    followUpDate: null,
    prescriptions: [],
    createdAt: "2026-09-10T02:15:00Z",
  },
];

const PRESCRIPTIONS: Prescription[] = [
  {
    id: ACTIVE_PRESCRIPTION_ID,
    prescriptionCode: "RX-PDF-001",
    patientId: PATIENT_ID,
    patientName: "Bệnh nhân PDF",
    doctorId: "doctor-documents-e2e",
    doctorName: "BS. Nguyễn Minh",
    diagnosisSummary: "Đơn thuốc kiểm thử",
    generalAdvice: "Uống thuốc theo hướng dẫn",
    status: "ACTIVE",
    items: [],
    createdAt: "2026-09-10T02:20:00Z",
  },
  {
    id: CANCELLED_PRESCRIPTION_ID,
    prescriptionCode: "RX-PDF-OLD",
    patientId: PATIENT_ID,
    patientName: "Bệnh nhân PDF",
    doctorId: "doctor-documents-e2e",
    doctorName: "BS. Nguyễn Minh",
    diagnosisSummary: "Đơn đã hủy",
    generalAdvice: null,
    status: "CANCELLED",
    items: [],
    createdAt: "2026-09-09T02:20:00Z",
  },
];

function pageEnvelope<T>(content: T[]): PageEnvelope<T> {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    size: 20,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

function initialDocuments(): PatientDocument[] {
  return [
    {
      id: AVAILABLE_DOCUMENT_ID,
      patientId: PATIENT_ID,
      sourceRecordId: RECORD_ID,
      sourceType: "VISIT_SUMMARY",
      sourceVersion: 1772359200000,
      templateVersion: "synthetic-v1",
      status: "AVAILABLE",
      sha256: AVAILABLE_PDF_SHA256,
      byteSize: AVAILABLE_PDF_BYTES.length,
      generatedBy: PATIENT_ID,
      generatedAt: "2026-09-10T02:30:00Z",
      revokedAt: null,
    },
    {
      id: "document-failed-e2e",
      patientId: PATIENT_ID,
      sourceRecordId: ACTIVE_PRESCRIPTION_ID,
      sourceType: "PRESCRIPTION",
      sourceVersion: 1772359200001,
      templateVersion: "synthetic-v1",
      status: "FAILED",
      sha256: null,
      byteSize: null,
      generatedBy: PATIENT_ID,
      generatedAt: "2026-09-10T02:25:00Z",
      revokedAt: null,
    },
    {
      id: "document-pending-e2e",
      patientId: PATIENT_ID,
      sourceRecordId: ACTIVE_PRESCRIPTION_ID,
      sourceType: "PRESCRIPTION",
      sourceVersion: 1772359200002,
      templateVersion: "synthetic-v1",
      status: "PENDING",
      sha256: null,
      byteSize: null,
      generatedBy: PATIENT_ID,
      generatedAt: "2026-09-10T02:24:00Z",
      revokedAt: null,
    },
    {
      id: "document-superseded-e2e",
      patientId: PATIENT_ID,
      sourceRecordId: RECORD_ID,
      sourceType: "VISIT_SUMMARY",
      sourceVersion: 1772359199000,
      templateVersion: "synthetic-v1",
      status: "SUPERSEDED",
      sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      byteSize: 1024,
      generatedBy: PATIENT_ID,
      generatedAt: "2026-09-10T02:23:30Z",
      revokedAt: "2026-09-10T02:31:00Z",
    },
    {
      id: "document-revoked-e2e",
      patientId: PATIENT_ID,
      sourceRecordId: RECORD_ID,
      sourceType: "VISIT_SUMMARY",
      sourceVersion: 1772359200003,
      templateVersion: "synthetic-v1",
      status: "REVOKED",
      sha256: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      byteSize: 1024,
      generatedBy: PATIENT_ID,
      generatedAt: "2026-09-10T02:23:00Z",
      revokedAt: "2026-09-10T02:40:00Z",
    },
  ];
}

async function installPatientDocumentMocks(context: BrowserContext): Promise<void> {
  let documents = initialDocuments();
  let generateCounter = 0;

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(request.headers()["authorization"]).toBeUndefined();

    if (url.pathname === `/api/v1/patients/${PATIENT_ID}/documents/${AVAILABLE_DOCUMENT_ID}/download`) {
      expect(request.method()).toBe("GET");
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: {
          "Content-Disposition": `attachment; filename="ho-so-kham-${AVAILABLE_DOCUMENT_ID.slice(0, 8)}.pdf"`,
          "Cache-Control": "no-store",
        },
        body: AVAILABLE_PDF_BYTES,
      });
      return;
    }

    if (url.pathname === `/api/v1/patients/${PATIENT_ID}/documents`) {
      if (request.method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(documents) });
        return;
      }
      if (request.method() === "POST") {
        const payload = request.postDataJSON() as { sourceType: PatientDocument["sourceType"]; sourceRecordId: string };
        generateCounter += 1;
        const generated: PatientDocument = {
          id: `document-generated-${generateCounter}`,
          patientId: PATIENT_ID,
          sourceRecordId: payload.sourceRecordId,
          sourceType: payload.sourceType,
          sourceVersion: 1772359300000 + generateCounter,
          templateVersion: "synthetic-v1",
          status: "AVAILABLE",
          sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          byteSize: 1536,
          generatedBy: PATIENT_ID,
          generatedAt: "2026-09-10T03:00:00Z",
          revokedAt: null,
        };
        documents = [generated, ...documents];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(generated) });
        return;
      }
    }

    const payloadByPath: Record<string, unknown> = {
      "/api/v1/hospital/branches": pageEnvelope([]),
      "/api/v1/notifications": pageEnvelope([]),
      "/api/v1/patient/ai-credits/status": { tier: "STANDARD", credits: 12, maxCredits: 20, history: [] },
      "/api/v1/patient/appointments": pageEnvelope([]),
      "/api/v1/patient/care-plans": [],
      "/api/v1/patient/diagnostic-results": [],
      "/api/v1/patient/overview": {
        latestAppointment: null,
        appointmentCount: 0,
        diagnosticResultCount: 0,
        prescriptionCount: PRESCRIPTIONS.length,
        hasNewDiagnosticResult: false,
        hasNewPrescription: true,
        unreadNotificationCount: 0,
        unreadConsultationCount: 0,
        openCarePlanTaskCount: 0,
      },
      "/api/v1/patient/profile": PROFILE,
      "/api/v1/patient/medical-records": MEDICAL_RECORDS,
      "/api/v1/patient/prescriptions": PRESCRIPTIONS,
      [`/api/v1/patients/${PATIENT_ID}/documents/capabilities`]: { generationConfigured: true },
    };
    const payload = payloadByPath[url.pathname];
    if (request.method() !== "GET") {
      throw new Error(`Unhandled patient documents E2E request: ${request.method()} ${url.pathname}`);
    }
    if (payload === undefined) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "Background fixture unavailable" }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await installMockBrowserSession(context, SESSION);
}

test("patient document center covers PDF states at required responsive widths", async ({ context, page }) => {
  await installPatientDocumentMocks(context);

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    await test.step(`${viewport.width}px`, async () => {
      await page.setViewportSize(viewport);
      await page.goto("/patient/documents", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { name: "Trung tâm tài liệu lâm sàng" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Điều hướng cổng thông tin" }).getByRole("link", { name: "Tài liệu PDF" })).toBeVisible();
      await expect(page.getByText("Sẵn sàng tải", { exact: true })).toBeVisible();
      // Ultra V4 de-branded a patient's own clinical record: the FAILED status
      // label moved from "Tạo lỗi" to "Tạo thất bại" and the beta disclaimer
      // from "chưa phải giấy tờ ký số pháp lý" to "chưa có chữ ký số"
      // (app/patient/documents/page.tsx:51,287). Both strings are already
      // pinned by tests/patient-documents.test.mjs:24, which was updated in the
      // same pass; these two e2e labels were missed. Still exact-match visible
      // text, so no state stopped being asserted.
      await expect(page.getByText("Tạo thất bại", { exact: true })).toBeVisible();
      await expect(page.getByText("Đang tạo", { exact: true })).toBeVisible();
      await expect(page.getByText("Đã thay thế", { exact: true })).toBeVisible();
      await expect(page.getByText("Đã thu hồi", { exact: true })).toBeVisible();
      // Scoped to the persistent disclaimer block: the reworded phrase now also
      // appears in the section intro (app/patient/documents/page.tsx:287), and
      // an unscoped locator would fail Playwright strict mode. `.portal-disclaimer`
      // is the single always-visible caveat surface (page.tsx:463).
      await expect(page.locator(".portal-disclaimer")).toContainText("chưa có chữ ký số");
      await expect.poll(
        () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        { message: `${viewport.width}px document center must not overflow horizontally` },
      ).toBeLessThanOrEqual(1);
    });
  }

  await assertNoSensitiveBrowserStorage(page);
});

test("patient document center can generate and download synthetic PDFs", async ({ context, page }) => {
  await installPatientDocumentMocks(context);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/patient/documents", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Tạo PDF tổng kết" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã tạo tài liệu PDF" })).toBeVisible();
  await expect(page.getByText(/aaaaaaaaaaaa/)).toBeVisible();

  await page.locator("article.portal-record").filter({ hasText: "RX-PDF-001" }).getByRole("button", { name: "Tạo PDF đơn thuốc" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã tạo tài liệu PDF" })).toBeVisible();
  await expect(page.locator("article.portal-record").filter({ hasText: "RX-PDF-OLD" }).getByRole("button", { name: "Tạo PDF đơn thuốc" })).toBeDisabled();

  const downloadPromise = page.waitForEvent("download");
  await page.locator("article.portal-record").filter({ hasText: AVAILABLE_PDF_SHA256.slice(0, 12) }).getByRole("button", { name: "Tải PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ho-so-kham-document\.pdf$/);
  await expect(page.getByRole("status").filter({ hasText: "Đã bắt đầu tải PDF về máy" })).toBeVisible();

  await assertNoSensitiveBrowserStorage(page);
});

const REMINDER_PDF_BYTES = Buffer.from("%PDF-1.7\n% synthetic appointment reminder e2e\n%%EOF", "utf8");
const REMINDER_PDF_SHA256 = sha256Hex(REMINDER_PDF_BYTES);
const REMINDER_DOCUMENT_ID = "reminder-doc-0001";
const REMINDER_SOURCE_TYPE = "APPOINTMENT_REMINDER" as string;
const REMINDER_DOCUMENT: PatientDocument = {
  id: REMINDER_DOCUMENT_ID,
  patientId: PATIENT_ID,
  sourceRecordId: "appointment-reminder-e2e",
  sourceType: REMINDER_SOURCE_TYPE as PatientDocument["sourceType"],
  sourceVersion: 1772359200004,
  templateVersion: "synthetic-v1",
  status: "AVAILABLE",
  sha256: REMINDER_PDF_SHA256,
  byteSize: REMINDER_PDF_BYTES.length,
  generatedBy: PATIENT_ID,
  generatedAt: "2026-09-10T02:35:00Z",
  revokedAt: null,
  sourceCurrent: true,
  sourceEligible: true,
};

test("patient document center renders and downloads an appointment reminder PDF", async ({ context, page }) => {
  await installPatientDocumentMocks(context);
  await context.route(`**/api/v1/patients/${PATIENT_ID}/documents`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([REMINDER_DOCUMENT]) });
      return;
    }
    await route.fallback();
  });
  await context.route(`**/api/v1/patients/${PATIENT_ID}/documents/${REMINDER_DOCUMENT_ID}/download`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: {
        "Content-Disposition": `attachment; filename="nhac-lich-hen-${REMINDER_DOCUMENT_ID.slice(0, 8)}.pdf"`,
        "Cache-Control": "no-store",
      },
      body: REMINDER_PDF_BYTES,
    });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/patient/documents", { waitUntil: "domcontentloaded" });

  const card = page.locator("article.portal-record").filter({ hasText: "Giấy nhắc hẹn" });
  await expect(card.locator("h3")).toHaveText("Giấy nhắc lịch hẹn đã kết xuất");
  await expect(card.locator("h3")).not.toContainText("Hồ sơ khám");

  const downloadPromise = page.waitForEvent("download");
  await card.getByRole("button", { name: "Tải PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("nhac-lich-hen-reminder.pdf");
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  expect(bytes.length).toBe(REMINDER_PDF_BYTES.length);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");

  await assertNoSensitiveBrowserStorage(page);
});

test("patient document center disables generation when the server reports storage unconfigured", async ({ context, page }) => {
  await installPatientDocumentMocks(context);
  await context.route(`**/api/v1/patients/${PATIENT_ID}/documents/capabilities`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ generationConfigured: false }),
    });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/patient/documents", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Tính năng tạo tài liệu PDF hiện chưa được bật trên máy chủ vì chưa có kho lưu trữ.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tạo PDF tổng kết" })).toBeDisabled();
  await expect(page.locator("article.portal-record").filter({ hasText: "RX-PDF-001" }).getByRole("button", { name: "Tạo PDF đơn thuốc" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Thử tạo lại" })).toBeDisabled();
  await expect(page.locator("article.portal-record").filter({ hasText: AVAILABLE_PDF_SHA256.slice(0, 12) }).getByRole("button", { name: "Tải PDF" })).toBeEnabled();

  await assertNoSensitiveBrowserStorage(page);
});

test("patient document center shows an error state when the capability probe fails and recovers on retry", async ({ context, page }) => {
  await installPatientDocumentMocks(context);
  let capabilityCalls = 0;
  await context.route(`**/api/v1/patients/${PATIENT_ID}/documents/capabilities`, async (route) => {
    capabilityCalls += 1;
    if (capabilityCalls === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "Capability probe unavailable" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ generationConfigured: true }),
    });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/patient/documents", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("alert").filter({ hasText: "Dịch vụ tạm thời không khả dụng" })).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("button", { name: "Tạo PDF tổng kết" })).toBeEnabled();
  expect(capabilityCalls).toBeGreaterThanOrEqual(2);

  await assertNoSensitiveBrowserStorage(page);
});

test("patient document center offers regeneration for a stale reminder and blocks its download", async ({ context, page }) => {
  const STALE_REMINDER: PatientDocument = {
    ...REMINDER_DOCUMENT,
    id: "reminder-stale-0001",
    status: "AVAILABLE",
    sourceCurrent: false,
    sourceEligible: true,
  };
  const FRESH_REMINDER: PatientDocument = {
    ...REMINDER_DOCUMENT,
    id: "reminder-fresh-0002",
    sourceVersion: 1772359200005,
    generatedAt: "2026-09-10T03:05:00Z",
    sourceCurrent: true,
    sourceEligible: true,
  };
  const SUPERSEDED_REMINDER: PatientDocument = {
    ...STALE_REMINDER,
    status: "SUPERSEDED",
    revokedAt: "2026-09-10T03:05:00Z",
  };

  await installPatientDocumentMocks(context);
  let documents: PatientDocument[] = [STALE_REMINDER];
  let postCalls = 0;
  await context.route(`**/api/v1/patients/${PATIENT_ID}/documents`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(documents) });
      return;
    }
    if (route.request().method() === "POST") {
      postCalls += 1;
      documents = [FRESH_REMINDER, SUPERSEDED_REMINDER];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(FRESH_REMINDER) });
      return;
    }
    await route.fallback();
  });
  await context.route(`**/api/v1/patients/${PATIENT_ID}/documents/${FRESH_REMINDER.id}/download`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: {
        "Content-Disposition": `attachment; filename="nhac-lich-hen-${FRESH_REMINDER.id.slice(0, 8)}.pdf"`,
        "Cache-Control": "no-store",
      },
      body: REMINDER_PDF_BYTES,
    });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/patient/documents", { waitUntil: "domcontentloaded" });

  const staleCard = page.locator("article.portal-record").filter({ hasText: "Cần tạo giấy nhắc mới" });
  await expect(staleCard).toBeVisible();
  await expect(staleCard.getByRole("button", { name: "Tải PDF" })).toBeDisabled();

  await staleCard.getByRole("button", { name: "Tạo giấy nhắc mới" }).click();
  const freshCard = page.locator("article.portal-record").filter({ hasText: "Sẵn sàng tải" });
  await expect(freshCard).toBeVisible();
  expect(postCalls).toBe(1);
  await expect(freshCard).toBeVisible();
  await expect(page.locator("article.portal-record").filter({ hasText: "Đã thay thế" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await freshCard.getByRole("button", { name: "Tải PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`nhac-lich-hen-${FRESH_REMINDER.id.slice(0, 8)}.pdf`);

  await assertNoSensitiveBrowserStorage(page);
});

test("cancelled reminders offer no download, retry, or regeneration controls", async ({ context, page }) => {
  const CANCELLED_AVAILABLE: PatientDocument = {
    ...REMINDER_DOCUMENT,
    id: "reminder-cancelled-ok",
    status: "AVAILABLE",
    sourceCurrent: false,
    sourceEligible: false,
  };
  const CANCELLED_FAILED: PatientDocument = {
    ...REMINDER_DOCUMENT,
    id: "reminder-cancelled-failed",
    status: "FAILED",
    sha256: null,
    byteSize: null,
    sourceCurrent: false,
    sourceEligible: false,
  };
  const FAILED_PRESCRIPTION: PatientDocument = {
    ...initialDocuments()[1],
  };

  await installPatientDocumentMocks(context);
  await context.route(`**/api/v1/patients/${PATIENT_ID}/documents`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([CANCELLED_AVAILABLE, CANCELLED_FAILED, FAILED_PRESCRIPTION]),
      });
      return;
    }
    await route.fallback();
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/patient/documents", { waitUntil: "domcontentloaded" });

  const availableCard = page.locator("article.portal-record")
    .filter({ hasText: "Giấy nhắc không còn hiệu lực" })
    .filter({ hasNotText: "Tạo thất bại" });
  await expect(availableCard).toBeVisible();
  await expect(availableCard.getByRole("button", { name: "Tải PDF" })).toBeDisabled();
  await expect(availableCard.getByRole("button", { name: "Tạo giấy nhắc mới" })).toHaveCount(0);
  await expect(availableCard).toContainText("Giấy nhắc không còn hiệu lực vì lịch hẹn đã thay đổi hoặc bị hủy.");

  const failedCard = page.locator("article.portal-record")
    .filter({ hasText: "Tạo thất bại" })
    .filter({ hasText: "Giấy nhắc" });
  await expect(failedCard).toBeVisible();
  await expect(failedCard.getByRole("button", { name: "Tải PDF" })).toBeDisabled();
  await expect(failedCard.getByRole("button", { name: "Thử tạo lại" })).toHaveCount(0);
  await expect(failedCard.getByRole("button", { name: "Tạo giấy nhắc mới" })).toHaveCount(0);
  await expect(failedCard).toContainText("Giấy nhắc không còn hiệu lực vì lịch hẹn đã thay đổi hoặc bị hủy.");
  await expect(failedCard).not.toContainText("Tệp tạo lỗi đã được ghi nhận để thử lại an toàn.");

  const visitFailedCard = page.locator("article.portal-record").filter({ hasText: "RX-PDF-001" });
  await expect(visitFailedCard.getByRole("button", { name: "Thử tạo lại" })).toBeEnabled();

  await assertNoSensitiveBrowserStorage(page);
});

test("a stale generation callback cannot clear or clobber a newer session", async ({ context, page }) => {
  const SESSION_B = browserSessionFixture("PATIENT", "patient-documents-e2e-b", "Bệnh nhân PDF B");
  const PROFILE_B: PatientProfile = {
    ...PROFILE,
    id: SESSION_B.user.id,
    email: SESSION_B.user.email,
  };
  const B_DOCS: PatientDocument[] = [
    {
      ...initialDocuments()[0],
      id: "document-b-e2e",
      sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    },
  ];

  await installPatientDocumentMocks(context);

  let currentSession: unknown = SESSION;
  let currentProfile: unknown = PROFILE;
  let failSessionReads = false;
  await context.route("**/api/v1/auth/browser-sessions/current", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      if (failSessionReads) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
        });
        return;
      }
      await route.fulfill({
        status: currentSession ? 200 : 401,
        contentType: "application/json",
        body: JSON.stringify(currentSession ?? { code: "BROWSER_SESSION_REQUIRED" }),
      });
      return;
    }
    if (request.method() === "DELETE") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
      });
      return;
    }
    await route.fallback();
  });
  await context.route("**/api/v1/patient/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentProfile),
    });
  });
  await context.route("**/documents/capabilities", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ generationConfigured: true }),
    });
  });
  await context.route(`**/api/v1/patients/${SESSION_B.user.id}/documents`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(B_DOCS) });
      return;
    }
    await route.fallback();
  });

  const held: { post: Route | null } = { post: null };
  await context.route(`**/api/v1/patients/${PATIENT_ID}/documents`, async (route) => {
    if (route.request().method() === "POST") {
      held.post = route;
      return;
    }
    await route.fallback();
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/patient/documents", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(AVAILABLE_PDF_SHA256.slice(0, 12))).toBeVisible();

  await page.getByRole("button", { name: "Tạo PDF tổng kết" }).click();
  await expect.poll(() => held.post !== null).toBe(true);

  failSessionReads = true;
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("button", { name: "Thử xác minh lại" })).toBeVisible();

  currentSession = SESSION_B;
  currentProfile = PROFILE_B;
  failSessionReads = false;
  await page.getByRole("button", { name: "Thử xác minh lại" }).click();

  await expect(page.getByRole("heading", { name: "Trung tâm tài liệu lâm sàng" })).toBeVisible();
  await expect(page.getByText("dddddddddddd")).toBeVisible();

  const pendingPost = held.post as Route | null;
  if (!pendingPost) throw new Error("generate POST was never intercepted");
  await pendingPost.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ code: "UNAUTHORIZED", message: "stale session" }),
  });

  await expect(page.getByRole("heading", { name: "Trung tâm tài liệu lâm sàng" })).toBeVisible();
  await expect(page.getByText("dddddddddddd")).toBeVisible();
  await expect(page.getByText(AVAILABLE_PDF_SHA256.slice(0, 12))).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Đăng nhập để mở cổng thông tin" })).toHaveCount(0);
  await expect(page.locator(".portal-inline-error")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tạo PDF tổng kết" })).toBeEnabled();

  await assertNoSensitiveBrowserStorage(page);
});
