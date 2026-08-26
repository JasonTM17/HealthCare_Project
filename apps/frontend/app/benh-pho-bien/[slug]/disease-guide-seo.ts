import "server-only";

import { cache } from "react";
import { readHealthcareBffRuntimeConfig } from "../../../lib/server/healthcare-bff";
import type { Article } from "../../../types/hospital";

const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const BACKEND_REQUEST_TIMEOUT_MS = 5_000;
const SITEMAP_PAGE_SIZE = 100;
const MAX_SITEMAP_PAGES = 50;

interface ArticlePageEnvelope {
  content: unknown[];
  totalPages: number;
}

export interface DiseaseGuideSitemapEntry {
  slug: string;
  lastModified?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPublicDiseaseGuideSlug(value: string): boolean {
  return PUBLIC_SLUG_PATTERN.test(value);
}

export function diseaseGuideCanonicalPath(slug: string): string {
  return isPublicDiseaseGuideSlug(slug)
    ? `/benh-pho-bien/${encodeURIComponent(slug)}`
    : "/benh-pho-bien";
}

export function authoritativeDate(value: unknown): string | undefined {
  if (!nonEmptyString(value)) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function diseaseGuideFromPayload(value: unknown, expectedSlug?: string): Article | null {
  if (
    !isRecord(value)
    || value.contentKind !== "DISEASE_GUIDE"
    || !nonEmptyString(value.id)
    || !nonEmptyString(value.slug)
    || !isPublicDiseaseGuideSlug(value.slug)
    || (expectedSlug !== undefined && value.slug !== expectedSlug)
    || !nonEmptyString(value.title)
    || !nonEmptyString(value.summary)
    || !nonEmptyString(value.publishedAt)
  ) {
    return null;
  }
  return value as unknown as Article;
}

function pageEnvelopeFromPayload(value: unknown): ArticlePageEnvelope | null {
  if (
    !isRecord(value)
    || !Array.isArray(value.content)
    || !Number.isInteger(value.totalPages)
    || (value.totalPages as number) < 0
  ) {
    return null;
  }
  return { content: value.content, totalPages: value.totalPages as number };
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

async function loadDiseaseGuideBySlug(slug: string): Promise<Article | null> {
  if (!isPublicDiseaseGuideSlug(slug)) return null;
  try {
    const payload = await fetchBackendJson(`/api/v1/hospital/articles/${encodeURIComponent(slug)}`);
    return diseaseGuideFromPayload(payload, slug);
  } catch {
    // Metadata is an enhancement. Configuration errors, timeouts and backend
    // outages must leave the interactive page and production build usable.
    return null;
  }
}

export const getDiseaseGuideBySlug = cache(loadDiseaseGuideBySlug);

async function fetchDiseaseGuidePage(page: number): Promise<ArticlePageEnvelope | null> {
  const searchParams = new URLSearchParams({
    contentKind: "DISEASE_GUIDE",
    page: String(page),
    size: String(SITEMAP_PAGE_SIZE),
  });
  return pageEnvelopeFromPayload(await fetchBackendJson("/api/v1/hospital/articles", searchParams));
}

export async function listEligibleDiseaseGuides(): Promise<DiseaseGuideSitemapEntry[]> {
  try {
    const firstPage = await fetchDiseaseGuidePage(0);
    if (!firstPage || firstPage.totalPages === 0) return [];
    if (firstPage.totalPages > MAX_SITEMAP_PAGES) return [];

    const remainingPages = await Promise.all(
      Array.from({ length: firstPage.totalPages - 1 }, (_, index) => fetchDiseaseGuidePage(index + 1)),
    );
    if (remainingPages.some((page) => page === null)) return [];

    const entries = new Map<string, DiseaseGuideSitemapEntry>();
    for (const page of [firstPage, ...remainingPages] as ArticlePageEnvelope[]) {
      for (const value of page.content) {
        const article = diseaseGuideFromPayload(value);
        if (!article || entries.has(article.slug)) continue;
        entries.set(article.slug, {
          slug: article.slug,
          lastModified: authoritativeDate(article.updatedAt ?? article.publishedAt),
        });
      }
    }
    return [...entries.values()].sort((left, right) => left.slug.localeCompare(right.slug));
  } catch {
    // Keep the static public routes available while omitting an unverified or
    // unavailable disease catalog. Never synthesize slugs during degradation.
    return [];
  }
}
