import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";
import { browserSessionFixture, installMockBrowserSession, patientOverviewFixture } from "./helpers/browser-session";
import { fulfillBackendWarmup } from "./helpers/backend-warmup";

const notices = [1, 2].map((index) => ({
  id: `notification-recovery-${index}`,
  eventType: "APPOINTMENT_REMINDER",
  title: `Nhắc lịch kiểm thử ${index}`,
  message: "Kiểm tra lịch hẹn tại cổng thông tin.",
  read: false,
  createdAt: "2026-10-01T02:00:00Z",
}));

async function feed(route: Route, content = notices) {
  expect(route.request().headers().authorization).toBeUndefined();
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ content, totalElements: content.length, totalPages: 1, number: 0, size: 50, first: true, last: true }),
  });
}

async function installPortal(context: BrowserContext, role: "PATIENT" | "DOCTOR") {
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    await route.fulfill({ status: 503, contentType: "application/json", body: '{"code":"SERVICE_UNAVAILABLE"}' });
  });
  await installMockBrowserSession(context, browserSessionFixture(role, `notification-${role}`, "Người dùng kiểm thử"));
  await context.route("**/api/v1/patient/overview", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(patientOverviewFixture({ unreadNotificationCount: 2 })),
  }));
}

async function openPortal(page: Page, role: "PATIENT" | "DOCTOR") {
  // This page has no notification list of its own: assertions target only the shell preview.
  await page.goto(`/${role.toLowerCase()}/profile`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: /Thông báo từ bệnh viện/ })).toBeVisible();
}

for (const role of ["PATIENT", "DOCTOR"] as const) {
  test(`${role} preview distinguishes an in-flight read from an empty inbox`, async ({ context, page }) => {
    await installPortal(context, role);
    let release!: () => void;
    const responseReady = new Promise<void>((resolve) => { release = resolve; });
    await context.route("**/api/v1/notifications?**", async (route) => {
      await responseReady;
      await feed(route, []);
    });
    await openPortal(page, role);
    await page.getByRole("link", { name: /Thông báo từ bệnh viện/ }).click();
    const preview = page.getByRole("dialog", { name: /Xem trước thông báo bệnh viện/ });
    try {
      await expect(preview.getByRole("status")).toHaveText("Đang tải thông báo…");
      await expect(preview.getByText("Chưa có thông báo mới")).toHaveCount(0);
    } finally { release(); }
    await expect(preview.getByText("Chưa có thông báo mới")).toBeVisible();
  });

  test(`${role} preview reports failed reads and can retry`, async ({ context, page }) => {
    await installPortal(context, role);
    let fail = true;
    let reads = 0;
    await context.route("**/api/v1/notifications?**", async (route) => {
      reads += 1;
      if (fail) {
        await route.fulfill({ status: 503, contentType: "application/json", body: '{"code":"SERVICE_UNAVAILABLE"}' });
      } else { await feed(route); }
    });
    await openPortal(page, role);
    await page.getByRole("link", { name: /Thông báo từ bệnh viện/ }).click();
    const preview = page.getByRole("dialog", { name: /Xem trước thông báo bệnh viện/ });
    await expect(preview.getByRole("alert")).toContainText("Chưa tải được thông báo");
    await expect(preview.getByText("Chưa có thông báo mới")).toHaveCount(0);
    const beforeRetry = reads;
    fail = false;
    await preview.getByRole("button", { name: "Tải lại thông báo", exact: true }).click();
    await expect(preview.getByText(notices[0].title)).toBeVisible();
    expect(reads).toBeGreaterThan(beforeRetry);
    await expect(preview.getByRole("alert")).toHaveCount(0);
  });

  test(`${role} failed mark-all keeps unread notices and explains recovery`, async ({ context, page }) => {
    await installPortal(context, role);
    let mutations = 0;
    await context.route("**/api/v1/notifications?**", (route) => feed(route));
    await context.route("**/api/v1/notifications/read-all", async (route) => {
      mutations += 1;
      expect(route.request().method()).toBe("PATCH");
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"code":"SERVICE_UNAVAILABLE"}' });
    });
    await openPortal(page, role);
    await page.getByRole("link", { name: /Thông báo từ bệnh viện/ }).click();
    const preview = page.getByRole("dialog", { name: /Xem trước thông báo bệnh viện/ });
    await expect(preview.getByText(notices[0].title)).toBeVisible();
    await preview.getByRole("button", { name: "Đánh dấu đã đọc tất cả", exact: true }).click();
    await expect(preview.getByRole("alert")).toContainText("Chưa đánh dấu được thông báo");
    await expect(page.getByRole("link", { name: "Thông báo từ bệnh viện (2 tin mới)", exact: true })).toBeVisible();
    await expect(preview.locator(".portal-notification-popover__item--unread")).toHaveCount(2);
    expect(mutations).toBe(1);
  });
}

