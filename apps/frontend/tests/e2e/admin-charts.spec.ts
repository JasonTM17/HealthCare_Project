import { expect, test, type BrowserContext } from "@playwright/test";
import { browserSessionFixture, installMockBrowserSession } from "./helpers/browser-session";
import { fulfillBackendWarmup } from "./helpers/backend-warmup";
import { fulfillNotificationBell } from "./helpers/notification-bell";

test.use({ timezoneId: "Asia/Ho_Chi_Minh" });

const upcoming = [1, 3, 2, 2, 3, 5, 3].flatMap((count, day) => Array(count).fill(`2026-10-${11 + day}`) as string[]);
const appointments = Array.from({ length: 100 }, (_, index) => ({
  id: `chart-appointment-${index}`, status: index < 62 ? "CONFIRMED" : index < 83 ? "COMPLETED" : "CANCELLED",
  appointmentDate: upcoming[index] ?? "2026-09-01",
}));

async function chartApi(context: BrowserContext, options: { empty?: boolean; fail?: boolean; hold?: Promise<void> } = {}) {
  await installMockBrowserSession(context, browserSessionFixture("ADMIN", "chart-admin", "Quản trị biểu đồ"));
  let chartRequests = 0;
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    if (await fulfillNotificationBell(route)) return;
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/auth/browser-sessions/current") return route.fallback();
    if (url.pathname === "/api/v1/admin/appointments" && url.searchParams.get("size") === "100") {
      chartRequests++;
      if (options.hold) await options.hold;
      if (options.fail && chartRequests === 1) return route.fulfill({ status: 503, json: { code: "SERVICE_UNAVAILABLE" } });
      return route.fulfill({ json: { content: options.empty ? [] : appointments, totalElements: options.empty ? 0 : 346,
        totalPages: options.empty ? 0 : 4, size: 100, number: 0 } });
    }
    await route.fulfill({ json: { content: [], totalElements: 0, totalPages: 0, size: 1, number: 0, page: 0, hasMore: false } });
  });
  return () => chartRequests;
}

test("appointment charts expose truthful sample counts and compose at mobile, tablet and desktop", async ({ context, page }, testInfo) => {
  await chartApi(context);
  await page.clock.setFixedTime(new Date("2026-10-11T03:00:00Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin");
  const insights = page.getByRole("region", { name: "Nhịp lịch hẹn", exact: true });
  await expect(insights.getByText("62%", { exact: true })).toBeVisible();
  await expect(insights.getByText("100 / 346 lịch hẹn", { exact: true })).toBeVisible();
  await expect(insights.getByText("19 lịch hẹn", { exact: true })).toBeVisible();
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await insights.scrollIntoViewIfNeeded();
    const canvases = insights.getByRole("img");
    await expect(canvases).toHaveCount(2);
    for (const canvas of await canvases.all()) {
      const box = await canvas.boundingBox();
      expect(box?.width).toBeGreaterThan(100);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await insights.screenshot({ path: testInfo.outputPath(`admin-chart-${width}.png`) });
  }
  await insights.getByText("Xem dữ liệu biểu đồ", { exact: true }).click();
  await expect(insights.getByRole("table", { name: "Dữ liệu lịch hẹn theo ngày" })).toBeVisible();
  await expect(insights.getByRole("table", { name: "Dữ liệu lịch hẹn theo ngày" }).getByRole("row", { name: "Thứ sáu 16/10 5", exact: true })).toBeVisible();
});

test("appointment chart loading and failed fetch offer keyboard retry without false totals", async ({ context, page }) => {
  let release: (() => void) | undefined;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  const requests = await chartApi(context, { fail: true, hold });
  await page.goto("/admin");
  const insights = page.getByRole("region", { name: "Nhịp lịch hẹn", exact: true });
  await expect(insights.getByRole("status")).toContainText("Đang tổng hợp");
  release?.();
  await expect(insights.getByRole("alert")).toContainText("Chưa thể tải dữ liệu");
  await expect(insights.getByRole("img")).toHaveCount(0);
  const retry = insights.getByRole("button", { name: "Thử lại", exact: true });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(insights.getByText("62%", { exact: true })).toBeVisible();
  expect(requests()).toBe(2);
});

test("empty appointment charts show an honest empty state without a meaningless donut", async ({ context, page }) => {
  await chartApi(context, { empty: true });
  await page.goto("/admin");
  const insights = page.getByRole("region", { name: "Nhịp lịch hẹn", exact: true });
  await expect(insights.getByText("Chưa có lịch hẹn để thống kê.", { exact: true })).toBeVisible();
  await expect(insights.getByRole("img")).toHaveCount(0);
  await expect(insights.getByRole("link", { name: "Xem lịch hẹn", exact: true })).toHaveAttribute("href", "/admin/appointments");
});

test("unavailable canvas keeps counts and accessible date data usable", async ({ context, page }) => {
  await chartApi(context);
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/admin");
  const insights = page.getByRole("region", { name: "Nhịp lịch hẹn", exact: true });
  await expect(insights.getByRole("status")).toContainText("Trình duyệt chưa thể vẽ biểu đồ");
  await expect(insights.getByText("62%", { exact: true })).toBeVisible();
  await expect(insights.getByRole("img")).toHaveCount(0);
  await expect(insights.getByRole("table", { name: "Dữ liệu lịch hẹn theo ngày" })).toBeVisible();
});
