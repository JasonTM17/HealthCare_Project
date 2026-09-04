import type {
  AuthUser,
  Doctor,
  DiagnosticResult,
  Specialty,
  Branch,
  HealthPackage,
  MedicalService,
  Faq,
  Article,
  ArticleSection,
  MedicalRecord,
  Notification,
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
  NotificationPreferencePatchPayload,
  Prescription,
  PrescriptionItem,
  UserProfile,
  UserPreferences,
  PatientProfile,
  PatientGender,
  StoredFile,
  TimeSlot,
  DoctorSchedule,
  SemanticSearchResponse,
  DoctorScheduleException,
  AppointmentDetails,
  PatientPortalAppointment,
  DoctorPortalAppointment,
  AiTriageCitation,
  AiTriageProvenance,
  AiTriageResult,
  JobPosition,
  JobApplicationPayload,
  JobApplicationReceipt,
  AiConversation,
  AiChatCitation,
  AiChatMessage,
  AiChatProvenance,
  AiChatMessagePage,
  AiChatExchange,
  AiChatPolicy,
  AiChatFeedback,
  ChatMode,
  ChatSafetyAction,
  FeedbackRating,
  TriageUrgency,
  AiSourceStatus,
  SuggestedAction,
  AiTriageSummary,
  AiContentType,
  AiContentReviewState,
  AiContentDecision,
  AiContentReviewSummary,
  AiContentRevision,
  BankTransferPayment,
  PatientOverview,
  ConsultationSummary,
  ConsultationDetail,
  ConsultationMessage,
  ConsultationMessagePage,
  ConsultationAttachment,
  ConsultationHandoffDoctor,
  ConsultationAdminQueueItem,
  HealthQuestionSummary,
  HealthQuestionReport,
  CarePlan,
  CarePlanItem,
} from "../types/hospital";
import {
  presentPublicArticle,
  presentPublicPackage,
  presentPublicPage,
  presentPublicService,
} from "./public-catalog";

export type {
  AuthUser,
  Doctor,
  DiagnosticResult,
  Specialty,
  Branch,
  HealthPackage,
  MedicalService,
  Faq,
  Article,
  ArticleSection,
  MedicalRecord,
  Notification,
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
  NotificationPreferencePatchPayload,
  Prescription,
  PrescriptionItem,
  UserProfile,
  UserPreferences,
  PatientProfile,
  PatientGender,
  StoredFile,
  TimeSlot,
  DoctorSchedule,
  SemanticSearchResponse,
  DoctorScheduleException,
  AppointmentDetails,
  PatientPortalAppointment,
  DoctorPortalAppointment,
  AiTriageCitation,
  AiTriageProvenance,
  AiTriageResult,
  JobPosition,
  JobApplicationPayload,
  JobApplicationReceipt,
  AiConversation,
  AiChatCitation,
  AiChatMessage,
  AiChatProvenance,
  AiChatMessagePage,
  AiChatExchange,
  AiChatPolicy,
  AiChatFeedback,
  ChatMode,
  ChatSafetyAction,
  FeedbackRating,
  TriageUrgency,
  AiSourceStatus,
  SuggestedAction,
  AiTriageSummary,
  AiContentType,
  AiContentReviewState,
  AiContentDecision,
  AiContentReviewSummary,
  AiContentRevision,
  BankTransferPayment,
  PatientOverview,
  ConsultationSummary,
  ConsultationDetail,
  ConsultationMessage,
  ConsultationMessagePage,
  ConsultationAttachment,
  ConsultationHandoffDoctor,
  ConsultationAdminQueueItem,
  HealthQuestionSummary,
  HealthQuestionReport,
  CarePlan,
  CarePlanItem,
};

// Browser requests always use the same-origin Route Handler BFF. Only its
// server-only helper can read the private backend origin and BFF credential;
// keeping this path literal prevents either value from entering client code.
const API_BASE_URL = "/api/v1";
const API_REQUEST_TIMEOUT_MS = 12_000;
const AI_STREAM_REQUEST_TIMEOUT_MS = 35_000;
const PUBLIC_AI_REQUEST_TIMEOUT_MS = 55_000;

/**
 * Browser-visible session metadata. Authentication secrets live only in
 * Secure HttpOnly cookies and are intentionally absent from this shape.
 */
export interface AuthSession {
  user: AuthUser;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export type AuthHydrationStatus = "idle" | "loading" | "settled" | "indeterminate";

export type LogoutOutcome =
  | { status: "LOGGED_OUT"; authority: "DELETE_ACK" | "RECONCILED_401" }
  | { status: "SESSION_ACTIVE"; authority: "RECONCILED_ACTIVE" };

export const SAFE_LOGOUT_ERROR_MESSAGE = "Không thể đăng xuất an toàn. Phiên của bạn vẫn đang hoạt động. Vui lòng thử lại.";
export const AUTH_SESSION_INDETERMINATE_MESSAGE = "Không thể xác định trạng thái phiên đăng nhập. Dữ liệu bảo vệ đã được ẩn cho đến khi xác minh lại.";

/** Spring Data page envelope. */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/** Load every backend page for bounded catalog/search surfaces. */
export async function fetchAllContent<T>(
  fetchPage: (page: number, size: number) => Promise<Page<T>>,
  size = 100,
): Promise<T[]> {
  const firstPage = await fetchPage(0, size);
  if (firstPage.totalPages <= 1) return firstPage.content;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) => fetchPage(index + 1, size)),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.content);
}

export class ApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly code: string | null;
  readonly fieldErrors: Readonly<Record<string, string>>;

  constructor(
    message: string,
    status: number,
    path: string,
    options: { code?: string | null; fieldErrors?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.code = options.code ?? null;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

function parseFieldErrors(value: unknown): Record<string, string> {
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([field, message]) => {
        if (typeof message === "string" && message.trim()) return [[field, message.trim()]];
        if (Array.isArray(message)) {
          const firstMessage = message.find(
            (item): item is string => typeof item === "string" && Boolean(item.trim()),
          );
          if (firstMessage) return [[field, firstMessage.trim()]];
        }
        return [];
      }),
    );
  }

  if (Array.isArray(value)) {
    return Object.fromEntries(
      value.flatMap((item) => {
        if (!isRecord(item)) return [];
        const field = typeof item.field === "string"
          ? item.field
          : typeof item.name === "string"
            ? item.name
            : null;
        const message = typeof item.message === "string" ? item.message.trim() : "";
        return field && message ? [[field, message]] : [];
      }),
    );
  }

  return {};
}

function isAbortErrorLike(error: unknown): boolean {
  if (error instanceof Error) return error.name === "AbortError";
  return typeof error === "object" && error !== null
    && "name" in error && (error as { name?: unknown }).name === "AbortError";
}

async function apiErrorFromResponse(
  res: Response,
  path: string,
  fallbackMessage = `Không thể tải dữ liệu (mã ${res.status}).`,
): Promise<ApiError> {
  const responseText = await res.text();
  let message = fallbackMessage;
  let code: string | null = null;
  let fieldErrors: Record<string, string> = {};
  try {
    const parsed = JSON.parse(responseText) as unknown;
    const errorBody = isRecord(parsed) ? parsed : {};
    if (typeof errorBody.message === "string") message = errorBody.message;
    else if (typeof errorBody.error === "string") message = errorBody.error;
    if (typeof errorBody.code === "string") code = errorBody.code;
    else if (typeof errorBody.errorCode === "string") code = errorBody.errorCode;
    fieldErrors = parseFieldErrors(errorBody.fieldErrors ?? errorBody.validationErrors ?? errorBody.errors);
  } catch {
    // Keep the user-facing error generic when the server does not return JSON.
  }
  if (!code && Object.keys(fieldErrors).length === 0) return new ApiError(message, res.status, path);
  return new ApiError(message, res.status, path, { code, fieldErrors });
}

async function getJson<T>(path: string, init?: RequestInit, timeoutMs = API_REQUEST_TIMEOUT_MS): Promise<T> {
  const requestController = new AbortController();
  const callerSignal = init?.signal;
  const abortFromCaller = () => requestController.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "same-origin",
      headers,
      signal: requestController.signal,
    });
    if (!res.ok) {
      throw await apiErrorFromResponse(res, path);
    }
    if (res.status === 204) return undefined as T;
    const responseText = await res.text();
    if (!responseText) return undefined as T;
    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new ApiError("Hệ thống trả về dữ liệu không hợp lệ. Vui lòng thử lại sau.", 502, path);
    }
  } catch (error) {
    if (timedOut) {
      throw new ApiError("Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại sau.", 408, path, {
        code: "REQUEST_TIMEOUT",
      });
    }
    // Preserve caller cancellation so stale chat requests can be ignored by
    // the experience instead of being rendered as a provider outage.
    if (isAbortErrorLike(error)) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError("Không thể kết nối đến hệ thống. Vui lòng thử lại sau.", 0, path);
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

const AUTH_CHANGE_EVENT = "healthcare-auth-session-change";
let authSessionSnapshot: AuthSession | null = null;
let authHydrationStatus: AuthHydrationStatus = "idle";
let authSessionVersion = 0;
let authMutationVersion: number | null = null;
let authMutationController: AbortController | null = null;

interface AuthHydrationFlight {
  expectedVersion: number;
  promise: Promise<AuthSession | null>;
}

let authHydrationFlight: AuthHydrationFlight | null = null;

function notifyAuthSessionChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<AuthUser>;
  return (
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    typeof user.displayName === "string" &&
    Array.isArray(user.roles) &&
    user.roles.every((role) => typeof role === "string") &&
    (typeof user.emailVerified === "undefined" || typeof user.emailVerified === "boolean")
  );
}

function normalizeAuthUser(user: AuthUser): AuthUser {
  return { ...user, emailVerified: user.emailVerified !== false };
}

export function readAuthSession(): AuthSession | null {
  return authSessionSnapshot;
}

function normalizeAuthSession(value: unknown, path: string): AuthSession {
  if (!isRecord(value) || !isAuthUser(value.user)) {
    throw new ApiError("Hệ thống trả về dữ liệu phiên không hợp lệ.", 502, path);
  }
  if (
    typeof value.idleExpiresAt !== "string"
    || !Number.isFinite(Date.parse(value.idleExpiresAt))
    || typeof value.absoluteExpiresAt !== "string"
    || !Number.isFinite(Date.parse(value.absoluteExpiresAt))
  ) {
    throw new ApiError("Hệ thống trả về dữ liệu phiên không hợp lệ.", 502, path);
  }
  return {
    user: normalizeAuthUser(value.user),
    idleExpiresAt: value.idleExpiresAt,
    absoluteExpiresAt: value.absoluteExpiresAt,
  };
}

function commitAuthSession(session: AuthSession | null, status: AuthHydrationStatus): void {
  authSessionSnapshot = session;
  authHydrationStatus = status;
  authSessionVersion += 1;
  authMutationVersion = null;
  authMutationController = null;
  notifyAuthSessionChange();
}

interface AuthMutationAttempt {
  version: number;
  controller: AbortController;
  previousSession: AuthSession | null;
}

function isCurrentAuthMutation(attempt: AuthMutationAttempt): boolean {
  return (
    authSessionVersion === attempt.version
    && authMutationVersion === attempt.version
    && authMutationController === attempt.controller
  );
}

function authMutationSupersededError(path: string): ApiError {
  return new ApiError(
    "Yêu cầu xác thực đã được thay thế bởi một thao tác mới hơn.",
    409,
    path,
    { code: "AUTH_MUTATION_SUPERSEDED" },
  );
}

function commitIndeterminateAuthState(): void {
  authSessionSnapshot = null;
  authHydrationStatus = "indeterminate";
  authSessionVersion += 1;
  authMutationVersion = null;
  authMutationController = null;
  notifyAuthSessionChange();
}

function enterIndeterminateAuthState(attempt: AuthMutationAttempt): boolean {
  if (!isCurrentAuthMutation(attempt)) return false;
  commitIndeterminateAuthState();
  return true;
}

function beginAuthMutation(preserveCurrentSession = false): AuthMutationAttempt {
  authMutationController?.abort();
  const controller = new AbortController();
  const previousSession = authSessionSnapshot;
  if (!preserveCurrentSession) {
    authSessionSnapshot = null;
    authHydrationStatus = "loading";
  }
  authSessionVersion += 1;
  authMutationVersion = authSessionVersion;
  authMutationController = controller;
  authHydrationFlight = null;
  if (!preserveCurrentSession) notifyAuthSessionChange();
  return { version: authSessionVersion, controller, previousSession };
}

function settleFailedAuthMutation(attempt: AuthMutationAttempt): void {
  if (!isCurrentAuthMutation(attempt)) return;
  authSessionSnapshot = attempt.previousSession;
  authHydrationStatus = "settled";
  authMutationVersion = null;
  authMutationController = null;
  notifyAuthSessionChange();
}

function commitIssuedAuthSession(value: unknown, attempt: AuthMutationAttempt, path: string): AuthSession {
  const session = normalizeAuthSession(value, path);
  commitAuthMutationSession(session, attempt, path);
  return session;
}

function commitAuthMutationSession(
  session: AuthSession | null,
  attempt: AuthMutationAttempt,
  path: string,
): void {
  if (!isCurrentAuthMutation(attempt)) throw authMutationSupersededError(path);
  commitAuthSession(session, "settled");
}

