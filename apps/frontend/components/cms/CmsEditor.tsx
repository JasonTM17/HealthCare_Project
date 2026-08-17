"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import {
  CMS_CALLOUT_TONES,
  CMS_COMPONENT_KEYS,
  CMS_SLOT_KEYS,
  CmsApiError,
  CmsClient,
  CmsValidationError,
  cloneCmsSlots,
  defaultCmsClient,
  validateCmsDraft,
  type CmsComponent,
  type CmsComponentKey,
  type CmsDraftInput,
  type CmsFieldErrors,
  type CmsPage,
  type CmsSlots,
  type CmsSlotKey,
} from "../../lib/cms-client";
import { CmsSlotRenderer } from "./CmsRenderer";

interface CmsDraftValues {
  title: string;
  slots: CmsSlots;
}

interface CmsEditorProps {
  initialSlug?: string;
  client?: CmsClient;
}

type EditorOperation = "idle" | "loading" | "saving" | "publishing" | "rolling-back";

const COMPONENT_LABELS: Record<CmsComponentKey, string> = {
  heading: "Tiêu đề",
  paragraph: "Đoạn văn",
  callout: "Thông báo",
  link: "Liên kết",
  image: "Hình ảnh",
};

function emptyDraft(): CmsDraftValues {
  return { title: "", slots: {} };
}

function draftFromPage(page: CmsPage): CmsDraftValues {
  return { title: page.title, slots: cloneCmsSlots(page.slots) };
}

let localComponentSequence = 0;

function newComponentId(componentKey: CmsComponentKey): string {
  localComponentSequence += 1;
  return `local-${componentKey}-${localComponentSequence}`;
}

function newComponent(componentKey: CmsComponentKey): CmsComponent {
  const id = newComponentId(componentKey);
  switch (componentKey) {
    case "heading":
      return { id, componentKey, props: { text: "", level: 2 } };
    case "paragraph":
      return { id, componentKey, props: { text: "" } };
    case "callout":
      return {
        id,
        componentKey,
        props: { title: "", body: "", tone: "info" },
      };
    case "link":
      return { id, componentKey, props: { label: "", href: "/" } };
    case "image":
      return { id, componentKey, props: { src: "", alt: "" } };
  }
}

function updateComponentAt(
  slots: CmsSlots,
  slotKey: CmsSlotKey,
  index: number,
  updater: (component: CmsComponent) => CmsComponent,
): CmsSlots {
  const components = slots[slotKey] ?? [];
  return {
    ...slots,
    [slotKey]: components.map((component, componentIndex) =>
      componentIndex === index ? updater(component) : component,
    ),
  };
}

