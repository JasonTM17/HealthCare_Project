/**
 * Typed boundary for the realtime CMS contract.
 *
 * The current backend exposes legacy hospital/article CRUD, not this page/slot
 * contract. Keep this adapter live-only: callers get an explicit API error
 * while the typed CMS endpoints and change feed are being integrated. There
 * is intentionally no deterministic mock fallback in this module.
 */

export const CMS_PAGE_STATES = ["DRAFT", "PUBLISHED"] as const;
export type CmsPageState = (typeof CMS_PAGE_STATES)[number];

export const CMS_SLOT_KEYS = ["hero", "body", "sidebar", "footer"] as const;
export type CmsSlotKey = (typeof CMS_SLOT_KEYS)[number];

export const CMS_COMPONENT_KEYS = [
  "heading",
  "paragraph",
  "callout",
  "link",
  "image",
] as const;
export type CmsComponentKey = (typeof CMS_COMPONENT_KEYS)[number];

export const CMS_CALLOUT_TONES = ["info", "success", "warning"] as const;
export type CmsCalloutTone = (typeof CMS_CALLOUT_TONES)[number];

export interface CmsHeadingProps {
  text: string;
  level: 1 | 2 | 3;
}

export interface CmsParagraphProps {
  text: string;
}

export interface CmsCalloutProps {
  title: string;
  body: string;
  tone: CmsCalloutTone;
}

export interface CmsLinkProps {
  label: string;
  href: string;
}

export interface CmsImageProps {
  src: string;
  alt: string;
}

export type CmsComponent =
  | { id: string; componentKey: "heading"; props: CmsHeadingProps }
  | { id: string; componentKey: "paragraph"; props: CmsParagraphProps }
  | { id: string; componentKey: "callout"; props: CmsCalloutProps }
  | { id: string; componentKey: "link"; props: CmsLinkProps }
  | { id: string; componentKey: "image"; props: CmsImageProps };

export type CmsSlots = Partial<Record<CmsSlotKey, CmsComponent[]>>;

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  state: CmsPageState;
  version: number;
  updatedAt: string;
  publishedAt: string | null;
  slots: CmsSlots;
}

export interface CmsDraftInput {
  title: string;
  slots: CmsSlots;
  baseVersion?: number;
}

export interface CmsCreateDraftInput extends CmsDraftInput {
  slug: string;
}

export interface CmsPublishInput {
  baseVersion: number;
}

export interface CmsRollbackInput {
  targetVersion: number;
  baseVersion: number;
}

export type CmsApiErrorKind =
  | "auth"
  | "forbidden"
  | "validation"
  | "conflict"
  | "not-found"
  | "network"
  | "server"
  | "unknown";

export type CmsFieldErrors = Record<string, string>;

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

export interface CmsChangeEvent {
  type: "published" | "updated" | "deleted" | "snapshot";
  slug: string;
  version: number;
  updatedAt: string;
  page?: CmsPage;
}

export interface CmsChangeSubscriptionOptions {
  sinceVersion?: number;
  onChange: (event: CmsChangeEvent) => void;
  onConnected?: () => void;
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

const MAX_COMPONENT_ID_LENGTH = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new CmsValidationError(`${label} phải là một object.`);
  }
  return value;
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
  label: string,
  maxLength: number,
): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    throw new CmsValidationError(`${label}.${key} phải là chuỗi không rỗng.`, {
      [key]: "Trường này không được để trống.",
    });
  }
  if (candidate.length > maxLength) {
    throw new CmsValidationError(`${label}.${key} vượt quá ${maxLength} ký tự.`, {
      [key]: `Tối đa ${maxLength} ký tự.`,
    });
  }
  return candidate;
}

