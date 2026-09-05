import { expect, test, type BrowserContext, type Locator } from "@playwright/test";
import type { Doctor } from "../../types/hospital";
import { installMockBrowserSession } from "./helpers/browser-session";

// Measure rendered colors, including transparent ancestors, rather than matching tokens.
async function contrast(locator: Locator, property: "color" | "outlineColor" = "color") {
  return locator.evaluate((element, foregroundProperty) => {
    const rgba = (value: string) => {
      const systemColors: Record<string, number[]> = {
        canvas: [255, 255, 255, 1],
        canvastext: [0, 0, 0, 1],
        linktext: [0, 0, 238, 1],
        highlight: [0, 95, 184, 1],
        highlighttext: [255, 255, 255, 1],
        buttonface: [255, 255, 255, 1],
        buttontext: [0, 0, 0, 1],
        transparent: [0, 0, 0, 0],
      };
      const normalized = value.trim().toLowerCase();
      const named = systemColors[normalized];
      if (named) return named;
      const channels = value.match(/[\d.]+/g)?.map(Number);
      if (!channels || channels.length < 3) return [0, 0, 0, 1];
      return [channels[0], channels[1], channels[2], channels[3] ?? 1];
    };
    const blend = (top: number[], bottom: number[]) => [
      ...top.slice(0, 3).map((value, index) => value * top[3] + bottom[index] * (1 - top[3])), 1,
    ];
    const ancestors: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
    let background = [255, 255, 255, 1];
    for (const node of ancestors) background = blend(rgba(getComputedStyle(node).backgroundColor), background);
    const foreground = blend(rgba(getComputedStyle(element)[foregroundProperty]), background);
    const luminance = (channels: number[]) => channels.slice(0, 3).reduce((sum, value, index) => {
      const normalized = value / 255;
      return sum + (normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
    }, 0);
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  }, property);
}

for (const width of [320, 375]) {
  for (const path of ["/doctors", "/specialties", "/services", "/packages"]) {
    test(`${path} has compact optional guidance at ${width}px`, async ({ context, page }, testInfo) => {
      await unavailableApi(context);
      await installMockBrowserSession(context, null);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const hero = page.locator(".resource-hero-card").first();
      await expect(hero).toBeVisible();
      expect((await hero.boundingBox())!.height).toBeLessThan(600);
      const guidance = page.locator("details.catalog-guidance");
      const summary = guidance.locator("summary");
      await expect(summary).toHaveText("Cách chọn phù hợp");
      expect(await guidance.evaluate((node) => (node as HTMLDetailsElement).open)).toBe(false);
      const panels = guidance.locator(".resource-panel");
      await expect(panels.first()).toBeHidden();
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(panels.first()).toBeVisible();
      expect(await panels.count()).toBeGreaterThanOrEqual(2);
      await page.keyboard.press("Space");
      await expect(panels.first()).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath("directory-mobile.png"), fullPage: true });
    });
  }
}

test("doctor summaries keep profile access and pagination remains touch safe", async ({ context, page }, testInfo) => {
  const bio = "Thông tin chuyên môn và quá trình công tác của bác sĩ. ".repeat(35);
  const doctor: Doctor = { id: "ui-doctor-0", slug: "ui-doctor-0", fullName: "Bác sĩ Kiểm thử", bio, active: true };
  const requestedPages: number[] = [];
  await context.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/hospital/doctors") {
      const number = Number(url.searchParams.get("page") ?? 0);
      requestedPages.push(number);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        content: [{ ...doctor, id: `ui-doctor-${number}`, slug: `ui-doctor-${number}` }],
        number, size: 12, totalElements: 13, totalPages: 2, first: number === 0, last: number === 1, empty: false,
      }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }) });
  });
  await installMockBrowserSession(context, null);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/doctors");
  const card = page.locator(".catalog-grid--doctors .catalog-card").first();
  await expect(card.getByRole("heading", { name: doctor.fullName })).toBeVisible();
  const summary = card.locator(".catalog-card__summary");
  await expect(summary).toHaveText(bio.trim());
  const geometry = await summary.evaluate((node) => ({
    height: node.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(node).lineHeight), fullHeight: node.scrollHeight,
  }));
  expect(geometry.height).toBeLessThanOrEqual(geometry.lineHeight * 3 + 1);
  expect(geometry.fullHeight).toBeGreaterThan(geometry.height);
  await expect(card.getByRole("link", { name: "Xem hồ sơ →" })).toHaveAttribute("href", "/doctors/ui-doctor-0");
  const pagination = page.getByRole("navigation", { name: "Phân trang bác sĩ" });
  for (const button of await pagination.getByRole("button").all()) {
    const bounds = await button.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
  }
  await expect(pagination.getByRole("button", { name: "← Trước" })).toBeDisabled();
  await pagination.getByRole("button", { name: "Sau →" }).click();
  await expect(pagination).toContainText("Trang 2 / 2");
  expect(requestedPages).toContain(1);
  await expect(pagination.getByRole("button", { name: "Sau →" })).toBeDisabled();
  await expect(card.getByRole("link", { name: "Xem hồ sơ →" })).toHaveAttribute("href", "/doctors/ui-doctor-1");
  await page.screenshot({ path: testInfo.outputPath("doctor-mobile.png"), fullPage: true });
});

