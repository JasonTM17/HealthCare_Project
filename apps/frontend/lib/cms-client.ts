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

export interface CmsContentInput {
  componentType: CmsComponentType;
  payload: CmsPayload;
  status: CmsPublicationStatus;
  expectedVersion: number;
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

export interface CmsChangeSubscriptionOptions {
  after?: number;
  onChange: (event: CmsContentChangedEvent) => void;
  onConnected?: (ready?: CmsFeedReadyEvent) => void;
  onResync?: (event: CmsFeedResyncEvent) => void;
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
  "http://localhost:8080/api/v1";

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

function readIsoDate(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new CmsValidationError(`${label} phải là ISO datetime.`);
  }
  return value;
}

export function parseCmsContent(raw: unknown): CmsContent {
  const source = readRecord(raw, "CMS content");
  const slotKey = validateSlotKey(String(source.slotKey ?? ""));
  const componentType = source.componentType;
  if (!isOneOf(componentType, CMS_COMPONENT_TYPES)) {
    throw new CmsValidationError("componentType không thuộc CMS vocabulary.");
  }
  const status = source.status;
  if (!isOneOf(status, CMS_PUBLICATION_STATUSES)) {
    throw new CmsValidationError("status phải là DRAFT hoặc PUBLISHED.");
  }
  const version = source.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
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

export function validateCmsContentInput(input: CmsContentInput): CmsFieldErrors {
  const errors: CmsFieldErrors = {};
  if (!isOneOf(input.componentType, CMS_COMPONENT_TYPES)) {
    errors.componentType = "Chọn một component CMS được hỗ trợ.";
  }
  if (!isOneOf(input.status, CMS_PUBLICATION_STATUSES)) {
    errors.status = "Chọn DRAFT hoặc PUBLISHED.";
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
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

export function assertValidCmsContentInput(input: CmsContentInput): void {
  const errors = validateCmsContentInput(input);
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
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new CmsValidationError(`${label} phải là số nguyên không âm.`);
  }
  return value;
}

function parseChangedEvent(raw: unknown): CmsContentChangedEvent {
  const event = readRecord(raw, "cms-content-changed");
  const slotKey = validateSlotKey(String(event.slotKey ?? ""));
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

export class CmsClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getAccessToken?: CmsClientOptions["getAccessToken"];
  private readonly eventSourceFactory: (url: string) => EventSource;

  constructor(options: CmsClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.getAccessToken = options.getAccessToken;
    this.eventSourceFactory = options.eventSourceFactory ?? ((url) => new EventSource(url));
  }

  private contentPath(slotKey: string): string {
    return `/cms/content/${encodeURIComponent(validateSlotKey(slotKey))}`;
  }

  private adminContentPath(slotKey: string): string {
    return `/admin/cms/content/${encodeURIComponent(validateSlotKey(slotKey))}`;
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

  async getPublishedContent(slotKey: string): Promise<CmsContent> {
    return this.requestContent(this.contentPath(slotKey));
  }

  async getAdminContent(slotKey: string): Promise<CmsContent> {
    return this.requestContent(this.adminContentPath(slotKey));
  }

  async upsertContent(slotKey: string, input: CmsContentInput): Promise<CmsContent> {
    validateSlotKey(slotKey);
    assertValidCmsContentInput(input);
    return this.requestContent(this.adminContentPath(slotKey), {
      method: "PUT",
      body: JSON.stringify({
        componentType: input.componentType,
        payload: input.payload,
        status: input.status,
        expectedVersion: input.expectedVersion,
      }),
    });
  }

  subscribeToChanges(options: CmsChangeSubscriptionOptions): () => void {
    const query = options.after === undefined ? "" : `?after=${encodeURIComponent(String(options.after))}`;
    if (typeof EventSource === "undefined") {
      options.onFallback?.();
      return () => undefined;
    }

    let source: EventSource | undefined;
    let closed = false;
    let fallbackNotified = false;
    const listeners: Array<[string, EventListener]> = [];

    const fallback = (): void => {
      if (closed || fallbackNotified) return;
      fallbackNotified = true;
      source?.close();
      options.onFallback?.();
    };
    const register = (name: string, listener: EventListener): void => {
      source?.addEventListener(name, listener);
      listeners.push([name, listener]);
    };

    try {
      source = this.eventSourceFactory(`${this.baseUrl}/cms/content/events${query}`);
      source.onopen = () => options.onConnected?.();
      source.onerror = () => fallback();

      register("ready", (event) => {
        try {
          options.onConnected?.(parseReadyEvent((event as MessageEvent<string>).data));
        } catch {
          fallback();
        }
      });
      register("cms-content-changed", (event) => {
        try {
          options.onChange(parseChangedEvent(JSON.parse((event as MessageEvent<string>).data) as unknown));
        } catch {
          fallback();
        }
      });
      register("resync", (event) => {
        try {
          options.onResync?.(parseResyncEvent(JSON.parse((event as MessageEvent<string>).data) as unknown));
        } catch {
          fallback();
        }
      });
      register("heartbeat", () => undefined);
    } catch {
      options.onFallback?.();
      return () => undefined;
    }

    return () => {
      closed = true;
      for (const [name, listener] of listeners) source?.removeEventListener(name, listener);
      source?.close();
    };
  }
}

export const defaultCmsClient = new CmsClient();

/** CMS editor client: reads the current browser session for ADMIN requests. */
export const authenticatedCmsClient = new CmsClient({
  getAccessToken: () => readAuthSession()?.accessToken ?? null,
});
