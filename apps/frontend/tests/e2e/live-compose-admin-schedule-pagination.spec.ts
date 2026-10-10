import { expect, test } from "@playwright/test";

test.use({ trace: "off" });
test.skip(process.env.PLAYWRIGHT_SCHEDULE_ISOLATED !== "1", "Requires an owned local schedule beyond the first API page");

test("admin can reach a filtered schedule beyond the first page in both views", async ({ page }) => {
  const origin = process.env.PLAYWRIGHT_BASE_URL ?? "";
  expect(["localhost", "127.0.0.1"]).toContain(new URL(origin).hostname);
  const email = process.env.PLAYWRIGHT_SCHEDULE_ADMIN_EMAIL;
  const password = process.env.PLAYWRIGHT_SCHEDULE_ADMIN_PASSWORD;
  const doctor = process.env.PLAYWRIGHT_SCHEDULE_DOCTOR_NAME;
  const id = process.env.PLAYWRIGHT_SCHEDULE_ID;
  if (!email || !password || !doctor || !id) throw new Error("Missing owned schedule prerequisites");
  await page.goto(new URL("/auth/login", origin).href);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
  // Establish that the target exists on a later real API page before testing UI.
  const firstResponse = await page.request.get(new URL("/api/v1/admin/schedules?page=0&size=100", origin).href);
  expect(firstResponse.status()).toBe(200);
  const first = await firstResponse.json();
  expect(first.totalPages).toBeGreaterThan(1);
  expect(first.content.some((row: { id: string }) => row.id === id)).toBe(false);
  let found = false;
  for (let index = 1; index < first.totalPages && index < 20; index++) {
    const response = await page.request.get(new URL(`/api/v1/admin/schedules?page=${index}&size=100`, origin).href);
    expect(response.status()).toBe(200);
    const value = await response.json();
    found ||= value.content.some((row: { id: string }) => row.id === id);
  }
  expect(found).toBe(true);
  for (const view of ["Tuần", "Danh sách"]) {
    await page.goto(new URL("/admin/schedules", origin).href);
    await page.getByRole("button", { name: view, exact: true }).click();
    await page.getByPlaceholder("Ví dụ: Nguyễn Minh hoặc Quận 1").fill(doctor);
    const more = page.getByRole("button", { name: /^Tải thêm lịch/ });
    await expect(more).toBeVisible();
    for (let index = 1; index < first.totalPages; index++) {
      if (await more.count() === 0) break;
      const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/admin/schedules" && r.request().method() === "GET");
      await more.click();
      expect((await response).status()).toBe(200);
      await expect(page.getByRole("button", { name: "Đang tải…", exact: true })).toHaveCount(0);
    }
    // The same ordinary list control must expose the now-loaded owned row.
    await page.getByRole("button", { name: "Danh sách", exact: true }).click();
    await expect(page.getByRole("button", { name: `Sửa lịch của ${doctor}`, exact: true })).toBeVisible();
  }
});
