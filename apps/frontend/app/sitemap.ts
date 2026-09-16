import type { MetadataRoute } from "next";
import { SITE_URL, indexingAllowed } from "../lib/site-url";
import {
  listArticleSitemapEntries,
  listBranchSitemapEntries,
  listDoctorSitemapEntries,
  listPackageSitemapEntries,
  listServiceSitemapEntries,
  listSpecialtySitemapEntries,
  type CatalogSitemapEntry,
} from "../lib/server/catalog-sitemap";
import {
  diseaseGuideCanonicalPath,
  listEligibleDiseaseGuides,
} from "./benh-pho-bien/[slug]/disease-guide-seo";

export const dynamic = "force-dynamic";

const PUBLIC_PATHS = [
  "/",
  "/about",
  "/benh-pho-bien",
  "/articles",
  "/doctors",
  "/specialties",
  "/services",
  "/packages",
  "/dat-lich",
  "/search",
  "/careers",
  "/huong-dan",
  "/branches",
  "/faq",
  "/contact",
  "/chinh-sach-bao-mat",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;
  const allowIndexing = indexingAllowed();
  if (!allowIndexing) return [];

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_PATHS.map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: path === "/" ? "weekly" : "daily",
    priority: path === "/" ? 1 : 0.7,
  }));
  const diseaseGuides = await listEligibleDiseaseGuides();
  const diseaseEntries: MetadataRoute.Sitemap = diseaseGuides.map((guide) => ({
    url: `${baseUrl}${diseaseGuideCanonicalPath(guide.slug)}`,
    changeFrequency: "weekly",
    priority: 0.8,
    ...(guide.lastModified ? { lastModified: guide.lastModified } : {}),
  }));
  const detailGroups: Array<{ path: (entry: CatalogSitemapEntry) => string; entries: CatalogSitemapEntry[] }> = [
    { path: (e) => `/doctors/${e.slug}`, entries: await listDoctorSitemapEntries() },
    { path: (e) => `/specialties/${e.slug}`, entries: await listSpecialtySitemapEntries() },
    { path: (e) => `/services/${e.slug}`, entries: await listServiceSitemapEntries() },
    { path: (e) => `/packages/${e.slug}`, entries: await listPackageSitemapEntries() },
    { path: (e) => `/branches/${e.slug}`, entries: await listBranchSitemapEntries() },
    { path: (e) => `/articles/${e.slug}`, entries: await listArticleSitemapEntries() },
  ];
  const detailEntries: MetadataRoute.Sitemap = detailGroups.flatMap(({ path, entries }) =>
    entries.map((entry) => ({
      url: `${baseUrl}${path(entry)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
    })),
  );
  return [...staticEntries, ...diseaseEntries, ...detailEntries];
}
