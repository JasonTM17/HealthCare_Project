"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import {
  CMS_COMPONENT_TYPES,
  CMS_PUBLICATION_STATUSES,
  CMS_SLOT_KEYS,
  CmsApiError,
  CmsClient,
  CmsValidationError,
  defaultCmsClient,
  resolveCmsSlotKey,
  validateCmsContentInput,
  type CmsComponentType,
  type CmsContent,
  type CmsContentHistoryEntry,
  type CmsContentInput,
  type CmsPayload,
  type CmsPublicationStatus,
  type CmsSlotKey,
  type CmsFieldErrors,
} from "../../lib/cms-client";
import { CmsContentRenderer } from "./CmsRenderer";

interface CmsDraftValues {
  componentType: CmsComponentType;
  payload: CmsPayload;
  status: CmsPublicationStatus;
}

interface CmsEditorProps {
  initialSlug?: string;
  client?: CmsClient;
}

type EditorOperation = "idle" | "loading" | "saving" | "publishing";

const COMPONENT_LABELS: Record<CmsComponentType, string> = {
  HERO: "Hero",
  RICH_TEXT: "Rich text",
  CTA_BANNER: "CTA banner",
  NOTICE: "Notice",
  IMAGE_CARD: "Image card",
};

const SLOT_LABELS: Record<CmsSlotKey, string> = {
  hero: "Hero",
  body: "Nội dung chính",
  sidebar: "Sidebar",
  footer: "Footer",
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

function emptyDraft(componentType: CmsComponentType = "HERO"): CmsDraftValues {
  return { componentType, payload: emptyPayload(componentType), status: "DRAFT" };
}

function draftFromContent(content: CmsContent): CmsDraftValues {
  return {
    componentType: content.componentType,
    payload: { ...content.payload },
    status: content.status,
  };
}

function compactPayload(payload: CmsPayload): CmsPayload {
  const compact = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => typeof value === "string" && value.trim().length > 0),
  );
  return compact as CmsPayload;
}

