import { readAuthSession } from "./api-client";

/**
 * Typed client for the slot-scoped CMS contract.
 *
 * The backend stores one validated component per slot. This module is live
 * only: it never fabricates a page or falls back to deterministic mock data.
 */

export const CMS_PUBLICATION_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export const CMS_PAGE_STATES = CMS_PUBLICATION_STATUSES;
export type CmsPublicationStatus = (typeof CMS_PUBLICATION_STATUSES)[number];
export type CmsPageState = CmsPublicationStatus;

/** Stable UI slots are mapped to backend keys, e.g. home + hero -> homepage.hero. */
export const CMS_SLOT_KEYS = ["hero", "body", "sidebar", "footer"] as const;
export type CmsSlotKey = (typeof CMS_SLOT_KEYS)[number];

/** Canonical non-home public route families that expose the shared CMS frame. */
export const CMS_PUBLIC_ROUTE_SLUGS = [
  "about",
  "branches",
  "specialties",
  "doctors",
  "services",
  "packages",
  "articles",
  "careers",
  "search",
  "dat-lich",
  "contact",
  "faq",
  "huong-dan",
  "tra-cuu",
] as const;
export type CmsPublicRouteSlug = (typeof CMS_PUBLIC_ROUTE_SLUGS)[number];

export const CMS_COMPONENT_TYPES = [
  "HERO",
  "RICH_TEXT",
  "CTA_BANNER",
  "NOTICE",
  "IMAGE_CARD",
] as const;
export const CMS_COMPONENT_KEYS = CMS_COMPONENT_TYPES;
export type CmsComponentType = (typeof CMS_COMPONENT_TYPES)[number];
export type CmsComponentKey = CmsComponentType;

export const CMS_SLOT_COMPONENT_TYPES = {
  hero: ["HERO"],
  body: ["RICH_TEXT", "CTA_BANNER", "NOTICE"],
  sidebar: ["RICH_TEXT", "CTA_BANNER", "NOTICE", "IMAGE_CARD"],
  footer: ["RICH_TEXT", "CTA_BANNER", "NOTICE"],
} as const satisfies Record<CmsSlotKey, readonly CmsComponentType[]>;

export function cmsComponentTypesForSlot(slotKey: CmsSlotKey): readonly CmsComponentType[] {
  return CMS_SLOT_COMPONENT_TYPES[slotKey];
}

export function isCmsComponentAllowedForSlot(
  slotKey: CmsSlotKey,
  componentType: CmsComponentType,
): boolean {
  return (CMS_SLOT_COMPONENT_TYPES[slotKey] as readonly string[]).includes(componentType);
}

export interface CmsHeroPayload {
  eyebrow?: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
}

export interface CmsRichTextPayload {
  title: string;
  body: string;
}

export interface CmsCtaBannerPayload {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface CmsNoticePayload {
  title: string;
  body: string;
}

export interface CmsImageCardPayload {
  title: string;
  body?: string;
  imageUrl: string;
  href?: string;
}

export type CmsPayload =
  | CmsHeroPayload
  | CmsRichTextPayload
  | CmsCtaBannerPayload
  | CmsNoticePayload
  | CmsImageCardPayload;

interface CmsContentBase {
  slotKey: string;
  status: CmsPublicationStatus;
  version: number;
  updatedAt: string;
}

export type CmsContent = CmsContentBase & (
  | { componentType: "HERO"; payload: CmsHeroPayload }
  | { componentType: "RICH_TEXT"; payload: CmsRichTextPayload }
  | { componentType: "CTA_BANNER"; payload: CmsCtaBannerPayload }
  | { componentType: "NOTICE"; payload: CmsNoticePayload }
  | { componentType: "IMAGE_CARD"; payload: CmsImageCardPayload }
);

export interface CmsContentHistoryEntry {
  eventId: number;
  slotKey: string;
  componentType: CmsComponentType | null;
  status: CmsPublicationStatus | null;
  payload: CmsPayload | null;
  version: number;
  actorEmail: string | null;
  changedAt: string;
  rollbackAvailable: boolean;
}

export interface CmsContentInput {
  componentType: CmsComponentType;
  payload: CmsPayload;
  status: CmsPublicationStatus;
  expectedVersion: number;
}

export interface CmsRollbackInput {
  changeId: number;
  expectedVersion: number;
}

export interface CmsPublishedContentReadOptions {
  /** Durable SSE cursor that requires a cache-bypassing reconciliation read. */
  afterEventId?: number;
}

export type CmsFieldErrors = Record<string, string>;

export type CmsApiErrorKind =
  | "auth"
  | "forbidden"
  | "validation"
  | "conflict"
  | "not-found"
  | "network"
  | "server"
  | "unavailable"
  | "unknown";

export class CmsApiError extends Error {
  readonly kind: CmsApiErrorKind;
  readonly status: number;
  readonly fieldErrors?: CmsFieldErrors;

