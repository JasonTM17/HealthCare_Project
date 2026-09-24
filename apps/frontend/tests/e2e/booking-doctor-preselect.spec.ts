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
  branchIds: [BRANCH.id],
  branchNames: [BRANCH.name],
  bio: "Bác sĩ chuyên khoa Tai Mũi Họng với hơn 9 năm kinh nghiệm điều trị viêm họng, viêm xoang.",
  active: true,
};

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
    await route.fulfill({ json: pageEnvelope([BRANCH]) });
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

    await page.getByRole("button", { name: "Đặt lịch khám" }).first().click();

    await expect(page.getByTestId("booking-preselected-doctor")).toHaveCount(0);
  });
});
