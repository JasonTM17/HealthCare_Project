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
const CANONICAL_INDEXABLE_HOSTS = new Set(["healthcare.id.vn", "www.healthcare.id.vn"]);

/**
 * Hosts that must never enter a search index: local development, private
 * networks, disposable preview platforms and the placeholder origin. A public
 * origin that is not in this list is treated as a real deployment.
 */
const NON_INDEXABLE_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
const NON_INDEXABLE_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".example", ".vercel.app", ".onrender.com"];
const IPV4_HOSTNAME_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/u;

function isPublicOriginHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;
  if (NON_INDEXABLE_HOSTNAMES.has(normalized)) return false;
  if (NON_INDEXABLE_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return false;
  if (normalized.startsWith("[") || IPV4_HOSTNAME_PATTERN.test(normalized)) return false;
  return true;
}

/**
 * Indexing policy, decided with the operator: the production site is fully
 * indexable. Order of precedence:
 *
 * 1. `NEXT_PUBLIC_ALLOW_INDEXING=true|false` — an explicit operator switch wins.
 * 2. The documented canonical production domains are indexable.
 * 3. Any other public origin (a Vercel custom domain, for example) is indexable
 *    too, so a domain migration cannot silently de-index the site again.
 * 4. localhost, private-network hosts, IP literals, preview hosts
 *    (`*.vercel.app`, `*.onrender.com`) and the placeholder origin stay
 *    non-indexable.
 */
export function indexingAllowed(): boolean {
  const explicit = process.env.NEXT_PUBLIC_ALLOW_INDEXING;
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  try {
    const configured = new URL(SITE_URL);
    if (!/^https?:$/u.test(configured.protocol)) return false;
    return CANONICAL_INDEXABLE_HOSTS.has(configured.hostname) || isPublicOriginHost(configured.hostname);
  } catch {
    return false;
  }
}

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
