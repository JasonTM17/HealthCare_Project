import { expect, test } from "@playwright/test";
import { fulfillBackendWarmup } from "./helpers/backend-warmup";

test("new care plan action guides an empty day to an eligible appointment and persists the plan", async ({ page }) => {
  let plans: unknown[] = [];
  let writes = 0;
  const appointmentId = "00000000-0000-4000-8000-000000000001";
  await page.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown = [];
    if (url.pathname === "/api/v1/auth/browser-sessions/current") {
      body = { user: { id: "doctor-create-test", displayName: "Bác sĩ kiểm thử", email: "doctor@example.test", roles: ["ROLE_DOCTOR"] }, idleExpiresAt: "2099-01-01T00:00:00Z", absoluteExpiresAt: "2099-01-01T00:00:00Z" };
    } else if (url.pathname === "/api/v1/doctor/profile") {
      body = { id: "doctor-create-test", fullName: "Bác sĩ kiểm thử", slug: "doctor-test", bio: "", active: true };
    } else if (url.pathname === "/api/v1/doctor/care-plans" && request.method() === "POST") {
      const payload = request.postDataJSON();
      expect(payload.appointmentId).toBe(appointmentId);
      expect(payload.title).toBe("Theo dõi sau khám — kiểm thử");
      expect(payload.items[0].goal).toBe("Ghi lại lịch sinh hoạt");
      writes++;
      body = { id: "plan-create-test", appointmentId, title: payload.title, status: "OPEN", createdAt: "2026-10-11T08:00:00Z", updatedAt: "2026-10-11T08:00:00Z", items: [{ id: "item-create-test", goal: payload.items[0].goal, reminder: null, dueAt: null, completedAt: null, status: "OPEN" }] };
      plans = [body];
    } else if (url.pathname === "/api/v1/doctor/care-plans") {
      body = plans;
    } else if (url.pathname.includes("/appointments") || url.pathname.includes("/notifications")) {
      const content = url.pathname.includes("/appointments") && url.searchParams.get("date") === "2026-10-12"
        ? [{ id: appointmentId, bookingCode: "DEMO-CREATE-001", appointmentDate: "2026-10-12", patientName: "Bệnh nhân kiểm thử", status: "COMPLETED" }] : [];
      body = { content, totalElements: content.length, totalPages: content.length ? 1 : 0, number: 0, size: 100, first: true, last: true, empty: !content.length };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/doctor/care-plans");
  await expect(page.getByText("Không có lịch hẹn đủ điều kiện trong ngày đã chọn.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Tạo kế hoạch mới", exact: true }).click();
  await expect(page.getByLabel("Ngày lịch hẹn", { exact: true })).toBeFocused();
  expect(writes).toBe(0);
  await page.getByLabel("Ngày lịch hẹn", { exact: true }).fill("2026-10-12");
  const appointment = page.getByRole("combobox", { name: "Lịch hẹn", exact: true });
  await expect(appointment).toBeVisible();
  await page.getByRole("button", { name: "Tạo kế hoạch mới", exact: true }).click();
  await expect(appointment).toBeFocused();
  await appointment.selectOption(appointmentId);
  await page.getByLabel("Tên kế hoạch", { exact: true }).fill("Theo dõi sau khám — kiểm thử");
  await page.getByLabel("Mục tiêu", { exact: true }).fill("Ghi lại lịch sinh hoạt");
  await page.getByRole("button", { name: "Tạo kế hoạch", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Theo dõi sau khám — kiểm thử", exact: true })).toBeVisible();
  expect(writes).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Theo dõi sau khám — kiểm thử", exact: true })).toBeVisible();
  expect(writes).toBe(1);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("heading", { name: "Kế hoạch chăm sóc", exact: true }).scrollIntoViewIfNeeded();
    const action = page.getByRole("button", { name: "Tạo kế hoạch mới", exact: true });
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath(`care-plan-create-${width}.png`) });
  }
});
