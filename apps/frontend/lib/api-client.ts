import type {
  AuthSession,
  AuthUser,
  Doctor,
  DiagnosticResult,
  Specialty,
  Branch,
  HealthPackage,
  MedicalService,
  Faq,
  Article,
  MedicalRecord,
  Notification,
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
} from "../types/hospital";

export type {
  AuthSession,
  AuthUser,
  Doctor,
  DiagnosticResult,
  Specialty,
  Branch,
  HealthPackage,
  MedicalService,
  Faq,
  Article,
  MedicalRecord,
  Notification,
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
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";
const API_REQUEST_TIMEOUT_MS = 12_000;

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

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const requestController = new AbortController();
  const callerSignal = init?.signal;
  const abortFromCaller = () => requestController.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const timeoutId = setTimeout(() => requestController.abort(), API_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: requestController.signal,
    });
  } catch {
    throw new ApiError("Không thể kết nối đến hệ thống. Vui lòng thử lại sau.", 0, path);
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
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
}

const AUTH_STORAGE_KEY = "healthcare.auth.session";
const AUTH_CHANGE_EVENT = "healthcare-auth-session-change";
let authSessionSnapshotCache: { raw: string | null; session: AuthSession | null } = {
  raw: null,
  session: null,
};
let authSessionVersion = 0;

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
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (raw === authSessionSnapshotCache.raw) return authSessionSnapshotCache.session;
  authSessionSnapshotCache.raw = raw;
  if (!raw) {
    authSessionSnapshotCache.session = null;
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      typeof parsed.tokenType !== "string" ||
      typeof parsed.expiresIn !== "number" ||
      !isAuthUser(parsed.user)
    ) {
      authSessionSnapshotCache.session = null;
      return null;
    }
    authSessionSnapshotCache.session = {
      ...(parsed as AuthSession),
      user: normalizeAuthUser(parsed.user),
    };
    return authSessionSnapshotCache.session;
  } catch {
    authSessionSnapshotCache.session = null;
    return null;
  }
}

export function storeAuthSession(session: AuthSession): void {
  if (typeof window !== "undefined") {
    const normalizedSession: AuthSession = {
      ...session,
      user: normalizeAuthUser(session.user),
    };
    const raw = JSON.stringify(normalizedSession);
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, raw);
    authSessionSnapshotCache = { raw, session: normalizedSession };
    authSessionVersion += 1;
    notifyAuthSessionChange();
  }
}

export function clearAuthSession(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    authSessionSnapshotCache = { raw: null, session: null };
    authSessionVersion += 1;
    notifyAuthSessionChange();
  }
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

export function hasRole(user: AuthUser | UserProfile, role: string): boolean {
  const expected = role.replace(/^ROLE_/, "").toUpperCase();
  return user.roles.some(
    (value) => value.replace(/^ROLE_/, "").toUpperCase() === expected,
  );
}

interface RefreshAuthSessionFlight {
  refreshToken: string;
  sessionVersion: number;
  promise: Promise<AuthSession | null>;
}

let refreshAuthSessionFlight: RefreshAuthSessionFlight | null = null;

function authSessionsMatch(
  currentSession: AuthSession | null,
  expectedSession: AuthSession,
): boolean {
  return Boolean(
    currentSession
    && currentSession.user.id === expectedSession.user.id
    && currentSession.accessToken === expectedSession.accessToken
    && currentSession.refreshToken === expectedSession.refreshToken,
  );
}

function clearAuthSessionIfCurrent(
  expectedSession: AuthSession,
  expectedVersion: number,
): void {
  if (
    authSessionVersion === expectedVersion
    && authSessionsMatch(readAuthSession(), expectedSession)
  ) {
    clearAuthSession();
  }
}

function expiredSessionError(path: string): ApiError {
  return new ApiError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401, path);
}

