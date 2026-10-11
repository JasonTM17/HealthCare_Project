import { expect, test, type Page } from "@playwright/test";
import { fulfillBackendWarmup } from "./helpers/backend-warmup";

const accountName = "TS.BS Nguyễn Minh Khôi";
const clinicalName = "ThS.BS Trần Thu Hà";
const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20, first: true, last: true, empty: true };

async function installIdentityFixture(page: Page, profile: { status?: number; beforeReply?: () => Promise<void> } = {}) {
  await page.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    const request = route.request();
    expect(request.method()).toBe("GET");
    const path = new URL(request.url()).pathname;
    let body: unknown = [];
    if (path === "/api/v1/auth/browser-sessions/current") {
      body = { user: { id: "doctor-identity-test", email: "doctor@example.test", displayName: accountName, roles: ["ROLE_DOCTOR"] }, idleExpiresAt: "2099-01-01T00:00:00Z", absoluteExpiresAt: "2099-01-01T00:00:00Z" };
    } else if (path === "/api/v1/doctor/profile") {
      await profile.beforeReply?.();
      if (profile.status) {
        await route.fulfill({ status: profile.status, contentType: "application/json", body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }) });
        return;
      }
      body = { id: "linked-doctor-test", fullName: clinicalName, slug: "tran-thu-ha", bio: "Hồ sơ kiểm thử", photoUrl: "/media/doctors/doctor-1.jpg", active: true, specialtyIds: [], branchIds: [] };
    } else if (path.includes("/appointments") || path.includes("/notifications")) {
      body = emptyPage;
    } else if (path === "/api/v1/public/ai/policy") {
      body = { policyVersion: "identity-test", publicChatEnabled: false };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("doctor header keeps the linked clinical identity across navigation and reload", async ({ page }, testInfo) => {
  await installIdentityFixture(page);
  const identity = page.locator(".portal-user__copy strong");
  await page.goto("/doctor/dashboard");
  await expect(identity).toHaveText(clinicalName);
  await page.getByRole("link", { name: "Kế hoạch", exact: true }).click();
  await expect(page).toHaveURL(/\/doctor\/care-plans$/);
  await expect(identity).toHaveText(clinicalName);
  await page.reload();
  await expect(identity).toHaveText(clinicalName);
  await page.goto("/doctor/notifications");
  await expect(identity).toHaveText(clinicalName);
  await page.goto("/doctor/profile");
  await expect(identity).toHaveText(clinicalName);
  await expect(page.locator(".portal-user__copy")).not.toContainText(accountName);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(identity).toHaveText(clinicalName);
    await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`doctor-identity-${width}.png`) });
  }
});

test("pending doctor profile uses a neutral label until the linked name arrives", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await installIdentityFixture(page, { beforeReply: () => pending });
  await page.goto("/doctor/notifications");
  await expect(page.locator(".portal-user__copy strong")).toHaveText("Đang tải hồ sơ bác sĩ…");
  await expect(page.locator(".portal-user__copy")).not.toContainText(accountName);
  release();
  await expect(page.locator(".portal-user__copy strong")).toHaveText(clinicalName);
});

test("unavailable doctor profile falls back to the authenticated account identity", async ({ page }) => {
  await installIdentityFixture(page, { status: 503 });
  await page.goto("/doctor/notifications");
  await expect(page.locator(".portal-user__copy strong")).toHaveText(accountName);
  await expect(page.locator(".portal-user__copy")).toContainText("doctor@example.test");
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeEnabled();
});
