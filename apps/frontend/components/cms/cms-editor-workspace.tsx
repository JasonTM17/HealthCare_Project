"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../lib/api-client";
import { installAdminHistoryGuard } from "../../lib/admin-history-guard";
import { cmsLayoutClient, emptyCmsLayoutDraft, type CmsLayoutDraft, type CmsLayoutHistory } from "../../lib/cms-layout-client";
import { CmsValidationError } from "../../lib/cms-client";
import { createNativeCmsLayout, equalCmsPageLayouts, parseCmsPageLayout, validateCmsSectionOrder, type CmsLayoutValue, type CmsPageLayout } from "../../lib/cms-page-layout";
import { CMS_PAGE_MANIFESTS, resolveCmsPageIdentity, type CmsPageIdentity } from "../../lib/cms-page-manifest";
import { resolveCmsPublicDetail } from "../../lib/cms-page-navigation";
import { formatBusinessDateTime } from "../../lib/business-time";
import { presentApiError } from "../../lib/present-api-error";
import { useSortableList } from "../../lib/useSortableList";
import ConfirmActionDialog from "../ui/ConfirmActionDialog";
import { CmsFieldInspector, normalizeCmsRichText } from "./cms-field-inspector";
import { CmsNativePreview } from "./cms-native-preview";
import styles from "./cms-workspace.module.css";

function errorCopy(error: unknown): string {
  if (error instanceof CmsValidationError) return error.message;
  if (error instanceof ApiError) return error.status === 409 ? "Nội dung vừa thay đổi. Bản đang sửa vẫn được giữ; xem thông tin mới trước khi lưu lại." : presentApiError(error.code, error.status);
  return "Chưa thể thực hiện thao tác. Nội dung đang sửa vẫn được giữ lại.";
}
type SwitchIntent = { kind: "page"; identity: CmsPageIdentity } | { kind: "url"; href: string; target?: HTMLButtonElement } | { kind: "browser"; proceed: () => void };

