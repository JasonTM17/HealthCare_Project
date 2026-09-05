import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { browserSessionFixture, installMockBrowserSession } from "./helpers/browser-session";

test.describe.configure({ timeout: 60_000 });

const ROUNDED_SURFACE_SELECTOR = [
  ".site-shell [class*='rounded-']",
  ".admin-shell [class*='rounded-']",
  ".portal-shell [class*='rounded-']",
  ".site-shell [class*='videoFrame']",
  ".site-shell [class*='videoLabel']",
].join(", ");

async function unavailableApi(context: BrowserContext) {
  await context.route("**/api/v1/**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
  }));
}

async function flatRadiusViolations(page: Page) {
  return page.locator(ROUNDED_SURFACE_SELECTOR).evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return [];
    const style = getComputedStyle(element);
    const radii = [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ].map((value) => Number.parseFloat(value) || 0);
    const maxRadius = Math.max(...radii);
    const isIntentionalCircle = Math.abs(rect.width - rect.height) <= 1 && maxRadius >= Math.min(rect.width, rect.height) / 2 - 1;
    if (isIntentionalCircle || maxRadius <= 4.1) return [];
    return [{
      tag: element.tagName.toLowerCase(),
      className: element.getAttribute("class") ?? "",
      text: (element.textContent ?? "").trim().slice(0, 80),
      maxRadius,
    }];
  }));
}

test("about video label reads as a restrained clinical caption", async ({ context, page }) => {
  await unavailableApi(context);
  await installMockBrowserSession(context, null);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/about", { waitUntil: "domcontentloaded" });

  const label = page.getByText("Thước phim giới thiệu", { exact: true });
  await expect(label).toBeVisible();
  const style = await label.evaluate((node) => {
    const computed = getComputedStyle(node);
    const background = computed.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
    return {
      background,
      color: computed.color,
      radius: Number.parseFloat(computed.borderTopLeftRadius) || 0,
      shadow: computed.boxShadow,
    };
  });
  expect(style.background[0]).toBeGreaterThan(230);
  expect(style.background[1]).toBeGreaterThan(230);
  expect(style.background[2]).toBeGreaterThan(230);
  expect(style.radius).toBeLessThanOrEqual(4.1);
  expect(style.shadow).toBe("none");
  expect(await flatRadiusViolations(page)).toEqual([]);
});

for (const target of [
  { path: "/admin/ai-content-reviews", role: "ADMIN" as const, user: "Flat Admin" },
  { path: "/patient/dashboard", role: "PATIENT" as const, user: "Flat Patient" },
  { path: "/doctor/dashboard", role: "DOCTOR" as const, user: "Flat Doctor" },
]) {
  test(`${target.path} keeps admin/portal rounded surfaces within the flat contract`, async ({ context, page }) => {
    await unavailableApi(context);
    await installMockBrowserSession(context, browserSessionFixture(target.role, `flat-${target.role.toLowerCase()}`, target.user));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(target.path, { waitUntil: "domcontentloaded" });

    await expect(page.locator(target.role === "ADMIN" ? ".admin-shell" : ".portal-shell")).toBeVisible();
    expect(await flatRadiusViolations(page)).toEqual([]);
  });
}