function prettyUpdatedAt(value: string | undefined): string {
  if (!value) return "Chưa đồng bộ";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function asCmsError(error: unknown): CmsApiError {
  if (error instanceof CmsApiError) return error;
  return new CmsApiError(
    "network",
    0,
    error instanceof Error ? error.message : "Không thể kết nối CMS.",
  );
}

function apiErrorMessage(error: CmsApiError): string {
  switch (error.kind) {
    case "auth":
      return "Phiên quản trị không hợp lệ hoặc đã hết hạn (401). Hãy đăng nhập lại trước khi tiếp tục.";
    case "forbidden":
      return "Tài khoản hiện tại không có quyền ADMIN (403). Nội dung chưa được thay đổi.";
    case "validation":
      return `${error.message} (400/422).`;
    case "conflict":
      return "Bản nháp đã thay đổi ở nơi khác (409). Tải lại version mới nhất trước khi lưu tiếp.";
    case "not-found":
      return "Chưa tìm thấy trang trong CMS typed contract. Có thể backend CMS đang chờ tích hợp (404).";
    case "network":
      return `Không thể kết nối live CMS${error.message ? `: ${error.message}` : ""}`;
    default:
      return `${error.message} (HTTP ${error.status || "không xác định"}).`;
  }
}

function FieldError({ message }: { message?: string }): ReactElement | null {
  return message ? <p className="mt-1 text-xs text-red-700">{message}</p> : null;
}

function ComponentFields({
  component,
  slotKey,
  index,
  onChange,
}: {
  component: CmsComponent;
  slotKey: CmsSlotKey;
  index: number;
  onChange: (
    slotKey: CmsSlotKey,
    index: number,
    updater: (component: CmsComponent) => CmsComponent,
  ) => void;
}): ReactElement {
  const updateProps = (patch: Record<string, string | number>): void => {
    onChange(slotKey, index, (current) => ({
      ...current,
      props: { ...current.props, ...patch },
    }) as CmsComponent);
  };

  switch (component.componentKey) {
    case "heading":
      return (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <label className="text-sm font-semibold text-slate-700">
            Nội dung tiêu đề
            <input
              aria-label="Nội dung tiêu đề"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => updateProps({ text: event.target.value })}
              value={component.props.text}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Cấp heading
            <select
              aria-label="Cấp heading"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => updateProps({ level: Number(event.target.value) })}
              value={component.props.level}
            >
              <option value={1}>H1</option>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
            </select>
          </label>
        </div>
      );
    case "paragraph":
      return (
        <label className="text-sm font-semibold text-slate-700">
          Nội dung đoạn văn
          <textarea
            aria-label="Nội dung đoạn văn"
            className="mt-1 min-h-32 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6"
            onChange={(event) => updateProps({ text: event.target.value })}
            value={component.props.text}
          />
        </label>
      );
    case "callout":
      return (
        <div className="grid gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Tiêu đề thông báo
            <input
              aria-label="Tiêu đề thông báo"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => updateProps({ title: event.target.value })}
              value={component.props.title}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Nội dung thông báo
            <textarea
              aria-label="Nội dung thông báo"
              className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6"
              onChange={(event) => updateProps({ body: event.target.value })}
              value={component.props.body}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Tone
            <select
              aria-label="Tone thông báo"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => updateProps({ tone: event.target.value })}
              value={component.props.tone}
            >
              {CMS_CALLOUT_TONES.map((tone) => <option key={tone} value={tone}>{tone}</option>)}
            </select>
          </label>
        </div>
      );
    case "link":
      return (
        <div className="grid gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Nhãn liên kết
            <input
              aria-label="Nhãn liên kết"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => updateProps({ label: event.target.value })}
              value={component.props.label}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            URL an toàn
            <input
              aria-describedby={`${component.id}-href-help`}
              aria-label="URL liên kết"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
              onChange={(event) => updateProps({ href: event.target.value })}
              value={component.props.href}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500" id={`${component.id}-href-help`}>
              Chỉ http(s), đường dẫn nội bộ bắt đầu bằng / hoặc anchor # được lưu.
            </span>
          </label>
        </div>
      );
    case "image":
      return (
        <div className="grid gap-3">
          <label className="text-sm font-semibold text-slate-700">
            URL hình ảnh
            <input
              aria-label="URL hình ảnh"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
              onChange={(event) => updateProps({ src: event.target.value })}
              value={component.props.src}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Mô tả thay thế
            <input
              aria-label="Mô tả thay thế hình ảnh"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => updateProps({ alt: event.target.value })}
              value={component.props.alt}
            />
          </label>
        </div>
      );
  }
}

