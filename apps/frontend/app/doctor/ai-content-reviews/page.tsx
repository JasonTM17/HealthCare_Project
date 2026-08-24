"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PortalChrome from "../../../components/PortalChrome";
import { ForbiddenState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";
import {
  ApiError,
  decideDoctorAiContentRevision,
  fetchDoctorAiContentRevision,
  fetchDoctorAiContentReviews,
} from "../../../lib/api-client";
import type {
  AiContentDecision,
  AiContentRevision,
  AiContentReviewSummary,
} from "../../../types/hospital";
import { hasRole } from "../../../lib/api-client";

const DECISIONS: AiContentDecision[] = ["APPROVE", "REQUEST_CHANGES", "REVOKE"];

export default function DoctorAiContentReviewsPage() {
  const session = useAuthSession();
  const [reviews, setReviews] = useState<AiContentReviewSummary[]>([]);
  const [selected, setSelected] = useState<AiContentReviewSummary | null>(null);
  const [revision, setRevision] = useState<AiContentRevision | null>(null);
  const [decision, setDecision] = useState<AiContentDecision>("APPROVE");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [staleRevision, setStaleRevision] = useState(false);
  const reviewsRequestRef = useRef(0);
  const revisionRequestRef = useRef(0);
  const revisionControllerRef = useRef<AbortController | null>(null);

  const loadReviews = useCallback(async (): Promise<void> => {
    const requestId = ++reviewsRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchDoctorAiContentReviews({ state: "SUBMITTED" });
      if (requestId !== reviewsRequestRef.current) return;
      setReviews(page.content);
      setSelected((current) => current
        ? page.content.find((item) => item.sourceId === current.sourceId && item.sourceType === current.sourceType) ?? null
        : null);
    } catch (cause) {
      if (requestId !== reviewsRequestRef.current) return;
      setError(cause instanceof ApiError ? cause.message : "Không thể tải hàng đợi review.");
    } finally {
      if (requestId !== reviewsRequestRef.current) return;
      setLoading(false);
    }
  }, []);

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
    setError(null);
    setStaleRevision(false);
    try {
      const nextRevision = await fetchDoctorAiContentRevision(item.sourceType, item.sourceId, item.revision, { signal: controller.signal });
      if (requestId !== revisionRequestRef.current || controller.signal.aborted) return;
      setRevision(nextRevision);
    } catch (cause) {
      if (controller.signal.aborted || requestId !== revisionRequestRef.current) return;
      setStaleRevision(cause instanceof ApiError && cause.code === "AI_CONTENT_REVISION_STALE");
      setError(cause instanceof ApiError ? cause.message : "Không thể mở revision bất biến.");
    } finally {
      if (revisionControllerRef.current === controller) revisionControllerRef.current = null;
    }
  };

  const reloadAfterStaleRevision = async (): Promise<void> => {
    setStaleRevision(false);
    setRevision(null);
    setSelected(null);
    await loadReviews();
  };

  const submitDecision = async (): Promise<void> => {
    if (!selected || busy || ((decision === "REQUEST_CHANGES" || decision === "REVOKE") && !reason.trim())) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await decideDoctorAiContentRevision(selected.sourceType, selected.sourceId, selected.revision, { decision, reason });
      setNotice("Quyết định đã được ghi vào audit log. Hàng đợi sẽ được tải lại.");
      setSelected(null);
      setRevision(null);
      await loadReviews();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể ghi quyết định review.");
    } finally {
      setBusy(false);
    }
  };

  if (!session) return <main className="portal-entry"><LoginRequiredState nextPath="/doctor/ai-content-reviews" /></main>;
  if (!hasRole(session.user, "DOCTOR")) return <main className="portal-entry"><ForbiddenState title="Không có quyền duyệt nội dung AI" description="Chỉ bác sĩ độc lập với người submit mới có thể approve, yêu cầu chỉnh sửa hoặc revoke." /></main>;

  return (
    <PortalChrome role="DOCTOR" user={session.user}>
      <div className="portal-content grid gap-6">
        <header className="portal-hero">
          <div>
            <p className="section-note">CLINICAL REVIEW</p>
            <h1>Duyệt nguồn AI</h1>
            <p>Xem snapshot bất biến và hash trước khi cho phép nội dung SPECIALTY, ARTICLE hoặc FAQ đi vào chatbot.</p>
          </div>
          <button className="outline-button" disabled={loading} onClick={() => void loadReviews()} type="button">{loading ? "Đang tải..." : "Tải lại hàng đợi"}</button>
        </header>

        {notice ? <p aria-live="polite" className="notice" role="status">{notice}</p> : null}
        {error ? (
          <div aria-live="assertive" className="error-banner" role="alert">
            <span>{error}</span>
            {staleRevision ? <button className="outline-button outline-button--small" onClick={() => void reloadAfterStaleRevision()} type="button">Tải lại revision</button> : null}
          </div>
        ) : null}

        <section aria-label="Hàng đợi nội dung chờ duyệt" className="grid gap-3">
          {reviews.length === 0 && !loading ? <p className="portal-empty-state">Không có revision SUBMITTED đang chờ.</p> : null}
          {reviews.map((item) => (
            <button className={selected?.sourceId === item.sourceId && selected.sourceType === item.sourceType ? "portal-card portal-card--active text-left" : "portal-card text-left"} key={`${item.sourceType}-${item.sourceId}-${item.revision}`} onClick={() => void openRevision(item)} type="button">
              <span className="flex flex-wrap items-center justify-between gap-2"><strong>{item.title}</strong><span className="pill">{item.state}</span></span>
              <span className="mt-2 block text-xs text-slate-600">{item.sourceType} · revision {item.revision} · {item.contentHash}</span>
            </button>
          ))}
        </section>

        {selected && revision ? (
          <section aria-labelledby="review-detail-title" className="portal-card grid gap-4">
            <div>
              <h2 id="review-detail-title">Snapshot revision {revision.revision}</h2>
              <p className="text-sm text-slate-600">Hash: <code>{revision.contentHash}</code>. Nếu stale, tải lại thay vì approve dữ liệu cũ.</p>
            </div>
            <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-teal-100">{JSON.stringify(revision.snapshot, null, 2)}</pre>
            {revision.diff && Object.keys(revision.diff).length > 0 ? (
              <details className="rounded-lg border border-amber-200 bg-amber-50 p-4" open>
                <summary className="cursor-pointer font-bold text-teal-950">Thay đổi so với revision trước</summary>
                <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-white p-3 text-xs text-slate-800">{JSON.stringify(revision.diff, null, 2)}</pre>
              </details>
            ) : <p className="text-sm text-slate-600">Không có diff được cung cấp cho revision này.</p>}
            <label className="grid gap-1 text-sm font-bold">Quyết định
              <select className="min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => setDecision(event.target.value as AiContentDecision)} value={decision}>
                {DECISIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            {decision !== "APPROVE" ? <label className="grid gap-1 text-sm font-bold">Lý do bắt buộc<textarea className="min-h-24 rounded-lg border border-slate-300 p-3" onChange={(event) => setReason(event.target.value)} value={reason} /></label> : null}
            <button className="min-h-11 w-fit rounded-lg bg-teal-800 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={busy || ((decision !== "APPROVE") && !reason.trim())} onClick={() => void submitDecision()} type="button">{busy ? "Đang ghi..." : "Ghi quyết định"}</button>
          </section>
        ) : null}
      </div>
    </PortalChrome>
  );
}