test("mark-all is busy while the server decides the outcome", async ({ context, page }) => {
  await installPortal(context, "PATIENT");
  let release!: () => void;
  let mutations = 0;
  const responseReady = new Promise<void>((resolve) => { release = resolve; });
  await context.route("**/api/v1/notifications?**", (route) => feed(route));
  await context.route("**/api/v1/notifications/read-all", async (route) => {
    mutations += 1;
    await responseReady;
    await route.fulfill({ status: 503, contentType: "application/json", body: '{"code":"SERVICE_UNAVAILABLE"}' });
  });
  await openPortal(page, "PATIENT");
  await page.getByRole("link", { name: /Thông báo từ bệnh viện/ }).click();
  const preview = page.getByRole("dialog", { name: /Xem trước thông báo bệnh viện/ });
  const markAll = preview.getByRole("button", { name: /Đánh dấu đã đọc tất cả|Đang đánh dấu/ });
  await markAll.click();
  try {
    await expect(markAll).toBeDisabled();
    await page.keyboard.press("Enter");
    expect(mutations).toBe(1);
  } finally { release(); }
});

test("failed individual read retries once and preserves the remaining unread count", async ({ context, page }) => {
  await installPortal(context, "PATIENT");
  let release!: () => void;
  let reads = 0;
  let completed = false;
  const responseReady = new Promise<void>((resolve) => { release = resolve; });
  await context.route("**/api/v1/patient/overview", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(patientOverviewFixture({ unreadNotificationCount: completed ? 1 : 2 })),
  }));
  await context.route("**/api/v1/notifications?**", (route) => feed(route, notices.map((notice, index) => ({
    ...notice, read: completed && index === 0,
  }))));
  await context.route(`**/api/v1/notifications/${notices[0].id}/read`, async (route) => {
    expect(route.request().method()).toBe("PUT");
    reads += 1;
    if (reads === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"code":"SERVICE_UNAVAILABLE"}' });
    } else {
      await responseReady;
      completed = true;
      await route.fulfill({ status: 204 });
    }
  });
  await openPortal(page, "PATIENT");
  await page.getByRole("link", { name: /Thông báo từ bệnh viện/ }).click();
  await page.getByRole("dialog", { name: /Xem trước thông báo bệnh viện/ }).getByText(notices[0].title).click();
  const detail = page.getByRole("dialog", { name: notices[0].title, exact: true });
  await expect(detail.getByRole("alert")).toContainText("Chưa đánh dấu được thông báo");
  await expect(page.getByRole("link", { name: "Thông báo từ bệnh viện (2 tin mới)", exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Đánh dấu đã đọc", exact: true }).click();
  try {
    await expect(detail.getByRole("button", { name: "Đang đánh dấu…", exact: true })).toBeDisabled();
    await page.keyboard.press("Enter");
    expect(reads).toBe(2);
  } finally { release(); }
  await expect(page.getByRole("link", { name: "Thông báo từ bệnh viện (1 tin mới)", exact: true })).toBeVisible();
  await expect(detail.getByRole("alert")).toHaveCount(0);
});
