"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  fetchAdminAiContentReviews,
  fetchArticles,
  submitAiContentRevision,
} from "../../../lib/api-client";
import { presentApiError } from "../../../lib/present-api-error";
import UiIcon from "../../../components/UiIcon";
import type {
  AiContentReviewState,
  AiContentReviewSummary,
  AiContentType,
  Article,
} from "../../../types/hospital";

const TYPES: Array<AiContentType | ""> = ["", "SPECIALTY", "ARTICLE", "FAQ"];
const STATES: Array<AiContentReviewState | ""> = [
  "",
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REVOKED",
  "EXPIRED",
];

const TYPE_LABELS: Record<AiContentType, string> = {
  SPECIALTY: "Chuyên khoa",
  ARTICLE: "Bài viết",
  FAQ: "Hỏi đáp",
};

const STATE_LABELS: Record<AiContentReviewState, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Chờ bác sĩ duyệt",
  APPROVED: "Đã duyệt",
  CHANGES_REQUESTED: "Cần chỉnh sửa",
  REVOKED: "Đã thu hồi",
  EXPIRED: "Hết hạn",
};

function typeLabel(type: AiContentType): string {
  return TYPE_LABELS[type] ?? "Nguồn nội dung";
}

function stateLabel(state: AiContentReviewState): string {
  return STATE_LABELS[state] ?? "Trạng thái nội dung";
}