async function refreshStoredAuthSession(currentSession: AuthSession): Promise<AuthSession | null> {
  const latestSession = readAuthSession();
  if (!authSessionsMatch(latestSession, currentSession)) {
    return null;
  }

  const sessionVersion = authSessionVersion;
  if (
    refreshAuthSessionFlight
    && refreshAuthSessionFlight.refreshToken === currentSession.refreshToken
    && refreshAuthSessionFlight.sessionVersion === sessionVersion
  ) {
    return refreshAuthSessionFlight.promise;
  }

  const flight: RefreshAuthSessionFlight = {
    refreshToken: currentSession.refreshToken,
    sessionVersion,
    promise: Promise.resolve(null),
  };
  flight.promise = getJson<AuthSession>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: currentSession.refreshToken }),
  })
    .then((session) => {
      if (
        authSessionVersion !== sessionVersion
        || !authSessionsMatch(readAuthSession(), currentSession)
      ) {
        return null;
      }
      storeAuthSession(session);
      return readAuthSession();
    })
    .catch(() => {
      clearAuthSessionIfCurrent(currentSession, sessionVersion);
      return null;
    })
    .finally(() => {
      if (refreshAuthSessionFlight === flight) {
        refreshAuthSessionFlight = null;
      }
    });
  refreshAuthSessionFlight = flight;

  return flight.promise;
}

async function withAuthenticatedSession<T>(
  path: string,
  request: (session: AuthSession) => Promise<T>,
): Promise<T> {
  const session = readAuthSession();
  if (!session) {
    throw new ApiError("Bạn cần đăng nhập để xem nội dung này.", 401, path);
  }

  try {
    return await request(session);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;

    const refreshedSession = await refreshStoredAuthSession(session);
    if (!refreshedSession) throw expiredSessionError(path);

    const retrySessionVersion = authSessionVersion;
    try {
      return await request(refreshedSession);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        clearAuthSessionIfCurrent(refreshedSession, retrySessionVersion);
      }
      throw retryError;
    }
  }
}

async function getAuthenticatedJson<T>(path: string, init?: RequestInit): Promise<T> {
  return withAuthenticatedSession(path, (session) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `${session.tokenType} ${session.accessToken}`);
    return getJson<T>(path, { ...init, headers });
  });
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
const AI_URGENCY_LEVELS = ["EMERGENCY", "HIGH", "NORMAL"] as const;
const AI_CITATION_SOURCE_TYPES = ["specialty", "doctor", "service", "package", "article", "faq"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AI_CITATION_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

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
  return isRecord(value)
    && Object.keys(value).length === 3
    && typeof value.source_type === "string"
    && (AI_CITATION_SOURCE_TYPES as readonly string[]).includes(value.source_type)
    && typeof value.source_id === "string"
    && AI_CITATION_ID_PATTERN.test(value.source_id)
    && typeof value.title === "string"
    && value.title.trim().length > 0
    && value.title.length <= 300;
}

