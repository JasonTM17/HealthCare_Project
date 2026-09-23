import "server-only";

import { cache } from "react";
import { readHealthcareBffRuntimeConfig } from "../../../lib/server/healthcare-bff";
import type { Article } from "../../../types/hospital";

const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const BACKEND_REQUEST_TIMEOUT_MS = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPublicArticleSlug(value: string): boolean {
  return PUBLIC_SLUG_PATTERN.test(value);
}

export function articleCanonicalPath(slug: string): string {
  return isPublicArticleSlug(slug)
    ? `/articles/${encodeURIComponent(slug)}`
    : "/articles";
}

export function authoritativeDate(value: unknown): string | undefined {
  if (!nonEmptyString(value)) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function articleFromPayload(value: unknown, expectedSlug?: string): Article | null {
  if (
    !isRecord(value)
    // Disease guides publish on their own clinically eligible route, so a
    // /articles/<slug> request that resolves to one is not a general article.
    || value.contentKind === "DISEASE_GUIDE"
    || !nonEmptyString(value.id)
    || !nonEmptyString(value.slug)
    || !isPublicArticleSlug(value.slug)
    || (expectedSlug !== undefined && value.slug !== expectedSlug)
    || !nonEmptyString(value.title)
  ) {
    return null;
  }
  return value as unknown as Article;
}

async function fetchBackendJson(path: string): Promise<unknown> {
  const runtime = readHealthcareBffRuntimeConfig();
  const target = new URL(path, `${runtime.backendOrigin}/`);

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
    // The public article endpoint only serves APPROVED, active and
    // already-published rows, so anything other than a fresh 200 means the slug
    // is missing, pending, rejected or unpublished.
    if (!response.ok || response.status >= 300) return null;
    return await response.json() as unknown;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadArticleBySlug(slug: string): Promise<Article | null> {
  if (!isPublicArticleSlug(slug)) return null;
  try {
    const payload = await fetchBackendJson(`/api/v1/hospital/articles/${encodeURIComponent(slug)}`);
    return articleFromPayload(payload, slug);
  } catch {
    // Metadata is an enhancement. Configuration errors, timeouts and backend
    // outages must leave the interactive page and production build usable.
    return null;
  }
}

export const getArticleBySlug = cache(loadArticleBySlug);