  constructor(
    kind: CmsApiErrorKind,
    status: number,
    message: string,
    fieldErrors?: CmsFieldErrors,
  ) {
    super(message);
    this.name = "CmsApiError";
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export class CmsValidationError extends CmsApiError {
  constructor(message: string, fieldErrors?: CmsFieldErrors) {
    super("validation", 400, message, fieldErrors);
    this.name = "CmsValidationError";
  }
}

export interface CmsContentChangedEvent {
  type: "cms-content-changed";
  eventId: number;
  slotKey: string;
  version: number;
  published: boolean;
  updatedAt: string;
}

export interface CmsFeedReadyEvent {
  latestEventId: number;
  replayLimit: number;
  snapshotFallback: string;
}

export interface CmsFeedResyncEvent {
  latestEventId: number;
  reason: string;
  snapshotFallback: string;
}

export interface CmsHeartbeatEvent {
  at: string;
  latestEventId: number;
}

export interface CmsChangeSubscriptionOptions {
  after?: number;
  onChange: (event: CmsContentChangedEvent) => void;
  onConnected?: (ready?: CmsFeedReadyEvent) => void;
  onResync?: (event: CmsFeedResyncEvent) => void;
  onHeartbeat?: (event: CmsHeartbeatEvent) => void;
  onFallback?: () => void;
}

export interface CmsClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getAccessToken?: () => string | null | Promise<string | null>;
  eventSourceFactory?: (url: string) => EventSource;
}

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_CMS_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "/api/v1";

const SLOT_KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const MAX_TEXT_LENGTH = 4_000;
const LINK_FIELDS = new Set(["ctaHref", "href", "imageUrl"]);
const UNSAFE_TEXT = /(<|>|javascript\s*:|data\s*:)/i;

const PAYLOAD_SCHEMAS: Record<CmsComponentType, {
  allowed: readonly string[];
  required: readonly string[];
}> = {
  HERO: {
    allowed: ["eyebrow", "title", "body", "ctaLabel", "ctaHref", "imageUrl"],
    required: ["title"],
  },
  RICH_TEXT: { allowed: ["title", "body"], required: ["title", "body"] },
  CTA_BANNER: {
    allowed: ["title", "body", "ctaLabel", "ctaHref"],
    required: ["title", "body", "ctaLabel", "ctaHref"],
  },
  NOTICE: { allowed: ["title", "body"], required: ["title", "body"] },
  IMAGE_CARD: {
    allowed: ["title", "body", "imageUrl", "href"],
    required: ["title", "imageUrl"],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new CmsValidationError(`${label} phải là object.`);
  return value;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function readRequiredText(
  value: Record<string, unknown>,
  key: string,
  label: string,
): string {
  if (typeof value[key] !== "string") {
    throw new CmsValidationError(`${label}.${key} phải là chuỗi không rỗng.`, {
      [`payload.${key}`]: "Trường này là bắt buộc.",
    });
  }
  return normalizeText(value[key] as string, `${label}.${key}`);
}

function readOptionalText(
  value: Record<string, unknown>,
  key: string,
  label: string,
): string | undefined {
  if (!hasOwn(value, key) || value[key] === undefined) return undefined;
  if (typeof value[key] !== "string") {
    throw new CmsValidationError(`${label}.${key} phải là chuỗi.`);
  }
  return normalizeText(value[key] as string, `${label}.${key}`);
}

function normalizeText(value: string, label: string): string {
  const text = value.trim();
  if (!text || text.length > MAX_TEXT_LENGTH) {
    throw new CmsValidationError(`${label} có độ dài không hợp lệ.`, {
      [`payload.${label.split(".").at(-1)}`]: `Từ 1 đến ${MAX_TEXT_LENGTH} ký tự.`,
    });
  }
  if (UNSAFE_TEXT.test(text) || [...text].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 32 && code !== 9 && code !== 10 && code !== 13;
  })) {
    throw new CmsValidationError(`${label} chứa markup, scheme hoặc ký tự không an toàn.`);
  }
  return text;
}

export function isSafeCmsUrl(value: string): boolean {
  const candidate = value.trim();
  if (candidate.startsWith("/")) {
    return !candidate.startsWith("//") && !candidate.includes("\\");
  }
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && Boolean(url.host) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function assertSafeCmsUrl(value: string, field: string): void {
  if (!isSafeCmsUrl(value)) {
    throw new CmsValidationError(`${field} chỉ được dùng đường dẫn nội bộ hoặc HTTPS URL.`, {
      [`payload.${field}`]: "URL không an toàn hoặc không được hỗ trợ.",
    });
  }
}

function readPayload(raw: unknown, componentType: CmsComponentType): CmsPayload {
  const payload = readRecord(raw, "payload");
  const schema = PAYLOAD_SCHEMAS[componentType];
  const keys = Object.keys(payload);
  if (keys.length > 12) throw new CmsValidationError("payload có quá nhiều trường.");

  for (const key of keys) {
    if (!schema.allowed.includes(key)) {
      throw new CmsValidationError(`payload.${key} không thuộc schema ${componentType}.`, {
        [`payload.${key}`]: "Trường không được phép.",
      });
    }
    if (typeof payload[key] !== "string") {
      throw new CmsValidationError(`payload.${key} phải là chuỗi.`);
    }
    const text = normalizeText(payload[key] as string, `payload.${key}`);
    if (LINK_FIELDS.has(key)) assertSafeCmsUrl(text, key);
  }
  for (const required of schema.required) {
    if (!hasOwn(payload, required)) {
      throw new CmsValidationError(`payload.${required} là bắt buộc.`, {
        [`payload.${required}`]: "Trường này là bắt buộc.",
      });
    }
  }

  switch (componentType) {
    case "HERO":
      return {
        eyebrow: readOptionalText(payload, "eyebrow", "payload"),
        title: readRequiredText(payload, "title", "payload"),
        body: readOptionalText(payload, "body", "payload"),
        ctaLabel: readOptionalText(payload, "ctaLabel", "payload"),
        ctaHref: readOptionalText(payload, "ctaHref", "payload"),
        imageUrl: readOptionalText(payload, "imageUrl", "payload"),
      };
    case "RICH_TEXT":
      return {
        title: readRequiredText(payload, "title", "payload"),
        body: readRequiredText(payload, "body", "payload"),
      };
    case "CTA_BANNER":
      return {
        title: readRequiredText(payload, "title", "payload"),
        body: readRequiredText(payload, "body", "payload"),
        ctaLabel: readRequiredText(payload, "ctaLabel", "payload"),
        ctaHref: readRequiredText(payload, "ctaHref", "payload"),
      };
    case "NOTICE":
      return {
        title: readRequiredText(payload, "title", "payload"),
        body: readRequiredText(payload, "body", "payload"),
      };
    case "IMAGE_CARD":
      return {
        title: readRequiredText(payload, "title", "payload"),
        body: readOptionalText(payload, "body", "payload"),
        imageUrl: readRequiredText(payload, "imageUrl", "payload"),
        href: readOptionalText(payload, "href", "payload"),
      };
  }
}

function validateSlotKey(slotKey: string): string {
  const normalized = slotKey.trim();
  if (!normalized || normalized.length > 120 || !SLOT_KEY_PATTERN.test(normalized)) {
    throw new CmsValidationError("slotKey chỉ được dùng chữ thường, số, dấu chấm, gạch ngang hoặc gạch dưới.", {
      slotKey: "slotKey không hợp lệ.",
    });
  }
  return normalized;
}

export function resolveCmsSlotKey(slug: string, slotKey: CmsSlotKey): string {
  const normalizedSlug = slug.trim().toLowerCase();
  if (normalizedSlug === "home") return `homepage.${slotKey}`;
  return validateSlotKey(`${normalizedSlug}.${slotKey}`);
}

function readCmsSlotKeyFromResolvedSlotKey(slotKey: string): CmsSlotKey {
  const normalized = validateSlotKey(slotKey);
  const parts = normalized.split(".");
  const uiSlot = parts[parts.length - 1];
  if (!isOneOf(uiSlot, CMS_SLOT_KEYS)) {
    throw new CmsValidationError("slotKey không thuộc slot CMS công khai.", {
      slotKey: "Slot chưa được hỗ trợ.",
    });
  }
  return uiSlot;
}

function readIsoDate(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new CmsValidationError(`${label} phải là ISO datetime.`);
  }
  return value;
}

export function parseCmsContent(raw: unknown): CmsContent {
  const source = readRecord(raw, "CMS content");
  const slotKey = readSlotKey(source.slotKey, "slotKey");
  const componentType = source.componentType;
  if (!isOneOf(componentType, CMS_COMPONENT_TYPES)) {
    throw new CmsValidationError("componentType không thuộc CMS vocabulary.");
  }
  const status = source.status;
  if (!isOneOf(status, CMS_PUBLICATION_STATUSES)) {
    throw new CmsValidationError("status phải là DRAFT hoặc PUBLISHED.");
  }
  const version = source.version;
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) {
    throw new CmsValidationError("version phải là số nguyên dương.");
  }
  const updatedAt = readIsoDate(source.updatedAt, "updatedAt");
  return {
    slotKey,
    componentType,
    payload: readPayload(source.payload, componentType) as never,
    status,
    version,
    updatedAt,
  };
}

export function parseCmsContentHistoryEntry(raw: unknown): CmsContentHistoryEntry {
  const source = readRecord(raw, "CMS history");
  const componentType = source.componentType === null ? null : source.componentType;
  if (componentType !== null && !isOneOf(componentType, CMS_COMPONENT_TYPES)) {
    throw new CmsValidationError("history.componentType không thuộc CMS vocabulary.");
  }
  const status = source.status === null ? null : source.status;
  if (status !== null && !isOneOf(status, CMS_PUBLICATION_STATUSES)) {
    throw new CmsValidationError("history.status phải là DRAFT hoặc PUBLISHED.");
  }
  const rollbackAvailable = source.rollbackAvailable;
  if (typeof rollbackAvailable !== "boolean") {
    throw new CmsValidationError("history.rollbackAvailable phải là boolean.");
  }
  return {
    eventId: readPositiveInteger(source.eventId, "history.eventId"),
    slotKey: readSlotKey(source.slotKey, "history.slotKey"),
    componentType,
    status,
    payload: componentType === null || source.payload === null
      ? null
      : readPayload(source.payload, componentType),
    version: readPositiveInteger(source.version, "history.version"),
    actorEmail: source.actorEmail === null
      ? null
      : typeof source.actorEmail === "string" ? source.actorEmail : null,
    changedAt: readIsoDate(source.changedAt, "history.changedAt"),
    rollbackAvailable,
  };
}

export function validateCmsContentInput(input: CmsContentInput, slotKey?: CmsSlotKey): CmsFieldErrors {
  const errors: CmsFieldErrors = {};
  if (!isOneOf(input.componentType, CMS_COMPONENT_TYPES)) {
    errors.componentType = "Chọn một component CMS được hỗ trợ.";
  } else if (slotKey && !isCmsComponentAllowedForSlot(slotKey, input.componentType)) {
    errors.componentType = `Component ${input.componentType} không phù hợp với slot ${slotKey}.`;
  }
  if (!isOneOf(input.status, CMS_PUBLICATION_STATUSES)) {
    errors.status = "Chọn DRAFT hoặc PUBLISHED.";
  }
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
    errors.expectedVersion = "expectedVersion phải là số nguyên không âm.";
  }
  if (!errors.componentType) {
    try {
      readPayload(input.payload, input.componentType);
    } catch (error) {
      if (error instanceof CmsApiError && error.fieldErrors) Object.assign(errors, error.fieldErrors);
      else errors.payload = error instanceof Error ? error.message : "payload không hợp lệ.";
    }
  }
  return errors;
}

