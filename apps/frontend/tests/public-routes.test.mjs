import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const EXPECTED_CMS_PUBLIC_ROUTE_SLUGS = [
  "about",
  "branches",
  "specialties",
  "doctors",
  "services",
  "packages",
  "articles",
  "careers",
  "search",
  "dat-lich",
  "contact",
  "faq",
  "huong-dan",
  "tra-cuu",
];

const PRIVATE_OR_LEGACY_ALIAS_ROUTE_SLUGS = [
  "admin",
  "auth",
  "doctor",
  "patient",
  "bac-si",
  "chuyen-khoa",
  "goi-kham",
];

function extractQuotedStrings(source, label, pattern) {
  const match = source.match(pattern);
  assert.ok(match, `missing ${label}`);
  return Array.from(match[1].matchAll(/"([^"]+)"/g), ([, value]) => value);
}

function extractTsSlotComponentMap(source) {
  const match = source.match(
    /CMS_SLOT_COMPONENT_TYPES\s*=\s*\{([\s\S]*?)\}\s*as const satisfies Record<CmsSlotKey, readonly CmsComponentType\[\]>;/,
  );
  assert.ok(match, "missing frontend CMS slot component map");
  const block = match[1];
  const map = {};

  for (const slot of ["hero", "body", "sidebar", "footer"]) {
    const slotMatch = block.match(new RegExp(`${slot}:\\s*\\[([^\\]]+)\\]`));
    assert.ok(slotMatch, `missing frontend slot components for ${slot}`);
    map[slot] = Array.from(slotMatch[1].matchAll(/"([^"]+)"/g), ([, value]) => value);
  }

  return map;
}

function extractJavaSlotComponentMap(source) {
  const match = source.match(/CMS_SLOT_COMPONENT_TYPES\s*=\s*Map\.of\(([\s\S]*?)\);/);
  assert.ok(match, "missing backend CMS slot component map");
  const block = match[1];
  const map = {};

  for (const slot of ["hero", "body", "sidebar", "footer"]) {
    const slotMatch = block.match(new RegExp(`"${slot}"\\s*,\\s*Set\\.of\\(([^\\)]+)\\)`));
    assert.ok(slotMatch, `missing backend slot components for ${slot}`);
    map[slot] = Array.from(slotMatch[1].matchAll(/CmsComponentType\.([A-Z_]+)/g), ([, value]) => value);
  }

  return map;
}

function extractSqlRouteInventory(source) {
  const match = source.match(/allowed_public_slot_key CONSTANT TEXT :=\s*'\^\(([^)]+)\)\\\.\(([^)]+)\)\$';/);
  assert.ok(match, "missing V23 public slot regex");
  return {
    routes: match[1].split("|"),
    slots: match[2].split("|"),
  };
}

function sqlSlotPattern(slotKey, components) {
  const slotClause = `split_part\\(slot_key, '\\.', 2\\)\\s*=\\s*'${slotKey}'`;
  if (components.length === 1) {
    return new RegExp(`${slotClause}\\s+AND\\s+component_type\\s*=\\s*'${components[0]}'`, "g");
  }
  const componentClause = components.map((component) => `'${component}'`).join("\\s*,\\s*");
  return new RegExp(`${slotClause}\\s+AND\\s+component_type\\s+IN\\s+\\(${componentClause}\\)`, "g");
}