/** Kept as an in-memory compatibility helper for UI tests and session grants. */
export function storeAuthSession(session: AuthSession): void {
  authMutationController?.abort();
  commitAuthSession(normalizeAuthSession(session, "/auth/browser-sessions/current"), "settled");
}

export function clearAuthSession(): void {
  authMutationController?.abort();
  commitAuthSession(null, "settled");
}

export function subscribeToAuthSession(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(AUTH_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(AUTH_CHANGE_EVENT, onChange);
}

export function getAuthSessionSnapshot(): AuthSession | null {
  return readAuthSession();
}

export function getServerAuthSessionSnapshot(): AuthSession | null {
  return null;
}

export function getAuthHydrationSnapshot(): AuthHydrationStatus {
  return authHydrationStatus;
}

export function getServerAuthHydrationSnapshot(): AuthHydrationStatus {
  return "idle";
}

export function hasRole(user: AuthUser | UserProfile, role: string): boolean {
  const expected = role.replace(/^ROLE_/, "").toUpperCase();
  return user.roles.some(
    (value) => value.replace(/^ROLE_/, "").toUpperCase() === expected,
  );
}

function expiredSessionError(path: string): ApiError {
  return new ApiError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401, path);
}

export async function hydrateAuthSession(force = false): Promise<AuthSession | null> {
  if (typeof window === "undefined") return null;
  if (authMutationVersion !== null) return authSessionSnapshot;
  if (!force && authHydrationStatus === "settled") return authSessionSnapshot;
  if (authHydrationFlight) return authHydrationFlight.promise;

  const expectedVersion = authSessionVersion;
  authHydrationStatus = "loading";
  notifyAuthSessionChange();
  const flight: AuthHydrationFlight = {
    expectedVersion,
    promise: Promise.resolve(null),
  };
  flight.promise = getJson<unknown>("/auth/browser-sessions/current", {
    method: "GET",
    cache: "no-store",
  })
    .then((value) => {
      const session = normalizeAuthSession(value, "/auth/browser-sessions/current");
      if (authSessionVersion === expectedVersion) commitAuthSession(session, "settled");
      return authSessionSnapshot;
    })
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401 && authSessionVersion === expectedVersion) {
        commitAuthSession(null, "settled");
      } else if (authSessionVersion === expectedVersion) {
        commitIndeterminateAuthState();
      }
      return authSessionSnapshot;
    })
    .finally(() => {
      if (authHydrationFlight === flight) authHydrationFlight = null;
    });
  authHydrationFlight = flight;
  return flight.promise;
}

async function withAuthenticatedSession<T>(
  path: string,
  request: () => Promise<T>,
): Promise<T> {
  if (!readAuthSession()) throw expiredSessionError(path);
  const expectedVersion = authSessionVersion;
  try {
    return await request();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && authSessionVersion === expectedVersion) {
      clearAuthSession();
      throw expiredSessionError(path);
    }
    throw error;
  }
}

async function getAuthenticatedJson<T>(path: string, init?: RequestInit): Promise<T> {
  return withAuthenticatedSession(path, () => getJson<T>(path, init));
}

interface SpecialtyRecommendationResponse {
  recommended_specialty: unknown;
  recommended_specialty_id?: unknown;
  specialty_resolution?: unknown;
  urgency_level: unknown;
  clinical_advice: unknown;
  suggested_questions: unknown;
  disclaimer?: unknown;
  citations?: unknown;
  provenance?: unknown;
}

const AI_SPECIALTY_RECOMMENDATION_PATH = "/ai/specialty-recommendation";
const PUBLIC_SPECIALTY_RECOMMENDATION_PATH = "/public/specialty-recommendation";
const AI_URGENCY_LEVELS = ["EMERGENCY", "HIGH", "NORMAL"] as const;
const AI_CITATION_SOURCE_TYPES = ["branch", "specialty", "doctor", "service", "package", "article", "faq"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AI_CITATION_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const CTA_LABEL_MAX_LENGTH = 160;
// Catalog slugs are bounded by the backend's widest catalog column/policy
// (articles allow 220 characters; the other CTA sources are narrower). Keep
// the client validator at that shared upper bound so valid server routes are
// not silently discarded while still rejecting path metacharacters.
const CTA_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,219}$/;
const CTA_SOURCE_PATH_PATTERN = new RegExp(`^/(branches|specialties|doctors|services|packages|articles)/${CTA_SLUG_PATTERN.source.slice(1, -1)}$`);
const CTA_FAQ_PATH_PATTERN = /^\/faq#faq-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const CTA_BOOKING_QUERY_PATTERN = /^\/dat-lich\?(branchId|specialtyId|doctorId|packageId)=([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const CTA_LABEL_CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

function hasUnsafeUrlCharacters(value: string): boolean {
  return value.length === 0 || /[\\\u0000-\u001f\u007f\s]/u.test(value) || value.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value);
}

function isClosedActionRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === 3 && keys[0] === "href" && keys[1] === "kind" && keys[2] === "label";
}

/**
 * Validate the server-owned CTA union before handing an href to Next router
 * or an anchor. This intentionally rejects every absolute/protocol-relative
 * URL and every unknown query key.
 */
export function isSafeSuggestedAction(value: unknown): value is SuggestedAction {
  if (!isClosedActionRecord(value)) return false;
  if (typeof value.kind !== "string" || typeof value.label !== "string" || typeof value.href !== "string") return false;
  if (CTA_LABEL_CONTROL_PATTERN.test(value.label)) return false;
  const label = value.label.trim();
  const href = value.href;
  if (!label || label.length > CTA_LABEL_MAX_LENGTH) return false;
  if (value.kind === "CALL_EMERGENCY") return href === "tel:115";
  if (hasUnsafeUrlCharacters(href)) return false;
  if (value.kind === "VIEW_SOURCE") return CTA_SOURCE_PATH_PATTERN.test(href) || CTA_FAQ_PATH_PATTERN.test(href);
  if (value.kind === "START_BOOKING") return CTA_BOOKING_QUERY_PATTERN.test(href);
  return false;
}

/** Return only safe, closed-union actions; unsafe server data never reaches UI navigation. */
export function sanitizeSuggestedActions(value: unknown): SuggestedAction[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isSafeSuggestedAction).slice(0, 3).map((action) => ({
    ...action,
    label: action.label.trim(),
  }));
}

export const validateSuggestedAction = isSafeSuggestedAction;
export const isSafeChatAction = isSafeSuggestedAction;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAiTriageCitation(value: unknown): value is AiTriageCitation {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === 3 &&
    keys.every((key) => key === "source_type" || key === "source_id" || key === "title") &&
    typeof value.source_type === "string" &&
    (AI_CITATION_SOURCE_TYPES as readonly string[]).includes(value.source_type) &&
    typeof value.source_id === "string" &&
    AI_CITATION_ID_PATTERN.test(value.source_id) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0
  );
}

function isAiTriageProvenance(value: unknown): value is AiTriageProvenance {
  return typeof value === "string" || isRecord(value);
}

const AI_CHAT_PROVENANCES = ["local_provider", "remote_provider", "local_fallback"] as const;
const AI_CHAT_STATUSES = ["PENDING", "COMPLETED", "FAILED"] as const;
const AI_CHAT_ROLES = ["USER", "ASSISTANT"] as const;
const CHAT_MODES = ["HOSPITAL_SUPPORT", "SYMPTOM_TRIAGE", "HEALTH_EDUCATION"] as const;
const CHAT_SAFETY_ACTIONS = ["ANSWER", "REFUSE", "EMERGENCY", "HUMAN_HANDOFF", "INSUFFICIENT_EVIDENCE"] as const;
const CHAT_FEEDBACK_RATINGS = ["HELPFUL", "NOT_HELPFUL"] as const;
const CHAT_TRIAGE_URGENCY = ["EMERGENCY", "HIGH", "NORMAL"] as const;
const CHAT_SOURCE_STATUSES = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export const AI_CHAT_MODES = CHAT_MODES;
export const AI_CHAT_SAFETY_ACTIONS = CHAT_SAFETY_ACTIONS;
export const AI_CHAT_FEEDBACK_RATINGS = CHAT_FEEDBACK_RATINGS;

function isChatMode(value: unknown): value is ChatMode {
  return (CHAT_MODES as readonly unknown[]).includes(value);
}

function isChatSafetyAction(value: unknown): value is ChatSafetyAction {
  return (CHAT_SAFETY_ACTIONS as readonly unknown[]).includes(value);
}

function isFeedbackRating(value: unknown): value is FeedbackRating {
  return (CHAT_FEEDBACK_RATINGS as readonly unknown[]).includes(value);
}

function isTriageUrgency(value: unknown): value is TriageUrgency {
  return (CHAT_TRIAGE_URGENCY as readonly unknown[]).includes(value);
}

function isSourceStatus(value: unknown): value is AiSourceStatus {
  return (CHAT_SOURCE_STATUSES as readonly unknown[]).includes(value);
}

function isAiChatStatus(value: unknown): value is AiChatMessage["status"] {
  return (AI_CHAT_STATUSES as readonly unknown[]).includes(value);
}

function isAiChatRole(value: unknown): value is AiChatMessage["role"] {
  return (AI_CHAT_ROLES as readonly unknown[]).includes(value);
}

function isAiChatProvenance(value: unknown): value is AiChatProvenance {
  return (AI_CHAT_PROVENANCES as readonly unknown[]).includes(value);
}

function invalidAiChatResponse(path: string): ApiError {
  return new ApiError(
    "Dữ liệu trợ lý trả về chưa đúng định dạng an toàn.",
    502,
    path,
    { code: "AI_RESPONSE_INVALID" },
  );
}

function isSafeChatCitation(value: unknown): value is AiChatCitation {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.some((key) => !["source_type", "source_id", "title", "source_status", "sourceStatus"].includes(key))) return false;
  const sourceStatus = value.source_status ?? value.sourceStatus;
  return keys.length >= 3
    && typeof value.source_type === "string"
    && (AI_CITATION_SOURCE_TYPES as readonly string[]).includes(value.source_type)
    && typeof value.source_id === "string"
    && AI_CITATION_ID_PATTERN.test(value.source_id)
    && typeof value.title === "string"
    && value.title.trim().length > 0
    && value.title.length <= 300
    && (typeof sourceStatus === "undefined" || isSourceStatus(sourceStatus));
}

function parseTriage(value: unknown, path: string): AiTriageSummary | null {
  if (value === null || typeof value === "undefined") return null;
  if (!isRecord(value) || !isTriageUrgency(value.urgencyLevel ?? value.urgency_level)) {
    throw invalidAiChatResponse(path);
  }
  const recommended = value.recommendedSpecialty ?? value.recommended_specialty;
  if (typeof recommended !== "undefined" && recommended !== null && typeof recommended !== "string") {
    throw invalidAiChatResponse(path);
  }
  return {
    urgencyLevel: (value.urgencyLevel ?? value.urgency_level) as TriageUrgency,
    recommendedSpecialty: (recommended as string | null | undefined) ?? null,
  };
}

