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

test("CMS booking CTA has a real landing route and public chrome avoids invented hotlines", async () => {
  const [booking, navbar, footer, home, seed] = await Promise.all([
    read("app/dat-lich/page.tsx"),
    read("components/Navbar.tsx"),
    read("components/Footer.tsx"),
    read("app/page.tsx"),
    read("../backend/src/main/resources/db/seed/seed-local-data.sql"),
  ]);

  assert.match(booking, /PublicBookingButton/);
  assert.match(seed, /ctaHref.*\/dat-lich/);
  for (const source of [navbar, footer, home]) assert.doesNotMatch(source, /1900\s*1234|contact@healthcare\.vn/);
  assert.match(navbar, /Giờ làm việc từ backend/);
  assert.match(footer, /Backend chưa cung cấp số điện thoại/);
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
  assert.match(liveSlot, /after: latestEventId\.current/);
  assert.match(liveSlot, /highestObservedEventId/);
  assert.match(liveSlot, /pendingEventIds/);
  assert.match(liveSlot, /resolvePendingEvent/);
  assert.match(liveSlot, /Đã đồng bộ/);
  assert.doesNotMatch(tracking, /30 đơn vị|15 phút|Hỗ trợ BHYT|Thẻ BHYT/);
  assert.match(doctors, /specialtySlug/);
  assert.match(doctors, /specialtySlug/);
  assert.match(doctors, /PublicPageShell/);
  assert.match(specialties, /PublicBookingButton/);
  assert.match(specialties, /PublicPageShell/);
  assert.match(branchDetail, /branch\.phone \?/);
  assert.match(home, /branch\.phone \?/);
});
