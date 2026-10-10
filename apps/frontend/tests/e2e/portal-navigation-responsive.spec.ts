import { expect, test } from "@playwright/test";
import { browserSessionFixture, installMockBrowserSession } from "./helpers/browser-session";

test.describe.configure({ timeout: 60_000 });

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
    for (const width of [1024, 900, 901, 1280, 1281, 1440, 1920]) {
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
          await link.scrollIntoViewIfNeeded();
          await expect(link).toBeInViewport();
          await link.focus();
          await expect(link).toBeFocused();
        }
        const navLinks = navigation.getByRole("link");
        await navLinks.last().focus();
        // The notification bell is a focus stop between the last nav link and
        // the account link for BOTH portals now: Ultra V4 WS-B gave the doctor
        // shell the same bell the patient already had (components/PortalChrome
        // .tsx `portal-notification-bell`), so the doctor keyboard path gained a
        // stop that this spec used to assert only for the patient. Enumerating
        // it for both roles keeps the full tab order pinned; dropping the stop
        // would have silently unchecked the doctor's next tab target.
        await page.keyboard.press("Tab");
        const bell = page.getByRole("link", { name: /Thông báo từ bệnh viện/ });
        await expect(bell).toBeFocused();
        await page.keyboard.press("Tab");
        const profile = page.getByRole("link", { name: "Xem thông tin tài khoản", exact: true });
        await expect(profile).toBeFocused();
        expect(await profile.evaluate((node) => parseFloat(getComputedStyle(node).outlineWidth))).toBeGreaterThanOrEqual(2);
        expect(await profile.evaluate((node) => {
          const luminance = (rgb: number[]) => rgb.slice(0, 3).reduce((sum, value, index) => {
            const channel = value / 255;
            return sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
          }, 0);
          const color = (value: string) => value.match(/[\d.]+/g)!.map(Number);
          const nodes: Element[] = [];
          for (let ancestor: Element | null = node.parentElement; ancestor; ancestor = ancestor.parentElement) nodes.unshift(ancestor);
          let background = [255, 255, 255];
          for (const ancestor of nodes) {
            const rgb = color(getComputedStyle(ancestor).backgroundColor);
            const alpha = rgb[3] ?? 1;
            background = background.map((value, index) => rgb[index] * alpha + value * (1 - alpha));
          }
          const values = [luminance(color(getComputedStyle(node).outlineColor)), luminance(background)].sort((a, b) => b - a);
          return (values[0] + 0.05) / (values[1] + 0.05);
        })).toBeGreaterThanOrEqual(3);
        await page.keyboard.press("Tab");
        if (role === "PATIENT") {
          const assistant = page.getByRole("button", { name: "Trợ lý AI", exact: true });
          await expect(assistant).toBeFocused();
          await expect(assistant).toHaveAttribute("aria-haspopup", "dialog");
          await page.keyboard.press("Tab");
        }
        await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeFocused();
      });
    }
  });
}

test("admin navigation collapses into a toggleable band below the desktop breakpoint", async ({ context, page }) => {
  await context.route("**/api/v1/**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
  }));
  await installMockBrowserSession(context, browserSessionFixture(
    "ADMIN",
    "route-matrix-admin",
    "Route Matrix ADMIN",
  ));

  const navigation = page.getByRole("navigation", { name: "Điều hướng quản trị" });
  const openToggle = page.getByRole("button", { name: "Mở menu quản trị" });

  for (const width of [320, 375, 768]) {
    await test.step(`${width}px mobile`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin", { waitUntil: "domcontentloaded" });

      await expect(openToggle).toBeVisible();
      await expect(navigation).toBeHidden();
      const main = await page.getByRole("main").boundingBox();
      expect(main!.y).toBeLessThanOrEqual(220);
      await expect.poll(
        () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(1);

      await openToggle.click();
      await expect(page.getByRole("button", { name: "Đóng menu quản trị" })).toBeVisible();
      await expect(navigation).toBeVisible();
      const navLinks = navigation.getByRole("link");
      await expect(navLinks).toHaveCount(16);
      for (const link of await navLinks.all()) {
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeInViewport();
        await expect(link).toHaveCSS("min-height", "44px");
      }
      await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(navigation).toBeHidden();
      await expect(openToggle).toBeFocused();

      await openToggle.click();
      await expect(navigation).toBeVisible();
      await navigation.getByRole("link", { name: "Thanh toán" }).click();
      await expect(page).toHaveURL(/\/admin\/payments/);
      await expect(navigation).toBeHidden();
    });
  }

  for (const width of [1024, 1440]) {
    await test.step(`${width}px desktop`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await expect(openToggle).toBeHidden();
      await expect(navigation).toBeVisible();
      await expect.poll(
        () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(1);

      const navLinks = navigation.getByRole("link");
      await expect(navLinks).toHaveCount(16);
      for (const link of await navLinks.all()) {
        // At >=1024px the admin sidebar is a fixed h-screen column; with the
        // full 15-destination nav the tail links live below the fold and are
        // reached by scrolling the sidebar (07B will shrink the list). The
        // viewport assertion stays for the wrapped mobile bands.
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeInViewport();
        await expect(link).toHaveCSS("min-height", "44px");
        await link.focus();
        await expect(link).toBeFocused();
      }
    });
  }
});

test("admin focused workspaces hide the sidebar until the outside toggle opens it", async ({ context, page }) => {
  await context.route("**/api/v1/**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
  }));
  await installMockBrowserSession(context, browserSessionFixture(
    "ADMIN",
    "route-matrix-focused",
    "Route Matrix Focused",
  ));

  const navigation = page.getByRole("navigation", { name: "Điều hướng quản trị" });
  const workspaceToggle = page.getByRole("button", { name: "Mở điều hướng quản trị" });

  for (const width of [375, 1440]) {
    for (const path of ["/admin/content", "/admin/users"]) {
      await test.step(`${path} at ${width}px`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path, { waitUntil: "domcontentloaded" });

        await expect(navigation).toBeHidden();
        await expect(workspaceToggle).toBeVisible();
        await expect(workspaceToggle).toHaveAttribute("aria-expanded", "false");

        await workspaceToggle.click();
        await expect(navigation).toBeVisible();
        await expect(page.getByRole("button", { name: "Thu gọn điều hướng" })).toHaveAttribute("aria-expanded", "true");
        await expect(page.getByRole("button", { name: "Đóng menu quản trị" })).toBeHidden();
        await expect(navigation.getByRole("link")).toHaveCount(16);

        await page.keyboard.press("Escape");
        await expect(navigation).toBeHidden();
        await expect(workspaceToggle).toBeFocused();

        await workspaceToggle.click();
        await expect(navigation).toBeVisible();
        await navigation.getByRole("link", { name: "Tổng quan" }).click();
        await expect(page).toHaveURL(/\/admin$/);
        if (width < 1024) {
          await expect(navigation).toBeHidden();
        } else {
          await expect(navigation).toBeVisible();
        }
      });
    }
  }
});
