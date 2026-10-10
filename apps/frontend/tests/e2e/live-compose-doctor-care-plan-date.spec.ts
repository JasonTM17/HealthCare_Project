import { expect, test } from "@playwright/test";

test.use({ trace: "off" });

// Real isolated UI/BFF regression. No fixture creation or response substitution.
const isolated = process.env.PLAYWRIGHT_CARE_ISOLATED === "1";
test.skip(!isolated, "Requires an explicitly owned local doctor/appointment fixture");

test("doctor can select another appointment day and retain it on refresh", async ({ page }) => {
  const origin = process.env.PLAYWRIGHT_BASE_URL ?? "";
  expect(["localhost", "127.0.0.1"]).toContain(new URL(origin).hostname);
  const email = process.env.PLAYWRIGHT_CARE_DOCTOR_EMAIL;
  const password = process.env.PLAYWRIGHT_CARE_DOCTOR_PASSWORD;
  const date = process.env.PLAYWRIGHT_CARE_APPOINTMENT_DATE;
  const appointmentId = process.env.PLAYWRIGHT_CARE_APPOINTMENT_ID;
  if (!email || !password || !date || !appointmentId) throw new Error("Missing owned care-plan fixture prerequisites");
  await page.goto(new URL("/auth/login", origin).href);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/doctor\/dashboard/);
  await page.goto(new URL("/doctor/care-plans", origin).href);
  await page.getByLabel("Ngày lịch hẹn", { exact: true }).fill(date);
  const appointment = page.getByRole("combobox", { name: /^Lịch hẹn/ });
  await expect(appointment.locator(`option[value="${appointmentId}"]`)).toHaveCount(1);
  await appointment.selectOption(appointmentId);
  await page.getByRole("button", { name: "Tải lại", exact: true }).click();
  await expect(page.getByLabel("Ngày lịch hẹn", { exact: true })).toHaveValue(date);
  await expect(appointment.locator(`option[value="${appointmentId}"]`)).toHaveCount(1);
  // A date change must not silently keep a source appointment from the old day.
  const other = date === "2000-01-01" ? "2000-01-02" : "2000-01-01";
  await page.getByLabel("Ngày lịch hẹn", { exact: true }).fill(other);
  await expect(page.getByText("Không có lịch hẹn đủ điều kiện trong ngày đã chọn. Bạn có thể chọn ngày khác.")).toBeVisible();
  await expect(appointment).toHaveCount(0);
});
