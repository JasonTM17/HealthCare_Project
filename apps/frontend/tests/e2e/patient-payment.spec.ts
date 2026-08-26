import { expect, test, type BrowserContext } from "@playwright/test";
import type {
  BankTransferPayment,
  Branch,
  CarePlan,
  DiagnosticResult,
  MedicalRecord,
  Notification,
  PatientOverview,
  PatientPortalAppointment,
  PatientProfile,
  Prescription,
} from "../../types/hospital";
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

const APPOINTMENT_ID = "appointment-payment-e2e";

const PATIENT_SESSION = browserSessionFixture("PATIENT", "patient-payment-e2e", "Bệnh nhân Thanh toán");

const PROFILE: PatientProfile = {
  id: "patient-payment-e2e",
  fullName: "Bệnh nhân Thanh toán",
  phone: "0900000002",
  email: "payment.e2e@example.com",
  dateOfBirth: null,
  gender: null,
  address: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  updatedAt: "2026-08-23T00:00:00Z",
};

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

async function installPaymentMocks(context: BrowserContext): Promise<void> {
  let paymentStatus: "UNPAID" | "PENDING_VERIFICATION" | "PAID" = "UNPAID";
  let paymentReads = 0;

  const appointment = (): PatientPortalAppointment => ({
    id: APPOINTMENT_ID,
    bookingCode: "APT-PAY-E2E",
    doctorId: "doctor-payment-e2e",
    doctorName: "BS. Nguyễn An",
    specialtyName: "Tim mạch",
    branchId: "branch-payment-e2e",
    branchName: "Cơ sở Trung tâm",
    packageName: "Khám chuyên khoa",
    appointmentDate: "2026-08-28",
    startTime: "09:00:00",
    endTime: "09:30:00",
    status: "CONFIRMED",
    paymentStatus,
    createdAt: "2026-08-23T00:00:00Z",
  });

  const payment = (): BankTransferPayment => ({
    id: "payment-e2e",
    appointmentId: APPOINTMENT_ID,
    bookingCode: "APT-PAY-E2E",
    patientName: PROFILE.fullName,
    doctorName: "BS. Nguyễn An",
    packageName: "Khám chuyên khoa",
    appointmentDate: "2026-08-28",
    amount: 200_000,
    currency: "VND",
    status: paymentStatus,
    bankName: "Vietcombank",
    bankAccount: "0123456789",
    accountHolder: "HEALTHCARE E2E",
    qrCodeUrl: "https://img.vietqr.io/image/payment-e2e.png",
    transferContent: "APT PAY E2E",
    transactionReference: paymentStatus === "UNPAID" ? null : "FT123456789",
    submittedAt: paymentStatus === "UNPAID" ? null : "2026-08-23T01:00:00Z",
    verifiedAt: paymentStatus === "PAID" ? "2026-08-23T01:01:00Z" : null,
    rejectionReason: null,
    refundReference: null,
    refundedAt: null,
    createdAt: "2026-08-23T00:00:00Z",
    updatedAt: "2026-08-23T01:01:00Z",
  });

  await context.route("https://img.vietqr.io/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
  });

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBeUndefined();
    const url = new URL(request.url());
    if (request.method() !== "GET") {
      throw new Error(`Unexpected payment E2E request: ${request.method()} ${url.pathname}`);
    }

    if (url.pathname === `/api/v1/patient/appointments/${APPOINTMENT_ID}/payment`) {
      paymentReads += 1;
      // The first refresh represents the bank event entering the admin queue;
      // the next refresh represents an explicit admin approval.
      if (paymentReads === 2) paymentStatus = "PENDING_VERIFICATION";
      if (paymentReads > 2) paymentStatus = "PAID";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payment()) });
      return;
    }

    const payloadByPath: Record<string, unknown> = {
      "/api/v1/patient/profile": PROFILE,
      "/api/v1/patient/appointments": pageEnvelope([appointment()]),
      "/api/v1/patient/medical-records": [] satisfies MedicalRecord[],
      "/api/v1/patient/prescriptions": [] satisfies Prescription[],
      "/api/v1/patient/diagnostic-results": [] satisfies DiagnosticResult[],
      "/api/v1/patient/care-plans": [] satisfies CarePlan[],
      "/api/v1/notifications": pageEnvelope([] satisfies Notification[]),
      "/api/v1/hospital/branches": pageEnvelope([] satisfies Branch[]),
      "/api/v1/patient/overview": {
        latestAppointment: {
          appointmentDate: "2026-08-28",
          startTime: "09:00:00",
          status: "CONFIRMED",
          paymentStatus,
        },
        appointmentCount: 1,
        diagnosticResultCount: 0,
        prescriptionCount: 0,
        hasNewDiagnosticResult: false,
        hasNewPrescription: false,
        unreadNotificationCount: 0,
        unreadConsultationCount: 0,
        openCarePlanTaskCount: 0,
      } satisfies PatientOverview,
    };
    const payload = payloadByPath[url.pathname];
    if (payload === undefined) throw new Error(`Unhandled payment E2E request: ${url.pathname}`);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
  await installMockBrowserSession(context, PATIENT_SESSION);
}

test("mobile patient payment keeps QR actions accessible and waits for admin approval", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installPaymentMocks(context);
  await page.goto("/patient/dashboard#appointments");
  // Derive the permission origin from the configured Playwright base URL.
  // The default test server uses port 3100; hard-coding 3000 made Chromium
  // reject clipboard.writeText even though the page itself was healthy.
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  await page.getByRole("button", { name: "Thanh toán cho lịch APT-PAY-E2E" }).click();

  await expect(page.getByRole("heading", { name: "Thanh toán lịch APT-PAY-E2E" })).toBeFocused();
  await expect(page.getByAltText(/VietQR thanh toán 200\.000.*APT-PAY-E2E/)).toBeVisible();
  await expect(page.getByText("HEALTHCARE E2E")).toBeVisible();

  await page.getByRole("button", { name: /Sao chép nội dung chuyển khoản/ }).click();
  await expect(page.getByRole("button", { name: /Sao chép nội dung chuyển khoản/ })).toHaveText("Đã chép");
  await expect(page.getByRole("status").filter({ hasText: "Đã sao chép nội dung chuyển khoản." })).toBeAttached();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải mã VietQR" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("vietqr-APT-PAY-E2E.png");

  await page.getByRole("button", { name: "Kiểm tra ngay" }).click();
  await expect(page.getByText("đang chờ admin kiểm tra, phê duyệt")).toBeVisible();
  await expect(page.getByRole("region", { name: "Thanh toán chuyển khoản" }).getByLabel("Trạng thái thanh toán: Đang chờ đối soát")).toBeVisible();

  // A second refresh is the mocked admin approval boundary; the patient UI
  // must not mark the payment as paid before this transition.
  await page.getByRole("button", { name: "Kiểm tra ngay" }).click();
  await expect(page.getByText("Khoản thanh toán đã được xác nhận.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Thanh toán chuyển khoản" }).getByLabel("Trạng thái thanh toán: Đã thanh toán")).toBeVisible();
  await expect(page.getByRole("button", { name: /cho lịch APT-PAY-E2E/ })).toHaveCount(0);

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Đóng thanh toán lịch APT-PAY-E2E" }).click();
  await expect(page.getByRole("heading", { name: "Lịch hẹn của tôi" })).toBeFocused();
  await assertNoSensitiveBrowserStorage(page, ["APT PAY E2E"]);
});