function readOptionalString(
  value: Record<string, unknown>,
  key: string,
  label: string,
  maxLength: number,
): string | undefined {
  if (!hasOwn(value, key) || value[key] === undefined) return undefined;
  if (typeof value[key] !== "string") {
    throw new CmsValidationError(`${label}.${key} phải là chuỗi.`);
  }
  if ((value[key] as string).length > maxLength) {
    throw new CmsValidationError(`${label}.${key} vượt quá ${maxLength} ký tự.`);
  }
  return value[key] as string;
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function isSafeCmsUrl(value: string): boolean {
  const candidate = value.trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return true;
  if (candidate.startsWith("#")) return true;

  try {
    const protocol = new URL(candidate).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function assertSafeCmsUrl(value: string, field = "href"): void {
  if (!isSafeCmsUrl(value)) {
    throw new CmsValidationError(`${field} chỉ được dùng URL http(s), đường dẫn nội bộ hoặc anchor.`, {
      [field]: "URL không an toàn hoặc không được hỗ trợ.",
    });
  }
}

function readComponent(raw: unknown, slotKey: CmsSlotKey, index: number): CmsComponent {
  const component = readRecord(raw, `slots.${slotKey}[${index}]`);
  const id = readRequiredString(component, "id", "component", MAX_COMPONENT_ID_LENGTH);
  const componentKey = component.componentKey;

  if (!isOneOf(componentKey, CMS_COMPONENT_KEYS)) {
    throw new CmsValidationError(
      `slots.${slotKey}[${index}].componentKey không thuộc vocabulary CMS cho phép.`,
      { [`${slotKey}.${index}.componentKey`]: "Component không được hỗ trợ." },
    );
  }

  const props = readRecord(component.props, `slots.${slotKey}[${index}].props`);

  switch (componentKey) {
    case "heading": {
      const text = readRequiredString(props, "text", "heading.props", 240);
      const level = props.level;
      if (level !== 1 && level !== 2 && level !== 3) {
        throw new CmsValidationError("heading.props.level phải là 1, 2 hoặc 3.");
      }
      return { id, componentKey, props: { text, level } };
    }
    case "paragraph": {
      const text = readRequiredString(props, "text", "paragraph.props", 4000);
      return { id, componentKey, props: { text } };
    }
    case "callout": {
      const title = readRequiredString(props, "title", "callout.props", 240);
      const body = readRequiredString(props, "body", "callout.props", 1600);
      const tone = props.tone;
      if (!isOneOf(tone, CMS_CALLOUT_TONES)) {
        throw new CmsValidationError("callout.props.tone không hợp lệ.");
      }
      return { id, componentKey, props: { title, body, tone } };
    }
    case "link": {
      const label = readRequiredString(props, "label", "link.props", 180);
      const href = readRequiredString(props, "href", "link.props", 2048);
      assertSafeCmsUrl(href, "link.props.href");
      return { id, componentKey, props: { label, href } };
    }
    case "image": {
      const src = readRequiredString(props, "src", "image.props", 2048);
      const alt = readRequiredString(props, "alt", "image.props", 240);
      assertSafeCmsUrl(src, "image.props.src");
      return { id, componentKey, props: { src, alt } };
    }
  }
}

function parseSlots(raw: unknown): CmsSlots {
  const slots = readRecord(raw, "slots");
  const parsed: CmsSlots = {};

  for (const slotKey of CMS_SLOT_KEYS) {
    if (!hasOwn(slots, slotKey) || slots[slotKey] === undefined) continue;
    if (!Array.isArray(slots[slotKey])) {
      throw new CmsValidationError(`slots.${slotKey} phải là một mảng.`);
    }
    parsed[slotKey] = (slots[slotKey] as unknown[]).map((component, index) =>
      readComponent(component, slotKey, index),
    );
  }

  return parsed;
}

function unwrapData(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  return isRecord(raw.data) ? raw.data : raw;
}

function readIsoDate(value: unknown, label: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new CmsValidationError(`${label} phải là ISO datetime${nullable ? " hoặc null" : ""}.`);
  }
  return value;
}

export function parseCmsPage(raw: unknown): CmsPage {
  const page = readRecord(unwrapData(raw), "CMS page");
  const id = readRequiredString(page, "id", "page", 160);
  const slug = readRequiredString(page, "slug", "page", 220);
  const title = readRequiredString(page, "title", "page", 240);
  const state = page.state ?? page.status;
  if (!isOneOf(state, CMS_PAGE_STATES)) {
    throw new CmsValidationError("page.state phải là DRAFT hoặc PUBLISHED.");
  }
  const version = page.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new CmsValidationError("page.version phải là số nguyên dương.");
  }
  const updatedAt = readIsoDate(page.updatedAt, "page.updatedAt") as string;
  const publishedAt = readIsoDate(page.publishedAt, "page.publishedAt", true);

  return {
    id,
    slug,
    title,
    state,
    version,
    updatedAt,
    publishedAt,
    slots: parseSlots(page.slots),
  };
}

export function cloneCmsSlots(slots: CmsSlots): CmsSlots {
  const clone: CmsSlots = {};
  for (const slotKey of CMS_SLOT_KEYS) {
    const components = slots[slotKey];
    if (!components) continue;
    clone[slotKey] = components.map((component) => ({
      ...component,
      props: { ...component.props },
    })) as CmsComponent[];
  }
  return clone;
}

export function validateCmsDraft(input: CmsDraftInput): CmsFieldErrors {
  const errors: CmsFieldErrors = {};
  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    errors.title = "Tiêu đề không được để trống.";
  } else if (input.title.length > 240) {
    errors.title = "Tiêu đề tối đa 240 ký tự.";
  }

  if (input.baseVersion !== undefined &&
      (!Number.isInteger(input.baseVersion) || input.baseVersion < 1)) {
    errors.baseVersion = "Phiên bản nền phải là số nguyên dương.";
  }

  try {
    parseSlots(input.slots);
  } catch (error) {
    if (error instanceof CmsApiError && error.fieldErrors) {
      Object.assign(errors, error.fieldErrors);
    } else if (error instanceof Error) {
      errors.slots = error.message;
    } else {
      errors.slots = "Nội dung slot không hợp lệ.";
    }
  }

  return errors;
}

