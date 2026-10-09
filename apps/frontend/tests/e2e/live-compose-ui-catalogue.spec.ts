import { expect, test, type Page } from "@playwright/test";
import { isIllustrativeCatalogue } from "../../lib/catalogue-illustration";

async function loginAdmin(page: Page) {
  expect(process.env.PLAYWRIGHT_BASE_URL).toBe("http://localhost:3290");
  expect(process.env.PLAYWRIGHT_CMS_ISOLATED).toBe("1");
  expect(process.env.PLAYWRIGHT_CMS_DISPOSABLE_DATABASE).toMatch(/^healthcare_cms_account_[a-z0-9_]+$/);
  const email = process.env.PLAYWRIGHT_CMS_ADMIN_EMAIL;
  const password = process.env.PLAYWRIGHT_CMS_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Owned local ADMIN login prerequisite unavailable");
  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);
}

for (const width of [375, 768, 1440]) {
  test(`admin navigation and automatic native preview at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginAdmin(page);
    const nav = page.getByRole("navigation", { name: "Điều hướng quản trị" });
    const toggle = page.getByRole("button", { name: "Mở menu quản trị", exact: true });
    if (width < 1024) {
      await expect(nav).toBeHidden();
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveCount(1);
      expect((await page.locator("main").boundingBox())!.y).toBeLessThan(80);
      await toggle.press("Enter");
      await expect(nav).toBeVisible();
    } else {
      await expect(nav).toBeVisible();
      expect((await page.locator("main").boundingBox())!.y).toBeLessThan(80);
    }
    await nav.getByRole("link", { name: "Nội dung website", exact: true }).click();
    await expect(nav).toBeHidden();
    const device = page.getByTestId("cms-preview-width");
    await expect(device).toHaveValue(String(width));
    await expect(page.getByRole("status").filter({ hasText: "Chọn văn bản hoặc ảnh trong trang để chỉnh sửa." })).toBeVisible();
    await device.selectOption("768");
    await page.setViewportSize({ width: 375, height: 900 });
    await expect(device).toHaveValue("768");
    await page.getByRole("button", { name: "Tải lại", exact: true }).click();
    await expect(device).toHaveValue("768");
    await page.reload();
    await expect(device).toHaveValue("768");
    await page.getByRole("button", { name: "Mở điều hướng quản trị", exact: true }).click();
    await page.getByRole("button", { name: "Thu gọn điều hướng", exact: true }).press("Escape");
    await expect(nav).toBeHidden();
    await expect(page.getByRole("button", { name: "Mở điều hướng quản trị", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Mở điều hướng quản trị", exact: true }).click();
    await nav.getByRole("link", { name: "Tổng quan", exact: true }).click();
    await expect(nav).toBeHidden();
  });
}

test("public CMS toggle clears the mobile care rail", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await loginAdmin(page);
  await page.goto("/");
  const toolbar = page.getByTestId("cms-edit-toolbar");
  const rail = page.locator(".mobile-care-rail");
  await expect(toolbar).toBeVisible();
  await expect(rail).toBeVisible();
  const toolbarBox = (await toolbar.boundingBox())!;
  const railBox = (await rail.boundingBox())!;
  expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(railBox.y - 8);
  expect(toolbarBox.x).toBeGreaterThanOrEqual(0);
  expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(375);
});

for (const width of [375, 768, 1440]) {
  test(`illustrative cards and native details keep booking unavailable at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginAdmin(page);
    let packageSlug = "";
    for (const family of ["doctors", "branches", "services", "packages"]) {
      const response = await page.request.get(`/api/v1/hospital/${family}?page=0&size=100`);
      expect(response.status()).toBe(200);
      const items = await response.json() as { content: Array<{ id: string; slug: string; name?: string; fullName?: string }> };
      const item = items.content.find(isIllustrativeCatalogue);
      expect(item, `${family}: actual owned illustrative fixture required`).toBeDefined();
      if (family === "packages") packageSlug = item!.slug;
      await page.goto(`/${family}/${item!.slug}`);
      await expect(page.getByRole("heading", { name: item!.name ?? item!.fullName!, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Thông tin minh họa không nhận đặt lịch" }).first()).toBeDisabled();
      const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(schemas.join(" ")).not.toContain('"@type":"Offer"');
      expect(schemas.join(" ")).not.toContain('"@type":"Physician"');
      if (family === "packages") {
        const support = page.locator("section.resource-panel").filter({ has: page.getByRole("heading", { name: "Gói minh họa chỉ để tham khảo", exact: true }) });
        await expect(support.getByRole("button", { name: "Thông tin minh họa không nhận đặt lịch" })).toBeDisabled();
        await expect(support).toContainText("Dữ liệu minh họa không nhận đặt lịch khám. Vui lòng chọn thông tin thực tế.");
        await expect(support).not.toContainText("Nhận ngay mã phiếu khám điện tử");
        const price = page.locator("p").filter({ has: page.getByText("Giá minh họa", { exact: true }) });
        await expect(price).toContainText("VNĐ");
        const credit = page.locator("figcaption").filter({ hasText: "Ảnh minh họa:" });
        await expect(credit).toBeVisible();
        const image = (await credit.locator("..").boundingBox())!;
        const caption = (await credit.boundingBox())!;
        expect(caption.x).toBeGreaterThanOrEqual(image.x);
        expect(caption.x + caption.width).toBeLessThanOrEqual(image.x + image.width + 1);
      }
    }
    // The shared card handles homepage and catalogue actions consistently.
    await page.goto("/packages");
    const card = page.locator("article").filter({ has: page.locator(`a[href="/packages/${packageSlug}"]`) }).first();
    await expect(card.getByRole("button", { name: "Chỉ xem minh họa", exact: true })).toBeDisabled();
    const price = card.locator("p").filter({ has: page.getByText("Giá minh họa", { exact: true }) });
    await expect(price).toContainText("VNĐ");
    await card.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath(`illustrative-cards-${width}.png`) });
  });
}

