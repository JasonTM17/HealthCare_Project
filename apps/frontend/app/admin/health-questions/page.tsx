"use client";

import { useEffect, useState } from "react";
import AdminState from "../_components/AdminState";
import {
  adminDecideHealthQuestionReport,
  adminListHealthQuestionReports,
  adminListHealthQuestions,
  adminModerateHealthQuestion,
  ApiError,
} from "../../../lib/api-client";
import type { HealthQuestionReport, HealthQuestionSummary } from "../../../types/hospital";

const reportReasonLabels: Record<string, string> = {
  PII_DETECTED: "Có thông tin định danh",
  SAFETY_CONCERN: "Lo ngại an toàn",
  OUT_OF_SCOPE: "Ngoài phạm vi",
  DUPLICATE: "Trùng nội dung",
  SPAM: "Spam/lạm dụng",
  LEGAL_REQUEST: "Yêu cầu pháp lý",
};

const reportStatusLabels: Record<string, string> = {
  OPEN: "Mới",
  UNDER_REVIEW: "Đang xem xét",
  RESOLVED: "Đã xử lý",
  DISMISSED: "Không vi phạm",
};

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Chưa rõ thời điểm"
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export default function AdminHealthQuestionsPage() {
  const [items, setItems] = useState<HealthQuestionSummary[]>([]);
  const [reportsByQuestion, setReportsByQuestion] = useState<Record<string, HealthQuestionReport[]>>({});
  const [openReports, setOpenReports] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void adminListHealthQuestions()
      .then((value) => {
        if (!cancelled) setItems(value);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof ApiError ? reason.message : "Không thể tải hàng đợi hỏi đáp.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);

  const moderate = async (id: string, decision: string) => {
    setBusy(id);
    setError("");
    try {
      await adminModerateHealthQuestion(id, decision, decision === "REJECT" ? "OUT_OF_SCOPE" : undefined);
      setItems((current) => current.map((item) =>
        item.id === id
          ? { ...item, status: decision === "APPROVE" ? "AWAITING_DOCTOR" : decision === "REJECT" ? "REJECTED" : "CLOSED" }
          : item,
      ));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Không thể cập nhật kiểm duyệt.");
    } finally {
      setBusy(null);
    }
  };

  const toggleReports = async (questionId: string) => {
    const nextOpen = !openReports[questionId];
    setOpenReports((current) => ({ ...current, [questionId]: nextOpen }));
    if (!nextOpen || reportsByQuestion[questionId]) return;
    setReportBusy(questionId);
    setError("");
    try {
      const reports = await adminListHealthQuestionReports(questionId);
      setReportsByQuestion((current) => ({ ...current, [questionId]: reports }));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Không thể tải báo cáo của câu hỏi.");
    } finally {
      setReportBusy(null);
    }
  };

  const decideReport = async (
    questionId: string,
    report: HealthQuestionReport,
    status: "UNDER_REVIEW" | "RESOLVED" | "DISMISSED",
    resolutionCode?: string,
  ) => {
    setReportBusy(report.id);
    setError("");
    try {
      const updated = await adminDecideHealthQuestionReport(questionId, report.id, status, resolutionCode);
      setReportsByQuestion((current) => ({
        ...current,
        [questionId]: (current[questionId] ?? []).map((item) => item.id === report.id ? updated : item),
      }));
      if (status === "RESOLVED" && resolutionCode === "REMOVED") {
        setItems((current) => current.map((item) => item.id === questionId ? { ...item, status: "CLOSED" } : item));
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Không thể xử lý báo cáo.");
    } finally {
      setReportBusy(null);
    }
  };

  return (
    <main id="main-content" className="mx-auto max-w-6xl p-6 lg:p-10">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Moderation</p>
        <h1 className="mt-2 text-3xl font-black text-teal-950">Hỏi đáp bệnh phổ biến</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Lọc PII và nội dung lạm dụng trước khi chuyển câu hỏi cho bác sĩ. Không xuất bản trực tiếp từ AI.
        </p>
      </header>

      {loading ? <AdminState tone="loading" title="Đang tải hàng đợi" description="Đang đọc trạng thái kiểm duyệt từ backend." /> : null}
      {error ? (
        <AdminState
          tone="error"
          title="Không thể tải hàng đợi"
          description={error}
          action={
            <button
              className="min-h-11 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white"
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                setRetry((value) => value + 1);
              }}
            >
              Thử lại
            </button>
          }
        />
      ) : null}

      <div className="grid gap-4">
        {items.map((item) => {
          const reports = reportsByQuestion[item.id] ?? [];
          const isReportsOpen = openReports[item.id] === true;
          return (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{item.topicSlug} · {item.status}</p>
                  <h2 className="mt-2 text-lg font-bold text-slate-900">{item.question}</h2>
                  <p className="mt-1 text-sm text-slate-500">Hiển thị dưới tên: {item.publicAlias}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {item.status === "PENDING_MODERATION" ? (
                    <>
                      <button className="min-h-11 rounded-lg bg-teal-800 px-3 text-sm font-bold text-white" disabled={busy === item.id} onClick={() => void moderate(item.id, "APPROVE")} type="button">Chuyển bác sĩ</button>
                      <button className="min-h-11 rounded-lg border border-rose-200 px-3 text-sm font-bold text-rose-700" disabled={busy === item.id} onClick={() => void moderate(item.id, "REJECT")} type="button">Từ chối</button>
                    </>
                  ) : null}
                  <button
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700"
                    type="button"
                    aria-expanded={isReportsOpen}
                    onClick={() => void toggleReports(item.id)}
                  >
                    {reportBusy === item.id ? "Đang tải báo cáo…" : isReportsOpen ? "Ẩn báo cáo" : "Xem báo cáo"}
                  </button>
                </div>
              </div>

              {item.answer ? <p className="mt-4 border-t border-slate-100 pt-4 text-slate-700">{item.answer}</p> : null}

              {isReportsOpen ? (
                <section className="mt-5 border-t border-slate-100 pt-4" aria-label="Báo cáo của câu hỏi">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-slate-900">Báo cáo nội dung</h3>
                    <span className="text-xs text-slate-500">{reports.length} báo cáo còn trong thời hạn lưu</span>
                  </div>
                  {reports.length === 0 ? <p className="mt-3 text-sm text-slate-500">Chưa có báo cáo mở.</p> : (
                    <ul className="mt-3 grid gap-3">
                      {reports.map((report) => (
                        <li className="rounded-xl border border-amber-100 bg-amber-50/60 p-3" key={report.id}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="text-sm text-slate-700">
                              <p className="font-semibold">{reportReasonLabels[report.reasonCode] ?? "Lý do khác"} · {reportStatusLabels[report.status] ?? report.status}</p>
                              <p className="mt-1 text-xs text-slate-500">Gửi lúc {formatDate(report.createdAt)}{report.resolutionCode ? ` · ${report.resolutionCode}` : ""}</p>
                            </div>
                            {report.status === "OPEN" || report.status === "UNDER_REVIEW" ? (
                              <div className="flex flex-wrap gap-2">
                                {report.status === "OPEN" ? <button className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700" disabled={reportBusy === report.id} type="button" onClick={() => void decideReport(item.id, report, "UNDER_REVIEW")}>Nhận xử lý</button> : null}
                                <button className="min-h-10 rounded-lg bg-rose-700 px-3 text-xs font-bold text-white" disabled={reportBusy === report.id} type="button" onClick={() => void decideReport(item.id, report, "RESOLVED", "REMOVED")}>Gỡ nội dung</button>
                                <button className="min-h-10 rounded-lg border border-teal-300 bg-white px-3 text-xs font-bold text-teal-800" disabled={reportBusy === report.id} type="button" onClick={() => void decideReport(item.id, report, "DISMISSED", "NO_ACTION")}>Không vi phạm</button>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}
            </article>
          );
        })}
      </div>
    </main>
  );
}
