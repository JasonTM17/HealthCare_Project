import { expect, test, type APIRequestContext, type BrowserContext, type Frame, type Page } from "@playwright/test";
import { CMS_PAGE_MANIFESTS, resolveCmsPageIdentity, type CmsPageIdentity } from "../../lib/cms-page-manifest";
import { createNativeCmsLayout } from "../../lib/cms-page-layout";
import type { CmsLayoutDraft, CmsLayoutHistory } from "../../lib/cms-layout-client";
import type { AdminAccount, AccountPage } from "../../lib/admin-users-client";
import { clickCmsPreviewTransaction } from "./helpers/cms-preview-controls";

// No page/context routing or response substitution belongs in this suite.
// The controller provisions and later disposes the explicitly named local DB.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "";
const DATABASE = process.env.PLAYWRIGHT_CMS_DISPOSABLE_DATABASE ?? "";
const WIDTHS = [375, 768, 1440] as const;
const CHANNEL = "00000000-0000-4000-8000-000000000099";
type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;
let adminState: StorageState;
let actor: AdminAccount;
const details = new Map<string, CmsPageIdentity>();

function requireLocalAuthority() {
  expect(process.env.PLAYWRIGHT_CMS_ISOLATED, "Controller must attest the disposable CMS/account runtime").toBe("1");
  expect(DATABASE, "Explicit dedicated DB name is required; ordinary developer DBs are forbidden").toMatch(/^healthcare_cms_account_[a-z0-9_]+$/);
  expect(BASE_URL, "Set the exact owned frontend origin explicitly").not.toBe("");
  const url = new URL(BASE_URL);
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
  expect(["http:", "https:"]).toContain(url.protocol);
  expect(url.username + url.password).toBe("");
}
function credential(role: "ADMIN" | "PATIENT" | "DOCTOR" | "DEMO_ADMIN") {
  const email = process.env[`PLAYWRIGHT_CMS_${role}_EMAIL`];
  const password = process.env[`PLAYWRIGHT_CMS_${role}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing test-only ${role} login prerequisite (values must stay outside reports)`);
  return { email, password };
}
async function login(page: Page, role: Parameters<typeof credential>[0]) {
  const credentials = credential(role);
  await page.goto(new URL("/", BASE_URL).href);
  await page.locator("a.nav-account-link").first().click();
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(role === "ADMIN" || role === "DEMO_ADMIN" ? /\/admin/ : role === "DOCTOR" ? /\/doctor/ : /\/patient/);
}
async function api<T>(request: APIRequestContext, path: string, method = "GET", body?: unknown, expected = 200): Promise<T> {
  const response = await request.fetch(new URL(`/api/v1${path}`, BASE_URL).href, {
    method, ...(body === undefined ? {} : { data: body }),
    headers: { Accept: "application/json", Origin: new URL(BASE_URL).origin },
  });
  // Never include response body/cookies/provider messages in failed assertion output.
  expect(response.status(), `${method} ${path.split("?")[0]} HTTP status`).toBe(expected);
  return (response.status() === 204 ? undefined : await response.json()) as T;
}
function layoutPath(identity: CmsPageIdentity) { return `/admin/cms/content/${encodeURIComponent(identity.slotKey)}`; }
async function draft(request: APIRequestContext, identity: CmsPageIdentity): Promise<CmsLayoutDraft> {
  const response = await request.get(new URL(`/api/v1${layoutPath(identity)}/draft`, BASE_URL).href);
  if (response.status() === 404) return { slotKey: identity.slotKey, componentType: "PAGE_LAYOUT", expectedVersion: 0, hasDraft: false, payload: createNativeCmsLayout(identity), publicContent: null, draftUpdatedAt: null };
  expect(response.status()).toBe(200); return await response.json() as CmsLayoutDraft;
}
async function publicSnapshot(request: APIRequestContext, identity: CmsPageIdentity) {
  const response = await request.get(new URL(`/api/v1/cms/content/${encodeURIComponent(identity.slotKey)}`, BASE_URL).href);
  if (response.status() === 404) return null;
  expect(response.status()).toBe(200); return await response.json() as CmsLayoutDraft["publicContent"];
}
async function tab(page: Page, name: "Vùng trang" | "Xem trước" | "Chỉnh sửa") {
  await expect(page.getByTestId("cms-page-picker")).toBeEnabled();
  if ((page.viewportSize()?.width ?? 1440) <= 520) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeVisible(); await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
}
async function frame(page: Page): Promise<Frame> {
  const element = page.getByTestId("cms-preview-frame").first(); await expect(element).toBeVisible();
  const result = await (await element.elementHandle())!.contentFrame(); expect(result).not.toBeNull();
  await expect(page.getByText("Chọn văn bản hoặc ảnh trong trang để chỉnh sửa.").first()).toBeVisible(); return result!;
}
async function open(page: Page, identity: CmsPageIdentity) {
  await tab(page, "Vùng trang"); await page.getByTestId("cms-page-picker").selectOption(identity.manifest.family);
  await expect(page.getByTestId("cms-edit-toolbar")).toHaveCount(0);
  if (identity.entityId) { await tab(page, "Vùng trang"); await page.getByLabel("Trang chi tiết", { exact: true }).fill(identity.canonicalPath); await page.getByRole("button", { name: "Mở trang chi tiết", exact: true }).click(); }
  await tab(page, "Xem trước"); const preview = await frame(page); expect(new URL(preview.url()).pathname).toBe(identity.canonicalPath); return preview;
}
async function select(page: Page, preview: Frame, id: string) {
  await tab(page, "Xem trước"); const field = preview.locator(`[data-cms-native-field="${id}"]`); await field.scrollIntoViewIfNeeded(); await field.click(); await expect(page.getByTestId("cms-field-inspector")).toBeVisible();
}
async function save(page: Page) {
  await page.getByTestId("cms-save-draft").click(); await expect(page.getByTestId("cms-draft-status")).toContainText("Bản nháp đã lưu");
}
async function observePublicEvents() {
  const controller = new AbortController();
  const events: Array<{ slotKey: string; eventId: number }> = [];
  let ready = false;
  const response = await fetch(new URL("/api/v1/cms/content/events", BASE_URL), { signal: controller.signal });
  expect(response.status).toBe(200);
  const reader = response.body!.getReader();
  const completion = (async () => {
    let buffer = ""; const decoder = new TextDecoder();
    try {
      while (true) {
        const result = await reader.read(); if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true }).replace(/\r\n/g, "\n");
        const chunks = buffer.split("\n\n"); buffer = chunks.pop()!;
        for (const chunk of chunks) {
          const lines = chunk.split("\n");
          const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trimStart();
          if (event === "ready") ready = true;
          if (event === "cms-content-changed") {
            const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).replace(/^ /, "")).join("\n");
            events.push(JSON.parse(data) as { slotKey: string; eventId: number });
          }
        }
      }
    } catch (error) { if (!controller.signal.aborted) throw error; }
  })();
  await expect.poll(() => ready).toBe(true);
  return { events, async close() { controller.abort(); await completion; } };
}

