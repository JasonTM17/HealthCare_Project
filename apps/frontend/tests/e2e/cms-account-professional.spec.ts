import { expect, test, type BrowserContext, type Frame, type Page, type TestInfo } from "@playwright/test";
import { CMS_PAGE_MANIFESTS, resolveCmsPageIdentity, type CmsPageIdentity } from "../../lib/cms-page-manifest";
import { createNativeCmsLayout, type CmsPageLayout } from "../../lib/cms-page-layout";
import type { CmsLayoutDraft, CmsLayoutHistory } from "../../lib/cms-layout-client";
import type { AdminAccount } from "../../lib/admin-users-client";
import { assertNoSensitiveBrowserStorage, browserSessionFixture, installMockBrowserSession } from "./helpers/browser-session";
import { clickCmsPreviewTransaction } from "./helpers/cms-preview-controls";

// This suite executes the production UI against browser-side fixtures. It proves
// composition/bridge/error UX only; the live-compose suite owns persistence proof.
export const CMS_TEST_WIDTHS = [375, 768, 1440] as const;
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const TARGET_ID = "00000000-0000-4000-8000-000000000002";
const ENTITY_ID = "00000000-0000-4000-8000-000000000011";
const STAMP = "2026-10-09T02:00:00.123456Z";
const HERO_TITLE = "Nội dung công khai theo nguồn gốc";
const PRIVATE_TITLE = "Bản sửa riêng chưa xuất bản";

function envelope<T>(content: T[], number = 0, size = 20, totalElements = content.length) {
  return { content, number, size, totalElements, totalPages: Math.ceil(totalElements / size), first: number === 0, last: true, empty: !content.length };
}
function account(id: string, overrides: Partial<AdminAccount> = {}): AdminAccount {
  return { id, email: `${id === ADMIN_ID ? "admin" : "target"}@e2e.healthcare.local`, displayName: id === ADMIN_ID ? "Quản trị kiểm thử" : "Tài khoản kiểm thử", status: "ACTIVE", roles: id === ADMIN_ID ? ["ADMIN"] : ["PATIENT"], emailVerified: true, emailVerifiedAt: STAMP, demo: false, createdAt: STAMP, updatedAt: STAMP, version: 0, doctorProfile: null, patientProfileId: null, googleLinked: false, ...overrides };
}
const catalogue: Record<string, Record<string, unknown>> = {
  branches: { id: ENTITY_ID, slug: "cms-fixture", name: "Cơ sở nguồn chuyên môn", address: "Địa chỉ nguồn chuyên môn", phone: "0900000000", workingHours: "08:00–17:00", emergencyHotline: "115", mapUrl: null, amenities: ["Tiếp đón"], doctors: [], activeDoctorCount: 0, active: true },
  doctors: { id: ENTITY_ID, slug: "cms-fixture", fullName: "Bác sĩ nguồn chuyên môn", bio: "Tiểu sử không thuộc CMS", title: "Bác sĩ", specialtyName: "Nội tổng quát", specialtySlugs: ["cms-fixture"], branchIds: [ENTITY_ID], branchNames: ["Cơ sở nguồn chuyên môn"], experienceYears: 12, achievements: "Thành tựu chuyên môn", active: true, photoUrl: "/icon.svg", demo: false },
  specialties: { id: ENTITY_ID, slug: "cms-fixture", name: "Chuyên khoa nguồn chuyên môn", description: "Mô tả chuyên khoa", commonSymptoms: ["Triệu chứng"], preparationSteps: ["Mang hồ sơ"], carePathway: "Khám chuyên khoa", relatedDoctors: [], active: true },
  services: { id: ENTITY_ID, slug: "cms-fixture", name: "Dịch vụ nguồn chuyên môn", description: "Nội dung dịch vụ", active: true },
  packages: { id: ENTITY_ID, slug: "cms-fixture", name: "Gói khám nguồn chuyên môn", description: "Nội dung gói khám", price: 200000, checklist: ["Khám tổng quát"], targetAudience: "Người trưởng thành", durationDays: 1, preparationSteps: ["Mang hồ sơ"], active: true, featured: true, version: 1 },
  articles: { id: ENTITY_ID, slug: "cms-fixture", title: "Bài viết nguồn chuyên môn", summary: "Tóm tắt chuyên môn", body: "## Nội dung được duyệt\n\nKhông sửa qua CMS.", publishedAt: STAMP, active: true, reviewStatus: "APPROVED", contentKind: "GENERAL", authorName: "Bác sĩ kiểm thử", readingMinutes: 3, category: "HEALTH", coverImageUrl: "/icon.svg", relatedSpecialtySlug: "cms-fixture", sections: [], tags: [], keyTakeaways: ["Nội dung chính"], warningSigns: ["Dấu hiệu cần khám"], preventionTips: ["Khám định kỳ"], sourceReferences: [], clinicalDisclaimer: "Tham khảo chuyên môn" },
};
export const CMS_MOCK_ROUTES: CmsPageIdentity[] = CMS_PAGE_MANIFESTS.flatMap((manifest) => [
  resolveCmsPageIdentity(manifest.path)!,
  ...(manifest.supportsDetail ? [resolveCmsPageIdentity(`${manifest.path}/cms-fixture${manifest.family === "benh-pho-bien" ? "-disease" : ""}`, ENTITY_ID)!] : []),
]);

