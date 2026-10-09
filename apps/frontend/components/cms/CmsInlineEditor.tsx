"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import {
  CmsApiError,
  type CmsClient,
  type CmsComponentType,
  type CmsContent,
  type CmsFieldErrors,
  type CmsPayload,
  type CmsSlotKey,
  cmsComponentTypesForSlot,
  defaultCmsClient,
  validateCmsContentInput,
} from "../../lib/cms-client";
import { hasRole } from "../../lib/api-client";
import { useAuthSession } from "../useAuthSession";
import {
  cmsSaveFlashSlot,
  hydrateCmsEditMode,
  isCmsEditModeEnabled,
  setCmsEditMode,
  subscribeCmsEditMode,
  subscribeCmsSaveFlash,
} from "../../lib/cms-edit-mode";
import CmsImageField from "./CmsImageField";

/**
 * Admin-only inline CMS editing, rendered directly on the public pages.
 *
 * Client-only by design: every gate (ADMIN session, edit-mode switch) reads
 * client state, no public route gains a server-side session dependency, and
 * writes go through the existing admin PUT (server-enforced role + history).
 */

type DraftValues = {
  componentType: CmsComponentType;
  payload: CmsPayload;
  status: "PUBLISHED" | "DRAFT";
};

const COMPONENT_LABELS: Record<CmsComponentType, string> = {
  HERO: "Hero",
  RICH_TEXT: "Rich text",
  CTA_BANNER: "CTA banner",
  NOTICE: "Notice",
  IMAGE_CARD: "Image card",
};

function emptyPayload(componentType: CmsComponentType): CmsPayload {
  switch (componentType) {
    case "HERO":
      return { eyebrow: "", title: "", body: "", ctaLabel: "", ctaHref: "", imageUrl: "" };
    case "RICH_TEXT":
      return { title: "", body: "" };
    case "CTA_BANNER":
      return { title: "", body: "", ctaLabel: "", ctaHref: "" };
    case "NOTICE":
      return { title: "", body: "" };
    case "IMAGE_CARD":
      return { title: "", body: "", imageUrl: "", href: "" };
  }
}

function payloadValue(payload: CmsPayload, field: string): string {
  const value = (payload as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

function compactPayload(payload: CmsPayload): CmsPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => typeof value === "string" && value.trim().length > 0),
  ) as CmsPayload;
}

function isPayloadField(value: string): boolean {
  return [
    "eyebrow", "title", "body", "ctaLabel", "ctaHref", "imageUrl", "href",
  ].includes(value);
}

/** Fixed toolbar: the single writer of the edit-mode store. */
export function CmsEditModeToolbar(): ReactElement | null {
  const pathname = usePathname();
  const session = useAuthSession();
  const editMode = useSyncExternalStore(subscribeCmsEditMode, isCmsEditModeEnabled, isCmsEditModeEnabled);
  const saveFlashSlot = useSyncExternalStore(subscribeCmsSaveFlash, cmsSaveFlashSlot, cmsSaveFlashSlot);

  useEffect(() => {
    hydrateCmsEditMode();
  }, []);

  const suppressedRoute = ["/admin", "/doctor", "/patient", "/auth"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!session || !hasRole(session.user, "ADMIN") || suppressedRoute) return null;

  return (
    <>
      <div
        className="fixed bottom-4 left-4 z-[70] flex items-center gap-2 rounded-full border border-teal-800 bg-white px-3 py-1.5 text-xs font-semibold text-teal-900"
        data-testid="cms-edit-toolbar"
      >
        <label className="flex min-h-11 cursor-pointer items-center gap-2">
          <input
            checked={editMode}
            onChange={(event) => setCmsEditMode(event.target.checked)}
            type="checkbox"
          />
          Chế độ chỉnh sửa CMS
        </label>
      </div>
      {saveFlashSlot ? (
        <div
          aria-live="polite"
          className="fixed left-1/2 top-4 z-[90] -translate-x-1/2 rounded-full border border-teal-700 bg-white px-4 py-1.5 text-xs font-semibold text-teal-900"
          data-testid="cms-save-flash"
          role="status"
        >
          Đã lưu {saveFlashSlot} ✓
        </div>
      ) : null}
    </>
  );
}