function payloadValue(payload: CmsPayload, field: string): string {
  const value = (payload as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

function prettyUpdatedAt(value: string | undefined): string {
  if (!value) return "Chưa đồng bộ";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function slotSelection(slotKey: string): { slug: string; slot: CmsSlotKey } | null {
  const normalized = slotKey.trim().toLowerCase();
  if (normalized === "homepage.hero") return { slug: "home", slot: "hero" };
  const separator = normalized.lastIndexOf(".");
  if (separator <= 0) return null;
  const slug = normalized.slice(0, separator);
  const slot = normalized.slice(separator + 1);
  return CMS_SLOT_KEYS.includes(slot as CmsSlotKey)
    ? { slug, slot: slot as CmsSlotKey }
    : null;
}

function asCmsError(error: unknown): CmsApiError {
  if (error instanceof CmsApiError) return error;
  return new CmsApiError("network", 0, error instanceof Error ? error.message : "Không thể kết nối CMS.");
}

function apiErrorMessage(error: CmsApiError): string {
  switch (error.kind) {
    case "auth":
      return "Phiên quản trị không hợp lệ hoặc đã hết hạn (401). Hãy đăng nhập lại.";
    case "forbidden":
      return "Tài khoản hiện tại không có quyền ADMIN (403). Nội dung chưa được thay đổi.";
    case "validation":
      return `${error.message} (400/422).`;
    case "conflict":
      return "Nội dung đã thay đổi ở nơi khác (409). Tải lại slot trước khi ghi đè.";
    case "not-found":
      return "Chưa tìm thấy slot CMS (404). Có thể tạo slot mới bằng expectedVersion = 0 nếu backend đã sẵn sàng.";
    case "unavailable":
      return "CMS backend hiện không khả dụng (503). Không có dữ liệu demo thay thế.";
    case "network":
      return `Không thể kết nối live CMS${error.message ? `: ${error.message}` : ""}`;
    default:
      return `${error.message} (HTTP ${error.status || "không xác định"}).`;
  }
}

function FieldError({ message }: { message?: string }): ReactElement | null {
  return message ? <p className="mt-1 text-xs text-red-700">{message}</p> : null;
}

function TextField({
  field,
  label,
  payload,
  onChange,
  multiline = false,
  required = false,
  help,
}: {
  field: string;
  label: string;
  payload: CmsPayload;
  onChange: (field: string, value: string) => void;
  multiline?: boolean;
  required?: boolean;
  help?: string;
}): ReactElement {
  const value = payloadValue(payload, field);
  const id = `cms-payload-${field}`;
  return (
    <label className="text-sm font-semibold text-slate-700" htmlFor={id}>
      {label}
      {multiline ? (
        <textarea
          aria-describedby={help ? `${id}-help` : undefined}
          className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6"
          id={id}
          onChange={(event) => onChange(field, event.target.value)}
          required={required}
          value={value}
        />
      ) : (
        <input
          aria-describedby={help ? `${id}-help` : undefined}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          id={id}
          onChange={(event) => onChange(field, event.target.value)}
          required={required}
          value={value}
        />
      )}
      {help ? <span className="mt-1 block text-xs font-normal text-slate-500" id={`${id}-help`}>{help}</span> : null}
    </label>
  );
}

function PayloadFields({
  draft,
  onChange,
}: {
  draft: CmsDraftValues;
  onChange: (field: string, value: string) => void;
}): ReactElement {
  const common = { payload: draft.payload, onChange };
  switch (draft.componentType) {
    case "HERO":
      return (
        <div className="grid gap-3">
          <TextField {...common} field="eyebrow" label="Eyebrow" />
          <TextField {...common} field="title" label="Tiêu đề" required />
          <TextField {...common} field="body" label="Mô tả" multiline />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField {...common} field="ctaLabel" label="Nhãn CTA" />
            <TextField {...common} field="ctaHref" label="URL CTA" help="Chỉ đường dẫn /... hoặc HTTPS URL." />
          </div>
          <TextField {...common} field="imageUrl" label="URL hình ảnh" help="Chỉ đường dẫn /... hoặc HTTPS URL." />
        </div>
      );
    case "RICH_TEXT":
      return (
        <div className="grid gap-3">
          <TextField {...common} field="title" label="Tiêu đề" required />
          <TextField {...common} field="body" label="Nội dung" multiline required />
        </div>
      );
    case "CTA_BANNER":
      return (
        <div className="grid gap-3">
          <TextField {...common} field="title" label="Tiêu đề" required />
          <TextField {...common} field="body" label="Nội dung" multiline required />
          <TextField {...common} field="ctaLabel" label="Nhãn CTA" required />
          <TextField {...common} field="ctaHref" label="URL CTA" help="Chỉ đường dẫn /... hoặc HTTPS URL." required />
        </div>
      );
    case "NOTICE":
      return (
        <div className="grid gap-3">
          <TextField {...common} field="title" label="Tiêu đề" required />
          <TextField {...common} field="body" label="Nội dung" multiline required />
        </div>
      );
    case "IMAGE_CARD":
      return (
        <div className="grid gap-3">
          <TextField {...common} field="title" label="Tiêu đề" required />
          <TextField {...common} field="body" label="Mô tả" multiline />
          <TextField {...common} field="imageUrl" label="URL hình ảnh" help="Chỉ đường dẫn /... hoặc HTTPS URL." required />
          <TextField {...common} field="href" label="URL đích" help="Chỉ đường dẫn /... hoặc HTTPS URL." />
        </div>
      );
  }
}

export function CmsEditor({
  initialSlug = "home",
  client = defaultCmsClient,
}: CmsEditorProps): ReactElement {
  const [slug, setSlug] = useState(initialSlug);
  const [selectedSlot, setSelectedSlot] = useState<CmsSlotKey>("hero");
  const [loadedSlug, setLoadedSlug] = useState(initialSlug);
  const [loadedSlotKey, setLoadedSlotKey] = useState(resolveCmsSlotKey(initialSlug, "hero"));
  const [content, setContent] = useState<CmsContent | null>(null);
  const [draft, setDraft] = useState<CmsDraftValues>(emptyDraft);
  const [loadedSnapshot, setLoadedSnapshot] = useState<CmsDraftValues | null>(null);
  const [operation, setOperation] = useState<EditorOperation>("idle");
  const [apiError, setApiError] = useState<CmsApiError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CmsFieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [availableContent, setAvailableContent] = useState<CmsContent[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [history, setHistory] = useState<CmsContentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadContent = useCallback(async (requestedSlug: string, requestedSlot: CmsSlotKey): Promise<void> => {
    const normalizedSlug = requestedSlug.trim();
    const backendSlotKey = resolveCmsSlotKey(normalizedSlug, requestedSlot);
    setSlug(normalizedSlug);
    setSelectedSlot(requestedSlot);
    setOperation("loading");
    setApiError(null);
    setFieldErrors({});
    setNotice(null);
    try {
      const loadedContent = await client.getAdminContent(backendSlotKey);
      const loadedDraft = draftFromContent(loadedContent);
      setContent(loadedContent);
      setDraft(loadedDraft);
      setLoadedSnapshot(loadedDraft);
      setLoadedSlug(normalizedSlug);
      setLoadedSlotKey(backendSlotKey);
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        setHistory(await client.listHistory(backendSlotKey));
      } catch (historyLoadError) {
        setHistory([]);
        setHistoryError(apiErrorMessage(asCmsError(historyLoadError)));
      } finally {
        setHistoryLoading(false);
      }
    } catch (error) {
      const cmsError = asCmsError(error);
      setApiError(cmsError);
      setContent(null);
      setLoadedSnapshot(null);
      setDraft(emptyDraft());
      setLoadedSlug(normalizedSlug);
      setLoadedSlotKey(backendSlotKey);
      setHistory([]);
      setHistoryError(null);
    } finally {
      setOperation("idle");
    }
  }, [client]);

  const loadAvailableContent = useCallback(async (): Promise<void> => {
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      const slots = await client.listAdminContent();
      setAvailableContent(slots.sort((left, right) => left.slotKey.localeCompare(right.slotKey)));
    } catch (error) {
      setInventoryError(apiErrorMessage(asCmsError(error)));
    } finally {
      setInventoryLoading(false);
    }
  }, [client]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadContent(initialSlug, "hero"), 0);
    const inventoryTimer = window.setTimeout(() => void loadAvailableContent(), 0);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(inventoryTimer);
    };
  }, [initialSlug, loadAvailableContent, loadContent]);

  const handleLoad = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void loadContent(slug, selectedSlot);
  };

  const handleComponentTypeChange = (componentType: CmsComponentType): void => {
    setDraft((current) => ({ ...current, componentType, payload: emptyPayload(componentType) }));
    setNotice(null);
    setFieldErrors({});
  };

  const handlePayloadChange = (field: string, value: string): void => {
    setDraft((current) => ({
      ...current,
      payload: { ...current.payload, [field]: value } as CmsPayload,
    }));
    setNotice(null);
  };

  const inputFor = (status: CmsPublicationStatus): CmsContentInput => ({
    componentType: draft.componentType,
    payload: compactPayload(draft.payload),
    status,
    expectedVersion: content?.version ?? 0,
  });

  const handleUpsert = async (status: CmsPublicationStatus): Promise<void> => {
    const input = inputFor(status);
    const errors = validateCmsContentInput(input);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setApiError(new CmsValidationError("CMS content chưa hợp lệ.", errors));
      return;
    }

    setOperation(status === "PUBLISHED" ? "publishing" : "saving");
    setApiError(null);
    setFieldErrors({});
    setNotice(null);
    try {
      const savedContent = await client.upsertContent(loadedSlotKey, input);
      const savedDraft = draftFromContent(savedContent);
      setContent(savedContent);
      setDraft(savedDraft);
      setLoadedSnapshot(savedDraft);
      setAvailableContent((current) => [
        ...current.filter((item) => item.slotKey !== savedContent.slotKey),
        savedContent,
      ].sort((left, right) => left.slotKey.localeCompare(right.slotKey)));
      try {
        setHistory(await client.listHistory(savedContent.slotKey));
        setHistoryError(null);
      } catch (historyLoadError) {
        setHistoryError(apiErrorMessage(asCmsError(historyLoadError)));
      }
      setNotice(savedContent.status === "PUBLISHED"
        ? `Đã xuất bản ${savedContent.slotKey}, version ${savedContent.version}.`
        : `Đã lưu bản nháp ẩn công khai, version ${savedContent.version}.`);
    } catch (error) {
      setApiError(asCmsError(error));
    } finally {
      setOperation("idle");
    }
  };

  const handleRollback = async (entry: CmsContentHistoryEntry): Promise<void> => {
    if (!entry.rollbackAvailable || !content) return;
    setOperation("saving");
    setApiError(null);
    setNotice(null);
    try {
      const savedContent = await client.rollbackContent(loadedSlotKey, {
        changeId: entry.eventId,
        expectedVersion: content.version,
      });
      const savedDraft = draftFromContent(savedContent);
      setContent(savedContent);
      setDraft(savedDraft);
      setLoadedSnapshot(savedDraft);
      setHistory(await client.listHistory(savedContent.slotKey));
      setAvailableContent((current) => [
        ...current.filter((item) => item.slotKey !== savedContent.slotKey),
        savedContent,
      ].sort((left, right) => left.slotKey.localeCompare(right.slotKey)));
      setNotice(`Đã rollback ${savedContent.slotKey} về snapshot event #${entry.eventId}, version mới ${savedContent.version}.`);
    } catch (error) {
      setApiError(asCmsError(error));
    } finally {
      setOperation("idle");
    }
  };

  const resetToLoaded = (): void => {
    const reset = loadedSnapshot ? { ...loadedSnapshot, payload: { ...loadedSnapshot.payload } as CmsPayload } : emptyDraft(draft.componentType);
    setDraft(reset);
    setFieldErrors({});
    setApiError(null);
    setNotice("Đã khôi phục form về snapshot đã tải; chưa gửi mutation.");
  };

  const isBusy = operation !== "idle";
  const authBlocked = apiError?.kind === "auth" || apiError?.kind === "forbidden";
  const canMutate = !authBlocked && !isBusy;
  const previewContent = {
    slotKey: loadedSlotKey,
    componentType: draft.componentType,
    payload: compactPayload(draft.payload),
    status: draft.status,
    version: content?.version ?? 0,
    updatedAt: content?.updatedAt ?? "",
  } as CmsContent;
  const loadedSelection = slotSelection(loadedSlotKey);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">CMS nội dung</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Chỉnh sửa một component theo slot</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Mỗi slot lưu đúng một component typed theo backend contract. Không có nội dung demo tự động thay thế khi live backend chưa sẵn sàng.
        </p>
      </header>

      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950" role="status">
        <strong>Nguồn dữ liệu: live backend.</strong> Payload chỉ dùng field allowlist của component; text được render như text node, không diễn giải HTML/JS.
      </div>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.5fr)_auto] sm:items-end" onSubmit={handleLoad}>
        <label className="text-sm font-semibold text-slate-700">
          Slug trang
          <input
            aria-describedby="cms-slug-help"
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
            onChange={(event) => setSlug(event.target.value)}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            required
            value={slug}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500" id="cms-slug-help">home + hero → homepage.hero</span>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Slot
          <select
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setSelectedSlot(event.target.value as CmsSlotKey)}
            value={selectedSlot}
          >
            {CMS_SLOT_KEYS.map((slotKey) => <option key={slotKey} value={slotKey}>{SLOT_LABELS[slotKey]} · {slotKey}</option>)}
          </select>
        </label>
        <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60" disabled={isBusy} type="submit">
          {operation === "loading" ? "Đang tải…" : "Tải slot"}
        </button>
      </form>

      <section aria-labelledby="cms-slot-directory-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Slot directory</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950" id="cms-slot-directory-title">Các component CMS đã có trong backend</h2>
          </div>
          <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={inventoryLoading} onClick={() => void loadAvailableContent()} type="button">
            {inventoryLoading ? "Đang đọc…" : "Làm mới danh mục"}
          </button>
        </div>
        {inventoryError ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950" role="status">{inventoryError} Có thể nhập slug thủ công nếu phiên ADMIN đã sẵn sàng.</p> : null}
        {!inventoryLoading && !inventoryError && availableContent.length === 0 ? <p className="mt-3 text-sm text-slate-600">Chưa có slot CMS nào được trả về. Hãy nhập slug route và tải slot để tạo component đầu tiên.</p> : null}
        {availableContent.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {availableContent.map((item) => {
              const selection = slotSelection(item.slotKey);
              return selection ? (
                <button className="min-h-11 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-left text-sm font-semibold text-teal-950 hover:bg-teal-100" key={item.slotKey} onClick={() => void loadContent(selection.slug, selection.slot)} type="button">
                  <span className="block font-mono text-xs">{item.slotKey}</span>
                  <span className="block text-xs font-normal text-teal-800">{item.componentType} · v{item.version} · {item.status}</span>
                </button>
              ) : null;
            })}
          </div>
        ) : null}
      </section>

      {apiError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950" role="alert">
          <p>{apiErrorMessage(apiError)}</p>
          {apiError.fieldErrors ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {Object.entries(apiError.fieldErrors).map(([field, message]) => <li key={field}>{field}: {message}</li>)}
            </ul>
          ) : null}
          {apiError.kind === "conflict" ? (
            <button className="mt-3 min-h-11 rounded-xl bg-red-800 px-4 py-2 text-sm font-bold text-white hover:bg-red-900" onClick={() => void loadContent(loadedSelection?.slug ?? loadedSlug, loadedSelection?.slot ?? selectedSlot)} type="button">
              Tải version mới nhất
            </button>
          ) : null}
        </div>
      ) : null}

      {notice ? <p aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</p> : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <section aria-labelledby="cms-editor-title" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Đang chỉnh sửa: {loadedSlotKey}</p>
              <h2 className="text-2xl font-bold text-slate-950" id="cms-editor-title">Typed component</h2>
            </div>
            <dl className="text-right text-xs text-slate-500">
              <div><dt className="inline font-semibold">Trạng thái: </dt><dd className="inline">{content?.status ?? draft.status}</dd></div>
              <div><dt className="inline font-semibold">Version: </dt><dd className="inline">{content?.version ?? "mới · 0"}</dd></div>
              <div><dt className="inline font-semibold">Cập nhật: </dt><dd className="inline">{prettyUpdatedAt(content?.updatedAt)}</dd></div>
            </dl>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="component-type-title">
            <h3 className="font-bold text-slate-950" id="component-type-title">Component type</h3>
            <label className="mt-3 block text-sm font-semibold text-slate-700">
              Chọn schema
              <select
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => handleComponentTypeChange(event.target.value as CmsComponentType)}
                value={draft.componentType}
              >
                {CMS_COMPONENT_TYPES.map((componentType) => <option key={componentType} value={componentType}>{COMPONENT_LABELS[componentType]} · {componentType}</option>)}
              </select>
            </label>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="payload-title">
            <h3 className="font-bold text-slate-950" id="payload-title">Payload allowlist</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">Các field hiển thị phụ thuộc component type. Field rỗng tùy chọn sẽ được bỏ khỏi request.</p>
            <div className="mt-4"><PayloadFields draft={draft} onChange={handlePayloadChange} /></div>
            <FieldError message={fieldErrors.payload} />
          </section>

          <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <button className="min-h-11 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60" disabled={!canMutate} onClick={() => void handleUpsert("DRAFT")} type="button">
              {operation === "saving" ? "Đang lưu…" : "Lưu bản nháp (ẩn công khai)"}
            </button>
            <button className="min-h-11 rounded-xl border border-teal-700 px-4 py-2 text-sm font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-60" disabled={!canMutate} onClick={() => void handleUpsert("PUBLISHED")} type="button">
              {operation === "publishing" ? "Đang xuất bản…" : "Xuất bản"}
            </button>
            <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={isBusy} onClick={resetToLoaded} type="button">
              Khôi phục bản đã tải
            </button>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="rollback-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-950" id="rollback-title">Lịch sử & rollback server</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Mỗi lần lưu được ghi actor, version và snapshot. Rollback tạo version mới, vẫn yêu cầu expectedVersion hiện tại để không ghi đè thay đổi của quản trị viên khác.
                </p>
              </div>
              {historyLoading ? <span className="text-xs font-semibold text-slate-500">Đang tải lịch sử…</span> : null}
            </div>
            {historyError ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">{historyError}</p> : null}
            {!historyLoading && !historyError && history.length === 0 ? <p className="mt-3 text-sm text-slate-600">Chưa có history snapshot cho slot này.</p> : null}
            {history.length > 0 ? (
              <ol className="mt-4 space-y-3">
                {history.map((entry) => (
                  <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3" key={entry.eventId}>
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-slate-900">Event #{entry.eventId} · v{entry.version} · {entry.status ?? "legacy"}</p>
                      <p className="mt-1 text-xs text-slate-500">{entry.actorEmail ?? "actor không xác định"} · {prettyUpdatedAt(entry.changedAt)}</p>
                    </div>
                    <button
                      className="min-h-11 rounded-xl border border-amber-300 px-3 py-2 text-sm font-bold text-amber-900 hover:bg-amber-50 disabled:opacity-60"
                      disabled={!canMutate || entry.version === content?.version || !entry.rollbackAvailable}
                      onClick={() => void handleRollback(entry)}
                      type="button"
                    >
                      {operation === "saving" ? "Đang rollback…" : "Rollback snapshot"}
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        </section>

        <aside aria-labelledby="cms-preview-title" className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Safe renderer</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950" id="cms-preview-title">Xem trước</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Preview dùng đúng component schema và không diễn giải raw HTML/JS.</p>
          </div>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <CmsContentRenderer content={previewContent} />
          </article>
        </aside>
      </div>
    </div>
  );
}

export default CmsEditor;
