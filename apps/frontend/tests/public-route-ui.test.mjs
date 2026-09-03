import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const PUBLIC_METADATA_ROUTES = [
  "about",
  "articles",
  "branches",
  "careers",
  "chinh-sach-bao-mat",
  "contact",
  "dat-lich",
  "doctors",
  "faq",
  "huong-dan",
  "packages",
  "search",
  "services",
  "specialties",
  "tra-cuu",
];

test("public pages opt into the shared route chrome without changing the homepage", async () => {
  const [shell, breadcrumb, homepage] = await Promise.all([
    read("components/PublicPageShell.tsx"),
    read("components/PublicRouteBreadcrumb.tsx"),
    read("app/page.tsx"),
  ]);

  assert.match(shell, /site-shell site-shell--public-route/);
  assert.match(shell, /<PublicRouteBreadcrumb pathname=\{pathname\}/);
  assert.match(breadcrumb, /aria-label="Đường dẫn trang"/);
  assert.match(breadcrumb, /aria-current="page"/);
  assert.match(breadcrumb, /ROUTES_WITH_LOCAL_BREADCRUMB/);
  assert.doesNotMatch(homepage, /site-shell--public-route/);
});

test("all primary public route groups expose descriptive metadata", async () => {
  const factory = await read("lib/public-route-metadata.ts");
  assert.match(factory, /openGraph/);
  assert.match(factory, /twitter/);
  assert.match(factory, /keywords/);

  for (const route of PUBLIC_METADATA_ROUTES) {
    const layout = await read(`app/${route}/layout.tsx`);
    assert.match(layout, /createPublicRouteMetadata/);
    assert.match(layout, /description:/);
    assert.match(layout, /export \{ default \} from "\.\.\/\.\.\/components\/PublicRouteLayout"/);
  }
});

test("legacy login links redirect into the canonical auth route", async () => {
  const source = await read("app/login/page.tsx");

  assert.match(source, /redirect\(/);
  assert.match(source, /\/auth\/login/);
  assert.match(source, /startsWith\("\/\/"\)/);
});

test("public route styling keeps dark heroes legible and guidance responsive", async () => {
  const styles = await read("app/styles.css");

  assert.match(styles, /\.site-shell--public-route \.resource-hero-card--teal \.resource-lead/);
  assert.match(styles, /\.site-shell--public-route \.resource-hero-card--teal \.resource-lead\s*\{[\s\S]*?color: var\(--hospital-teal-dark\) !important/);
  assert.match(styles, /\.site-shell--public-route \.resource-hero-card \{[\s\S]*?border-radius: var\(--radius-sm\)[\s\S]*?box-shadow: var\(--shadow-soft\)/);
  assert.match(styles, /\.site-shell--public-route \.resource-hero-card--teal::after \{\s*display: none;/);
  assert.match(styles, /\.resource-chip \{[\s\S]*?border-radius: 0;/);
  assert.match(styles, /\.site-shell--public-route \.resource-grid--two \.resource-steps--grid/);
  assert.match(styles, /\.public-route-breadcrumb__list/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.site-shell--public-route \.resource-page__header h1/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.site-shell--public-route \.catalog-status--loading::before/);
});

test("public catalog states and mobile assistance stay readable during slow loads", async () => {
  const [doctors, assistant, assistantStyles, cms, styles, tracking] = await Promise.all([
    read("app/doctors/DoctorsPageClient.tsx"),
    read("components/FloatingHealthAssistant.tsx"),
    read("components/FloatingHealthAssistant.module.css"),
    read("components/cms/CmsRenderer.tsx"),
    read("app/styles.css"),
    read("app/tra-cuu/page.tsx"),
  ]);

  assert.match(doctors, /loading && !page/);
  assert.match(doctors, /dedupePublicDoctors/);
  assert.match(assistant, /data-page=\{pathname\}/);
  assert.match(assistantStyles, /data-page="\/dat-lich"/);
  assert.match(assistantStyles, /6\.5rem/);
  assert.doesNotMatch(cms, /Nội dung CMS:/);
  assert.match(cms, /Thông tin nổi bật từ bệnh viện/);
  assert.match(styles, /\.resource-list li \{[\s\S]*display:\s*grid/);
  assert.doesNotMatch(tracking, /Thông tin hiển thị từ backend/);
});
