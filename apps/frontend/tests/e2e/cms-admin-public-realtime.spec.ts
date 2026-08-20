import { expect, test, type BrowserContext, type Route } from "@playwright/test";

type CmsContent = {
  slotKey: string;
  componentType: "HERO";
  payload: {
    eyebrow: string;
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  };
  status: "PUBLISHED";
  version: number;
  updatedAt: string;
};

const AUTH_STORAGE_KEY = "healthcare.auth.session";
const SLOT_KEY = "homepage.hero";
const INITIAL_TITLE = "Trung tâm chăm sóc chủ động";
const UPDATED_TITLE = "Trung tâm chăm sóc realtime";
const UPDATED_BODY = "Nội dung hero này được admin xuất bản và đồng bộ sang tab người dùng.";

function pageEnvelope<T>(content: T[] = []) {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    size: 50,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

function cmsContent(version: number, title: string, body: string): CmsContent {
  return {
    slotKey: SLOT_KEY,
    componentType: "HERO",
    payload: {
      eyebrow: "HealthCare CMS",
      title,
      body,
      ctaLabel: "Đặt lịch khám",
      ctaHref: "/dat-lich",
    },
    status: "PUBLISHED",
    version,
    updatedAt: `2026-08-21T10:00:0${version}Z`,
  };
}

function historyEntry(content: CmsContent, eventId: number) {
  return {
    eventId,
    slotKey: content.slotKey,
    componentType: content.componentType,
    status: content.status,
    payload: content.payload,
    version: content.version,
    actorEmail: "admin@healthcare.local",
    changedAt: content.updatedAt,
    rollbackAvailable: false,
  };
}

function eventStream(content: CmsContent, eventId: number): string {
  const ready = {
    latestEventId: 1,
    replayLimit: 100,
    snapshotFallback: "GET /api/v1/cms/content/{slotKey}?afterEventId={eventId}",
  };
  const changed = {
    eventId,
    slotKey: content.slotKey,
    version: content.version,
    published: true,
    updatedAt: content.updatedAt,
  };
  return [
    "event: ready",
    `data: ${JSON.stringify(ready)}`,
    "",
    "event: cms-content-changed",
    `id: ${eventId}`,
    `data: ${JSON.stringify(changed)}`,
    "",
    "",
  ].join("\n");
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test("admin publish updates the public homepage hero through the live CMS feed", async ({ browser }) => {
  let publishedContent = cmsContent(1, INITIAL_TITLE, "Nội dung ban đầu từ backend CMS.");
  let publishRequested = false;
  let eventStreamRequests = 0;
  let publicReadAfterPublish = false;
  let releaseEventStream: (() => void) | undefined;
  const eventStreamReady = new Promise<void>((resolve) => {
    releaseEventStream = resolve;
  });
  const unexpectedApiRequests: string[] = [];

  const context = await browser.newContext();
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const apiPath = url.pathname.replace(/^\/api\/v1/, "");

    if (apiPath.startsWith("/hospital/")) {
      await fulfillJson(route, pageEnvelope());
      return;
    }

    if (method === "GET" && apiPath === `/cms/content/${SLOT_KEY}`) {
      if (url.searchParams.get("afterEventId") === "2") publicReadAfterPublish = true;
      await fulfillJson(route, publishedContent);
      return;
    }

    if (method === "GET" && (apiPath === "/cms/content/homepage.body" || apiPath === "/cms/content/homepage.sidebar")) {
      await fulfillJson(route, { message: "Slot chưa được xuất bản." }, 404);
      return;
    }

    if (method === "GET" && apiPath === "/cms/content/events") {
      eventStreamRequests += 1;
      await eventStreamReady;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: {
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
        body: eventStream(publishedContent, 2),
      });
      return;
    }

    if (apiPath.startsWith("/admin/cms/")) {
      expect(request.headers().authorization).toBe("Bearer e2e-admin-token");
    }

    if (method === "GET" && apiPath === "/admin/cms/content") {
      await fulfillJson(route, [publishedContent]);
      return;
    }

    if (method === "GET" && apiPath === `/admin/cms/content/${SLOT_KEY}`) {
      await fulfillJson(route, publishedContent);
      return;
    }

    if (method === "PUT" && apiPath === `/admin/cms/content/${SLOT_KEY}`) {
      const body = await request.postDataJSON() as {
        componentType?: unknown;
        payload?: { title?: unknown; body?: unknown };
        status?: unknown;
        expectedVersion?: unknown;
      };
      expect(body.componentType).toBe("HERO");
      expect(body.status).toBe("PUBLISHED");
      expect(body.expectedVersion).toBe(1);
      expect(body.payload?.title).toBe(UPDATED_TITLE);

      publishRequested = true;
      publishedContent = cmsContent(2, UPDATED_TITLE, String(body.payload?.body ?? UPDATED_BODY));
      releaseEventStream?.();
      await fulfillJson(route, publishedContent);
      return;
    }

    if (method === "GET" && apiPath === `/admin/cms/content/${SLOT_KEY}/history`) {
      await fulfillJson(route, [historyEntry(publishedContent, publishedContent.version)]);
      return;
    }

    unexpectedApiRequests.push(`${method} ${apiPath}`);
    await fulfillJson(route, { message: `Unhandled test API request: ${method} ${apiPath}` }, 500);
  });

  const publicPage = await context.newPage();
  await publicPage.goto("/");

  const heroSlot = publicPage.locator('[data-cms-live-slot="hero"]');
  await expect(heroSlot).toContainText(INITIAL_TITLE);
  await expect(heroSlot).toHaveAttribute("data-cms-version", "1");
  await expect.poll(() => eventStreamRequests).toBeGreaterThan(0);

  const adminPage = await context.newPage();
  await adminPage.addInitScript(({ key }) => {
    window.sessionStorage.setItem(key, JSON.stringify({
      accessToken: "e2e-admin-token",
      refreshToken: "e2e-refresh-token",
      tokenType: "Bearer",
      expiresIn: 3600,
      user: {
        id: "admin-1",
        email: "admin@healthcare.local",
        displayName: "E2E Admin",
        roles: ["ROLE_ADMIN"],
      },
    }));
  }, { key: AUTH_STORAGE_KEY });

  await adminPage.goto("/admin/content");
  await expect(adminPage.getByRole("heading", { name: "Chỉnh sửa một component theo slot" })).toBeVisible();
  await expect(adminPage.locator("#cms-payload-title")).toHaveValue(INITIAL_TITLE);

  await adminPage.locator("#cms-payload-title").fill(UPDATED_TITLE);
  await adminPage.locator("#cms-payload-body").fill(UPDATED_BODY);
  await adminPage.getByRole("button", { name: "Xuất bản" }).click();

  await expect(adminPage.getByText("Đã xuất bản homepage.hero, version 2.")).toBeVisible();
  await expect(heroSlot).toContainText(UPDATED_TITLE);
  await expect(heroSlot).toContainText(UPDATED_BODY);
  await expect(heroSlot).toHaveAttribute("data-cms-version", "2");
  await expect(heroSlot).not.toContainText(INITIAL_TITLE);

  expect(publishRequested).toBe(true);
  expect(publicReadAfterPublish).toBe(true);
  expect(unexpectedApiRequests).toEqual([]);

  await context.close();
});
