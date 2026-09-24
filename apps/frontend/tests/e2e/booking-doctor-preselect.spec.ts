import { expect, test } from "@playwright/test";

// A doctor CTA must carry the chosen doctor into the booking wizard: step 1
// shows that doctor's name (the booking-preselected-doctor card), the panel
// header names the designated doctor, and the specialty select is prefilled
// from the doctor's catalog identity. Opening the wizard without a selection
// (navbar) must not show the card.
//
// Hermetic: every catalog request is fulfilled from the fixtures below so the
// spec runs on CI, where the Playwright server has no live backend.

const BRANCH = {
  id: "branch-preselect-1",
  name: "HealthCare Đa khoa Trung tâm",
  slug: "healthcare-trung-tam",
  address: "02 Hai Bà Trưng, Quận 1",
  phone: "02812345678",
  workingHours: "Thứ 2 - Thứ 7, 07:00 - 17:00",
  active: true,
};

const BRANCH_2 = {
  id: "branch-preselect-2",
  name: "HealthCare Cơ sở 2 - Bình Thạnh",
  slug: "healthcare-co-so-2",
  address: "45 Đinh Tiên Hoàng, Bình Thạnh",
  phone: "02887654321",
  workingHours: "Thứ 2 - Thứ 7, 07:30 - 16:30",
  active: true,
};

const SPECIALTY = {
  id: "spec-ent",
  name: "Tai mũi họng",
  slug: "tai-mui-hong",
  description: "Khám và điều trị bệnh lý tai mũi họng.",
  active: true,
};

const DOCTOR = {
  id: "doctor-bao",
  fullName: "BS Trương Gia Bảo",
  slug: "truong-gia-bao",
  title: "Bác sĩ Tai mũi họng",
  specialtyName: SPECIALTY.name,
  specialtySlugs: [SPECIALTY.slug],
  branchId: BRANCH.id,
  branchIds: [BRANCH.id, BRANCH_2.id],
  branchNames: [BRANCH.name, BRANCH_2.name],
  bio: "Bác sĩ chuyên khoa Tai Mũi Họng với hơn 9 năm kinh nghiệm điều trị viêm họng, viêm xoang.",
  active: true,
};

const SLOTS = [
  {
    branchId: BRANCH.id,
    startTime: "08:00:00",
    endTime: "08:30:00",
    available: true,
    statusNote: "Còn trống",
  },
  {
    branchId: BRANCH_2.id,
    startTime: "08:00:00",
    endTime: "08:30:00",
    available: true,
    statusNote: "Còn trống",
  },
];

function pageEnvelope<T>(content: T[]) {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    size: 100,
    number: 0,
    first: true,
    last: true,
    empty: false,
  };
}

async function installCatalogMocks(context: import("@playwright/test").BrowserContext) {
  await context.route("**/api/v1/auth/browser-sessions/current", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify({ code: "BROWSER_SESSION_REQUIRED" }),
    });
  });
  await context.route(/\/api\/v1\/hospital\/branches/, async (route) => {
    await route.fulfill({ json: pageEnvelope([BRANCH, BRANCH_2]) });
  });
  await context.route(/\/api\/v1\/hospital\/specialties/, async (route) => {
    await route.fulfill({ json: pageEnvelope([SPECIALTY]) });
  });
  await context.route(/\/api\/v1\/hospital\/doctors(\/.*)?/, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.includes(`/doctors/${DOCTOR.slug}`)) {
      await route.fulfill({ json: DOCTOR });
    } else {
      await route.fulfill({ json: pageEnvelope([DOCTOR]) });
    }
  });
  await context.route(/\/appointments\/doctors\/.*\/slots/, async (route) => {
    const url = new URL(route.request().url());
    const branchId = url.searchParams.get("branchId") || BRANCH.id;
    const filtered = SLOTS.filter((s) => s.branchId === branchId);
    await route.fulfill({ json: filtered });
  });
  await context.route(/\/api\/v1\/appointments\/hold/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        bookingCode: "HC-E2E-PRESELECT",
        holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        otpExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        message: "Đã giữ chỗ và gửi OTP.",
        otpRequired: true,
      }),
    });
  });
  await context.route(/\/api\/v1\/appointments\/confirm/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "apt-preselect-001",
        bookingCode: "HC-E2E-PRESELECT",
        appointmentCode: "HC-CONF-0001",
        patientName: "Nguyễn Văn An",
        patientPhone: "0901234567",
        patientEmail: "patient@example.com",
        doctorId: DOCTOR.id,
        doctorName: DOCTOR.fullName,
        doctorTitle: DOCTOR.title,
        specialtyName: SPECIALTY.name,
        branchName: BRANCH.name,
        appointmentDate: "2026-09-25",
        startTime: "08:00:00",
        endTime: "08:30:00",
        hasInsurance: false,
      }),
    });
  });
  await context.route(/\/api\/v1\/hospital\/packages/, async (route) => {
    await route.fulfill({ json: pageEnvelope([]) });
  });
  await context.route(/\/api\/v1\/hospital\/articles/, async (route) => {
    await route.fulfill({ json: pageEnvelope([]) });
  });
}

