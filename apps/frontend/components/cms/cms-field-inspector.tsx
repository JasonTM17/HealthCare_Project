"use client";

import { htmlToMarkdown } from "../editor/RichContentRenderer";
import RichTextEditor from "../editor/RichTextEditor";
import CmsImageField from "./CmsImageField";
import { createNativeCmsLayout, parseCmsPageLayout, type CmsLayoutValue } from "../../lib/cms-page-layout";
import type { CmsPageIdentity } from "../../lib/cms-page-manifest";
import styles from "./cms-workspace.module.css";

/** Conversion never silently drops a formatting feature absent from the bounded model. */
export function normalizeCmsRichText(raw: string, identity: CmsPageIdentity, fieldId: string): string {
  let value = raw;
  if (/^\s*<[a-z][\s>]/i.test(raw) || /^\s*<[a-z][a-z0-9]*[\s>]/i.test(raw)) {
    const document = new DOMParser().parseFromString(raw, "text/html");
    if (document.head.children.length > 0 || /<!doctype|<\/?(?:html|head|body)\b/i.test(raw)) {
      throw new Error("Chỉ dán nội dung văn bản, không dán tài liệu HTML hoàn chỉnh. Nội dung của bạn vẫn được giữ lại.");
    }
    const tags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "S", "STRIKE", "U", "H2", "H3", "H4", "BLOCKQUOTE", "UL", "OL", "LI", "A", "IMG", "HR", "PRE", "CODE"]);
    const attributes = new Set(["href", "src", "alt", "title", "start", "target", "rel", "data-mce-href", "data-mce-src"]);
    for (const element of document.body.querySelectorAll("*")) {
      if (!tags.has(element.tagName) || [...element.attributes].some((attribute) => !attributes.has(attribute.name))) {
        throw new Error("Định dạng này chưa được hỗ trợ. Hãy bỏ bảng, màu, căn lề hoặc định dạng đặc biệt trước khi lưu; nội dung của bạn vẫn được giữ lại.");
      }
    }
    value = htmlToMarkdown(raw);
  }
  parseCmsPageLayout({ ...createNativeCmsLayout(identity), fields: { [fieldId]: { kind: "rich", format: "markdown", value } } }, identity);
  return value;
}

export function CmsFieldInspector({ identity, fieldId, value, rawRich, disabled, onChange, onRichChange, onReset, onBusyChange, error }: { identity: CmsPageIdentity; fieldId: string | null; value: CmsLayoutValue | null; rawRich?: string; disabled: boolean; onChange: (value: CmsLayoutValue) => void; onRichChange: (raw: string) => void; onReset: () => void; onBusyChange?: (busy: boolean) => void; error?: string }) {
  const section = identity.sections.find((entry) => entry.fields.some((field) => field.id === fieldId));
  const field = section?.fields.find((entry) => entry.id === fieldId);
  if (!field || !value) return <div><h2>Chỉnh sửa nội dung</h2><p>Chọn văn bản hoặc ảnh trên bản xem trước, hoặc chọn trường trong danh sách vùng trang.</p>{identity.manifest.authorityHref ? <p className="mt-4">Thông tin chuyên môn và danh mục được sửa tại <a href={identity.manifest.authorityHref}>quản lý danh mục ↗</a>.</p> : null}</div>;
  return <div data-testid="cms-field-inspector">
    <p className={styles.status}>{identity.manifest.label} / {section?.label}</p><h2>{field.label}</h2>
    {value.kind === "text" ? <label htmlFor={`cms-field-${fieldId}`}>{field.label}<textarea id={`cms-field-${fieldId}`} value={value.value} rows={4} maxLength={4000} disabled={disabled} onChange={(event) => onChange({ kind: "text", value: event.target.value })} aria-invalid={Boolean(error)} aria-describedby={error ? "cms-field-error" : undefined} /></label> : null}
    {value.kind === "image" ? <>
      <CmsImageField key={fieldId} id={`cms-field-${fieldId}`} value={value.src} disabled={disabled} onBusyChange={onBusyChange} required onChange={(src) => onChange({ ...value, src })} />
      <label>Mô tả ảnh<input maxLength={500} value={value.alt} disabled={disabled} onChange={(event) => onChange({ ...value, alt: event.target.value })} /></label>
    </> : null}
    {value.kind === "rich" ? <RichTextEditor key={fieldId} contentMode="cms" value={rawRich ?? value.value} onChange={onRichChange} onBusyChange={onBusyChange} label={field.label} minHeight="360px" id={`cms-field-${fieldId}`} disabled={disabled} purpose="GENERAL" /> : null}
    {error ? <p id="cms-field-error" role="alert" className={styles.error}>{error}</p> : null}
    <p className={styles.status}>{value.kind === "image" ? "Ảnh và mô tả được lưu cùng bản nháp." : "Tối đa 4.000 ký tự; thay đổi chỉ công khai sau khi xuất bản."}</p>
    <button type="button" disabled={disabled} onClick={onReset}>Khôi phục giá trị đã lưu của trường này</button>
  </div>;
}
