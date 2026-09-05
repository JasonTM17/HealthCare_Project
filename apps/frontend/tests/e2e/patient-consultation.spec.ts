import { expect, test, type BrowserContext } from "@playwright/test";
import type {
  ConsultationAttachment,
  ConsultationDetail,
  ConsultationMessage,
  ConsultationMessagePage,
} from "../../types/hospital";
import {
  assertNoSensitiveBrowserStorage,
  browserSessionFixture,
  installMockBrowserSession,
  installMockPatientPortalSession,
} from "./helpers/browser-session";

const THREAD_ID = "11111111-1111-4111-8111-111111111111";
const PATIENT_ID = "patient-consultation-e2e";
const DOCTOR_ID = "doctor-consultation-e2e";
const PATIENT_SESSION = browserSessionFixture("PATIENT", PATIENT_ID, "Bệnh nhân E2E");

const CLEAN_ATTACHMENT: ConsultationAttachment = {
  id: "attachment-clean",
  mimeType: "application/pdf",
  sizeBytes: 82_944,
  scanStatus: "CLEAN",
};

const REJECTED_ATTACHMENT: ConsultationAttachment = {
  id: "attachment-rejected",
  mimeType: "image/png",
  sizeBytes: 4_096,
  scanStatus: "REJECTED",
};

function message(
  id: string,
  authorRole: ConsultationMessage["authorRole"],
  authorUserId: string,
  body: string,
  status: ConsultationMessage["status"],
  attachments: ConsultationAttachment[] = [],
): ConsultationMessage {
  return {
    id,
    authorRole,
    authorUserId,
    body,
    status,
    attachments,
    createdAt: id === "message-patient" ? "2026-08-25T08:00:00Z" : "2026-08-25T08:20:00Z",
  };
}

const INITIAL_MESSAGES: ConsultationMessage[] = [
  message("message-patient", "PATIENT", PATIENT_ID, "Tôi cần chuẩn bị gì trước lần tái khám?", "READ"),
  message(
    "message-doctor",
    "DOCTOR",
    DOCTOR_ID,
    "Bạn hãy mang theo giấy hẹn và danh sách câu hỏi muốn trao đổi trực tiếp.",
    "SENT",
    [CLEAN_ATTACHMENT, REJECTED_ATTACHMENT],
  ),
];

const DETAIL: ConsultationDetail = {
  consultation: {
    id: THREAD_ID,
    appointmentId: "appointment-consultation-e2e",
    doctorId: DOCTOR_ID,
    doctorName: "Nguyễn Minh An",
    subject: "Chuẩn bị cho lần tái khám",
    status: "WAITING_FOR_PATIENT",
    openUntil: "2026-09-25T08:00:00Z",
    updatedAt: "2026-08-25T08:20:00Z",
    unreadCount: 1,
  },
  messages: INITIAL_MESSAGES,
};