function SlotField({
  field,
  label,
  payload,
  onChange,
  required = false,
  multiline = false,
}: {
  field: string;
  label: string;
  payload: CmsPayload;
  onChange: (field: string, value: string) => void;
  required?: boolean;
  multiline?: boolean;
}): ReactElement {
  const common = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-teal-700 focus:outline-none";
  const fieldId = useId();
  return (
    <label className="grid gap-1" htmlFor={fieldId}>
      <span className="text-xs font-semibold text-slate-600">
        {label}
        {required ? " *" : ""}
      </span>
      {multiline ? (
        <textarea
          className={common}
          id={fieldId}
          onChange={(event) => onChange(field, event.target.value)}
          rows={4}
          value={payloadValue(payload, field)}
        />
      ) : (
        <input
          className={common}
          id={fieldId}
          onChange={(event) => onChange(field, event.target.value)}
          value={payloadValue(payload, field)}
        />
      )}
    </label>
  );
}

function SlotPayloadFields({
  componentType,
  onChange,
  payload,
}: {
  componentType: CmsComponentType;
  onChange: (field: string, value: string) => void;
  payload: CmsPayload;
}): ReactElement {
  switch (componentType) {
    case "HERO":
      return (
        <div className="grid gap-3">
          <SlotField field="eyebrow" label="Eyebrow" onChange={onChange} payload={payload} />
          <SlotField field="title" label="Tiêu đề" onChange={onChange} payload={payload} required />
          <SlotField field="body" label="Mô tả" multiline onChange={onChange} payload={payload} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SlotField field="ctaLabel" label="Nhãn CTA" onChange={onChange} payload={payload} />
            <SlotField field="ctaHref" label="URL CTA" onChange={onChange} payload={payload} />
          </div>
          <CmsImageField id="cms-inline-hero-image" onChange={(value) => onChange("imageUrl", value)} value={payloadValue(payload, "imageUrl")} />
        </div>
      );
    case "CTA_BANNER":
      return (
        <div className="grid gap-3">
          <SlotField field="title" label="Tiêu đề" onChange={onChange} payload={payload} required />
          <SlotField field="body" label="Nội dung" multiline onChange={onChange} payload={payload} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <SlotField field="ctaLabel" label="Nhãn CTA" onChange={onChange} payload={payload} required />
            <SlotField field="ctaHref" label="URL CTA" onChange={onChange} payload={payload} required />
          </div>
        </div>
      );
    case "IMAGE_CARD":
      return (
        <div className="grid gap-3">
          <SlotField field="title" label="Tiêu đề" onChange={onChange} payload={payload} required />
          <SlotField field="body" label="Mô tả" multiline onChange={onChange} payload={payload} />
          <CmsImageField id="cms-inline-image-card-image" onChange={(value) => onChange("imageUrl", value)} required value={payloadValue(payload, "imageUrl")} />
          <SlotField field="href" label="URL đích" onChange={onChange} payload={payload} />
        </div>
      );
    case "NOTICE":
    case "RICH_TEXT":
      return (
        <div className="grid gap-3">
          <SlotField field="title" label="Tiêu đề" onChange={onChange} payload={payload} required />
          <SlotField field="body" label="Nội dung" multiline onChange={onChange} payload={payload} required />
        </div>
      );
  }
}