test.describe("doctor CTA preselects the booking wizard", () => {
  test("doctor card CTA opens the wizard with that doctor's name", async ({ page, context }) => {
    await installCatalogMocks(context);
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });
    const card = page.locator("article.catalog-card").first();
    await expect(card).toBeVisible({ timeout: 25000 });
    const name = (await card.locator("h2").innerText()).trim();
    expect(name).toBe(DOCTOR.fullName);

    await card.getByRole("button", { name: /^Đặt lịch với bác sĩ/ }).click();

    const panel = page.getByTestId("booking-preselected-doctor");
    await expect(panel).toBeVisible();
    await expect(panel.locator("h4")).toHaveText(name);
    await expect(page.locator(".booking-panel__title")).toContainText(name);
    await expect(page.locator("#booking-specialty")).not.toHaveValue("");
  });

  test("doctor detail CTA opens the wizard with that doctor's name", async ({ page, context }) => {
    await installCatalogMocks(context);
    await page.goto(`/doctors/${DOCTOR.slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: DOCTOR.fullName })).toBeVisible();

    await page.getByRole("button", { name: "Đặt lịch với bác sĩ", exact: true }).click();

    const panel = page.getByTestId("booking-preselected-doctor");
    await expect(panel).toBeVisible();
    await expect(panel.locator("h4")).toHaveText(DOCTOR.fullName);
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);
    await expect(page.locator("#booking-specialty")).not.toHaveValue("");
  });

  test("homepage doctor card CTA opens the wizard with that doctor's name in header and step 1", async ({ page, context }) => {
    await installCatalogMocks(context);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const doctorCard = page.locator(".doctor-card").first();
    await expect(doctorCard).toBeVisible();
    const doctorName = (await doctorCard.locator("h3").innerText()).trim();
    expect(doctorName).toBe(DOCTOR.fullName);

    await doctorCard.getByRole("button", { name: /^Đặt lịch với bác sĩ/ }).click();

    const headerTitle = page.locator(".booking-panel__title");
    await expect(headerTitle).toBeVisible();
    await expect(headerTitle).toContainText(doctorName);

    const panel = page.getByTestId("booking-preselected-doctor");
    await expect(panel).toBeVisible();
    await expect(panel.locator("h4")).toHaveText(doctorName);
    await expect(page.locator("#booking-specialty")).not.toHaveValue("");
  });

  test("switching doctors dismisses the preselected card", async ({ page, context }) => {
    await installCatalogMocks(context);
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });
    const card = page.locator("article.catalog-card").first();
    await expect(card).toBeVisible({ timeout: 25000 });

    await card.getByRole("button", { name: /^Đặt lịch với bác sĩ/ }).click();
    const panel = page.getByTestId("booking-preselected-doctor");
    await expect(panel).toBeVisible();

    await panel.getByRole("button", { name: "Đổi bác sĩ khác" }).click();
    await expect(panel).toHaveCount(0);
    // The wizard stays usable: specialty selection remains prefilled.
    await expect(page.locator("#booking-specialty")).not.toHaveValue("");
  });

  test("navbar booking opens without a preselected doctor", async ({ page, context }) => {
    await installCatalogMocks(context);
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });
    const card = page.locator("article.catalog-card").first();
    await expect(card).toBeVisible({ timeout: 25000 });

    await page.getByRole("button", { name: "Đặt lịch khám" }).first().click();

    await expect(page.locator(".booking-panel__title")).toContainText("Đặt lịch trực tuyến nhanh chóng");
    await expect(page.getByTestId("booking-preselected-doctor")).toHaveCount(0);
  });

  test("progression through steps 1 to 7 preserves doctor identity through confirmation e-card", async ({ page, context }) => {
    await installCatalogMocks(context);
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });
    const card = page.locator("article.catalog-card").first();
    await expect(card).toBeVisible({ timeout: 25000 });

    await card.getByRole("button", { name: /^Đặt lịch với bác sĩ/ }).click();

    // Step 1: Doctor identity in header and Step 1 card
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);
    await expect(page.getByTestId("booking-preselected-doctor")).toBeVisible();

    // Step 1 -> Step 2
    await page.getByRole("button", { name: /Tiếp tục: Chọn cơ sở/ }).click();
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);
    await expect(page.locator("h3")).toContainText(`Chọn cơ sở khám cùng ${DOCTOR.fullName}`);

    // Step 2 -> Step 3
    await page.getByRole("button", { name: /Tiếp tục: Chọn bác sĩ/ }).click();
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);
    await expect(page.locator("h3")).toContainText(`Xác nhận bác sĩ tiếp nhận: ${DOCTOR.fullName}`);
    await expect(page.locator("#booking-doctor")).toHaveValue(DOCTOR.id);

    // Step 3 -> Step 4
    await page.getByRole("button", { name: /Tiếp tục: Chọn ngày/ }).click();
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);
    await expect(page.locator("h3")).toContainText(`Chọn ngày khám cùng ${DOCTOR.fullName}`);

    // Step 4 -> Step 5
    await page.getByRole("button", { name: /Xem khung giờ/ }).click();
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);
    await expect(page.locator("h3")).toContainText(`Chọn khung giờ khám cùng ${DOCTOR.fullName}`);

    // Step 5: Select slot -> Step 6
    const slotButton = page.getByRole("button", { name: /08:00/ }).first();
    await expect(slotButton).toBeVisible();
    await slotButton.click();
    await page.getByRole("button", { name: /Tiếp tục: Điền thông tin/ }).click();

    // Step 6: Patient Information Form
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);
    await expect(page.getByTestId("booking-step6-doctor")).toContainText(DOCTOR.fullName);
    await page.locator("#booking-full-name").fill("Nguyễn Văn An");
    await page.locator("#booking-phone").fill("0901234567");
    await page.locator("#booking-email").fill("patient@example.com");
    await page.locator("#booking-privacy-consent").check();

    // Step 6 -> Step 7 (OTP Hold)
    await page.getByRole("button", { name: /Giữ chỗ và nhận mã OTP/ }).click();
    await expect(page.getByTestId("booking-otp-doctor")).toHaveText(DOCTOR.fullName);

    // Step 7: Confirm OTP -> Confirmed E-Card Ticket
    await page.locator("#booking-otp").fill("123456");
    await page.getByRole("button", { name: /Hoàn tất đặt lịch khám/ }).click();

    await expect(page.locator("h3")).toContainText("Đặt lịch khám thành công!");
    await expect(page.getByTestId("booking-confirmed-doctor")).toContainText(DOCTOR.fullName);
  });

  test("generic navbar booking allows selecting any branch on step 2 without doctor lock", async ({ page, context }) => {
    await installCatalogMocks(context);
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });
    const card = page.locator("article.catalog-card").first();
    await expect(card).toBeVisible({ timeout: 25000 });

    // Open generic booking from navbar
    await page.getByRole("button", { name: "Đặt lịch khám" }).first().click();
    await expect(page.locator(".booking-panel__title")).toContainText("Đặt lịch trực tuyến nhanh chóng");

    // Advance to Step 2
    await page.getByRole("button", { name: /Tiếp tục: Chọn cơ sở/ }).click();
    await expect(page.locator("h3")).toContainText("Chọn cơ sở y tế thuận tiện nhất");

    // Both branches must be available in select
    const branchSelect = page.locator("#booking-branch");
    await expect(branchSelect).toBeVisible();
    const branch1Option = branchSelect.locator(`option[value="${BRANCH.id}"]`);
    const branch2Option = branchSelect.locator(`option[value="${BRANCH_2.id}"]`);
    await expect(branch1Option).toHaveCount(1);
    await expect(branch2Option).toHaveCount(1);

    // Select Branch 2 and proceed to Step 3
    await branchSelect.selectOption(BRANCH_2.id);
    await page.getByRole("button", { name: /Tiếp tục: Chọn bác sĩ/ }).click();
    await expect(page.locator("#booking-doctor")).toBeVisible();
  });

  test("dismissing preselected doctor and continuing to step 4 restores doctor header context", async ({ page, context }) => {
    await installCatalogMocks(context);
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });
    const card = page.locator("article.catalog-card").first();
    await expect(card).toBeVisible({ timeout: 25000 });

    await card.getByRole("button", { name: /^Đặt lịch với bác sĩ/ }).click();
    await expect(page.getByTestId("booking-preselected-doctor")).toBeVisible();

    // Dismiss preselected doctor
    await page.getByRole("button", { name: "Đổi bác sĩ khác" }).click();
    await expect(page.locator(".booking-panel__title")).toContainText("Đặt lịch trực tuyến nhanh chóng");

    // Step 2
    await page.getByRole("button", { name: /Tiếp tục: Chọn cơ sở/ }).click();
    await expect(page.locator("h3")).toContainText("Chọn cơ sở y tế thuận tiện nhất");

    // Step 3
    await page.getByRole("button", { name: /Tiếp tục: Chọn bác sĩ/ }).click();
    await expect(page.locator("#booking-doctor")).toHaveValue(DOCTOR.id);

    // Step 4: After confirming/selecting doctor in Step 3, header context must reflect the doctor
    await page.getByRole("button", { name: /Tiếp tục: Chọn ngày/ }).click();
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);
    await expect(page.locator("h3")).toContainText(`Chọn ngày khám cùng ${DOCTOR.fullName}`);
  });

  test("branch switching on step 2 preserves designated doctor", async ({ page, context }) => {
    await installCatalogMocks(context);
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });
    const card = page.locator("article.catalog-card").first();
    await expect(card).toBeVisible({ timeout: 25000 });

    await card.getByRole("button", { name: /^Đặt lịch với bác sĩ/ }).click();
    await page.getByRole("button", { name: /Tiếp tục: Chọn cơ sở/ }).click();

    // Switch to Branch 2
    const branchSelect = page.locator("#booking-branch");
    await expect(branchSelect).toBeVisible();
    await branchSelect.selectOption(BRANCH_2.id);

    // Header and Step 2 heading must still preserve Doctor Bao
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);
    await expect(page.locator("h3")).toContainText(`Chọn cơ sở khám cùng ${DOCTOR.fullName}`);

    // Advance to Step 3 and confirm doctor is still preselected
    await page.getByRole("button", { name: /Tiếp tục: Chọn bác sĩ/ }).click();
    await expect(page.locator("#booking-doctor")).toHaveValue(DOCTOR.id);
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);
  });

  test("search page doctor CTA opens wizard with designated doctor", async ({ page, context }) => {
    await installCatalogMocks(context);
    await page.goto("/search?q=Bao", { waitUntil: "domcontentloaded" });

    const doctorResult = page.locator(".search-result").filter({ hasText: DOCTOR.fullName });
    await expect(doctorResult).toBeVisible({ timeout: 25000 });

    await doctorResult.getByRole("button", { name: /Đặt lịch/ }).click();

    const panel = page.getByTestId("booking-preselected-doctor");
    await expect(panel).toBeVisible();
    await expect(panel.locator("h4")).toHaveText(DOCTOR.fullName);
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);
    await expect(page.locator("#booking-specialty")).not.toHaveValue("");
  });

  test("mobile viewport renders doctor highlight card and header cleanly", async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await installCatalogMocks(context);
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });

    const card = page.locator("article.catalog-card").first();
    await expect(card).toBeVisible({ timeout: 25000 });

    await card.getByRole("button", { name: /^Đặt lịch với bác sĩ/ }).click();

    const panel = page.getByTestId("booking-preselected-doctor");
    await expect(panel).toBeVisible();
    await expect(panel.locator("h4")).toHaveText(DOCTOR.fullName);
    await expect(page.locator(".booking-panel__title")).toContainText(DOCTOR.fullName);

    // Verify change doctor button is clickable on mobile
    const switchBtn = panel.getByRole("button", { name: "Đổi bác sĩ khác" });
    await expect(switchBtn).toBeVisible();
    await switchBtn.click();
    await expect(panel).toHaveCount(0);
  });
});
