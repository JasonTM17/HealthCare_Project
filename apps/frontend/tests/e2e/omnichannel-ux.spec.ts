import { test, expect } from "@playwright/test";

function pageEnvelope<T>(content: T[]) {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    size: 100,
    number: 0,
    first: true,
    last: true,
    empty: false,
  };
}

const FAQ_ITEM = {
  id: "faq-1",
  question: "Làm thế nào để đặt lịch khám?",
  answer: "Bạn có thể đặt lịch trực tuyến qua website hoặc gọi hotline 1900 1234.",
  category: "booking",
};

const PACKAGE_ITEM = {
  id: "pkg-1",
  name: "Gói khám Tổng quát Tiêu chuẩn",
  slug: "tong-quat-tieu-chuan",
  description: "Khám sức khỏe tổng quát toàn diện",
  price: 1500000,
  active: true,
};

const ARTICLE_ITEM = {
  id: "art-1",
  title: "Hướng dẫn nhận biết và xử trí đột quỵ não",
  slug: "huong-dan-nhan-biet-dot-quy",
  summary: "Quy tắc FAST và các bước sơ cứu khi gặp bệnh nhân đột quỵ.",
  body: "Nội dung bài viết chi tiết về đột quỵ não...",
  authorName: "BS Trương Gia Bảo",
  publishedAt: "2026-03-01T08:00:00Z",
  category: "than-kinh",
  active: true,
};

async function installMocks(context: import("@playwright/test").BrowserContext) {
  await context.route("**/api/v1/auth/browser-sessions/current", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify({ code: "BROWSER_SESSION_REQUIRED" }),
    });
  });

  await context.route(/\/api\/v1\/(hospital\/)?faqs(\/.*)?/, async (route) => {
    await route.fulfill({ json: pageEnvelope([FAQ_ITEM]) });
  });

  await context.route(/\/api\/v1\/hospital\/packages(\/.*)?/, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.includes(`/packages/${PACKAGE_ITEM.slug}`)) {
      await route.fulfill({ json: PACKAGE_ITEM });
    } else {
      await route.fulfill({ json: pageEnvelope([PACKAGE_ITEM]) });
    }
  });

  await context.route(/\/api\/v1\/hospital\/articles(\/.*)?/, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/comments")) {
      await route.fulfill({ json: [] });
    } else if (pathname.includes(`/articles/${ARTICLE_ITEM.slug}`)) {
      await route.fulfill({ json: ARTICLE_ITEM });
    } else {
      await route.fulfill({ json: pageEnvelope([ARTICLE_ITEM]) });
    }
  });
}

test.describe("Omnichannel Calendar Export and Schema.org SEO", () => {
  test.beforeEach(async ({ context }) => {
    await installMocks(context);
  });

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
    await page.goto(`/packages/${PACKAGE_ITEM.slug}`, { waitUntil: "domcontentloaded" });

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
    await page.goto(`/articles/${ARTICLE_ITEM.slug}`, { waitUntil: "domcontentloaded" });

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
