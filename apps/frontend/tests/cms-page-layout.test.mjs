import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { CMS_PAGE_MANIFESTS, resolveCmsPageIdentity } from "../lib/cms-page-manifest.ts";

// Compile actual library modules with their real imports, without changing the app's bundler configuration.
const loaded = new Map();
function loadLibrary(name) {
  if (loaded.has(name)) return loaded.get(name);
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((id) => {
    assert.ok(id.startsWith("./"), `Unexpected library dependency: ${id}`);
    return loadLibrary(id.slice(2));
  }, loadedModule, loadedModule.exports);
  loaded.set(name, loadedModule.exports);
  return loadedModule.exports;
}
const { parseCmsPageLayout, createNativeCmsLayout, equalCmsPageLayouts } = loadLibrary("cms-page-layout");
const { CmsLayoutClient, parseCmsLayoutDraft, parseCmsLayoutPublication, fetchPublishedCmsLayout } = loadLibrary("cms-layout-client");
const { ApiError } = loadLibrary("api-client");
const home = resolveCmsPageIdentity("/");

const firstDoctor = "00000000-0000-4000-8000-000000000001";
const secondDoctor = "00000000-0000-4000-8000-000000000002";

test("canonical public manifest includes every family and unique stable field IDs", () => {
  const families = ["homepage", "about", "branches", "specialties", "doctors", "services", "packages", "articles", "careers", "search", "dat-lich", "contact", "faq", "huong-dan", "tra-cuu", "benh-pho-bien", "gop-y", "chinh-sach-bao-mat"];
  assert.deepEqual(CMS_PAGE_MANIFESTS.map((entry) => entry.family).sort(), families.sort());
  for (const manifest of CMS_PAGE_MANIFESTS) {
    assert.equal(resolveCmsPageIdentity(manifest.path).slotKey, `${manifest.family}.layout`);
    for (const sections of [manifest.sections, manifest.detailSections]) {
      assert.equal(new Set(sections.map((item) => item.id)).size, sections.length);
      const fields = sections.flatMap((section) => section.fields.map((field) => field.id));
      assert.equal(new Set(fields).size, fields.length);
      assert.ok(sections.every((section) => section.fields.every((field) => field.id.startsWith(`${section.id}.`))));
    }
  }
});

test("details and aliases bind actual UUIDs without family-wide factual overrides", () => {
  const canonical = resolveCmsPageIdentity("/doctors/doctor-a", firstDoctor);
  const alias = resolveCmsPageIdentity("/bac-si/doctor-a", firstDoctor);
  assert.equal(alias.slotKey, canonical.slotKey);
  assert.equal(alias.canonicalPath, "/doctors/doctor-a");
  assert.notEqual(canonical.slotKey, resolveCmsPageIdentity("/doctors/doctor-b", secondDoctor).slotKey);
  assert.equal(resolveCmsPageIdentity("/doctors/doctor-a"), null);
  assert.equal(resolveCmsPageIdentity("/doctors/doctor-a", "invented-doctor"), null);
  assert.equal(canonical.manifest.authorityHref, "/admin/doctors");
  assert.deepEqual(canonical.sections.find((section) => section.id === "profile").fields, []);
  assert.ok(!canonical.sections.flatMap((section) => section.fields).some((field) => /fullName|qualifications|price|medicalAdvice/.test(field.id)));
});

test("unsupported paths and private routes cannot acquire public layout identity", () => {
  for (const path of ["/admin", "/patient/profile", "/auth/login", "/about/invented", "/careers/invented", "/homepage", "/doctors/a/b", "//evil.example/doctors", "/doctors/%2e%2e", "/doctors/%2fadmin", "/doctors/%ZZ", "/about?x=1", "/about#x", "/about//"]) {
    assert.equal(resolveCmsPageIdentity(path, firstDoctor), null, path);
  }
  assert.equal(resolveCmsPageIdentity("/homepage"), null);
});

