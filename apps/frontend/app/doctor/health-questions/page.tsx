"use client";

import { useCallback, useEffect, useState } from "react";
import PortalChrome from "../../../components/PortalChrome";
import { ForbiddenState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";
import {
  ApiError,
  doctorAnswerHealthQuestion,
  doctorDecideHealthQuestion,
  doctorListHealthQuestions,
  hasRole,
} from "../../../lib/api-client";
import type { HealthQuestionSummary } from "../../../types/hospital";

type Decision = "APPROVE" | "REQUEST_CHANGES" | "REVOKE";

function statusLabel(status: string): string {
  return {
    AWAITING_DOCTOR: "Chờ bác sĩ trả lời",
    ANSWER_SUBMITTED: "Chờ bác sĩ độc lập duyệt",
    CHANGES_REQUESTED: "Cần chỉnh sửa",
  }[status] ?? status;
}

export default function DoctorHealthQuestionsPage() {
  const session = useAuthSession();
  const [items, setItems] = useState<HealthQuestionSummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const next = await doctorListHealthQuestions();
      setItems(next);
      setDrafts((current) => Object.fromEntries(next.map((item) => [item.id, current[item.id] ?? ""])));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tải hàng đợi hỏi đáp.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR")) return;
    let cancelled = false;
    void Promise.resolve().then(() => load()).catch(() => undefined).finally(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, [load, reloadToken, session]);

  const run = async (id: string, operation: () => Promise<void>, success: string): Promise<void> => {
    if (busy) return;
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      await operation();
      setNotice(success);
      setReloadToken((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể cập nhật câu hỏi.");
    } finally {
      setBusy(null);
    }
  };

  const answer = (item: HealthQuestionSummary): void => {
    const value = drafts[item.id]?.trim() ?? "";
    if (!value) return;
    void run(item.id, () => doctorAnswerHealthQuestion(item.id, value), "Đã gửi câu trả lời. Cần một bác sĩ khác duyệt trước khi xuất bản.");
  };

  const decide = (item: HealthQuestionSummary, decision: Decision): void => {
    const reason = reasons[item.id]?.trim() ?? "";
    if (decision !== "APPROVE" && !reason) return;
    void run(item.id, () => doctorDecideHealthQuestion(item.id, decision, reason || undefined), "Quyết định đã được ghi vào audit log.");
  };

  if (!session) return <main className="portal-entry"><LoginRequiredState nextPath="/doctor/health-questions" /></main>;
  if (!hasRole(session.user, "DOCTOR")) return <main className="portal-entry"><ForbiddenState title="Không có quyền xử lý hỏi đáp" description="Chỉ bác sĩ đang hoạt động mới được trả lời hoặc duyệt câu hỏi sức khỏe." /></main>;

  return (
    <PortalChrome role="DOCTOR" user={session.user}>
      <div className="portal-content grid gap-6">
        <header className="portal-hero">
          <div>
            <p className="section-note">PATIENT Q&amp;A</p>
            <h1>Hỏi đáp bệnh phổ biến</h1>
            <p>Câu hỏi đã qua ADMIN lọc PII. Trả lời là một revision bất biến; bác sĩ khác phải duyệt độc lập trước khi xuất bản.</p>
          </div>
          <button className="outline-button" disabled={loading} onClick={() => setReloadToken((value) => value + 1)} type="button">
            {loading ? "Đang tải..." : "Tải lại hàng đợi"}
          </button>
        </header>

        {notice ? <p aria-live="polite" className="notice" role="status">{notice}</p> : null}
        {error ? <div aria-live="assertive" className="error-banner" role="alert"><span>{error}</span><button className="outline-button outline-button--small" onClick={() => setReloadToken((value) => value + 1)} type="button">Thử lại</button></div> : null}
        {items.length === 0 && !loading && !error ? <p className="portal-empty-state">Hiện không có câu hỏi chờ xử lý.</p> : null}

        <section aria-label="Hàng đợi hỏi đáp" className="grid gap-4">
          {items.map((item) => {
            const isAnswerable = item.status === "AWAITING_DOCTOR";
            const isReviewable = item.status === "ANSWER_SUBMITTED" && Boolean(item.answer);
            return (
              <article className="portal-card grid gap-4" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="section-note">{item.topicSlug} · {statusLabel(item.status)}</p>
                    <h2 className="mt-2 text-xl font-bold text-teal-950">{item.question}</h2>
                    <p className="mt-1 text-sm text-slate-600">Hiển thị công khai dưới tên: {item.publicAlias}</p>
                  </div>
                  <span className="pill">{item.status}</span>
                </div>

                {isAnswerable ? (
                  <div className="grid gap-2">
                    <label className="grid gap-1 text-sm font-bold" htmlFor={`answer-${item.id}`}>Câu trả lời (tối đa 4.000 ký tự)</label>
                    <textarea id={`answer-${item.id}`} className="min-h-32 rounded-lg border border-slate-300 p-3" maxLength={4000} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} value={drafts[item.id] ?? ""} />
                    <button className="min-h-11 w-fit rounded-lg bg-teal-800 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={busy === item.id || !(drafts[item.id] ?? "").trim()} onClick={() => answer(item)} type="button">{busy === item.id ? "Đang gửi..." : "Gửi revision"}</button>
                  </div>
                ) : null}

                {isReviewable ? (
                  <div className="grid gap-3 border-t border-slate-200 pt-4">
                    <div className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700"><strong>Bản trả lời:</strong><p className="mt-2 whitespace-pre-wrap">{item.answer}</p></div>
                    <label className="grid gap-1 text-sm font-bold" htmlFor={`reason-${item.id}`}>Lý do nếu yêu cầu sửa hoặc revoke</label>
                    <textarea id={`reason-${item.id}`} className="min-h-20 rounded-lg border border-slate-300 p-3" maxLength={32} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} value={reasons[item.id] ?? ""} />
                    <div className="flex flex-wrap gap-2">
                      <button className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={busy === item.id} onClick={() => decide(item, "APPROVE")} type="button">Duyệt xuất bản</button>
                      <button className="min-h-11 rounded-lg border border-amber-300 px-4 text-sm font-bold text-amber-800 disabled:opacity-50" disabled={busy === item.id || !(reasons[item.id] ?? "").trim()} onClick={() => decide(item, "REQUEST_CHANGES")} type="button">Yêu cầu sửa</button>
                      <button className="min-h-11 rounded-lg border border-rose-300 px-4 text-sm font-bold text-rose-700 disabled:opacity-50" disabled={busy === item.id || !(reasons[item.id] ?? "").trim()} onClick={() => decide(item, "REVOKE")} type="button">Revoke</button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </PortalChrome>
  );
}
