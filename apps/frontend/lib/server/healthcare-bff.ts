import "server-only";

import { Buffer } from "node:buffer";
import { isIP } from "node:net";

const API_PREFIX = "/api/v1/";
const DEFAULT_BACKEND_ORIGIN = "http://127.0.0.1:8080";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_STREAM_REQUEST_TIMEOUT_MS = 30_000;
// Render Free services may need a cold-start window before the backend can
// reach the native Python AI service. Keep ordinary API calls bounded at the
// shorter deadline, but give the stateless public chat path one bounded retry
// window that fits the Vercel Hobby function limit.
const DEFAULT_PUBLIC_AI_REQUEST_TIMEOUT_MS = 55_000;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_PATH_LENGTH = 2_048;
const MAX_HEADER_VALUE_LENGTH = 16_384;
const MIN_SERVICE_TOKEN_BYTES = 32;
const MAX_SERVICE_TOKEN_BYTES = 512;

const ALLOWED_METHODS = new Set(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const REQUEST_HEADER_ALLOWLIST = new Set([
  "accept",
  "accept-language",
  "cache-control",
  "content-type",
  "idempotency-key",
  "if-modified-since",
  "if-none-match",
  "last-event-id",
  "range",
  "x-idempotency-key",
]);
const RESERVED_BROWSER_HEADERS = new Set([
  "authorization",
  "x-csrf-token",
  "x-healthcare-bff-token",
  "x-healthcare-client-ip",
  "x-healthcare-original-origin",
]);
const RESPONSE_HEADER_ALLOWLIST = new Set([
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-language",
  "content-range",
  "content-type",
  "etag",
  "expires",
  "last-modified",
  "vary",
]);
const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9._~-]+$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const ENCODED_PATH_STRUCTURE_PATTERN = /%(?:00|0a|0d|2e|2f|5c)/iu;
const COOKIE_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;
const SECURITY_COOKIE_VALUE_PATTERN = /^[\u0021\u0023-\u002B\u002D-\u003A\u003C-\u005B\u005D-\u007E]+$/u;
const SESSION_COOKIE_NAME = "__Host-healthcare_session";
const CSRF_COOKIE_NAME = "__Host-healthcare_csrf";
const RESPONSE_COOKIE_ATTRIBUTES = new Set(["path", "secure", "httponly", "samesite", "max-age", "expires"]);
const BLOCKED_BEARER_MINT_PATHS = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  "/api/v1/auth/email-verifications/confirm",
  "/api/v1/auth/verify-email",
  "/api/v1/auth/confirm-email",
]);

export interface HealthcareBffRuntimeConfig {
  backendOrigin: string;
  publicOrigin?: string;
  serviceToken: string;
  requestTimeoutMs: number;
  streamRequestTimeoutMs?: number;
  publicAiRequestTimeoutMs?: number;
}

export interface HealthcareBffProxyOptions {
  fetchImpl?: typeof fetch;
  runtimeConfig?: HealthcareBffRuntimeConfig;
}

class BffRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "BffRequestError";
    this.status = status;
    this.code = code;
  }
}

function jsonError(status: number, code: string): Response {
  return Response.json(
    { code },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

function normalizeBackendOrigin(rawValue: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new BffRequestError(503, "BFF_CONFIGURATION_UNAVAILABLE");
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    throw new BffRequestError(503, "BFF_CONFIGURATION_UNAVAILABLE");
  }
  return parsed.origin;
}

function parseConfiguredPublicOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => normalizeBackendOrigin(v));
}

export function readHealthcareBffRuntimeConfig(): HealthcareBffRuntimeConfig {
  const backendOrigin = normalizeBackendOrigin(
    process.env.BACKEND_INTERNAL_URL?.trim() || DEFAULT_BACKEND_ORIGIN,
  );
  const configuredPublicOrigin = process.env.BFF_PUBLIC_ORIGIN?.trim();
  const publicOrigins = parseConfiguredPublicOrigins(configuredPublicOrigin);
  const publicOrigin = publicOrigins.length > 0 ? publicOrigins.join(",") : undefined;
  const serviceToken = process.env.BACKEND_BFF_SERVICE_TOKEN ?? "";
  if (!isValidServiceToken(serviceToken)) {
    throw new BffRequestError(503, "BFF_CONFIGURATION_UNAVAILABLE");
  }
  return {
    backendOrigin,
    publicOrigin,
    serviceToken,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    streamRequestTimeoutMs: DEFAULT_STREAM_REQUEST_TIMEOUT_MS,
    publicAiRequestTimeoutMs: DEFAULT_PUBLIC_AI_REQUEST_TIMEOUT_MS,
  };
}