export function CmsEditor({
  initialSlug = "home",
  client = defaultCmsClient,
}: CmsEditorProps): ReactElement {
  const [slug, setSlug] = useState(initialSlug);
  const [loadedSlug, setLoadedSlug] = useState(initialSlug);
  const [page, setPage] = useState<CmsPage | null>(null);
  const [draft, setDraft] = useState<CmsDraftValues>(emptyDraft);
  const [operation, setOperation] = useState<EditorOperation>("idle");
  const [apiError, setApiError] = useState<CmsApiError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CmsFieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [rollbackVersion, setRollbackVersion] = useState("");

  const loadPage = useCallback(async (requestedSlug: string): Promise<void> => {
    const normalizedSlug = requestedSlug.trim();
    setOperation("loading");
    setApiError(null);
    setFieldErrors({});
    setNotice(null);

    try {
      const loadedPage = await client.getDraftPage(normalizedSlug);
      setPage(loadedPage);
      setDraft(draftFromPage(loadedPage));
      setLoadedSlug(normalizedSlug);
    } catch (error) {
      const cmsError = asCmsError(error);
      setApiError(cmsError);
      setPage(null);
      setDraft(emptyDraft());
      setLoadedSlug(normalizedSlug);
    } finally {
      setOperation("idle");
    }
  }, [client]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPage(initialSlug), 0);
    return () => window.clearTimeout(timer);
  }, [initialSlug, loadPage]);

  const updateComponent = (
    slotKey: CmsSlotKey,
    index: number,
    updater: (component: CmsComponent) => CmsComponent,
  ): void => {
    setDraft((current) => ({
      ...current,
      slots: updateComponentAt(current.slots, slotKey, index, updater),
    }));
    setNotice(null);
  };

  const addComponent = (slotKey: CmsSlotKey, componentKey: CmsComponentKey): void => {
    setDraft((current) => ({
      ...current,
      slots: {
        ...current.slots,
        [slotKey]: [...(current.slots[slotKey] ?? []), newComponent(componentKey)],
      },
    }));
    setNotice(null);
  };

  const removeComponent = (slotKey: CmsSlotKey, index: number): void => {
    setDraft((current) => ({
      ...current,
      slots: {
        ...current.slots,
        [slotKey]: (current.slots[slotKey] ?? []).filter((_, componentIndex) => componentIndex !== index),
      },
    }));
    setNotice(null);
  };

  const handleLoad = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void loadPage(slug);
  };

  const draftInput = (): CmsDraftInput => ({
    title: draft.title,
    slots: draft.slots,
    baseVersion: page?.version,
  });

  const handleSave = async (): Promise<void> => {
    const input = draftInput();
    const errors = validateCmsDraft(input);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setApiError(new CmsValidationError("Nội dung CMS chưa hợp lệ.", errors));
      return;
    }

    setOperation("saving");
    setApiError(null);
    setFieldErrors({});
    setNotice(null);
    try {
      const savedPage = page
        ? await client.saveDraft(loadedSlug, input)
        : await client.createDraft({ slug: loadedSlug, ...input });
      setPage(savedPage);
      setDraft(draftFromPage(savedPage));
      setNotice(`Đã lưu bản nháp version ${savedPage.version}.`);
    } catch (error) {
      setApiError(asCmsError(error));
    } finally {
      setOperation("idle");
    }
  };

  const handlePublish = async (): Promise<void> => {
    if (!page) {
      setApiError(new CmsValidationError("Hãy lưu bản nháp trước khi xuất bản."));
      return;
    }
    setOperation("publishing");
    setApiError(null);
    setNotice(null);
    try {
      const publishedPage = await client.publishPage(loadedSlug, { baseVersion: page.version });
      setPage(publishedPage);
      setDraft(draftFromPage(publishedPage));
      setNotice(`Đã gửi yêu cầu xuất bản version ${publishedPage.version}.`);
    } catch (error) {
      setApiError(asCmsError(error));
    } finally {
      setOperation("idle");
    }
  };

  const handleRollback = async (): Promise<void> => {
    const targetVersion = Number(rollbackVersion);
    if (!page || !Number.isInteger(targetVersion) || targetVersion < 1) {
      setApiError(new CmsValidationError("Nhập version rollback dương và tải bản nháp trước."));
      return;
    }
    setOperation("rolling-back");
    setApiError(null);
    setNotice(null);
    try {
      const rolledBackPage = await client.rollbackPage(loadedSlug, {
        targetVersion,
        baseVersion: page.version,
      });
      setPage(rolledBackPage);
      setDraft(draftFromPage(rolledBackPage));
      setRollbackVersion("");
      setNotice(`Đã tạo bản nháp từ version ${rolledBackPage.version}.`);
    } catch (error) {
      setApiError(asCmsError(error));
    } finally {
      setOperation("idle");
    }
  };

  const isBusy = operation !== "idle";
  const authBlocked = apiError?.kind === "auth" || apiError?.kind === "forbidden";
  const canMutate = !authBlocked && !isBusy;
  const currentState = page?.state ?? "Chưa có bản nháp live";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">CMS nội dung</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Chỉnh sửa nội dung theo slot</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Editor này chỉ đọc/ghi typed CMS API. Không có nội dung demo tự động thay thế khi live backend chưa sẵn sàng.
        </p>
      </header>

      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950" role="status">
        <strong>Nguồn dữ liệu: live backend.</strong> Slot và component dùng vocabulary cố định; liên kết/hình ảnh được kiểm tra URL an toàn trước khi gửi.
      </div>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={handleLoad}>
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
          <span className="mt-1 block text-xs font-normal text-slate-500" id="cms-slug-help">
            Ví dụ: home hoặc about-us. Tải lại sẽ thay thế bản nháp đang chỉnh sửa cục bộ.
          </span>
        </label>
        <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60" disabled={isBusy} type="submit">
          {operation === "loading" ? "Đang tải…" : "Tải bản nháp"}
        </button>
      </form>

      {apiError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950" role="alert">
          <p>{apiErrorMessage(apiError)}</p>
          {apiError.fieldErrors ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {Object.entries(apiError.fieldErrors).map(([field, message]) => <li key={field}>{field}: {message}</li>)}
            </ul>
          ) : null}
          {apiError.kind === "conflict" ? (
            <button className="mt-3 min-h-11 rounded-xl bg-red-800 px-4 py-2 text-sm font-bold text-white hover:bg-red-900" onClick={() => void loadPage(loadedSlug)} type="button">
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
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Đang chỉnh sửa: {loadedSlug}</p>
              <h2 className="text-2xl font-bold text-slate-950" id="cms-editor-title">Bản nháp</h2>
            </div>
            <dl className="text-right text-xs text-slate-500">
              <div><dt className="inline font-semibold">Trạng thái: </dt><dd className="inline">{currentState}</dd></div>
              <div><dt className="inline font-semibold">Version: </dt><dd className="inline">{page?.version ?? "chưa có"}</dd></div>
              <div><dt className="inline font-semibold">Cập nhật: </dt><dd className="inline">{prettyUpdatedAt(page?.updatedAt)}</dd></div>
            </dl>
          </div>

          <label className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-sm font-semibold text-slate-700">
            Tên nội dung
            <input
              aria-describedby="cms-title-help"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setDraft((current) => ({ ...current, title: event.target.value }));
                setNotice(null);
              }}
              value={draft.title}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500" id="cms-title-help">Tối đa 240 ký tự.</span>
            <FieldError message={fieldErrors.title} />
          </label>

          {CMS_SLOT_KEYS.map((slotKey) => {
            const components = draft.slots[slotKey] ?? [];
            return (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={slotKey}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">Slot: {slotKey}</h3>
                    <p className="text-xs text-slate-500">Stable slot key · {components.length} component</p>
                  </div>
                  <label className="text-xs font-semibold text-slate-600">
                    <span className="sr-only">Thêm component vào slot {slotKey}</span>
                    <select
                      aria-label={`Thêm component vào slot ${slotKey}`}
                      className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      onChange={(event) => {
                        if (event.target.value) addComponent(slotKey, event.target.value as CmsComponentKey);
                        event.target.value = "";
                      }}
                      value=""
                    >
                      <option value="">+ Thêm component</option>
                      {CMS_COMPONENT_KEYS.map((componentKey) => <option key={componentKey} value={componentKey}>{COMPONENT_LABELS[componentKey]}</option>)}
                    </select>
                  </label>
                </div>

                {components.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Slot đang trống.</p> : null}
                <div className="mt-4 grid gap-3">
                  {components.map((component, index) => (
                    <fieldset className="min-w-0 rounded-xl border border-slate-200 p-3" key={component.id}>
                      <legend className="px-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                        {COMPONENT_LABELS[component.componentKey]} · {component.id}
                      </legend>
                      <div className="flex justify-end">
                        <button className="min-h-10 rounded-lg px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50" onClick={() => removeComponent(slotKey, index)} type="button">
                          Xóa component
                        </button>
                      </div>
                      <ComponentFields component={component} index={index} onChange={updateComponent} slotKey={slotKey} />
                    </fieldset>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <button className="min-h-11 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60" disabled={!canMutate} onClick={() => void handleSave()} type="button">
              {operation === "saving" ? "Đang lưu…" : "Lưu bản nháp"}
            </button>
            <button className="min-h-11 rounded-xl border border-teal-700 px-4 py-2 text-sm font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-60" disabled={!canMutate || !page} onClick={() => void handlePublish()} type="button">
              {operation === "publishing" ? "Đang xuất bản…" : "Xuất bản"}
            </button>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="cms-rollback-title">
            <div>
              <h3 className="font-bold text-slate-950" id="cms-rollback-title">Rollback có kiểm soát</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">Nhập version đã được backend ghi nhận. Request vẫn gửi baseVersion hiện tại để tránh ghi đè ngoài ý muốn.</p>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="text-sm font-semibold text-slate-700">
                Target version
                <input
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm sm:w-48"
                  inputMode="numeric"
                  min="1"
                  onChange={(event) => setRollbackVersion(event.target.value)}
                  type="number"
                  value={rollbackVersion}
                />
              </label>
              <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60" disabled={!canMutate || !page} onClick={() => void handleRollback()} type="button">
                {operation === "rolling-back" ? "Đang rollback…" : "Tạo bản nháp từ version"}
              </button>
            </div>
          </section>
        </section>

        <aside aria-labelledby="cms-preview-title" className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Safe renderer</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950" id="cms-preview-title">Xem trước</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Preview dùng đúng schema allowlist và text node React, không diễn giải HTML/JS từ CMS.</p>
          </div>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            {draft.title ? <h2 className="mb-6 text-2xl font-bold tracking-tight text-slate-950">{draft.title}</h2> : <p className="mb-6 text-sm text-slate-500">Chưa có tên nội dung.</p>}
            {CMS_SLOT_KEYS.map((slotKey) => (
              <CmsSlotRenderer className="mb-6 last:mb-0" components={draft.slots[slotKey]} key={slotKey} slotKey={slotKey} />
            ))}
          </article>
        </aside>
      </div>
    </div>
  );
}

export default CmsEditor;
