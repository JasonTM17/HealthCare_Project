import "server-only";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";

const API_PREFIX = "/api/v1/";
const DEFAULT_BACKEND_ORIGIN = "http://127.0.0.1:8080";
const DEFAULT_REQUEST_TIMEOUT_MS = 25_000;
// Deadline ownership constraint: THIS layer owns the upstream deadline and
// answers the browser with a structured payload (public-chat fallback answer
// or JSON error). The browser deadlines in lib/api-client.ts must stay
// slightly LONGER than the matching constant here so this payload — not a
// client-side network abort — reaches the UI. Keep the pairs in sync:
//   authenticated chat: BFF 30s -> browser 33s
//   public chat:        BFF 35s -> browser 40s
// The public window stays well inside the Route Handler maxDuration of 60s
// (Vercel Hobby) while halving the old 55s worst-case dead wait; the graceful
// fallback plus retry covers the shortened cold-start window.
const DEFAULT_STREAM_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_PUBLIC_AI_REQUEST_TIMEOUT_MS = 35_000;
// A Render Free backend that is waking up answers through its router with 502
// (or refuses the connection outright) until the instance is listening: the
// measured cold window is ~26 s. One retry inside the SAME absolute deadline
// turns that race into a served response instead of a user-visible
// BFF_UPSTREAM_UNAVAILABLE.
const RETRY_BACKOFF_MS = 400;
const RETRYABLE_UPSTREAM_STATUSES = new Set([502, 504]);
// Only GET/HEAD are retried: they carry no request body and cannot duplicate a
// mutation. POST/PUT/PATCH/DELETE keep their exact previous behaviour,
// including the public-chat fallback answer for an unavailable AI upstream.
const RETRYABLE_METHODS = new Set(["GET", "HEAD"]);
// Below this much remaining budget a retry cannot plausibly finish, so the
// first answer is surfaced instead of burning the caller's deadline.
const RETRY_MIN_REMAINING_MS = 1_000;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_PATH_LENGTH = 2_048;
const MAX_HEADER_VALUE_LENGTH = 16_384;
const MIN_SERVICE_TOKEN_BYTES = 32;
const MAX_SERVICE_TOKEN_BYTES = 512;
const PUBLIC_AI_CHAT_PATH = `${API_PREFIX}public/ai/chat`;
const PATIENT_AI_CHAT_PATTERN = /^\/api\/v1\/ai\/conversations\/[^/]+\/messages(?:\/stream)?$/u;
const INTERNAL_CHAT_CANCEL_PATH = "/api/v1/internal/ai/chat-cancellations";
const CHAT_CANCEL_NOTIFY_TIMEOUT_MS = 750;
const PUBLIC_AI_FALLBACK_STATUSES = new Set([502, 503, 504]);
const EMERGENCY_FALLBACK_TERMS = [
  "dau nguc du doi",
  "that nguc",
  "dau nguc lan",
  "kho tho",
  "khong tho duoc",
  "meo mieng",
  "yeu liet",
  "liet nua nguoi",
  "ngat",
  "chay mau khong cam",
  "co giat",
  "tu tu",
  "tu sat",
  "muon chet",
  "dot quy",
  "tai bien",
  "dau tim",
  "nhoi mau co tim",
  "nhoi mau tim",
  "ngung tho",
  "ngung tim",
  "bat tinh",
  "mat y thuc",
  "va mo hoi lanh",
  "mo mat dot ngot",
  "soc phan ve",
  "ngo doc",
  "stroke",
  "heart attack",
  "cardiac arrest",
  "unconscious",
  "end my life",
  "kill myself",
  "chest pain",
  "shortness of breath",
  "severe bleeding",
] as const;
const REQUEST_ID_HEADER = "X-Request-ID";

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
  "x-request-id",
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
  // Pagination contract headers emitted by the queue/list controllers
  // (AdminHealthQuestionController, AdminConsultationController, …).
  "x-has-more",
  "x-page",
  "x-page-size",
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

