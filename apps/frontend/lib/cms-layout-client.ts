import { ApiError, requestAdminJson } from "./api-client";
import { CmsValidationError } from "./cms-client";
import { createNativeCmsLayout, parseCmsPageLayout, type CmsPageLayout } from "./cms-page-layout";
import type { CmsPageIdentity } from "./cms-page-manifest";

export interface CmsLayoutPublication {
  slotKey: string;
  componentType: "PAGE_LAYOUT";
  payload: CmsPageLayout;
  status: "PUBLISHED";
  version: number;
  updatedAt: string;
}
export interface CmsLayoutDraft {
  slotKey: string;
  expectedVersion: number;
  hasDraft: boolean;
  componentType: "PAGE_LAYOUT";
  payload: CmsPageLayout;
  draftUpdatedAt: string | null;
  publicContent: CmsLayoutPublication | null;
}
export interface CmsLayoutHistory {
  eventId: number;
  version: number;
  payload: CmsPageLayout;
  status: "DRAFT" | "PUBLISHED";
  actorEmail: string;
  changedAt: string;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CmsValidationError("Dữ liệu nội dung không hợp lệ.");
  return value as Record<string, unknown>;
}
function integer(value: unknown, minimum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw new CmsValidationError("Phiên bản nội dung không hợp lệ.");
  return value;
}
function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new CmsValidationError("Thời gian nội dung không hợp lệ.");
  return value;
}
function identityRecord(value: unknown, identity: CmsPageIdentity): Record<string, unknown> {
  const result = record(value);
  if (result.slotKey !== identity.slotKey || result.componentType !== "PAGE_LAYOUT") throw new CmsValidationError("Nội dung trả về không thuộc trang đang mở.");
  return result;
}
export function parseCmsLayoutPublication(value: unknown, identity: CmsPageIdentity): CmsLayoutPublication {
  const result = identityRecord(value, identity);
  if (result.status !== "PUBLISHED") throw new CmsValidationError("Nội dung chưa được xuất bản.");
  return { slotKey: identity.slotKey, componentType: "PAGE_LAYOUT", status: "PUBLISHED", payload: parseCmsPageLayout(result.payload, identity), version: integer(result.version, 1), updatedAt: date(result.updatedAt) };
}
export function parseCmsLayoutDraft(value: unknown, identity: CmsPageIdentity): CmsLayoutDraft {
  const result = identityRecord(value, identity);
  if (typeof result.hasDraft !== "boolean") throw new CmsValidationError("Trạng thái bản nháp không hợp lệ.");
  return { slotKey: identity.slotKey, componentType: "PAGE_LAYOUT", expectedVersion: integer(result.expectedVersion, 1), hasDraft: result.hasDraft, payload: parseCmsPageLayout(result.payload, identity), draftUpdatedAt: result.draftUpdatedAt === null ? null : date(result.draftUpdatedAt), publicContent: result.publicContent === null ? null : parseCmsLayoutPublication(result.publicContent, identity) };
}
export function emptyCmsLayoutDraft(identity: CmsPageIdentity): CmsLayoutDraft {
  return { slotKey: identity.slotKey, componentType: "PAGE_LAYOUT", expectedVersion: 0, hasDraft: false, payload: createNativeCmsLayout(identity), draftUpdatedAt: null, publicContent: null };
}
export async function fetchPublishedCmsLayout(identity: CmsPageIdentity, signal?: AbortSignal): Promise<CmsLayoutPublication | null> {
  const timeout = AbortSignal.timeout(28_000);
  const response = await fetch(`/api/v1/cms/content/${encodeURIComponent(identity.slotKey)}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, credentials: "same-origin", cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError("Không thể tải nội dung đã xuất bản.", response.status, identity.slotKey);
  return parseCmsLayoutPublication(await response.json(), identity);
}
export class CmsLayoutClient {
  constructor(private readonly request: typeof requestAdminJson = requestAdminJson) {}
  private path(identity: CmsPageIdentity): string { return `/admin/cms/content/${encodeURIComponent(identity.slotKey)}`; }
  async getDraft(identity: CmsPageIdentity, signal?: AbortSignal): Promise<CmsLayoutDraft> {
    try { return parseCmsLayoutDraft(await this.request(`${this.path(identity)}/draft`, { signal }), identity); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return emptyCmsLayoutDraft(identity); throw error; }
  }
  async saveDraft(identity: CmsPageIdentity, payload: CmsPageLayout, expectedVersion: number): Promise<CmsLayoutDraft> {
    integer(expectedVersion, 0);
    const safe = parseCmsPageLayout(payload, identity);
    return parseCmsLayoutDraft(await this.request(`${this.path(identity)}/draft`, { method: "PUT", body: JSON.stringify({ componentType: "PAGE_LAYOUT", payload: safe, expectedVersion }) }), identity);
  }
  async publish(identity: CmsPageIdentity, expectedVersion: number): Promise<CmsLayoutDraft> {
    integer(expectedVersion, 1);
    return parseCmsLayoutDraft(await this.request(`${this.path(identity)}/publish`, { method: "POST", body: JSON.stringify({ expectedVersion }) }), identity);
  }
  async history(identity: CmsPageIdentity, signal?: AbortSignal): Promise<CmsLayoutHistory[]> {
    const rows = await this.request(`${this.path(identity)}/history?limit=50`, { signal });
    if (!Array.isArray(rows) || rows.length > 50) throw new CmsValidationError("Lịch sử nội dung không hợp lệ.");
    return rows.map((raw) => {
      const row = identityRecord(raw, identity);
      if ((row.status !== "DRAFT" && row.status !== "PUBLISHED") || typeof row.actorEmail !== "string") throw new CmsValidationError("Lịch sử nội dung không hợp lệ.");
      return { eventId: integer(row.eventId, 1), version: integer(row.version, 1), payload: parseCmsPageLayout(row.payload, identity), status: row.status, actorEmail: row.actorEmail, changedAt: date(row.changedAt) };
    });
  }
  async restore(identity: CmsPageIdentity, changeId: number, expectedVersion: number): Promise<CmsLayoutDraft> {
    integer(changeId, 1); integer(expectedVersion, 1);
    return parseCmsLayoutDraft(await this.request(`${this.path(identity)}/restore-draft`, { method: "POST", body: JSON.stringify({ changeId, expectedVersion }) }), identity);
  }
}
export const cmsLayoutClient = new CmsLayoutClient();
