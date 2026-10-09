import { expect, test, type Route } from "@playwright/test";
import {
  browserSessionFixture,
  installMockBrowserSession,
} from "./helpers/browser-session";
import { fulfillBackendWarmup } from "./helpers/backend-warmup";
import { fulfillNotificationBell } from "./helpers/notification-bell";

test.describe.configure({ timeout: 60_000 });

async function fallbackOr503(route: Route, pathname: string): Promise<void> {
  if (pathname === "/api/v1/auth/browser-sessions/current") {
    await route.fallback();
    return;
  }
  await route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
  });
}

test("unauthenticated admin deep link preserves pathname, query and hash in the login redirect", async ({ context, page }) => {
  await installMockBrowserSession(context, null);
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    if (await fulfillNotificationBell(route)) return;
    await fallbackOr503(route, new URL(route.request().url()).pathname);
  });
  await page.goto("/admin/appointments?status=PENDING#queue");
  await expect(page.getByText("Cần đăng nhập để mở khu vực quản trị")).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute(
    "href",
    `/auth/login?next=${encodeURIComponent("/admin/appointments?status=PENDING#queue")}`,
  );
});

test("forbidden role hits the gate without protected fetches and switch-account keeps the requested target", async ({ context, page }) => {
  const adminApiRequests: string[] = [];
  await installMockBrowserSession(
    context,
    browserSessionFixture("PATIENT", "ui-recovery-patient", "UI Recovery Patient"),
  );
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    if (await fulfillNotificationBell(route)) return;
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/v1/admin/")) {
      adminApiRequests.push(`${request.method()} ${pathname}`);
    }
    if (request.method() === "DELETE" && pathname === "/api/v1/auth/browser-sessions/current") {
      await route.fulfill({ status: 204 });
      return;
    }
    await fallbackOr503(route, pathname);
  });
  await page.goto("/admin/users?status=DISABLED#accounts");
  await expect(page.getByText("Tài khoản không có quyền quản trị")).toBeVisible();
  expect(adminApiRequests).toEqual([]);

  await page.getByRole("button", { name: "Đổi tài khoản" }).click();
  await expect(page).toHaveURL(/\/auth\/login\?next=/);
  expect(decodeURIComponent(new URL(page.url()).searchParams.get("next") ?? ""))
    .toBe("/admin/users?status=DISABLED#accounts");
});

test("admin notification dialog stays inside a 320px viewport", async ({ context, page }) => {
  await installMockBrowserSession(
    context,
    browserSessionFixture("ADMIN", "ui-recovery-bell", "UI Recovery Bell"),
  );
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    if (await fulfillNotificationBell(route)) return;
    await fallbackOr503(route, new URL(route.request().url()).pathname);
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Thông báo hệ thống/ }).click();
  const dialog = page.getByRole("dialog", { name: "Thông báo hệ thống" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
});

test("cms edit toolbar is suppressed on portal/auth routes and present on public routes for ADMIN", async ({ context, page }) => {
  await installMockBrowserSession(
    context,
    browserSessionFixture("ADMIN", "ui-recovery-toolbar", "UI Recovery Toolbar"),
  );
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    if (await fulfillNotificationBell(route)) return;
    await fallbackOr503(route, new URL(route.request().url()).pathname);
  });
  const toolbar = page.getByTestId("cms-edit-toolbar");

  for (const path of ["/", "/doctors"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(toolbar).toBeVisible();
    const label = toolbar.locator("label");
    const box = await label.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  for (const path of ["/admin", "/admin/content", "/auth/login", "/doctor", "/patient"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(toolbar).toHaveCount(0);
  }
});

test("cms edit toolbar never renders for non-admin sessions or guests", async ({ context, page }) => {
  await installMockBrowserSession(
    context,
    browserSessionFixture("PATIENT", "ui-recovery-toolbar-pt", "UI Recovery PT"),
  );
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    if (await fulfillNotificationBell(route)) return;
    await fallbackOr503(route, new URL(route.request().url()).pathname);
  });
  const toolbar = page.getByTestId("cms-edit-toolbar");

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(toolbar).toHaveCount(0);

  await context.unrouteAll();
  await installMockBrowserSession(context, null);
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    if (await fulfillNotificationBell(route)) return;
    await fallbackOr503(route, new URL(route.request().url()).pathname);
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(toolbar).toHaveCount(0);
});

test("legacy renderer sidebar image recovers through the inline edit save flow", async ({ context, page }) => {
  const brokenUrl = "/media/qa-sidebar-broken.jpg";
  const sidebarRow = {
    slotKey: "homepage.sidebar",
    componentType: "IMAGE_CARD",
    payload: {
      title: "Thẻ ảnh kiểm thử",
      body: "Nội dung kiểm thử.",
      href: "/about",
      imageUrl: brokenUrl,
    },
    status: "PUBLISHED",
    version: 4,
    updatedAt: "2026-10-09T01:00:00Z",
  };
  await installMockBrowserSession(
    context,
    browserSessionFixture("ADMIN", "ui-recovery-legacy", "UI Recovery Legacy"),
  );
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    if (await fulfillNotificationBell(route)) return;
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (pathname === "/api/v1/cms/content/homepage.sidebar") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sidebarRow),
      });
      return;
    }
    if (pathname === "/api/v1/admin/cms/content/homepage.sidebar") {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(sidebarRow),
        });
        return;
      }
      if (request.method() === "PUT") {
        const body = JSON.parse(request.postData() ?? "{}") as { payload?: { imageUrl?: string }; status?: string };
        if (body.payload?.imageUrl) sidebarRow.payload.imageUrl = body.payload.imageUrl;
        sidebarRow.version += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(sidebarRow),
        });
        return;
      }
    }
    if (pathname.startsWith("/api/v1/cms/")) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: "NOT_FOUND" }),
      });
      return;
    }
    await fallbackOr503(route, pathname);
  });

  await page.goto("/", { waitUntil: "networkidle" });
  const wrapper = page.locator("[data-cms-backend-slot='homepage.sidebar']");
  await expect(wrapper).toBeVisible();
  const sidebarImage = wrapper.locator(".cms-renderer--image-card img, .cms-renderer img");
  const sidebarNote = wrapper.locator("[role='alert']");
  await wrapper.scrollIntoViewIfNeeded();
  await expect(sidebarNote).toBeVisible();
  await expect(sidebarImage).toBeHidden();

  await page.getByTestId("cms-edit-toolbar").locator("label").click();
  await wrapper.getByTestId("cms-inline-edit-open").click();
  const modal = page.getByTestId("cms-inline-edit-modal");
  await expect(modal).toBeVisible();
  const manual = modal.locator("#cms-inline-image-card-image-manual");
  await expect(manual).toHaveValue(brokenUrl);
  const modalFieldPreview = modal.locator("#cms-inline-image-card-image figure img");
  const modalUploadPreview = modal.locator("#cms-inline-image-card-image [class*='previewWrapper'] img");
  await manual.fill("/icon.svg");
  await expect(modalFieldPreview).toBeVisible();
  await expect(modalUploadPreview).toBeVisible();
  await modal.getByTestId("cms-inline-edit-save").click();
  await expect(modal).toHaveCount(0);
  await expect(sidebarImage).toBeVisible();
  await expect(sidebarNote).toBeHidden();
  await expect.poll(() => sidebarImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});
