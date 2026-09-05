"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PortalChrome from "../../../components/PortalChrome";
import { ForbiddenState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";
import UiIcon from "../../../components/UiIcon";
import {
  ApiError,
  decideDoctorAiContentRevision,
  fetchDoctorAiContentRevision,
  fetchDoctorAiContentReviews,
  hasRole,
} from "../../../lib/api-client";
import { presentApiError } from "../../../lib/present-api-error";
import type {
  AiContentDecision,
  AiContentRevision,
  AiContentReviewState,
  AiContentReviewSummary,
  AiContentType,
} from "../../../types/hospital";

const DECISIONS: AiContentDecision[] = ["APPROVE", "REQUEST_CHANGES", "REVOKE"];
const QUEUE_STATES: AiContentReviewState[] = ["SUBMITTED", "APPROVED", "CHANGES_REQUESTED", "REVOKED", "EXPIRED"];

const TYPE_LABELS: Record<AiContentType, string> = {
  SPECIALTY: "Chuyên khoa",
  ARTICLE: "Bài viết",
  FAQ: "Câu hỏi thường gặp",
};

const STATE_LABELS: Record<AiContentReviewState, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Chờ bác sĩ duyệt",
  APPROVED: "Đã duyệt",
  CHANGES_REQUESTED: "Yêu cầu chỉnh sửa",
  REVOKED: "Đã thu hồi",
  EXPIRED: "Đã hết hạn",
};

const DECISION_LABELS: Record<AiContentDecision, string> = {
  APPROVE: "Duyệt nội dung",
  REQUEST_CHANGES: "Yêu cầu chỉnh sửa",
  REVOKE: "Thu hồi phê duyệt",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Tiêu đề",
  name: "Tên hiển thị",
  slug: "Đường dẫn",
  summary: "Tóm tắt",
  description: "Mô tả",
  content: "Nội dung",
  body: "Nội dung bài",
  sections: "Các mục nội dung",
  category: "Danh mục",
  tags: "Thẻ",
  relatedSpecialtySlug: "Chuyên khoa liên quan",
  related_specialty_slug: "Chuyên khoa liên quan",
  symptoms: "Triệu chứng thường gặp",
  commonSymptoms: "Triệu chứng thường gặp",
  preparationSteps: "Hướng dẫn chuẩn bị",
  carePathway: "Lộ trình chăm sóc",
  redFlags: "Dấu hiệu cảnh báo",
  published: "Trạng thái xuất bản",
  publishedAt: "Thời điểm xuất bản",
  readingMinutes: "Thời gian đọc",
  authorName: "Tác giả",
  coverImageUrl: "Ảnh bìa",
};

type DiffValue = { before: unknown; after: unknown };

function typeLabel(type: AiContentType): string {
  return TYPE_LABELS[type] ?? "Nguồn nội dung";
}

function stateLabel(state: AiContentReviewState): string {
  return STATE_LABELS[state] ?? "Trạng thái nội dung";
}

function decisionLabel(decision: AiContentDecision): string {
  return DECISION_LABELS[decision] ?? "Quyết định";
}

function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

function compactHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 12)}…${hash.slice(-4)}` : hash;
}

function stateTone(state: AiContentReviewState): string {
  if (state === "APPROVED") return "bg-emerald-100 text-emerald-900";
  if (state === "SUBMITTED") return "bg-amber-100 text-amber-900";
  if (state === "CHANGES_REQUESTED") return "bg-orange-100 text-orange-900";
  if (state === "REVOKED" || state === "EXPIRED") return "bg-slate-200 text-slate-700";
  return "bg-teal-100 text-teal-900";
}

function formatDate(value?: string | null): string {
  if (!value) return "Chưa có";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function valueText(value: unknown): string {
  if (value === null || typeof value === "undefined") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Không thể hiển thị giá trị";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function diffValue(value: unknown): DiffValue {
  if (isRecord(value)) {
    if ("before" in value || "after" in value) return { before: value.before, after: value.after };
    if ("old" in value || "new" in value) return { before: value.old, after: value.new };
    if ("previous" in value || "current" in value) return { before: value.previous, after: value.current };
    if ("from" in value || "to" in value) return { before: value.from, after: value.to };
  }
  return { before: undefined, after: value };
}

function SnapshotField({ name, value }: { name: string; value: unknown }) {
  const text = valueText(value);
  const multiline = text.includes("\n") || text.length > 180;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{fieldLabel(name)}</dt>
      <dd className={multiline ? "mt-2 whitespace-pre-wrap break-words text-sm text-slate-800" : "mt-1 break-words text-sm text-slate-800"}>{text}</dd>
    </div>
  );
}

function DiffField({ name, value }: { name: string; value: unknown }) {
  const { before, after } = diffValue(value);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <h3 className="text-sm font-bold text-teal-950">{fieldLabel(name)}</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-red-200 bg-red-50 p-2">
          <p className="text-xs font-bold text-red-800">Trước thay đổi</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{valueText(before)}</p>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
          <p className="text-xs font-bold text-emerald-800">Sau thay đổi</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{valueText(after)}</p>
        </div>
      </div>
    </div>
  );
}

function ReviewStateBadge({ state }: { state: AiContentReviewState }) {
  return <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ${stateTone(state)}`} aria-label={`Trạng thái: ${stateLabel(state)}`}>{stateLabel(state)}</span>;
}

