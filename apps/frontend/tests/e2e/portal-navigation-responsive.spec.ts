import { expect, test } from "@playwright/test";
import { browserSessionFixture, installMockBrowserSession } from "./helpers/browser-session";

for (const role of ["PATIENT", "DOCTOR"] as const) {
  test(`${role.toLowerCase()} navigation fits across the tablet-to-desktop boundary`, async ({ context, page }) => {
    await context.route("**/api/v1/**", (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
    }));
    await installMockBrowserSession(context, browserSessionFixture(
      role,
      `route-matrix-${role.toLowerCase()}`,
      `Route Matrix ${role}`,
    ));

    // 1024px reproduced the defect; adjacent breakpoints guard the layout
    // transition, and 1440px protects the existing desktop presentation.
    for (const width of [1024, 900, 901, 1280, 1281, 1440]) {
      await test.step(`${width}px`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${role.toLowerCase()}`, { waitUntil: "domcontentloaded" });
        const navigation = page.getByRole("navigation", { name: "Điều hướng cổng thông tin" });
        await expect(navigation).toBeVisible();
        await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeInViewport();

        const geometry = await page.evaluate(() => {
          const selectors = [".portal-header__inner", ".portal-brand", ".portal-nav", ".portal-user"];
          return selectors.map((selector) => {
            const element = document.querySelector<HTMLElement>(selector)!;
            const rect = element.getBoundingClientRect();
            return { selector, left: rect.left, right: rect.right, width: rect.width };
          });
        });
        await expect.poll(
          () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
          { message: `${width}px portal header geometry: ${JSON.stringify(geometry)}` },
        ).toBeLessThanOrEqual(1);

        for (const link of await navigation.getByRole("link").all()) {
          await expect(link).toBeInViewport();
          await link.focus();
          await expect(link).toBeFocused();
        }
        await navigation.getByRole("link", { name: "Trang chính", exact: true }).focus();
        await page.keyboard.press("Tab");
        await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeFocused();
      });
    }
  });
}
