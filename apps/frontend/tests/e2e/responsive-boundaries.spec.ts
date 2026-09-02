import { expect, test } from "@playwright/test";

test.describe("public responsive boundaries", () => {
  test("articles stays within a 320px viewport, including navigation and pagination", async ({ context, page }) => {
    await context.route("**/api/v1/hospital/articles*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: [{
            id: "responsive-article",
            title: "Chuẩn bị câu hỏi trước buổi khám",
            slug: "chuan-bi-cau-hoi",
            summary: "Một tóm tắt ngắn để người bệnh chuẩn bị tốt hơn.",
            publishedAt: "2026-08-31T08:00:00Z",
            active: true,
          }],
          totalElements: 13,
          totalPages: 2,
          size: 12,
          number: 0,
          first: true,
          last: false,
          empty: false,
        }),
      });
    });

    for (const width of [320, 375, 414]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/articles", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Kiến thức y khoa trong nhịp sống hằng ngày" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Phân trang cẩm nang" })).toBeVisible();

      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await expect.poll(() => page.evaluate(() => {
        const viewportRight = document.documentElement.clientWidth;
        return Math.max(...Array.from(document.querySelectorAll<HTMLElement>(".site-nav__inner *,.catalog-pagination *"), (element) => element.getBoundingClientRect().right), viewportRight) - viewportRight;
      })).toBeLessThanOrEqual(1);

      await page.getByRole("button", { name: "Mở menu" }).click();
      await expect(page.getByRole("dialog", { name: "Menu điều hướng" }).getByRole("link", { name: "Đăng nhập" })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.getByRole("button", { name: "Đóng menu" }).click();
    }
  });

  test("appointment lookup fields are label-associated and announce recoverable errors", async ({ context, page }) => {
    await context.route("**/api/v1/appointments/*", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: "APPOINTMENT_NOT_FOUND" }),
      });
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/tra-cuu", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Mã lịch hẹn khám")).toBeVisible();
    await expect(page.getByLabel("Số điện thoại đặt lịch")).toBeVisible();

    await page.getByLabel("Mã lịch hẹn khám").fill("APT-ACCESSIBILITY");
    await page.getByLabel("Số điện thoại đặt lịch").fill("0901234567");
    await page.getByRole("button", { name: "Tra cứu ngay" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Không tìm thấy lịch hẹn" })).toBeVisible();
  });

  test("auth entry routes stay within the narrowest mobile viewport", async ({ page }) => {
    for (const route of ["/auth/login", "/auth/register"]) {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".auth-page").getByRole("heading").first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await expect.poll(() => page.evaluate(() => {
        const viewportRight = document.documentElement.clientWidth;
        return Math.max(...Array.from(document.querySelectorAll<HTMLElement>(".auth-page *"), (element) => element.getBoundingClientRect().right), viewportRight) - viewportRight;
      })).toBeLessThanOrEqual(1);
    }
  });
});