export function assertValidCmsDraft(input: CmsDraftInput): void {
  const errors = validateCmsDraft(input);
  if (Object.keys(errors).length > 0) {
    throw new CmsValidationError("Nội dung CMS chưa hợp lệ.", errors);
  }
}

function validateSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new CmsValidationError("Slug chỉ được dùng chữ thường, số và dấu gạch ngang.", {
      slug: "Slug không hợp lệ.",
    });
  }
}

function errorKindForStatus(status: number): CmsApiErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
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
  if (!isRecord(body) || !isRecord(body.fieldErrors)) return undefined;
  const fields: CmsFieldErrors = {};
  for (const [key, value] of Object.entries(body.fieldErrors)) {
    if (typeof value === "string") fields[key] = value;
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

function parseChangeEvent(raw: unknown, slug: string): CmsChangeEvent {
  const source = readRecord(unwrapData(raw), "CMS change event");
  const rawPage = isRecord(source.page) ? source.page : undefined;
  let page: CmsPage | undefined;
  if (rawPage) page = parseCmsPage(rawPage);

  const rawVersion = page?.version ?? source.version;
  if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion) || rawVersion < 1) {
    throw new CmsValidationError("CMS change event thiếu version hợp lệ.");
  }
  const rawUpdatedAt = page?.updatedAt ?? source.updatedAt;
  const updatedAt = readIsoDate(rawUpdatedAt, "change.updatedAt") as string;
  const type = source.type;
  const normalizedType = isOneOf(type, ["published", "updated", "deleted", "snapshot"] as const)
    ? type
    : "updated";

  return {
    type: normalizedType,
    slug: typeof source.slug === "string" ? source.slug : slug,
    version: rawVersion,
    updatedAt,
    page,
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

  private pagePath(slug: string): string {
    validateSlug(slug);
    return `/cms/pages/${encodeURIComponent(slug)}`;
  }

  private adminPagePath(slug: string): string {
    validateSlug(slug);
    return `/admin/cms/pages/${encodeURIComponent(slug)}`;
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

  private async requestPage(path: string, init?: RequestInit): Promise<CmsPage> {
    try {
      return parseCmsPage(await this.request<unknown>(path, init));
    } catch (error) {
      if (error instanceof CmsApiError) throw error;
      throw new CmsApiError("validation", 0, "CMS API trả về dữ liệu không đúng schema.");
    }
  }

  async getPublishedPage(slug: string): Promise<CmsPage> {
    return this.requestPage(`${this.pagePath(slug)}?state=PUBLISHED`);
  }

  async getDraftPage(slug: string): Promise<CmsPage> {
    return this.requestPage(`${this.adminPagePath(slug)}?state=DRAFT`);
  }

  async createDraft(input: CmsCreateDraftInput): Promise<CmsPage> {
    validateSlug(input.slug);
    assertValidCmsDraft(input);
    return this.requestPage("/admin/cms/pages", {
      method: "POST",
      body: JSON.stringify({
        slug: input.slug,
        title: input.title,
        slots: input.slots,
        baseVersion: input.baseVersion,
      }),
    });
  }

  async saveDraft(slug: string, input: CmsDraftInput): Promise<CmsPage> {
    assertValidCmsDraft(input);
    return this.requestPage(`${this.adminPagePath(slug)}/draft`, {
      method: "PUT",
      body: JSON.stringify({
        title: input.title,
        slots: input.slots,
        baseVersion: input.baseVersion,
      }),
    });
  }

  async publishPage(slug: string, input: CmsPublishInput): Promise<CmsPage> {
    validateSlug(slug);
    if (!Number.isInteger(input.baseVersion) || input.baseVersion < 1) {
      throw new CmsValidationError("Không thể xuất bản khi chưa có version nền.", {
        baseVersion: "Version nền không hợp lệ.",
      });
    }
    return this.requestPage(`${this.adminPagePath(slug)}/publish`, {
      method: "POST",
      body: JSON.stringify({ baseVersion: input.baseVersion }),
    });
  }

  async rollbackPage(slug: string, input: CmsRollbackInput): Promise<CmsPage> {
    validateSlug(slug);
    if (!Number.isInteger(input.targetVersion) || input.targetVersion < 1) {
      throw new CmsValidationError("Version rollback không hợp lệ.", {
        targetVersion: "Chọn một version dương.",
      });
    }
    if (!Number.isInteger(input.baseVersion) || input.baseVersion < 1) {
      throw new CmsValidationError("Không thể rollback khi chưa có version nền.", {
        baseVersion: "Version nền không hợp lệ.",
      });
    }
    return this.requestPage(`${this.adminPagePath(slug)}/rollback`, {
      method: "POST",
      body: JSON.stringify({
        targetVersion: input.targetVersion,
        baseVersion: input.baseVersion,
      }),
    });
  }

  subscribeToChanges(
    slug: string,
    options: CmsChangeSubscriptionOptions,
  ): () => void {
    validateSlug(slug);
    if (typeof EventSource === "undefined") {
      options.onFallback?.();
      return () => undefined;
    }

    const query = options.sinceVersion === undefined
      ? ""
      : `?sinceVersion=${encodeURIComponent(String(options.sinceVersion))}`;
    let source: EventSource;
    let closed = false;
    let fallbackNotified = false;

    const fallback = (): void => {
      if (closed || fallbackNotified) return;
      fallbackNotified = true;
      source.close();
      options.onFallback?.();
    };

    try {
      source = this.eventSourceFactory(`${this.baseUrl}${this.pagePath(slug)}/changes${query}`);
    } catch {
      options.onFallback?.();
      return () => undefined;
    }

    source.onopen = () => options.onConnected?.();
    source.onmessage = (message) => {
      try {
        options.onChange(parseChangeEvent(JSON.parse(message.data) as unknown, slug));
      } catch {
        fallback();
      }
    };
    source.onerror = () => fallback();

    return () => {
      closed = true;
      source.close();
    };
  }
}

export const defaultCmsClient = new CmsClient();