function likelyEmergencyFallback(message: string): boolean {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/gu, "")
    .replace(/[đĐ]/gu, "d")
    .toLowerCase().replace(/\s+/gu, " ").trim();
  return EMERGENCY_FALLBACK_TERMS.some((term) => normalized.includes(term));
}

function publicAiChatFallbackResponse(message = ""): Response {
  const emergency = likelyEmergencyFallback(message);
  return Response.json(
    {
      answer: emergency
        ? "Triệu chứng bạn mô tả có thể cần được đánh giá khẩn cấp. Hãy gọi 115 hoặc đến cơ sở cấp cứu gần nhất ngay; không chờ trợ lý AI."
        : "Trợ lý chưa thể trả lời lúc này. Dưới đây là hướng dẫn tạm thời: bạn có thể thử lại sau hoặc tra cứu chuyên khoa, bác sĩ, gói khám và đặt lịch trực tiếp trên website.",
      disclaimer: "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế tư vấn, chẩn đoán hoặc điều trị của bác sĩ.",
      citations: [],
      provenance: "local_fallback",
      mode: "HOSPITAL_SUPPORT",
      safety_action: emergency ? "EMERGENCY" : "INSUFFICIENT_EVIDENCE",
      suggested_actions: emergency
        ? [{ kind: "CALL_EMERGENCY", label: "Gọi 115", href: "tel:115" }]
        : [
            { kind: "START_BOOKING", label: "Đặt lịch khám", href: "/dat-lich" },
            { kind: "VIEW_SOURCE", label: "Xem Chuyên khoa", href: "/specialties" },
            { kind: "VIEW_SOURCE", label: "Xem Cơ sở", href: "/branches" },
          ],
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

type BffTraceOutcome = "completed" | "cancelled" | "failed" | "fallback" | "timeout";

function isChatDeliveryPath(apiPath: string | undefined): boolean {
  if (!apiPath) return false;
  return apiPath === PUBLIC_AI_CHAT_PATH
    || (
      apiPath.startsWith(`${API_PREFIX}ai/conversations/`)
      && (apiPath.endsWith("/messages") || apiPath.endsWith("/messages/stream"))
    );
}

/**
 * Emit one content-free timing record per chat request. Request bodies, user,
 * conversation and provider data are deliberately excluded from this record.
 */
function recordChatTrace(
  apiPath: string | undefined,
  requestId: string,
  startedAt: number,
  outcome: BffTraceOutcome,
  status: number,
): void {
  if (!isChatDeliveryPath(apiPath)) return;
  console.info("healthcare_chat_stage", {
    durationMs: Math.max(0, Date.now() - startedAt),
    outcome,
    requestId,
    stage: "bff",
    status,
  });
}

async function cancelUpstreamBody(upstream: Response, reason: string): Promise<void> {
  if (!upstream.body) return;
  try {
    await upstream.body.cancel(reason);
  } catch {
    // The local fallback/error response is authoritative even when the
    // upstream stream has already closed or races with cancellation.
  }
}

/**
 * Wait for the retry backoff, but never for longer than the request lives: an
 * abort (browser disconnect or deadline) resolves the wait immediately so the
 * retry loop observes `canRetry()` as false instead of sleeping past its
 * budget.
 */
function waitForRetryBackoff(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const settle = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", settle);
      resolve();
    };
    const timer = setTimeout(settle, RETRY_BACKOFF_MS);
    signal.addEventListener("abort", settle, { once: true });
  });
}

/**
 * Emit one content-free record when a safe read is retried. The path and query
 * are deliberately excluded; only the outcome shape is recorded.
 */
function recordUpstreamRetry(requestId: string, reason: string, status?: number): void {
  console.warn("healthcare_bff_upstream_retry", {
    attempt: 2,
    reason,
    requestId,
    status: status ?? null,
  });
}

interface UpstreamRetryOptions {
  /** False for every non-retryable method (see RETRYABLE_METHODS). */
  allowed: boolean;
  /** Re-evaluated between attempts: false once the deadline or browser aborts. */
  canRetry: () => boolean;
  requestId: string;
  signal: AbortSignal;
}

