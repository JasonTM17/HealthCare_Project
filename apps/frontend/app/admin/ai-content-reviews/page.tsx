"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  fetchAdminAiContentReviews,
  submitAiContentRevision,
} from "../../../lib/api-client";
import { presentApiError } from "../../../lib/present-api-error";
import type {
  AiContentReviewState,
  AiContentReviewSummary,
  AiContentType,
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
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${stateTone(state)}`}
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
  };

  const selectItem = (item: AiContentReviewSummary): void => {
    setSelected(item);
    setNotice(null);
    setError(null);
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
            <span className="rounded-full bg-teal-50 px-3 py-1.5">{summary.total} revision hiển thị</span>
            <span className="rounded-full bg-amber-50 px-3 py-1.5">{summary.needsSubmit} cần gửi</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">{summary.submitted} chờ duyệt · {summary.approved} đã duyệt</span>
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
                          className="min-h-11 rounded-lg border border-teal-700 px-3 font-bold text-teal-900 hover:bg-teal-50"
                          onClick={() => selectItem(item)}
                          type="button"
                        >
                          {active ? "Đang xem" : "Xem revision"}
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
    </section>
  );
}
