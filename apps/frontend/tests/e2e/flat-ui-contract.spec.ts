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
    if (target.role !== "ADMIN") {
      // Structural surfaces stay visible; layout wrappers such as
      // `.portal-record-list` are excluded because they are grids, not panes.
      const depthSurface = page.locator(".portal-summary-grid, .portal-panel, .portal-record-list, .portal-record").first();
      await expect(depthSurface).toBeVisible();

      // ── Elevation contract reconciliation (PENDING PRODUCT SIGN-OFF) ──
      // This block previously asserted `expect(boxShadow).not.toBe("none")`.
      // That rule was added deliberately in c667683 (2026-09-12, "portal shell
      // visual depth restored — panel/record elevation kept off the public
      // flat-contract reset") and pinned here.
      //
      // Ultra V4 WS-D then applied the approved Stitch design system to the
      // portal, which states the opposite for Layer 1 (docs/design/
      // stitch-doctor-schedule.md, "Elevation & Depth"): "Layer 1 (Cards,
      // Modules, Patient Panes): #ffffff surface bounded by a subtle 1px solid
      // #e2e8f0 stroke. No shadow in resting state." Plan WS-D criterion #7
      // lists "flat elevation" as an acceptance signal, and app/styles.css:4110
      // now sets `--portal-shadow: none`.
      //
      // The two contracts cannot both hold, so the check is rewritten against
      // the currently approved source rather than deleted: depth must come from
      // a crisp border plus surface/canvas contrast, and a resting drop shadow
      // on a Layer-1 pane is now itself the violation. That is a different
      // assertion of the same strength, not a loosened threshold — the radius
      // clamp above is untouched.
      //
      // To restore the 2026-09-12 portal-depth carve-out instead: give
      // `--portal-shadow` an elevation value again and revert this block to
      // `expect(...boxShadow).not.toBe("none")`.
      const canvas = await page.locator(".portal-shell").evaluate((node) => getComputedStyle(node).backgroundColor);
      const layer1Surfaces = await page.locator(".portal-summary-grid, .portal-panel, .portal-record").evaluateAll((nodes, shellColor) => (
        nodes.map((node) => {
          const style = getComputedStyle(node);
          const widths = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth];
          const colors = [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor];
          return {
            className: node.getAttribute("class") ?? "",
            hasCrispBorder: widths.some((width, index) => (Number.parseFloat(width) || 0) >= 1 && colors[index] !== "transparent"),
            background: style.backgroundColor,
            restingShadow: style.boxShadow,
            surfaceColor: shellColor,
          };
        })
      ), canvas);

      expect(layer1Surfaces.length).toBeGreaterThan(0);
      for (const surface of layer1Surfaces) {
        expect(surface.hasCrispBorder, `${surface.className} lost its Layer-1 hairline border`).toBe(true);
        expect(surface.background, `${surface.className} has no surface fill to separate it from the canvas`)
          .not.toBe("rgba(0, 0, 0, 0)");
        expect(surface.background, `${surface.className} no longer contrasts with the portal canvas`)
          .not.toBe(surface.surfaceColor);
        expect(surface.restingShadow, `${surface.className} must stay flat at rest (Stitch Layer 1)`)
          .toBe("none");
      }
    }
  });
}