async function installHealthyConsultationMocks(
  context: BrowserContext,
  observed: { idempotencyKey: string | null; readThrough: string | null },
): Promise<void> {
  await context.route(`**/api/v1/patient/consultations/${THREAD_ID}**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(request.headers()["authorization"]).toBeUndefined();

    if (url.pathname === `/api/v1/patient/consultations/${THREAD_ID}` && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DETAIL) });
      return;
    }

    if (url.pathname === `/api/v1/patient/consultations/${THREAD_ID}/messages` && request.method() === "GET") {
      const page: ConsultationMessagePage = { items: INITIAL_MESSAGES, nextCursor: null, hasMore: false };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(page) });
      return;
    }

    if (url.pathname === `/api/v1/patient/consultations/${THREAD_ID}/read` && request.method() === "POST") {
      const payload = request.postDataJSON() as { throughMessageId?: unknown };
      observed.readThrough = typeof payload.throughMessageId === "string" ? payload.throughMessageId : null;
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (url.pathname === `/api/v1/patient/consultations/${THREAD_ID}/messages` && request.method() === "POST") {
      observed.idempotencyKey = request.headers()["idempotency-key"] ?? null;
      expect(request.postDataJSON()).toEqual({ body: "Tôi đã hiểu, cảm ơn bác sĩ." });
      const sent = message(
        "message-new",
        "PATIENT",
        PATIENT_ID,
        "Tôi đã hiểu, cảm ơn bác sĩ.",
        "SENT",
      );
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(sent) });
      return;
    }

    throw new Error(`Unexpected consultation request: ${request.method()} ${url.pathname}${url.search}`);
  });
  await installMockPatientPortalSession(context, PATIENT_SESSION);
}

test("patient consultation keeps transcript, read watermark, idempotency, and CLEAN-only attachment access", async ({ context, page }) => {
  const observed = { idempotencyKey: null as string | null, readThrough: null as string | null };
  await installHealthyConsultationMocks(context, observed);

  await page.goto(`/patient/consultations/${THREAD_ID}`);
  await expect(page.getByRole("heading", { name: "Chuẩn bị cho lần tái khám" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tin nhắn tư vấn" })).toContainText("Tôi cần chuẩn bị gì trước lần tái khám?");
  await expect(page.getByRole("region", { name: "Tin nhắn tư vấn" })).toContainText("Bạn hãy mang theo giấy hẹn");
  await expect(page.getByRole("alert").filter({ hasText: "Đây không phải kênh cấp cứu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "115" })).toHaveAttribute("href", "tel:115");

  await expect(page.getByRole("button", { name: "Mở tệp an toàn" })).toHaveCount(1);
  await expect(page.getByText("application/pdf · 81 KB · Đã quét sạch")).toBeVisible();
  await expect(page.getByText("image/png · 4 KB · Không thể mở tệp")).toBeVisible();

  await expect.poll(() => observed.readThrough).toBe("message-doctor");
  await page.getByPlaceholder("Viết câu hỏi cho bác sĩ…").fill("Tôi đã hiểu, cảm ơn bác sĩ.");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(page.getByText("Tôi đã hiểu, cảm ơn bác sĩ.", { exact: true })).toBeVisible();
  await expect(page.getByText("TƯ VẤN RIÊNG · Chờ bác sĩ")).toBeVisible();
  expect(observed.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/iu);

  await assertNoSensitiveBrowserStorage(page, INITIAL_MESSAGES.map((item) => item.body));
});

test("cross-owner consultation failure is fail-closed and never renders raw PHI or infrastructure details", async ({ context, page }) => {
  const rawLeak = "Bệnh nhân Nguyễn Văn Bí mật · jdbc:postgresql://internal-db:5432/healthcare";
  await context.route(`**/api/v1/patient/consultations/${THREAD_ID}**`, async (route) => {
    expect(route.request().headers()["authorization"]).toBeUndefined();
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        code: "CONSULTATION_NOT_FOUND",
        message: rawLeak,
        stack: "com.healthcare.consultation.PatientIsolationException",
      }),
    });
  });
  await installMockPatientPortalSession(context, PATIENT_SESSION);

  await page.goto(`/patient/consultations/${THREAD_ID}`);
  await expect(page.getByRole("heading", { name: "Không thể tải dữ liệu" })).toBeVisible();
  await expect(page.getByText("Yêu cầu chưa thể hoàn tất. Vui lòng kiểm tra thông tin và thử lại.")).toBeVisible();
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("Nguyễn Văn Bí mật");
  expect(bodyText).not.toContain("jdbc:postgresql://internal-db");
  expect(bodyText).not.toContain("PatientIsolationException");
  await expect(page.getByRole("heading", { name: "Chuẩn bị cho lần tái khám" })).toHaveCount(0);
  await assertNoSensitiveBrowserStorage(page, [rawLeak]);
});

test("a non-patient role is rejected before any private consultation API is requested", async ({ context, page }) => {
  let privateApiRequests = 0;
  await context.route(`**/api/v1/patient/consultations/${THREAD_ID}**`, async (route) => {
    privateApiRequests += 1;
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await installMockBrowserSession(
    context,
    browserSessionFixture("DOCTOR", "doctor-wrong-role-e2e", "Bác sĩ không phải bệnh nhân"),
  );

  await page.goto(`/patient/consultations/${THREAD_ID}`);
  await expect(page.getByRole("heading", { name: "Tài khoản không có quyền mở cổng thông tin này" })).toBeVisible();
  await expect(page.getByText("Khu vực này chỉ dành cho tài khoản bệnh nhân.")).toBeVisible();
  expect(privateApiRequests).toBe(0);
});
