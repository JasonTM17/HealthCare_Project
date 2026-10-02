import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { installMockBrowserSession } from "./helpers/browser-session";

// Controlled browser/API fixtures: these tests never create an actual hold,
// deliver an email or confirm an appointment in the local/hosted backend.
const FIXTURE_NOW = new Date("2026-10-01T05:00:00.000Z");
const BOOKING_CODE = "HC-FIXTURE-PACKAGE-RECOVERY";
const PACKAGE = {
  id: "fixture-package-recovery",
  name: "Gói khám tổng quát kiểm thử",
  slug: "goi-kham-tong-quat-kiem-thu",
  description: "Dữ liệu giả lập cho kiểm thử khôi phục luồng đặt gói khám.",
  price: 2_000_000,
  active: true,
};
const DOCTOR = {
  id: "fixture-package-doctor",
  fullName: "Bác sĩ Kiểm Thử",
  slug: "bac-si-kiem-thu",
  branchId: "fixture-package-branch",
};
const BRANCH = {
  id: DOCTOR.branchId,
  name: "Cơ sở Kiểm Thử",
  slug: "co-so-kiem-thu",
  address: "Địa chỉ giả lập",
  phone: "0900000001",
  active: true,
  doctors: [DOCTOR],
};
const SLOT = {
  branchId: BRANCH.id,
  startTime: "08:00:00",
  endTime: "08:30:00",
  available: true,
  statusNote: "Còn chỗ",
};

function pageEnvelope<T>(content: T[]) {
  return {
    content,
    number: 0,
    size: 100,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

interface Scenario {
  branchFailure?: boolean;
  emptyBranches?: boolean;
  deliveryStatus?: "SENT" | "FAILED";
  holdSeconds?: number;
  otpSeconds?: number;
}

async function installScenario(context: BrowserContext, scenario: Scenario = {}) {
  const state = {
    branchFailure: scenario.branchFailure ?? false,
    branchRequests: 0,
    holdRequests: [] as Record<string, unknown>[],
    resendRequests: [] as Record<string, unknown>[],
    confirmRequests: 0,
  };
  const expiresAfter = (seconds: number) => new Date(FIXTURE_NOW.valueOf() + seconds * 1_000).toISOString();
  const holdExpiresAt = expiresAfter(scenario.holdSeconds ?? 600);

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/hospital/packages") {
      await route.fulfill({ json: pageEnvelope([PACKAGE]) });
    } else if (path === "/api/v1/hospital/branches") {
      state.branchRequests += 1;
      await route.fulfill(state.branchFailure
        ? { status: 503, json: { code: "SERVICE_UNAVAILABLE" } }
        : { json: pageEnvelope(scenario.emptyBranches ? [] : [BRANCH]) });
    } else if (path === "/api/v1/hospital/doctors") {
      await route.fulfill({ json: pageEnvelope([DOCTOR]) });
    } else if (path === `/api/v1/appointments/doctors/${DOCTOR.id}/slots`) {
      expect(request.method()).toBe("GET");
      expect(new URL(request.url()).searchParams.get("branchId")).toBe(BRANCH.id);
      await route.fulfill({ json: [SLOT] });
    } else if (path === "/api/v1/appointments/hold") {
      expect(request.method()).toBe("POST");
      state.holdRequests.push(request.postDataJSON());
      await route.fulfill({ json: {
        bookingCode: BOOKING_CODE,
        holdExpiresAt,
        otpExpiresAt: expiresAfter(scenario.otpSeconds ?? 300),
        otpRequired: true,
        otpDeliveryStatus: scenario.deliveryStatus ?? "SENT",
        message: "Phản hồi giữ chỗ giả lập.",
      } });
    } else if (path === `/api/v1/appointments/${BOOKING_CODE}/otp/resend`) {
      expect(request.method()).toBe("POST");
      state.resendRequests.push(request.postDataJSON());
      await route.fulfill({ json: {
        bookingCode: BOOKING_CODE,
        holdExpiresAt,
        otpExpiresAt: expiresAfter(400),
        otpRequired: true,
        otpDeliveryStatus: "SENT",
        retryAfterSeconds: 60,
      } });
    } else if (path === "/api/v1/appointments/confirm") {
      state.confirmRequests += 1;
      await route.fulfill({ status: 400, json: { code: "VALIDATION_ERROR" } });
    } else if (path.startsWith("/api/v1/cms/content/")) {
      await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
    } else {
      await route.fulfill({ status: request.method() === "GET" ? 200 : 405, json: pageEnvelope([]) });
    }
  });
  await installMockBrowserSession(context, null);
  return state;
}