test("derived backend resource matches the native route, section and field declarations", () => {
  const resource = JSON.parse(readFileSync(new URL("../../backend/src/main/resources/cms-page-manifest.json", import.meta.url), "utf8"));
  assert.equal(resource.schemaVersion, 1);
  assert.deepEqual(resource.pages, CMS_PAGE_MANIFESTS);
});

test("every canonical and supported detail accepts native layout defaults", () => {
  for (const page of CMS_PAGE_MANIFESTS) {
    const identity = resolveCmsPageIdentity(page.path);
    assert.equal(parseCmsPageLayout(createNativeCmsLayout(identity), identity).schemaVersion, 1);
    if (page.supportsDetail) {
      const detail = resolveCmsPageIdentity(`${page.path}/test-entity`, firstDoctor);
      assert.equal(parseCmsPageLayout(createNativeCmsLayout(detail), detail).sectionOrder.length, page.detailSections.length);
    }
  }
});

test("sparse text, image and safe Markdown overrides preserve input and clear to native defaults", () => {
  const payload = createNativeCmsLayout(home);
  payload.fields["hero.title"] = { kind: "text", value: "Đồng hành cùng sức khỏe" };
  payload.fields["hero.image"] = { kind: "image", src: "https://images.unsplash.com/photo.jpg", alt: "" };
  payload.fields["hero.body"] = { kind: "rich", format: "markdown", value: "**Chăm sóc** <u>chủ động</u>\n> Chuẩn bị trước khi khám\n[Gọi](tel:115)\n![Ảnh](/media/a.jpg)" };
  const result = parseCmsPageLayout(payload, home);
  assert.equal(result.fields["hero.title"].value, payload.fields["hero.title"].value);
  assert.notEqual(result.fields, payload.fields);
  delete payload.fields["hero.title"];
  assert.equal(Object.hasOwn(parseCmsPageLayout(payload, home).fields, "hero.title"), false);
});

test("known movable sections can reorder without crossing fixed interactive boundaries", () => {
  const payload = createNativeCmsLayout(home);
  const care = payload.sectionOrder.indexOf("care");
  const packages = payload.sectionOrder.indexOf("packages");
  [payload.sectionOrder[care], payload.sectionOrder[packages]] = [payload.sectionOrder[packages], payload.sectionOrder[care]];
  assert.deepEqual(parseCmsPageLayout(payload, home).sectionOrder, payload.sectionOrder);
  for (const order of [
    [...payload.sectionOrder, "care"], payload.sectionOrder.slice(1),
    payload.sectionOrder.map((id) => id === "hero" ? "invented" : id),
    payload.sectionOrder.map((id) => id === "hero" ? "care" : id),
  ]) assert.throws(() => parseCmsPageLayout({ ...payload, sectionOrder: order }, home));
  const specialties = resolveCmsPageIdentity("/specialties");
  const mixed = createNativeCmsLayout(specialties);
  [mixed.sectionOrder[1], mixed.sectionOrder[4]] = [mixed.sectionOrder[4], mixed.sectionOrder[1]];
  assert.throws(() => parseCmsPageLayout(mixed, specialties), /vùng cố định/);
});

test("unknown fields, kinds, versions, keys and prototype shapes fail closed", () => {
  const original = createNativeCmsLayout(home);
  for (const payload of [
    { ...original, schemaVersion: 2 }, { ...original, html: "<script>bad</script>" },
    { ...original, fields: JSON.parse('{"__proto__":{"kind":"text","value":"x"}}') },
    { ...original, fields: { "hero.title": { kind: "rich", format: "markdown", value: "Kind changed" } } },
    { ...original, fields: { "hero.title": { kind: "text", value: "Title", onclick: "x" } } },
    { ...original, fields: Object.create({ "hero.title": { kind: "text", value: "Inherited" } }) },
  ]) assert.throws(() => parseCmsPageLayout(payload, home));
  const doctor = resolveCmsPageIdentity("/doctors/doctor-a", firstDoctor);
  const facts = createNativeCmsLayout(doctor);
  facts.fields["profile.fullName"] = { kind: "text", value: "Fabricated fact" };
  assert.throws(() => parseCmsPageLayout(facts, doctor));
});

