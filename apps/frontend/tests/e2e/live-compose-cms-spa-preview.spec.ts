import { expect, test } from "@playwright/test";

// Real BFF/local backend only. No routes, response substitution or persisted mutations.
for (const entry of ["/admin", "/admin/users"]) {
  test(`CMS preview survives client navigation from ${entry}`, async ({ page }) => {
    const origin = process.env.PLAYWRIGHT_BASE_URL ?? "";
    expect(origin).toBe("http://localhost:3290");
    expect(process.env.PLAYWRIGHT_CMS_ISOLATED).toBe("1");
    expect(process.env.PLAYWRIGHT_CMS_DISPOSABLE_DATABASE).toMatch(/^healthcare_cms_account_[a-z0-9_]+$/);
    const email = process.env.PLAYWRIGHT_CMS_ADMIN_EMAIL;
    const password = process.env.PLAYWRIGHT_CMS_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("Owned local ADMIN credentials unavailable");
    await page.goto(`${origin}/auth/login`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    const entryDocument = await page.goto(`${origin}${entry}`);
    expect(entryDocument?.headers()["content-security-policy"]).toContain("frame-src 'self'");
    expect(entryDocument?.headers()["x-frame-options"]).toBe("DENY");
    await expect(page.getByRole("navigation", { name: "Điều hướng quản trị" }).or(page.getByRole("button", { name: "Mở điều hướng quản trị" }))).toBeVisible();
    const open = page.getByRole("button", { name: "Mở điều hướng quản trị", exact: true });
    if (await open.isVisible()) await open.click();
    let documentNavigations = 0;
    page.on("request", (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentNavigations++; });
    await page.getByRole("link", { name: "Nội dung website", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/content$/);
    await expect(page.getByTestId("cms-preview-frame")).toBeVisible();
    await expect(page.frameLocator('[data-testid="cms-preview-frame"]').locator("[data-cms-native-field]").first()).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Chọn văn bản hoặc ảnh trong trang để chỉnh sửa." })).toBeVisible();
    expect(documentNavigations, "CMS Link must preserve the entry document and its CSP").toBe(0);
    for (const path of ["/auth/login", "/patient", "/admin"]) {
      const denied = await page.request.get(`${origin}${path}?cmsPreview=1`);
      expect(denied.headers()["x-frame-options"]).toBe("DENY");
      expect(denied.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    }
    if (entry === "/admin") {
      for (const path of ["/auth/login", "/admin/users"]) {
        const blocked = page.waitForEvent("console", {
          predicate: (message) => message.type() === "error" && /frame-ancestors 'none'/.test(message.text()),
        });
        await page.evaluate((src) => {
          const frame = document.createElement("iframe");
          frame.dataset.testPrivateFrame = "true";
          frame.src = src;
          document.body.append(frame);
        }, `${origin}${path}?cmsPreview=1`);
        await blocked;
        await page.evaluate(() => document.querySelector('[data-test-private-frame="true"]')?.remove());
      }
      await page.reload();
      await expect(page.frameLocator('[data-testid="cms-preview-frame"]').locator("[data-cms-native-field]").first()).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Chọn văn bản hoặc ảnh trong trang để chỉnh sửa." })).toBeVisible();
    }
  });
}