async function installFixtures(context: BrowserContext, options: { demoActor?: boolean; role?: "ADMIN" | "PATIENT" | "DOCTOR"; anonymous?: boolean } = {}) {
  const role = options.role ?? "ADMIN";
  await installMockBrowserSession(context, options.anonymous ? null : browserSessionFixture(role, ADMIN_ID, "Quản trị kiểm thử"));
  const drafts = new Map<string, CmsLayoutDraft>();
  const history = new Map<string, Array<CmsLayoutHistory & { slotKey: string; componentType: string }>>();
  const accounts = new Map<string, AdminAccount>([[ADMIN_ID, account(ADMIN_ID, { demo: Boolean(options.demoActor) })], [TARGET_ID, account(TARGET_ID)]]);
  const requests: Array<{ method: string; path: string; body: unknown; query: URLSearchParams; preview: boolean }> = [];
  const failures = new Map<string, number>();
  for (const identity of CMS_MOCK_ROUTES) drafts.set(identity.slotKey, { slotKey: identity.slotKey, expectedVersion: 1, hasDraft: false, componentType: "PAGE_LAYOUT", payload: createNativeCmsLayout(identity), draftUpdatedAt: null, publicContent: null });
  const home = drafts.get("homepage.layout")!;
  home.publicContent = { slotKey: home.slotKey, componentType: "PAGE_LAYOUT", status: "PUBLISHED", version: 1, updatedAt: STAMP, payload: { ...home.payload, fields: { "hero.title": { kind: "text", value: HERO_TITLE } } } };
  home.payload = structuredClone(home.publicContent.payload);
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    if (path === "/auth/browser-sessions/current") { await route.fallback(); return; }
    const preview = request.frame().url().includes("cmsPreview=");
    const body = request.postDataJSON() as Record<string, unknown> | null;
    requests.push({ method, path, body, query: url.searchParams, preview });
    expect(request.headers()["authorization"]).toBeUndefined();
    const send = (status: number, value: unknown) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify(value) });
    const failure = failures.get(`${method} ${path}`);
    if (failure) { await send(failure, { code: "TEST_REJECTION", message: "Rejected fixture operation" }); return; }
    const layoutMatch = path.match(/^\/(admin\/)?cms\/content\/([^/]+)(?:\/(draft|publish|history|restore-draft))?$/);
    if (layoutMatch) {
      const [, admin, slot, action] = layoutMatch;
      const draft = drafts.get(decodeURIComponent(slot));
      if (draft) {
        if (admin && (options.anonymous || role !== "ADMIN")) { await send(403, { code: "FORBIDDEN" }); return; }
        if (!admin) { await send(draft.publicContent ? 200 : 404, draft.publicContent ?? { code: "NOT_FOUND" }); return; }
        if (action === "draft" && method === "GET") { await send(200, draft); return; }
        if (action === "history") { await send(200, history.get(draft.slotKey) ?? []); return; }
        if (body?.expectedVersion !== draft.expectedVersion) { await send(409, { code: "CMS_VERSION_CONFLICT" }); return; }
        draft.expectedVersion += 1; draft.draftUpdatedAt = STAMP;
        if (action === "draft") { draft.payload = structuredClone(body?.payload) as CmsPageLayout; draft.hasDraft = true; }
        if (action === "publish") { draft.publicContent = { slotKey: draft.slotKey, componentType: "PAGE_LAYOUT", status: "PUBLISHED", version: draft.expectedVersion, updatedAt: STAMP, payload: structuredClone(draft.payload) }; draft.hasDraft = false; }
        if (action === "restore-draft") { draft.payload = structuredClone(history.get(draft.slotKey)!.find((entry) => entry.eventId === body?.changeId)!.payload); draft.hasDraft = true; }
        const rows = history.get(draft.slotKey) ?? [];
        rows.unshift({ slotKey: draft.slotKey, componentType: "PAGE_LAYOUT", eventId: rows.length + 1, version: draft.expectedVersion, payload: structuredClone(draft.payload), status: action === "publish" ? "PUBLISHED" : "DRAFT", actorEmail: "admin@e2e.healthcare.local", changedAt: STAMP }); history.set(draft.slotKey, rows);
        await send(200, draft); return;
      }
      if (slot === "careers.body") { await send(200, { slotKey: slot, componentType: "RICH_TEXT", status: "PUBLISHED", version: 1, updatedAt: STAMP, payload: { title: "Thông tin ứng viên", body: "Nội dung ứng viên" } }); return; }
      await send(404, { code: "NOT_FOUND" }); return;
    }
    const userMatch = path.match(/^\/admin\/users(?:\/([^/]+))?(?:\/(verification|password-reset|revoke-sessions))?$/);
    if (userMatch) {
      const [, id, action] = userMatch;
      if (method !== "GET" && options.demoActor) { await send(403, { code: "DEMO_READ_ONLY" }); return; }
      if (method === "GET") { await send(200, id ? accounts.get(id) : envelope([...accounts.values()], Number(url.searchParams.get("page") ?? 0), Number(url.searchParams.get("size") ?? 20), 42)); return; }
      if (method === "POST" && !id) {
        const created = account("00000000-0000-4000-8000-000000000003", { email: String(body?.email), displayName: String(body?.displayName), roles: body?.roles as AdminAccount["roles"], emailVerified: false, emailVerifiedAt: null }); accounts.set(created.id, created); await send(201, { account: created, action: "CREATED", deliveryState: "REQUESTED_UNCONFIRMED" }); return;
      }
      const previous = accounts.get(id)!;
      expect(body?.expectedVersion).toBe(previous.version); expect(body?.expectedUpdatedAt).toBe(previous.updatedAt);
      const next = { ...previous, ...(method === "PUT" ? { email: String(body?.email), displayName: String(body?.displayName), roles: body?.roles as AdminAccount["roles"], status: body?.status as AdminAccount["status"] } : {}), version: previous.version + 1, updatedAt: "2026-10-09T03:00:00.654321Z" }; accounts.set(id, next);
      await send(200, action ? { account: next, action, deliveryState: action === "revoke-sessions" ? "NOT_APPLICABLE" : "REQUESTED_UNCONFIRMED" } : next); return;
    }
    if (path === "/admin/doctors") { await send(200, envelope([catalogue.doctors])); return; }
    if (path === "/careers/jobs") { await send(200, envelope([{ id: ENTITY_ID, slug: "cms-fixture-job", title: "Điều phối viên kiểm thử", department: "Tiếp đón", location: "Cơ sở kiểm thử", employmentType: "FULL_TIME", employmentTypeLabel: "Toàn thời gian", summary: "Vị trí tuyển dụng local", responsibilities: ["Điều phối"], requirements: ["Kỹ năng giao tiếp"], benefits: ["Đào tạo"], deadline: "2026-12-31", featured: false }])); return; }
    const entity = path.match(/^\/hospital\/(branches|doctors|specialties|services|packages|articles)(?:\/([^/]+))?$/);
    if (entity) {
      const item = entity[1] === "articles" && (entity[2]?.endsWith("-disease") || url.searchParams.get("contentKind") === "DISEASE_GUIDE") ? { ...catalogue.articles, slug: "cms-fixture-disease", contentKind: "DISEASE_GUIDE" } : catalogue[entity[1]];
      await send(200, entity[2] ? item : envelope([item])); return;
    }
    if (path.endsWith("/comments") || path === "/hospital/health-questions") { await send(200, []); return; }
    if (path === "/health") { await send(200, { status: "ok", ai_ready: true }); return; }
    if (method !== "GET") { await send(422, { code: "UNEXPECTED_TRANSACTION" }); return; }
    await send(200, envelope([]));
  });
  return { drafts, accounts, requests, failures };
}

