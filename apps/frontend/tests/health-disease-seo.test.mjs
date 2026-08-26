import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("disease detail resolves closed, route-specific metadata on the server", async () => {
  const [layout, server] = await Promise.all([
    read("app/benh-pho-bien/[slug]/layout.tsx"),
    read("app/benh-pho-bien/[slug]/disease-guide-seo.ts"),
  ]);

  assert.match(layout, /export async function generateMetadata/);
  assert.match(layout, /const \{ slug \} = await params/);
  assert.match(layout, /getDiseaseGuideBySlug\(slug\)/);
  assert.match(layout, /alternates: \{ canonical \}/);
  assert.match(layout, /robots: \{ index: false, follow: true \}/);
  assert.match(layout, /type: "article"/);
  assert.match(layout, /modifiedTime/);
  assert.doesNotMatch(layout, /["']use client["']/);

  assert.match(server, /import "server-only"/);
  assert.match(server, /readHealthcareBffRuntimeConfig\(\)/);
  assert.match(server, /"X-Healthcare-Bff-Token": runtime\.serviceToken/);
  assert.match(server, /cache: "no-store"/);
  assert.match(server, /redirect: "manual"/);
  assert.match(server, /value\.contentKind !== "DISEASE_GUIDE"/);
  assert.match(server, /expectedSlug !== undefined && value\.slug !== expectedSlug/);
});

test("disease JSON-LD uses an escaped absolute canonical and no unverified reviewer data", async () => {
  const page = await read("app/benh-pho-bien/[slug]/page.tsx");

  assert.match(page, /canonicalDiseaseGuideUrl\(article\.slug\)/);
  assert.match(page, /"@id": canonicalUrl/);
  assert.match(page, /mainEntityOfPage/);
  assert.match(page, /dateModified: article\.updatedAt \?\? article\.publishedAt/);
  assert.match(page, /\.replace\(\/<\/g, "\\\\u003c"\)/);
  assert.match(page, /\.replace\(\/&\/g, "\\\\u0026"\)/);
  assert.doesNotMatch(page, /reviewedBy|clinicalMetadata/);
});

test("sitemap is request-time, bounded and degrades to verified static routes", async () => {
  const [sitemap, server] = await Promise.all([
    read("app/sitemap.ts"),
    read("app/benh-pho-bien/[slug]/disease-guide-seo.ts"),
  ]);

  assert.match(sitemap, /export const dynamic = "force-dynamic"/);
  assert.match(sitemap, /if \(!allowIndexing\) return \[\]/);
  assert.match(sitemap, /await listEligibleDiseaseGuides\(\)/);
  assert.match(sitemap, /diseaseGuideCanonicalPath\(guide\.slug\)/);
  assert.match(sitemap, /lastModified: guide\.lastModified/);

  assert.match(server, /contentKind: "DISEASE_GUIDE"/);
  assert.match(server, /firstPage\.totalPages > MAX_SITEMAP_PAGES/);
  assert.match(server, /remainingPages\.some\(\(page\) => page === null\)/);
  assert.match(server, /return \[\];/);
  assert.match(server, /PUBLIC_SLUG_PATTERN/);
});