test.beforeAll(async ({ browser }) => {
  requireLocalAuthority();
  const context = await browser.newContext({ baseURL: BASE_URL });
  try {
    const page = await context.newPage(); await login(page, "ADMIN");
    const current = await api<{ user: { id: string } }>(context.request, "/auth/browser-sessions/current");
    actor = await api<AdminAccount>(context.request, `/admin/users/${current.user.id}`);
    expect(actor.demo).toBe(false); expect(actor.emailVerified).toBe(true); expect(actor.status).toBe("ACTIVE"); expect(actor.roles).toContain("ADMIN");
    adminState = await context.storageState();
    for (const manifest of CMS_PAGE_MANIFESTS.filter((item) => item.supportsDetail)) {
      const source = manifest.family === "benh-pho-bien" ? "articles" : manifest.family;
      const result = await api<{ content: Array<{ id: string; slug: string; contentKind?: string }> }>(context.request, `/hospital/${source}?page=0&size=100${manifest.family === "benh-pho-bien" ? "&contentKind=DISEASE_GUIDE" : ""}`);
      const entity = result.content.find((item) => manifest.family !== "benh-pho-bien" || item.contentKind === "DISEASE_GUIDE");
      expect(entity, `${manifest.family} needs an active disposable catalogue detail fixture`).toBeDefined();
      const identity = resolveCmsPageIdentity(`${manifest.path}/${encodeURIComponent(entity!.slug)}`, entity!.id); expect(identity).not.toBeNull(); details.set(manifest.family, identity!);
    }
    // Required conditional native fields use the existing authored career slot.
    // This is local fixture setup, never a production content operation.
    const careerBody = await context.request.get(new URL("/api/v1/admin/cms/content/careers.body", BASE_URL).href);
    if (careerBody.status() === 404) await api(context.request, "/admin/cms/content/careers.body", "PUT", { componentType: "RICH_TEXT", status: "PUBLISHED", payload: { title: "Thông tin ứng viên kiểm thử", body: "Nội dung fixture local" }, expectedVersion: 0 });
    else expect(careerBody.status()).toBe(200);
  } finally { await context.close(); }
});
test.beforeEach(async ({ context }) => { await context.addCookies(adminState.cookies); });

