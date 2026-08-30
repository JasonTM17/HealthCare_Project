import type { MetadataRoute } from "next";
import {
  diseaseGuideCanonicalPath,
  listEligibleDiseaseGuides,
} from "./benh-pho-bien/[slug]/disease-guide-seo";

export const dynamic = "force-dynamic";

const PUBLIC_PATHS = [
  "/",
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
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://healthcare-beta.example").replace(/\/$/u, "");
  const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
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
  return [...staticEntries, ...diseaseEntries];
}