test("unsafe Markdown, raw HTML, image hosts and encoded URL bypasses are rejected", () => {
  for (const value of [
    "<script>alert(1)</script>", "<u onclick='x'>bad</u>", "<u>unclosed",
    "[bad](javascript:alert(1))", "[bad](//evil.example)", "[bad](tel:112)",
    "![bad](https://evil.example/a.jpg)", "![bad](tel:115)", "[bad](/\\evil.example)",
    "[bad](https://user:pass@example.com)",
  ]) {
    const payload = createNativeCmsLayout(home);
    payload.fields["hero.body"] = { kind: "rich", format: "markdown", value };
    assert.throws(() => parseCmsPageLayout(payload, home), value);
  }
  for (const src of [
    "https://images.unsplash.com.evil.example/a.jpg", "https://images.unsplash.com:444/a.jpg",
    "data:image/png;base64,AAAA", "/media/a\nb.jpg", "tel:115",
  ]) {
    const payload = createNativeCmsLayout(home);
    payload.fields["hero.image"] = { kind: "image", src, alt: "Ảnh" };
    assert.throws(() => parseCmsPageLayout(payload, home), src);
  }
});

test("UTF-8 byte limit, per-field length and control characters apply before persistence", () => {
  for (const value of ["x".repeat(4_001), "unsafe\u0000text", "<b>raw</b>", "   "]) {
    const payload = createNativeCmsLayout(home);
    payload.fields["hero.title"] = { kind: "text", value };
    assert.throws(() => parseCmsPageLayout(payload, home));
  }
  const large = createNativeCmsLayout(home);
  for (const id of ["hero.title", "hero.eyebrow", "assurance.doctorTitle", "care.title"]) {
    large.fields[id] = { kind: "text", value: "漢".repeat(3_000) };
  }
  assert.throws(() => parseCmsPageLayout(large, home), /32 KiB/);
});

test("dirty equality ignores JSONB key order while retaining actual field and order changes", () => {
  const left = createNativeCmsLayout(home);
  left.fields = { "hero.title": { kind: "text", value: "Chăm sóc" }, "hero.image": { kind: "image", src: "/media/a.jpg", alt: "Ảnh" } };
  const right = JSON.parse(JSON.stringify(left));
  right.fields = { "hero.image": { alt: "Ảnh", src: "/media/a.jpg", kind: "image" }, "hero.title": { value: "Chăm sóc", kind: "text" } };
  assert.equal(equalCmsPageLayouts(left, right), true);
  right.fields["hero.image"].alt = "Mô tả mới";
  assert.equal(equalCmsPageLayouts(left, right), false);
  assert.equal(equalCmsPageLayouts(left, createNativeCmsLayout(home)), false);
});