export default function DoctorAiContentReviewsPage() {
  const session = useAuthSession();
  const [reviews, setReviews] = useState<AiContentReviewSummary[]>([]);
  const [selected, setSelected] = useState<AiContentReviewSummary | null>(null);
  const [revision, setRevision] = useState<AiContentRevision | null>(null);
  const [queueState, setQueueState] = useState<AiContentReviewState>("SUBMITTED");
  const [decision, setDecision] = useState<AiContentDecision>("APPROVE");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [staleRevision, setStaleRevision] = useState(false);
  const reviewsRequestRef = useRef(0);
  const revisionRequestRef = useRef(0);
  const revisionControllerRef = useRef<AbortController | null>(null);

  const loadReviews = useCallback(async (requestedState: AiContentReviewState = queueState): Promise<void> => {
    const requestId = ++reviewsRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchDoctorAiContentReviews({ state: requestedState });
      if (requestId !== reviewsRequestRef.current) return;
      setReviews(page.content);
      setSelected((current) => {
        if (!current) return null;
        const refreshed = page.content.find((item) => item.sourceId === current.sourceId && item.sourceType === current.sourceType);
        if (!refreshed || refreshed.revision !== current.revision) return null;
        return refreshed;
      });
    } catch (cause) {
      if (requestId !== reviewsRequestRef.current) return;
      setError(presentApiError(
        cause instanceof ApiError ? cause.code : null,
        cause instanceof ApiError ? cause.status : undefined,
      ));
    } finally {
      if (requestId !== reviewsRequestRef.current) return;
      setLoading(false);
    }
  }, [queueState]);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR")) return;
    const frame = window.requestAnimationFrame(() => void loadReviews());
    return () => {
      window.cancelAnimationFrame(frame);
      reviewsRequestRef.current += 1;
      revisionRequestRef.current += 1;
      revisionControllerRef.current?.abort();
    };
  }, [loadReviews, session]);

  const openRevision = async (item: AiContentReviewSummary): Promise<void> => {
    const requestId = ++revisionRequestRef.current;
    revisionControllerRef.current?.abort();
    const controller = new AbortController();
    revisionControllerRef.current = controller;
    setSelected(item);
    setRevision(null);
    setRevisionLoading(true);
    setReason("");
    setDecision(item.state === "APPROVED" ? "REVOKE" : "APPROVE");
    setError(null);
    setNotice(null);
    setStaleRevision(false);
    try {
      const nextRevision = await fetchDoctorAiContentRevision(item.sourceType, item.sourceId, item.revision, { signal: controller.signal });
      if (requestId !== revisionRequestRef.current || controller.signal.aborted) return;
      setRevision(nextRevision);
      setDecision(nextRevision.state === "APPROVED" ? "REVOKE" : "APPROVE");
    } catch (cause) {
      if (controller.signal.aborted || requestId !== revisionRequestRef.current) return;
      setStaleRevision(cause instanceof ApiError && cause.code === "AI_CONTENT_REVISION_STALE");
      setError(presentApiError(
        cause instanceof ApiError ? cause.code : null,
        cause instanceof ApiError ? cause.status : undefined,
      ));
    } finally {
      if (revisionControllerRef.current === controller) revisionControllerRef.current = null;
      if (requestId === revisionRequestRef.current) setRevisionLoading(false);
    }
  };

  const reloadAfterStaleRevision = async (): Promise<void> => {
    setStaleRevision(false);
    setRevision(null);
    setRevisionLoading(false);
    setSelected(null);
    setNotice(null);
    await loadReviews();
  };

  const submitDecision = async (): Promise<void> => {
    if (!selected || !revision || busy || selected.revision !== revision.revision) return;
    const decisionAllowed = revision.state === "SUBMITTED"
      ? decision === "APPROVE" || decision === "REQUEST_CHANGES"
      : revision.state === "APPROVED" && decision === "REVOKE";
    if (!decisionAllowed) return;
    if ((decision === "REQUEST_CHANGES" || decision === "REVOKE") && !reason.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await decideDoctorAiContentRevision(selected.sourceType, selected.sourceId, selected.revision, { decision, reason });
      setNotice("Quyết định đã được ghi vào audit log. Hàng đợi sẽ được tải lại.");
      setSelected(null);
      setRevision(null);
      setRevisionLoading(false);
      await loadReviews();
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "AI_CONTENT_REVISION_STALE") setStaleRevision(true);
      setError(presentApiError(
        cause instanceof ApiError ? cause.code : null,
        cause instanceof ApiError ? cause.status : undefined,
      ));
    } finally {
      setBusy(false);
    }
  };

  const snapshotEntries = useMemo(() => Object.entries(revision?.snapshot ?? {}), [revision]);
  const diffEntries = useMemo(() => Object.entries(revision ? (revision.diff ?? {}) : {}), [revision]);
  const availableDecisions = revision?.state === "SUBMITTED"
    ? DECISIONS.filter((item) => item !== "REVOKE")
    : revision?.state === "APPROVED"
      ? ["REVOKE" as AiContentDecision]
      : [];
  const canDecide = Boolean(selected && revision && selected.revision === revision.revision && availableDecisions.includes(decision) && !staleRevision);

  if (!session) return <main className="portal-entry"><LoginRequiredState nextPath="/doctor/ai-content-reviews" /></main>;
  if (!hasRole(session.user, "DOCTOR")) return <main className="portal-entry"><ForbiddenState title="Không có quyền duyệt nội dung AI" description="Chỉ bác sĩ độc lập với người submit mới có thể approve, yêu cầu chỉnh sửa hoặc revoke." /></main>;

  return (
    <PortalChrome role="DOCTOR" user={session.user}>
      <div className="portal-content grid gap-6">
        <header className="portal-hero">
          <div>
            <p className="section-note">CLINICAL REVIEW</p>
            <h1>Duyệt nguồn AI</h1>
            <p>Xem snapshot bất biến và hash trước khi cho phép nội dung {typeLabel("ARTICLE")}, {typeLabel("SPECIALTY")} hoặc {typeLabel("FAQ")} đi vào chatbot.</p>
          </div>
          <button aria-label="Tải lại hàng đợi duyệt" className="outline-button min-h-11" disabled={loading} onClick={() => void loadReviews()} type="button">{loading ? "Đang tải…" : "Tải lại hàng đợi"}</button>
        </header>

        {notice ? <p aria-live="polite" className="notice" role="status">{notice}</p> : null}
        {error ? (
          <div aria-live="assertive" className="error-banner" role="alert">
            <span>{error}</span>
            {staleRevision ? <button className="outline-button outline-button--small min-h-11" onClick={() => void reloadAfterStaleRevision()} type="button">Tải lại revision</button> : null}
          </div>
        ) : null}

        <section aria-busy={loading} aria-labelledby="review-queue-title" className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="review-queue-title">Hàng đợi độc lập</h2>
              <p className="text-sm text-slate-600">Chỉ revision đã được ADMIN submit mới xuất hiện; lịch sử đã duyệt chỉ để kiểm tra và thu hồi. Không hiển thị danh tính bệnh nhân.</p>
            </div>
            <span className="text-sm text-slate-600" aria-live="polite">{loading ? "Đang đồng bộ…" : `${reviews.length} nội dung · ${stateLabel(queueState)}`}</span>
          </div>
          <div className="grid gap-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-teal-950">
              Trạng thái hàng đợi xét duyệt
            </span>
            <div className="flex flex-wrap gap-2">
              {QUEUE_STATES.map((state) => {
                const isSelected = queueState === state;
                return (
                  <button
                    key={state}
                    type="button"
                    onClick={() => {
                      setQueueState(state);
                      setSelected(null);
                      setRevision(null);
                      setRevisionLoading(false);
                    }}
                    className={`min-h-11 px-4 py-2 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-teal-900 text-white shadow-sm ring-2 ring-teal-700/30"
                        : "bg-white text-slate-700 border border-slate-200 hover:border-teal-500 hover:bg-slate-50"
                    }`}
                  >
                    <UiIcon name={state === "APPROVED" ? "shield-check" : "clock"} size={14} />
                    <span>{stateLabel(state)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {reviews.length === 0 && !loading ? <div className="portal-empty-state grid gap-2" role="status"><p>Không có nội dung ở trạng thái {stateLabel(queueState).toLowerCase()}.</p><button className="outline-button outline-button--small min-h-11 w-fit" onClick={() => void loadReviews()} type="button">Tải lại hàng đợi</button></div> : null}
          {loading && reviews.length === 0 ? <p className="portal-empty-state" role="status" aria-live="polite">Đang tải hàng đợi…</p> : null}
          {reviews.map((item) => {
            const active = selected?.sourceId === item.sourceId && selected.sourceType === item.sourceType;
            return (
              <button aria-label={`${active ? "Đang xem" : "Mở"} ${item.title || "nguồn nội dung"}, revision ${item.revision}`} aria-pressed={active} className={active ? "portal-card portal-card--active min-h-11 text-left" : "portal-card min-h-11 text-left"} key={`${item.sourceType}-${item.sourceId}-${item.revision}`} onClick={() => void openRevision(item)} type="button">
                <span className="flex flex-wrap items-center justify-between gap-2"><strong>{item.title || "Nguồn chưa đặt tên"}</strong><ReviewStateBadge state={item.state} /></span>
                <span className="mt-2 block text-sm text-slate-700">{typeLabel(item.sourceType)} · Revision {item.revision}</span>
                <span className="mt-1 block text-xs text-slate-500" title={item.contentHash}>Hash nội dung: {compactHash(item.contentHash)}</span>
                <span className="mt-1 block text-xs text-slate-500">Gửi: {formatDate(item.submittedAt)} · Hết hạn: {formatDate(item.expiresAt)}</span>
              </button>
            );
          })}
        </section>

        {selected && !revision && revisionLoading ? (
          <section aria-live="polite" aria-labelledby="review-detail-loading-title" className="portal-card grid gap-2" role="status">
            <h2 className="text-lg font-black text-teal-950" id="review-detail-loading-title">Đang mở snapshot revision {selected.revision}…</h2>
            <p className="text-sm text-slate-600">Đang xác minh hash và trạng thái mới nhất trước khi hiển thị nội dung.</p>
          </section>
        ) : null}

        {selected && revision ? (
          <section aria-labelledby="review-detail-title" className="portal-card grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="section-note">{typeLabel(revision.sourceType)}</p>
                <h2 id="review-detail-title">Snapshot revision {revision.revision}</h2>
                <p className="text-sm text-slate-600">Hash: <code title={revision.contentHash}>{compactHash(revision.contentHash)}</code>. Nếu stale, tải lại thay vì approve dữ liệu cũ.</p>
              </div>
              <ReviewStateBadge state={revision.state} />
            </div>
            <dl aria-label="Thông tin revision" className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold text-slate-500">Revision</dt><dd className="mt-1 font-semibold">{revision.revision}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold text-slate-500">Approval</dt><dd className="mt-1 font-semibold">{revision.approvalId ? "Đã có mã phê duyệt" : "Chưa phê duyệt"}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold text-slate-500">Hết hạn</dt><dd className="mt-1 font-semibold">{formatDate(revision.expiresAt)}</dd></div>
            </dl>

            <div>
              <h3 className="text-base font-bold text-teal-950">Nội dung đang xét</h3>
              {snapshotEntries.length > 0 ? <dl className="mt-3 grid gap-3 md:grid-cols-2">{snapshotEntries.map(([name, value]) => <SnapshotField key={name} name={name} value={value} />)}</dl> : <p className="mt-2 text-sm text-slate-600">Snapshot không có trường hiển thị.</p>}
            </div>

            <div>
              <h3 className="text-base font-bold text-teal-950">Thay đổi theo từng trường</h3>
              {diffEntries.length > 0 ? <div className="mt-3 grid gap-3">{diffEntries.map(([name, value]) => <DiffField key={name} name={name} value={value} />)}</div> : <p className="mt-2 text-sm text-slate-600">Không có diff được cung cấp cho revision này.</p>}
            </div>

            <div className="grid gap-3 border-t border-slate-200 pt-4">
              {!availableDecisions.length ? <p className="text-sm text-slate-600">Revision này chỉ được xem lại; không còn thao tác duyệt hoặc thu hồi hợp lệ.</p> : null}
              {availableDecisions.length ? <>
              <label className="grid gap-1 text-sm font-bold" htmlFor="review-decision">Quyết định</label>
              <select aria-describedby="review-decision-help" className="min-h-11 max-w-md rounded-lg border border-slate-300 px-3" disabled={!canDecide || busy} id="review-decision" onChange={(event) => setDecision(event.target.value as AiContentDecision)} value={decision}>
                {availableDecisions.map((item) => <option key={item} value={item}>{decisionLabel(item)}</option>)}
              </select>
              <p className="text-xs text-slate-600" id="review-decision-help">Yêu cầu chỉnh sửa hoặc thu hồi phải có lý do để lưu audit.</p>
              {decision !== "APPROVE" ? <label className="grid max-w-2xl gap-1 text-sm font-bold" htmlFor="review-reason">Lý do bắt buộc<textarea aria-describedby="review-reason-help" className="min-h-24 rounded-lg border border-slate-300 p-3" disabled={!canDecide || busy} id="review-reason" maxLength={1000} onChange={(event) => setReason(event.target.value)} value={reason} /></label> : null}
              {decision !== "APPROVE" ? <p className="text-xs text-slate-600" id="review-reason-help">Không đưa thông tin bệnh nhân hoặc dữ liệu nhạy cảm vào lý do.</p> : null}
              <button aria-describedby="review-submit-help" className="min-h-11 w-fit rounded-lg bg-teal-800 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canDecide || busy || ((decision !== "APPROVE") && !reason.trim())} onClick={() => void submitDecision()} type="button">{busy ? "Đang ghi…" : "Ghi quyết định"}</button>
              <p className={canDecide ? "sr-only" : "text-sm text-amber-800"} id="review-submit-help">{canDecide ? "Ghi quyết định cho revision đang chờ duyệt." : "Revision này đã thay đổi hoặc không còn ở trạng thái chờ duyệt. Hãy tải lại hàng đợi."}</p>
              </> : null}
            </div>
          </section>
        ) : null}
      </div>
    </PortalChrome>
  );
}
