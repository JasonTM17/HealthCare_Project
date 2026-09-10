import { expect, test, type BrowserContext } from "@playwright/test";
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
      sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      byteSize: 2048,
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
          "Content-Disposition": `attachment; filename="healthcare-demo-visit-summary-${AVAILABLE_DOCUMENT_ID.slice(0, 8)}.pdf"`,
          "Cache-Control": "no-store",
        },
        body: Buffer.from("%PDF-1.7\n% synthetic patient document e2e\n%%EOF", "utf8"),
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
      await expect(page.getByText("Tạo lỗi", { exact: true })).toBeVisible();
      await expect(page.getByText("Đang tạo", { exact: true })).toBeVisible();
      await expect(page.getByText("Đã thay thế", { exact: true })).toBeVisible();
      await expect(page.getByText("Đã thu hồi", { exact: true })).toBeVisible();
      await expect(page.getByText("chưa phải giấy tờ ký số pháp lý")).toBeVisible();
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
  await expect(page.getByRole("status").filter({ hasText: "Đã tạo bản PDF demo" })).toBeVisible();
  await expect(page.getByText(/aaaaaaaaaaaa/)).toBeVisible();

  await page.locator("article.portal-record").filter({ hasText: "RX-PDF-001" }).getByRole("button", { name: "Tạo PDF đơn thuốc" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã tạo bản PDF demo" })).toBeVisible();
  await expect(page.locator("article.portal-record").filter({ hasText: "RX-PDF-OLD" }).getByRole("button", { name: "Tạo PDF đơn thuốc" })).toBeDisabled();

  const downloadPromise = page.waitForEvent("download");
  await page.locator("article.portal-record").filter({ hasText: "0123456789ab" }).getByRole("button", { name: "Tải PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^healthcare-demo-visit-summary-document\.pdf$/);
  await expect(page.getByRole("status").filter({ hasText: "Đã bắt đầu tải PDF về máy" })).toBeVisible();

  await assertNoSensitiveBrowserStorage(page);
});