export default function CmsEditorWorkspace() {
  const [identity, setIdentity] = useState(() => resolveCmsPageIdentity("/")!);
  return <CmsPageSession key={identity.slotKey} identity={identity} onPageChange={setIdentity} />;
}
function CmsPageSession({ identity, onPageChange }: { identity: CmsPageIdentity; onPageChange: (identity: CmsPageIdentity) => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => emptyCmsLayoutDraft(identity));
  const [working, setWorking] = useState<CmsPageLayout>(() => createNativeCmsLayout(identity));
  const [loading, setLoading] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const mediaBusyRef = useRef(false);
  const onMediaBusy = useCallback((busy: boolean) => { mediaBusyRef.current = busy; setMediaBusy(busy); }, []);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [remoteDraft, setRemoteDraft] = useState<CmsLayoutDraft | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [nativeValues, setNativeValues] = useState<Record<string, CmsLayoutValue>>({});
  const [rawRich, setRawRich] = useState<Record<string, string>>({});
  const [richErrors, setRichErrors] = useState<Record<string, string>>({});
  const [focusRequest, setFocusRequest] = useState({ fieldId: null as string | null, nonce: 0 });
  const [mode, setMode] = useState<"draft" | "published">("draft");
  const [mobileTab, setMobileTab] = useState<"preview" | "outline" | "inspector">("preview");
  const [focusPreview, setFocusPreview] = useState(false);
  const [history, setHistory] = useState<CmsLayoutHistory[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPreview, setHistoryPreview] = useState<CmsLayoutHistory | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "publish" } | { kind: "restore"; entry: CmsLayoutHistory } | null>(null);
  const [resetFieldId, setResetFieldId] = useState<string | null>(null);
  const [switchIntent, setSwitchIntent] = useState<SwitchIntent | null>(null);
  const [detailPath, setDetailPath] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
  const requestEpoch = useRef(0);
  const navigationBypass = useRef(false);
  let validationError: string | null = null;
  try { parseCmsPageLayout(working, identity); } catch (cause) { validationError = cause instanceof Error ? cause.message : "Nội dung chưa hợp lệ."; }
  const dirty = !equalCmsPageLayouts(working, draft.payload) || Object.keys(richErrors).length > 0;
  const selectedValue = fieldId ? working.fields[fieldId] ?? nativeValues[fieldId] ?? null : null;
  const disableEditing = loading || pending || mediaBusy || !draftReady;
  const orderedSections = useMemo(() => working.sectionOrder.map((id) => identity.sections.find((section) => section.id === id)!).filter(Boolean), [identity, working.sectionOrder]);

  useEffect(() => {
    const controller = new AbortController();
    const epoch = ++requestEpoch.current;
    void cmsLayoutClient.getDraft(identity, controller.signal).then((result) => {
      if (controller.signal.aborted || requestEpoch.current !== epoch) return;
      setDraft(result); setWorking(result.payload); setLoading(false); setDraftReady(true);
    }).catch((cause) => { if (!controller.signal.aborted && requestEpoch.current === epoch) { setError(errorCopy(cause)); setLoading(false); } });
    return () => { controller.abort(); requestEpoch.current += 1; };
  }, [identity, reload]);
  useEffect(() => {
    if (!dirty && !pending && !mediaBusy) return;
    const unload = (event: BeforeUnloadEvent) => { if (!navigationBypass.current) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: MouseEvent) => {
      if (navigationBypass.current || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const element = event.target instanceof Element ? event.target : null;
      const logout = element?.closest<HTMLButtonElement>("button[data-leaves-admin-session]");
      const link = element?.closest<HTMLAnchorElement>("a[href]");
      if (!logout && (!link || link.target === "_blank" || link.hasAttribute("download") || link.getAttribute("href")?.startsWith("#"))) return;
      if (link && new URL(link.href).href === window.location.href) return;
      event.preventDefault(); event.stopPropagation();
      if (!pendingRef.current && !mediaBusyRef.current) setSwitchIntent(logout ? { kind: "url", href: "", target: logout } : { kind: "url", href: link!.href });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    const historyGuard = installAdminHistoryGuard({ isBlocked: () => !navigationBypass.current, isBusy: () => pendingRef.current || mediaBusyRef.current, onRequestLeave: (proceed) => setSwitchIntent({ kind: "browser", proceed }) });
    return () => { historyGuard.dispose(); window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty, pending, mediaBusy]);

  const onSelected = useCallback((id: string, nativeValue: CmsLayoutValue) => {
    if (pendingRef.current || mediaBusyRef.current) return;
    if (fieldId && fieldId !== id && richErrors[fieldId]) {
      setError("Hãy xử lý định dạng của trường đang sửa trước khi chọn trường khác. Nội dung vẫn được giữ lại.");
      setFocusRequest((previous) => ({ fieldId, nonce: previous.nonce + 1 }));
      setMobileTab("inspector"); return;
    }
    setNativeValues((previous) => ({ ...previous, [id]: nativeValue })); setFieldId(id); setMobileTab("inspector");
  }, [fieldId, richErrors]);
  const reorder = useCallback((ids: string[]) => {
    if (pendingRef.current || mediaBusyRef.current) return;
    try {
      validateCmsSectionOrder(identity.sections, ids);
      setWorking((previous) => ({ ...previous, sectionOrder: ids }));
      setAnnouncement("Đã thay đổi thứ tự vùng trang. Chưa lưu bản nháp.");
    } catch { setAnnouncement("Không thể di chuyển phần này qua vùng cố định."); }
  }, [identity]);
  const sortable = useSortableList({ items: orderedSections, onReorder: (sections) => reorder(sections.map((section) => section.id)), handle: ".cms-section-drag-handle", disabled: disableEditing, animation: 0 });
  const move = (id: string, direction: -1 | 1) => {
    const ids = [...working.sectionOrder]; const from = ids.indexOf(id); const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]]; reorder(ids);
  };
  const canMove = (id: string, direction: -1 | 1): boolean => {
    const ids = [...working.sectionOrder]; const from = ids.indexOf(id); const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return false;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    try { validateCmsSectionOrder(identity.sections, ids); return true; } catch { return false; }
  };
  const begin = () => { if (pendingRef.current || mediaBusyRef.current || loading || !draftReady) return false; requestEpoch.current += 1; pendingRef.current = true; setPending(true); setError(null); return true; };
  const finish = () => { pendingRef.current = false; setPending(false); };
  const failed = (cause: unknown) => { setError(errorCopy(cause)); if (cause instanceof ApiError && cause.status === 409) setConflict(true); };
  const applySaved = (result: CmsLayoutDraft) => { setDraft(result); setWorking(result.payload); setRawRich({}); setRichErrors({}); setConflict(false); setRemoteDraft(null); };
  const persist = async (): Promise<CmsLayoutDraft> => {
    if (Object.keys(richErrors).length > 0) throw new CmsValidationError("Hãy xử lý định dạng chưa được hỗ trợ trước khi lưu; nội dung vẫn được giữ lại.");
    const result = await cmsLayoutClient.saveDraft(identity, parseCmsPageLayout(working, identity), draft.expectedVersion);
    applySaved(result); setAnnouncement("Đã lưu bản nháp. Nội dung công khai chưa thay đổi."); return result;
  };
  const save = async (): Promise<boolean> => {
    if (!begin()) return false;
    try { await persist(); return true; } catch (cause) { failed(cause); return false; } finally { finish(); }
  };
  const mutate = async () => {
    if (!confirm || !begin()) return;
    try {
      if (confirm.kind === "publish") {
        const saved = dirty ? await persist() : draft;
        const published = await cmsLayoutClient.publish(identity, saved.expectedVersion);
        applySaved(published); setAnnouncement("Đã xuất bản nội dung của trang này.");
      } else {
        const restored = await cmsLayoutClient.restore(identity, confirm.entry.eventId, draft.expectedVersion);
        applySaved(restored); setAnnouncement("Đã khôi phục thành bản nháp. Nội dung công khai chưa thay đổi.");
      }
      setHistory(null); setConfirm(null);
    } catch (cause) { failed(cause); } finally { finish(); }
  };
  const switchPage = (next: CmsPageIdentity) => {
    if (pendingRef.current || mediaBusyRef.current) return;
    if (next.slotKey === identity.slotKey && next.canonicalPath === identity.canonicalPath) return;
    if (dirty) setSwitchIntent({ kind: "page", identity: next }); else onPageChange(next);
  };
  const completeSwitch = (intent: SwitchIntent) => {
    navigationBypass.current = true;
    if (intent.kind === "page") onPageChange(intent.identity);
    else if (intent.kind === "browser") intent.proceed();
    else if (intent.target) intent.target.click();
    else if (new URL(intent.href, window.location.href).origin === window.location.origin) router.push(intent.href);
    else window.location.assign(intent.href);
  };
  const openDetail = async () => {
    if (detailLoading || pendingRef.current) return;
    setDetailLoading(true); setError(null);
    const epoch = requestEpoch.current;
    try {
      const next = await resolveCmsPublicDetail(detailPath, window.location.origin);
      if (epoch === requestEpoch.current) switchPage(next);
    } catch { if (epoch === requestEpoch.current) setError("Không thể mở trang chi tiết này. Kiểm tra đường dẫn công khai và trạng thái trong danh mục."); }
    finally { if (epoch === requestEpoch.current) setDetailLoading(false); }
  };
  const loadHistory = async () => {
    setShowHistory((value) => !value);
    if (history || showHistory) return;
    await fetchHistory();
  };
  const fetchHistory = async () => {
    setHistoryError(null);
    const epoch = requestEpoch.current;
    try { const result = await cmsLayoutClient.history(identity); if (epoch === requestEpoch.current) setHistory(result); } catch (cause) { if (epoch === requestEpoch.current) setHistoryError(errorCopy(cause)); }
  };
  const inspect = (id: string) => { if (pendingRef.current || mediaBusyRef.current) return; if (fieldId && fieldId !== id && richErrors[fieldId]) { setError("Hãy xử lý định dạng của trường đang sửa trước khi chọn trường khác. Nội dung vẫn được giữ lại."); return; } setFieldId(id); setFocusRequest((previous) => ({ fieldId: id, nonce: previous.nonce + 1 })); setMobileTab("inspector"); };
  const resetField = () => {
    if (!resetFieldId || pendingRef.current || mediaBusyRef.current) return;
    const id = resetFieldId;
    setWorking((previous) => { const fields = { ...previous.fields }; if (draft.payload.fields[id]) fields[id] = draft.payload.fields[id]; else delete fields[id]; return { ...previous, fields }; });
    setRawRich((previous) => { const next = { ...previous }; delete next[id]; return next; });
    setRichErrors((previous) => { const next = { ...previous }; delete next[id]; return next; });
    setResetFieldId(null); setAnnouncement("Đã khôi phục giá trị của trường. Các thay đổi khác vẫn được giữ.");
  };
  const update = (value: CmsLayoutValue) => { if (fieldId) setWorking((previous) => ({ ...previous, fields: { ...previous.fields, [fieldId]: value } })); };
  const updateRich = (raw: string) => {
    if (!fieldId) return;
    setRawRich((previous) => ({ ...previous, [fieldId]: raw }));
    try {
      const markdown = normalizeCmsRichText(raw, identity, fieldId);
      update({ kind: "rich", format: "markdown", value: markdown });
      setRichErrors((previous) => { const next = { ...previous }; delete next[fieldId]; return next; });
    } catch (cause) { setRichErrors((previous) => ({ ...previous, [fieldId]: cause instanceof Error ? cause.message : "Định dạng chưa được hỗ trợ." })); }
  };
  return <div data-testid="cms-workspace" className={`${styles.workspace} ${focusPreview ? styles.focusPreview : ""}`}>
    <header className={styles.header}>
      <h1>Nội dung website</h1><p>Chọn trang, chọn vùng cần sửa và xem kết quả trên giao diện thực tế.</p>
      <p><strong>{identity.manifest.label}</strong> · {identity.canonicalPath}</p>
      <p className={styles.status} data-testid="cms-draft-status">{loading ? "Đang tải nội dung…" : dirty ? "Có thay đổi chưa lưu" : draft.hasDraft ? `Bản nháp đã lưu${draft.draftUpdatedAt ? ` lúc ${formatBusinessDateTime(draft.draftUpdatedAt)}` : ""}` : "Chưa có thay đổi trong bản nháp"}</p>
      <p className={styles.status} data-testid="cms-public-status">{!draftReady ? "Đang xác minh nội dung đã lưu của trang." : draft.publicContent ? `Bản công khai cập nhật ${formatBusinessDateTime(draft.publicContent.updatedAt)}` : "Trang đang dùng nội dung gốc; chưa xuất bản bố cục riêng."}</p>
      {mediaBusy ? <p role="status">Đang tải ảnh. Chờ hoàn tất trước khi lưu hoặc đổi trường.</p> : null}
      <div className={styles.actions}>
        {!loading && !draftReady ? <button type="button" onClick={() => setReload((value) => value + 1)}>Thử tải lại nội dung</button> : null}
        <button data-testid="cms-save-draft" type="button" disabled={disableEditing || Boolean(validationError) || Object.keys(richErrors).length > 0 || conflict || !dirty} onClick={() => void save()}>{pending ? "Đang xử lý…" : "Lưu bản nháp"}</button>
        <button data-testid="cms-publish" className={styles.primary} type="button" disabled={disableEditing || Boolean(validationError) || Object.keys(richErrors).length > 0 || conflict || (!draft.hasDraft && !dirty)} onClick={() => setConfirm({ kind: "publish" })}>Xuất bản</button>
        <button type="button" disabled={disableEditing} onClick={() => void loadHistory()}>Lịch sử</button>
        <button type="button" onClick={() => setFocusPreview((value) => !value)}>{focusPreview ? "Mở vùng chỉnh sửa" : "Tập trung xem trước"}</button>
        <label>Bản xem trước <select data-testid="cms-preview-mode" value={mode} onChange={(event) => setMode(event.target.value as "draft" | "published")}><option value="draft">Bản nháp đang sửa</option><option value="published">Đang công khai</option></select></label>
      </div>
    </header>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {validationError ? <p role="alert" className={styles.error}>{validationError} Dữ liệu đang sửa được giữ lại.</p> : null}
    {conflict ? <div data-testid="cms-conflict" className={styles.notice}>
      <p>Bản sửa của bạn được giữ lại. Kiểm tra bản mới trước khi tiếp tục.</p>
      <button type="button" disabled={pending} onClick={() => { const epoch = requestEpoch.current; void cmsLayoutClient.getDraft(identity).then((result) => { if (epoch === requestEpoch.current) setRemoteDraft(result); }).catch((cause) => { if (epoch === requestEpoch.current) setError(errorCopy(cause)); }); }}>Xem thông tin mới</button>
      {remoteDraft ? <><p>{remoteDraft.draftUpdatedAt ? `Bản nháp mới cập nhật ${formatBusinessDateTime(remoteDraft.draftUpdatedAt)}` : "Thông tin mới đã được tải."}</p><button type="button" onClick={() => { setDraft(remoteDraft); setConflict(false); setAnnouncement("Đã giữ bản đang sửa trên phiên bản mới. Kiểm tra trước khi lưu và xuất bản."); }}>Giữ bản đang sửa để tiếp tục</button><button type="button" onClick={() => { if (window.confirm("Bỏ bản đang sửa và dùng bản nháp mới từ máy chủ?")) applySaved(remoteDraft); }}>Bỏ bản đang sửa, dùng bản mới</button></> : null}
    </div> : null}
    <p role="status" className={styles.status}>{announcement}</p>
    <div className={styles.tabs}>{([ ["preview", "Xem trước"], ["outline", "Vùng trang"], ["inspector", "Chỉnh sửa"] ] as const).map(([tab, label]) => <button key={tab} type="button" aria-pressed={mobileTab === tab} onClick={() => setMobileTab(tab)}>{label}</button>)}</div>
    <div className={styles.grid}>
      <aside className={`${styles.panel} ${styles.outline} ${mobileTab !== "outline" ? styles.mobileHidden : ""}`} aria-label="Trang và vùng nội dung">
        <h2>Trang & vùng</h2>
        <label>Tìm trang<input type="search" value={pageSearch} onChange={(event) => setPageSearch(event.target.value)} placeholder="Tên trang hoặc đường dẫn" /></label>
        <label>Trang công khai<select data-testid="cms-page-picker" disabled={disableEditing} value={identity.manifest.family} onChange={(event) => { const next = CMS_PAGE_MANIFESTS.find((page) => page.family === event.target.value); if (next) switchPage(resolveCmsPageIdentity(next.path)!); }}>{CMS_PAGE_MANIFESTS.filter((page) => page.family === identity.manifest.family || `${page.label} ${page.path}`.toLocaleLowerCase("vi").includes(pageSearch.trim().toLocaleLowerCase("vi"))).map((page) => <option key={page.family} value={page.family}>{page.label}</option>)}</select></label>
        {identity.entityId ? <p className={styles.status}>Đang sửa riêng trang chi tiết {identity.canonicalPath}.</p> : null}
        {identity.manifest.supportsDetail ? <><label>Trang chi tiết<input value={detailPath} disabled={disableEditing || detailLoading} onChange={(event) => setDetailPath(event.target.value)} placeholder={`${identity.manifest.path}/ten-trang`} /></label><button type="button" disabled={disableEditing || detailLoading || !detailPath.trim()} onClick={() => void openDetail()}>{detailLoading ? "Đang mở…" : "Mở trang chi tiết"}</button></> : null}
        <div ref={sortable.containerRef}>{orderedSections.map((section) => <div key={section.id} className={styles.outlineRow} data-testid={`cms-section-${section.id}`}>
          <strong>{section.label}</strong><small>{section.reorderable ? "Có thể đổi thứ tự trong cùng vùng" : "Vùng cố định"}</small>
          <div className={styles.move}>
            <button className="cms-section-drag-handle" type="button" aria-label={`Kéo ${section.label}`} disabled={disableEditing || !section.reorderable}>↕</button>
            <button data-testid={`cms-move-up-${section.id}`} type="button" aria-label={`Di chuyển ${section.label} lên`} disabled={disableEditing || !canMove(section.id, -1)} onClick={() => move(section.id, -1)}>Lên</button>
            <button data-testid={`cms-move-down-${section.id}`} type="button" aria-label={`Di chuyển ${section.label} xuống`} disabled={disableEditing || !canMove(section.id, 1)} onClick={() => move(section.id, 1)}>Xuống</button>
          </div>
          <div className={styles.fieldList}>{section.fields.map((field) => <button key={field.id} type="button" disabled={disableEditing || mode === "published"} className={fieldId === field.id ? styles.selected : ""} onClick={() => inspect(field.id)}>{field.label}</button>)}</div>
          {section.fields.length === 0 ? <p className={styles.status}>Nội dung theo nguồn chuyên môn{identity.manifest.authorityHref ? <> · <a href={identity.manifest.authorityHref}>Quản lý danh mục ↗</a></> : "; giữ theo nguồn gốc."}</p> : null}
        </div>)}</div>
      </aside>
      <div className={mobileTab !== "preview" ? styles.mobileHidden : ""}><CmsNativePreview identity={identity} layout={mode === "draft" ? working : draft.publicContent?.payload ?? createNativeCmsLayout(identity)} mode={mode} onSelected={onSelected} focusFieldId={focusRequest.fieldId} focusNonce={focusRequest.nonce} /></div>
      <aside className={`${styles.panel} ${styles.inspector} ${mobileTab !== "inspector" ? styles.mobileHidden : ""}`}>
        {fieldId && !selectedValue ? <p role="status">Đang chọn trường trên trang thật…</p> : <CmsFieldInspector identity={identity} fieldId={fieldId} value={selectedValue} rawRich={fieldId ? rawRich[fieldId] : undefined} disabled={disableEditing || mode === "published"} onBusyChange={onMediaBusy} error={fieldId ? richErrors[fieldId] : undefined} onChange={update} onRichChange={updateRich} onReset={() => setResetFieldId(fieldId)} />}
      </aside>
    </div>
    {showHistory ? <section className={styles.history} data-testid="cms-history"><h2>Lịch sử nội dung</h2>{historyError ? <><p role="alert" className={styles.error}>{historyError}</p><button type="button" onClick={() => void fetchHistory()}>Thử tải lại lịch sử</button></> : history === null ? <p>Đang tải lịch sử…</p> : history.length === 0 ? <p>Chưa có lịch sử lưu cho trang này.</p> : history.map((entry) => <div key={entry.eventId} className={styles.historyRow}><div><strong>{entry.status === "PUBLISHED" ? "Nội dung lưu / xuất bản" : "Nội dung lưu bản nháp"}</strong><p>{formatBusinessDateTime(entry.changedAt)} · {entry.actorEmail}</p></div><div className={styles.actions}><button type="button" onClick={() => setHistoryPreview(entry)}>Xem phiên bản</button><button type="button" disabled={disableEditing || dirty} onClick={() => setConfirm({ kind: "restore", entry })}>Khôi phục vào bản nháp</button></div></div>)}{dirty ? <p className={styles.notice}>Lưu hoặc bỏ thay đổi hiện tại trước khi khôi phục lịch sử.</p> : null}{historyPreview ? <div><h3>Phiên bản lưu lúc {formatBusinessDateTime(historyPreview.changedAt)}</h3><button type="button" onClick={() => setHistoryPreview(null)}>Đóng phiên bản</button><CmsNativePreview key={historyPreview.eventId} identity={identity} layout={historyPreview.payload} mode="published" onSelected={() => {}} /></div> : null}</section> : null}
    <ConfirmActionDialog open={confirm !== null} title={confirm?.kind === "restore" ? "Khôi phục nội dung vào bản nháp?" : "Xuất bản nội dung trang?"} description={confirm?.kind === "restore" ? "Thao tác chỉ tạo bản nháp riêng; nội dung công khai giữ nguyên." : "Nội dung và thứ tự vùng của trang này sẽ được hiển thị công khai."} summaryItems={[{ label: "Trang", value: identity.canonicalPath }, { label: "Bản đang sửa", value: dirty ? "Sẽ lưu rồi xuất bản" : "Bản nháp đã lưu" }]} confirmLabel={confirm?.kind === "restore" ? "Khôi phục bản nháp" : "Xác nhận xuất bản"} cancelLabel="Hủy" pending={pending} error={error} onCancel={() => setConfirm(null)} onConfirm={() => void mutate()} />
    <ConfirmActionDialog open={switchIntent !== null} title="Bạn có thay đổi chưa lưu" description="Lưu bản nháp trước khi rời trang, hoặc ở lại để tiếp tục chỉnh sửa." summaryItems={[{ label: "Trang đang sửa", value: identity.canonicalPath }, { label: "Bỏ thay đổi", value: <button type="button" disabled={pending} onClick={() => { if (switchIntent) completeSwitch(switchIntent); }}>Bỏ thay đổi và tiếp tục</button> }]} confirmLabel="Lưu bản nháp và tiếp tục" cancelLabel="Ở lại" pending={pending} error={error} onCancel={() => setSwitchIntent(null)} onConfirm={() => { const intent = switchIntent; if (intent) void save().then((saved) => { if (saved) completeSwitch(intent); }); }} />
    <ConfirmActionDialog open={resetFieldId !== null} title="Khôi phục giá trị đã lưu của trường?" description="Nội dung chưa lưu của trường này sẽ được thay bằng giá trị đã lưu. Các vùng khác của trang vẫn được giữ." summaryItems={[{ label: "Trang", value: identity.canonicalPath }, { label: "Trường", value: identity.sections.flatMap((section) => section.fields).find((field) => field.id === resetFieldId)?.label ?? "" }]} confirmLabel="Khôi phục trường này" cancelLabel="Giữ nội dung đang sửa" pending={pending || mediaBusy} onCancel={() => setResetFieldId(null)} onConfirm={resetField} />
  </div>;
}