test.describe("Isolated native CMS route/detail persistence", () => {
  for (const manifest of CMS_PAGE_MANIFESTS) for (const isDetail of manifest.supportsDetail ? [false, true] : [false]) for (const width of WIDTHS) {
    test(`${manifest.family}${isDetail ? " detail UUID" : " family"} actual native composition ${width}px`, async ({ page }, info) => {
      const identity = isDetail ? details.get(manifest.family)! : resolveCmsPageIdentity(manifest.path)!;
      await page.setViewportSize({ width, height: 1000 }); await page.goto(new URL("/admin/content", BASE_URL).href);
      const preview = await open(page, identity); await page.getByTestId("cms-preview-width").selectOption(String(width));
      await expect.poll(() => preview.evaluate(() => innerWidth)).toBe(width);
      expect(await preview.evaluate(() => innerHeight)).toBe(width === 375 ? 812 : width === 768 ? 1024 : 900);
      const fields = identity.sections.flatMap((section) => section.fields);
      for (const field of fields) {
        const native = preview.locator(`[data-cms-native-field="${field.id}"]`); await expect(native, `${identity.canonicalPath}/${field.id}`).toHaveCount(1);
        if (field.kind === "image") await expect(native).toHaveAttribute("src", /.+/); else await expect(native).not.toHaveText("");
      }
      await info.attach(`${manifest.family}-${isDetail ? "detail" : "family"}-${width}`, { body: await page.getByTestId("cms-preview-frame").screenshot(), contentType: "image/png" });
      for (const kind of ["text", "rich", "image"] as const) {
        const field = fields.find((item) => item.kind === kind); if (!field) continue;
        await select(page, preview, field.id); await expect(page.getByTestId("cms-field-inspector").getByRole("heading", { name: field.label, exact: true })).toBeVisible(); await tab(page, "Xem trước");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(await preview.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    });
  }
  test("private first draft, reload, atomic publication, history restore and one SSE event", async ({ page, context, browser }) => {
    const identity = resolveCmsPageIdentity("/about")!;
    const beforePublic = await publicSnapshot(context.request, identity);
    expect(beforePublic, "First-draft proof requires fresh about.layout in the explicitly disposable DB").toBeNull();
    const title = `Nháp local ${Date.now()}`;
    const observer = await observePublicEvents();
    const anonymous = await browser.newContext({ baseURL: BASE_URL });
    try {
      await page.goto(new URL("/admin/content", BASE_URL).href); let preview = await open(page, identity);
      const field = identity.sections.flatMap((section) => section.fields).find((item) => item.kind === "text")!;
      await select(page, preview, field.id); await page.getByTestId("cms-field-inspector").getByRole("textbox").fill(title); await save(page);
      const stored = await draft(context.request, identity); expect(stored.hasDraft).toBe(true); expect(stored.payload.fields[field.id]).toEqual({ kind: "text", value: title });
      expect(await publicSnapshot(anonymous.request, identity)).toEqual(beforePublic); expect(observer.events.filter((event) => event.slotKey === identity.slotKey)).toHaveLength(0);
      const visitor = await anonymous.newPage(); await visitor.goto(new URL(identity.canonicalPath, BASE_URL).href); await expect(visitor.locator("body")).not.toContainText(title);
      await page.reload(); preview = await open(page, identity); await expect(preview.locator(`[data-cms-native-field="${field.id}"]`)).toHaveText(title);
      await page.getByTestId("cms-publish").click(); await page.getByRole("dialog").getByRole("button", { name: "Xác nhận xuất bản", exact: true }).click(); await expect(page.getByText("Đã xuất bản nội dung của trang này.", { exact: true })).toBeVisible();
      await expect.poll(async () => (await publicSnapshot(anonymous.request, identity))?.payload.fields[field.id]).toEqual({ kind: "text", value: title });
      await expect.poll(() => observer.events.filter((event) => event.slotKey === identity.slotKey).length).toBe(1);
      await visitor.reload(); await expect(visitor.locator(`[data-cms-native-field="${field.id}"]`)).toHaveText(title);
      const published = await publicSnapshot(anonymous.request, identity);
      await select(page, preview, field.id); await page.getByTestId("cms-field-inspector").getByRole("textbox").fill(`${title} khác`); await save(page);
      await page.getByRole("button", { name: "Lịch sử", exact: true }).click(); await expect(page.getByTestId("cms-history")).toBeVisible();
      const history = await api<CmsLayoutHistory[]>(context.request, `${layoutPath(identity)}/history?limit=50`); expect(history.length).toBeGreaterThanOrEqual(3);
      await page.getByTestId("cms-history").getByRole("button", { name: "Khôi phục vào bản nháp", exact: true }).last().click(); await page.getByRole("dialog").getByRole("button", { name: "Khôi phục bản nháp", exact: true }).click(); await expect(page.getByRole("dialog")).toBeHidden();
      expect((await draft(context.request, identity)).hasDraft).toBe(true); expect(await publicSnapshot(anonymous.request, identity)).toEqual(published); expect(observer.events.filter((event) => event.slotKey === identity.slotKey)).toHaveLength(1);
    } finally { await observer.close(); await anonymous.close(); }
  });
  test("real concurrent revision conflict and offline save retain the editor buffer", async ({ page, context }) => {
    const identity = resolveCmsPageIdentity("/faq")!; await page.goto(new URL("/admin/content", BASE_URL).href); const preview = await open(page, identity);
    const field = identity.sections.flatMap((section) => section.fields).find((item) => item.kind === "text")!; await select(page, preview, field.id);
    const input = page.getByTestId("cms-field-inspector").getByRole("textbox"); const value = `Giữ nội dung local ${Date.now()}`; await input.fill(value);
    await context.setOffline(true);
    try { await page.getByTestId("cms-save-draft").click(); await expect(page.getByRole("alert").first()).toBeVisible(); await expect(input).toHaveValue(value); }
    finally { await context.setOffline(false); }
    const baseline = await draft(context.request, identity);
    const concurrent = await api<CmsLayoutDraft>(context.request, `${layoutPath(identity)}/draft`, "PUT", { componentType: "PAGE_LAYOUT", expectedVersion: baseline.expectedVersion, payload: { ...baseline.payload, fields: { ...baseline.payload.fields, [field.id]: { kind: "text", value: "Phiên quản trị khác" } } } });
    await page.getByTestId("cms-save-draft").click(); await expect(page.getByTestId("cms-conflict")).toBeVisible(); await expect(input).toHaveValue(value);
    expect((await draft(context.request, identity)).expectedVersion).toBe(concurrent.expectedVersion);
    await page.getByRole("button", { name: "Xem thông tin mới", exact: true }).click(); await page.getByRole("button", { name: "Giữ bản đang sửa để tiếp tục", exact: true }).click(); await save(page);
    expect((await draft(context.request, identity)).payload.fields[field.id]).toEqual({ kind: "text", value });
  });
  test("keyboard plus pointer order persist after full reload", async ({ page, context }) => {
    const identity = resolveCmsPageIdentity("/about")!; await page.goto(new URL("/admin/content", BASE_URL).href); await open(page, identity);
    const before = (await draft(context.request, identity)).payload.sectionOrder;
    const current = before.indexOf("values");
    const direction = current + 1 < before.length && identity.sections.find((section) => section.id === before[current + 1])?.reorderable ? "down" : "up";
    const keyboard = page.getByTestId(`cms-move-${direction}-values`); await expect(keyboard).toBeEnabled(); await keyboard.focus(); await page.keyboard.press("Enter"); await save(page);
    const after = (await draft(context.request, identity)).payload.sectionOrder; expect(after).not.toEqual(before);
    await page.reload(); await open(page, identity);
    expect(await page.locator('[data-testid^="cms-section-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")!.replace("cms-section-", "")))).toEqual(after);
    const from = page.getByTestId("cms-section-values"); const to = page.getByTestId(`cms-section-${before[current] === after[current] ? before[current + 1] : after[current]}`);
    await from.locator(".cms-section-drag-handle").dragTo(to); await save(page); const dragged = (await draft(context.request, identity)).payload.sectionOrder; expect(dragged).not.toEqual(after);
    await page.reload(); await open(page, identity); expect(await page.locator('[data-testid^="cms-section-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")!.replace("cms-section-", "")))).toEqual(dragged);
  });
  test("real image and TinyMCE bounded Markdown survive draft reload", async ({ page, context }) => {
    const identity = resolveCmsPageIdentity("/")!; await page.goto(new URL("/admin/content", BASE_URL).href); let preview = await frame(page);
    await select(page, preview, "hero.image"); await page.getByLabel("URL hình ảnh (bắt buộc)", { exact: true }).fill("javascript:alert(1)"); await expect(page.getByTestId("cms-save-draft")).toBeDisabled();
    await page.getByLabel("URL hình ảnh (bắt buộc)", { exact: true }).fill("/icon.svg"); await page.getByLabel("Mô tả ảnh", { exact: true }).fill("Minh họa local");
    await select(page, preview, "hero.body"); const body = page.frameLocator(".tox-edit-area__iframe").locator("body"); await expect(body).toBeVisible(); await body.fill("Nội dung TinyMCE local an toàn"); await save(page);
    const result = await draft(context.request, identity); expect(result.payload.fields["hero.image"]).toEqual({ kind: "image", src: "/icon.svg", alt: "Minh họa local" }); expect(result.payload.fields["hero.body"]).toEqual({ kind: "rich", format: "markdown", value: "Nội dung TinyMCE local an toàn" });
    await page.reload(); preview = await frame(page); await expect(preview.locator('[data-cms-native-field="hero.body"]')).toContainText("Nội dung TinyMCE local an toàn"); await expect(preview.locator('[data-cms-native-field="hero.image"]')).toHaveAttribute("alt", "Minh họa local");
  });
  test("detail identity cannot share overrides with its family or peer", async ({ page, context }) => {
    const identity = details.get("doctors")!; const family = resolveCmsPageIdentity("/doctors")!; const familyBefore = await draft(context.request, family);
    const peers = await api<{ content: Array<{ id: string; slug: string }> }>(context.request, "/hospital/doctors?page=0&size=100"); const peer = peers.content.find((doctor) => doctor.id !== identity.entityId);
    expect(peer, "Two active doctor fixtures are required for peer isolation").toBeDefined(); const peerIdentity = resolveCmsPageIdentity(`/doctors/${peer!.slug}`, peer!.id)!; const peerBefore = await draft(context.request, peerIdentity);
    await page.goto(new URL("/admin/content", BASE_URL).href); const preview = await open(page, identity); const field = identity.sections.flatMap((section) => section.fields).find((item) => item.kind === "text")!; await select(page, preview, field.id); await page.getByTestId("cms-field-inspector").getByRole("textbox").fill("Chỉ trang bác sĩ thứ nhất"); await save(page);
    expect(await draft(context.request, family)).toEqual(familyBefore); expect(await draft(context.request, peerIdentity)).toEqual(peerBefore);
    const domain = await api<{ fullName: string; bio: string }>(context.request, `/hospital/doctors/${identity.canonicalPath.split("/").at(-1)}`); expect(await preview.locator("body").innerText()).toContain(domain.fullName);
    await open(page, peerIdentity); await expect((await frame(page)).locator("body")).not.toContainText("Chỉ trang bác sĩ thứ nhất");
  });
  for (const family of ["dat-lich", "search", "contact", "gop-y", "tra-cuu", "careers"]) test(`${family} real preview cannot issue UI/effect/programmatic transactions`, async ({ page }) => {
    const observed: string[] = [];
    page.on("request", (request) => {
      if (request.frame().url().includes("cmsPreview=") && new URL(request.url()).pathname.startsWith("/api/")
        && (request.method() !== "GET" || /^\/api\/v1\/(appointments|patient|feedback|search|users\/me)(?:\/|$)/.test(new URL(request.url()).pathname))) observed.push(`${request.method()} ${new URL(request.url()).pathname}`);
    });
    await page.goto(new URL("/admin/content", BASE_URL).href); const preview = await open(page, resolveCmsPageIdentity(`/${family}`)!);
    const result = await preview.evaluate(async () => {
      const blocked: boolean[] = [];
      for (const [url, method] of [["/api/v1/appointments/holds", "POST"], ["/api/v1/patient/profile", "GET"], ["/api/v1/feedback", "POST"], ["/api/v1/search?q=preview", "GET"]]) {
        try { await fetch(url, { method }); blocked.push(false); } catch (error) { blocked.push((error as Error).name === "NotAllowedError"); }
      }
      try { const xhr = new XMLHttpRequest(); xhr.open("POST", "/api/v1/feedback"); xhr.send(); blocked.push(false); } catch (error) { blocked.push((error as Error).name === "NotAllowedError"); }
      blocked.push(navigator.sendBeacon("/api/v1/feedback", "blocked") === false);
      const form = document.createElement("form"); document.body.append(form);
      for (const action of [() => form.submit(), () => form.requestSubmit()]) { try { action(); blocked.push(false); } catch (error) { blocked.push((error as Error).name === "NotAllowedError"); } }
      form.remove(); return blocked;
    });
    expect(result.every(Boolean)).toBe(true);
    await clickCmsPreviewTransaction(preview, family);
    await expect(page.getByText(/Thao tác nghiệp vụ được tắt/)).toBeVisible();
    expect(observed).toEqual([]);
  });
});

test.describe("Isolated account governance browser API boundary", () => {
  test("real admin creates unverified fixture, confirms update and hold/restore", async ({ page, context }) => {
    const name = `Compte local ${Date.now()}`; const email = `cms-${Date.now()}@e2e.healthcare.local`;
    await page.goto(new URL("/admin/users", BASE_URL).href); await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    await page.getByLabel("Họ tên hiển thị", { exact: true }).fill(name); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel(/^Mật khẩu ban đầu/).fill("LocalFixture!2026"); await page.getByTestId("account-save").click();
    await expect(page.getByRole("dialog")).toContainText(email); await page.getByRole("dialog").getByRole("button", { name: "Tạo tài khoản", exact: true }).click(); await expect(page.getByRole("dialog")).toBeHidden(); await expect(page.getByTestId("account-detail")).toContainText("Chưa xác minh");
    const result = await api<AccountPage>(context.request, `/admin/users?q=${encodeURIComponent(email)}`); expect(result.content).toHaveLength(1); const created = result.content[0]; expect(created.emailVerified).toBe(false); expect(created.createdAt).not.toBeNull(); expect(created.roles).toEqual(["PATIENT"]);
    for (const [testId, timestamp] of [["account-created-at", created.createdAt!], ["account-updated-at", created.updatedAt]]) {
      const rendered = await page.getByTestId(testId).getAttribute("datetime");
      expect(rendered).not.toBeNull(); expect(timestamp).not.toBeNull();
      expect(Number.isFinite(Date.parse(rendered!))).toBe(true); expect(Number.isFinite(Date.parse(timestamp))).toBe(true);
      expect(Date.parse(rendered!)).toBe(Date.parse(timestamp));
    }
    await page.getByLabel("Họ tên hiển thị", { exact: true }).fill(`${name} cập nhật`); await page.getByTestId("account-save").click(); await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi", exact: true }).click(); await expect(page.getByRole("dialog")).toBeHidden();
    for (const [label, status] of [["Khóa tài khoản", "DISABLED"], ["Mở khóa tài khoản", "ACTIVE"]]) { await page.getByRole("button", { name: label, exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click(); await expect(page.getByRole("dialog")).toBeHidden(); expect((await api<AdminAccount>(context.request, `/admin/users/${created.id}`)).status).toBe(status); }
    const safe = await api<Record<string, unknown>>(context.request, `/admin/users/${created.id}`);
    expect(Object.keys(safe).sort()).toEqual(["createdAt", "demo", "displayName", "doctorProfile", "doctorProfileId", "email", "emailVerified", "emailVerifiedAt", "googleLinked", "id", "patientProfileId", "phone", "roles", "status", "updatedAt", "version"].sort());
    // No delete API is invented: this fixture is removed when controller disposes DATABASE.
  });
  for (const role of ["PATIENT", "DOCTOR", "DEMO_ADMIN"] as const) test(`${role} cannot read private CMS or mutate accounts`, async ({ browser, context: adminContext }) => {
    const context = await browser.newContext({ baseURL: BASE_URL });
    try {
      const page = await context.newPage(); await login(page, role);
      if (role !== "DEMO_ADMIN") {
        await api(context.request, "/admin/users", "GET", undefined, 403);
        await api(context.request, "/admin/cms/content/homepage.layout/draft", "GET", undefined, 403);
      }
      expect((await context.cookies()).some((cookie) => cookie.name === "__Host-healthcare_csrf" && cookie.value.length > 0), "Authenticated write needs its CSRF cookie").toBe(true);
      const before = await api<AdminAccount>(adminContext.request, `/admin/users/${actor.id}`);
      await api(context.request, `/admin/users/${actor.id}`, "PUT", { email: before.email, displayName: before.displayName, roles: before.roles, status: "DISABLED", unlinkDoctorProfile: false, expectedVersion: before.version, expectedUpdatedAt: before.updatedAt }, 403);
      expect(await api<AdminAccount>(adminContext.request, `/admin/users/${actor.id}`)).toEqual(before);
    } finally { await context.close(); }
  });
  test("anonymous cannot read or mutate draft/account and query cannot grant preview", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL });
    try {
      for (const endpoint of ["/admin/users", "/admin/cms/content/homepage.layout/draft"]) { const result = await context.request.get(new URL(`/api/v1${endpoint}`, BASE_URL).href); expect([401, 403]).toContain(result.status()); }
      const page = await context.newPage(); await page.goto(new URL(`/?cmsPreview=1&cmsChannel=${CHANNEL}`, BASE_URL).href); await expect(page.getByRole("alert").filter({ hasText: "Không thể mở bản nháp" })).toBeVisible(); await expect(page.locator('[data-cms-native-selected="true"]')).toHaveCount(0);
    } finally { await context.close(); }
  });
});