function draftResponse(overrides = {}) {
  return { slotKey: home.slotKey, componentType: "PAGE_LAYOUT", expectedVersion: 4, hasDraft: true, payload: createNativeCmsLayout(home), draftUpdatedAt: "2026-10-09T01:00:00.000001Z", publicContent: null, ...overrides };
}
test("typed draft/public DTOs reject wrong identity, missing tokens and private publication", () => {
  const draft = parseCmsLayoutDraft(draftResponse(), home);
  assert.equal(draft.expectedVersion, 4);
  assert.equal(draft.draftUpdatedAt, "2026-10-09T01:00:00.000001Z");
  for (const change of [{ slotKey: "about.layout" }, { componentType: "HERO" }, { expectedVersion: 0 }, { hasDraft: "true" }, { draftUpdatedAt: "yesterday" }, { payload: { ...draft.payload, fields: { "unknown.title": { kind: "text", value: "x" } } } }]) {
    assert.throws(() => parseCmsLayoutDraft(draftResponse(change), home));
  }
  const publication = { slotKey: home.slotKey, componentType: "PAGE_LAYOUT", payload: draft.payload, status: "PUBLISHED", version: 2, updatedAt: "2026-10-09T00:00:00Z" };
  assert.equal(parseCmsLayoutPublication(publication, home).version, 2);
  assert.throws(() => parseCmsLayoutPublication({ ...publication, status: "DRAFT" }, home));
  assert.throws(() => parseCmsLayoutDraft(draftResponse({ publicContent: { ...publication, slotKey: "about.layout" } }), home));
});
test("professional writes use separate draft/publish/restore endpoints and exact optimistic tokens", async () => {
  const calls = [];
  const client = new CmsLayoutClient(async (path, init = {}) => { calls.push({ path, init }); return draftResponse(); });
  const payload = createNativeCmsLayout(home);
  payload.fields["hero.title"] = { kind: "text", value: "Nội dung chưa xuất bản" };
  await client.saveDraft(home, payload, 0);
  assert.equal(calls[0].path, "/admin/cms/content/homepage.layout/draft");
  assert.equal(calls[0].init.method, "PUT");
  assert.deepEqual(JSON.parse(calls[0].init.body), { componentType: "PAGE_LAYOUT", payload, expectedVersion: 0 });
  await client.publish(home, 4);
  assert.equal(calls[1].path.endsWith("/publish"), true);
  assert.deepEqual(JSON.parse(calls[1].init.body), { expectedVersion: 4 });
  await client.restore(home, 87, 4);
  assert.equal(calls[2].path.endsWith("/restore-draft"), true);
  assert.deepEqual(JSON.parse(calls[2].init.body), { changeId: 87, expectedVersion: 4 });
  await assert.rejects(client.publish(home, 0));
  await assert.rejects(client.saveDraft(home, { ...payload, fields: { "profile.fullName": { kind: "text", value: "wrong" } } }, 4));
  assert.equal(calls.length, 3, "Invalid writes must not reach transport");
});
test("missing first draft alone keeps native fallback; conflict/auth/network errors propagate without altering edits", async () => {
  const missing = new CmsLayoutClient(async () => { throw new ApiError("Missing", 404, "test"); });
  assert.equal((await missing.getDraft(home)).expectedVersion, 0);
  const edits = createNativeCmsLayout(home);
  edits.fields["hero.title"] = { kind: "text", value: "Giữ nguyên nội dung" };
  const before = JSON.stringify(edits);
  for (const status of [401, 403, 409, 500]) {
    const cause = new ApiError("Rejected", status, "test");
    const client = new CmsLayoutClient(async () => { throw cause; });
    await assert.rejects(client.getDraft(home), (error) => error === cause);
    await assert.rejects(client.saveDraft(home, edits, 4), (error) => error === cause);
  }
  assert.equal(JSON.stringify(edits), before);
});
test("history binds the exact slot, bounded snapshots and event identity", async () => {
  const row = { slotKey: home.slotKey, componentType: "PAGE_LAYOUT", eventId: 87, version: 3, payload: createNativeCmsLayout(home), status: "DRAFT", actorEmail: "admin@example.test", changedAt: "2026-10-09T00:00:00Z" };
  const client = new CmsLayoutClient(async (path) => { assert.equal(path, "/admin/cms/content/homepage.layout/history?limit=50"); return [row]; });
  assert.equal((await client.history(home))[0].eventId, 87);
  for (const rows of [[{ ...row, eventId: 0 }], [{ ...row, slotKey: "about.layout" }], Array(51).fill(row)]) await assert.rejects(new CmsLayoutClient(async () => rows).history(home));
});
test("public layout transport requests only published content with no-store and respects missing content/abort", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  try {
    globalThis.fetch = async (path, init) => {
      assert.equal(path, "/api/v1/cms/content/homepage.layout");
      assert.equal(init.credentials, "same-origin");
      assert.equal(init.cache, "no-store");
      assert.equal(init.signal.aborted, false);
      return new Response(null, { status: 404 });
    };
    assert.equal(await fetchPublishedCmsLayout(home, controller.signal), null);
    controller.abort();
    globalThis.fetch = async (_path, init) => { assert.equal(init.signal.aborted, true); throw new DOMException("Aborted", "AbortError"); };
    await assert.rejects(fetchPublishedCmsLayout(home, controller.signal), { name: "AbortError" });
  } finally { globalThis.fetch = original; }
});
