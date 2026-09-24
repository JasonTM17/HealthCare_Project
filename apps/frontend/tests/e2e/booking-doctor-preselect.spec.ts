import { expect, test } from "@playwright/test";

// A doctor CTA must carry the chosen doctor into the booking wizard: step 1
// shows that doctor's name (the booking-preselected-doctor card) and the
// specialty select is prefilled from the doctor's catalog identity. Opening
// the wizard without a selection (navbar) must not show the card.
//
// Runs against the live local stack (reuseExistingServer), so it reads the
// seeded doctor catalog instead of mocking it.

async function firstDoctorCard(page: import("@playwright/test").Page) {
  const card = page.locator("article.catalog-card").first();
  await expect(card).toBeVisible();
  const name = (await card.locator("h2").innerText()).trim();
  expect(name.length).toBeGreaterThan(0);
  return { card, name };
}

test.describe("doctor CTA preselects the booking wizard", () => {
  test("doctor card CTA opens the wizard with that doctor's name", async ({ page }) => {
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });
    const { card, name } = await firstDoctorCard(page);

    await card.getByRole("button", { name: /^Đặt lịch với bác sĩ/ }).click();

    const panel = page.getByTestId("booking-preselected-doctor");
    await expect(panel).toBeVisible();
    await expect(panel.locator("h4")).toHaveText(name);
    await expect(page.locator("#booking-specialty")).not.toHaveValue("");
  });

  test("doctor detail CTA opens the wizard with that doctor's name", async ({ page }) => {
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });
    const { card, name } = await firstDoctorCard(page);
    const href = await card.getByRole("link", { name: /Xem hồ sơ/ }).getAttribute("href");
    expect(href).toBeTruthy();

    await page.goto(href!, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Đặt lịch với bác sĩ", exact: true }).click();

    const panel = page.getByTestId("booking-preselected-doctor");
    await expect(panel).toBeVisible();
    await expect(panel.locator("h4")).toHaveText(name);
    await expect(page.locator("#booking-specialty")).not.toHaveValue("");
  });

  test("switching doctors dismisses the preselected card", async ({ page }) => {
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });
    const { card } = await firstDoctorCard(page);

    await card.getByRole("button", { name: /^Đặt lịch với bác sĩ/ }).click();
    const panel = page.getByTestId("booking-preselected-doctor");
    await expect(panel).toBeVisible();

    await panel.getByRole("button", { name: "Đổi bác sĩ khác" }).click();
    await expect(panel).toHaveCount(0);
    // The wizard stays usable: specialty selection remains prefilled.
    await expect(page.locator("#booking-specialty")).not.toHaveValue("");
  });

  test("navbar booking opens without a preselected doctor", async ({ page }) => {
    await page.goto("/doctors", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Đặt lịch khám" }).first().click();

    await expect(page.getByTestId("booking-preselected-doctor")).toHaveCount(0);
  });
});
