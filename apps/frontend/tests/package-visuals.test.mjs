import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("package catalog uses local licensed photography instead of competitor assets", async () => {
  const [visuals, attribution] = await Promise.all([
    read("lib/package-visuals.ts"),
    read("public/images/packages/ATTRIBUTIONS.md"),
  ]);

  const assets = [
    "general-checkup.jpg",
    "heart-screening.jpg",
    "diabetes-screening.jpg",
    "womens-health.jpg",
    "child-checkup.jpg",
    "digestive-health.jpg",
  ];

  for (const asset of assets) {
    assert.match(visuals, new RegExp(`/images/packages/${asset.replace(".", "\\.")}`));
    assert.match(attribution, new RegExp(asset.replace(".", "\\.")));
    const file = await stat(new URL(`public/images/packages/${asset}`, root));
    assert.ok(file.size > 40_000, `${asset} should contain a real optimized photograph`);
  }

  assert.match(attribution, /pexels\.com\/license/);
  assert.doesNotMatch(visuals, /hoanmy|tamanh|hoanhao/i);
});

test("package cards share the same visual system across home and catalog routes", async () => {
  const [home, catalog, card, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/packages/page.tsx"),
    read("components/PackageVisualCard.tsx"),
    read("components/PackageVisuals.module.css"),
  ]);

  assert.match(home, /PackageVisualCard/);
  assert.match(home, /packages\.slice\(0, 4\)/);
  assert.match(catalog, /PackageVisualCard/);
  assert.match(catalog, /PublicBookingButton/);
  assert.match(card, /getPackageVisual/);
  assert.match(card, /packageItem\.checklist/);
  assert.match(card, /Chi phí gói/);
  assert.doesNotMatch(card, /giảm|ưu đãi|25%/i);
  assert.match(styles, /\.homeRail\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});

test("package detail keeps backend-owned content and labels stock photography", async () => {
  const detail = await read("app/packages/[slug]/page.tsx");

  for (const marker of ["targetAudience", "checklist", "preparationSteps", "durationDays"]) {
    assert.match(detail, new RegExp(marker));
  }
  assert.match(detail, /Ảnh minh họa/);
  assert.match(detail, /sourceHref/);
  assert.match(detail, /setItem\(null\)/);
  assert.match(detail, /Không tìm thấy/);
});