test("canonical resource details clear stale records and expose complete async states", async () => {
  const routes = [
    ["app/doctors/[slug]/page.tsx", "setDoctor(null)"],
    ["app/specialties/[slug]/page.tsx", "setSpecialty(null)"],
    ["app/packages/[slug]/page.tsx", "setItem(null)"],
    ["app/services/[slug]/page.tsx", "setService(null)"],
    ["app/branches/[slug]/page.tsx", "setBranch(null)"],
    ["app/articles/[slug]/page.tsx", "setArticle(null)"],
  ];

  for (const [path, clearMarker] of routes) {
    const source = await read(path);
    assert.match(source, /catalog-status--loading/);
    assert.match(source, /catalog-status--error/);
    assert.match(source, /Không tìm thấy/);
    assert.match(source, new RegExp(clearMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("paginated catalog routes clear stale pages before a retry", async () => {
  const routes = [
    ["app/specialties/page.tsx", "setPage(null)"],
    ["app/services/page.tsx", "setPage(null)"],
    ["app/packages/page.tsx", "setPage(null)"],
    ["app/branches/page.tsx", "setPage(null)"],
    ["app/articles/page.tsx", "setPage(null)"],
  ];

  for (const [path, clearMarker] of routes) {
    const source = await read(path);
    assert.match(source, /catalog-status--error/);
    assert.match(source, new RegExp(clearMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("health knowledge and booking guidance surfaces provide bounded retry actions", async () => {
  const [articles, articleDetail, faq, guidance] = await Promise.all([
    read("app/articles/page.tsx"),
    read("app/articles/[slug]/page.tsx"),
    read("app/faq/page.tsx"),
    read("app/huong-dan/page.tsx"),
  ]);

  for (const source of [articles, articleDetail, faq, guidance]) {
    assert.match(source, /retryCount/);
    assert.match(source, /Thử tải lại/);
    assert.match(source, /outline-button--small/);
  }
  assert.match(articles, /Tạm thời chưa thể tải bài viết/);
  assert.match(faq, /Tạm thời chưa thể tải câu hỏi thường gặp/);
});

test("contact and guidance pages do not invent branch, insurance, or FAQ data", async () => {
  const [contact, guidance, about] = await Promise.all([
    read("app/contact/page.tsx"),
    read("app/huong-dan/page.tsx"),
    read("app/about/page.tsx"),
  ]);

  assert.match(contact, /fetchBranches/);
  assert.match(contact, /resource-hero-card--teal/);
  assert.match(contact, /PublicAiButton/);
  assert.match(contact, /resource-meta-grid/);
  assert.match(contact, /resource-step-card/);
  assert.match(contact, /catalog-grid--branches/);
  assert.match(contact, /catalog-status--loading/);
  assert.match(contact, /Thông tin cơ sở đang được cập nhật/);
  assert.doesNotMatch(contact, /1900 1234/);
  assert.match(guidance, /fetchFaqs/);
  assert.match(guidance, /fetchBranches/);
  assert.doesNotMatch(guidance, /insurancePartners|Đối tác bảo hiểm/);
  assert.match(about, /fetchDoctors/);
  assert.match(about, /Mạng lưới HealthCare/);
  assert.match(about, /about-introduction\.mp4/);
  assert.match(about, /Thước phim giới thiệu/);
  assert.match(about, /autoPlay/);
  assert.match(about, /disablePictureInPicture/);
  assert.doesNotMatch(about, /\scontrols(?:\s|>|=)/);
});

test("faq page now behaves like a support hub instead of a bare list", async () => {
  const faq = await read("app/faq/page.tsx");

  assert.match(faq, /resource-hero-card--teal/);
  assert.match(faq, /PublicAiButton/);
  assert.match(faq, /resource-meta-grid/);
  assert.match(faq, /resource-step-card/);
  assert.match(faq, /catalog-meta/);
  assert.match(faq, /faq-list/);
  assert.match(faq, /Liên hệ bệnh viện/);
});

test("Vietnamese legacy aliases redirect to canonical detail routes", async () => {
  const [doctorAlias, specialtyAlias, packageAlias] = await Promise.all([
    read("app/bac-si/[slug]/page.tsx"),
    read("app/chuyen-khoa/[slug]/page.tsx"),
    read("app/goi-kham/[slug]/page.tsx"),
  ]);

  for (const [source, destination] of [
    [doctorAlias, "/doctors/"],
    [specialtyAlias, "/specialties/"],
    [packageAlias, "/packages/"],
  ]) {
    assert.match(source, /Compatibility alias for old Vietnamese links/);
    assert.match(source, /redirect\(`/);
    assert.match(source, /encodeURIComponent\(slug\)/);
    assert.match(source, new RegExp(destination.replace("/", "\\/")));
  }
});

test("booking landing page now opens as a clear support-aware route", async () => {
  const booking = await read("app/dat-lich/page.tsx");

  assert.match(booking, /onBookingRequest/);
  assert.match(booking, /BookingInlineExperience/);
  assert.match(booking, /booking-page__inline--primary/);
  assert.doesNotMatch(booking, /resource-hero-card--teal/);
  assert.match(booking, /PublicAiButton/);
  assert.match(booking, /booking-page__support/);
  assert.match(booking, /booking-stage-card/);
  assert.match(booking, /catalog-grid--branches/);
  assert.match(booking, /Chọn chuyên khoa/);
  assert.doesNotMatch(booking, /Hỏi trợ lý AI/);
});

test("appointment lookup page now behaves like a patient tracking hub", async () => {
  const tracking = await read("app/tra-cuu/page.tsx");

  assert.match(tracking, /resource-hero-card--teal/);
  assert.match(tracking, /PublicBookingButton/);
  assert.match(tracking, /PublicAiButton/);
  assert.match(tracking, /resource-meta-grid/);
  assert.match(tracking, /resource-step-card/);
  assert.match(tracking, /TRACKING_STEPS/);
  assert.match(tracking, /LOOKUP_TIMEOUT_MS/);
  assert.match(tracking, /fetchWithTimeout/);
  assert.match(tracking, /AbortController/);
  assert.match(tracking, /cache: "no-store"/);
  assert.match(tracking, /encodeURIComponent/);
});

test("search page now behaves like a guided discovery hub with bounded AI results", async () => {
  const search = await read("app/search/SearchPageClient.tsx");

  assert.match(search, /resource-hero-card--teal/);
  assert.match(search, /PublicBookingButton/);
  assert.match(search, /PublicAiButton/);
  assert.match(search, /resource-meta-grid/);
  assert.match(search, /SEARCH_GUIDE_STEPS/);
  assert.match(search, /resource-step-card/);
  assert.match(search, /Gợi ý thông minh có nguồn tham khảo/);
  assert.match(search, /semanticScoreLabel/);
  assert.match(search, /citationLabel/);
  assert.match(search, /Nguồn gợi ý/);
  assert.match(search, /không thay thế tư vấn y khoa hoặc chẩn đoán/);
  assert.equal(search.includes("href={`/${item.source_type}"), false);
});

test("branches page now behaves like a network hub", async () => {
  const branches = await read("app/branches/page.tsx");

  assert.match(branches, /BranchesPage\.module\.css/);
  assert.match(branches, /networkOverview/);
  assert.match(branches, /networkSummary/);
  assert.match(branches, /featuredContact/);
  assert.match(branches, /PublicBookingButton/);
  assert.match(branches, /PublicAiButton/);
  assert.match(branches, /catalog-grid--branches/);
  assert.match(branches, /safeTelephoneHref/);
  assert.match(branches, /BranchMap/);
});

test("packages page now behaves like a selection hub", async () => {
  const packages = await read("app/packages/page.tsx");

  assert.match(packages, /resource-hero-card--teal/);
  assert.match(packages, /PublicBookingButton/);
  assert.match(packages, /PublicAiButton/);
  assert.match(packages, /resource-meta-grid/);
  assert.match(packages, /resource-step-card/);
  assert.match(packages, /catalogGrid/);
  assert.match(packages, /catalogGuide/);
});

test("package detail page now behaves like a package detail hub", async () => {
  const packageDetail = await read("app/packages/[slug]/page.tsx");

  assert.match(packageDetail, /PublicAiButton/);
  assert.match(packageDetail, /PublicBookingButton/);
  assert.match(packageDetail, /resource-panel--wide/);
  assert.match(packageDetail, /resource-step-card/);
  assert.match(packageDetail, /PACKAGE_DETAIL_STEPS/);
  assert.match(packageDetail, /packageId: item\.id/);
  assert.match(packageDetail, /detailCredit/);
});

test("specialties page now behaves like a choice-and-triage hub", async () => {
  const specialties = await read("app/specialties/page.tsx");

  assert.match(specialties, /resource-hero-card--teal/);
  assert.match(specialties, /PublicAiButton/);
  assert.match(specialties, /PublicBookingButton/);
  assert.match(specialties, /resource-meta-grid/);
  assert.match(specialties, /resource-step-card/);
  assert.match(specialties, /catalog-grid--specialties/);
  assert.match(specialties, /PublicBackLink/);
});

test("specialty detail page now behaves like a specialty detail hub", async () => {
  const specialty = await read("app/specialties/[slug]/page.tsx");

  assert.match(specialty, /resource-hero-card--teal/);
  assert.match(specialty, /PublicAiButton/);
  assert.match(specialty, /PublicBookingButton/);
  assert.match(specialty, /resource-meta-grid/);
  assert.match(specialty, /resource-step-card/);
  assert.match(specialty, /SPECIALTY_STEPS/);
  assert.match(specialty, /relatedDoctorCount/);
  assert.match(specialty, /relatedDoctors/);
});

test("services page now behaves like a service selection hub", async () => {
  const services = await read("app/services/page.tsx");

  assert.match(services, /resource-hero-card--teal/);
  assert.match(services, /PublicAiButton/);
  assert.match(services, /PublicBookingButton/);
  assert.match(services, /resource-meta-grid/);
  assert.match(services, /resource-step-card/);
  assert.match(services, /catalog-grid/);
  assert.match(services, /ClinicalIcon/);
});

test("service detail page now behaves like a service detail hub", async () => {
  const service = await read("app/services/[slug]/page.tsx");

  assert.match(service, /resource-hero-card--teal/);
  assert.match(service, /PublicAiButton/);
  assert.match(service, /PublicBookingButton/);
  assert.match(service, /resource-meta-grid/);
  assert.match(service, /resource-step-card/);
  assert.match(service, /SERVICE_STEPS/);
  assert.match(service, /Xem gói khám liên quan/);
});

test("doctor detail page now behaves like a doctor detail hub", async () => {
  const doctor = await read("app/doctors/[slug]/page.tsx");

  assert.match(doctor, /resource-hero-card--teal/);
  assert.match(doctor, /PublicAiButton/);
  assert.match(doctor, /PublicBookingButton/);
  assert.match(doctor, /resource-meta-grid/);
  assert.match(doctor, /resource-step-card/);
  assert.match(doctor, /DOCTOR_STEPS/);
  assert.match(doctor, /branchNames/);
  assert.match(doctor, /Khám phá chuyên khoa/);
});

test("doctors page now behaves like a doctor selection hub", async () => {
  const doctors = await read("app/doctors/DoctorsPageClient.tsx");

  assert.match(doctors, /resource-hero-card--teal/);
  assert.match(doctors, /PublicAiButton/);
  assert.match(doctors, /PublicBookingButton/);
  assert.match(doctors, /resource-meta-grid/);
  assert.match(doctors, /resource-step-card/);
  assert.match(doctors, /catalog-grid--doctors/);
  assert.match(doctors, /resource-chip-row/);
});

test("articles page now behaves like a health knowledge hub", async () => {
  const [articles, icons] = await Promise.all([
    read("app/articles/page.tsx"),
    read("components/ClinicalIcon.tsx"),
  ]);

  assert.match(articles, /resource-hero-card--teal/);
  assert.match(articles, /PublicAiButton/);
  assert.match(articles, /PublicBookingButton/);
  assert.match(articles, /resource-meta-grid/);
  assert.match(articles, /resource-step-card/);
  assert.match(articles, /catalog-grid--articles/);
  assert.match(articles, /ClinicalIcon name="article"/);
  assert.match(icons, /"article"/);
});

test("article detail page now behaves like a health knowledge detail hub", async () => {
  const article = await read("app/articles/[slug]/page.tsx");

  assert.match(article, /resource-hero-card--teal/);
  assert.match(article, /PublicAiButton/);
  assert.match(article, /PublicBookingButton/);
  assert.match(article, /resource-meta-grid/);
  assert.match(article, /resource-step-card/);
  assert.match(article, /ARTICLE_STEPS/);
  assert.match(article, /ClinicalIcon name="article"/);
  assert.match(article, /article-detail-card__sections/);
  assert.match(article, /relatedSpecialtySlug/);
});

test("public phone actions validate backend values before creating tel links", async () => {
  const sources = await Promise.all([
    read("lib/phone.ts"),
    read("components/Navbar.tsx"),
    read("components/Footer.tsx"),
    read("app/page.tsx"),
    read("app/branches/[slug]/page.tsx"),
    read("app/branches/page.tsx"),
    read("app/contact/page.tsx"),
  ]);

  assert.match(sources[0], /safeTelephoneHref/);
  assert.match(sources[0], /\^\\\+\?\[0-9\]/);
  for (const source of sources.slice(1)) {
    assert.match(source, /safeTelephoneHref/);
    assert.doesNotMatch(source, /href=.*tel:\$\{|replace\(\/\\\\s\/g/);
  }
});

test("homepage exposes a distinct unavailable catalog state with a retry path", async () => {
  const home = await read("app/page.tsx");
  assert.match(home, /catalogUnavailable/);
  assert.match(home, /catalog-status--unavailable/);
  assert.match(home, /Thử tải lại/);
  assert.match(home, /error\.status >= 500/);
  assert.match(home, /setCatalog\(null\)/);
});

test("CMS booking CTA has a real landing route and public chrome avoids invented hotlines", async () => {
  const [booking, navbar, footer, home, seed, largeSeed] = await Promise.all([
    read("app/dat-lich/page.tsx"),
    read("components/Navbar.tsx"),
    read("components/Footer.tsx"),
    read("app/page.tsx"),
    read("../backend/src/main/resources/db/seed/seed-local-data.sql"),
    read("../backend/src/main/resources/db/seed/seed-large-data.sql"),
  ]);

  assert.match(booking, /PublicBookingButton/);
  assert.match(seed, /ctaHref.*\/dat-lich/);
  assert.match(footer, /href="\/chinh-sach-bao-mat"/);
  for (const source of [navbar, footer, home]) assert.doesNotMatch(source, /1900\s*1234|contact@healthcare\.vn/);
  assert.match(navbar, /Xem giờ làm việc/);
  assert.match(footer, /Thông tin điện thoại đang được cập nhật/);
  assert.match(largeSeed, /homepage\.hero/);
  for (const seedContent of [seed, largeSeed]) assert.match(seedContent, /\/careers#vi-tri-dang-tuyen/);
  for (const slot of ["careers.hero", "careers.body", "search.hero", "homepage.body"]) {
    assert.match(largeSeed, new RegExp(slot.replace(".", "\\.")));
  }
});

test("AI and CMS live boundaries fail closed across reconnect and unresolved results", async () => {
  const [client, liveSlot, tracking, bookingModal, doctors, specialties, branchDetail, home] = await Promise.all([
    read("lib/api-client.ts"),
    read("components/cms/CmsLiveSlot.tsx"),
    read("app/tra-cuu/page.tsx"),
    read("components/BookingModal.tsx"),
    read("app/doctors/DoctorsPageClient.tsx"),
    read("app/specialties/page.tsx"),
    read("app/branches/[slug]/page.tsx"),
    read("app/page.tsx"),
  ]);

  assert.match(client, /result\.specialtyResolution === "RESOLVED"/);
  assert.match(liveSlot, /after: reconciliation\.latestEventId/);
  assert.match(liveSlot, /CmsReconciliationLedger/);
  assert.match(liveSlot, /reconciliation\.observe/);
  assert.match(liveSlot, /pendingEventIds/);
  assert.match(liveSlot, /resolvePendingEvent/);
  assert.match(liveSlot, /result === "failed" && !cancelled/);
  assert.match(liveSlot, /Đã đồng bộ/);
  assert.match(liveSlot, /cms-live-slot__fallback-note/);
  assert.match(liveSlot, /Đang hiển thị giao diện có sẵn/);
  assert.doesNotMatch(tracking, /30 đơn vị|15 phút|Hỗ trợ BHYT|Thẻ BHYT/);
  assert.match(tracking, /lookupRequestRef/);
  assert.match(tracking, /PublicPageShell/);
  assert.match(bookingModal, /bookingSessionRef/);
  assert.match(bookingModal, /business-time/);
  assert.match(bookingModal, /businessDate\(1\)/);
  assert.match(bookingModal, /setConfirmedAppointment\(null\)/);
  assert.match(doctors, /specialtySlug/);
  assert.match(doctors, /specialtySlug/);
  assert.match(doctors, /PublicPageShell/);
  assert.match(specialties, /PublicBookingButton/);
  assert.match(specialties, /PublicPageShell/);
  assert.match(branchDetail, /phoneHref/);
  assert.match(home, /safeTelephoneHref\(branch\.phone\)/);
  assert.match(home, /setIsAiTriageOpen\(true\)/);
  assert.match(home, /Gợi ý chuyên khoa/);
  assert.match(tracking, /useDialogFocus/);
  assert.match(tracking, /role="dialog"/);
  assert.match(tracking, /cancel-dialog-title/);
  assert.match(tracking, /const requestId = \+\+lookupRequestRef\.current;[\s\S]*setAppointment\(null\)/);
});

test("published article detail consumes the backend body when available", async () => {
  const [detail, types, response, service] = await Promise.all([
    read("app/articles/[slug]/page.tsx"),
    read("types/hospital.ts"),
    read("../backend/src/main/java/com/healthcare/hospital/dto/ArticleResponse.java"),
    read("../backend/src/main/java/com/healthcare/hospital/service/ArticleService.java"),
  ]);

  assert.match(types, /body\?: string/);
  assert.match(response, /String body/);
  assert.match(service, /article\.getBody\(\)/);
  assert.match(detail, /article\?\.body/);
  assert.match(detail, /article-detail-card__body/);
});

test("Stitch detail screens render backend-owned structured content", async () => {
  const [packageDetail, articleDetail, branchDetail, specialtyDetail, types, migration] = await Promise.all([
    read("app/packages/[slug]/page.tsx"),
    read("app/articles/[slug]/page.tsx"),
    read("app/branches/[slug]/page.tsx"),
    read("app/specialties/[slug]/page.tsx"),
    read("types/hospital.ts"),
    read("../backend/src/main/resources/db/migration/V15__expand_stitch_content_contracts.sql"),
  ]);

  assert.match(packageDetail, /targetAudience/);
  assert.match(packageDetail, /preparationSteps/);
  assert.match(articleDetail, /structuredSections/);
  assert.match(articleDetail, /relatedSpecialtySlug/);
  assert.match(branchDetail, /branch\.amenities/);
  assert.match(branchDetail, /branch\.doctors/);
  assert.match(specialtyDetail, /commonSymptoms/);
  assert.match(specialtyDetail, /relatedDoctors/);
  for (const field of ["targetAudience", "preparationSteps", "relatedSpecialtySlug", "amenities", "relatedDoctors"]) {
    assert.match(types, new RegExp(field));
  }
  assert.match(migration, /ADD COLUMN IF NOT EXISTS sections/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS care_pathway/);
});

test("Stitch search and careers screens have live public route owners", async () => {
  const [search, careers, footer, home, lookup] = await Promise.all([
    read("app/search/SearchPageClient.tsx"),
    read("app/careers/page.tsx"),
    read("components/Footer.tsx"),
    read("app/page.tsx"),
    read("app/tra-cuu/page.tsx"),
  ]);

  for (const marker of ["fetchSpecialties", "fetchDoctors", "fetchServices", "fetchPackages", "fetchArticles", "Promise.allSettled", "settledContent"]) {
    assert.ok(search.includes(marker), `missing live search marker: ${marker}`);
  }
  assert.match(search, /\/search\?q=/);
  assert.match(careers, /Cơ hội nghề nghiệp tại HealthCare/);
  assert.match(careers, /fetchCareerPositions/);
  assert.match(careers, /PublicPageShell/);
  assert.match(careers, /CmsLiveSlot/);
  assert.match(careers, /slug="careers"/);
  assert.match(careers, /slotKey="hero"/);
  assert.match(careers, /slotKey="body"/);
  assert.match(footer, /href="\/careers"/);
  assert.match(home, /router\.push/);
  assert.match(home, /data-cms-managed/);
  assert.match(home, /CmsContentRenderer/);
  assert.match(lookup, /appointments\/\$\{encodeURIComponent\(bookingCodeInput\.trim\(\)\)\}/);
  assert.match(lookup, /cache: "no-store"/);
});

test("every public page family keeps the route-level CMS composition point", async () => {
  const [routeCms, footer] = await Promise.all([
    read("components/cms/RouteCmsSlots.tsx"),
    read("components/Footer.tsx"),
  ]);

  assert.match(routeCms, /CMS_PUBLIC_ROUTE_SLUGS/);
  assert.match(routeCms, /PUBLIC_CMS_ROUTES\.has\(route\)/);
  assert.match(routeCms, /Careers owns its hero/);
  assert.match(routeCms, /Dynamic detail/);
  for (const slot of ["hero", "body", "sidebar"]) {
    assert.match(routeCms, new RegExp(`slotKey="${slot}"`));
  }
  assert.match(footer, /cmsSlug\?/);
  assert.match(footer, /slotKey="footer"/);
  for (const href of ["/specialties", "/packages", "/doctors", "/branches"]) {
    assert.match(footer, new RegExp(`href="${href}"`));
  }
  assert.doesNotMatch(footer, /href="\/#(?:specialties|packages|doctors|branches)"/);
});

test("CMS route inventory stays aligned across frontend admin, public shell, and backend", async () => {
  const [client, routeCms, editor, backendSlotKeys] = await Promise.all([
    read("lib/cms-client.ts"),
    read("components/cms/RouteCmsSlots.tsx"),
    read("components/cms/CmsEditor.tsx"),
    read("../backend/src/main/java/com/healthcare/cms/service/CmsPublicSlotKeys.java"),
  ]);

  const frontendRoutes = extractQuotedStrings(
    client,
    "CMS_PUBLIC_ROUTE_SLUGS",
    /CMS_PUBLIC_ROUTE_SLUGS\s*=\s*\[([\s\S]*?)\]\s+as const/,
  );
  const backendRoutes = extractQuotedStrings(
    backendSlotKeys,
    "CMS_PUBLIC_ROUTE_KEYS",
    /CMS_PUBLIC_ROUTE_KEYS\s*=\s*Set\.of\(([\s\S]*?)\);/,
  );

  assert.deepEqual(frontendRoutes, EXPECTED_CMS_PUBLIC_ROUTE_SLUGS);
  assert.ok(backendRoutes.includes("homepage"), "backend must keep homepage slot support");
  assert.deepEqual(
    backendRoutes.filter((route) => route !== "homepage"),
    EXPECTED_CMS_PUBLIC_ROUTE_SLUGS,
  );
  assert.match(routeCms, /new Set\(CMS_PUBLIC_ROUTE_SLUGS\)/);
  assert.match(editor, /\["home", \.\.\.CMS_PUBLIC_ROUTE_SLUGS\] as const/);

  for (const route of PRIVATE_OR_LEGACY_ALIAS_ROUTE_SLUGS) {
    assert.ok(!frontendRoutes.includes(route), `frontend CMS route list must not expose ${route}`);
    assert.ok(!backendRoutes.includes(route), `backend CMS route list must not expose ${route}`);
  }
});

test("CMS slot-component and migration contracts stay aligned across frontend, backend, and SQL", async () => {
  const [client, backendSlotKeys, v23, v24] = await Promise.all([
    read("lib/cms-client.ts"),
    read("../backend/src/main/java/com/healthcare/cms/service/CmsPublicSlotKeys.java"),
    read("../backend/src/main/resources/db/migration/V23__restrict_public_cms_slot_keys.sql"),
    read("../backend/src/main/resources/db/migration/V24__cms_slot_component_contract.sql"),
  ]);

  const frontendSlotMap = extractTsSlotComponentMap(client);
  const backendSlotMap = extractJavaSlotComponentMap(backendSlotKeys);
  const { routes: v23Routes, slots: v23Slots } = extractSqlRouteInventory(v23);

  assert.deepEqual(frontendSlotMap, backendSlotMap);
  assert.deepEqual(v23Routes, ["homepage", ...EXPECTED_CMS_PUBLIC_ROUTE_SLUGS]);
  assert.deepEqual(v23Slots, ["hero", "body", "sidebar", "footer"]);

  for (const [slotKey, components] of Object.entries(backendSlotMap)) {
    const pattern = sqlSlotPattern(slotKey, components);
    const occurrences = v24.match(pattern) ?? [];
    assert.ok(
      occurrences.length >= 2,
      `V24 slot contract for ${slotKey} should appear in preflight and constraint sections`,
    );
  }
});

test("doctor portal exposes the typed clinical write workflow", async () => {
  const [dashboard, appointments, client, controller, service] = await Promise.all([
    read("app/doctor/dashboard/page.tsx"),
    read("components/PortalAppointments.tsx"),
    read("lib/api-client.ts"),
    read("../backend/src/main/java/com/healthcare/clinical/controller/ClinicalController.java"),
    read("../backend/src/main/java/com/healthcare/clinical/service/ClinicalService.java"),
  ]);

  assert.match(dashboard, /fetchDoctorProfile/);
  assert.match(dashboard, /createMedicalRecord/);
  assert.match(dashboard, /Ghi nhận kết quả khám/);
  assert.match(appointments, /onSelectAppointment/);
  assert.match(client, /POST/);
  assert.match(client, /"\/clinical\/records"/);
  assert.match(controller, /@PostMapping\("\/records"\)/);
  assert.match(service, /appointment\.setStatus\(AppointmentStatus\.COMPLETED\)/);
});

test("catalog surfaces use the shared clinical icon family", async () => {
  const [icon, specialties, specialtyDetail, branches, branchDetail, services, serviceDetail, styles] = await Promise.all([
    read("components/ClinicalIcon.tsx"),
    read("app/specialties/page.tsx"),
    read("app/specialties/[slug]/page.tsx"),
    read("app/branches/page.tsx"),
    read("app/branches/[slug]/page.tsx"),
    read("app/services/page.tsx"),
    read("app/services/[slug]/page.tsx"),
    read("app/styles.css"),
  ]);

  for (const source of [specialties, specialtyDetail, branches, branchDetail, services, serviceDetail]) {
    assert.match(source, /ClinicalIcon/);
    assert.doesNotMatch(source, /[❤️🧠🫀👁️🦴🌸👶🫁🦷👂⌖✚]/u);
  }
  assert.match(icon, /ClinicalIconName/);
  assert.match(styles, /--color-amber-dark/);
  assert.doesNotMatch(styles, /--color-amber-700/);
});

test("booking, AI, and appointment tracking states use the icon family", async () => {
  const [icons, booking, triage, tracking, styles] = await Promise.all([
    read("components/UiIcon.tsx"),
    read("components/BookingModal.tsx"),
    read("components/AiTriageModal.tsx"),
    read("app/tra-cuu/page.tsx"),
    read("app/styles.css"),
  ]);

  for (const source of [booking, triage, tracking]) {
    assert.doesNotMatch(source, /[🟢⚪⏳💡⚠️🔍📞📧📅🏥👨‍⚕️📌🖨️]/u);
  }
  for (const marker of ["alert-triangle", "mail", "printer", "clock", "search"]) {
    assert.match(icons, new RegExp(marker));
  }
  for (const source of [booking, triage, tracking, styles]) {
    assert.doesNotMatch(source, /gradient/);
  }
});
