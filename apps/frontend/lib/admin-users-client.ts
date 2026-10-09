import { ApiError, requestAdminJson } from "./api-client";

export const ACCOUNT_ROLES = ["PATIENT", "DOCTOR", "ADMIN"] as const;
export type AccountRole = typeof ACCOUNT_ROLES[number];
export type AccountStatus = "ACTIVE" | "DISABLED";
export type AccountAction = "verification" | "password-reset" | "revoke-sessions";
export interface AccountDoctorProfile { id: string; slug: string; fullName: string; active: boolean }
export interface AdminAccount {
  id: string; email: string; displayName: string; status: AccountStatus; roles: AccountRole[];
  emailVerified: boolean; emailVerifiedAt: string | null; demo: boolean;
  createdAt: string | null; updatedAt: string; version: number;
  doctorProfile: AccountDoctorProfile | null; patientProfileId: string | null; googleLinked: boolean;
}
export interface AccountPage { content: AdminAccount[]; number: number; size: number; totalElements: number; totalPages: number }
export interface AccountFilters {
  q?: string; role?: AccountRole | ""; status?: AccountStatus | ""; verified?: boolean; demo?: boolean;
  createdFrom?: string; createdTo?: string; page?: number; size?: number;
  sort?: "createdAt" | "updatedAt" | "displayName" | "email" | "status"; direction?: "asc" | "desc";
}
export interface AccountCreate { email: string; displayName: string; password: string; roles: AccountRole[]; doctorProfileId?: string }
export interface AccountExpected { expectedVersion: number; expectedUpdatedAt: string }
export interface AccountUpdate extends AccountExpected {
  email: string; displayName: string; status: AccountStatus; roles: AccountRole[];
  doctorProfileId?: string; unlinkDoctorProfile: boolean;
}
export interface AccountActionResponse {
  account: AdminAccount; action: "CREATED" | AccountAction; deliveryState: "REQUESTED_UNCONFIRMED" | "NOT_APPLICABLE";
}
const ROOT = "/admin/users";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function invalid(): never { throw new ApiError("Dữ liệu tài khoản chưa đọc được. Vui lòng tải lại.", 502, ROOT); }
function string(value: unknown): string { return typeof value === "string" ? value : invalid(); }
function uuid(value: unknown): string { const text = string(value); return UUID.test(text) ? text : invalid(); }
function boolean(value: unknown): boolean { return typeof value === "boolean" ? value : invalid(); }
function instant(value: unknown): string {
  const text = string(value);
  return INSTANT.test(text) && Number.isFinite(Date.parse(text)) ? text : invalid();
}
function integer(value: unknown): number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : invalid(); }
export function parseAdminAccount(value: unknown): AdminAccount {
  if (!record(value) || !Array.isArray(value.roles) || !value.roles.length || value.roles.length > 3) invalid();
  const roles = value.roles.map((role) => {
    if (!ACCOUNT_ROLES.includes(role as AccountRole)) invalid();
    return role as AccountRole;
  });
  if (new Set(roles).size !== roles.length || !["ACTIVE", "DISABLED"].includes(string(value.status))) invalid();
  let doctorProfile: AccountDoctorProfile | null = null;
  if (value.doctorProfile !== null) {
    if (!record(value.doctorProfile)) invalid();
    doctorProfile = { id: uuid(value.doctorProfile.id), slug: string(value.doctorProfile.slug), fullName: string(value.doctorProfile.fullName), active: boolean(value.doctorProfile.active) };
  }
  // Build an explicit safe DTO: even an accidental server secret is never retained.
  return {
    id: uuid(value.id), email: string(value.email), displayName: string(value.displayName), status: value.status as AccountStatus, roles,
    emailVerified: boolean(value.emailVerified), emailVerifiedAt: value.emailVerifiedAt === null ? null : instant(value.emailVerifiedAt),
    demo: boolean(value.demo), createdAt: value.createdAt === null ? null : instant(value.createdAt),
    updatedAt: instant(value.updatedAt), version: integer(value.version), doctorProfile,
    patientProfileId: value.patientProfileId === null ? null : uuid(value.patientProfileId), googleLinked: boolean(value.googleLinked),
  };
}
export function parseAccountPage(value: unknown): AccountPage {
  if (!record(value) || !Array.isArray(value.content)) invalid();
  const size = integer(value.size);
  if (size < 1 || size > 100 || value.content.length > size) invalid();
  const content = value.content.map(parseAdminAccount);
  const number = integer(value.number);
  const totalElements = integer(value.totalElements);
  const totalPages = integer(value.totalPages);
  if (number > 10000 || totalPages !== Math.ceil(totalElements / size) || new Set(content.map((account) => account.id.toLowerCase())).size !== content.length) invalid();
  return { content, number, size, totalElements, totalPages };
}
export function expectedAccount(account: AdminAccount): AccountExpected {
  return { expectedVersion: account.version, expectedUpdatedAt: account.updatedAt };
}
function parseAction(value: unknown, action: AccountActionResponse["action"]): AccountActionResponse {
  if (!record(value) || value.action !== action || !["REQUESTED_UNCONFIRMED", "NOT_APPLICABLE"].includes(string(value.deliveryState))) invalid();
  const expectedDelivery = action === "revoke-sessions" ? "NOT_APPLICABLE" : "REQUESTED_UNCONFIRMED";
  if (value.deliveryState !== expectedDelivery) invalid();
  return { account: parseAdminAccount(value.account), action, deliveryState: value.deliveryState as AccountActionResponse["deliveryState"] };
}
function idPath(id: string): string {
  if (!UUID.test(id)) throw new ApiError("Mã tài khoản không hợp lệ.", 400, ROOT);
  return `${ROOT}/${id}`;
}
function accountAt(value: unknown, id: string): AdminAccount {
  const account = parseAdminAccount(value);
  if (account.id !== id) invalid();
  return account;
}
function validateRoles(roles: AccountRole[]): void {
  if (!roles.length || roles.length > 3 || new Set(roles).size !== roles.length || roles.some((role) => !ACCOUNT_ROLES.includes(role))) throw new ApiError("Chọn ít nhất một vai trò hợp lệ.", 400, ROOT);
}
function validateIdentity(body: AccountCreate | AccountUpdate): void {
  validateRoles(body.roles);
  if (body.displayName.trim().length < 2 || body.displayName.trim().length > 160 || /[\u0000-\u001f\u007f]/.test(body.displayName)
    || body.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) throw new ApiError("Kiểm tra họ tên và email.", 400, ROOT);
  if (body.doctorProfileId && (!UUID.test(body.doctorProfileId) || !body.roles.includes("DOCTOR"))) throw new ApiError("Hồ sơ bác sĩ cần vai trò bác sĩ.", 400, ROOT);
}
export function accountDateBounds(from: string, through: string): Pick<AccountFilters, "createdFrom" | "createdTo"> {
  function date(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Chọn ngày hợp lệ.");
    const parsed = new Date(`${value}T00:00:00+07:00`);
    if (!Number.isFinite(parsed.valueOf()) || new Date(parsed.valueOf() + 7 * 3_600_000).toISOString().slice(0, 10) !== value) throw new Error("Chọn ngày hợp lệ.");
    return parsed;
  }
  const start = from ? date(from) : null;
  const end = through ? new Date(date(through).valueOf() + 86_400_000) : null;
  if (start && end && start >= end) throw new Error("Ngày bắt đầu phải trước hoặc trùng ngày kết thúc.");
  return { ...(start ? { createdFrom: start.toISOString() } : {}), ...(end ? { createdTo: end.toISOString() } : {}) };
}
export class AdminUsersClient {
  constructor(private readonly request: typeof requestAdminJson = requestAdminJson) {}
  async list(filters: AccountFilters = {}, signal?: AbortSignal): Promise<AccountPage> {
    const query = new URLSearchParams();
    const fields = { page: 0, size: 20, sort: "createdAt", direction: "desc", ...filters };
    if ((fields.q?.length ?? 0) > 160 || !Number.isInteger(fields.page) || fields.page < 0 || fields.page > 10000 || !Number.isInteger(fields.size) || fields.size < 1 || fields.size > 100
      || !["createdAt", "updatedAt", "displayName", "email", "status"].includes(fields.sort) || !["asc", "desc"].includes(fields.direction)
      || fields.role && !ACCOUNT_ROLES.includes(fields.role) || fields.status && !["ACTIVE", "DISABLED"].includes(fields.status)) throw new ApiError("Bộ lọc tài khoản không hợp lệ.", 400, ROOT);
    for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== "") query.set(key, String(value));
    const result = parseAccountPage(await this.request(`${ROOT}?${query}`, { signal }));
    if (result.number !== fields.page || result.size !== fields.size) invalid();
    return result;
  }
  async get(id: string, signal?: AbortSignal): Promise<AdminAccount> { return accountAt(await this.request(idPath(id), { signal }), id); }
  async create(body: AccountCreate): Promise<AccountActionResponse> {
    validateIdentity(body);
    if (body.roles.includes("DOCTOR") && !body.doctorProfileId) throw new ApiError("Chọn hồ sơ bác sĩ đang hoạt động.", 400, ROOT);
    if (body.password.length < 8 || body.password.length > 128 || new TextEncoder().encode(body.password).length > 72 || !/\p{L}/u.test(body.password) || !/\d/.test(body.password)) throw new ApiError("Mật khẩu cần 8–128 ký tự, có chữ và số, tối đa 72 byte UTF-8.", 400, ROOT);
    const payload = { email: body.email.trim(), displayName: body.displayName.trim(), password: body.password, roles: [...body.roles], ...(body.doctorProfileId ? { doctorProfileId: body.doctorProfileId } : {}) };
    return parseAction(await this.request(ROOT, { method: "POST", body: JSON.stringify(payload) }), "CREATED");
  }
  async update(id: string, body: AccountUpdate): Promise<AdminAccount> {
    validateIdentity(body);
    if (!["ACTIVE", "DISABLED"].includes(body.status)) throw new ApiError("Trạng thái không hợp lệ.", 400, ROOT);
    const payload = { email: body.email.trim(), displayName: body.displayName.trim(), status: body.status, roles: [...body.roles], ...(body.doctorProfileId ? { doctorProfileId: body.doctorProfileId } : {}), unlinkDoctorProfile: body.unlinkDoctorProfile, expectedVersion: integer(body.expectedVersion), expectedUpdatedAt: instant(body.expectedUpdatedAt) };
    return accountAt(await this.request(idPath(id), { method: "PUT", body: JSON.stringify(payload) }), id);
  }
  async action(id: string, action: AccountAction, expected: AccountExpected): Promise<AccountActionResponse> {
    if (!["verification", "password-reset", "revoke-sessions"].includes(action)) throw new ApiError("Thao tác không hợp lệ.", 400, ROOT);
    const body = { expectedVersion: integer(expected.expectedVersion), expectedUpdatedAt: instant(expected.expectedUpdatedAt) };
    const result = parseAction(await this.request(`${idPath(id)}/${action}`, { method: "POST", body: JSON.stringify(body) }), action);
    if (result.account.id !== id) invalid();
    return result;
  }
}
export const adminUsers = new AdminUsersClient();