test("long disease detail uses the available desktop heading width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAdmin(page);
  const response = await page.request.get("/api/v1/hospital/articles?page=0&size=100&contentKind=DISEASE_GUIDE");
  expect(response.status()).toBe(200);
  const items = await response.json() as { content: Array<{ slug: string }> };
  expect(items.content.length).toBeGreaterThan(0);
  await page.goto(`/benh-pho-bien/${items.content[0].slug}`);
  const header = page.locator(".resource-page__header--detail");
  await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
  const headerBox = (await header.boundingBox())!;
  const contentBox = (await page.locator(".section-inner").filter({ has: header }).last().boundingBox())!;
  expect(headerBox.width).toBeGreaterThan(contentBox.width * 0.75);
  await page.screenshot({ path: test.info().outputPath("disease-detail-1440.png") });
});

for (const width of [375, 768, 1440]) {
  test(`general booking filters actual illustrative catalogues at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginAdmin(page);
    const doctorsResponse = await page.request.get("/api/v1/hospital/doctors?page=0&size=100");
    const doctors = await doctorsResponse.json() as { content: Array<{ id: string; slug: string; specialtySlugs?: string[] }> };
    const realDoctor = doctors.content.find((doctor) => !isIllustrativeCatalogue(doctor));
    expect(realDoctor).toBeDefined();
    const specialtiesResponse = await page.request.get("/api/v1/hospital/specialties?page=0&size=100");
    const specialties = await specialtiesResponse.json() as { content: Array<{ id: string; slug: string }> };
    const specialty = specialties.content.find((item) => realDoctor!.specialtySlugs?.includes(item.slug));
    expect(specialty).toBeDefined();
    let holdRequests = 0;
    page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/appointments/hold")) holdRequests++; });
    await page.goto("/dat-lich");
    await expect(page.locator("#booking-specialty")).toBeEnabled();
    await page.locator("#booking-specialty").selectOption(specialty!.id);
    await page.getByRole("button", { name: /Tiếp tục: Chọn cơ sở/ }).click();
    const branch = page.locator("#booking-branch");
    await expect(branch).toBeVisible();
    const branchIds = await branch.locator("option").evaluateAll((options) => options.map((item) => (item as HTMLOptionElement).value).filter(Boolean));
    expect(branchIds.length).toBeGreaterThan(0);
    expect(branchIds.some((id) => isIllustrativeCatalogue({ id }))).toBe(false);
    await page.getByRole("button", { name: /Tiếp tục: Chọn bác sĩ/ }).click();
    const doctor = page.locator("#booking-doctor");
    await expect(doctor).toBeVisible();
    const doctorIds = await doctor.locator("option").evaluateAll((options) => options.map((item) => (item as HTMLOptionElement).value).filter(Boolean));
    expect(doctorIds.length).toBeGreaterThan(0);
    expect(doctorIds.some((id) => isIllustrativeCatalogue({ id }))).toBe(false);
    expect(holdRequests).toBe(0);
    await page.screenshot({ path: test.info().outputPath(`real-booking-choices-${width}.png`) });
  });
}