export async function previewFrame(page: Page): Promise<Frame> {
  const frameElement = page.getByTestId("cms-preview-frame").first();
  await expect(frameElement).toBeVisible();
  const frame = await (await frameElement.elementHandle())!.contentFrame();
  expect(frame).not.toBeNull();
  await expect(page.getByText("Chọn văn bản hoặc ảnh trong trang để chỉnh sửa.").first()).toBeVisible();
  return frame!;
}
export async function revealCmsTab(page: Page, tab: "Vùng trang" | "Xem trước" | "Chỉnh sửa") {
  await expect(page.getByTestId("cms-page-picker")).toBeEnabled();
  const button = page.getByRole("button", { name: tab, exact: true });
  if ((page.viewportSize()?.width ?? 1440) <= 520) {
    await expect(button).toBeVisible();
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
}
export async function openCmsIdentity(page: Page, identity: CmsPageIdentity) {
  await revealCmsTab(page, "Vùng trang");
  await expect(page.getByTestId("cms-edit-toolbar")).toHaveCount(0);
  await page.getByTestId("cms-page-picker").selectOption(identity.manifest.family);
  if (identity.entityId) {
    await revealCmsTab(page, "Vùng trang");
    await page.getByLabel("Trang chi tiết", { exact: true }).fill(identity.canonicalPath);
    await page.getByRole("button", { name: "Mở trang chi tiết", exact: true }).click();
  }
  await expect(page.getByTestId("cms-workspace").locator("header")).toContainText(identity.canonicalPath);
  await revealCmsTab(page, "Xem trước");
  const frame = await previewFrame(page);
  expect(new URL(frame.url()).pathname).toBe(identity.canonicalPath);
  return frame;
}
async function selectNative(page: Page, frame: Frame, fieldId: string) {
  await revealCmsTab(page, "Xem trước");
  const field = frame.locator(`[data-cms-native-field="${fieldId}"]`);
  await field.scrollIntoViewIfNeeded(); await field.click();
  await expect(page.getByTestId("cms-field-inspector")).toBeVisible();
}
export async function assertNativeRoute(page: Page, frame: Frame, identity: CmsPageIdentity, width: number, info: TestInfo) {
  await page.getByTestId("cms-preview-width").first().selectOption(String(width));
  await expect.poll(() => frame.evaluate(() => innerWidth)).toBe(width);
  expect(await frame.evaluate(() => innerHeight)).toBe(width === 375 ? 812 : width === 768 ? 1024 : 900);
  const fields = identity.sections.flatMap((section) => section.fields);
  for (const field of fields) {
    const node = frame.locator(`[data-cms-native-field="${field.id}"]`);
    await expect(node, `${identity.canonicalPath}: ${field.id}`).toHaveCount(1);
    if (field.kind === "image") await expect(node).toHaveAttribute("src", /.+/);
    else await expect(node).not.toHaveText("");
  }
  expect(await frame.locator("[data-cms-native-field]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-cms-native-field")))).toEqual(expect.arrayContaining(fields.map((field) => field.id)));
  await info.attach(`${identity.manifest.family}-${identity.entityId ? "detail" : "family"}-${width}`, { body: await page.getByTestId("cms-preview-frame").first().screenshot(), contentType: "image/png" });
  for (const kind of ["text", "image", "rich"] as const) {
    const field = fields.find((entry) => entry.kind === kind);
    if (!field) continue;
    await selectNative(page, frame, field.id);
    await expect(page.getByTestId("cms-field-inspector").getByRole("heading", { name: field.label, exact: true })).toBeVisible();
    await revealCmsTab(page, "Xem trước");
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test.describe("CMS native production UI with fixtures", () => {
  test("manifest covers exactly 18 families and seven UUID detail families", () => {
    expect(CMS_PAGE_MANIFESTS).toHaveLength(18);
    expect(CMS_PAGE_MANIFESTS.filter((item) => item.supportsDetail)).toHaveLength(7);
    expect(CMS_MOCK_ROUTES).toHaveLength(25);
    expect(CMS_MOCK_ROUTES.every((identity) => identity.sections.flatMap((section) => section.fields).length > 0)).toBe(true);
  });
  for (const identity of CMS_MOCK_ROUTES) for (const width of CMS_TEST_WIDTHS) {
    test(`${identity.canonicalPath} native fields at ${width}px`, async ({ context, page }, info) => {
      test.setTimeout(90_000);
      await installFixtures(context); await page.setViewportSize({ width, height: 1000 });
      await page.goto("/admin/content");
      const frame = await openCmsIdentity(page, identity);
      await assertNativeRoute(page, frame, identity, width, info);
      await assertNoSensitiveBrowserStorage(page);
    });
  }
  test("native text/image/TinyMCE retain invalid buffers and save bounded Markdown", async ({ context, page }) => {
    const fixture = await installFixtures(context); await page.goto("/admin/content");
    const frame = await previewFrame(page);
    await selectNative(page, frame, "hero.title");
    await page.getByTestId("cms-field-inspector").getByRole("textbox").fill(PRIVATE_TITLE);
    await expect(frame.locator('[data-cms-native-field="hero.title"]')).toHaveText(PRIVATE_TITLE);
    await selectNative(page, frame, "hero.image");
    await page.getByLabel("URL hình ảnh (bắt buộc)", { exact: true }).fill("javascript:alert(1)");
    await expect(page.getByTestId("cms-save-draft")).toBeDisabled();
    await expect(page.getByLabel("URL hình ảnh (bắt buộc)")).toHaveValue("javascript:alert(1)");
    await page.getByLabel("URL hình ảnh (bắt buộc)").fill("/icon.svg");
    await page.getByLabel("Mô tả ảnh", { exact: true }).fill("Ảnh minh họa kiểm thử");
    await selectNative(page, frame, "hero.body");
    const body = page.frameLocator(".tox-edit-area__iframe").locator("body");
    await expect(body).toBeVisible(); await body.fill("Văn bản an toàn từ TinyMCE");
    await page.getByRole("button", { name: "Mã nguồn", exact: true }).click();
    const raw = page.getByTestId("cms-field-inspector").locator("textarea");
    await raw.fill('<table><tr><td>Định dạng chưa được hỗ trợ</td></tr></table>');
    await expect(page.getByTestId("cms-save-draft")).toBeDisabled();
    await expect(raw).toHaveValue('<table><tr><td>Định dạng chưa được hỗ trợ</td></tr></table>');
    await raw.fill("Văn bản an toàn từ TinyMCE");
    await page.getByTestId("cms-save-draft").click();
    await expect(page.getByTestId("cms-draft-status")).toContainText("Bản nháp đã lưu");
    const saved = fixture.drafts.get("homepage.layout")!;
    expect(saved.payload.fields["hero.body"]).toEqual({ kind: "rich", format: "markdown", value: "Văn bản an toàn từ TinyMCE" });
    expect(saved.payload.fields["hero.image"]).toEqual({ kind: "image", src: "/icon.svg", alt: "Ảnh minh họa kiểm thử" });
    expect(saved.publicContent!.payload.fields["hero.title"]).toEqual({ kind: "text", value: HERO_TITLE });
    await page.reload(); await previewFrame(page);
    await expect(page.getByTestId("cms-draft-status")).toContainText("Bản nháp đã lưu");
  });
  test("save failure and conflict preserve work; history restores privately", async ({ context, page }) => {
    const fixture = await installFixtures(context); await page.goto("/admin/content");
    const frame = await previewFrame(page); await selectNative(page, frame, "hero.title");
    const input = page.getByTestId("cms-field-inspector").getByRole("textbox"); await input.fill(PRIVATE_TITLE);
    fixture.failures.set("PUT /admin/cms/content/homepage.layout/draft", 500);
    await page.getByTestId("cms-save-draft").click(); await expect(page.getByRole("alert").first()).toBeVisible(); await expect(input).toHaveValue(PRIVATE_TITLE);
    fixture.failures.set("PUT /admin/cms/content/homepage.layout/draft", 409);
    await page.getByTestId("cms-save-draft").click(); await expect(page.getByTestId("cms-conflict")).toBeVisible(); await expect(input).toHaveValue(PRIVATE_TITLE);
    fixture.failures.delete("PUT /admin/cms/content/homepage.layout/draft");
    await page.getByRole("button", { name: "Xem thông tin mới", exact: true }).click();
    await page.getByRole("button", { name: "Giữ bản đang sửa để tiếp tục", exact: true }).click();
    await page.getByTestId("cms-save-draft").click(); await expect(page.getByTestId("cms-draft-status")).toContainText("Bản nháp đã lưu");
    await page.getByTestId("cms-publish").click(); await page.getByRole("dialog").getByRole("button", { name: "Xác nhận xuất bản", exact: true }).click();
    await expect(page.getByText("Đã xuất bản nội dung của trang này.", { exact: true })).toBeVisible();
    const published = structuredClone(fixture.drafts.get("homepage.layout")!.publicContent);
    await input.fill("Bản riêng tiếp theo"); await page.getByTestId("cms-save-draft").click();
    await expect(page.getByTestId("cms-draft-status")).toContainText("Bản nháp đã lưu");
    await page.getByRole("button", { name: "Lịch sử", exact: true }).click();
    await page.getByTestId("cms-history").getByRole("button", { name: "Khôi phục vào bản nháp", exact: true }).last().click();
    await page.getByRole("dialog").getByRole("button", { name: "Khôi phục bản nháp", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(fixture.drafts.get("homepage.layout")!.hasDraft).toBe(true);
    expect(fixture.drafts.get("homepage.layout")!.publicContent).toEqual(published);
  });
  test("dirty switch offers stay, failed save stays, discard and save continue", async ({ context, page }) => {
    const fixture = await installFixtures(context); await page.goto("/admin/content");
    const frame = await previewFrame(page); await selectNative(page, frame, "hero.title");
    const input = page.getByTestId("cms-field-inspector").getByRole("textbox"); await input.fill(PRIVATE_TITLE);
    await page.getByTestId("cms-page-picker").selectOption("about");
    const dialog = page.getByRole("dialog"); await expect(dialog).toContainText("Bạn có thay đổi chưa lưu");
    await dialog.getByRole("button", { name: "Ở lại", exact: true }).click(); await expect(input).toHaveValue(PRIVATE_TITLE);
    await page.getByTestId("cms-page-picker").selectOption("about");
    fixture.failures.set("PUT /admin/cms/content/homepage.layout/draft", 500);
    await dialog.getByRole("button", { name: "Lưu bản nháp và tiếp tục", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible(); await expect(input).toHaveValue(PRIVATE_TITLE);
    fixture.failures.delete("PUT /admin/cms/content/homepage.layout/draft");
    await dialog.getByRole("button", { name: "Lưu bản nháp và tiếp tục", exact: true }).click();
    await expect(page.getByTestId("cms-page-picker")).toHaveValue("about"); await previewFrame(page);
    const field = resolveCmsPageIdentity("/about")!.sections.flatMap((section) => section.fields).find((item) => item.kind === "text")!;
    await selectNative(page, await previewFrame(page), field.id); await page.getByTestId("cms-field-inspector").getByRole("textbox").fill("Bỏ thay đổi này");
    await page.getByTestId("cms-page-picker").selectOption("homepage"); await dialog.getByRole("button", { name: "Bỏ thay đổi và tiếp tục", exact: true }).click();
    await expect(page.getByTestId("cms-page-picker")).toHaveValue("homepage");
    expect(fixture.drafts.get("about.layout")!.hasDraft).toBe(false);
    expect(fixture.drafts.get("homepage.layout")!.payload.fields["hero.title"]).toEqual({ kind: "text", value: PRIVATE_TITLE });
  });
  test("keyboard and pointer order remain inside the native sibling group", async ({ context, page }) => {
    // Both tall sibling rows must fit before mouse-down. The old dragTo
    // scrolled its destination by 508px mid-gesture, so it never proved a swap.
    await page.setViewportSize({ width: 1440, height: 2600 });
    const fixture = await installFixtures(context); await page.goto("/admin/content");
    const identity = resolveCmsPageIdentity("/about")!; await openCmsIdentity(page, identity);
    const original = fixture.drafts.get(identity.slotKey)!.payload.sectionOrder;
    await page.getByTestId("cms-move-down-values").focus(); await page.keyboard.press("Enter");
    const rows = page.locator('[data-testid^="cms-section-"]');
    await expect(rows.nth(original.indexOf("values"))).toHaveAttribute("data-testid", "cms-section-network");
    await page.getByTestId("cms-save-draft").click(); await expect(page.getByTestId("cms-draft-status")).toContainText("Bản nháp đã lưu");
    await page.reload(); await openCmsIdentity(page, identity);
    await expect(rows.nth(original.indexOf("values"))).toHaveAttribute("data-testid", "cms-section-network");
    const handle = page.getByTestId("cms-section-network").locator(".cms-section-drag-handle");
    const target = page.getByTestId("cms-section-values");
    await target.scrollIntoViewIfNeeded(); await handle.scrollIntoViewIfNeeded();
    const sourceBox = (await handle.boundingBox())!; const targetBox = (await target.boundingBox())!;
    const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
    const end = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
    expect(start.y).toBeGreaterThan(0); expect(end.y).toBeLessThan(2600);
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    try {
      await page.mouse.move(start.x + 12, start.y + 12, { steps: 4 });
      await page.mouse.move(end.x, end.y, { steps: 24 });
      await page.mouse.move(end.x, end.y + 8, { steps: 4 });
    } finally { await page.mouse.up(); }
    await expect(page.getByTestId("cms-draft-status")).toContainText("Có thay đổi chưa lưu");
    await expect(page.getByTestId("cms-move-up-hero")).toBeDisabled();
    const pointerOrder = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")!.replace("cms-section-", "")));
    expect(pointerOrder).toEqual(original);
    await page.getByTestId("cms-save-draft").click(); await expect(page.getByTestId("cms-draft-status")).toContainText("Bản nháp đã lưu");
    expect(fixture.drafts.get(identity.slotKey)!.payload.sectionOrder).toEqual(pointerOrder);
    await page.reload(); await openCmsIdentity(page, identity);
    expect(await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")!.replace("cms-section-", "")))).toEqual(pointerOrder);
  });
  test("forged frame selection messages cannot select or replace a native field", async ({ context, page }) => {
    await installFixtures(context); await page.goto("/admin/content"); const frame = await previewFrame(page);
    await selectNative(page, frame, "hero.title");
    const input = page.getByTestId("cms-field-inspector").getByRole("textbox");
    await expect(input).toHaveValue(HERO_TITLE);
    await page.evaluate(() => {
      const iframe = document.querySelector<HTMLIFrameElement>('[data-testid="cms-preview-frame"]')!;
      const channel = new URL(iframe.src).searchParams.get("cmsChannel");
      const data = { protocol: "healthcare.cms.preview.v1", channel, slotKey: "homepage.layout", path: "/", revision: 0, type: "selected", fieldId: "hero.title", nativeValue: { kind: "text", value: "FORGED" } };
      for (const patch of [{}, { channel: "00000000-0000-4000-8000-000000000099" }, { slotKey: "about.layout" }, { path: "/about" }, { revision: -1 }, { accessToken: "forbidden" }]) {
        window.dispatchEvent(new MessageEvent("message", { origin: location.origin, source: window, data: { ...data, ...patch } }));
        window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.invalid", source: iframe.contentWindow, data: { ...data, ...patch } }));
        window.dispatchEvent(new MessageEvent("message", { origin: location.origin, source: iframe.contentWindow, data: { ...data, ...patch } }));
      }
    });
    await expect(input).toHaveValue(HERO_TITLE);
    await assertNoSensitiveBrowserStorage(page, ["forbidden"]);
  });
  test("dirty same-document browser Back stays until an explicit decision", async ({ context, page }) => {
    await installFixtures(context); await page.goto("/admin/content"); const frame = await previewFrame(page);
    // Construct a same-document entry: cross-document navigation remains covered
    // by beforeunload, which cannot be replaced with a custom dialog by browsers.
    await page.evaluate(() => history.pushState({}, "", `${location.pathname}?history-test=1`));
    const supported = await page.evaluate(() => "navigation" in window);
    test.skip(!supported, "Browser does not supply cancelable Navigation API traversal");
    await selectNative(page, frame, "hero.title"); await page.getByTestId("cms-field-inspector").getByRole("textbox").fill(PRIVATE_TITLE);
    await page.evaluate(() => history.back());
    const dialog = page.getByRole("dialog"); await expect(dialog).toContainText("Bạn có thay đổi chưa lưu"); await dialog.getByRole("button", { name: "Ở lại", exact: true }).click();
    await expect(page).toHaveURL(/history-test=1/); await expect(page.getByTestId("cms-field-inspector").getByRole("textbox")).toHaveValue(PRIVATE_TITLE);
    await page.evaluate(() => history.back()); await dialog.getByRole("button", { name: "Bỏ thay đổi và tiếp tục", exact: true }).click(); await expect(page).not.toHaveURL(/history-test=1/);
  });
  for (const [alias, canonical] of [["bac-si", "doctors"], ["chuyen-khoa", "specialties"], ["goi-kham", "packages"]]) test(`${alias} resolves to the single canonical detail identity`, async ({ context, page }) => {
    await installFixtures(context); await page.goto(`/${alias}/cms-fixture`); await expect(page).toHaveURL(new RegExp(`/${canonical}/cms-fixture$`));
    await expect(page.locator("[data-cms-native-field]").first()).toBeVisible();
    expect(resolveCmsPageIdentity(`/${alias}/cms-fixture`, ENTITY_ID)!.slotKey).toBe(`${canonical}.detail-${ENTITY_ID}.layout`);
  });
  for (const family of ["dat-lich", "search", "contact", "gop-y", "tra-cuu", "careers"]) {
    test(`${family} preview blocks mounted effects, UI transactions and programmatic writes`, async ({ context, page }) => {
      const fixture = await installFixtures(context); await page.goto("/admin/content");
      const frame = await openCmsIdentity(page, resolveCmsPageIdentity(`/${family}`)!);
      await frame.evaluate(async () => {
        const outcomes: string[] = [];
        for (const [path, method] of [["/api/v1/appointments/holds", "POST"], ["/api/v1/search?query=secret", "GET"], ["/api/v1/patient/profile", "GET"], ["/api/v1/feedback", "POST"]]) {
          try { await fetch(path, { method }); outcomes.push("allowed"); } catch (error) { outcomes.push((error as Error).name); }
        }
        try { const xhr = new XMLHttpRequest(); xhr.open("POST", "/api/v1/appointments/holds"); xhr.send("{}"); outcomes.push("allowed"); } catch (error) { outcomes.push((error as Error).name); }
        const form = document.createElement("form"); form.action = "/api/v1/feedback"; document.body.append(form);
        for (const action of [() => form.submit(), () => form.requestSubmit()]) { try { action(); outcomes.push("allowed"); } catch (error) { outcomes.push((error as Error).name); } }
        form.remove();
        if (navigator.sendBeacon("/api/v1/feedback", "blocked")) outcomes.push("allowed");
        if (outcomes.some((outcome) => outcome !== "NotAllowedError")) throw new Error("Preview transaction guard allowed a programmatic operation");
      });
      await clickCmsPreviewTransaction(frame, family);
      await expect(page.getByText(/Thao tác nghiệp vụ được tắt/)).toBeVisible();
      expect(fixture.requests.filter((request) => request.preview && request.method !== "GET")).toEqual([]);
      // Match transaction API roots, not approved CMS slots named search.*.
      expect(fixture.requests.filter((request) => request.preview && /^\/(appointments|patient|feedback|search|users\/me)(?:\/|$)/.test(request.path))).toEqual([]);
    });
  }
  for (const role of ["PATIENT", "DOCTOR"] as const) test(`${role} and standalone query cannot reveal draft`, async ({ context, page }) => {
    const fixture = await installFixtures(context, { role }); fixture.drafts.get("homepage.layout")!.payload.fields["hero.title"] = { kind: "text", value: PRIVATE_TITLE };
    await page.goto("/?cmsPreview=1&cmsChannel=00000000-0000-4000-8000-000000000010");
    await expect(page.getByRole("alert").filter({ hasText: "Không thể mở bản nháp" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(PRIVATE_TITLE);
    expect(fixture.requests.some((request) => request.path.endsWith("/draft"))).toBe(false);
  });
});

test.describe("Account production UI with safe DTO fixtures", () => {
  for (const width of CMS_TEST_WIDTHS) test(`filters, dates, metadata and detail at ${width}px`, async ({ context, page }) => {
    const fixture = await installFixtures(context); await page.setViewportSize({ width, height: 1000 }); await page.goto("/admin/users");
    await expect(page.getByTestId(`account-row-${TARGET_ID}`)).toBeVisible();
    await page.getByTestId("account-search").fill("kiểm thử"); await page.getByTestId("account-role-filter").selectOption("PATIENT"); await page.getByTestId("account-status-filter").selectOption("ACTIVE"); await page.getByTestId("account-verification-filter").selectOption("true");
    await page.getByLabel("Tạo từ ngày", { exact: true }).fill("2026-10-08"); await page.getByLabel("Đến hết ngày", { exact: true }).fill("2026-10-09");
    await expect.poll(() => fixture.requests.filter((request) => request.path === "/admin/users" && request.query.get("createdTo") === "2026-10-09T17:00:00.000Z").length).toBeGreaterThan(0);
    const query = fixture.requests.filter((request) => request.path === "/admin/users").at(-1)!.query;
    expect(query.get("createdFrom")).toBe("2026-10-07T17:00:00.000Z"); expect(query.get("role")).toBe("PATIENT"); expect(query.get("verified")).toBe("true"); expect(query.get("q")).toBe("kiểm thử");
    await page.getByTestId(`account-row-${TARGET_ID}`).getByRole("button", { name: "Xem chi tiết" }).click();
    await expect(page.getByTestId("account-created-at")).toHaveAttribute("datetime", STAMP); await expect(page.getByTestId("account-updated-at")).toHaveAttribute("datetime", STAMP);
    await expect(page.getByTestId("account-detail")).not.toContainText(/đăng nhập gần nhất|passwordHash|providerSubject|refreshToken/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
  test("create unverified account, update, lock/unlock use confirmed current tokens", async ({ context, page }) => {
    const fixture = await installFixtures(context); await page.goto("/admin/users");
    await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    await page.getByLabel("Họ tên hiển thị", { exact: true }).fill("Tài khoản mới"); await page.getByLabel("Email", { exact: true }).fill("new@e2e.healthcare.local"); await page.getByLabel(/^Mật khẩu ban đầu/).fill("FixtureOnly!2026");
    await page.getByTestId("account-save").click(); await expect(page.getByRole("dialog")).toContainText("new@e2e.healthcare.local");
    await page.getByRole("dialog").getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    await expect(page.getByTestId("account-detail")).toContainText("Chưa xác minh"); await expect(page.getByText(/Chưa xác nhận việc gửi hoặc nhận email/)).toBeVisible();
    await page.getByLabel("Họ tên hiển thị", { exact: true }).fill("Tên đã cập nhật"); await page.getByTestId("account-save").click(); await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(page.getByTestId("account-detail").getByRole("heading", { name: "Tên đã cập nhật", exact: true })).toBeVisible();
    for (const [label, status] of [["Khóa tài khoản", "DISABLED"], ["Mở khóa tài khoản", "ACTIVE"]]) {
      await page.getByRole("button", { name: label, exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click(); await expect(page.getByRole("dialog")).toBeHidden();
      expect(fixture.accounts.get("00000000-0000-4000-8000-000000000003")!.status).toBe(status);
    }
    await assertNoSensitiveBrowserStorage(page, ["FixtureOnly!2026"]);
  });
  test("server conflict keeps account buffer and requires latest-state review", async ({ context, page }) => {
    const fixture = await installFixtures(context); await page.goto("/admin/users");
    await page.getByTestId(`account-row-${TARGET_ID}`).getByRole("button", { name: "Xem chi tiết" }).click();
    const input = page.getByLabel("Họ tên hiển thị", { exact: true }); await input.fill("Bản đang sửa được giữ");
    fixture.failures.set(`PUT /admin/users/${TARGET_ID}`, 409);
    await page.getByTestId("account-save").click(); await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible(); await expect(input).toHaveValue("Bản đang sửa được giữ");
    await page.getByRole("dialog").getByRole("button", { name: "Ở lại", exact: true }).click();
    await page.getByRole("button", { name: "Xem thông tin mới, giữ nội dung đang sửa", exact: true }).click();
    await expect(page.getByRole("region", { name: "Thông tin mới từ hệ thống" })).toBeVisible(); await expect(input).toHaveValue("Bản đang sửa được giữ");
    await page.getByRole("button", { name: "Giữ nội dung sửa để đối chiếu", exact: true }).click(); fixture.failures.delete(`PUT /admin/users/${TARGET_ID}`);
    await page.getByTestId("account-save").click(); await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi", exact: true }).click(); await expect(page.getByRole("dialog")).toBeHidden();
    expect(fixture.accounts.get(TARGET_ID)!.displayName).toBe("Bản đang sửa được giữ");
  });
  test("older filter response cannot replace the newest account inventory", async ({ context, page }) => {
    await installFixtures(context);
    let oldStarted = false; let releaseOld: () => void = () => {};
    const oldMayFinish = new Promise<void>((resolve) => { releaseOld = resolve; });
    await context.route("**/api/v1/admin/users?**", async (route) => {
      const q = new URL(route.request().url()).searchParams.get("q");
      if (q !== "old" && q !== "new") { await route.fallback(); return; }
      if (q === "old") { oldStarted = true; await oldMayFinish; }
      const value = account(TARGET_ID, { displayName: q === "old" ? "Stale result forbidden" : "Newest account result" });
      try { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope([value])) }); } catch { /* Aborted old request is the expected alternative to epoch rejection. */ }
    });
    try {
      await page.goto("/admin/users"); await expect(page.getByTestId(`account-row-${TARGET_ID}`)).toBeVisible();
      await page.getByTestId("account-search").fill("old"); await expect.poll(() => oldStarted).toBe(true);
      await page.getByTestId("account-search").fill("new"); await expect(page.getByTestId(`account-row-${TARGET_ID}`)).toContainText("Newest account result");
      releaseOld(); await expect(page.getByTestId(`account-row-${TARGET_ID}`)).not.toContainText("Stale result forbidden");
    } finally { releaseOld(); }
  });
  test("doctor prerequisites, self restrictions and demo account are visible", async ({ context, page }) => {
    const fixture = await installFixtures(context); await page.goto("/admin/users");
    await page.getByTestId(`account-row-${ADMIN_ID}`).getByRole("button", { name: "Xem chi tiết" }).click();
    await expect(page.getByRole("button", { name: "Khóa tài khoản", exact: true })).toBeDisabled(); await expect(page.getByRole("checkbox", { name: /Quản trị viên/ })).toBeDisabled(); await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("readonly", "");
    await page.getByRole("button", { name: "Trở lại danh sách", exact: true }).click(); await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    await page.getByRole("checkbox", { name: /^Bác sĩ/ }).check(); const doctor = page.getByRole("combobox", { name: /^Chọn hồ sơ đang hoạt động/ }); await expect(doctor).toHaveAttribute("required", ""); await doctor.selectOption(ENTITY_ID);
    await expect(page.getByLabel("Họ tên hiển thị", { exact: true })).toHaveValue("Bác sĩ nguồn chuyên môn"); await expect(page.getByLabel("Họ tên hiển thị", { exact: true })).toHaveAttribute("readonly", "");
    fixture.accounts.set(TARGET_ID, account(TARGET_ID, { demo: true }));
    await page.reload(); await page.getByTestId(`account-row-${TARGET_ID}`).getByRole("button", { name: "Xem chi tiết" }).click(); await expect(page.getByTestId("account-save")).toBeDisabled(); await expect(page.getByRole("button", { name: "Khóa tài khoản", exact: true })).toBeDisabled();
  });
  test("demo actor cannot create or mutate accounts", async ({ context, page }) => {
    await installFixtures(context, { demoActor: true }); await page.goto("/admin/users");
    await expect(page.getByRole("button", { name: "Tạo tài khoản", exact: true })).toBeDisabled(); await page.getByTestId(`account-row-${TARGET_ID}`).getByRole("button", { name: "Xem chi tiết" }).click(); await expect(page.getByTestId("account-save")).toBeDisabled();
  });
});
