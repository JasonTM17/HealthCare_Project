import { CmsValidationError, isSafeCmsImageUrl, isSafeCmsLinkUrl } from "./cms-client";
import type { CmsPageIdentity, CmsPageSection } from "./cms-page-manifest";

export type CmsLayoutValue =
  | { kind: "text"; value: string }
  | { kind: "rich"; format: "markdown"; value: string }
  | { kind: "image"; src: string; alt: string };

export interface CmsPageLayout {
  schemaVersion: 1;
  sectionOrder: string[];
  fields: Record<string, CmsLayoutValue>;
}

const CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
function requireLayout(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CmsValidationError(message);
}

function object(value: unknown): Record<string, unknown> {
  requireLayout(value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
  "Dữ liệu bố cục phải là đối tượng JSON.");
  return value as Record<string, unknown>;
}

function exactKeys(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const result = object(value);
  const actual = Object.keys(result);
  requireLayout(actual.length === keys.length && actual.every((key) => keys.includes(key)),
    "Dữ liệu bố cục có trường thiếu hoặc không được hỗ trợ.");
  return result;
}

function boundedText(value: unknown, max: number, allowEmpty = false): string {
  requireLayout(typeof value === "string" && value.length <= max
    && (allowEmpty || value.trim().length > 0) && !CONTROLS.test(value),
  "Nội dung vượt giới hạn hoặc chứa ký tự không hợp lệ.");
  return value;
}

function plainText(value: unknown, max: number, allowEmpty = false): string {
  const result = boundedText(value, max, allowEmpty);
  requireLayout(!/[<>]/.test(result), "Trường chữ không hỗ trợ mã HTML.");
  return result;
}

function safeUrl(value: string, image: boolean): boolean {
  if (!image && value.startsWith("tel:")) return isSafeCmsLinkUrl(value);
  return !/[\s\\]/.test(value) && !CONTROLS.test(value)
    && (image ? isSafeCmsImageUrl(value) : isSafeCmsLinkUrl(value));
}

function markdown(value: unknown): string {
  const result = boundedText(value, 4_000);
  // The existing renderer supports exactly this literal through a React <u> node.
  requireLayout(!/[<>]/.test(result.replace(/<u>[^<>]*<\/u>/g, "").replace(/^>+ ?/gm, "")),
    "Nội dung chỉ hỗ trợ Markdown và gạch chân, không hỗ trợ HTML tùy ý.");
  for (const match of result.matchAll(/(!?)\[([^\]]*)\]\(([^)]+)\)/g)) {
    requireLayout(safeUrl(match[3], match[1] === "!"), "Liên kết hoặc ảnh trong nội dung không an toàn.");
  }
  return result;
}

export function validateCmsSectionOrder(sections: readonly CmsPageSection[], value: unknown): string[] {
  requireLayout(Array.isArray(value) && value.length === sections.length,
    "Thứ tự phải chứa đầy đủ các phần của trang.");
  const groups = new Map<string, number>();
  let group = 0;
  for (const section of sections) {
    groups.set(section.id, group);
    if (!section.reorderable) group++;
  }
  const seen = new Set<string>();
  group = 0;
  return value.map((id: unknown, index: number) => {
    requireLayout(typeof id === "string" && groups.has(id) && !seen.has(id),
      "Thứ tự chứa phần lạ hoặc trùng lặp.");
    seen.add(id);
    if (!sections[index].reorderable) {
      requireLayout(id === sections[index].id, "Không thể di chuyển phần cố định.");
      group++;
    } else {
      requireLayout(groups.get(id) === group, "Không thể kéo phần qua vùng cố định.");
    }
    return id;
  });
}

/** Sparse overrides fall back to native values; removing a field clears its override. */
export function parseCmsPageLayout(value: unknown, identity: CmsPageIdentity): CmsPageLayout {
  const payload = exactKeys(value, ["schemaVersion", "sectionOrder", "fields"]);
  requireLayout(payload.schemaVersion === 1, "Phiên bản bố cục không được hỗ trợ.");
  const sectionOrder = validateCmsSectionOrder(identity.sections, payload.sectionOrder);
  const input = object(payload.fields);
  const allowed = new Map(identity.sections.flatMap((section) => section.fields.map((field) => [field.id, field] as const)));
  const fields: Record<string, CmsLayoutValue> = Object.create(null);
  for (const [id, raw] of Object.entries(input)) {
    const declared = allowed.get(id);
    requireLayout(declared, "Trường nội dung không thuộc trang đang chỉnh sửa.");
    const field = object(raw);
    requireLayout(field.kind === declared.kind, "Kiểu nội dung không khớp với trường của trang.");
    switch (declared.kind) {
      case "text":
        exactKeys(field, ["kind", "value"]);
        fields[id] = { kind: "text", value: plainText(field.value, 4_000) };
        break;
      case "image": {
        exactKeys(field, ["kind", "src", "alt"]);
        const src = plainText(field.src, 2_048);
        requireLayout(safeUrl(src, true), "Ảnh phải dùng đường dẫn nội bộ hoặc nguồn ảnh được phép.");
        fields[id] = { kind: "image", src, alt: plainText(field.alt, 500, true) };
        break;
      }
      case "rich":
        exactKeys(field, ["kind", "format", "value"]);
        requireLayout(field.format === "markdown", "Định dạng nội dung không được hỗ trợ.");
        fields[id] = { kind: "rich", format: "markdown", value: markdown(field.value) };
        break;
    }
  }
  const result: CmsPageLayout = { schemaVersion: 1, sectionOrder, fields };
  requireLayout(new TextEncoder().encode(JSON.stringify(result)).length <= 32_768,
    "Dữ liệu bố cục vượt giới hạn 32 KiB.");
  return result;
}

export function createNativeCmsLayout(identity: CmsPageIdentity): CmsPageLayout {
  return { schemaVersion: 1, sectionOrder: identity.sections.map((section) => section.id), fields: {} };
}

/** JSONB does not retain object-key order; dirty checks compare typed values. */
export function equalCmsPageLayouts(left: CmsPageLayout, right: CmsPageLayout): boolean {
  if (left.schemaVersion !== right.schemaVersion || left.sectionOrder.length !== right.sectionOrder.length
    || left.sectionOrder.some((id, index) => id !== right.sectionOrder[index])) return false;
  const keys = Object.keys(left.fields);
  if (keys.length !== Object.keys(right.fields).length) return false;
  return keys.every((key) => {
    const a = left.fields[key]; const b = right.fields[key];
    if (!b || a.kind !== b.kind) return false;
    if (a.kind === "image" && b.kind === "image") return a.src === b.src && a.alt === b.alt;
    if (a.kind === "rich" && b.kind === "rich") return a.format === b.format && a.value === b.value;
    return a.kind === "text" && b.kind === "text" && a.value === b.value;
  });
}
