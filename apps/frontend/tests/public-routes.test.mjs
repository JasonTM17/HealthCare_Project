import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

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

test("contact and guidance pages do not invent branch, insurance, or FAQ data", async () => {
  const [contact, guidance, about] = await Promise.all([
    read("app/contact/page.tsx"),
    read("app/huong-dan/page.tsx"),
    read("app/about/page.tsx"),
  ]);

  assert.match(contact, /fetchBranches/);
  assert.match(contact, /catalog-status--loading/);
  assert.match(contact, /Backend chưa có cơ sở active/);
  assert.doesNotMatch(contact, /1900 1234/);
  assert.match(guidance, /fetchFaqs/);
  assert.match(guidance, /fetchBranches/);
  assert.doesNotMatch(guidance, /insurancePartners|Đối tác bảo hiểm/);
  assert.match(about, /fetchDoctors/);
  assert.match(about, /Snapshot catalog/);
});

test("homepage exposes a distinct unavailable catalog state with a retry path", async () => {
  const home = await read("app/page.tsx");
  assert.match(home, /catalogUnavailable/);
  assert.match(home, /catalog-status--unavailable/);
  assert.match(home, /Thử tải lại/);
  assert.match(home, /error\.status >= 500/);
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
  for (const source of [navbar, footer, home]) assert.doesNotMatch(source, /1900\s*1234|contact@healthcare\.vn/);
  assert.match(navbar, /Giờ làm việc từ backend/);
  assert.match(footer, /Backend chưa cung cấp số điện thoại/);
  assert.match(largeSeed, /homepage\.hero/);
  for (const slot of ["careers.hero", "careers.body", "search.hero", "homepage.body"]) {
    assert.match(largeSeed, new RegExp(slot.replace(".", "\\.")));
  }
});

test("AI and CMS live boundaries fail closed across reconnect and unresolved results", async () => {
  const [client, liveSlot, tracking, doctors, specialties, branchDetail, home] = await Promise.all([
    read("lib/api-client.ts"),
    read("components/cms/CmsLiveSlot.tsx"),
    read("app/tra-cuu/page.tsx"),
    read("app/doctors/DoctorsPageClient.tsx"),
    read("app/specialties/page.tsx"),
    read("app/branches/[slug]/page.tsx"),
    read("app/page.tsx"),
  ]);

  assert.match(client, /result\.specialtyResolution === "RESOLVED"/);
  assert.match(liveSlot, /after: reconciliation\.latestEventId/);
  assert.match(liveSlot, /CmsReconciliationLedger/);
  assert.match(liveSlot, /pendingEventIds/);
  assert.match(liveSlot, /resolvePendingEvent/);
  assert.match(liveSlot, /Đã đồng bộ/);
  assert.match(liveSlot, /cms-live-slot__fallback-note/);
  assert.match(liveSlot, /Đang hiển thị giao diện có sẵn/);
  assert.doesNotMatch(tracking, /30 đơn vị|15 phút|Hỗ trợ BHYT|Thẻ BHYT/);
  assert.match(doctors, /specialtySlug/);
  assert.match(doctors, /specialtySlug/);
  assert.match(doctors, /PublicPageShell/);
  assert.match(specialties, /PublicBookingButton/);
  assert.match(specialties, /PublicPageShell/);
  assert.match(branchDetail, /branch\.phone \?/);
  assert.match(home, /branch\.phone \?/);
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
  const [search, careers, footer, home] = await Promise.all([
    read("app/search/SearchPageClient.tsx"),
    read("app/careers/page.tsx"),
    read("components/Footer.tsx"),
    read("app/page.tsx"),
  ]);

  for (const marker of ["fetchSpecialties", "fetchDoctors", "fetchServices", "fetchPackages", "fetchArticles", "Promise.allSettled", "settledContent", "backend active"]) {
    assert.ok(search.includes(marker), `missing live search marker: ${marker}`);
  }
  assert.match(search, /\/search\?q=/);
  assert.match(careers, /CMS live/);
  assert.match(careers, /PublicPageShell/);
  assert.match(footer, /href="\/careers"/);
  assert.match(home, /router\.push/);
  assert.match(home, /data-cms-managed/);
  assert.match(home, /CmsContentRenderer/);
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
