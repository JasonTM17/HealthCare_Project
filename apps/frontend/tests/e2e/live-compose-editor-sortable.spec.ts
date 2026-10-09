import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Live-compose acceptance for the wave-14 editor + SortableJS work.
 *
 * Runs against the isolated localhost:3330 stack (see
 * .devin/qa/playwright.local-audit.config.cjs). These journeys cover the
 * seams the source-level editor review marked NOT_RUN:
 *   - TinyMCE: compose → image dialog (URL insert) → save → reload → edit
 *     again with the permanent src surviving the markdown round trip, plus
 *     the CSP image-host rejection lane
 *   - SortableJS: FAQ drag reorder persists via the real reorder API, and a
 *     forced persist failure rolls the list back with a visible explanation
 *   - Article section drag persists through the article save + reload
 * The image-upload path itself is NOT_RUN here: the audit stack keeps
 * STORAGE_UPLOAD_ENABLED off, so the toolbar correctly offers the URL lane.
 *
 * Auth: one UI login per spec run, shared through storageState — the backend
 * login limiter is per-email and a per-test login burst gets throttled.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3330";
// CMS/account phase-4 uses a real, verified, non-demo local administrator.
// Reuse its test-only credentials without exposing them to browser storage.
const DEMO_PASSWORD = process.env.PLAYWRIGHT_CMS_ADMIN_PASSWORD ?? "LocalDemo!2026";
const ADMIN_EMAIL = process.env.PLAYWRIGHT_CMS_ADMIN_EMAIL ?? "admin@healthcare.local";
const ADMIN_STATE = path.join(__dirname, ".auth", "admin.json");

test.use({ storageState: ADMIN_STATE });

function appUrl(path: string): string {
  return new URL(path, BASE_URL).toString();
}

async function loginViaUi(page: Page, email: string): Promise<void> {
  await page.goto(appUrl("/"));
  const accountLink = page.locator("a.nav-account-link").first();
  await expect(accountLink).toBeVisible();
  await accountLink.click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 25_000 });
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await loginViaUi(page, ADMIN_EMAIL);
    await context.storageState({ path: ADMIN_STATE });
  } finally {
    await context.close();
  }
});

async function openAdminCatalog(page: Page): Promise<void> {
  await page.goto(appUrl("/admin/catalog"));
  await expect(
    page.getByRole("heading", { name: /Gói khám, FAQ và bài viết/ }),
  ).toBeVisible();
}

const faqRows = (page: Page) => page.locator("div[data-id]:has(.faq-drag-handle)");
// Row order as the user sees it — the question <strong> text per row.
const faqQuestions = (page: Page) =>
  faqRows(page).locator("strong").allTextContents();

// After a successful reorder the page broadcasts a catalog refresh that briefly
// swaps the list for a spinner; wait for the rows to re-mount before reading.
async function waitFaqList(page: Page): Promise<void> {
  await expect(faqRows(page).first()).toBeVisible({ timeout: 30_000 });
}

// SortableJS swaps only when the dragged item covers >65% of the target
// (swapThreshold), so drop the first row's handle onto the second row's
// centre — dropping on a top edge stays under the threshold and no-ops.
async function dragFirstFaqBelowSecond(page: Page): Promise<void> {
  await faqRows(page).nth(0).locator(".faq-drag-handle").dragTo(faqRows(page).nth(1));
}

test("FAQ drag reorder persists, reloads, and rolls back on API failure", async ({ page }) => {
  await openAdminCatalog(page);

  await waitFaqList(page);
  const before = await faqQuestions(page);
  expect(before.length).toBeGreaterThanOrEqual(2);

  // Real drag: first row dropped onto the second row's centre — SortableJS
  // swaps live, then the reorder API persists the new order.
  await dragFirstFaqBelowSecond(page);
  await expect(page.getByText("Đã lưu thứ tự FAQ")).toBeVisible({ timeout: 15_000 });
  await waitFaqList(page);
  const after = await faqQuestions(page);
  expect(after[0]).toBe(before[1]);
  expect(after[1]).toBe(before[0]);

  // Reload → server order confirmed (not just optimistic state).
  await page.reload();
  await waitFaqList(page);
  expect(await faqQuestions(page)).toEqual(after);

  // Failure path: force the reorder API to 500 and confirm the list rolls
  // back with a user-visible explanation instead of silently dropping.
  await page.route("**/api/v1/admin/faqs/order", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"code":"FORCED"}' }));
  await dragFirstFaqBelowSecond(page);
  await expect(page.getByText("Đã hoàn tác thứ tự FAQ")).toBeVisible({ timeout: 15_000 });
  await waitFaqList(page);
  expect(await faqQuestions(page)).toEqual(after);
  await page.unroute("**/api/v1/admin/faqs/order");

  // Restore the seeded order for the next run through the real API.
  await dragFirstFaqBelowSecond(page);
  await expect(page.getByText("Đã lưu thứ tự FAQ")).toBeVisible({ timeout: 15_000 });
  await waitFaqList(page);
  expect(await faqQuestions(page)).toEqual(before);
});