/** The per-slot editor dialog, opened from CmsLiveSlot's pencil button. */
export function CmsSlotEditModal({
  client = defaultCmsClient,
  onClose,
  onSaved,
  slotKey,
  slotAlias,
}: {
  client?: CmsClient;
  onClose: () => void;
  onSaved: (content: CmsContent) => void;
  slotKey: string;
  /** Page-local slot name ("hero") for type lookups; `slotKey` is the backend key. */
  slotAlias?: CmsSlotKey;
}): ReactElement {
  // Type-schema lookups are keyed by the page-local slot name; the backend
  // slot key ("about.hero") is only an API address, not a schema key.
  const typeLookupKey = slotAlias ?? (slotKey as CmsSlotKey);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [componentType, setComponentType] = useState<CmsComponentType>("RICH_TEXT");
  const [payload, setPayload] = useState<CmsPayload>({ title: "", body: "" });
  const [expectedVersion, setExpectedVersion] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<CmsFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // A save that resolves after the admin closed the modal must not touch
  // slot state (refetch tick, flash) for an edit they already walked away from.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    // The modal mounts fresh for every open (CmsLiveSlot renders it only
    // while `inlineEditing` is true), so the initial loading/error state
    // already covers a new slot open — no synchronous setState here.
    const controller = new AbortController();
    client.getAdminContent(slotKey)
      .then((content) => {
        if (controller.signal.aborted) return;
        setComponentType(content.componentType);
        setPayload({ ...content.payload });
        setExpectedVersion(content.version);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof CmsApiError && error.kind === "not-found") {
          // Slot chưa từng được xuất bản: bắt đầu từ payload rỗng của component
          // đầu tiên được phép cho slot này.
          const allowed = cmsComponentTypesForSlot(typeLookupKey);
          const initial = allowed[0] ?? "RICH_TEXT";
          setComponentType(initial);
          setPayload(emptyPayload(initial));
          setExpectedVersion(0);
          setLoading(false);
          return;
        }
        setLoadError(error instanceof CmsApiError ? error.message : "Không thể tải nội dung slot.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [client, slotKey, typeLookupKey]);

  const changePayload = useCallback((field: string, value: string) => {
    if (!isPayloadField(field)) return;
    setPayload((current) => ({ ...current, [field]: value }));
  }, []);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const input = {
      componentType,
      payload: compactPayload(payload),
      status: "PUBLISHED" as const,
      expectedVersion,
    };
    const errors = validateCmsContentInput(input, typeLookupKey);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await client.upsertContent(slotKey, input);
      if (!aliveRef.current) return;
      onSaved(saved);
    } catch (error: unknown) {
      if (!aliveRef.current) return;
      if (error instanceof CmsApiError && error.status === 409) {
        // Optimistic-version conflict: someone else published meanwhile.
        // Refresh the server snapshot so the next Save can succeed instead of
        // dead-ending the dialog on the stale version.
        try {
          const fresh = await client.getAdminContent(slotKey);
          if (!aliveRef.current) return;
          setComponentType(fresh.componentType);
          setPayload({ ...fresh.payload });
          setExpectedVersion(fresh.version);
          setSaveError("Nội dung vừa được người khác cập nhật — đã tải bản mới, vui lòng chỉnh lại rồi lưu.");
          return;
        } catch {
          // Refetch failed too; fall through to the generic error below.
        }
      }
      setSaveError(error instanceof CmsApiError ? error.message : "Không thể lưu nội dung CMS.");
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  };

  const allowedTypes = cmsComponentTypesForSlot(typeLookupKey);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4" data-cms-edit-modal="true" role="presentation">
      <div
        aria-label={`Chỉnh sửa nội dung ${slotKey}`}
        aria-modal="true"
        autoFocus
        className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl border border-slate-200 bg-white p-5"
        data-testid="cms-inline-edit-modal"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        role="dialog"
        tabIndex={-1}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Chỉnh sửa mục này</h2>
            <p className="text-xs text-slate-500">
              Slot <code className="rounded bg-slate-100 px-1">{slotKey}</code> · thay đổi áp dụng cho trang công khai sau khi lưu.
            </p>
          </div>
          <button
            aria-label="Đóng"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-500"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500" role="status">Đang tải nội dung…</p>
        ) : loadError ? (
          <p className="py-8 text-center text-sm text-red-700" role="alert">{loadError}</p>
        ) : (
          <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-slate-600">Kiểu nội dung</span>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  const next = event.target.value as CmsComponentType;
                  setComponentType(next);
                  setPayload(emptyPayload(next));
                }}
                value={componentType}
              >
                {(allowedTypes.length > 0 ? allowedTypes : [componentType]).map((type) => (
                  <option key={type} value={type}>{COMPONENT_LABELS[type]}</option>
                ))}
              </select>
            </label>

            <SlotPayloadFields componentType={componentType} onChange={changePayload} payload={payload} />
            {fieldErrors.componentType ? <p className="text-xs text-red-700">{fieldErrors.componentType}</p> : null}
            {Object.entries(fieldErrors)
              .filter(([field]) => field !== "componentType")
              .map(([field, message]) => (
                <p className="text-xs text-red-700" key={field}>{String(message)}</p>
              ))}
            {saveError ? <p className="text-xs text-red-700" role="alert">{saveError}</p> : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-500"
                disabled={saving}
                onClick={onClose}
                type="button"
              >
                Huỷ
              </button>
              <button
                className="rounded-md bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                data-testid="cms-inline-edit-save"
                disabled={saving}
                type="submit"
              >
                {saving ? "Đang lưu…" : "Lưu và xuất bản"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
