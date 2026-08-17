import type {
  Doctor,
  Specialty,
  Branch,
  HealthPackage,
  Article,
} from "../types/hospital";

export type { Doctor, Specialty, Branch, HealthPackage, Article };

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

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
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
  return getJson<Page<Doctor>>(`/admin/doctors${toQuery({ page, size })}`);
}

export async function adminCreateDoctor(payload: AdminDoctorPayload): Promise<Doctor> {
  return getJson<Doctor>("/admin/doctors", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateDoctor(
  slug: string,
  payload: AdminDoctorPayload,
): Promise<Doctor> {
  return getJson<Doctor>(`/admin/doctors/${slug}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteDoctor(slug: string): Promise<void> {
  await fetch(`${API_BASE_URL}/admin/doctors/${slug}`, { method: "DELETE" });
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
  return getJson<Page<Specialty>>(`/admin/specialties${toQuery({ page, size })}`);
}

export async function adminCreateSpecialty(payload: AdminSpecialtyPayload): Promise<Specialty> {
  return getJson<Specialty>("/admin/specialties", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateSpecialty(
  slug: string,
  payload: AdminSpecialtyPayload,
): Promise<Specialty> {
  return getJson<Specialty>(`/admin/specialties/${slug}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteSpecialty(slug: string): Promise<void> {
  await fetch(`${API_BASE_URL}/admin/specialties/${slug}`, { method: "DELETE" });
}