function parseAiConversation(value: unknown, path: string): AiConversation {
  if (!isRecord(value)) throw invalidAiChatResponse(path);
  const status = value.status;
  const lastMessageAt = value.lastMessageAt;
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
  ) {
    throw invalidAiChatResponse(path);
  }
  return {
    id: value.id,
    title: value.title,
    status,
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
    citations,
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
export async function recommendSpecialty(symptoms: string): Promise<AiTriageResult> {
  const normalized = symptoms.trim();
  if (normalized.length < 2 || normalized.length > 10000) {
    throw new ApiError(
      "Mô tả triệu chứng phải dài từ 2 đến 10000 ký tự.",
      400,
      AI_SPECIALTY_RECOMMENDATION_PATH,
    );
  }

  const response = await getAuthenticatedJson<SpecialtyRecommendationResponse>(
    AI_SPECIALTY_RECOMMENDATION_PATH,
    {
      method: "POST",
      body: JSON.stringify({ symptoms: normalized }),
    },
  );

  if (
    typeof response.recommended_specialty !== "string" ||
    typeof response.clinical_advice !== "string" ||
    !Array.isArray(response.suggested_questions) ||
    response.suggested_questions.some((question) => typeof question !== "string")
  ) {
    throw new ApiError(
      "Dịch vụ AI trả về dữ liệu không đúng định dạng.",
      502,
      AI_SPECIALTY_RECOMMENDATION_PATH,
    );
  }

  if (
    typeof response.urgency_level !== "string" ||
    !(AI_URGENCY_LEVELS as readonly string[]).includes(response.urgency_level)
  ) {
    throw new ApiError(
      "Dịch vụ AI trả về mức độ ưu tiên không hợp lệ.",
      502,
      AI_SPECIALTY_RECOMMENDATION_PATH,
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
  return getJson<Page<HealthPackage>>(
    `/hospital/packages${toQuery({ page, size })}`,
  );
}

export async function fetchPackageBySlug(slug: string): Promise<HealthPackage> {
  return getJson<HealthPackage>(`/hospital/packages/${encodeURIComponent(slug)}`);
}

// ── Services and FAQs ───────────────────────────────────────────────────────

export async function fetchServices(
  page = 0,
  size = 50,
): Promise<Page<MedicalService>> {
  return getJson<Page<MedicalService>>(
    `/hospital/services${toQuery({ page, size })}`,
  );
}

export async function fetchServiceBySlug(slug: string): Promise<MedicalService> {
  return getJson<MedicalService>(`/hospital/services/${encodeURIComponent(slug)}`);
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
export interface AdminArticlePayload { title: string; slug: string; summary?: string | null; body?: string | null; active: boolean }
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
): Promise<Page<Article>> {
  return getJson<Page<Article>>(`/hospital/articles${toQuery({ page, size })}`);
}

export async function fetchArticleBySlug(slug: string): Promise<Article> {
  return getJson<Article>(`/hospital/articles/${encodeURIComponent(slug)}`);
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
  const session = await getJson<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  storeAuthSession(session);
  return session;
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
  const session = await getJson<AuthSession>("/auth/email-verifications/confirm", {
    method: "POST",
    body: JSON.stringify({ email: payload.email, otp: payload.code }),
  });
  storeAuthSession(session);
  return session;
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
}

export async function updatePatientProfile(payload: UpdatePatientProfilePayload): Promise<PatientProfile> {
  return getAuthenticatedJson<PatientProfile>("/patient/profile", {
    method: "PUT",
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

export async function createAiConversation(title?: string): Promise<AiConversation> {
  const path = "/ai/conversations";
  const response = await getAuthenticatedJson<unknown>(path, {
    method: "POST",
    body: JSON.stringify(title?.trim() ? { title: title.trim() } : {}),
  });
  return parseAiConversation(response, path);
}

export async function fetchAiConversations(): Promise<AiConversation[]> {
  const path = "/ai/conversations";
  const response = await getAuthenticatedJson<unknown>(path);
  if (!Array.isArray(response)) throw invalidAiChatResponse(path);
  return response.map((conversation) => parseAiConversation(conversation, path));
}

export async function fetchAiConversation(conversationId: string): Promise<AiConversation> {
  const path = `/ai/conversations/${encodeURIComponent(conversationId)}`;
  const response = await getAuthenticatedJson<unknown>(path);
  return parseAiConversation(response, path);
}

export async function fetchAiConversationMessages(
  conversationId: string,
  cursor?: string | null,
  limit = 30,
): Promise<AiChatMessagePage> {
  const path = `/ai/conversations/${encodeURIComponent(conversationId)}/messages${toQuery({
    cursor: cursor ?? undefined,
    limit: Math.max(1, Math.min(limit, 100)),
  })}`;
  const response = await getAuthenticatedJson<unknown>(path);
  return parseAiChatMessagePage(response, path);
}

export async function sendAiConversationMessage(
  conversationId: string,
  content: string,
  idempotencyKey: string,
): Promise<AiChatExchange> {
  const path = `/ai/conversations/${encodeURIComponent(conversationId)}/messages`;
  const response = await getAuthenticatedJson<unknown>(path, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ content }),
  });
  return parseAiChatExchange(response, path);
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

export async function logoutCurrentUser(): Promise<void> {
  const session = readAuthSession();
  if (!session) return;
  const sessionVersion = authSessionVersion;
  try {
    const headers = new Headers();
    headers.set("Authorization", `${session.tokenType} ${session.accessToken}`);
    await getJson<void>("/auth/logout", { method: "POST", headers });
  } finally {
    clearAuthSessionIfCurrent(session, sessionVersion);
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

  return withAuthenticatedSession(path, async (session) => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: { Authorization: `${session.tokenType} ${session.accessToken}` },
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
  const response = await withAuthenticatedSession(normalizedPath, async (session) => {
    try {
      const result = await fetch(`${API_BASE_URL}${normalizedPath}`, {
        headers: { Authorization: `${session.tokenType} ${session.accessToken}` },
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
