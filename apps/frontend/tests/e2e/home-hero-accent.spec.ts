import { expect, test } from "@playwright/test";
import { createNativeCmsLayout } from "../../lib/cms-page-layout";
import { resolveCmsPageIdentity } from "../../lib/cms-page-manifest";
import { installMockBrowserSession } from "./helpers/browser-session";

// Real hydrated components with mocked public CMS transport; production
// publication/persistence remains a separate verification boundary.
for (const source of ["hero", "layout"] as const) {
  for (const width of [375, 768, 1440]) {
    test(`published ${source} title preserves teal accents and exact copy at ${width}px`, async ({ context, page }, testInfo) => {
      const title = source === "hero" ? "Đồng hành cùng sức khỏe gia đình" : "Chăm sóc SỨC KHỎE cho gia đình bạn";
      const identity = resolveCmsPageIdentity("/")!;
      const layout = createNativeCmsLayout(identity);
      layout.fields["hero.title"] = { kind: "text", value: title };
      await context.route("**/api/v1/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === `/api/v1/cms/content/homepage.${source === "hero" ? "hero" : "layout"}`) {
          await route.fulfill({ json: { slotKey: `homepage.${source}`, componentType: source === "hero" ? "HERO" : "PAGE_LAYOUT", status: "PUBLISHED", version: 7, updatedAt: "2026-10-10T10:00:00Z", payload: source === "hero" ? { title } : layout } });
        } else if (path.includes("/cms/content/")) {
          await route.fulfill({ status: 404, json: { code: "CMS_NOT_FOUND" } });
        } else {
          await route.fulfill({ json: { content: [], totalElements: 0, totalPages: 0, pageNumber: 0, pageSize: 50 } });
        }
      });
      await installMockBrowserSession(context, null);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      if (source === "hero") {
        await expect(page.locator('.hero-copy[data-cms-managed="hero-copy"]')).toBeVisible();
      }
      const heading = page.locator("#hero-title");
      await expect(heading).toHaveText(title);
      const accents = heading.locator(".hero-teal-accent");
      await expect(accents).toHaveCount(2);
      expect(await accents.allTextContents()).toEqual(source === "hero" ? ["sức khỏe", "gia đình"] : ["SỨC KHỎE", "gia đình"]);
      expect(await heading.evaluate(el => getComputedStyle(el).color)).toBe("rgb(0, 51, 54)");
      for (const accent of await accents.all()) {
        expect(await accent.evaluate(el => getComputedStyle(el).color)).toBe("rgb(0, 118, 124)");
      }
      const bounds = await heading.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`hero-${source}-${width}.png`) });
    });
  }
}
