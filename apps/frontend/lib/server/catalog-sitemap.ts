import "server-only";

import { cache } from "react";
import { readHealthcareBffRuntimeConfig } from "./healthcare-bff";

const BACKEND_REQUEST_TIMEOUT_MS = 5_000;
const SITEMAP_PAGE_SIZE = 100;
const MAX_SITEMAP_PAGES = 20;

export interface CatalogSitemapEntry {
  slug: string;
  lastModified?: string;
}

interface PageEnvelope {
  content: Array<Record<string, unknown>>;
  totalPages: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pageEnvelopeFromPayload(value: unknown): PageEnvelope | null {
  if (
    !isRecord(value)
    || !Array.isArray(value.content)
    || !Number.isInteger(value.totalPages)
    || (value.totalPages as number) < 0
  ) {
    return null;
  }
  const content = value.content.filter(isRecord);
  return { content, totalPages: value.totalPages as number };
}

async function fetchBackendJson(path: string, searchParams?: URLSearchParams): Promise<unknown> {
  const runtime = readHealthcareBffRuntimeConfig();
  const target = new URL(path, `${runtime.backendOrigin}/`);
  if (searchParams) target.search = searchParams.toString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(target, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-Healthcare-Bff-Token": runtime.serviceToken,
      },
      redirect: "manual",
      signal: controller.signal,
    });
    if (!response.ok || response.status >= 300) return null;
    return await response.json() as unknown;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadCatalogEntries(
  path: string,
  keep?: (item: Record<string, unknown>) => boolean,
): Promise<CatalogSitemapEntry[]> {
  try {
    const firstPage = pageEnvelopeFromPayload(
      await fetchBackendJson(path, new URLSearchParams({ page: "0", size: String(SITEMAP_PAGE_SIZE) })),
    );
    if (!firstPage || firstPage.totalPages === 0) return [];
    const pages = [firstPage];
    if (firstPage.totalPages > 1 && firstPage.totalPages <= MAX_SITEMAP_PAGES) {
      const remaining = await Promise.all(
        Array.from({ length: firstPage.totalPages - 1 }, async (_, index) =>
          pageEnvelopeFromPayload(
            await fetchBackendJson(path, new URLSearchParams({ page: String(index + 1), size: String(SITEMAP_PAGE_SIZE) })),
          )),
      );
      for (const page of remaining) if (page) pages.push(page);
    }
    const entries: CatalogSitemapEntry[] = [];
    for (const page of pages) {
      for (const item of page.content) {
        if (keep && !keep(item)) continue;
        const slug = typeof item.slug === "string" ? item.slug : "";
        if (!slug) continue;
        const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : undefined;
        entries.push({
          slug,
          ...(updatedAt && Number.isFinite(Date.parse(updatedAt))
            ? { lastModified: new Date(updatedAt).toISOString() }
            : {}),
        });
      }
    }
    return entries;
  } catch {
    // Metadata is an enhancement: backend outages must not break the sitemap.
    return [];
  }
}

export const listDoctorSitemapEntries = cache(() => loadCatalogEntries("/api/v1/hospital/doctors"));
export const listSpecialtySitemapEntries = cache(() => loadCatalogEntries("/api/v1/hospital/specialties"));
export const listServiceSitemapEntries = cache(() => loadCatalogEntries("/api/v1/hospital/services"));
export const listPackageSitemapEntries = cache(() => loadCatalogEntries("/api/v1/hospital/packages"));
export const listBranchSitemapEntries = cache(() => loadCatalogEntries("/api/v1/hospital/branches"));
// DISEASE_GUIDE articles render under /benh-pho-bien/<slug> (handled by the
// dedicated disease-guide sitemap), not /articles/<slug>.
export const listArticleSitemapEntries = cache(() =>
  loadCatalogEntries(
    "/api/v1/hospital/articles",
    (item) => item.contentKind !== "DISEASE_GUIDE",
  ));
