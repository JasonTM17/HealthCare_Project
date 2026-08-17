import type {
  AuthSession,
  AuthUser,
  Doctor,
  DiagnosticResult,
  Specialty,
  Branch,
  HealthPackage,
  Article,
  MedicalRecord,
  Notification,
  Prescription,
  UserProfile,
  AppointmentDetails,
  AiTriageCitation,
  AiTriageProvenance,
  AiTriageResult,
} from "../types/hospital";

export type {
  AuthSession,
  AuthUser,
  Doctor,
  DiagnosticResult,
  Specialty,
  Branch,
  HealthPackage,
  Article,
  MedicalRecord,
  Notification,
  Prescription,
  UserProfile,
  AppointmentDetails,
  AiTriageCitation,
  AiTriageProvenance,
  AiTriageResult,
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1";

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

export class ApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
  }
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const responseText = await res.text();
    let message = `Không thể tải dữ liệu (mã ${res.status}).`;
    try {
      const errorBody = JSON.parse(responseText) as { message?: unknown; error?: unknown };
      if (typeof errorBody.message === "string") message = errorBody.message;
      else if (typeof errorBody.error === "string") message = errorBody.error;
    } catch {
      // Keep the user-facing error generic when the server does not return JSON.
    }
    throw new ApiError(message, res.status, path);
  }
  if (res.status === 204) return undefined as T;
  const responseText = await res.text();
  return (responseText ? JSON.parse(responseText) : undefined) as T;
}

const AUTH_STORAGE_KEY = "healthcare.auth.session";
const AUTH_CHANGE_EVENT = "healthcare-auth-session-change";

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
    user.roles.every((role) => typeof role === "string")
  );
}

export function readAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      typeof parsed.tokenType !== "string" ||
      typeof parsed.expiresIn !== "number" ||
      !isAuthUser(parsed.user)
    ) {
      return null;
    }
    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export function storeAuthSession(session: AuthSession): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    notifyAuthSessionChange();
  }
}

export function clearAuthSession(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
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

async function getAuthenticatedJson<T>(path: string, init?: RequestInit): Promise<T> {
  const session = readAuthSession();
  if (!session) {
    throw new ApiError("Bạn cần đăng nhập để xem nội dung này.", 401, path);
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `${session.tokenType} ${session.accessToken}`);
  return getJson<T>(path, { ...init, headers });
}

interface SpecialtyRecommendationResponse {
  recommended_specialty: unknown;
  urgency_level: unknown;
  clinical_advice: unknown;
  suggested_questions: unknown;
  disclaimer?: unknown;
  citations?: unknown;
  provenance?: unknown;
}

const AI_SPECIALTY_RECOMMENDATION_PATH = "/ai/specialty-recommendation";
const AI_URGENCY_LEVELS = ["EMERGENCY", "HIGH", "NORMAL"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAiTriageCitation(value: unknown): value is AiTriageCitation {
  return typeof value === "string" || isRecord(value);
}

function isAiTriageProvenance(value: unknown): value is AiTriageProvenance {
  return typeof value === "string" || isRecord(value);
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
  return getJson<Doctor>(`/hospital/doctors/${slug}`);
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
  return getJson<Specialty>(`/hospital/specialties/${slug}`);
}

// ── Branches ────────────────────────────────────────────────────────────────

export async function fetchBranches(
  page = 0,
  size = 50,
): Promise<Page<Branch>> {
  return getJson<Page<Branch>>(`/hospital/branches${toQuery({ page, size })}`);
}

export async function fetchBranchBySlug(slug: string): Promise<Branch> {
  return getJson<Branch>(`/hospital/branches/${slug}`);
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
  return getJson<HealthPackage>(`/hospital/packages/${slug}`);
}

// ── Articles ───────────────────────────────────────────────────────────────

export async function fetchArticles(
  page = 0,
  size = 50,
): Promise<Page<Article>> {
  return getJson<Page<Article>>(`/hospital/articles${toQuery({ page, size })}`);
}

export async function fetchArticleBySlug(slug: string): Promise<Article> {
  return getJson<Article>(`/hospital/articles/${slug}`);
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
  return getAuthenticatedJson<Doctor>(`/admin/doctors/${slug}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteDoctor(slug: string): Promise<void> {
  await getAuthenticatedJson<void>(`/admin/doctors/${slug}`, { method: "DELETE" });
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
  return getAuthenticatedJson<Specialty>(`/admin/specialties/${slug}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteSpecialty(slug: string): Promise<void> {
  await getAuthenticatedJson<void>(`/admin/specialties/${slug}`, { method: "DELETE" });
}

// ── Authentication and portal data ─────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export async function login(payload: LoginPayload): Promise<AuthSession> {
  const session = await getJson<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  storeAuthSession(session);
  return session;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  return getAuthenticatedJson<UserProfile>("/users/me");
}

export async function fetchPatientAppointments(
  page = 0,
  size = 20,
): Promise<Page<AppointmentDetails>> {
  return getAuthenticatedJson<Page<AppointmentDetails>>(
    `/patient/appointments${toQuery({ page, size })}`,
  );
}

export async function fetchDoctorAppointments(
  date: string,
  status?: string,
  page = 0,
  size = 50,
): Promise<Page<AppointmentDetails>> {
  const normalizedDate = date.trim();
  const path = "/doctor/appointments";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw new ApiError("Ngày xem lịch phải có định dạng YYYY-MM-DD.", 400, path);
  }

  return getAuthenticatedJson<Page<AppointmentDetails>>(
    `${path}${toQuery({ date: normalizedDate, status, page, size })}`,
  );
}

export async function logoutCurrentUser(): Promise<void> {
  try {
    if (readAuthSession()) {
      await getAuthenticatedJson<void>("/auth/logout", { method: "POST" });
    }
  } finally {
    clearAuthSession();
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
