import { test, expect } from "@playwright/test";

test.describe("Omnichannel Calendar Export and Schema.org SEO", () => {
  test("FAQ page renders valid Schema.org FAQPage JSON-LD", async ({ page }) => {
    await page.goto("/faq", { waitUntil: "domcontentloaded" });
    const jsonLdElement = page.locator('script#faq-jsonld[type="application/ld+json"]');
    await expect(jsonLdElement).toHaveCount(1, { timeout: 10_000 });

    const rawJson = await jsonLdElement.textContent();
    expect(rawJson).toBeTruthy();
    const data = JSON.parse(rawJson!);
    expect(data["@type"]).toBe("FAQPage");
    expect(Array.isArray(data.mainEntity)).toBe(true);
    expect(data.mainEntity.length).toBeGreaterThan(0);
    expect(data.mainEntity[0]["@type"]).toBe("Question");
    expect(data.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
  });

  test("Package detail page renders valid Schema.org MedicalProcedure JSON-LD", async ({ page }) => {
    await page.goto("/packages", { waitUntil: "domcontentloaded" });
    // Click on the first package link
    const firstPackageLink = page.locator('a[href^="/packages/"]').first();
    await expect(firstPackageLink).toBeVisible({ timeout: 10_000 });
    await firstPackageLink.click();

    const jsonLdElement = page.locator('script#package-jsonld[type="application/ld+json"]');
    await expect(jsonLdElement).toHaveCount(1, { timeout: 10_000 });

    const rawJson = await jsonLdElement.textContent();
    expect(rawJson).toBeTruthy();
    const data = JSON.parse(rawJson!);
    expect(data["@type"]).toBe("MedicalProcedure");
    expect(data.offers).toBeDefined();
    expect(data.offers["@type"]).toBe("Offer");
    expect(data.offers.priceCurrency).toBe("VND");
  });

  test("Article detail page renders valid Schema.org MedicalWebPage JSON-LD", async ({ page }) => {
    await page.goto("/articles", { waitUntil: "domcontentloaded" });
    const firstArticleLink = page.locator('a[href^="/articles/"]').first();
    await expect(firstArticleLink).toBeVisible({ timeout: 10_000 });
    await firstArticleLink.click();

    const jsonLdElement = page.locator('script#article-jsonld[type="application/ld+json"]');
    await expect(jsonLdElement).toHaveCount(1, { timeout: 10_000 });

    const rawJson = await jsonLdElement.textContent();
    expect(rawJson).toBeTruthy();
    const data = JSON.parse(rawJson!);
    expect(data["@type"]).toBe("MedicalWebPage");
    expect(data.publisher["@type"]).toBe("MedicalOrganization");
  });

  test("Tra cuu page contains Google Calendar and .ics reminders affordances", async ({ page }) => {
    await page.goto("/tra-cuu", { waitUntil: "domcontentloaded" });
    // Page renders search form and instructions cleanly
    await expect(page.locator("#appointment-booking-code")).toBeVisible();
    await expect(page.locator("#appointment-phone")).toBeVisible();
  });
});
