/**
 * Canonical public origin for metadata surfaces (canonical links, og:url,
 * JSON-LD, robots, sitemap). Every consumer must resolve the origin through
 * this module so the value can never drift between pages or build targets.
 */
const DEFAULT_ORIGIN = "https://healthcare-beta.example";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_ORIGIN).replace(/\/+$/u, "");

/**
 * Validated origin for URL composition: falls back to the default when the
 * configured value is not a usable http(s) origin (misconfiguration guard).
 */
export function safeSiteOrigin(): string {
  try {
    const configured = new URL(SITE_URL);
    if (!/^https?:$/u.test(configured.protocol) || configured.username || configured.password) {
      return DEFAULT_ORIGIN;
    }
    return configured.origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}
