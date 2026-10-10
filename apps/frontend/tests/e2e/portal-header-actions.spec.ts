import { expect, test } from "@playwright/test";
import { browserSessionFixture, installMockBrowserSession } from "./helpers/browser-session";

test.describe.configure({ timeout: 90_000 });

for (const role of ["PATIENT", "DOCTOR"] as const) {
  test(`${role.toLowerCase()} header actions remain separate, reachable and safe`, async ({ context, page }, testInfo) => {
    const logoutRequests: string[] = [];
    await context.route("**/api/v1/**", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
      });
    });
    const session = browserSessionFixture(role, `header-actions-${role.toLowerCase()}`, "Người kiểm thử tên dài trong cổng thông tin");
    // Override only GET: failed DELETE must exercise the real logout handler.
    await installMockBrowserSession(context, session);
    await context.route("**/api/v1/auth/browser-sessions/current", async (route) => {
      const request = route.request();
      if (request.method() === "GET") return route.fallback();
      expect(request.method()).toBe("DELETE");
      expect(request.headers()["authorization"]).toBeUndefined();
      logoutRequests.push(request.method());
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }) });
    });

    for (const width of [320, 375, 768, 1440, 1920]) {
      await test.step(`${width}px`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${role.toLowerCase()}/dashboard`, { waitUntil: "domcontentloaded" });
        const logout = page.getByRole("button", { name: "Đăng xuất", exact: true });
        await expect(logout).toBeInViewport();
        const assistant = page.getByRole("button", { name: "Trợ lý AI", exact: true });

        const assertGeometry = async () => {
          const bounds = await logout.boundingBox();
          expect(bounds).not.toBeNull();
          expect(bounds!.height).toBeGreaterThanOrEqual(44);
          expect(bounds!.width).toBeGreaterThanOrEqual(44);
          expect(bounds!.x).toBeGreaterThanOrEqual(0);
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
          const targets = role === "PATIENT" ? [assistant, logout] : [logout];
          if (role === "PATIENT") {
            const aiBounds = await assistant.boundingBox();
            expect(aiBounds).not.toBeNull();
            expect(Math.abs(aiBounds!.y - bounds!.y), "AI and logout share one row").toBeLessThanOrEqual(1);
            expect(Math.abs(aiBounds!.height - bounds!.height)).toBeLessThanOrEqual(1);
            expect(Math.abs(aiBounds!.width - bounds!.width), "equal action widths").toBeLessThanOrEqual(1);
            expect(aiBounds!.x + aiBounds!.width + 4).toBeLessThanOrEqual(bounds!.x);
          } else {
            await expect(assistant).toHaveCount(0);
          }
          for (const target of targets) {
            expect(await target.evaluate((node) => {
              const rect = node.getBoundingClientRect();
              return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
            }), "button centre receives pointer events").toBe(true);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
        };
        await assertGeometry();
        const profile = page.getByRole("link", { name: "Xem thông tin tài khoản", exact: true });
        await profile.focus();
        await page.keyboard.press("Tab");
        if (role === "PATIENT") {
          await expect(assistant).toBeFocused();
          await page.keyboard.press("Enter");
          const dialog = page.getByRole("dialog", { name: "Trợ lý sức khỏe HealthCare" });
          await expect(dialog).toBeVisible();
          await page.getByRole("button", { name: "Đóng cửa sổ trợ lý", exact: true }).click();
          await expect(dialog).toHaveCount(0);
          await assistant.focus();
          await page.keyboard.press("Tab");
        }
        await expect(logout).toBeFocused();
        const callsBefore = logoutRequests.length;
        await logout.click();
        await expect(page.getByRole("status").filter({ hasText: "Không thể đăng xuất an toàn" })).toBeVisible();
        expect(logoutRequests.length).toBe(callsBefore + 1);
        await expect(logout).toBeEnabled();
        await expect(profile).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`/${role.toLowerCase()}/dashboard(?:/)?$`));
        await assertGeometry();
        await page.screenshot({ path: testInfo.outputPath(`header-${role.toLowerCase()}-${width}.png`) });
      });
    }
  });
}