test("TinyMCE compose → image URL insert → save → reload keeps permanent src", async ({ page }) => {
  await openAdminCatalog(page);

  const slug = `e2e-editor-${Date.now()}`;
  const title = `Bài viết kiểm thử E2E ${slug}`;
  const altText = "Sơ đồ kiểm thử TinyMCE";

  await page.getByRole("textbox", { name: "Tiêu đề", exact: true }).fill(title);
  await expect(page.locator("#admin-article-slug")).toHaveValue(/e2e-editor-/);
  await page.locator("#admin-article-slug").fill(slug);
  await page.getByLabel("Tóm tắt").fill("Tóm tắt bài viết kiểm thử trình soạn thảo.");

  // TinyMCE body: type into the real iframe, then insert an image through
  // the custom dialog on a root-relative URL.
  const tinyFrame = page.frameLocator(".tox-edit-area__iframe").first();
  const tinyBody = tinyFrame.locator("body");
  await expect(tinyBody).toBeVisible({ timeout: 20_000 });
  await tinyBody.click();
  await tinyBody.pressSequentially("Nội dung lâm sàng kiểm thử. ", { delay: 5 });

  await page.getByTitle("Chèn hoặc tải ảnh y khoa").click();
  await page.locator("#rich-image-url").fill("/media/doctors/doctor-1.jpg");
  await page.locator("#rich-image-alt").fill(altText);
  await page.getByRole("button", { name: "Chèn ảnh vào bài viết" }).click();
  await expect(page.locator("#rich-image-url")).toBeHidden();
  await expect(tinyBody.locator('img[src="/media/doctors/doctor-1.jpg"]')).toBeAttached();
  await expect(tinyBody.locator("figcaption")).toHaveText(altText);

  // A CSP-blocked host is refused with a visible message and inserts nothing.
  await page.getByTitle("Chèn hoặc tải ảnh y khoa").click();
  await page.locator("#rich-image-url").fill("https://blocked.example/x.png");
  await page.getByRole("button", { name: "Chèn ảnh vào bài viết" }).click();
  await expect(page.getByText(/không hợp lệ hoặc không được CSP/)).toBeVisible();
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(page.locator("#rich-image-url")).toBeHidden();

  await page.getByRole("button", { name: "Lưu bài viết" }).click();
  // A saved article resets the composer — the title field clearing is the
  // visible success signal (the run() helper stays quiet on success).
  await expect(page.getByRole("textbox", { name: "Tiêu đề", exact: true })).toHaveValue("", { timeout: 20_000 });

  // Reopen the stored article: body survives the markdown round trip with
  // the image still pointing at the permanent URL.
  await page.reload();
  await page.getByPlaceholder(/Tìm theo tiêu đề/).fill(title);
  const editButton = page.getByLabel(`Sửa ${title}`);
  await expect(editButton).toBeVisible({ timeout: 15_000 });
  await editButton.click();
  const frameAgain = page.frameLocator(".tox-edit-area__iframe").first();
  await expect(frameAgain.locator('img[src="/media/doctors/doctor-1.jpg"]')).toBeAttached({ timeout: 20_000 });
});

test("article sections drag reorder persists through save and reload", async ({ page }) => {
  await openAdminCatalog(page);

  const slug = `e2e-sort-${Date.now()}`;
  const title = `Section order ${slug}`;
  await page.getByRole("textbox", { name: "Tiêu đề", exact: true }).fill(title);
  await page.locator("#admin-article-slug").fill(slug);
  await page.getByLabel("Tóm tắt").fill("Kiểm thử sắp xếp section.");

  // A published article requires a body; give TinyMCE one paragraph so the
  // save reaches the backend instead of failing client-side validation.
  const tinyFrame = page.frameLocator(".tox-edit-area__iframe").first();
  const tinyBody = tinyFrame.locator("body");
  await expect(tinyBody).toBeVisible({ timeout: 20_000 });
  await tinyBody.click();
  await tinyBody.pressSequentially("Nội dung bài viết kiểm thử section. ", { delay: 5 });

  await page.getByRole("button", { name: "+ Thêm section" }).click();
  await page.getByRole("button", { name: "+ Thêm section" }).click();
  const sectionRows = page.locator("div[data-id]:has(.section-drag-handle)");
  await expect(sectionRows).toHaveCount(2);
  await sectionRows.nth(0).getByLabel("Tiêu đề section").fill("Phần đầu tiên");
  await sectionRows.nth(0).getByLabel("Nội dung section").fill("Nội dung phần đầu tiên.");
  await sectionRows.nth(1).getByLabel("Tiêu đề section").fill("Phần thứ hai");
  await sectionRows.nth(1).getByLabel("Nội dung section").fill("Nội dung phần thứ hai.");

  await sectionRows.nth(0).locator(".section-drag-handle").dragTo(sectionRows.nth(1));
  await expect(page.getByText("Đã sắp xếp lại Section")).toBeVisible();
  await expect(sectionRows.nth(0).getByLabel("Tiêu đề section")).toHaveValue("Phần thứ hai");
  await expect(sectionRows.nth(1).getByLabel("Tiêu đề section")).toHaveValue("Phần đầu tiên");

  await page.getByRole("button", { name: "Lưu bài viết" }).click();
  await expect(page.getByRole("textbox", { name: "Tiêu đề", exact: true })).toHaveValue("", { timeout: 20_000 });

  // Reload → reopen the article → authored section order persisted.
  await page.reload();
  await page.getByPlaceholder(/Tìm theo tiêu đề/).fill(title);
  const editButton = page.getByLabel(`Sửa ${title}`);
  await expect(editButton).toBeVisible({ timeout: 15_000 });
  await editButton.click();
  const rowsAfter = page.locator("div[data-id]:has(.section-drag-handle)");
  await expect(rowsAfter).toHaveCount(2, { timeout: 15_000 });
  await expect(rowsAfter.nth(0).getByLabel("Tiêu đề section")).toHaveValue("Phần thứ hai");
  await expect(rowsAfter.nth(1).getByLabel("Tiêu đề section")).toHaveValue("Phần đầu tiên");
});
