import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

test("doctor detail page discloses demo profiles near the booking CTA", async () => {
  const source = await read("../app/doctors/[slug]/page.tsx");
  assert.match(source, /isDemoDoctor/, "detail page must compute demo status");
  assert.match(source, /Hồ sơ minh họa/, "chip must label demo profiles");
  assert.match(
    source,
    /Dữ liệu minh họa: đây là hồ sơ giả lập[\s\S]*?không đại diện cho một bác sĩ thật/,
    "demo banner must state the profile is synthetic",
  );
  assert.match(source, /role="note"/, "disclosure must be a note for assistive tech");
});

test("homepage doctor cards carry the demo badge", async () => {
  const source = await read("../app/page.tsx");
  assert.match(source, /doctor-card__demo-badge/);
  assert.match(source, /doctor\.demo \|\| doctor\.slug\.startsWith\("demo-bs-"\)/);
});

test("public booking success never dead-ends guests into the patient portal", async () => {
  const source = await read("../components/BookingModal.tsx");
  assert.match(
    source,
    /const signedIn = Boolean\(getAuthSessionSnapshot\(\)\?\.user\);/,
    "payment CTA must be auth-aware",
  );
  assert.match(source, /Đăng nhập để thanh toán chuyển khoản/, "guests get a login bridge, not a bare portal link");
  const myAppointmentsChip = source.match(
    /\{Boolean\(getAuthSessionSnapshot\(\)\?\.user\) \? \([\s\S]*?Lịch hẹn của tôi[\s\S]*?\) : null\}/,
  );
  assert.ok(myAppointmentsChip, "portal appointments chip must require a session");
});

test("package booking copy no longer claims unsupported per-branch equipment", async () => {
  const source = await read("../components/PackageBookingModal.tsx");
  assert.doesNotMatch(source, /Tất cả các cơ sở đều được trang bị đầy đủ/);
  assert.match(source, /xác nhận khả năng thực hiện[\s\S]*?trước khi khám/);
});

test("public disease-guide fallback CTA stays on the public site", async () => {
  const source = await read("../app/benh-pho-bien/page.tsx");
  assert.doesNotMatch(source, /href="\/patient\/community"/);
  assert.match(source, /href="\/contact"/);
});

test("indexing defaults to the canonical production domain, not env luck", async () => {
  const siteUrl = await read("../lib/site-url.ts");
  assert.match(siteUrl, /CANONICAL_INDEXABLE_HOSTS/);
  assert.match(siteUrl, /export function indexingAllowed/);
  assert.match(siteUrl, /explicit === "false"[\s\S]*?return false;/, "explicit opt-out must win");

  for (const rel of ["../app/robots.ts", "../app/sitemap.ts", "../app/layout.tsx"]) {
    const source = await read(rel);
    assert.match(source, /indexingAllowed\(\)/, `${rel} must use the shared policy`);
    assert.doesNotMatch(source, /NEXT_PUBLIC_ALLOW_INDEXING === "true"/);
  }
});

test("sitemap covers public catalog detail pages and skips disease-guide duplicates", async () => {
  const lib = await read("../lib/server/catalog-sitemap.ts");
  for (const endpoint of ["doctors", "specialties", "services", "packages", "branches", "articles"]) {
    assert.match(lib, new RegExp(`/api/v1/hospital/${endpoint}`), `sitemap must list ${endpoint}`);
  }
  assert.match(lib, /contentKind !== "DISEASE_GUIDE"/, "disease guides belong to their own sitemap entries");

  const sitemap = await read("../app/sitemap.ts");
  for (const detail of ["/doctors/${", "/specialties/${", "/services/${", "/packages/${", "/branches/${", "/articles/${"]) {
    assert.match(sitemap, new RegExp(detail.replace(/\$/g, "\\$")), `sitemap must map ${detail}`);
  }
});

test("homepage article empty state keeps professional copy without nested links", async () => {
  const source = await read("../app/page.tsx");
  assert.match(source, /Cẩm nang sức khỏe từ đội ngũ bác sĩ/);
  assert.match(
    source,
    /Khám phá các bài viết hướng dẫn chăm sóc sức khỏe/,
    "empty summary must not read as an apology",
  );
  assert.doesNotMatch(source, /Cẩm nang sức khỏe đang được cập nhật/);
  const rows = source.match(/!catalogLoading && catalog && articles\.slice\(0, 3\)[\s\S]*?<\/article>/);
  assert.ok(rows, "article rows block must exist");
  assert.match(rows[0], /<h3>\{article\.title\}<\/h3>/, "row title must not nest a second link inside the card link");
});