for (const outcome of ["resolve", "reject"] as const) {
  test(`hotline reports clipboard ${outcome} only after the operation settles`, async ({ context, page }) => {
    await context.route("**/api/v1/**", async (route) => {
      if (new URL(route.request().url()).pathname === "/api/v1/hospital/branches") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          content: [{ id: "ui-branch", name: "Cơ sở kiểm thử", slug: "ui-branch", address: "Địa chỉ kiểm thử", phone: "1900 1234", active: true }],
          totalElements: 1, totalPages: 1, size: 20, number: 0, first: true, last: true, empty: false,
        }) });
      } else await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }) });
    });
    await installMockBrowserSession(context, null);
    await page.addInitScript(() => {
      const state = window as unknown as { settleClipboard: (success: boolean) => void; copiedText: string };
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: (value: string) => new Promise<void>((resolve, reject) => {
          state.copiedText = value;
          state.settleClipboard = (success) => success ? resolve() : reject(new Error("Permission denied"));
        }),
      } });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/doctors");
    const hotline = page.locator("a.utility-hotline[href^='tel:']");
    await expect(hotline).toBeVisible();
    await hotline.click();
    await expect(hotline).not.toContainText("Đã sao chép số:");
    expect(await page.evaluate(() => (window as unknown as { copiedText: string }).copiedText)).toBe("19001234");
    await page.evaluate((success) => (window as unknown as { settleClipboard: (ok: boolean) => void }).settleClipboard(success), outcome === "resolve");
    await expect(hotline).toContainText(outcome === "resolve" ? "Đã sao chép số:" : "Chưa sao chép được số:");
    if (outcome === "reject") await expect(hotline).not.toContainText("Đã sao chép số:");
  });
}

async function unavailableApi(context: BrowserContext) {
  await context.route("**/api/v1/**", (route) => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
  }));
}

test("footer keyboard focus contrasts with its dark surface and survives forced colors", async ({ context, page }) => {
  await unavailableApi(context);
  await installMockBrowserSession(context, null);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/doctors");
  const footer = page.locator("footer.site-footer");
  const brand = footer.getByRole("link", { name: "HealthCare, về trang chủ", exact: true });
  const about = footer.getByRole("navigation", { name: "Khám phá HealthCare", exact: true }).locator('a[href="/about"]');
  for (const forcedColors of ["none", "active"] as const) {
    await page.emulateMedia({ forcedColors });
    await brand.focus();
    await about.focus();
    await expect(about).toBeFocused();
    const outline = await about.evaluate((node) => ({
      width: parseFloat(getComputedStyle(node).outlineWidth), style: getComputedStyle(node).outlineStyle,
    }));
    expect(outline.width).toBeGreaterThanOrEqual(2);
    expect(outline.style).not.toBe("none");
    expect(await contrast(about, "outlineColor"), `footer outline contrast (${forcedColors})`).toBeGreaterThanOrEqual(3);
  }
});

for (const width of [320, 1440]) {
  test(`login readable contrast and password target at ${width}px`, async ({ context, page }) => {
    await unavailableApi(context);
    await installMockBrowserSession(context, null);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: "Đăng nhập tài khoản", exact: true })).toBeVisible();
    expect.soft(await contrast(page.getByRole("button", { name: "Đăng nhập", exact: true })), "submit contrast").toBeGreaterThanOrEqual(4.5);
    expect.soft(await contrast(page.getByRole("link", { name: "Quên mật khẩu?", exact: true })), "recovery contrast").toBeGreaterThanOrEqual(4.5);
    const password = page.getByLabel("Mật khẩu", { exact: true });
    await password.fill("Visibility-check-2026");
    const toggle = page.getByRole("button", { name: "Hiện mật khẩu", exact: true });
    const bounds = await toggle.boundingBox();
    expect.soft(bounds!.width, "password target width").toBeGreaterThanOrEqual(44);
    expect.soft(bounds!.height, "password target height").toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("Visibility-check-2026");
    await page.getByRole("button", { name: "Ẩn mật khẩu", exact: true }).click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue("Visibility-check-2026");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