function isValidServiceToken(serviceToken: string): boolean {
  const byteLength = Buffer.byteLength(serviceToken, "utf8");
  return (
    serviceToken === serviceToken.trim()
    && !CONTROL_CHARACTER_PATTERN.test(serviceToken)
    && byteLength >= MIN_SERVICE_TOKEN_BYTES
    && byteLength <= MAX_SERVICE_TOKEN_BYTES
  );
}

function decodePathSegment(segment: string): string {
  let decoded = segment;
  for (let pass = 0; pass < 2 && decoded.includes("%"); pass += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      throw new BffRequestError(400, "BFF_PATH_INVALID");
    }
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function validateDecodedSegment(segment: string): string {
  const decoded = decodePathSegment(segment);
  if (
    !decoded
    || decoded === "."
    || decoded === ".."
    || !SAFE_SEGMENT_PATTERN.test(decoded)
    || CONTROL_CHARACTER_PATTERN.test(decoded)
    || decoded.includes("/")
    || decoded.includes("\\")
    || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(decoded)
  ) {
    throw new BffRequestError(400, "BFF_PATH_INVALID");
  }
  return decoded;
}

function buildValidatedApiPath(requestUrl: URL, pathSegments: readonly string[]): string {
  if (pathSegments.length === 0) throw new BffRequestError(400, "BFF_PATH_INVALID");
  const rawPathname = requestUrl.pathname;
  if (
    !rawPathname.startsWith(API_PREFIX)
    || rawPathname.length > MAX_PATH_LENGTH
    || rawPathname.includes("\\")
    || rawPathname.includes("//")
    || ENCODED_PATH_STRUCTURE_PATTERN.test(rawPathname)
  ) {
    throw new BffRequestError(400, "BFF_PATH_INVALID");
  }

  const rawSegments = rawPathname.slice(API_PREFIX.length).split("/");
  if (rawSegments.length !== pathSegments.length) {
    throw new BffRequestError(400, "BFF_PATH_INVALID");
  }

  const normalizedSegments = pathSegments.map(validateDecodedSegment);
  for (let index = 0; index < rawSegments.length; index += 1) {
    if (validateDecodedSegment(rawSegments[index]) !== normalizedSegments[index]) {
      throw new BffRequestError(400, "BFF_PATH_INVALID");
    }
  }

  return `${API_PREFIX}${normalizedSegments.map(encodeURIComponent).join("/")}`;
}

function normalizeHttpOrigin(rawOrigin: string): string {
  let origin: URL;
  try {
    origin = new URL(rawOrigin);
  } catch {
    throw new BffRequestError(403, "BFF_ORIGIN_INVALID");
  }
  if (
    (origin.protocol !== "http:" && origin.protocol !== "https:")
    || origin.username
    || origin.password
    || origin.search
    || origin.hash
    || (origin.pathname !== "/" && origin.pathname !== "")
  ) {
    throw new BffRequestError(403, "BFF_ORIGIN_INVALID");
  }
  return origin.origin;
}

function normalizedBrowserOrigin(request: Request, configuredPublicOrigin?: string): string {
  const requestUrl = new URL(request.url);
  const allowedOrigins = parseConfiguredPublicOrigins(configuredPublicOrigin);
  const requestOrigin = normalizeHttpOrigin(requestUrl.origin);

  const suppliedOrigin = request.headers.get("origin");
  if (!suppliedOrigin) {
    if (!SAFE_METHODS.has(request.method.toUpperCase())) {
      throw new BffRequestError(403, "BFF_ORIGIN_REQUIRED");
    }
    return allowedOrigins.length > 0 ? allowedOrigins[0] : requestOrigin;
  }
  const normalized = normalizeHttpOrigin(suppliedOrigin);

  if (allowedOrigins.length > 0) {
    if (allowedOrigins.includes(normalized) || normalized === requestOrigin) {
      return normalized;
    }
    throw new BffRequestError(403, "BFF_ORIGIN_INVALID");
  }

  if (normalized !== requestOrigin) throw new BffRequestError(403, "BFF_ORIGIN_INVALID");
  return normalized;
}

function connectionScopedHeaders(headers: Headers): Set<string> {
  const tokens = new Set<string>();
  for (const value of headers.get("connection")?.split(",") ?? []) {
    const token = value.trim().toLowerCase();
    if (/^[a-z0-9!#$%&'*+.^_`|~-]+$/u.test(token)) tokens.add(token);
  }
  return tokens;
}

function copyRequestHeaders(request: Request): Headers {
  const headers = new Headers();
  const connectionHeaders = connectionScopedHeaders(request.headers);
  for (const reserved of RESERVED_BROWSER_HEADERS) {
    if (request.headers.has(reserved)) {
      throw new BffRequestError(400, "BFF_RESERVED_HEADER_REJECTED");
    }
  }

  for (const [name, value] of request.headers.entries()) {
    const normalizedName = name.toLowerCase();
    if (
      !REQUEST_HEADER_ALLOWLIST.has(normalizedName)
      || connectionHeaders.has(normalizedName)
      || value.length > MAX_HEADER_VALUE_LENGTH
      || CONTROL_CHARACTER_PATTERN.test(value)
    ) {
      continue;
    }
    headers.set(normalizedName, value);
  }
  return headers;
}

function trustedVercelClientIp(request: Request): string | null {
  if (process.env.VERCEL !== "1") return null;

  const candidate = request.headers.get("x-vercel-forwarded-for");
  if (
    !candidate
    || candidate !== candidate.trim()
    || candidate.length > 45
    || candidate.includes(",")
    || candidate.includes("%")
    || CONTROL_CHARACTER_PATTERN.test(candidate)
    || isIP(candidate) === 0
  ) {
    return null;
  }
  return candidate;
}

interface HealthcareSecurityCookies {
  session: string | null;
  csrf: string | null;
}

function parseHealthcareSecurityCookies(cookieHeader: string | null): HealthcareSecurityCookies {
  const selected: HealthcareSecurityCookies = { session: null, csrf: null };
  if (!cookieHeader) return selected;
  if (cookieHeader.length > MAX_HEADER_VALUE_LENGTH || CONTROL_CHARACTER_PATTERN.test(cookieHeader)) {
    throw new BffRequestError(400, "BFF_COOKIE_INVALID");
  }

  for (const rawPart of cookieHeader.split(";")) {
    const part = rawPart.trim();
    if (!part) continue;
    const separator = part.indexOf("=");
    if (separator < 1) throw new BffRequestError(400, "BFF_COOKIE_INVALID");
    const name = part.slice(0, separator).trim();
    if (!COOKIE_NAME_PATTERN.test(name)) throw new BffRequestError(400, "BFF_COOKIE_INVALID");
    if (name !== SESSION_COOKIE_NAME && name !== CSRF_COOKIE_NAME) continue;

    const value = part.slice(separator + 1).trim();
    if (
      !value
      || value.length > 256
      || !SECURITY_COOKIE_VALUE_PATTERN.test(value)
      || CONTROL_CHARACTER_PATTERN.test(value)
    ) {
      throw new BffRequestError(400, "BFF_COOKIE_INVALID");
    }
    const key = name === SESSION_COOKIE_NAME ? "session" : "csrf";
    if (selected[key] !== null) throw new BffRequestError(400, "BFF_COOKIE_INVALID");
    selected[key] = value;
  }
  return selected;
}

function serializeHealthcareSecurityCookies(cookies: HealthcareSecurityCookies): string | null {
  const values: string[] = [];
  if (cookies.session) values.push(`${SESSION_COOKIE_NAME}=${cookies.session}`);
  if (cookies.csrf) values.push(`${CSRF_COOKIE_NAME}=${cookies.csrf}`);
  return values.length > 0 ? values.join("; ") : null;
}

async function boundedRequestBody(request: Request, signal?: AbortSignal): Promise<ArrayBuffer | undefined> {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return undefined;
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    if (!/^\d+$/u.test(declaredLength)) throw new BffRequestError(400, "BFF_BODY_LENGTH_INVALID");
    if (Number(declaredLength) > MAX_REQUEST_BYTES) {
      throw new BffRequestError(413, "BFF_BODY_TOO_LARGE");
    }
  }
  if (!request.body) return undefined;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await readBodyChunk(reader, signal);
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BYTES) {
        try {
          await reader.cancel("BFF_BODY_TOO_LARGE");
        } catch {
          // The bounded rejection remains authoritative even if cancellation races with disconnect.
        }
        throw new BffRequestError(413, "BFF_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) return undefined;
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

function bodyReadTimeoutError(): BffRequestError {
  return new BffRequestError(408, "BFF_BODY_TIMEOUT");
}

async function readBodyChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (!signal) return reader.read();
  if (signal.aborted) throw bodyReadTimeoutError();

  let abortHandler: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    abortHandler = () => {
      void reader.cancel("BFF_BODY_TIMEOUT");
      reject(bodyReadTimeoutError());
    };
    signal.addEventListener("abort", abortHandler, { once: true });
  });
  try {
    return await Promise.race([reader.read(), abortPromise]);
  } finally {
    if (abortHandler) signal.removeEventListener("abort", abortHandler);
  }
}

function splitCombinedSetCookie(value: string): string[] {
  return value.split(/,(?=\s*[!#$%&'*+.^_`|~0-9A-Za-z-]+=)/u).map((cookie) => cookie.trim());
}

function getSetCookieValues(headers: Headers): string[] {
  const extendedHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof extendedHeaders.getSetCookie === "function") return extendedHeaders.getSetCookie();
  const combined = headers.get("set-cookie");
  return combined ? splitCombinedSetCookie(combined) : [];
}

function allowlistedSetCookie(rawCookie: string): string | null {
  if (!rawCookie || CONTROL_CHARACTER_PATTERN.test(rawCookie)) return null;
  const parts = rawCookie.split(";").map((part) => part.trim());
  const pair = parts.shift() ?? "";
  const separator = pair.indexOf("=");
  if (separator < 1) return null;

  const name = pair.slice(0, separator).trim();
  if (name !== SESSION_COOKIE_NAME && name !== CSRF_COOKIE_NAME) return null;
  const value = pair.slice(separator + 1).trim();
  if (value && (!SECURITY_COOKIE_VALUE_PATTERN.test(value) || value.length > 256)) return null;

  const attributes = new Map<string, string | null>();
  for (const part of parts) {
    if (!part) continue;
    const attributeSeparator = part.indexOf("=");
    const attributeName = (attributeSeparator < 0 ? part : part.slice(0, attributeSeparator)).trim().toLowerCase();
    const attributeValue = attributeSeparator < 0 ? null : part.slice(attributeSeparator + 1).trim();
    if (!RESPONSE_COOKIE_ATTRIBUTES.has(attributeName) || attributes.has(attributeName)) return null;
    if (attributeValue !== null && CONTROL_CHARACTER_PATTERN.test(attributeValue)) return null;
    attributes.set(attributeName, attributeValue);
  }

  if (attributes.get("path") !== "/" || !attributes.has("secure")) return null;
  if (attributes.get("secure") !== null) return null;
  if (attributes.get("samesite")?.toLowerCase() !== "lax") return null;
  if (attributes.has("max-age") && !/^-?\d+$/u.test(attributes.get("max-age") ?? "")) return null;
  if (attributes.has("expires") && !Number.isFinite(Date.parse(attributes.get("expires") ?? ""))) return null;

  if (name === SESSION_COOKIE_NAME) {
    if (attributes.get("httponly") !== null) return null;
  } else if (attributes.has("httponly")) {
    return null;
  }

  // Empty values are only valid for an explicit deletion response.
  if (!value && attributes.get("max-age") !== "0") return null;
  return rawCookie;
}

function createBrowserResponse(
  upstream: Response,
  requestMethod: string,
  onBodySettled?: () => void,
): Response {
  const headers = new Headers();
  for (const [name, value] of upstream.headers.entries()) {
    if (RESPONSE_HEADER_ALLOWLIST.has(name.toLowerCase())) headers.set(name, value);
  }
  for (const cookie of getSetCookieValues(upstream.headers)) {
    const safeCookie = allowlistedSetCookie(cookie);
    if (safeCookie) headers.append("Set-Cookie", safeCookie);
  }
  headers.set("Cache-Control", "no-store");

  const withoutBody = requestMethod === "HEAD" || upstream.status === 204 || upstream.status === 304;
  if (withoutBody || !upstream.body || !onBodySettled) {
    onBodySettled?.();
    return new Response(withoutBody ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  }

  const reader = upstream.body.getReader();
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    onBodySettled();
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
          settle();
        } else if (chunk.value) {
          controller.enqueue(chunk.value);
        }
      } catch (error) {
        controller.error(error);
        settle();
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        settle();
      }
    },
  });
  return new Response(body, {
    status: upstream.status,
    headers,
  });
}