function parseFeedback(value: unknown, path: string): AiChatFeedback | FeedbackRating | null {
  if (value === null || typeof value === "undefined") return null;
  if (isFeedbackRating(value)) return value;
  if (!isRecord(value) || !isFeedbackRating(value.rating)) throw invalidAiChatResponse(path);
  const allowed = new Set(["rating", "createdAt", "updatedAt", "created_at", "updated_at"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw invalidAiChatResponse(path);
  const createdAt = value.createdAt ?? value.created_at;
  const updatedAt = value.updatedAt ?? value.updated_at;
  if (typeof createdAt !== "undefined" && createdAt !== null && typeof createdAt !== "string") throw invalidAiChatResponse(path);
  if (typeof updatedAt !== "undefined" && updatedAt !== null && typeof updatedAt !== "string") throw invalidAiChatResponse(path);
  return {
    rating: value.rating,
    createdAt: (createdAt as string | null | undefined) ?? null,
    updatedAt: (updatedAt as string | null | undefined) ?? null,
  };
}

function parseAiConversation(value: unknown, path: string): AiConversation {
  if (!isRecord(value)) throw invalidAiChatResponse(path);
  const status = value.status;
  const lastMessageAt = value.lastMessageAt;
  const mode = value.mode ?? value.chatMode;
  const consentVersion = value.consentVersion ?? value.consent_version;
  const consentedAt = value.consentedAt ?? value.consented_at;
  const consentRequired = value.consentRequired ?? value.consent_required;
  const hasConsentFields = ["consentVersion", "consent_version", "consentedAt", "consented_at", "consentRequired", "consent_required"]
    .some((key) => Object.prototype.hasOwnProperty.call(value, key));
  if (
    typeof value.id !== "string"
    || !value.id.trim()
    || typeof value.title !== "string"
    || !value.title.trim()
    || !(status === "ACTIVE" || status === "ARCHIVED")
    || typeof value.inFlight !== "boolean"
    || typeof value.createdAt !== "string"
    || typeof value.updatedAt !== "string"
    || (typeof lastMessageAt !== "string" && lastMessageAt !== null && typeof lastMessageAt !== "undefined")
    || typeof value.expiresAt !== "string"
    || (typeof mode !== "undefined" && !isChatMode(mode))
    || (typeof consentVersion !== "undefined" && consentVersion !== null && typeof consentVersion !== "string")
    || (typeof consentedAt !== "undefined" && consentedAt !== null && typeof consentedAt !== "string")
    || (typeof consentRequired !== "undefined" && typeof consentRequired !== "boolean")
  ) {
    throw invalidAiChatResponse(path);
  }
  return {
    id: value.id,
    title: value.title,
    status,
    mode: mode as ChatMode | undefined,
    consentVersion: (consentVersion as string | null | undefined) ?? null,
    consentedAt: (consentedAt as string | null | undefined) ?? null,
    consentRequired: typeof consentRequired === "boolean"
      ? consentRequired
      : (hasConsentFields && !consentedAt),
    inFlight: value.inFlight,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    lastMessageAt: lastMessageAt ?? null,
    expiresAt: value.expiresAt,
  };
}

function parseAiChatMessage(value: unknown, path: string): AiChatMessage {
  if (!isRecord(value)) throw invalidAiChatResponse(path);
  const citations = value.citations;
  const provenance = value.provenance;
  const disclaimer = value.disclaimer;
  const safetyAction = value.safetyAction ?? value.safety_action;
  const triage = value.triage;
  const suggestedActions = value.suggestedActions ?? value.suggested_actions;
  const feedback = value.feedback;
  const sourceStatus = value.sourceStatus ?? value.source_status;
  if (
    typeof value.id !== "string"
    || !value.id.trim()
    || !isAiChatRole(value.role)
    || !isAiChatStatus(value.status)
    || typeof value.content !== "string"
    || typeof value.sequence !== "number"
    || !Number.isInteger(value.sequence)
    || !Array.isArray(citations)
    || citations.some((citation) => !isSafeChatCitation(citation))
    || (typeof provenance !== "string" && provenance !== null && typeof provenance !== "undefined")
    || (typeof provenance === "string" && !isAiChatProvenance(provenance))
    || (typeof disclaimer !== "string" && disclaimer !== null && typeof disclaimer !== "undefined")
    || (typeof safetyAction !== "undefined" && !isChatSafetyAction(safetyAction))
    || (typeof sourceStatus !== "undefined" && !isSourceStatus(sourceStatus))
    || (typeof suggestedActions !== "undefined" && !Array.isArray(suggestedActions))
    || (Array.isArray(suggestedActions) && suggestedActions.some((action) => !isSafeSuggestedAction(action)))
    || typeof value.createdAt !== "string"
    || (typeof value.completedAt !== "string" && value.completedAt !== null && typeof value.completedAt !== "undefined")
  ) {
    throw invalidAiChatResponse(path);
  }
  return {
    id: value.id,
    role: value.role,
    status: value.status,
    content: value.content,
    sequence: value.sequence,
    disclaimer: disclaimer ?? null,
    provenance: provenance ?? null,
    citations: citations.map((citation) => ({
      ...citation,
      ...(citation.source_status ? { source_status: citation.source_status } : {}),
    })),
    safetyAction: safetyAction as ChatSafetyAction | undefined,
    triage: parseTriage(triage, path),
    suggestedActions: sanitizeSuggestedActions(suggestedActions),
    feedback: parseFeedback(feedback, path),
    sourceStatus: sourceStatus as AiSourceStatus | undefined,
    createdAt: value.createdAt,
    completedAt: value.completedAt ?? null,
  };
}

function parseAiChatMessagePage(value: unknown, path: string): AiChatMessagePage {
  if (!isRecord(value) || !Array.isArray(value.content) || typeof value.hasMore !== "boolean") {
    throw invalidAiChatResponse(path);
  }
  if (value.nextCursor !== null && typeof value.nextCursor !== "string" && typeof value.nextCursor !== "undefined") {
    throw invalidAiChatResponse(path);
  }
  return {
    content: value.content.map((message) => parseAiChatMessage(message, path)),
    nextCursor: value.nextCursor ?? null,
    hasMore: value.hasMore,
  };
}

function parseAiChatExchange(value: unknown, path: string): AiChatExchange {
  if (!isRecord(value) || typeof value.replayed !== "boolean") throw invalidAiChatResponse(path);
  return {
    userMessage: parseAiChatMessage(value.userMessage, path),
    assistantMessage: parseAiChatMessage(value.assistantMessage, path),
    replayed: value.replayed,
  };
}

/**
 * Calls the authenticated backend AI contract. This deliberately has no
 * client-side fallback: a result is only shown when the backend returns one.
 */
export async function recommendPublicSpecialty(symptoms: string): Promise<AiTriageResult> {
  return recommendSpecialtyFromPath(symptoms, PUBLIC_SPECIALTY_RECOMMENDATION_PATH, 500, false);
}

export async function recommendSpecialty(symptoms: string): Promise<AiTriageResult> {
  return recommendSpecialtyFromPath(symptoms, AI_SPECIALTY_RECOMMENDATION_PATH, 10000, true);
}

async function recommendSpecialtyFromPath(
  symptoms: string,
  path: string,
  maxLength: number,
  authenticated: boolean,
): Promise<AiTriageResult> {
  const normalized = symptoms.trim();
  if (normalized.length < 2 || normalized.length > maxLength) {
    throw new ApiError(
      `Mô tả triệu chứng phải dài từ 2 đến ${maxLength} ký tự.`,
      400,
      path,
    );
  }

  const request = {
    method: "POST",
    body: JSON.stringify({ symptoms: normalized }),
  } as const;
  const response = authenticated
    ? await getAuthenticatedJson<SpecialtyRecommendationResponse>(path, request)
    : await getJson<SpecialtyRecommendationResponse>(path, request);

  if (
    typeof response.recommended_specialty !== "string" ||
    typeof response.clinical_advice !== "string" ||
    !Array.isArray(response.suggested_questions) ||
    response.suggested_questions.some((question) => typeof question !== "string")
  ) {
    throw new ApiError(
      "Dịch vụ AI trả về dữ liệu không đúng định dạng.",
      502,
      path,
    );
  }

  if (
    typeof response.urgency_level !== "string" ||
    !(AI_URGENCY_LEVELS as readonly string[]).includes(response.urgency_level)
  ) {
    throw new ApiError(
      "Dịch vụ AI trả về mức độ ưu tiên không hợp lệ.",
      502,
      path,
    );
  }

  const result: AiTriageResult = {
    recommendedSpecialty: response.recommended_specialty,
    urgencyLevel: response.urgency_level as AiTriageResult["urgencyLevel"],
    advice: response.clinical_advice,
    suggestedQuestions: response.suggested_questions,
  };

  if (response.specialty_resolution === "RESOLVED" || response.specialty_resolution === "UNRESOLVED") {
    result.specialtyResolution = response.specialty_resolution;
  }
  // A provider response may contain a syntactically valid but untrusted ID.
  // Only the backend's explicit SQL resolution may cross into booking.
  if (
    result.specialtyResolution === "RESOLVED" &&
    typeof response.recommended_specialty_id === "string" &&
    UUID_PATTERN.test(response.recommended_specialty_id)
  ) {
    result.recommendedSpecialtyId = response.recommended_specialty_id;
  }

  if (typeof response.disclaimer === "string" && response.disclaimer.trim()) {
    result.disclaimer = response.disclaimer;
  }

  if (Array.isArray(response.citations)) {
    const citations = response.citations.filter(isAiTriageCitation);
    if (citations.length > 0) result.citations = citations;
  }

  if (isAiTriageProvenance(response.provenance)) {
    result.provenance = response.provenance;
  }

  return result;
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// ── Doctors ─────────────────────────────────────────────────────────────────

export interface DoctorFilter {
  page?: number;
  size?: number;
  sort?: string;
  specialtySlug?: string;
  branchSlug?: string;
  q?: string;
}

export async function fetchDoctors(filter: DoctorFilter = {}): Promise<Page<Doctor>> {
  const query = toQuery({
    page: filter.page ?? 0,
    size: filter.size ?? 20,
    sort: filter.sort ?? "fullName,asc",
    specialtySlug: filter.specialtySlug,
    branchSlug: filter.branchSlug,
    q: filter.q,
  });
  return getJson<Page<Doctor>>(`/hospital/doctors${query}`);
}

export async function fetchDoctorBySlug(slug: string): Promise<Doctor> {
  return getJson<Doctor>(`/hospital/doctors/${encodeURIComponent(slug)}`);
}

// ── Specialties ─────────────────────────────────────────────────────────────

export async function fetchSpecialties(
  page = 0,
  size = 50,
): Promise<Page<Specialty>> {
  return getJson<Page<Specialty>>(
    `/hospital/specialties${toQuery({ page, size })}`,
  );
}

export async function fetchSpecialtyBySlug(slug: string): Promise<Specialty> {
  return getJson<Specialty>(`/hospital/specialties/${encodeURIComponent(slug)}`);
}

// ── Branches ────────────────────────────────────────────────────────────────

export async function fetchBranches(
  page = 0,
  size = 50,
): Promise<Page<Branch>> {
  return getJson<Page<Branch>>(`/hospital/branches${toQuery({ page, size })}`);
}

export async function fetchBranchBySlug(slug: string): Promise<Branch> {
  return getJson<Branch>(`/hospital/branches/${encodeURIComponent(slug)}`);
}

// ── Packages ────────────────────────────────────────────────────────────────

export async function fetchPackages(
  page = 0,
  size = 50,
): Promise<Page<HealthPackage>> {
  const result = await getJson<Page<HealthPackage>>(
    `/hospital/packages${toQuery({ page, size })}`,
  );
  return presentPublicPage(result, presentPublicPackage) as Page<HealthPackage>;
}

export async function fetchPackageBySlug(slug: string): Promise<HealthPackage> {
  return presentPublicPackage(await getJson<HealthPackage>(`/hospital/packages/${encodeURIComponent(slug)}`));
}

// ── Services and FAQs ───────────────────────────────────────────────────────

export async function fetchServices(
  page = 0,
  size = 50,
): Promise<Page<MedicalService>> {
  const result = await getJson<Page<MedicalService>>(
    `/hospital/services${toQuery({ page, size })}`,
  );
  return presentPublicPage(result, presentPublicService) as Page<MedicalService>;
}

export async function fetchServiceBySlug(slug: string): Promise<MedicalService> {
  return presentPublicService(await getJson<MedicalService>(`/hospital/services/${encodeURIComponent(slug)}`));
}

export async function fetchFaqs(
  page = 0,
  size = 50,
): Promise<Page<Faq>> {
  return getJson<Page<Faq>>(`/hospital/faqs${toQuery({ page, size })}`);
}

// ── Careers ─────────────────────────────────────────────────────────────────

export interface CareerFilter {
  page?: number;
  size?: number;
  department?: string;
  location?: string;
}

export async function fetchCareerPositions(filter: CareerFilter = {}): Promise<Page<JobPosition>> {
  return getJson<Page<JobPosition>>(`/careers/jobs${toQuery({
    page: filter.page ?? 0,
    size: filter.size ?? 50,
    department: filter.department,
    location: filter.location,
  })}`);
}

export async function submitJobApplication(
  slug: string,
  payload: JobApplicationPayload,
): Promise<JobApplicationReceipt> {
  return getJson<JobApplicationReceipt>(
    `/careers/jobs/${encodeURIComponent(slug)}/applications`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export interface AdminPackagePayload { name: string; slug: string; description?: string | null; price: number; active: boolean }
export interface AdminFaqPayload { question: string; answer: string; active: boolean }
export interface AdminArticlePayload {
  title: string;
  slug: string;
  summary?: string | null;
  body?: string | null;
  category?: string | null;
  authorName?: string | null;
  readingMinutes?: number | null;
  relatedSpecialtySlug?: string | null;
  contentKind?: "GENERAL" | "DISEASE_GUIDE" | null;
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  tags?: string[];
  scheduledPublishAt?: string | null;
  version?: number | null;
  sections?: ArticleSection[];
  contentLanguage?: string | null;
  audience?: string | null;
  topicTags?: string[];
  keyTakeaways?: string[];
  warningSigns?: string[];
  preventionTips?: string[];
  whenToSeekCare?: string | null;
  sourceReferences?: string[];
  clinicalMetadata?: Record<string, string> | null;
  clinicalDisclaimer?: string | null;
  featured?: boolean | null;
  active: boolean;
}
export type AdminArticle = Omit<Article, "summary" | "body" | "publishedAt"> & {
  summary?: string | null;
  body?: string | null;
  publishedAt?: string | null;
  active?: boolean;
};

export const adminListPackages = (page = 0, size = 100) => getAuthenticatedJson<Page<HealthPackage>>(`/admin/packages${toQuery({ page, size })}`);
export const adminCreatePackage = (payload: AdminPackagePayload) => getAuthenticatedJson<HealthPackage>("/admin/packages", { method: "POST", body: JSON.stringify(payload) });
export const adminUpdatePackage = (slug: string, payload: AdminPackagePayload) => getAuthenticatedJson<HealthPackage>(`/admin/packages/${encodeURIComponent(slug)}`, { method: "PUT", body: JSON.stringify(payload) });
export const adminDeletePackage = (slug: string) => getAuthenticatedJson<void>(`/admin/packages/${encodeURIComponent(slug)}`, { method: "DELETE" });
export const adminListFaqs = (page = 0, size = 100) => getAuthenticatedJson<Page<Faq>>(`/admin/faqs${toQuery({ page, size })}`);
export const adminCreateFaq = (payload: AdminFaqPayload) => getAuthenticatedJson<Faq>("/admin/faqs", { method: "POST", body: JSON.stringify(payload) });
export const adminUpdateFaq = (id: string, payload: AdminFaqPayload) => getAuthenticatedJson<Faq>(`/admin/faqs/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
export const adminDeleteFaq = (id: string) => getAuthenticatedJson<void>(`/admin/faqs/${encodeURIComponent(id)}`, { method: "DELETE" });
export const adminListArticles = (page = 0, size = 100) => getAuthenticatedJson<Page<AdminArticle>>(`/admin/articles${toQuery({ page, size })}`);
export const adminCreateArticle = (payload: AdminArticlePayload) => getAuthenticatedJson<AdminArticle>("/admin/articles", { method: "POST", body: JSON.stringify(payload) });
export const adminUpdateArticle = (slug: string, payload: AdminArticlePayload) => getAuthenticatedJson<AdminArticle>(`/admin/articles/${encodeURIComponent(slug)}`, { method: "PUT", body: JSON.stringify(payload) });
export const adminDeleteArticle = (slug: string) => getAuthenticatedJson<void>(`/admin/articles/${encodeURIComponent(slug)}`, { method: "DELETE" });

export interface AdminSchedulePayload { dayOfWeek: number; startTime: string; endTime: string; slotDurationMinutes: number; effectiveFrom: string; effectiveTo?: string | null; active: boolean }
export const adminListSchedules = (page = 0, size = 100) => getAuthenticatedJson<Page<DoctorSchedule>>(`/admin/schedules${toQuery({ page, size })}`);
export const adminCreateSchedule = (doctorId: string, branchId: string, payload: AdminSchedulePayload) => getAuthenticatedJson<DoctorSchedule>(`/admin/schedules/doctors/${encodeURIComponent(doctorId)}/branches/${encodeURIComponent(branchId)}`, { method: "POST", body: JSON.stringify(payload) });
export const adminUpdateSchedule = (id: string, payload: AdminSchedulePayload) => getAuthenticatedJson<DoctorSchedule>(`/admin/schedules/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
export const adminDeleteSchedule = (id: string) => getAuthenticatedJson<void>(`/admin/schedules/${encodeURIComponent(id)}`, { method: "DELETE" });
export interface AdminScheduleExceptionPayload { exceptionDate: string; type: "CUSTOM_HOURS" | "BLOCKED" | "LEAVE"; customStartTime?: string | null; customEndTime?: string | null; reason?: string | null }
export const adminListScheduleExceptions = (page = 0, size = 100) => getAuthenticatedJson<Page<DoctorScheduleException>>(`/admin/schedules/exceptions${toQuery({ page, size })}`);
export const adminCreateScheduleException = (doctorId: string, branchId: string, payload: AdminScheduleExceptionPayload) => getAuthenticatedJson<DoctorScheduleException>(`/admin/schedules/exceptions/doctors/${encodeURIComponent(doctorId)}/branches/${encodeURIComponent(branchId)}`, { method: "POST", body: JSON.stringify(payload) });
export const adminUpdateScheduleException = (id: string, payload: AdminScheduleExceptionPayload) => getAuthenticatedJson<DoctorScheduleException>(`/admin/schedules/exceptions/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
export const adminDeleteScheduleException = (id: string) => getAuthenticatedJson<void>(`/admin/schedules/exceptions/${encodeURIComponent(id)}`, { method: "DELETE" });

// ── Admin: Services ─────────────────────────────────────────────────────────

export interface AdminBranchPayload {
  name: string;
  slug: string;
  address: string;
  phone?: string | null;
  active: boolean;
}

export async function adminListBranches(page = 0, size = 100): Promise<Page<Branch>> {
  return getAuthenticatedJson<Page<Branch>>(
    `/admin/branches${toQuery({ page, size })}`,
  );
}

export async function adminCreateBranch(payload: AdminBranchPayload): Promise<Branch> {
  return getAuthenticatedJson<Branch>("/admin/branches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateBranch(slug: string, payload: AdminBranchPayload): Promise<Branch> {
  return getAuthenticatedJson<Branch>(`/admin/branches/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteBranch(slug: string): Promise<void> {
  await getAuthenticatedJson<void>(`/admin/branches/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

export interface AdminServicePayload {
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
}

export async function adminListServices(page = 0, size = 100): Promise<Page<MedicalService>> {
  return getAuthenticatedJson<Page<MedicalService>>(
    `/admin/services${toQuery({ page, size })}`,
  );
}

export async function adminCreateService(payload: AdminServicePayload): Promise<MedicalService> {
  return getAuthenticatedJson<MedicalService>("/admin/services", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateService(slug: string, payload: AdminServicePayload): Promise<MedicalService> {
  return getAuthenticatedJson<MedicalService>(`/admin/services/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteService(slug: string): Promise<void> {
  await getAuthenticatedJson<void>(`/admin/services/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

// ── Articles ───────────────────────────────────────────────────────────────

export async function fetchArticles(
  page = 0,
  size = 50,
  contentKind?: "GENERAL" | "DISEASE_GUIDE",
): Promise<Page<Article>> {
  const result = await getJson<Page<Article>>(`/hospital/articles${toQuery({ page, size, contentKind })}`);
  return presentPublicPage(result, presentPublicArticle) as Page<Article>;
}

export async function fetchArticleBySlug(slug: string): Promise<Article> {
  return presentPublicArticle(await getJson<Article>(`/hospital/articles/${encodeURIComponent(slug)}`));
}

export async function fetchPatientOverview(): Promise<PatientOverview> {
  return getAuthenticatedJson<PatientOverview>("/patient/overview");
}

export async function fetchPatientConsultations(): Promise<ConsultationSummary[]> {
  return getAuthenticatedJson<ConsultationSummary[]>("/patient/consultations");
}

export async function fetchPatientConsultation(id: string, signal?: AbortSignal): Promise<ConsultationDetail> {
  return getAuthenticatedJson<ConsultationDetail>(`/patient/consultations/${encodeURIComponent(id)}`, { signal });
}

export async function fetchPatientConsultationMessages(id: string, limit = 100): Promise<ConsultationMessage[]> {
  const value = await getAuthenticatedJson<ConsultationMessage[] | ConsultationMessagePage>(
    `/patient/consultations/${encodeURIComponent(id)}/messages${toQuery({ limit })}`,
  );
  return Array.isArray(value) ? value : value.items;
}

export async function fetchPatientConsultationMessagePage(
  id: string,
  cursor?: string | null,
  limit = 50,
  signal?: AbortSignal,
): Promise<ConsultationMessagePage> {
  const page = await getAuthenticatedJson<unknown>(
    `/patient/consultations/${encodeURIComponent(id)}/messages${toQuery({ cursor: cursor ?? undefined, limit })}`,
    { signal },
  );
  if (!page || typeof page !== "object" || !Array.isArray((page as { items?: unknown }).items)) {
    throw new ApiError("Hệ thống trả về dữ liệu tin nhắn không hợp lệ.", 502, `/patient/consultations/${id}/messages`);
  }
  const value = page as Partial<ConsultationMessagePage>;
  return {
    items: value.items as ConsultationMessage[],
    nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null,
    hasMore: value.hasMore === true,
  };
}

export async function createPatientConsultation(payload: {
  appointmentId: string;
  subject: string;
  consentAccepted: boolean;
  consentVersion: string;
}): Promise<ConsultationSummary> {
  return getAuthenticatedJson<ConsultationSummary>("/patient/consultations", {
    method: "POST", body: JSON.stringify(payload),
  });
}

export async function sendPatientConsultationMessage(id: string, body: string, idempotencyKey: string, signal?: AbortSignal): Promise<ConsultationMessage> {
  return getAuthenticatedJson<ConsultationMessage>(`/patient/consultations/${encodeURIComponent(id)}/messages`, {
    method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ body }), signal,
  });
}

export async function reopenPatientConsultation(id: string): Promise<void> {
  await getAuthenticatedJson<void>(`/patient/consultations/${encodeURIComponent(id)}/reopen`, { method: "POST" });
}

export async function createPatientConsultationAttachmentIntent(
  id: string,
  payload: { messageId: string; mimeType: string; sizeBytes: number; sha256Hash: string },
): Promise<ConsultationAttachment> {
  return getAuthenticatedJson<ConsultationAttachment>(`/patient/consultations/${encodeURIComponent(id)}/attachments/intents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function completePatientConsultationAttachment(id: string, attachmentId: string): Promise<ConsultationAttachment> {
  return getAuthenticatedJson<ConsultationAttachment>(`/patient/consultations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchPatientConsultationAttachmentDownload(id: string, attachmentId: string): Promise<ConsultationAttachment> {
  return getAuthenticatedJson<ConsultationAttachment>(`/patient/consultations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download`);
}

export async function markPatientConsultationRead(id: string, lastReadMessageId?: string): Promise<void> {
  await getAuthenticatedJson<void>(`/patient/consultations/${encodeURIComponent(id)}/read`, {
    method: "POST", body: JSON.stringify({ throughMessageId: lastReadMessageId ?? null }),
  });
}

export async function closePatientConsultation(id: string): Promise<void> {
  await getAuthenticatedJson<void>(`/patient/consultations/${encodeURIComponent(id)}/close`, { method: "POST" });
}

export async function fetchPatientCarePlans(): Promise<CarePlan[]> {
  return getAuthenticatedJson<CarePlan[]>("/patient/care-plans");
}

export async function completePatientCarePlanItem(id: string): Promise<CarePlanItem> {
  return getAuthenticatedJson<CarePlanItem>(`/patient/care-plans/items/${encodeURIComponent(id)}/complete`, { method: "POST" });
}

export async function fetchDoctorCarePlans(): Promise<CarePlan[]> {
  return getAuthenticatedJson<CarePlan[]>("/doctor/care-plans");
}

export async function createDoctorCarePlan(payload: {
  appointmentId: string;
  title: string;
  items: Array<{ goal: string; reminder?: string | null; dueAt?: string | null }>;
}): Promise<CarePlan> {
  return getAuthenticatedJson<CarePlan>("/doctor/care-plans", { method: "POST", body: JSON.stringify(payload) });
}

export async function fetchDoctorConsultations(): Promise<ConsultationSummary[]> {
  return getAuthenticatedJson<ConsultationSummary[]>("/doctor/consultations");
}

export async function fetchDoctorConsultation(id: string, signal?: AbortSignal): Promise<ConsultationDetail> {
  return getAuthenticatedJson<ConsultationDetail>(`/doctor/consultations/${encodeURIComponent(id)}`, { signal });
}

export async function fetchDoctorConsultationMessagePage(
  id: string,
  cursor?: string | null,
  limit = 50,
  signal?: AbortSignal,
): Promise<ConsultationMessagePage> {
  const page = await getAuthenticatedJson<unknown>(
    `/doctor/consultations/${encodeURIComponent(id)}/messages${toQuery({ cursor: cursor ?? undefined, limit })}`,
    { signal },
  );
  if (!page || typeof page !== "object" || !Array.isArray((page as { items?: unknown }).items)) {
    throw new ApiError("Hệ thống trả về dữ liệu tin nhắn không hợp lệ.", 502, `/doctor/consultations/${id}/messages`);
  }
  const value = page as Partial<ConsultationMessagePage>;
  return {
    items: value.items as ConsultationMessage[],
    nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null,
    hasMore: value.hasMore === true,
  };
}

export async function sendDoctorConsultationMessage(id: string, body: string, idempotencyKey: string): Promise<ConsultationMessage> {
  return getAuthenticatedJson<ConsultationMessage>(`/doctor/consultations/${encodeURIComponent(id)}/messages`, {
    method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ body }),
  });
}

export async function markDoctorConsultationRead(
  id: string,
  throughMessageId?: string | null,
  signal?: AbortSignal,
): Promise<void> {
  await getAuthenticatedJson<void>(`/doctor/consultations/${encodeURIComponent(id)}/read`, {
    method: "POST",
    body: JSON.stringify({ throughMessageId: throughMessageId ?? null }),
    signal,
  });
}

export async function resolveDoctorConsultation(id: string): Promise<void> {
  await getAuthenticatedJson<void>(`/doctor/consultations/${encodeURIComponent(id)}/resolve`, { method: "POST" });
}

export async function reopenDoctorConsultation(id: string): Promise<void> {
  await getAuthenticatedJson<void>(`/doctor/consultations/${encodeURIComponent(id)}/reopen`, { method: "POST" });
}

/** The backend only returns a signed URL for an attachment that is CLEAN. */
export async function fetchDoctorConsultationAttachmentDownload(id: string, attachmentId: string): Promise<ConsultationAttachment> {
  return getAuthenticatedJson<ConsultationAttachment>(
    `/doctor/consultations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download`,
  );
}

/** Metadata-only polling endpoint; it never returns a download URL before CLEAN. */
export async function fetchDoctorConsultationAttachmentStatus(
  id: string,
  attachmentId: string,
  signal?: AbortSignal,
): Promise<ConsultationAttachment> {
  return getAuthenticatedJson<ConsultationAttachment>(
    `/doctor/consultations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
    { signal, cache: "no-store" },
  );
}

export async function handoffDoctorConsultation(id: string, doctorId: string): Promise<void> {
  await getAuthenticatedJson<void>(`/doctor/consultations/${encodeURIComponent(id)}/handoff`, {
    method: "PUT", body: JSON.stringify({ doctorId }),
  });
}

export async function fetchDoctorConsultationHandoffDirectory(id: string): Promise<ConsultationHandoffDoctor[]> {
  return getAuthenticatedJson<ConsultationHandoffDoctor[]>(`/doctor/consultations/${encodeURIComponent(id)}/handoff-directory`);
}

export async function fetchAdminConsultationQueue(): Promise<ConsultationAdminQueueItem[]> {
  return getAuthenticatedJson<ConsultationAdminQueueItem[]>("/admin/consultations/queue");
}

export async function assignAdminConsultation(id: string, doctorId: string): Promise<void> {
  await getAuthenticatedJson<void>(`/admin/consultations/${encodeURIComponent(id)}/assignment`, {
    method: "PUT",
    body: JSON.stringify({ doctorId }),
  });
}

export async function fetchPublishedHealthQuestions(topic?: string): Promise<HealthQuestionSummary[]> {
  return getJson<HealthQuestionSummary[]>(`/hospital/health-questions${toQuery({ topic })}`);
}

export async function fetchPatientHealthQuestions(): Promise<HealthQuestionSummary[]> {
  return getAuthenticatedJson<HealthQuestionSummary[]>("/patient/health-questions");
}

export async function createPatientHealthQuestion(payload: {
  topicSlug: string;
  question: string;
  publicAlias: string;
}): Promise<HealthQuestionSummary> {
  return getAuthenticatedJson<HealthQuestionSummary>("/patient/health-questions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function reportPublishedHealthQuestion(
  id: string,
  reasonCode: string,
): Promise<HealthQuestionReport> {
  return getAuthenticatedJson<HealthQuestionReport>(
    `/patient/health-questions/${encodeURIComponent(id)}/reports`,
    { method: "POST", body: JSON.stringify({ reasonCode }) },
  );
}

export async function adminListHealthQuestions(state?: string): Promise<HealthQuestionSummary[]> {
  return getAuthenticatedJson<HealthQuestionSummary[]>(`/admin/health-questions${toQuery({ state })}`);
}

export async function adminModerateHealthQuestion(id: string, decision: string, reasonCode?: string): Promise<void> {
  await getAuthenticatedJson<void>(`/admin/health-questions/${encodeURIComponent(id)}/moderation`, {
    method: "PUT", body: JSON.stringify({ decision, reasonCode: reasonCode ?? null }),
  });
}

export async function adminListHealthQuestionReports(
  id: string,
  status?: string,
): Promise<HealthQuestionReport[]> {
  return getAuthenticatedJson<HealthQuestionReport[]>(
    `/admin/health-questions/${encodeURIComponent(id)}/reports${toQuery({ status })}`,
  );
}

export async function adminDecideHealthQuestionReport(
  questionId: string,
  reportId: string,
  status: string,
  resolutionCode?: string,
): Promise<HealthQuestionReport> {
  return getAuthenticatedJson<HealthQuestionReport>(
    `/admin/health-questions/${encodeURIComponent(questionId)}/reports/${encodeURIComponent(reportId)}`,
    { method: "PUT", body: JSON.stringify({ status, resolutionCode: resolutionCode ?? null }) },
  );
}

export async function doctorAnswerHealthQuestion(id: string, answer: string): Promise<void> {
  await getAuthenticatedJson<void>(`/doctor/health-questions/${encodeURIComponent(id)}/answer`, {
    method: "PUT", body: JSON.stringify({ answer }),
  });
}

export async function doctorListHealthQuestions(): Promise<HealthQuestionSummary[]> {
  return getAuthenticatedJson<HealthQuestionSummary[]>("/doctor/health-questions");
}

export async function doctorDecideHealthQuestion(id: string, decision: string, reasonCode?: string): Promise<void> {
  await getAuthenticatedJson<void>(`/doctor/health-questions/${encodeURIComponent(id)}/decision`, {
    method: "PUT", body: JSON.stringify({ decision, reasonCode: reasonCode ?? null }),
  });
}

// ── Admin: Doctors ──────────────────────────────────────────────────────────

export interface AdminDoctorPayload {
  fullName: string;
  slug: string;
  bio?: string | null;
  photoUrl?: string | null;
  active: boolean;
  userId?: string | null;
}

export async function adminListDoctors(
  page = 0,
  size = 50,
): Promise<Page<Doctor>> {
  return getAuthenticatedJson<Page<Doctor>>(`/admin/doctors${toQuery({ page, size })}`);
}

export async function adminCreateDoctor(payload: AdminDoctorPayload): Promise<Doctor> {
  return getAuthenticatedJson<Doctor>("/admin/doctors", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateDoctor(
  slug: string,
  payload: AdminDoctorPayload,
): Promise<Doctor> {
  return getAuthenticatedJson<Doctor>(`/admin/doctors/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteDoctor(slug: string): Promise<void> {
  await getAuthenticatedJson<void>(`/admin/doctors/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

// ── Admin: Specialties ──────────────────────────────────────────────────────

export interface AdminSpecialtyPayload {
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
}

export async function adminListSpecialties(
  page = 0,
  size = 50,
): Promise<Page<Specialty>> {
  return getAuthenticatedJson<Page<Specialty>>(`/admin/specialties${toQuery({ page, size })}`);
}

export async function adminCreateSpecialty(payload: AdminSpecialtyPayload): Promise<Specialty> {
  return getAuthenticatedJson<Specialty>("/admin/specialties", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateSpecialty(
  slug: string,
  payload: AdminSpecialtyPayload,
): Promise<Specialty> {
  return getAuthenticatedJson<Specialty>(`/admin/specialties/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteSpecialty(slug: string): Promise<void> {
  await getAuthenticatedJson<void>(`/admin/specialties/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

// ── Authentication and portal data ─────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
  phone: string;
}

export interface RegistrationPendingResponse {
  email: string;
  verificationRequired: true;
  message?: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

function normalizeRegistrationResponse(
  value: unknown,
  fallbackEmail: string,
): RegistrationPendingResponse {
  const response = isRecord(value) ? value : {};
  return {
    email: typeof response.email === "string" && response.email.trim()
      ? response.email.trim()
      : fallbackEmail,
    verificationRequired: true,
    message: typeof response.message === "string" ? response.message : undefined,
    expiresInSeconds: typeof response.expiresInSeconds === "number" ? response.expiresInSeconds : 600,
    resendAfterSeconds: typeof response.resendAfterSeconds === "number" ? response.resendAfterSeconds : 60,
  };
}

export async function register(payload: RegisterPayload): Promise<RegistrationPendingResponse> {
  const response = await getJson<unknown>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeRegistrationResponse(response, payload.email);
}

export async function login(payload: LoginPayload): Promise<AuthSession> {
  const path = "/auth/browser-sessions";
  const attempt = beginAuthMutation();
  try {
    const response = await getJson<unknown>(path, {
      method: "POST",
      signal: attempt.controller.signal,
      body: JSON.stringify({
        grantType: "PASSWORD",
        email: payload.email,
        password: payload.password,
      }),
    });
    return commitIssuedAuthSession(response, attempt, path);
  } catch (error) {
    settleFailedAuthMutation(attempt);
    throw error;
  }
}

export interface VerifyEmailPayload {
  email: string;
  code: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  password: string;
}

export interface AuthActionResponse {
  message?: string;
}

export async function verifyEmail(payload: VerifyEmailPayload): Promise<AuthSession> {
  const path = "/auth/browser-sessions";
  const attempt = beginAuthMutation();
  try {
    const response = await getJson<unknown>(path, {
      method: "POST",
      signal: attempt.controller.signal,
      body: JSON.stringify({
        grantType: "EMAIL_VERIFICATION",
        email: payload.email,
        code: payload.code,
      }),
    });
    return commitIssuedAuthSession(response, attempt, path);
  } catch (error) {
    settleFailedAuthMutation(attempt);
    throw error;
  }
}

export async function resendVerificationEmail(
  payload: ResendVerificationPayload,
): Promise<AuthActionResponse | undefined> {
  return getJson<AuthActionResponse | undefined>("/auth/email-verifications/resend", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requestPasswordReset(
  payload: ForgotPasswordPayload,
): Promise<AuthActionResponse | undefined> {
  return getJson<AuthActionResponse | undefined>("/auth/password-reset-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await getJson<void>("/auth/password-reset-requests/confirm", {
    method: "POST",
    body: JSON.stringify({ email: payload.email, otp: payload.code, newPassword: payload.password }),
  });
  clearAuthSession();
}

export async function fetchUserPreferences(): Promise<UserPreferences> {
  return getAuthenticatedJson<UserPreferences>("/users/me/preferences");
}

export async function updateUserPreferences(payload: UserPreferences): Promise<UserPreferences> {
  return getAuthenticatedJson<UserPreferences>("/users/me/preferences", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

const NOTIFICATION_CATEGORIES = [
  "SECURITY",
  "APPOINTMENT",
  "PAYMENT",
  "CLINICAL_UPDATE",
  "CONSULTATION",
  "CARE_PLAN",
  "MARKETING",
] as const;

const NOTIFICATION_CHANNELS = ["EMAIL", "IN_APP"] as const;

function isNotificationCategory(value: unknown): value is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly unknown[]).includes(value);
}

function isNotificationChannel(value: unknown): value is NotificationChannel {
  return (NOTIFICATION_CHANNELS as readonly unknown[]).includes(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseNotificationPreference(value: unknown, path: string): NotificationPreference {
  if (!isRecord(value)) throw new ApiError("Hệ thống trả về dữ liệu thông báo không hợp lệ.", 502, path);
  const category = value.category ?? value.notificationCategory;
  const channel = value.channel ?? value.notificationChannel;
  const quietHoursStart = value.quietHoursStart ?? value.quiet_hours_start ?? null;
  const quietHoursEnd = value.quietHoursEnd ?? value.quiet_hours_end ?? null;
  const timezone = value.timezone ?? value.timeZone;
  if (
    !isNotificationCategory(category)
    || !isNotificationChannel(channel)
    || typeof value.enabled !== "boolean"
    || !isStringOrNull(quietHoursStart)
    || !isStringOrNull(quietHoursEnd)
    || typeof timezone !== "string"
    || !timezone.trim()
  ) {
    throw new ApiError("Hệ thống trả về dữ liệu thông báo không hợp lệ.", 502, path);
  }
  return {
    category,
    channel,
    enabled: value.enabled,
    quietHoursStart,
    quietHoursEnd,
    timezone: timezone.trim(),
  };
}

export async function fetchNotificationPreferences(options: { signal?: AbortSignal } = {}): Promise<NotificationPreference[]> {
  const path = "/users/me/notification-preferences";
  const response = await getAuthenticatedJson<unknown>(path, { signal: options.signal });
  if (!Array.isArray(response)) {
    throw new ApiError("Hệ thống trả về danh sách thông báo không hợp lệ.", 502, path);
  }
  return response.map((item) => parseNotificationPreference(item, path));
}

export async function updateNotificationPreference(
  category: NotificationCategory,
  channel: NotificationChannel,
  payload: NotificationPreferencePatchPayload,
  options: { signal?: AbortSignal } = {},
): Promise<NotificationPreference> {
  const path = `/users/me/notification-preferences/${encodeURIComponent(category)}/${encodeURIComponent(channel)}`;
  if (!isNotificationCategory(category) || !isNotificationChannel(channel)) {
    throw new ApiError("Tùy chọn thông báo không hợp lệ.", 400, path, { code: "PREFERENCES_INVALID" });
  }

  const body: NotificationPreferencePatchPayload = {};
  if (typeof payload.enabled === "boolean") body.enabled = payload.enabled;
  if (typeof payload.quietHoursStart === "string" || payload.quietHoursStart === null) body.quietHoursStart = payload.quietHoursStart;
  if (typeof payload.quietHoursEnd === "string" || payload.quietHoursEnd === null) body.quietHoursEnd = payload.quietHoursEnd;
  if (typeof payload.timezone === "string" || payload.timezone === null) body.timezone = payload.timezone;
  if (typeof payload.clearQuietHours === "boolean") body.clearQuietHours = payload.clearQuietHours;

  const response = await getAuthenticatedJson<unknown>(path, {
    method: "PUT",
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return parseNotificationPreference(response, path);
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  return getAuthenticatedJson<UserProfile>("/users/me");
}

export async function fetchPatientAppointments(
  page = 0,
  size = 20,
): Promise<Page<PatientPortalAppointment>> {
  return getAuthenticatedJson<Page<PatientPortalAppointment>>(
    `/patient/appointments${toQuery({ page, size })}`,
  );
}

export async function fetchBankTransferPayment(appointmentId: string): Promise<BankTransferPayment> {
  return getAuthenticatedJson<BankTransferPayment>(
    `/patient/appointments/${encodeURIComponent(appointmentId)}/payment`,
  );
}

export async function submitBankTransfer(
  appointmentId: string,
  transactionReference: string,
): Promise<BankTransferPayment> {
  return getAuthenticatedJson<BankTransferPayment>(
    `/patient/appointments/${encodeURIComponent(appointmentId)}/payment/submit`,
    {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ transactionReference }),
    },
  );
}

export async function adminRefundPayment(paymentId: string, refundReference: string): Promise<BankTransferPayment> {
  return getAuthenticatedJson<BankTransferPayment>(`/admin/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "PATCH",
    body: JSON.stringify({ refundReference }),
  });
}

export async function adminListPayments(
  filters: { status?: string; page?: number; size?: number } = {},
): Promise<Page<BankTransferPayment>> {
  return getAuthenticatedJson<Page<BankTransferPayment>>(
    `/admin/payments${toQuery({ status: filters.status, page: filters.page ?? 0, size: filters.size ?? 20 })}`,
  );
}

export async function adminReviewPayment(
  paymentId: string,
  decision: "VERIFY" | "REJECT",
  reason?: string,
): Promise<BankTransferPayment> {
  return getAuthenticatedJson<BankTransferPayment>(`/admin/payments/${encodeURIComponent(paymentId)}`, {
    method: "PATCH",
    body: JSON.stringify({ decision, reason }),
  });
}

export async function adminListAppointments(
  filters: { date?: string; status?: string; page?: number; size?: number } = {},
): Promise<Page<AppointmentDetails>> {
  return getAuthenticatedJson<Page<AppointmentDetails>>(
    `/admin/appointments${toQuery({
      date: filters.date,
      status: filters.status,
      page: filters.page ?? 0,
      size: filters.size ?? 20,
    })}`,
  );
}

export async function fetchPatientProfile(): Promise<PatientProfile> {
  return getAuthenticatedJson<PatientProfile>("/patient/profile");
}

export interface UpdatePatientProfilePayload {
  fullName: string;
  dateOfBirth?: string;
  gender?: PatientGender;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  avatarUrl?: string;
  medicalHistory?: string;
  allergies?: string;
  bloodType?: string;
}

export async function updatePatientProfile(payload: UpdatePatientProfilePayload): Promise<PatientProfile> {
  return getAuthenticatedJson<PatientProfile>("/patient/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
  return getAuthenticatedJson<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface RescheduleAppointmentPayload {
  appointmentDate: string;
  startTime: string;
  branchId?: string;
}

export async function rescheduleAppointment(
  bookingCode: string,
  payload: RescheduleAppointmentPayload,
): Promise<AppointmentDetails> {
  return getAuthenticatedJson<AppointmentDetails>(
    `/appointments/${encodeURIComponent(bookingCode)}/reschedule`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export type OtpDeliveryStatus = "QUEUED" | "SENT" | "FAILED" | "EXPIRED";

/**
 * Public state returned by the idempotent booking-OTP resend endpoint.
 * It deliberately contains no patient identifiers or provider details.
 */
export interface ResendOtpResponse {
  bookingCode: string;
  holdExpiresAt: string;
  otpExpiresAt: string;
  otpRequired: boolean;
  otpDeliveryStatus: OtpDeliveryStatus;
  message?: string;
  retryAfterSeconds: number;
}

function parseResendOtpResponse(value: unknown, path: string): ResendOtpResponse {
  if (!isRecord(value)) {
    throw new ApiError("Hệ thống trả về dữ liệu OTP không hợp lệ.", 502, path);
  }

  const status = value.otpDeliveryStatus;
  const allowedStatuses: readonly OtpDeliveryStatus[] = ["QUEUED", "SENT", "FAILED", "EXPIRED"];
  const retryAfterSeconds = value.retryAfterSeconds;
  if (
    typeof value.bookingCode !== "string" || !value.bookingCode.trim()
    || typeof value.holdExpiresAt !== "string" || !Number.isFinite(Date.parse(value.holdExpiresAt))
    || typeof value.otpExpiresAt !== "string" || !Number.isFinite(Date.parse(value.otpExpiresAt))
    || typeof value.otpRequired !== "boolean"
    || typeof status !== "string" || !allowedStatuses.includes(status as OtpDeliveryStatus)
    || typeof retryAfterSeconds !== "number" || !Number.isInteger(retryAfterSeconds)
    || retryAfterSeconds < 0 || retryAfterSeconds > 900
    || (typeof value.message !== "undefined" && value.message !== null && typeof value.message !== "string")
  ) {
    throw new ApiError("Hệ thống trả về dữ liệu OTP không hợp lệ.", 502, path);
  }

  return {
    bookingCode: value.bookingCode.trim(),
    holdExpiresAt: value.holdExpiresAt,
    otpExpiresAt: value.otpExpiresAt,
    otpRequired: value.otpRequired,
    otpDeliveryStatus: status as OtpDeliveryStatus,
    message: typeof value.message === "string" ? value.message : undefined,
    retryAfterSeconds,
  };
}

/**
 * Re-queues the OTP for the existing hold. This endpoint never creates a new
 * hold; the caller owns request cancellation when the booking flow changes.
 */
export async function resendAppointmentOtp(
  bookingCode: string,
  phone?: string,
  signal?: AbortSignal,
): Promise<ResendOtpResponse> {
  const normalizedBookingCode = bookingCode.trim();
  const path = `/appointments/${encodeURIComponent(normalizedBookingCode)}/otp/resend`;
  if (!normalizedBookingCode) {
    throw new ApiError("Mã giữ chỗ không hợp lệ.", 400, path, { code: "VALIDATION_ERROR" });
  }

  const normalizedPhone = phone?.trim();
  const response = await getJson<unknown>(path, {
    method: "POST",
    signal,
    body: JSON.stringify(normalizedPhone ? { phone: normalizedPhone } : {}),
  });
  return parseResendOtpResponse(response, path);
}

export async function fetchDoctorSlots(
  doctorId: string,
  date: string,
  branchId?: string,
): Promise<TimeSlot[]> {
  return getJson<TimeSlot[]>(
    `/appointments/doctors/${encodeURIComponent(doctorId)}/slots${toQuery({ date, branchId })}`,
  );
}

export async function fetchSemanticSearch(query: string, topK = 10): Promise<SemanticSearchResponse> {
  const normalized = query.trim();
  if (!normalized) throw new ApiError("Từ khóa tìm kiếm không được để trống.", 400, "/ai/search");
  return getAuthenticatedJson<SemanticSearchResponse>(
    `/ai/search${toQuery({ q: normalized, top_k: Math.max(1, Math.min(topK, 20)) })}`,
  );
}

export interface CreateAiConversationOptions {
  title?: string;
  mode?: ChatMode;
  consentAccepted?: boolean;
  signal?: AbortSignal;
}

function parseAiChatPolicy(value: unknown, path: string): AiChatPolicy {
  if (!isRecord(value)) throw invalidAiChatResponse(path);
  const policyVersion = value.policyVersion ?? value.policy_version;
  const retentionDays = value.retentionDays ?? value.retention_days;
  const consentText = value.consentText ?? value.consent_text ?? value.content;
  const limitationText = value.limitationText ?? value.limitation_text;
  const remoteProviderEnabled = value.remoteProviderEnabled ?? value.remote_provider_enabled;
  if (
    typeof policyVersion !== "string" || !policyVersion.trim()
    || typeof retentionDays !== "number" || !Number.isInteger(retentionDays) || retentionDays <= 0
    || typeof consentText !== "string" || !consentText.trim()
    || (typeof limitationText !== "undefined" && limitationText !== null && typeof limitationText !== "string")
    || (typeof remoteProviderEnabled !== "undefined" && typeof remoteProviderEnabled !== "boolean")
  ) throw invalidAiChatResponse(path);
  return {
    policyVersion,
    retentionDays,
    consentText,
    limitationText: (limitationText as string | null | undefined) ?? null,
    remoteProviderEnabled: remoteProviderEnabled as boolean | undefined,
  };
}

export async function fetchAiChatPolicy(options: { signal?: AbortSignal } = {}): Promise<AiChatPolicy> {
  const path = "/ai/chat-policy";
  const response = await getAuthenticatedJson<unknown>(path, { signal: options.signal });
  return parseAiChatPolicy(response, path);
}

export async function createAiConversation(
  titleOrOptions?: string | CreateAiConversationOptions,
): Promise<AiConversation> {
  const path = "/ai/conversations";
  const options: CreateAiConversationOptions = typeof titleOrOptions === "string"
    ? { title: titleOrOptions }
    : (titleOrOptions ?? {});
  if (typeof options.mode !== "undefined" && !isChatMode(options.mode)) {
    throw new ApiError("Chế độ trợ lý không hợp lệ.", 400, path, { code: "CHAT_MODE_INVALID" });
  }
  const body: CreateAiConversationOptions = {};
  if (options.title?.trim()) body.title = options.title.trim();
  if (options.mode) body.mode = options.mode;
  if (typeof options.consentAccepted === "boolean") body.consentAccepted = options.consentAccepted;
  const response = await getAuthenticatedJson<unknown>(path, {
    method: "POST",
    signal: options.signal,
    body: JSON.stringify(body),
  });
  return parseAiConversation(response, path);
}

export async function updateAiConversationConsent(
  conversationId: string,
  policyVersion: string,
  options: { signal?: AbortSignal } = {},
): Promise<AiConversation> {
  const path = `/ai/conversations/${encodeURIComponent(conversationId)}/consent`;
  const normalizedVersion = policyVersion.trim();
  if (!normalizedVersion) throw new ApiError("Phiên bản đồng ý không hợp lệ.", 400, path, { code: "CHAT_CONSENT_VERSION_STALE" });
  const response = await getAuthenticatedJson<unknown>(path, {
    method: "PUT",
    signal: options.signal,
    body: JSON.stringify({ accepted: true, policyVersion: normalizedVersion }),
  });
  return parseAiConversation(response, path);
}

export const consentAiConversation = updateAiConversationConsent;
export const acceptAiConversationConsent = updateAiConversationConsent;

export async function fetchAiConversations(options: { signal?: AbortSignal } = {}): Promise<AiConversation[]> {
  const path = "/ai/conversations";
  const response = await getAuthenticatedJson<unknown>(path, { signal: options.signal });
  if (!Array.isArray(response)) throw invalidAiChatResponse(path);
  return response.map((conversation) => parseAiConversation(conversation, path));
}

export async function fetchAiConversation(conversationId: string, options: { signal?: AbortSignal } = {}): Promise<AiConversation> {
  const path = `/ai/conversations/${encodeURIComponent(conversationId)}`;
  const response = await getAuthenticatedJson<unknown>(path, { signal: options.signal });
  return parseAiConversation(response, path);
}

export async function fetchAiConversationMessages(
  conversationId: string,
  cursor?: string | null,
  limit = 30,
  options: { signal?: AbortSignal } = {},
): Promise<AiChatMessagePage> {
  const path = `/ai/conversations/${encodeURIComponent(conversationId)}/messages${toQuery({
    cursor: cursor ?? undefined,
    limit: Math.max(1, Math.min(limit, 100)),
  })}`;
  const response = await getAuthenticatedJson<unknown>(path, { signal: options.signal });
  return parseAiChatMessagePage(response, path);
}

export async function sendAiConversationMessage(
  conversationId: string,
  content: string,
  idempotencyKey: string,
  options: { signal?: AbortSignal } = {},
): Promise<AiChatExchange> {
  const path = `/ai/conversations/${encodeURIComponent(conversationId)}/messages`;
  const response = await getAuthenticatedJson<unknown>(path, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ content }),
    signal: options.signal,
  });
  return parseAiChatExchange(response, path);
}

export async function sendAiConversationMessageStream(
  conversationId: string,
  content: string,
  idempotencyKey: string,
  options: { signal?: AbortSignal; onDelta?: (delta: string) => void } = {},
): Promise<AiChatExchange> {
  const path = `/ai/conversations/${encodeURIComponent(conversationId)}/messages/stream`;
  return withAuthenticatedSession(path, async () => {
    const requestController = new AbortController();
    const callerSignal = options.signal;
    const abortFromCaller = () => requestController.abort(callerSignal?.reason);
    if (callerSignal?.aborted) abortFromCaller();
    else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      requestController.abort();
    }, AI_STREAM_REQUEST_TIMEOUT_MS);
    try {
      const headers = new Headers({
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Idempotency-Key": idempotencyKey,
      });
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ content }),
        signal: requestController.signal,
      });
      if (res.status === 404) {
        return sendAiConversationMessage(conversationId, content, idempotencyKey, options);
      }
      if (!res.ok) {
        throw await apiErrorFromResponse(res, path);
      }
      const { deltas, done } = await readPersistedChatSse(res, path, options.onDelta);
      const exchange = parseAiChatExchange(done, path);
      const concatenated = deltas.join("");
      if (concatenated && concatenated !== (exchange.assistantMessage.content ?? "")) {
        throw new ApiError("Phản hồi theo từng phần không khớp nội dung đã lưu.", 502, path);
      }
      return exchange;
    } catch (error) {
      if (timedOut) {
        throw new ApiError("Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại sau.", 408, path, {
          code: "REQUEST_TIMEOUT",
        });
      }
      if (isAbortErrorLike(error)) throw error;
      if (error instanceof ApiError) throw error;
      throw new ApiError("Không thể kết nối đến hệ thống. Vui lòng thử lại sau.", 0, path);
    } finally {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  });
}

/** Stateless visitor chat response; no conversation or browser persistence is involved. */
export interface PublicAiChatResult {
  answer: string;
  disclaimer: string;
  citations: AiChatCitation[];
  provenance: AiChatProvenance;
  mode: "HOSPITAL_SUPPORT";
  safetyAction: ChatSafetyAction;
}

export interface PublicAiChatTurn {
  role: "user" | "assistant";
  content: string;
}

function parsePublicAiChatResponse(value: unknown, path: string): PublicAiChatResult {
  if (!isRecord(value)
    || typeof value.answer !== "string"
    || !value.answer.trim()
    || value.answer.length > 4_000) {
    throw invalidAiChatResponse(path);
  }
  const citations = value.citations ?? [];
  const provenance = value.provenance;
  const safetyAction = value.safety_action ?? value.safetyAction;
  if (
    value.mode !== "HOSPITAL_SUPPORT"
    || !Array.isArray(citations)
    || citations.some((citation) => !isSafeChatCitation(citation))
    || (provenance !== "local_provider" && provenance !== "local_fallback" && provenance !== "remote_provider")
    || !isChatSafetyAction(safetyAction)
  ) {
    throw invalidAiChatResponse(path);
  }
  const disclaimer = value.disclaimer;
  if (typeof disclaimer !== "string" || !disclaimer.trim() || disclaimer.length > 4_000) {
    throw invalidAiChatResponse(path);
  }
  const safeCitations = citations.filter(isSafeChatCitation);
  return {
    answer: value.answer.trim(),
    disclaimer: disclaimer.trim(),
    citations: safeCitations.map((citation) => ({
      ...citation,
      ...(citation.source_status ? { source_status: citation.source_status } : {}),
    })),
    provenance,
    mode: "HOSPITAL_SUPPORT",
    safetyAction,
  };
}

/**
 * Calls the stateless public hospital-support contract. It intentionally
 * cannot create a patient conversation or select a clinical/remote mode.
 */
export async function sendPublicAiChat(
  message: string,
  recentTurns: readonly PublicAiChatTurn[] = [],
  options: { signal?: AbortSignal } = {},
): Promise<PublicAiChatResult> {
  const path = "/public/ai/chat";
  const normalized = message.trim();
  if (normalized.length < 2 || normalized.length > 500) {
    throw new ApiError("Tin nhắn phải dài từ 2 đến 500 ký tự.", 400, path, {
      code: "PUBLIC_CHAT_INPUT_INVALID",
    });
  }
  const boundedTurns = recentTurns.slice(-6).map((turn) => ({
    role: turn.role,
    content: turn.content.trim().slice(0, 2_000),
  }));
  const response = await getJson<unknown>(path, {
    method: "POST",
    signal: options.signal,
    body: JSON.stringify({ message: normalized, recent_turns: boundedTurns }),
  }, PUBLIC_AI_REQUEST_TIMEOUT_MS);
  return parsePublicAiChatResponse(response, path);
}

async function readPersistedChatSse(
  response: Response,
  path: string,
  onDelta?: (delta: string) => void,
): Promise<{ deltas: string[]; done: unknown }> {
  if (!response.body) return parsePersistedChatSse(await response.text(), path, onDelta);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const deltas: string[] = [];
  let done: unknown = null;
  let buffered = "";
  const processBlock = (block: string): void => {
    if (!block.trim()) return;
    const parsed = parseChatSseBlock(block);
    if (parsed.eventName === "delta") {
      deltas.push(parsed.body);
      onDelta?.(parsed.body);
    } else if (parsed.eventName === "done" && parsed.body) {
      try {
        done = JSON.parse(parsed.body) as unknown;
      } catch {
        done = null;
      }
    }
  };
  try {
    while (true) {
      const chunk = await reader.read();
      buffered += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
      let separator = buffered.search(/\r?\n\r?\n/);
      while (separator >= 0) {
        const match = buffered.slice(separator).match(/^\r?\n\r?\n/);
        const length = match?.[0].length ?? 2;
        processBlock(buffered.slice(0, separator));
        buffered = buffered.slice(separator + length);
        separator = buffered.search(/\r?\n\r?\n/);
      }
      if (chunk.done) break;
    }
    if (buffered.trim()) processBlock(buffered);
  } finally {
    reader.releaseLock();
  }
  if (done == null) {
    throw new ApiError("Phản hồi theo từng phần thiếu sự kiện hoàn tất.", 502, path);
  }
  return { deltas, done };
}

function parseChatSseBlock(block: string): { eventName: string; body: string } {
  let eventName = "message";
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^\s/, ""));
  }
  return { eventName, body: data.join("\n") };
}

function parsePersistedChatSse(payload: string, path = "/ai/conversations/messages/stream", onDelta?: (delta: string) => void): { deltas: string[]; done: unknown } {
  const deltas: string[] = [];
  let done: unknown = null;
  for (const block of payload.split(/\r?\n\r?\n/)) {
    if (!block.trim()) continue;
    const { eventName, body } = parseChatSseBlock(block);
    if (eventName === "delta") {
      deltas.push(body);
      onDelta?.(body);
    }
    if (eventName === "done" && body) {
      try {
        done = JSON.parse(body) as unknown;
      } catch {
        done = null;
      }
    }
  }
  if (done == null) {
    throw new ApiError("Phản hồi theo từng phần thiếu sự kiện hoàn tất.", 502, path);
  }
  return { deltas, done };
}

function parseFeedbackState(value: unknown, path: string): AiChatFeedback {
  const parsed = parseFeedback(value, path);
  if (!parsed) throw invalidAiChatResponse(path);
  if (typeof parsed === "string") return { rating: parsed, createdAt: null, updatedAt: null };
  return parsed;
}

export async function updateAiMessageFeedback(
  conversationId: string,
  messageId: string,
  rating: FeedbackRating,
): Promise<AiChatFeedback> {
  const path = `/ai/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/feedback`;
  if (!isFeedbackRating(rating)) throw new ApiError("Đánh giá không hợp lệ.", 400, path, { code: "CHAT_FEEDBACK_INVALID" });
  const response = await getAuthenticatedJson<unknown>(path, {
    method: "PUT",
    body: JSON.stringify({ rating }),
  });
  // The Spring contract returns the new feedback state. Accept a wrapped
  // `{feedback: ...}` shape as a compatibility bridge for older adapters.
  if (isRecord(response) && "feedback" in response) return parseFeedbackState(response.feedback, path);
  return parseFeedbackState(response, path);
}

export const setAiMessageFeedback = updateAiMessageFeedback;

export async function deleteAiMessageFeedback(
  conversationId: string,
  messageId: string,
): Promise<void> {
  const path = `/ai/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/feedback`;
  await getAuthenticatedJson<void>(path, { method: "DELETE" });
}

export const removeAiMessageFeedback = deleteAiMessageFeedback;

const AI_CONTENT_TYPES = ["SPECIALTY", "ARTICLE", "FAQ"] as const;
const AI_CONTENT_REVIEW_STATES = ["DRAFT", "SUBMITTED", "APPROVED", "CHANGES_REQUESTED", "REVOKED", "EXPIRED"] as const;
const AI_CONTENT_DECISIONS = ["APPROVE", "REQUEST_CHANGES", "REVOKE"] as const;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

function isAiContentType(value: unknown): value is AiContentType {
  return (AI_CONTENT_TYPES as readonly unknown[]).includes(value);
}

function isAiContentReviewState(value: unknown): value is AiContentReviewState {
  return (AI_CONTENT_REVIEW_STATES as readonly unknown[]).includes(value);
}

function isAiContentDecision(value: unknown): value is AiContentDecision {
  return (AI_CONTENT_DECISIONS as readonly unknown[]).includes(value);
}

function normalizeContentType(value: AiContentType | string): AiContentType {
  const normalized = value.toUpperCase();
  if (!isAiContentType(normalized)) throw new ApiError("Loại nội dung AI không hợp lệ.", 400, "/ai-content", { code: "AI_CONTENT_REVISION_STALE" });
  return normalized;
}

function parseAiContentReviewSummary(value: unknown, path: string): AiContentReviewSummary {
  if (!isRecord(value)) throw invalidAiChatResponse(path);
  const sourceType = value.sourceType ?? value.source_type;
  const sourceId = value.sourceId ?? value.source_id;
  const contentHash = value.contentHash ?? value.content_hash;
  const eligibilityRevision = value.eligibilityRevision ?? value.eligibility_revision;
  const approvalRound = value.approvalRound ?? value.approval_round;
  const submittedAt = value.submittedAt ?? value.submitted_at;
  const approvedAt = value.approvedAt ?? value.approved_at;
  const expiresAt = value.expiresAt ?? value.expires_at;
  if (
    !isAiContentType(sourceType) || typeof sourceId !== "string" || !sourceId.trim()
    || typeof value.title !== "string" || !value.title.trim()
    || !isAiContentReviewState(value.state)
    || typeof value.revision !== "number" || !Number.isInteger(value.revision) || value.revision < 1
     || typeof contentHash !== "string" || !SHA256_PATTERN.test(contentHash.trim())
     || (typeof eligibilityRevision !== "undefined" && typeof eligibilityRevision !== "number")
     || (typeof approvalRound !== "undefined" && approvalRound !== null && typeof approvalRound !== "number")
     || (typeof submittedAt !== "undefined" && submittedAt !== null && typeof submittedAt !== "string")
     || (typeof approvedAt !== "undefined" && approvedAt !== null && typeof approvedAt !== "string")
    || (typeof expiresAt !== "undefined" && expiresAt !== null && typeof expiresAt !== "string")
  ) throw invalidAiChatResponse(path);
  return {
    sourceType,
    sourceId,
    title: value.title,
    state: value.state,
    revision: value.revision,
    contentHash,
    eligibilityRevision: eligibilityRevision as number | undefined,
    approvalRound: (approvalRound as number | null | undefined) ?? null,
    submittedAt: (submittedAt as string | null | undefined) ?? null,
    approvedAt: (approvedAt as string | null | undefined) ?? null,
    expiresAt: (expiresAt as string | null | undefined) ?? null,
  };
}

function parseAiContentRevision(value: unknown, path: string): AiContentRevision {
  if (!isRecord(value)) throw invalidAiChatResponse(path);
  const sourceType = value.sourceType ?? value.source_type;
  const sourceId = value.sourceId ?? value.source_id;
  const contentHash = value.contentHash ?? value.content_hash;
  const approvalId = value.approvalId ?? value.approval_id;
  const expiresAt = value.expiresAt ?? value.expires_at;
  if (
    !isAiContentType(sourceType) || typeof sourceId !== "string" || !sourceId.trim()
    || typeof value.revision !== "number" || !Number.isInteger(value.revision) || value.revision < 1
     || typeof contentHash !== "string" || !SHA256_PATTERN.test(contentHash.trim())
    || !isAiContentReviewState(value.state) || !isRecord(value.snapshot)
    || (typeof value.diff !== "undefined" && value.diff !== null && !isRecord(value.diff))
    || (typeof approvalId !== "undefined" && approvalId !== null && typeof approvalId !== "string")
    || (typeof expiresAt !== "undefined" && expiresAt !== null && typeof expiresAt !== "string")
  ) throw invalidAiChatResponse(path);
  return {
    sourceType,
    sourceId,
    revision: value.revision,
    contentHash,
    state: value.state,
    snapshot: value.snapshot,
    diff: (value.diff as Record<string, unknown> | null | undefined) ?? null,
    approvalId: (approvalId as string | null | undefined) ?? null,
    expiresAt: (expiresAt as string | null | undefined) ?? null,
  };
}

export async function submitAiContentRevision(
  type: AiContentType,
  id: string,
  payload: { revision: number; contentHash: string },
): Promise<AiContentReviewSummary> {
  const normalizedType = normalizeContentType(type);
  const path = `/admin/ai-content/${normalizedType}/${encodeURIComponent(id)}/submission`;
   if (!Number.isInteger(payload.revision) || payload.revision < 1 || !SHA256_PATTERN.test(payload.contentHash.trim())) {
    throw new ApiError("Bản revision hoặc hash không hợp lệ.", 409, path, { code: "AI_CONTENT_REVISION_STALE" });
  }
  const response = await getAuthenticatedJson<unknown>(path, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return parseAiContentReviewSummary(response, path);
}

export async function fetchDoctorAiContentReviews(
  filters: { state?: AiContentReviewState; page?: number; size?: number } = {},
): Promise<Page<AiContentReviewSummary>> {
  const path = "/doctor/ai-content/reviews";
  if (filters.state && !isAiContentReviewState(filters.state)) {
    throw new ApiError("Trạng thái review không hợp lệ.", 400, path);
  }
  const response = await getAuthenticatedJson<unknown>(`${path}${toQuery({ state: filters.state, page: filters.page ?? 0, size: filters.size ?? 20 })}`);
  if (!isRecord(response) || !Array.isArray(response.content)) throw invalidAiChatResponse(path);
  return {
    ...(response as unknown as Page<AiContentReviewSummary>),
    content: response.content.map((item) => parseAiContentReviewSummary(item, path)),
  };
}

export async function fetchAdminAiContentReviews(
  filters: { type?: AiContentType; state?: AiContentReviewState; page?: number; size?: number } = {},
): Promise<Page<AiContentReviewSummary>> {
  const path = "/admin/ai-content";
  if (filters.type && !isAiContentType(filters.type)) {
    throw new ApiError("Loại nội dung AI không hợp lệ.", 400, path, { code: "AI_CONTENT_TYPE_INVALID" });
  }
  if (filters.state && !isAiContentReviewState(filters.state)) {
    throw new ApiError("Trạng thái review không hợp lệ.", 400, path, { code: "AI_CONTENT_STATE_INVALID" });
  }
  const response = await getAuthenticatedJson<unknown>(`${path}${toQuery({
    type: filters.type,
    state: filters.state,
    page: filters.page ?? 0,
    size: filters.size ?? 20,
  })}`);
  if (!isRecord(response) || !Array.isArray(response.content)) throw invalidAiChatResponse(path);
  return {
    ...(response as unknown as Page<AiContentReviewSummary>),
    content: response.content.map((item) => parseAiContentReviewSummary(item, path)),
  };
}

export async function fetchDoctorAiContentRevision(
  type: AiContentType,
  id: string,
  revision: number,
  options: { signal?: AbortSignal } = {},
): Promise<AiContentRevision> {
  const normalizedType = normalizeContentType(type);
  const path = `/doctor/ai-content/${normalizedType}/${encodeURIComponent(id)}/revisions/${revision}`;
  const response = await getAuthenticatedJson<unknown>(path, { signal: options.signal });
  return parseAiContentRevision(response, path);
}

export async function decideDoctorAiContentRevision(
  type: AiContentType,
  id: string,
  revision: number,
  payload: { decision: AiContentDecision; reason?: string },
): Promise<AiContentReviewSummary> {
  const normalizedType = normalizeContentType(type);
  const path = `/doctor/ai-content/${normalizedType}/${encodeURIComponent(id)}/revisions/${revision}/decision`;
  if (!isAiContentDecision(payload.decision) || (payload.decision !== "APPROVE" && !payload.reason?.trim())) {
    throw new ApiError("Quyết định hoặc lý do review không hợp lệ.", 400, path, { code: "AI_CONTENT_ALREADY_DECIDED" });
  }
  const response = await getAuthenticatedJson<unknown>(path, {
    method: "PUT",
    body: JSON.stringify({ decision: payload.decision, reason: payload.reason?.trim() || undefined }),
  });
  return parseAiContentReviewSummary(response, path);
}

export async function deleteAiConversation(conversationId: string): Promise<void> {
  await getAuthenticatedJson<void>(
    `/ai/conversations/${encodeURIComponent(conversationId)}`,
    { method: "DELETE" },
  );
}

export async function fetchDoctorAppointments(
  date: string,
  status?: string,
  page = 0,
  size = 50,
): Promise<Page<DoctorPortalAppointment>> {
  const normalizedDate = date.trim();
  const path = "/doctor/appointments";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw new ApiError("Ngày xem lịch phải có định dạng YYYY-MM-DD.", 400, path);
  }

  return getAuthenticatedJson<Page<DoctorPortalAppointment>>(
    `${path}${toQuery({ date: normalizedDate, status, page, size })}`,
  );
}

export async function fetchDoctorProfile(): Promise<Doctor> {
  return getAuthenticatedJson<Doctor>("/doctor/profile");
}

export interface UpdateDoctorProfilePayload {
  bio?: string;
  achievements?: string;
  photoUrl?: string;
}

export async function updateDoctorProfile(payload: UpdateDoctorProfilePayload): Promise<Doctor> {
  return getAuthenticatedJson<Doctor>("/doctor/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateDoctorAppointmentStatus(
  appointmentId: string,
  status: "CHECKED_IN" | "IN_PROGRESS" | "NO_SHOW",
): Promise<DoctorPortalAppointment> {
  return getAuthenticatedJson<DoctorPortalAppointment>(
    `/doctor/appointments/${encodeURIComponent(appointmentId)}/status`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );
}

export interface CreateMedicalRecordPayload {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  symptomsSummary?: string;
  treatmentPlan?: string;
  doctorNotes?: string;
  followUpDate?: string;
  prescriptionItems?: PrescriptionItem[];
  prescriptionAdvice?: string;
}

export async function createMedicalRecord(payload: CreateMedicalRecordPayload): Promise<MedicalRecord> {
  return getAuthenticatedJson<MedicalRecord>("/clinical/records", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function isSameBrowserSessionAuthority(expected: AuthSession, actual: AuthSession): boolean {
  return (
    expected.user.id === actual.user.id
    && Date.parse(expected.absoluteExpiresAt) === Date.parse(actual.absoluteExpiresAt)
  );
}

function indeterminateAuthError(path: string): ApiError {
  return new ApiError(
    AUTH_SESSION_INDETERMINATE_MESSAGE,
    503,
    path,
    { code: "BROWSER_SESSION_AUTHORITY_INDETERMINATE" },
  );
}

async function reconcileFailedLogout(
  attempt: AuthMutationAttempt,
  path: string,
): Promise<LogoutOutcome> {
  if (!isCurrentAuthMutation(attempt)) throw authMutationSupersededError(path);

  let reconciledSession: AuthSession;
  try {
    const value = await getJson<unknown>(path, {
      method: "GET",
      cache: "no-store",
      signal: attempt.controller.signal,
    });
    reconciledSession = normalizeAuthSession(value, path);
  } catch (error) {
    if (!isCurrentAuthMutation(attempt)) throw authMutationSupersededError(path);
    if (error instanceof ApiError && error.status === 401) {
      commitAuthMutationSession(null, attempt, path);
      return { status: "LOGGED_OUT", authority: "RECONCILED_401" };
    }
    if (!enterIndeterminateAuthState(attempt)) throw authMutationSupersededError(path);
    throw indeterminateAuthError(path);
  }

  if (
    attempt.previousSession
    && isSameBrowserSessionAuthority(attempt.previousSession, reconciledSession)
  ) {
    commitAuthMutationSession(reconciledSession, attempt, path);
    return { status: "SESSION_ACTIVE", authority: "RECONCILED_ACTIVE" };
  }

  if (!enterIndeterminateAuthState(attempt)) throw authMutationSupersededError(path);
  throw indeterminateAuthError(path);
}

export async function logoutCurrentUser(): Promise<LogoutOutcome> {
  const path = "/auth/browser-sessions/current";
  const attempt = beginAuthMutation(true);
  try {
    await getJson<void>(path, {
      method: "DELETE",
      signal: attempt.controller.signal,
    });
    commitAuthMutationSession(null, attempt, path);
    return { status: "LOGGED_OUT", authority: "DELETE_ACK" };
  } catch {
    return reconcileFailedLogout(attempt, path);
  }
}

export async function fetchPatientMedicalRecords(): Promise<MedicalRecord[]> {
  return getAuthenticatedJson<MedicalRecord[]>("/patient/medical-records");
}

export async function fetchPatientPrescriptions(): Promise<Prescription[]> {
  return getAuthenticatedJson<Prescription[]>("/patient/prescriptions");
}

export async function fetchPatientDiagnosticResults(): Promise<DiagnosticResult[]> {
  return getAuthenticatedJson<DiagnosticResult[]>("/patient/diagnostic-results");
}

export async function fetchNotifications(
  page = 0,
  size = 20,
): Promise<Page<Notification>> {
  return getAuthenticatedJson<Page<Notification>>(
    `/notifications${toQuery({ page, size, sort: "createdAt,desc" })}`,
  );
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await getAuthenticatedJson<void>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PUT",
  });
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await getAuthenticatedJson<void>("/notifications/read-all", { method: "PATCH" });
}

export async function fetchDoctorPatientMedicalRecords(
  patientId: string,
): Promise<MedicalRecord[]> {
  return getAuthenticatedJson<MedicalRecord[]>(
    `/doctor/patients/${encodeURIComponent(patientId)}/medical-records`,
  );
}

export async function fetchDoctorPatientDiagnosticResults(
  patientId: string,
): Promise<DiagnosticResult[]> {
  return getAuthenticatedJson<DiagnosticResult[]>(
    `/doctor/patients/${encodeURIComponent(patientId)}/diagnostic-results`,
  );
}

export async function uploadDiagnosticFile(file: File, patientId: string): Promise<StoredFile> {
  const path = "/files/upload";
  const form = new FormData();
  form.set("file", file);
  form.set("patientId", patientId);
  form.set("purpose", "DIAGNOSTIC_RESULT");

  return withAuthenticatedSession(path, async () => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
    } catch {
      throw new ApiError("Không thể kết nối đến hệ thống. Vui lòng thử lại sau.", 0, path);
    }
    if (!response.ok) {
      throw await apiErrorFromResponse(response, path, "Không thể tải tệp lên.");
    }
    return response.json() as Promise<StoredFile>;
  });
}

export interface CreateDiagnosticResultPayload {
  testName: string;
  result?: string;
  fileId?: string;
  testDate?: string;
}

export async function createDoctorDiagnosticResult(
  patientId: string,
  payload: CreateDiagnosticResultPayload,
): Promise<DiagnosticResult> {
  return getAuthenticatedJson<DiagnosticResult>(
    `/doctor/patients/${encodeURIComponent(patientId)}/diagnostic-results`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function downloadProtectedFile(fileUrl: string, filename = "ket-qua"): Promise<void> {
  const normalizedPath = fileUrl.startsWith("/api/v1") ? fileUrl.slice("/api/v1".length) : fileUrl;
  const response = await withAuthenticatedSession(normalizedPath, async () => {
    try {
      const result = await fetch(`${API_BASE_URL}${normalizedPath}`, {
        credentials: "same-origin",
      });
      if (!result.ok) {
        throw await apiErrorFromResponse(result, normalizedPath, "Không thể tải tệp kết quả.");
      }
      return result;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Không thể kết nối đến hệ thống. Vui lòng thử lại sau.", 0, normalizedPath);
    }
  });
  const blobUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(blobUrl);
}

// ── Community Articles & Discussion ─────────────────────────────────────────

export interface ArticleComment {
  id: string;
  articleSlug: string;
  authorUserId: string;
  authorName: string;
  authorRole: "PATIENT" | "DOCTOR" | "ADMIN";
  content: string;
  parentCommentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchArticleComments(slug: string): Promise<ArticleComment[]> {
  return getJson<ArticleComment[]>(`/hospital/articles/${encodeURIComponent(slug)}/comments`);
}

export async function createArticleComment(
  slug: string,
  payload: { content: string; parentCommentId?: string | null }
): Promise<ArticleComment> {
  return getAuthenticatedJson<ArticleComment>(`/hospital/articles/${encodeURIComponent(slug)}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteArticleComment(slug: string, commentId: string): Promise<void> {
  return getAuthenticatedJson<void>(`/hospital/articles/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
  });
}

export async function doctorListArticles(page = 0, size = 20): Promise<Page<Article>> {
  return getAuthenticatedJson<Page<Article>>(`/doctor/articles${toQuery({ page, size })}`);
}

export async function doctorCreateArticle(payload: AdminArticlePayload): Promise<Article> {
  return getAuthenticatedJson<Article>("/doctor/articles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function doctorUpdateArticle(slug: string, payload: AdminArticlePayload): Promise<Article> {
  return getAuthenticatedJson<Article>(`/doctor/articles/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function doctorDeleteArticle(slug: string): Promise<void> {
  return getAuthenticatedJson<void>(`/doctor/articles/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

// ── AI Credits & Tier System ────────────────────────────────────────────────

export interface PatientCreditDto {
  patientId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  tier: string;
  credits: number;
}

export interface DoctorCreditDto {
  doctorId: string;
  userId: string;
  fullName: string;
  slug: string;
  credits: number;
}

export interface AiCreditStatus {
  tier?: string;
  credits: number;
  maxCredits: number;
  history?: Array<{
    id: string;
    targetRole: string;
    amount: number;
    balanceAfter: number;
    transactionType: string;
    description: string;
    createdAt: string;
  }>;
}

export async function adminListPatientAiCredits(): Promise<PatientCreditDto[]> {
  return getAuthenticatedJson<PatientCreditDto[]>("/admin/ai-credits/patients");
}

export async function adminListDoctorAiCredits(): Promise<DoctorCreditDto[]> {
  return getAuthenticatedJson<DoctorCreditDto[]>("/admin/ai-credits/doctors");
}

export async function adminGrantAiCredits(payload: {
  userId: string;
  targetRole: "PATIENT" | "DOCTOR";
  amount: number;
  description?: string;
}): Promise<{ status: string; message: string }> {
  return getAuthenticatedJson<{ status: string; message: string }>("/admin/ai-credits/grant", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdatePatientTier(payload: {
  patientProfileId: string;
  tier: string;
  credits?: number;
}): Promise<{ status: string; message: string }> {
  return getAuthenticatedJson<{ status: string; message: string }>("/admin/ai-credits/tier", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchPatientAiCreditStatus(): Promise<AiCreditStatus> {
  return getAuthenticatedJson<AiCreditStatus>("/patient/ai-credits/status");
}

export async function fetchDoctorAiCreditStatus(): Promise<AiCreditStatus> {
  return getAuthenticatedJson<AiCreditStatus>("/doctor/ai-credits/status");
}

// ── Realtime Cross-Role Catalog Broadcast ───────────────────────────────────

export function broadcastCatalogChange(detail: {
  kind: "package" | "faq" | "article";
  action: "created" | "updated" | "deleted";
  slug?: string;
}) {
  if (typeof window === "undefined") return;
  try {
    const channel = new BroadcastChannel("healthcare_catalog_updates");
    channel.postMessage(detail);
    channel.close();
  } catch {}
  window.dispatchEvent(new CustomEvent("healthcare:catalog-update", { detail }));
}

export function subscribeToCatalogChange(
  callback: (detail: { kind: "package" | "faq" | "article"; action: "created" | "updated" | "deleted"; slug?: string }) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel("healthcare_catalog_updates");
    channel.onmessage = (e) => callback(e.data);
  } catch {}
  const handler = (e: Event) => {
    callback((e as CustomEvent).detail);
  };
  window.addEventListener("healthcare:catalog-update", handler);
  return () => {
    window.removeEventListener("healthcare:catalog-update", handler);
    try {
      channel?.close();
    } catch {}
  };
}

// ── Media Assets & Image Upload ──────────────────────────────────────────

export interface MediaAssetResponse {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  purpose: string;
}

export async function uploadMediaAsset(file: File, purpose = "GENERAL"): Promise<MediaAssetResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", purpose);

  return getAuthenticatedJson<MediaAssetResponse>("/media/upload", {
    method: "POST",
    body: formData,
  });
}
