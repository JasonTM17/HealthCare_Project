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

test("public route styling keeps dark heroes legible and guidance responsive", async () => {
  const styles = await read("app/styles.css");

  assert.match(styles, /\.site-shell--public-route \.resource-hero-card--teal \.resource-lead/);
  assert.match(styles, /color: #cce9e6 !important/);
  assert.match(styles, /\.site-shell--public-route \.resource-grid--two \.resource-steps--grid/);
  assert.match(styles, /\.public-route-breadcrumb__list/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.site-shell--public-route \.resource-page__header h1/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.site-shell--public-route \.catalog-status--loading::before/);
});
