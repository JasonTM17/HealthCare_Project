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