function dateLabel(value?: string | null): string {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa có"
    : date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function compactHash(hash?: string | null): string {
  if (!hash) return "Chưa có hash";
  return hash.length > 18 ? `${hash.slice(0, 12)}…${hash.slice(-4)}` : hash;
}

function stateTone(state: AiContentReviewState): string {
  if (state === "APPROVED") return "bg-emerald-100 text-emerald-900";
  if (state === "SUBMITTED") return "bg-amber-100 text-amber-900";
  if (state === "CHANGES_REQUESTED") return "bg-orange-100 text-orange-900";
  if (state === "REVOKED" || state === "EXPIRED") return "bg-slate-200 text-slate-700";
  return "bg-teal-100 text-teal-900";
}

function isSubmittable(state: AiContentReviewState): boolean {
  return state === "DRAFT" || state === "CHANGES_REQUESTED";
}

function StateBadge({ state }: { state: AiContentReviewState }) {
  return (
    <span
      aria-label={`Trạng thái: ${stateLabel(state)}`}
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ${stateTone(state)}`}
    >
      {stateLabel(state)}
    </span>
  );
}

export default function AdminAiContentReviewsPage() {
  const [type, setType] = useState<AiContentType | "">("");
  const [state, setState] = useState<AiContentReviewState | "">("");
  const [items, setItems] = useState<AiContentReviewSummary[]>([]);
  const [selected, setSelected] = useState<AiContentReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const requestEpoch = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const epoch = ++requestEpoch.current;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchAdminAiContentReviews({
        type: type || undefined,
        state: state || undefined,
        page: 0,
        size: 50,
      });
      if (epoch !== requestEpoch.current) return;
      setItems(page.content);
      setSelected((current) => {
        if (!current) return null;
        return page.content.find(
          (item) => item.sourceType === current.sourceType && item.sourceId === current.sourceId,
        ) ?? null;
      });
    } catch (cause) {
      if (epoch !== requestEpoch.current) return;
      setError(
        presentApiError(
          cause instanceof ApiError ? cause.code : null,
          cause instanceof ApiError ? cause.status : undefined,
        ),
      );
    } finally {
      if (epoch === requestEpoch.current) setLoading(false);
    }
  }, [state, type]);

  useEffect(() => {
    const task = Promise.resolve().then(() => load());
    return () => {
      requestEpoch.current += 1;
      void task.catch(() => undefined);
    };
  }, [load]);

  useEffect(() => {
    if (!previewModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewModalOpen]);

  const summary = useMemo(() => ({
    total: items.length,
    needsSubmit: items.filter((item) => isSubmittable(item.state)).length,
    submitted: items.filter((item) => item.state === "SUBMITTED").length,
    approved: items.filter((item) => item.state === "APPROVED").length,
  }), [items]);

  const activeFilterCount = Number(Boolean(type)) + Number(Boolean(state));
  const hasFilters = activeFilterCount > 0;

  const resetFilters = (): void => {
    setType("");
    setState("");
    setSelected(null);
    setNotice(null);
    setPreviewModalOpen(false);
  };

  const selectItem = (item: AiContentReviewSummary): void => {
    setSelected(item);
    setNotice(null);
    setError(null);
    setPreviewModalOpen(true);
    if (item.sourceType === "ARTICLE") {
      setPreviewLoading(true);
      fetchArticles(0, 100)
        .then((page) => {
          const matched = page.content.find(
            (a) => a.id === item.sourceId || a.title?.trim().toLowerCase() === item.title?.trim().toLowerCase(),
          );
          setPreviewArticle(matched ?? null);
        })
        .catch(() => setPreviewArticle(null))
        .finally(() => setPreviewLoading(false));
    } else {
      setPreviewArticle(null);
    }
  };

  const submitSelected = async (): Promise<void> => {
    if (!selected || submitting || !isSubmittable(selected.state)) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const submitted = await submitAiContentRevision(
        selected.sourceType,
        selected.sourceId,
        { revision: selected.revision, contentHash: selected.contentHash },
      );
      setNotice(
        `Đã gửi ${typeLabel(submitted.sourceType).toLowerCase()} revision ${submitted.revision} cho hàng đợi bác sĩ.`,
      );
      setSelected(submitted);
      await load();
    } catch (cause) {
      const stale = cause instanceof ApiError && cause.code === "AI_CONTENT_REVISION_STALE";
      setError(
        stale
          ? "Revision đã thay đổi. Hãy tải lại inventory rồi gửi đúng hash mới nhất."
          : presentApiError(
            cause instanceof ApiError ? cause.code : null,
            cause instanceof ApiError ? cause.status : undefined,
          ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="ai-review-admin-title" className="grid gap-6">
      <header className="portal-hero">
        <div>
          <p className="section-note">CLINICAL CONTENT GOVERNANCE</p>
          <h1 className="mt-2 text-3xl font-black text-teal-950" id="ai-review-admin-title">
            Kho revision nội dung AI
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Chọn đúng bản ghi hiện hành để gửi bác sĩ duyệt. Admin chỉ submit revision/hash từ inventory;
            không tự approve và không đưa dữ liệu vào RAG trước khi có quyết định độc lập.
          </p>
          <div aria-label="Tóm tắt inventory" className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-teal-900">
            <span className="rounded-md bg-teal-50 px-3 py-1.5">{summary.total} revision hiển thị</span>
            <span className="rounded-md bg-amber-50 px-3 py-1.5">{summary.needsSubmit} cần gửi</span>
            <span className="rounded-md bg-slate-100 px-3 py-1.5">{summary.submitted} chờ duyệt · {summary.approved} đã duyệt</span>
          </div>
        </div>
        <button
          aria-label="Tải lại inventory revision"
          className="outline-button min-h-11"
          disabled={loading}
          onClick={() => void load()}
          type="button"
        >
          {loading ? "Đang tải…" : "Tải lại inventory"}
        </button>
      </header>

      <section aria-labelledby="ai-review-filters-title" className="grid gap-4 rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-note">INVENTORY FILTERS</p>
            <h2 className="text-lg font-black text-teal-950" id="ai-review-filters-title">Lọc theo nguồn và trạng thái</h2>
            <p className="mt-1 text-sm text-slate-600">Bộ lọc chỉ thay đổi inventory hiện tại; không thay đổi dữ liệu nguồn.</p>
          </div>
          <button
            className="outline-button outline-button--small min-h-11"
            disabled={!hasFilters}
            onClick={resetFilters}
            type="button"
          >
            Xóa bộ lọc{hasFilters ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Bộ lọc inventory revision</legend>
          <label className="grid gap-1 text-sm font-bold text-slate-800" htmlFor="ai-review-type">
            Loại nguồn
            <select
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              id="ai-review-type"
              onChange={(event) => setType(event.target.value as AiContentType | "")}
              value={type}
            >
              <option value="">Tất cả loại nguồn</option>
              {TYPES.filter((item): item is AiContentType => item !== "").map((item) => (
                <option key={item} value={item}>{typeLabel(item)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-800" htmlFor="ai-review-state">
            Trạng thái review
            <select
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              id="ai-review-state"
              onChange={(event) => setState(event.target.value as AiContentReviewState | "")}
              value={state}
            >
              <option value="">Tất cả trạng thái</option>
              {STATES.filter((item): item is AiContentReviewState => item !== "").map((item) => (
                <option key={item} value={item}>{stateLabel(item)}</option>
              ))}
            </select>
          </label>
        </fieldset>
      </section>

      {notice ? <p aria-live="polite" className="notice" role="status">{notice}</p> : null}
      {error ? (
        <div aria-live="assertive" className="error-banner" role="alert">
          <span>{error}{items.length ? " Đang hiển thị inventory lần tải trước ở chế độ chỉ đọc." : ""}</span>
          <button className="outline-button outline-button--small min-h-11" onClick={() => void load()} type="button">Tải lại inventory</button>
        </div>
      ) : null}

      <section
        aria-busy={loading}
        aria-describedby="ai-review-inventory-help"
        aria-label="Danh sách revision"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <p className="text-sm font-bold text-teal-950" id="ai-review-inventory-help" role="status" aria-live="polite">
            {loading ? "Đang đồng bộ inventory…" : `${summary.total} revision phù hợp`}
          </p>
          {!loading && items.length > 0 ? <p className="text-xs text-slate-500">Trên màn hình hẹp, vuốt ngang để xem đủ cột.</p> : null}
        </div>
        {loading ? <p className="p-6 text-sm text-slate-600" role="status">Đang tải inventory nội dung…</p> : null}
        {!loading && !error && items.length === 0 ? (
          <div className="grid gap-2 p-6 text-sm text-slate-600" role="status">
            <p>Không có revision phù hợp với bộ lọc hiện tại.</p>
            {hasFilters ? <button className="outline-button outline-button--small min-h-11 w-fit" onClick={resetFilters} type="button">Xem toàn bộ inventory</button> : null}
          </div>
        ) : null}
        {!loading && items.length > 0 ? (
          <div aria-label="Bảng inventory revision, có thể cuộn ngang" className="overflow-x-auto" style={{ contain: "layout paint" }} tabIndex={0}>
            <table className="min-w-[760px] w-full text-left text-sm">
              <caption className="sr-only">Inventory revision nội dung AI</caption>
              <thead className="bg-teal-50 text-xs uppercase tracking-wide text-teal-950">
                <tr>
                  <th className="px-4 py-3" scope="col">Nguồn</th>
                  <th className="px-4 py-3" scope="col">Trạng thái</th>
                  <th className="px-4 py-3" scope="col">Revision / hash</th>
                  <th className="px-4 py-3" scope="col">Mốc review</th>
                  <th className="px-4 py-3" scope="col"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const active = selected?.sourceId === item.sourceId && selected.sourceType === item.sourceType;
                  return (
                    <tr className={active ? "bg-amber-50" : undefined} key={`${item.sourceType}-${item.sourceId}-${item.revision}`}>
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold text-teal-950">{item.title || "Nguồn chưa đặt tên"}</p>
                        <p className="mt-1 text-xs text-slate-500">{typeLabel(item.sourceType)}</p>
                      </td>
                      <td className="px-4 py-4 align-top"><StateBadge state={item.state} /></td>
                      <td className="px-4 py-4 align-top">
                        <p>Revision {item.revision} · vòng {item.approvalRound ?? "chưa có"}</p>
                        <code className="mt-1 block max-w-[260px] break-all text-[11px] text-slate-500" title={item.contentHash}>SHA-256: {compactHash(item.contentHash)}</code>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600">
                        <p>Gửi: {dateLabel(item.submittedAt)}</p>
                        <p>Duyệt: {dateLabel(item.approvedAt)}</p>
                        <p>Hết hạn: {dateLabel(item.expiresAt)}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <button
                          aria-label={`${active ? "Đang xem" : "Xem"} ${item.title || "nguồn nội dung"}, revision ${item.revision}`}
                          aria-pressed={active}
                          className="min-h-11 rounded-lg border border-teal-700 px-3 font-bold text-teal-900 hover:bg-teal-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          onClick={() => selectItem(item)}
                          type="button"
                        >
                          <UiIcon name="eye" size={16} />
                          <span>{active ? "Đang xem trước" : "Xem trước bài viết"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {selected ? (
        <section aria-labelledby="selected-revision-title" className="grid gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-note">SUBMIT EXACT REVISION</p>
              <h2 className="text-xl font-black text-teal-950" id="selected-revision-title">{selected.title || "Nguồn chưa đặt tên"}</h2>
              <p className="mt-1 text-sm text-slate-700">{typeLabel(selected.sourceType)} · revision {selected.revision}</p>
            </div>
            <StateBadge state={selected.state} />
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="font-bold text-slate-700">Revision</dt><dd className="mt-1 font-mono">{selected.revision}</dd></div>
            <div><dt className="font-bold text-slate-700">Vòng phê duyệt</dt><dd className="mt-1">{selected.approvalRound ?? "Chưa có"}</dd></div>
            <div><dt className="font-bold text-slate-700">Hết hạn</dt><dd className="mt-1">{dateLabel(selected.expiresAt)}</dd></div>
            <div className="sm:col-span-3"><dt className="font-bold text-slate-700">SHA-256 đầy đủ</dt><dd className="mt-1 break-all font-mono text-xs">{selected.contentHash || "Chưa có hash"}</dd></div>
          </dl>
          <p className="text-sm leading-6 text-slate-700">
            Chỉ submit khi trạng thái là bản nháp hoặc cần chỉnh sửa. Nếu nội dung đã submit/approve,
            server sẽ từ chối revision cũ và yêu cầu tải lại inventory.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              aria-describedby="admin-submit-help"
              className="min-h-11 w-fit rounded-lg bg-teal-800 px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitting || !isSubmittable(selected.state)}
              onClick={() => void submitSelected()}
              type="button"
            >
              {submitting ? "Đang gửi…" : "Gửi revision cho bác sĩ"}
            </button>
            <p className="text-xs text-slate-600" id="admin-submit-help">
              {isSubmittable(selected.state) ? "Thao tác này chỉ chuyển revision vào hàng đợi review." : "Revision này không còn ở trạng thái có thể submit."}
            </p>
          </div>
        </section>
      ) : null}

      {/* Article / Content Preview Popup Modal */}
      {previewModalOpen && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            aria-labelledby="preview-modal-title"
            aria-modal="true"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-900">
                    {typeLabel(selected.sourceType)}
                  </span>
                  <StateBadge state={selected.state} />
                  <span className="text-xs text-slate-500 font-medium">Revision {selected.revision}</span>
                </div>
                <h3 className="mt-1.5 text-lg font-black text-teal-950" id="preview-modal-title">
                  Xem trước: {selected.title || "Nguồn chưa đặt tên"}
                </h3>
              </div>
              <button
                aria-label="Đóng xem trước"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                onClick={() => setPreviewModalOpen(false)}
                type="button"
              >
                <UiIcon name="x" size={20} />
              </button>
            </div>

            {/* Modal Body: Article Content Preview */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {previewLoading ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="text-sm">Đang tải nội dung xem trước…</p>
                </div>
              ) : previewArticle ? (
                <div className="space-y-4">
                  {previewArticle.coverImageUrl && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 aspect-video relative max-h-64 w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={previewArticle.title}
                        className="h-full w-full object-cover"
                        src={previewArticle.coverImageUrl}
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {previewArticle.authorName && (
                      <span className="font-semibold text-slate-700">Tác giả: Bác sĩ {previewArticle.authorName}</span>
                    )}
                    {previewArticle.category && (
                      <span>• Chuyên mục: {previewArticle.category}</span>
                    )}
                    {previewArticle.readingMinutes && (
                      <span>• {previewArticle.readingMinutes} phút đọc</span>
                    )}
                  </div>
                  {previewArticle.summary && (
                    <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-sm font-medium text-teal-950 leading-relaxed">
                      {previewArticle.summary}
                    </div>
                  )}
                  {previewArticle.sections && previewArticle.sections.length > 0 ? (
                    <div className="space-y-3">
                      {previewArticle.sections.map((sec, idx) => (
                        <div key={idx} className="space-y-1">
                          {sec.heading && <h4 className="text-sm font-bold text-slate-900">{sec.heading}</h4>}
                          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{sec.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {previewArticle.body || "Nội dung chi tiết đang được cập nhật."}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-bold text-slate-900 text-base">{selected.title}</p>
                    <p className="mt-1 text-xs text-slate-500">Mã định danh nội dung: {selected.sourceId}</p>
                    <p className="mt-2 text-xs font-semibold text-teal-800">Loại nội dung: {typeLabel(selected.sourceType)}</p>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Đây là bản xem trước nội dung chuẩn bị gửi sang hàng đợi xét duyệt lâm sàng của Bác sĩ. Sau khi Bác sĩ thẩm định chuyên môn và phê duyệt, nội dung sẽ được xuất bản chính thức cho bệnh nhân tham khảo.
                  </p>
                </div>
              )}

              {/* Technical Audit Box */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-slate-700 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-teal-950">Thông tin kiểm duyệt (Clinical Audit):</span>
                  <span>Vòng duyệt: {selected.approvalRound ?? "Chưa có"}</span>
                </div>
                <p className="font-mono text-[11px] text-slate-500 break-all">
                  SHA-256: {selected.contentHash || "Chưa có"}
                </p>
                <p className="text-slate-500">
                  Gửi: {dateLabel(selected.submittedAt)} • Duyệt: {dateLabel(selected.approvedAt)} • Hết hạn: {dateLabel(selected.expiresAt)}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/90 px-6 py-4">
              <button
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => setPreviewModalOpen(false)}
                type="button"
              >
                Đóng xem trước
              </button>
              <div className="flex items-center gap-2">
                {isSubmittable(selected.state) ? (
                  <button
                    className="rounded-lg bg-teal-900 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50 transition-colors cursor-pointer"
                    disabled={submitting}
                    onClick={async () => {
                      await submitSelected();
                      setPreviewModalOpen(false);
                    }}
                    type="button"
                  >
                    {submitting ? "Đang gửi…" : "Gửi revision cho bác sĩ duyệt"}
                  </button>
                ) : selected.state === "APPROVED" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-900">
                    <UiIcon name="shield-check" size={15} />
                    Đã duyệt xuất bản cho bệnh nhân xem
                  </span>
                ) : selected.state === "SUBMITTED" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">
                    <UiIcon name="clock" size={15} />
                    Đang chờ Bác sĩ thẩm định chuyên môn
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
