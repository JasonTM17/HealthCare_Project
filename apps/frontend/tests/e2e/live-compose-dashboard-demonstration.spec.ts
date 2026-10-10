import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "";
const APPOINTMENT = "8ef669c2-1381-5813-b85a-3a1b547632fb";
const NOTICE = "Dữ liệu minh họa; không chuyển tiền và không có lịch khám thật.";
const BOOKING = "DEMO-DASH-261010";

// Actual UI/BFF/backend only: no response routing, bearer mint, or state replacement.
test.use({ trace: "off" }); // Session credentials must not enter a network trace.

async function login(page: Page, role: "ADMIN" | "PATIENT") {
  const password = process.env[`DASHBOARD_${role}_PASSWORD`];
  if (!password) throw new Error("Missing owned credential; values stay outside evidence");
  await page.goto(BASE);
  if ((page.viewportSize()?.width ?? 1440) <= 520) {
    await page.getByRole("button", { name: "Mở menu", exact: true }).click();
    await page.getByRole("dialog", { name: "Menu điều hướng" }).getByRole("link", { name: "Đăng nhập", exact: true }).click();
  } else {
    await page.locator("a.nav-account-link").first().click();
  }
  await page.getByLabel("Email", { exact: true }).fill(`dashboard-${role.toLowerCase()}@fixture.invalid`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(role === "ADMIN" ? /\/admin/ : /\/patient/);
}

async function read<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(new URL(`/api/v1${path}`, BASE).href);
  expect(response.status(), `${path.split("?")[0]} read status`).toBe(200);
  return await response.json() as T;
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test("owned patient submission reaches the admin notice and payment queue through the real BFF", async ({ browser }, testInfo) => {
  expect(process.env.PLAYWRIGHT_DASHBOARD_ISOLATED).toBe("1");
  expect(process.env.PLAYWRIGHT_DASHBOARD_DATABASE).toBe("healthcare_dashboard_ui_261010_7b3c385e");
  expect(BASE).toBe("http://localhost:3290");
  const patientContext = await browser.newContext({ viewport: { width: 375, height: 900 } });
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const patient = await patientContext.newPage();
  const admin = await adminContext.newPage();
  let qrRequests = 0;
  patient.on("request", (request) => { if (new URL(request.url()).hostname === "img.vietqr.io") qrRequests += 1; });
  try {
    await login(patient, "PATIENT");
    await login(admin, "ADMIN");
    const session = await read<{ user: { id: string } }>(patientContext.request, "/auth/browser-sessions/current");
    expect(session.user.id).toBe("18eb4aa3-6d44-5991-aa1a-4a6f93eae9e3");
    const owner = await read<{ user: { id: string } }>(adminContext.request, "/auth/browser-sessions/current");
    expect(owner.user.id).toBe("90000000-0000-0000-0000-000000000025");
    await patient.goto(`${BASE}/patient/dashboard#appointments`);
    await patient.getByRole("button", { name: `Thanh toán cho lịch ${BOOKING}`, exact: true }).click();
    const panel = patient.getByRole("region", { name: "Thanh toán chuyển khoản" });
    await expect(panel.getByText(NOTICE, { exact: true })).toBeVisible();
    const initial = await read<{ id: string; status: string; qrCodeUrl: string | null; bankAccount: string | null }>(patientContext.request, `/patient/appointments/${APPOINTMENT}/payment`);
    expect(initial.status, "Fresh owned UI graph must be unpaid; no replay/reset of earlier lifecycle DB").toBe("UNPAID");
    expect(initial.qrCodeUrl).toBeNull();
    expect(initial.bankAccount).toBeNull();
    await expect(panel.getByRole("img", { name: /VietQR/ })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /Sao chép số tài khoản|Tải mã VietQR/ })).toHaveCount(0);
    await noOverflow(patient);
    await patient.screenshot({ path: testInfo.outputPath("patient-owned-payment-before-375.png"), fullPage: true });
    await panel.getByLabel("Mã giao dịch mô phỏng", { exact: true }).fill("DEMO-261010-BROWSER-001");
    const submitted = patient.waitForResponse((response) => response.url().endsWith(`/appointments/${APPOINTMENT}/payment/submit`) && response.request().method() === "POST");
    await panel.getByRole("button", { name: "Gửi mã mô phỏng", exact: true }).click();
    expect((await submitted).status()).toBe(200);
    await expect(panel.getByText(/Giao dịch đã được ghi nhận và đang chờ admin/)).toBeVisible();
    expect(qrRequests).toBe(0);
    await noOverflow(patient);

    await admin.goto(`${BASE}/admin`);
    const bell = admin.getByRole("button", { name: /^Thông báo hệ thống/ });
    await bell.click();
    await admin.getByRole("button").filter({ hasText: "Có giao dịch chờ đối soát" }).filter({ hasText: BOOKING }).click();
    const detail = admin.getByRole("dialog", { name: /Có giao dịch chờ đối soát/ });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText(NOTICE);
    const queue = detail.getByRole("link");
    await expect(queue).toHaveAttribute("href", "/admin/payments?status=PENDING_VERIFICATION");
    await queue.click();
    await expect(admin).toHaveURL(/\/admin\/payments\?status=PENDING_VERIFICATION/);
    const row = admin.getByRole("row").filter({ hasText: BOOKING });
    await expect(row).toContainText(NOTICE);
    await expect(row.getByRole("button", { name: "Duyệt mô phỏng", exact: true })).toBeVisible();
    const pending = await read<{ content: Array<{ id: string; status: string }> }>(adminContext.request, "/admin/payments?status=PENDING_VERIFICATION&size=100");
    expect(pending.content.some((item) => item.id === initial.id && item.status === "PENDING_VERIFICATION")).toBe(true);
    await noOverflow(admin);
    await admin.screenshot({ path: testInfo.outputPath("admin-owned-payment-pending-1440.png"), fullPage: true });
    await row.getByRole("button", { name: "Duyệt mô phỏng", exact: true }).click();
    const decision = admin.getByRole("dialog", { name: "Phê duyệt thanh toán" });
    await expect(decision).toContainText("không xác nhận giao dịch ngân hàng");
    const review = admin.waitForResponse((response) => response.url().endsWith(`/admin/payments/${initial.id}`) && response.request().method() === "PATCH");
    await decision.getByRole("button", { name: "Duyệt mô phỏng", exact: true }).click();
    expect((await review).status()).toBe(200);
    await expect(decision).toHaveCount(0);
    await panel.getByRole("button", { name: "Kiểm tra ngay", exact: true }).click();
    await expect(panel).toContainText("Giao dịch mô phỏng đã được duyệt; không có chuyển tiền.");
    await expect(panel.getByRole("link", { name: /Biên nhận/ })).toHaveCount(0);
    await patient.reload();
    await expect(patient.getByRole("heading", { name: "Lịch hẹn của tôi", exact: true })).toBeVisible();
    await expect(patient.getByLabel("Trạng thái thanh toán: Đã thanh toán", { exact: true })).toBeVisible();
    const persisted = await read<{ status: string; demonstrationNotice: string }>(patientContext.request, `/patient/appointments/${APPOINTMENT}/payment`);
    expect(persisted.status).toBe("PAID");
    expect(persisted.demonstrationNotice).toBe(NOTICE);
    await noOverflow(patient);
    await patient.screenshot({ path: testInfo.outputPath("patient-owned-payment-persisted-375.png"), fullPage: true });
  } finally {
    await patientContext.close().catch(() => undefined);
    await adminContext.close().catch(() => undefined);
  }
});