export function assertValidCmsContentInput(input: CmsContentInput, slotKey?: CmsSlotKey): void {
  const errors = validateCmsContentInput(input, slotKey);
  if (Object.keys(errors).length > 0) {
    throw new CmsValidationError("CMS content chưa hợp lệ.", errors);
  }
}

function errorKindForStatus(status: number): CmsApiErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status === 503) return "unavailable";
  if (status >= 500) return "server";
  return "unknown";
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function responseMessage(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim()) return body;
  if (isRecord(body)) {
    for (const key of ["message", "error", "detail"]) {
      if (typeof body[key] === "string" && body[key].trim()) return body[key] as string;
    }
  }
  return fallback;
}

function responseFieldErrors(body: unknown): CmsFieldErrors | undefined {
  if (!isRecord(body)) return undefined;
  if (Array.isArray(body.fieldErrors)) {
    const fields: CmsFieldErrors = {};
    for (const item of body.fieldErrors) {
      if (!isRecord(item) || typeof item.field !== "string" || typeof item.message !== "string") continue;
      fields[item.field] = item.message;
    }
    return Object.keys(fields).length ? fields : undefined;
  }
  if (isRecord(body.fieldErrors)) {
    const fields: CmsFieldErrors = {};
    for (const [key, value] of Object.entries(body.fieldErrors)) {
      if (typeof value === "string") fields[key] = value;
    }
    return Object.keys(fields).length ? fields : undefined;
  }
  return undefined;
}

function readPositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new CmsValidationError(`${label} phải là số nguyên không âm.`);
  }
  return value;
}

function readSlotKey(value: unknown, label: string): string {
  if (typeof value !== "string") throw new CmsValidationError(`${label} phải là chuỗi.`);
  return validateSlotKey(value);
}

function parseChangedEvent(raw: unknown): CmsContentChangedEvent {
  const event = readRecord(raw, "cms-content-changed");
  const slotKey = readSlotKey(event.slotKey, "event.slotKey");
  const version = readPositiveInteger(event.version, "event.version");
  const eventId = readPositiveInteger(event.eventId, "event.eventId");
  if (typeof event.published !== "boolean") {
    throw new CmsValidationError("event.published phải là boolean.");
  }
  return {
    type: "cms-content-changed",
    eventId,
    slotKey,
    version,
    published: event.published,
    updatedAt: readIsoDate(event.updatedAt, "event.updatedAt"),
  };
}

function parseReadyEvent(raw: unknown): CmsFeedReadyEvent {
  const event = readRecord(raw, "ready");
  return {
    latestEventId: readPositiveInteger(event.latestEventId, "ready.latestEventId"),
    replayLimit: readPositiveInteger(event.replayLimit, "ready.replayLimit"),
    snapshotFallback: typeof event.snapshotFallback === "string" ? event.snapshotFallback : "",
  };
}

