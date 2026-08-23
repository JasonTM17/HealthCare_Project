import { expect, test, type BrowserContext } from "@playwright/test";
import type {
  AuthSession,
  BankTransferPayment,
  DiagnosticResult,
  MedicalRecord,
  Notification,
  PatientPortalAppointment,
  PatientProfile,
  Prescription,
} from "../../types/hospital";

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

const AUTH_STORAGE_KEY = "healthcare.auth.session";
const APPOINTMENT_ID = "appointment-payment-e2e";

const PATIENT_SESSION: AuthSession = {
  accessToken: "e2e-payment-token",
  refreshToken: "e2e-payment-refresh-token",
  tokenType: "Bearer",
  expiresIn: 3600,
  user: {
    id: "patient-payment-e2e",
    email: "payment.e2e@example.com",
    displayName: "Bệnh nhân Thanh toán",
    roles: ["ROLE_PATIENT"],
  },
};

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
  let paymentStatus: "UNPAID" | "PAID" = "UNPAID";
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
    transactionReference: paymentStatus === "PAID" ? "FT123456789" : null,
    submittedAt: paymentStatus === "PAID" ? "2026-08-23T01:00:00Z" : null,
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
    const url = new URL(request.url());
    if (request.method() !== "GET") {
      throw new Error(`Unexpected payment E2E request: ${request.method()} ${url.pathname}`);
    }

    if (url.pathname === `/api/v1/patient/appointments/${APPOINTMENT_ID}/payment`) {
      paymentReads += 1;
      if (paymentReads > 1) paymentStatus = "PAID";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payment()) });
      return;
    }

    const payloadByPath: Record<string, unknown> = {
      "/api/v1/patient/profile": PROFILE,
      "/api/v1/patient/appointments": pageEnvelope([appointment()]),
      "/api/v1/patient/medical-records": [] satisfies MedicalRecord[],
      "/api/v1/patient/prescriptions": [] satisfies Prescription[],
      "/api/v1/patient/diagnostic-results": [] satisfies DiagnosticResult[],
      "/api/v1/notifications": pageEnvelope([] satisfies Notification[]),
    };
    const payload = payloadByPath[url.pathname];
    if (payload === undefined) throw new Error(`Unhandled payment E2E request: ${url.pathname}`);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
}

test("mobile patient payment keeps QR actions accessible and synchronizes a confirmed status", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installPaymentMocks(context);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:3100" });
  await context.addInitScript(({ key, session }) => {
    window.sessionStorage.setItem(key, JSON.stringify(session));
  }, { key: AUTH_STORAGE_KEY, session: PATIENT_SESSION });

  await page.goto("/patient/dashboard#appointments");
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
  await expect(page.getByText("Khoản thanh toán đã được xác nhận.")).toBeVisible();
  await expect(page.getByLabel("Trạng thái thanh toán: Đã thanh toán")).toBeVisible();
  await expect(page.getByRole("button", { name: /cho lịch APT-PAY-E2E/ })).toHaveCount(0);

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Đóng thanh toán lịch APT-PAY-E2E" }).click();
  await expect(page.getByRole("heading", { name: "Lịch hẹn của tôi" })).toBeFocused();
});
