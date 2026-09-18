import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  ALL_PACKAGE_TONES,
  getPackageVisual,
  resolveTone,
} from "../lib/package-visuals.ts";

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

test("package visuals supports all 14 clinical tones with verified assets on disk", async () => {
  assert.equal(ALL_PACKAGE_TONES.length, 14);

  const expectedTones = [
    "general",
    "cardio",
    "metabolic",
    "women",
    "children",
    "digestive",
    "bone-joint",
    "neurological",
    "cancer",
    "geriatric",
    "men",
    "respiratory",
    "premarital",
    "executive",
  ];

  for (const tone of expectedTones) {
    assert.ok(ALL_PACKAGE_TONES.includes(tone), `Tone ${tone} must be in ALL_PACKAGE_TONES`);
    const visual = getPackageVisual({ slug: `mock-${tone}`, name: `Gói ${tone}` });
    assert.ok(visual.imageSrc.startsWith("/images/packages/"));
    assert.ok(visual.category.length > 0);
    assert.ok(visual.imageAlt.length > 0);

    const filePath = new URL(`public${visual.imageSrc}`, root);
    const fileStat = await stat(filePath);
    assert.ok(fileStat.size > 40_000, `Image ${visual.imageSrc} must exist and exceed 40KB`);
  }
});

test("expanded specialty recognition correctly classifies 13+ medical specialties", () => {
  const cases = [
    { item: { slug: "goi-kham-tim-mach", name: "Gói tầm soát tim mạch & đo điện tim" }, expected: "cardio" },
    { item: { slug: "tieu-duong", name: "Gói kiểm tra đái tháo đường và rối loạn chuyển hóa" }, expected: "metabolic" },
    { item: { slug: "suc-khoe-phu-nu", name: "Gói khám phụ khoa và tầm soát vú định kỳ" }, expected: "women" },
    { item: { slug: "tien-hon-nhan", name: "Gói khám sức khỏe tiền hôn nhân cho cặp đôi" }, expected: "premarital" },
    { item: { slug: "tre-em", name: "Gói khám nhi khoa tổng quát và tiêm chủng cho bé" }, expected: "children" },
    { item: { slug: "tieu-hoa-gan-mat", name: "Gói nội soi dạ dày, đại tràng và kiểm tra men gan" }, expected: "digestive" },
    { item: { slug: "co-xuong-khop", name: "Gói đo mật độ xương DEXA và tầm soát thoái hóa khớp" }, expected: "bone-joint" },
    { item: { slug: "than-kinh-nao", name: "Gói tầm soát phòng ngừa đột quỵ và thiếu máu não" }, expected: "neurological" },
    { item: { slug: "tam-soat-ung-buou", name: "Gói tầm soát sớm ung bướu kỹ thuật cao với marker u" }, expected: "cancer" },
    { item: { slug: "nguoi-cao-tuoi", name: "Gói chăm sóc sức khỏe người cao tuổi & lão khoa" }, expected: "geriatric" },
    { item: { slug: "nam-khoa", name: "Gói khám nam học và sức khỏe phái mạnh" }, expected: "men" },
    { item: { slug: "ho-hap-phoi", name: "Gói thăm khám chức năng hô hấp và tầm soát bệnh phổi" }, expected: "respiratory" },
    { item: { slug: "vip-executive", name: "Gói khám VIP Doanh nhân cao cấp hạng thương gia" }, expected: "executive" },
  ];

  for (const { item, expected } of cases) {
    assert.equal(resolveTone(item), expected, `Item ${item.name} should resolve to ${expected}`);
  }
});

test("deterministic allocation guarantees distinct vivid images across consecutive packages", () => {
  // Simulate 10 consecutive packages on catalog (e.g. goi-1 to goi-10)
  const images = [];
  for (let i = 1; i <= 10; i += 1) {
    const visual = getPackageVisual({
      slug: `goi-${i}`,
      name: `Gói khám sức khỏe cấp A #${i}`,
    });
    images.push(visual.imageSrc);
  }

  const uniqueImages = new Set(images);
  assert.equal(
    uniqueImages.size,
    10,
    `All 10 numbered packages must have distinct images, got ${uniqueImages.size} unique`
  );

  // Assert general-checkup.jpg appears only once (at index 0), not dominating the catalog
  const generalCount = images.filter((img) => img === "/images/packages/general-checkup.jpg").length;
  assert.equal(generalCount, 1, "general-checkup.jpg should only be allocated once in 10 items");
});

test("full 14-tone coverage without duplicate fallback", () => {
  const allImages = new Set();
  for (let i = 1; i <= 14; i += 1) {
    const visual = getPackageVisual({
      slug: `package-rank-${i}`,
      name: `Gói kiểm tra sức khỏe Hạng ${i}`,
    });
    allImages.add(visual.imageSrc);
  }

  assert.equal(
    allImages.size,
    14,
    `All 14 ranks must allocate all 14 distinct package images, got ${allImages.size}`
  );
});

test("intra-specialty multi-tier packages avoid image duplication", () => {
  // Test VIP packages of different tiers
  const vip1 = getPackageVisual({ slug: "vip-hang-1", name: "Gói khám VIP Doanh nhân (Hạng 1)" });
  const vip2 = getPackageVisual({ slug: "vip-hang-2", name: "Gói khám VIP Doanh nhân (Hạng 2)" });
  const vip4 = getPackageVisual({ slug: "vip-hang-4", name: "Gói khám VIP Doanh nhân (Hạng 4)" });
  const vip6 = getPackageVisual({ slug: "vip-hang-6", name: "Gói khám Sức khỏe VIP Doanh nhân Toàn diện (Hạng 6)" });

  const vipImages = new Set([vip1.imageSrc, vip2.imageSrc, vip4.imageSrc, vip6.imageSrc]);
  assert.equal(
    vipImages.size,
    4,
    `Multi-tier VIP packages must allocate distinct clinical images, got ${vipImages.size}`
  );

  // Test women's multi-tier packages
  const women1 = getPackageVisual({ slug: "phu-nu-1", name: "Gói sức khỏe phụ nữ (Hạng 1)" });
  const women2 = getPackageVisual({ slug: "phu-nu-2", name: "Gói sức khỏe phụ nữ nâng cao (Hạng 2)" });
  assert.notEqual(women1.imageSrc, women2.imageSrc, "Tiered women packages must not share the same image");
});

test("PackageVisuals.module.css defines .tone-digestive theme colors", async () => {
  const css = await read("components/PackageVisuals.module.css");
  assert.match(css, /\.tone-digestive\s*\{/);
  assert.match(css, /--package-accent:\s*#0d9488/);
  assert.match(css, /--package-soft:\s*#f0fdfa/);
  assert.match(css, /--package-deep:\s*#134e4a/);
});

test("getPackageVisual gracefully handles null, undefined, and empty package items", () => {
  const fallbacks = [
    getPackageVisual(null),
    getPackageVisual(undefined),
    getPackageVisual({}),
    getPackageVisual({ slug: "" }),
    getPackageVisual({ name: "" }),
  ];

  for (const visual of fallbacks) {
    assert.ok(visual, "Must return a visual");
    assert.ok(typeof visual.imageSrc === "string");
    assert.ok(visual.imageSrc.length > 0);
    assert.ok(typeof visual.tone === "string");
  }
});