export async function proxyHealthcareRequest(
  request: Request,
  pathSegments: readonly string[],
  options: HealthcareBffProxyOptions = {},
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return new Response(null, {
      status: 405,
      headers: { Allow: [...ALLOWED_METHODS].join(", "), "Cache-Control": "no-store" },
    });
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortFromBrowser: (() => void) | undefined;
  let responseBodyOwnsCleanup = false;
  const cleanup = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (abortFromBrowser) request.signal.removeEventListener("abort", abortFromBrowser);
  };
  try {
    const requestUrl = new URL(request.url);
    const apiPath = buildValidatedApiPath(requestUrl, pathSegments);
    if (BLOCKED_BEARER_MINT_PATHS.has(apiPath.toLowerCase())) {
      return jsonError(404, "BFF_ROUTE_UNAVAILABLE");
    }

    const runtime = options.runtimeConfig ?? readHealthcareBffRuntimeConfig();
    if (!isValidServiceToken(runtime.serviceToken)) {
      throw new BffRequestError(503, "BFF_CONFIGURATION_UNAVAILABLE");
    }
    const browserOrigin = normalizedBrowserOrigin(request, runtime.publicOrigin);
    const target = new URL(`${apiPath}${requestUrl.search}`, `${runtime.backendOrigin}/`);
    if (target.origin !== normalizeBackendOrigin(runtime.backendOrigin)) {
      throw new BffRequestError(400, "BFF_TARGET_INVALID");
    }

    const securityCookies = parseHealthcareSecurityCookies(request.headers.get("cookie"));
    const headers = copyRequestHeaders(request);
    const upstreamOrigin = process.env.BACKEND_ORIGIN_OVERRIDE?.trim() || browserOrigin;
    headers.set("X-Healthcare-Bff-Token", runtime.serviceToken);
    headers.set("X-Healthcare-Original-Origin", upstreamOrigin);
    const securityCookieHeader = serializeHealthcareSecurityCookies(securityCookies);
    if (securityCookieHeader) headers.set("Cookie", securityCookieHeader);
    const clientIp = trustedVercelClientIp(request);
    if (clientIp) headers.set("X-Healthcare-Client-IP", clientIp);
    if (!SAFE_METHODS.has(method) && securityCookies.csrf) {
      headers.set("X-CSRF-Token", securityCookies.csrf);
    }

    const requestController = new AbortController();
    abortFromBrowser = () => requestController.abort(request.signal.reason);
    if (request.signal.aborted) abortFromBrowser();
    else request.signal.addEventListener("abort", abortFromBrowser, { once: true });
    const requestTimeoutMs = apiPath === `${API_PREFIX}public/ai/chat`
      ? runtime.publicAiRequestTimeoutMs ?? runtime.requestTimeoutMs
      : apiPath.endsWith("/messages/stream")
      ? runtime.streamRequestTimeoutMs ?? runtime.requestTimeoutMs
      : runtime.requestTimeoutMs;
    timeoutId = setTimeout(() => requestController.abort(), requestTimeoutMs);
    const body = await boundedRequestBody(request, requestController.signal);

    const upstream = await (options.fetchImpl ?? fetch)(target, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
       signal: requestController.signal,
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return jsonError(502, "BFF_UPSTREAM_REDIRECT_REJECTED");
    }
    const response = createBrowserResponse(upstream, method, cleanup);
    responseBodyOwnsCleanup = true;
    return response;
  } catch (error) {
    if (error instanceof BffRequestError) return jsonError(error.status, error.code);
    return jsonError(502, "BFF_UPSTREAM_UNAVAILABLE");
  } finally {
    if (!responseBodyOwnsCleanup) cleanup();
  }
}
