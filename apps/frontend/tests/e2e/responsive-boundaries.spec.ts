import { expect, test } from "@playwright/test";

test.describe("public responsive boundaries", () => {
  test("resource heroes collapse to one readable column and defer the floating assistant on phones", async ({ page }) => {
    for (const width of [320, 375, 414]) {
      for (const route of ["/articles", "/tra-cuu"]) {
        await page.setViewportSize({ width, height: 812 });
        await page.goto(route, { waitUntil: "domcontentloaded" });
        const hero = page.locator(".resource-hero-card");
        await expect(hero).toBeVisible();

        const layout = await hero.evaluate((element) => {
          const body = element.querySelector<HTMLElement>(".resource-hero-card__body");
          if (!body) throw new Error("resource hero body is missing");
          const cardRect = element.getBoundingClientRect();
          const bodyRect = body.getBoundingClientRect();
          return {
            columns: window.getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/),
            cardWidth: cardRect.width,
            bodyWidth: bodyRect.width,
            bodyLeft: bodyRect.left,
            bodyRight: bodyRect.right,
            cardLeft: cardRect.left,
            cardRight: cardRect.right,
          };
        });

        expect(layout.columns, `${route} at ${width}px should use one mobile hero column`).toHaveLength(1);
        expect(layout.bodyWidth, `${route} at ${width}px should keep a readable content width`).toBeGreaterThan(layout.cardWidth * 0.8);
        expect(layout.bodyLeft, `${route} hero body should stay inside the card`).toBeGreaterThanOrEqual(layout.cardLeft - 1);
        expect(layout.bodyRight, `${route} hero body should stay inside the card`).toBeLessThanOrEqual(layout.cardRight + 1);
        await expect(page.getByRole("button", { name: "Hỏi trợ lý triệu chứng" })).toBeVisible();
        await expect(page.locator('[data-testid="floating-health-assistant"]')).toBeHidden();
      }
    }
  });

  test("phone controls keep the 44px interaction target", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#hero-search-input")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tìm kiếm", exact: true })).toBeVisible();

    const homeControls = await page.evaluate(() => {
      const rectOf = (selector: string): { width: number; height: number } => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing ${selector}`);
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      };
      return {
        navBooking: rectOf(".site-nav .button--nav"),
        searchInput: rectOf("#hero-search-input"),
        searchButton: rectOf(".hero-search button"),
      };
    });

    expect(homeControls.navBooking.width).toBeGreaterThanOrEqual(44);
    expect(homeControls.navBooking.height).toBeGreaterThanOrEqual(44);
    expect(homeControls.searchInput.height).toBeGreaterThanOrEqual(44);
    expect(homeControls.searchButton.height).toBeGreaterThanOrEqual(44);

    await page.goto("/benh-pho-bien", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#disease-search")).toBeVisible();
    await expect(page.locator("#disease-category")).toBeVisible();
    const filterControls = await page.evaluate(() => ["#disease-search", "#disease-category"].map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const rect = element.getBoundingClientRect();
      return { selector, width: rect.width, height: rect.height };
    }));
    for (const control of filterControls) {
      expect(control.width, `${control.selector} should fill its filter column`).toBeGreaterThan(200);
      expect(control.height, `${control.selector} should be a full-size mobile control`).toBeGreaterThanOrEqual(44);
    }
  });

  test("catalog hero summaries distinguish backend failure from real branch data", async ({ context, page }) => {
    let backendHealthy = false;
    await context.route("**/api/v1/hospital/branches*", async (route) => {
      if (!backendHealthy) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: [{
            id: "branch-central",
            slug: "co-so-trung-tam",
            name: "Cơ sở Trung tâm",
            address: "123 Đường Sức Khỏe, Hà Nội",
            phone: "024 1234 5678",
            emergencyHotline: null,
            workingHours: "07:00–17:00",
            amenities: ["Nhà thuốc"],
          }],
          totalElements: 1,
          totalPages: 1,
          size: 50,
          number: 0,
          first: true,
          last: true,
          empty: false,
        }),
      });
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/branches", { waitUntil: "domcontentloaded" });
    const summary = page.locator(".resource-hero-card .resource-meta-grid dd");
    await expect(summary).toHaveText(["Chưa tải được", "Chưa tải được"]);
    await expect(page.locator(".catalog-status--error")).toContainText("Tạm thời chưa thể tải thông tin cơ sở");

    backendHealthy = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(summary).toHaveText(["1", "Cơ sở Trung tâm"]);
    await expect(page.getByRole("heading", { name: "Cơ sở Trung tâm" }).last()).toBeVisible();
  });

  test("informational pages retain the floating assistant when no local action exists", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });

    for (const route of ["/about", "/careers"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "Mở trợ lý sức khỏe" })).toBeVisible();
    }
  });

  test("about page keeps the doctor team image in the hero and moves the intro video below", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/about", { waitUntil: "domcontentloaded" });

    const hero = page.locator('section[aria-labelledby="about-title"]');
    const story = page.locator('section[aria-labelledby="about-story-title"]');

    await expect(hero.getByRole("img", { name: "Đội ngũ bác sĩ và nhân viên y tế chuyên khoa Bệnh viện HealthCare" })).toBeVisible();
    await expect(hero.locator("video")).toHaveCount(0);
    const video = story.locator("video[aria-label='Thước phim minh họa hành trình tư vấn và chăm sóc người bệnh']");
    await expect(video).toBeVisible();
    await expect(video).not.toHaveAttribute("controls", /.*/);
    await expect(video).toHaveAttribute("autoplay", "");
    await expect(video).toHaveAttribute("disablepictureinpicture", "");

    const placement = await page.evaluate(() => {
      const heroElement = document.querySelector<HTMLElement>('section[aria-labelledby="about-title"]');
      const videoElement = document.querySelector<HTMLElement>('section[aria-labelledby="about-story-title"] video');
      if (!heroElement || !videoElement) throw new Error("Missing about hero or story video");
      return {
        heroBottom: heroElement.getBoundingClientRect().bottom,
        videoTop: videoElement.getBoundingClientRect().top,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    expect(placement.videoTop).toBeGreaterThan(placement.heroBottom);
    expect(placement.overflow).toBeLessThanOrEqual(1);
  });

  test("articles stays within a 320px viewport, including navigation and pagination", async ({ context, page }) => {
    await context.route("**/api/v1/hospital/articles*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: [{
            id: "responsive-article",
            title: "Chuẩn bị câu hỏi trước buổi khám",
            slug: "chuan-bi-cau-hoi",
            summary: "Một tóm tắt ngắn để người bệnh chuẩn bị tốt hơn.",
            publishedAt: "2026-08-31T08:00:00Z",
            active: true,
          }],
          totalElements: 13,
          totalPages: 2,
          size: 12,
          number: 0,
          first: true,
          last: false,
          empty: false,
        }),
      });
    });

    for (const width of [320, 375, 414]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/articles", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Kiến thức y khoa trong nhịp sống hằng ngày" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Phân trang cẩm nang" })).toBeVisible();

      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await expect.poll(() => page.evaluate(() => {
        const viewportRight = document.documentElement.clientWidth;
        return Math.max(...Array.from(document.querySelectorAll<HTMLElement>(".site-nav__inner *,.catalog-pagination *"), (element) => element.getBoundingClientRect().right), viewportRight) - viewportRight;
      })).toBeLessThanOrEqual(1);

      await page.getByRole("button", { name: "Mở menu" }).click();
      await expect(page.getByRole("dialog", { name: "Menu điều hướng" }).getByRole("link", { name: "Đăng nhập" })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.getByRole("button", { name: "Đóng menu" }).click();
    }
  });

  test("appointment lookup fields are label-associated and announce recoverable errors", async ({ context, page }) => {
    await context.route("**/api/v1/appointments/*", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: "APPOINTMENT_NOT_FOUND" }),
      });
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/tra-cuu", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Mã lịch hẹn khám")).toBeVisible();
    await expect(page.getByLabel("Số điện thoại đặt lịch")).toBeVisible();

    await page.getByLabel("Mã lịch hẹn khám").fill("APT-ACCESSIBILITY");
    await page.getByLabel("Số điện thoại đặt lịch").fill("0901234567");
    await page.getByRole("button", { name: "Tra cứu ngay" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Không tìm thấy lịch hẹn" })).toBeVisible();
  });

  test("auth entry routes stay within the narrowest mobile viewport", async ({ page }) => {
    for (const route of ["/auth/login", "/auth/register"]) {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".auth-page").getByRole("heading").first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await expect.poll(() => page.evaluate(() => {
        const viewportRight = document.documentElement.clientWidth;
        return Math.max(...Array.from(document.querySelectorAll<HTMLElement>(".auth-page *"), (element) => element.getBoundingClientRect().right), viewportRight) - viewportRight;
      })).toBeLessThanOrEqual(1);
    }
  });
});
