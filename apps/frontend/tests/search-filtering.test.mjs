import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("SearchPageClient eradicates false red error banner when results exist", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  // Must only render error banner when resultCount === 0
  assert.match(
    source,
    /resultCount === 0 && semanticError/,
    "SearchPageClient must guard semanticError with resultCount === 0",
  );
  assert.doesNotMatch(
    source,
    /\{\s*semanticError\s*\?\s*<p className="catalog-status catalog-status--error"/,
    "SearchPageClient must not render red error banner when results exist",
  );
});

test("SearchPageClient implements accurate category filter tabs", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  // Verify tab definitions
  for (const label of ["Tất cả", "Chuyên khoa", "Bác sĩ", "Gói khám", "Dịch vụ", "Bài viết"]) {
    assert.match(source, new RegExp(`"${label}"`), `Missing category tab: ${label}`);
  }

  // Verify tab list attributes & accessibility
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected/);
  assert.match(source, /activeCategory/);
  assert.match(source, /categoryCounts/);
  assert.match(source, /search-category-tabs/);

  // Verify category filtering guards for each section
  assert.match(source, /activeCategory === "ALL" \|\| activeCategory === "SPECIALTY"/);
  assert.match(source, /activeCategory === "ALL" \|\| activeCategory === "DOCTOR"/);
  assert.match(source, /activeCategory === "ALL" \|\| activeCategory === "PACKAGE"/);
  assert.match(source, /activeCategory === "ALL" \|\| activeCategory === "SERVICE"/);
  assert.match(source, /activeCategory === "ALL" \|\| activeCategory === "ARTICLE"/);
});

test("SearchPageClient normalization strips Vietnamese diacritics accurately", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  assert.match(source, /\.normalize\("NFD"\)/);
  assert.match(source, /\[\\u0300-\\u036f\]/);
  assert.match(source, /\/đ\/g/);

  // Test equivalent normalization logic
  function normalize(value) {
    return value
      .trim()
      .toLocaleLowerCase("vi-VN")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  }

  function matches(query, values) {
    const normalizedQuery = normalize(query);
    return values.some((value) => value && normalize(value).includes(normalizedQuery));
  }

  // Test diacritic stripping
  assert.equal(normalize("Tim mạch"), "tim mach");
  assert.equal(normalize("tim mach"), "tim mach");
  assert.equal(normalize("Nhi khoa"), "nhi khoa");
  assert.equal(normalize("nhi khoa"), "nhi khoa");
  assert.equal(normalize("Đa khoa"), "da khoa");
  assert.equal(normalize("da khoa"), "da khoa");
  assert.equal(normalize("Điều dưỡng"), "dieu duong");
  assert.equal(normalize("dieu duong"), "dieu duong");

  // Test search matching
  assert.ok(matches("tim mach", ["Chuyên khoa Tim mạch can thiệp", "tim-mach"]));
  assert.ok(matches("Tim mạch", ["Chuyên khoa Tim mạch can thiệp", "tim-mach"]));
  assert.ok(matches("nhi khoa", ["Bác sĩ Nhi khoa hàng đầu", "nhi-khoa"]));
  assert.ok(matches("Nhi khoa", ["Bác sĩ Nhi khoa hàng đầu", "nhi-khoa"]));
  assert.ok(matches("da khoa", ["Khám sức khỏe tổng quát đa khoa", "da-khoa"]));
  assert.ok(matches("Đa khoa", ["Khám sức khỏe tổng quát đa khoa", "da-khoa"]));
  assert.ok(matches("dieu duong", ["Dịch vụ chăm sóc điều dưỡng", "dieu-duong"]));
});
