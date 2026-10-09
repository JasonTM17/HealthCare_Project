import { parseCmsPageLayout, type CmsLayoutValue, type CmsPageLayout } from "./cms-page-layout";
import type { CmsPageIdentity } from "./cms-page-manifest";

const CHANNEL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CMS_PREVIEW_PROTOCOL = "healthcare.cms.preview.v1";
export interface CmsPreviewEnvelope {
  protocol: typeof CMS_PREVIEW_PROTOCOL;
  channel: string;
  slotKey: string;
  path: string;
  revision: number;
}
export type CmsPreviewHostMessage = CmsPreviewEnvelope & (
  | { type: "render"; mode: "draft" | "published"; layout: CmsPageLayout }
  | { type: "focus"; fieldId: string }
);
export type CmsPreviewFramePayload =
  | { type: "ready"; expectedVersion: number }
  | { type: "selected"; fieldId: string; nativeValue: CmsLayoutValue }
  | { type: "blocked" }
;
export type CmsPreviewFrameMessage = CmsPreviewEnvelope & CmsPreviewFramePayload;
export function readCmsPreviewRequest(search: string): { channel: string } | null {
  const query = new URLSearchParams(search);
  const channel = query.get("cmsChannel");
  return query.getAll("cmsPreview").length === 1 && query.get("cmsPreview") === "1"
    && query.getAll("cmsChannel").length === 1 && channel && CHANNEL.test(channel) ? { channel } : null;
}
export function isCmsPreviewRequested(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("cmsPreview");
}
export function cmsPreviewUrl(identity: CmsPageIdentity, channel: string): string {
  if (!CHANNEL.test(channel)) throw new Error("Kênh xem trước không hợp lệ.");
  const query = new URLSearchParams({ cmsPreview: "1", cmsChannel: channel });
  return `${identity.canonicalPath}?${query}`;
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function envelope(event: Pick<MessageEvent, "origin" | "source" | "data">, expected: { origin: string; source: MessageEventSource | null; channel: string; identity: CmsPageIdentity }): Record<string, unknown> | null {
  if (!expected.source || event.source !== expected.source || event.origin !== expected.origin || !record(event.data)) return null;
  const value = event.data;
  return value.protocol === CMS_PREVIEW_PROTOCOL && value.channel === expected.channel
    && value.slotKey === expected.identity.slotKey && value.path === expected.identity.canonicalPath
    && typeof value.revision === "number" && Number.isSafeInteger(value.revision) && value.revision >= 0 ? value : null;
}
function exact(value: Record<string, unknown>, extra: string[]): boolean {
  const keys = ["protocol", "channel", "slotKey", "path", "revision", "type", ...extra];
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}
export function parseCmsPreviewHostMessage(event: Pick<MessageEvent, "origin" | "source" | "data">, expected: Parameters<typeof envelope>[1] & { lastRevision: number }): CmsPreviewHostMessage | null {
  const value = envelope(event, expected);
  if (!value || (value.revision as number) <= expected.lastRevision) return null;
  try {
    if (value.type === "render" && exact(value, ["mode", "layout"]) && (value.mode === "draft" || value.mode === "published")) {
      return { ...value, layout: parseCmsPageLayout(value.layout, expected.identity) } as CmsPreviewHostMessage;
    }
    if (value.type === "focus" && exact(value, ["fieldId"]) && typeof value.fieldId === "string"
      && expected.identity.sections.some((section) => section.fields.some((field) => field.id === value.fieldId))) return value as unknown as CmsPreviewHostMessage;
  } catch { /* Untrusted frame traffic fails closed without exposing payloads. */ }
  return null;
}
export function parseCmsPreviewFrameMessage(event: Pick<MessageEvent, "origin" | "source" | "data">, expected: Parameters<typeof envelope>[1] & { currentRevision: number }): CmsPreviewFrameMessage | null {
  const value = envelope(event, expected);
  if (!value) return null;
  if (value.type === "ready" && expected.currentRevision === 0 && value.revision === 0 && exact(value, ["expectedVersion"])
      && typeof value.expectedVersion === "number" && Number.isSafeInteger(value.expectedVersion) && value.expectedVersion >= 0) return value as unknown as CmsPreviewFrameMessage;
  if (value.revision !== expected.currentRevision) return null;
  if (value.type === "blocked" && exact(value, [])) return value as unknown as CmsPreviewFrameMessage;
  if (value.type === "selected" && exact(value, ["fieldId", "nativeValue"]) && typeof value.fieldId === "string") {
    try {
      const payload = parseCmsPageLayout({ schemaVersion: 1, sectionOrder: expected.identity.sections.map((section) => section.id), fields: { [value.fieldId]: value.nativeValue } }, expected.identity);
      return { ...value, nativeValue: payload.fields[value.fieldId] } as CmsPreviewFrameMessage;
    } catch { return null; }
  }
  return null;
}