/**
 * Run one upstream attempt, and for safe reads exactly one more when the first
 * answer is a retryable 502/504 or the fetch itself fails at the network layer.
 *
 * The absolute request deadline is never extended: the caller keeps its single
 * timer, so a retry consumes the remaining budget instead of adding to the
 * worst case. Returns null when the first response had to be discarded and the
 * retry can no longer run, which the caller answers with its own structured
 * BFF_UPSTREAM_UNAVAILABLE.
 */
async function fetchUpstreamWithRetry(
  attempt: () => Promise<Response>,
  options: UpstreamRetryOptions,
): Promise<Response | null> {
  if (!options.allowed) return attempt();

  let response: Response;
  try {
    response = await attempt();
  } catch (error) {
    if (!options.canRetry()) throw error;
    recordUpstreamRetry(options.requestId, "network_error");
    await waitForRetryBackoff(options.signal);
    if (!options.canRetry()) throw error;
    return attempt();
  }

  if (!RETRYABLE_UPSTREAM_STATUSES.has(response.status) || !options.canRetry()) return response;

  recordUpstreamRetry(options.requestId, "upstream_status", response.status);
  await cancelUpstreamBody(response, "BFF_UPSTREAM_RETRY");
  await waitForRetryBackoff(options.signal);
  if (!options.canRetry()) return null;
  return attempt();
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
  // The backend origin is deployment configuration, not code: local runs use
  // DEFAULT_BACKEND_ORIGIN and hosted environments must set BACKEND_INTERNAL_URL
  // explicitly (Vercel/Docker), so no environment name or URL is hardcoded here.
  const rawBackend = process.env.BACKEND_INTERNAL_URL?.trim();
  const backendOrigin = normalizeBackendOrigin(
    rawBackend || DEFAULT_BACKEND_ORIGIN,
  );
  const configuredPublicOrigin = process.env.BFF_PUBLIC_ORIGIN?.trim();
  const defaultOrigins = "https://healthcare.id.vn,https://www.healthcare.id.vn";
  const mergedPublicOrigins = configuredPublicOrigin
    ? `${configuredPublicOrigin},${defaultOrigins}`
    : defaultOrigins;
  const publicOrigins = parseConfiguredPublicOrigins(mergedPublicOrigins);
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

  if (normalized !== requestOrigin) {
    throw new BffRequestError(403, "BFF_ORIGIN_INVALID");
  }
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

function readPublicChatMessage(body: ArrayBuffer | undefined): string {
  if (!body) return "";
  try {
    const parsed = JSON.parse(Buffer.from(body).toString("utf8")) as { message?: unknown };
    return typeof parsed.message === "string" ? parsed.message.slice(0, 500) : "";
  } catch {
    return "";
  }
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
  onBodySettled?: (outcome: "completed" | "cancelled" | "failed") => void | Promise<void>,
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
    void onBodySettled?.("completed");
    return new Response(withoutBody ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  }

  const reader = upstream.body.getReader();
  let settled = false;
  let cancellationRequested = false;
  const settle = async (outcome: "completed" | "cancelled" | "failed") => {
    if (settled) return;
    settled = true;
    await onBodySettled(outcome);
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
          await settle("completed");
        } else if (chunk.value) {
          controller.enqueue(chunk.value);
        }
      } catch (error) {
        controller.error(error);
        await settle(cancellationRequested ? "cancelled" : "failed");
      }
    },
    async cancel(reason) {
      cancellationRequested = true;
      // Start cancellation delivery before waiting for the upstream body to
      // acknowledge its own cancellation. The shared state tombstone is what
      // prevents Spring from persisting work after this response disconnects.
      const settlement = settle("cancelled");
      try {
        void reader.cancel(reason).catch(() => undefined);
      } finally {
        await settlement;
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
  const requestId = randomUUID();
  const traceStartedAt = Date.now();
  let apiPath: string | undefined;
  const tracedResponse = (response: Response, outcome: BffTraceOutcome): Response => {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    recordChatTrace(apiPath, requestId, traceStartedAt, outcome, response.status);
    return response;
  };
  const method = request.method.toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return tracedResponse(new Response(null, {
      status: 405,
      headers: { Allow: [...ALLOWED_METHODS].join(", "), "Cache-Control": "no-store" },
    }), "failed");
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortFromBrowser: (() => void) | undefined;
  let cancellationNotification: Promise<void> | undefined;
  let responseBodyOwnsCleanup = false;
  let publicChatMessage = "";
  let deadlineExpired = false;
  let browserAborted = false;
  const interruptedOutcome = (fallback: BffTraceOutcome): BffTraceOutcome =>
    deadlineExpired ? "timeout" : browserAborted ? "cancelled" : fallback;
  const cleanup = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (abortFromBrowser) request.signal.removeEventListener("abort", abortFromBrowser);
  };
  try {
    const requestUrl = new URL(request.url);
    apiPath = buildValidatedApiPath(requestUrl, pathSegments);
    if (apiPath === INTERNAL_CHAT_CANCEL_PATH || apiPath.startsWith(`${INTERNAL_CHAT_CANCEL_PATH}/`)) {
      return tracedResponse(jsonError(404, "BFF_ROUTE_UNAVAILABLE"), "failed");
    }
    if (BLOCKED_BEARER_MINT_PATHS.has(apiPath.toLowerCase())) {
      return tracedResponse(jsonError(404, "BFF_ROUTE_UNAVAILABLE"), "failed");
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
    headers.set(REQUEST_ID_HEADER, requestId);
    const securityCookieHeader = serializeHealthcareSecurityCookies(securityCookies);
    if (securityCookieHeader) headers.set("Cookie", securityCookieHeader);
    const clientIp = trustedVercelClientIp(request);
    if (clientIp) headers.set("X-Healthcare-Client-IP", clientIp);
    if (!SAFE_METHODS.has(method) && securityCookies.csrf) {
      headers.set("X-CSRF-Token", securityCookies.csrf);
    }

    const isCancellableChatRequest = apiPath === PUBLIC_AI_CHAT_PATH
      || PATIENT_AI_CHAT_PATTERN.test(apiPath);
    const notifyBackendCancellation = () => {
      if (!isCancellableChatRequest || cancellationNotification) return;
      cancellationNotification = (async () => {
        const cancelHeaders = new Headers(headers);
        cancelHeaders.set(REQUEST_ID_HEADER, requestId);
        cancelHeaders.delete("authorization");
        const cancellationTarget = new URL(
          `${INTERNAL_CHAT_CANCEL_PATH}/${encodeURIComponent(requestId)}`,
          `${runtime.backendOrigin}/`,
        );
        let delivered = false;
        let lastStatus: number | undefined;
        for (let attempt = 0; attempt < 2 && !delivered; attempt += 1) {
          const cancelController = new AbortController();
          const cancelTimeoutId = setTimeout(
            () => cancelController.abort("chat-cancel-notification-timeout"),
            CHAT_CANCEL_NOTIFY_TIMEOUT_MS,
          );
          try {
            const cancellationResponse = await (options.fetchImpl ?? fetch)(cancellationTarget, {
              method: "POST",
              headers: cancelHeaders,
              cache: "no-store",
              redirect: "manual",
              signal: cancelController.signal,
            });
            lastStatus = cancellationResponse.status;
            delivered = cancellationResponse.ok;
            await cancelUpstreamBody(cancellationResponse, "BFF_CHAT_CANCELLATION_ACK");
          } catch {
            // Retry once with the same idempotent server-owned operation id.
          } finally {
            clearTimeout(cancelTimeoutId);
          }
        }
        if (!delivered) {
          // The original upstream fetch is still aborted below. Keep this
          // control-plane failure content-free and bounded; Spring refuses to
          // start requests when its shared cancellation state is unavailable.
          console.warn("healthcare_chat_cancel_delivery_failed", {
            requestId,
            ...(lastStatus === undefined ? {} : { status: lastStatus }),
          });
        }
      })();
    };

    const requestController = new AbortController();
    abortFromBrowser = () => {
      browserAborted = true;
      notifyBackendCancellation();
      requestController.abort(request.signal.reason);
    };
    if (request.signal.aborted) abortFromBrowser();
    else request.signal.addEventListener("abort", abortFromBrowser, { once: true });
    const requestTimeoutMs = apiPath === PUBLIC_AI_CHAT_PATH
      ? runtime.publicAiRequestTimeoutMs ?? runtime.requestTimeoutMs
      : apiPath.endsWith("/messages/stream") || apiPath.endsWith("/cms/content/events")
      ? runtime.streamRequestTimeoutMs ?? runtime.requestTimeoutMs
      : runtime.requestTimeoutMs;
    // The retry shares this single absolute deadline: it is measured from the
    // first byte of the request and is never re-armed by a second attempt.
    const retryDeadlineAt = Date.now() + requestTimeoutMs;
    timeoutId = setTimeout(() => {
      deadlineExpired = true;
      notifyBackendCancellation();
      requestController.abort();
    }, requestTimeoutMs);
    const body = await boundedRequestBody(request, requestController.signal);
    publicChatMessage = apiPath === PUBLIC_AI_CHAT_PATH ? readPublicChatMessage(body) : "";

    const retryAllowed = RETRYABLE_METHODS.has(method);
    const canRetryUpstream = () =>
      retryAllowed
      && !deadlineExpired
      && !browserAborted
      && !requestController.signal.aborted
      && retryDeadlineAt - Date.now() > RETRY_MIN_REMAINING_MS;
    const upstream = await fetchUpstreamWithRetry(
      () => (options.fetchImpl ?? fetch)(target, {
        method,
        headers,
        body,
        cache: "no-store",
        redirect: "manual",
        signal: requestController.signal,
      }),
      {
        allowed: retryAllowed,
        canRetry: canRetryUpstream,
        requestId,
        signal: requestController.signal,
      },
    );
    if (upstream === null) {
      return tracedResponse(jsonError(502, "BFF_UPSTREAM_UNAVAILABLE"), interruptedOutcome("failed"));
    }
    if (upstream.status >= 300 && upstream.status < 400) {
      await cancelUpstreamBody(upstream, "BFF_UPSTREAM_REDIRECT_REJECTED");
      return tracedResponse(jsonError(502, "BFF_UPSTREAM_REDIRECT_REJECTED"), "failed");
    }
    if (method === "POST" && apiPath === PUBLIC_AI_CHAT_PATH && PUBLIC_AI_FALLBACK_STATUSES.has(upstream.status)) {
      await cancelUpstreamBody(upstream, "BFF_PUBLIC_AI_FALLBACK");
      return tracedResponse(publicAiChatFallbackResponse(publicChatMessage), "fallback");
    }
    const response = createBrowserResponse(upstream, method, async (outcome) => {
      let cancellationWait: Promise<void> | undefined;
      if (outcome !== "completed") {
        notifyBackendCancellation();
        requestController.abort(outcome);
        cancellationWait = cancellationNotification;
      }
      recordChatTrace(
        apiPath,
        requestId,
        traceStartedAt,
        interruptedOutcome(outcome),
        upstream.status,
      );
      if (cancellationWait) await cancellationWait;
      cleanup();
    });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    responseBodyOwnsCleanup = true;
    return response;
  } catch (error) {
    if (error instanceof BffRequestError) {
      return tracedResponse(jsonError(error.status, error.code), interruptedOutcome("failed"));
    }
    if (method === "POST" && apiPath === PUBLIC_AI_CHAT_PATH) {
      return tracedResponse(publicAiChatFallbackResponse(publicChatMessage), interruptedOutcome("fallback"));
    }
    return tracedResponse(jsonError(502, "BFF_UPSTREAM_UNAVAILABLE"), interruptedOutcome("failed"));
  } finally {
    if (!responseBodyOwnsCleanup) {
      cleanup();
      if (cancellationNotification) await cancellationNotification;
    }
  }
}
