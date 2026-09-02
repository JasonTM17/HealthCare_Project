import { expect, test } from "@playwright/test";

test("auth recovery link stays clear of the floating assistant at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Đăng nhập tài khoản" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Quên mật khẩu?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mở trợ lý sức khỏe" })).toBeHidden();

  const layout = await page.evaluate(() => {
    const forgot = document.querySelector<HTMLElement>('a[href="/auth/forgot-password"]');
    const assistant = document.querySelector<HTMLElement>('[data-testid="floating-health-assistant"]');
    if (!forgot) throw new Error("Expected auth recovery link");
    const forgotRect = forgot.getBoundingClientRect();
    return {
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      assistantPresent: Boolean(assistant),
      forgotVisibleWithinViewport:
        forgotRect.top >= 0
        && forgotRect.left >= 0
        && forgotRect.right <= window.innerWidth + 1,
    };
  });

  expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(layout.assistantPresent).toBe(false);
  expect(layout.forgotVisibleWithinViewport).toBe(true);
});