async function openPackageBooking(page: Page) {
  await page.clock.install({ time: FIXTURE_NOW });
  await page.goto("/packages");
  await page.getByRole("button", { name: `Đặt lịch với gói này: ${PACKAGE.name}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Đặt Lịch Gói Khám Sức Khỏe" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function reachOtp(page: Page) {
  const dialog = await openPackageBooking(page);
  await expect(dialog.getByRole("radio", { name: BRANCH.name })).toBeChecked();
  await dialog.getByRole("button", { name: "Tiếp tục: Chọn ngày & giờ tiếp nhận" }).click();
  await expect(dialog.getByRole("button", { name: /08:00.*Còn chỗ/ })).toBeEnabled();
  await dialog.getByRole("button", { name: "Tiếp tục: Điền thông tin người khám" }).click();
  await dialog.getByLabel("Họ và tên người khám").fill("Người Khám Giả Lập");
  await dialog.getByLabel("Số điện thoại liên hệ").fill("0900000001");
  await dialog.getByLabel("Email nhận mã OTP & Phiếu khám").fill("fixture@example.com");
  await dialog.getByRole("checkbox", { name: /Tôi đồng ý để HealthCare lưu trữ/ }).check();
  await dialog.getByRole("button", { name: "Giữ chỗ và nhận mã OTP →" }).click();
  await expect(dialog.getByRole("heading", { name: "Xác nhận mã OTP đặt lịch" })).toBeVisible();
  return dialog;
}

test.describe("Package booking recovery with controlled API fixtures", () => {
  test.describe.configure({ timeout: 60_000 });
  test.use({ viewport: { width: 375, height: 812 } });

  test("an expired OTP on a live hold can be resent and a fresh code enables confirmation", async ({ context, page }, testInfo) => {
    const state = await installScenario(context, { otpSeconds: 30 });
    const dialog = await reachOtp(page);
    const submit = dialog.getByRole("button", { name: "Hoàn tất đặt lịch khám" });
    await dialog.getByLabel("Nhập mã OTP 6 số").fill("123456");
    await expect(submit).toBeEnabled();
    await page.clock.runFor(61_000);
    await expect(submit).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("otp-expired-live-hold.png") });

    const resend = dialog.getByRole("button", { name: "Gửi lại mã OTP", exact: true });
    await expect(resend).toBeVisible();
    await expect(resend).toBeEnabled();
    await resend.click();
    await expect.poll(() => state.resendRequests.length).toBe(1);
    expect(state.resendRequests[0]).toEqual({ phone: "0900000001" });
    await expect(dialog.getByLabel("Nhập mã OTP 6 số")).toHaveValue("");
    await expect(submit).toBeDisabled();
    await dialog.getByLabel("Nhập mã OTP 6 số").fill("654321");
    await expect(submit).toBeEnabled();
    await expect(dialog.getByRole("button", { name: /Gửi lại.*sau/ })).toBeDisabled();
    expect(state.holdRequests).toHaveLength(1);
    expect(state.holdRequests[0]).toMatchObject({ packageId: PACKAGE.id, branchId: BRANCH.id, doctorId: DOCTOR.id });
    expect(state.confirmRequests).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("otp-resend-recovered.png") });
  });

  test("FAILED delivery is honest and offers immediate resend before accepting a new code", async ({ context, page }, testInfo) => {
    const state = await installScenario(context, { deliveryStatus: "FAILED" });
    const dialog = await reachOtp(page);
    await page.screenshot({ path: testInfo.outputPath("otp-delivery-failed.png") });
    await expect(dialog.getByRole("alert")).toContainText("Chưa thể gửi mã OTP");
    await expect(dialog.getByText(/Mã OTP đã gửi tới email/)).toHaveCount(0);
    const resend = dialog.getByRole("button", { name: "Gửi lại mã OTP", exact: true });
    await expect(resend).toBeEnabled();
    await resend.click();
    await expect.poll(() => state.resendRequests.length).toBe(1);
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(dialog.getByText(/Mã OTP đã gửi tới email/)).toBeVisible();
    expect(state.confirmRequests).toBe(0);
  });

  test("branches 503 exposes a failure and a retry that recovers without restarting the wizard", async ({ context, page }, testInfo) => {
    const state = await installScenario(context, { branchFailure: true });
    const dialog = await openPackageBooking(page);
    await expect(dialog.getByText("Đang tải danh sách cơ sở khám…")).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath("branches-unavailable.png") });
    await expect(dialog.getByRole("alert")).toContainText("Chưa thể tải danh sách cơ sở khám");
    await expect(dialog.getByRole("status")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Tiếp tục: Chọn ngày & giờ tiếp nhận" })).toBeDisabled();
    const requestsBeforeRetry = state.branchRequests;
    state.branchFailure = false;
    await dialog.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect.poll(() => state.branchRequests).toBeGreaterThan(requestsBeforeRetry);
    await expect(dialog.getByRole("radio", { name: BRANCH.name })).toBeChecked();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Tiếp tục: Chọn ngày & giờ tiếp nhận" })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("branches-retry-recovered.png") });
  });

  test("a successful empty branch catalog has its own explanation and keeps continuation disabled", async ({ context, page }, testInfo) => {
    await installScenario(context, { emptyBranches: true });
    const dialog = await openPackageBooking(page);
    await expect(dialog.getByText("Đang tải danh sách cơ sở khám…")).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath("branches-empty.png") });
    await expect(dialog.getByRole("status")).toContainText("Chưa có cơ sở khám");
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Tiếp tục: Chọn ngày & giờ tiếp nhận" })).toBeDisabled();
  });

  test("keyboard step transitions focus the next heading and restore the previous heading on back", async ({ context, page }, testInfo) => {
    await installScenario(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    const dialog = await openPackageBooking(page);
    const next = dialog.getByRole("button", { name: "Tiếp tục: Chọn ngày & giờ tiếp nhận" });
    await expect(next).toBeEnabled();
    await next.focus();
    await page.keyboard.press("Enter");
    await page.screenshot({ path: testInfo.outputPath("step-two-keyboard-focus.png") });
    await expect(dialog.getByRole("heading", { name: "Chọn ngày & khung giờ tiếp nhận" })).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Tiếp tục: Điền thông tin người khám" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Tiếp tục: Điền thông tin người khám" }).click();
    await expect(dialog.getByRole("heading", { name: "Thông tin người khám sức khỏe" })).toBeFocused();
    await dialog.getByRole("button", { name: "← Quay lại", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Chọn ngày & khung giờ tiếp nhận" })).toBeFocused();
  });

  test("an expired hold disables confirmation and never offers resend", async ({ context, page }) => {
    const state = await installScenario(context, { holdSeconds: 90, otpSeconds: 180 });
    const dialog = await reachOtp(page);
    await dialog.getByLabel("Nhập mã OTP 6 số").fill("123456");
    await expect(dialog.getByRole("button", { name: "Hoàn tất đặt lịch khám" })).toBeEnabled();
    await page.clock.runFor(91_000);
    await expect(dialog.getByRole("button", { name: "Hoàn tất đặt lịch khám" })).toBeDisabled();
    await expect(dialog.getByLabel("Nhập mã OTP 6 số")).toBeDisabled();
    await expect(dialog.getByRole("button", { name: /Gửi lại mã OTP/ })).toHaveCount(0);
    expect(state.resendRequests).toHaveLength(0);
    expect(state.confirmRequests).toBe(0);
  });
});