const REJECTION_COPY: Record<string, string> = {
  "Email already belongs to an account": "Email đã thuộc một tài khoản khác.",
  "The final active verified administrator must remain available": "Cần giữ ít nhất một quản trị viên hoạt động đã xác minh email.",
  "You cannot disable, demote or change the verified identity of your own administrator account": "Bạn không thể tự khóa, gỡ quyền quản trị hoặc đổi email đang sử dụng.",
  "Doctor profile is already linked to another account": "Hồ sơ bác sĩ đã liên kết với tài khoản khác. Chọn hồ sơ khác.",
  "Confirm unlinking the doctor profile before removing DOCTOR": "Xác nhận gỡ liên kết hồ sơ trước khi bỏ vai trò bác sĩ.",
  "Edit the linked doctor's name in doctor management": "Tên bác sĩ thuộc hồ sơ chuyên môn. Sửa tại Quản lý bác sĩ.",
  "Display name must match the doctor profile; edit the name in doctor management": "Tên hiển thị cần trùng hồ sơ bác sĩ. Sửa tên tại Quản lý bác sĩ.",
  "Select an existing active doctor profile": "Chọn hồ sơ bác sĩ đang hoạt động.",
};
export function accountError(error: unknown): string {
  if (error instanceof ApiError) {
    if (REJECTION_COPY[error.message]) return REJECTION_COPY[error.message];
    if (error.status === 401) return "Phiên quản trị đã hết hạn. Hãy đăng nhập lại; nội dung đang sửa vẫn được giữ trong màn hình này.";
    if (error.status === 403) return "Tài khoản trải nghiệm hoặc phiên hiện tại không được phép thay đổi dữ liệu.";
    if (error.status === 409) return "Thông tin đã thay đổi hoặc thao tác không được phép. Xem thông tin mới trước khi xác nhận lại; nội dung đang sửa vẫn được giữ.";
    if (error.status === 400 || error.status === 422) return "Thông tin chưa hợp lệ. Kiểm tra email, họ tên, vai trò và hồ sơ liên kết; nội dung đang sửa vẫn được giữ.";
    if (error.status === 429) return "Có quá nhiều yêu cầu. Chờ một lát trước khi thử lại.";
    if (error.status === 404) return "Không tìm thấy tài khoản hoặc hồ sơ liên kết.";
  }
  return "Không thể hoàn tất yêu cầu. Thử lại sau; nội dung đang sửa vẫn được giữ.";
}