function parseResyncEvent(raw: unknown): CmsFeedResyncEvent {
  const event = readRecord(raw, "resync");
  if (typeof event.reason !== "string") throw new CmsValidationError("resync.reason phải là chuỗi.");
  return {
    latestEventId: readPositiveInteger(event.latestEventId, "resync.latestEventId"),
    reason: event.reason,
    snapshotFallback: typeof event.snapshotFallback === "string" ? event.snapshotFallback : "",
  };
}

function parseHeartbeatEvent(raw: unknown): CmsHeartbeatEvent {
  const event = readRecord(raw, "heartbeat");
  return {
    at: readIsoDate(event.at, "heartbeat.at"),
    latestEventId: readPositiveInteger(event.latestEventId, "heartbeat.latestEventId"),
  };
}

export class CmsClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getAccessToken?: CmsClientOptions["getAccessToken"];
  private readonly eventSourceFactory: (url: string) => EventSource;
  private readonly supportsEventSource: boolean;
  private readonly changeSubscribers = new Map<number, CmsChangeSubscriptionOptions>();
  private nextChangeSubscriberId = 0;
  private changeSource: EventSource | undefined;
  private changeSourceListeners: Array<[string, EventListener]> = [];
  private changeReconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private changeReconnectAttempt = 0;
  private changeCursor: number | undefined;
  private changeReady: CmsFeedReadyEvent | undefined;

  constructor(options: CmsClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.getAccessToken = options.getAccessToken;
    this.eventSourceFactory = options.eventSourceFactory ?? ((url) => new EventSource(url));
    this.supportsEventSource = options.eventSourceFactory !== undefined || typeof EventSource !== "undefined";
  }

  private contentPath(slotKey: string, options?: CmsPublishedContentReadOptions): string {
    const path = `/cms/content/${encodeURIComponent(validateSlotKey(slotKey))}`;
    if (options?.afterEventId === undefined) return path;
    if (!Number.isSafeInteger(options.afterEventId) || options.afterEventId < 0) {
      throw new CmsValidationError("afterEventId phải là số nguyên không âm.");
    }
    return `${path}?afterEventId=${encodeURIComponent(String(options.afterEventId))}`;
  }

  private adminContentPath(slotKey: string): string {
    return `/admin/cms/content/${encodeURIComponent(validateSlotKey(slotKey))}`;
  }

  private adminHistoryPath(slotKey: string): string {
    return `${this.adminContentPath(slotKey)}/history`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        cache: "no-store",
        credentials: init.credentials ?? "include",
        headers,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể kết nối CMS.";
      throw new CmsApiError("network", 0, `Không thể kết nối CMS: ${message}`);
    }

    const body = await readResponseBody(response);
    if (!response.ok) {
      throw new CmsApiError(
        errorKindForStatus(response.status),
        response.status,
        responseMessage(body, `CMS API trả về HTTP ${response.status}.`),
        responseFieldErrors(body),
      );
    }
    return body as T;
  }

  private async requestContent(path: string, init?: RequestInit): Promise<CmsContent> {
    try {
      return parseCmsContent(await this.request<unknown>(path, init));
    } catch (error) {
      if (error instanceof CmsApiError) throw error;
      throw new CmsApiError("validation", 0, "CMS API trả về dữ liệu sai schema.");
    }
  }

  async getPublishedContent(
    slotKey: string,
    options?: CmsPublishedContentReadOptions,
  ): Promise<CmsContent> {
    return this.requestContent(this.contentPath(slotKey, options));
  }

  async getAdminContent(slotKey: string): Promise<CmsContent> {
    return this.requestContent(this.adminContentPath(slotKey));
  }

  async listAdminContent(): Promise<CmsContent[]> {
    const raw = await this.request<unknown>("/admin/cms/content");
    if (!Array.isArray(raw)) {
      throw new CmsApiError("validation", 0, "CMS API không trả về danh sách slot hợp lệ.");
    }
    try {
      return raw.map((item) => parseCmsContent(item));
    } catch (error) {
      if (error instanceof CmsApiError) throw error;
      throw new CmsApiError("validation", 0, "CMS API trả về slot sai schema.");
    }
  }

  async upsertContent(slotKey: string, input: CmsContentInput): Promise<CmsContent> {
    const normalizedSlotKey = validateSlotKey(slotKey);
    assertValidCmsContentInput(input, readCmsSlotKeyFromResolvedSlotKey(normalizedSlotKey));
    return this.requestContent(this.adminContentPath(normalizedSlotKey), {
      method: "PUT",
      body: JSON.stringify({
        componentType: input.componentType,
        payload: input.payload,
        status: input.status,
        expectedVersion: input.expectedVersion,
      }),
    });
  }

  async listHistory(slotKey: string, limit = 20): Promise<CmsContentHistoryEntry[]> {
    validateSlotKey(slotKey);
    const boundedLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
    const raw = await this.request<unknown>(`${this.adminHistoryPath(slotKey)}?limit=${boundedLimit}`);
    if (!Array.isArray(raw)) {
      throw new CmsApiError("validation", 0, "CMS API không trả về lịch sử hợp lệ.");
    }
    try {
      return raw.map((item) => parseCmsContentHistoryEntry(item));
    } catch (error) {
      if (error instanceof CmsApiError) throw error;
      throw new CmsApiError("validation", 0, "CMS API trả về lịch sử sai schema.");
    }
  }

  async rollbackContent(slotKey: string, input: CmsRollbackInput): Promise<CmsContent> {
    validateSlotKey(slotKey);
    if (!Number.isSafeInteger(input.changeId) || input.changeId <= 0) {
      throw new CmsValidationError("changeId phải là số nguyên dương.");
    }
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
      throw new CmsValidationError("expectedVersion phải là số nguyên không âm.");
    }
    return this.requestContent(`${this.adminContentPath(slotKey)}/rollback`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  subscribeToChanges(options: CmsChangeSubscriptionOptions): () => void {
    if (!this.supportsEventSource) {
      options.onFallback?.();
      return () => undefined;
    }

    const subscriptionId = ++this.nextChangeSubscriberId;
    this.changeSubscribers.set(subscriptionId, options);
    if (this.changeSubscribers.size === 1) {
      this.changeCursor = options.after;
    }

    if (this.changeReady && this.changeSource) {
      const ready = this.changeReady;
      void Promise.resolve().then(() => {
        if (this.changeSubscribers.has(subscriptionId)) {
          options.onConnected?.(ready);
        }
      });
    }
    this.openSharedChangeFeed();

    return () => {
      this.changeSubscribers.delete(subscriptionId);
      if (this.changeSubscribers.size === 0) {
        this.stopSharedChangeFeed();
      }
    };
  }

  /**
   * Multiplex every live slot through one browser EventSource. This avoids
   * exhausting the HTTP/1.1 per-origin connection pool while preserving the
   * durable global feed cursor used by the reconciliation layer.
   */
  private openSharedChangeFeed(): void {
    if (this.changeSubscribers.size === 0 || this.changeSource || this.changeReconnectTimer) return;

    const requestedCursor = this.changeCursor;
    const query = requestedCursor === undefined
      ? ""
      : `?after=${encodeURIComponent(String(requestedCursor))}`;
    let source: EventSource;
    try {
      source = this.eventSourceFactory(`${this.baseUrl}/cms/content/events${query}`);
    } catch {
      this.notifyFeedFallback();
      this.scheduleSharedReconnect();
      return;
    }

    this.changeSource = source;
    const register = (name: string, listener: EventListener): void => {
      source.addEventListener(name, listener);
      this.changeSourceListeners.push([name, listener]);
    };

    source.onopen = () => {
      if (this.changeSource !== source) return;
      for (const subscriber of this.changeSubscribers.values()) {
        subscriber.onConnected?.();
      }
    };
    source.onerror = () => this.failSharedChangeFeed(source);

    register("ready", (event) => {
      try {
        const ready = parseReadyEvent(JSON.parse((event as MessageEvent<string>).data) as unknown);
        this.changeReady = ready;
        // With an explicit cursor, advance only as replayed events arrive. A
        // reconnect during replay must not skip an event that was not emitted.
        if (requestedCursor === undefined) {
          this.changeCursor = Math.max(this.changeCursor ?? 0, ready.latestEventId);
        }
        this.changeReconnectAttempt = 0;
        for (const subscriber of this.changeSubscribers.values()) {
          subscriber.onConnected?.(ready);
        }
      } catch {
        this.failSharedChangeFeed(source);
      }
    });
    register("cms-content-changed", (event) => {
      try {
        const change = parseChangedEvent(JSON.parse((event as MessageEvent<string>).data) as unknown);
        this.changeCursor = Math.max(this.changeCursor ?? 0, change.eventId);
        for (const subscriber of this.changeSubscribers.values()) {
          subscriber.onChange(change);
        }
      } catch {
        this.failSharedChangeFeed(source);
      }
    });
    register("resync", (event) => {
      try {
        const resync = parseResyncEvent(JSON.parse((event as MessageEvent<string>).data) as unknown);
        this.changeCursor = Math.max(this.changeCursor ?? 0, resync.latestEventId);
        for (const subscriber of this.changeSubscribers.values()) {
          subscriber.onResync?.(resync);
        }
      } catch {
        this.failSharedChangeFeed(source);
      }
    });
    register("heartbeat", (event) => {
      try {
        const heartbeat = parseHeartbeatEvent(JSON.parse((event as MessageEvent<string>).data) as unknown);
        // A heartbeat may reveal a Redis event missed by this instance. Do not
        // advance the replay cursor until the actual event or a resync arrives.
        for (const subscriber of this.changeSubscribers.values()) {
          subscriber.onHeartbeat?.(heartbeat);
        }
      } catch {
        this.failSharedChangeFeed(source);
      }
    });
    register("unavailable", () => this.failSharedChangeFeed(source));
  }

  private failSharedChangeFeed(source: EventSource): void {
    if (this.changeSource !== source) return;
    this.disposeChangeSource();
    this.notifyFeedFallback();
    this.scheduleSharedReconnect();
  }

  private notifyFeedFallback(): void {
    for (const subscriber of this.changeSubscribers.values()) {
      subscriber.onFallback?.();
    }
  }

  private scheduleSharedReconnect(): void {
    if (this.changeSubscribers.size === 0 || this.changeReconnectTimer) return;
    const baseDelay = Math.min(30_000, 1_000 * (2 ** this.changeReconnectAttempt));
    const jitter = Math.floor(Math.random() * Math.max(250, baseDelay * 0.25));
    const delay = Math.min(30_000, baseDelay + jitter);
    this.changeReconnectAttempt = Math.min(this.changeReconnectAttempt + 1, 5);
    this.changeReconnectTimer = setTimeout(() => {
      this.changeReconnectTimer = undefined;
      this.openSharedChangeFeed();
    }, delay);
  }

  private disposeChangeSource(): void {
    const source = this.changeSource;
    this.changeSource = undefined;
    if (!source) return;
    source.onopen = null;
    source.onerror = null;
    for (const [name, listener] of this.changeSourceListeners) {
      source.removeEventListener(name, listener);
    }
    this.changeSourceListeners = [];
    source.close();
  }

  private stopSharedChangeFeed(): void {
    this.disposeChangeSource();
    if (this.changeReconnectTimer) clearTimeout(this.changeReconnectTimer);
    this.changeReconnectTimer = undefined;
    this.changeReconnectAttempt = 0;
    this.changeCursor = undefined;
    this.changeReady = undefined;
  }
}

export const defaultCmsClient = new CmsClient();

/** CMS editor client: reads the current browser session for ADMIN requests. */
export const authenticatedCmsClient = new CmsClient({
  getAccessToken: () => readAuthSession()?.accessToken ?? null,
});
