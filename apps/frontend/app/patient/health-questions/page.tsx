"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PortalChrome from "../../../components/PortalChrome";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";
import { ApiError, createPatientHealthQuestion, fetchPatientHealthQuestions, hasRole } from "../../../lib/api-client";
import type { HealthQuestionSummary } from "../../../types/hospital";

const statusLabels: Record<string, string> = {
  PENDING_MODERATION: "Chờ admin lọc",
  AWAITING_DOCTOR: "Đang chờ bác sĩ",
  ANSWER_SUBMITTED: "Đang chờ duyệt độc lập",
  PUBLISHED: "Đã xuất bản",
  REJECTED: "Chưa phù hợp để xuất bản",
  CLOSED: "Đã đóng",
};

function errorStatus(error: unknown) {
  return error instanceof ApiError ? error.status : undefined;
}

export default function PatientHealthQuestionsPage() {
  const session = useAuthSession();
  const [items, setItems] = useState<HealthQuestionSummary[]>([]);
  const [topicSlug, setTopicSlug] = useState("");
  const [question, setQuestion] = useState("");
  const [publicAlias, setPublicAlias] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [createError, setCreateError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        return fetchPatientHealthQuestions();
      })
      .then((value) => {
        if (!cancelled && value) setItems(value);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retry, session]);

  const create = async () => {
    if (creating || !topicSlug.trim() || !question.trim() || !publicAlias.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createPatientHealthQuestion({
        topicSlug: topicSlug.trim().toLowerCase(),
        question: question.trim(),
        publicAlias: publicAlias.trim(),
      });
      setItems((current) => [created, ...current]);
      setTopicSlug("");
      setQuestion("");
    } catch (reason) {
      setCreateError(reason);
    } finally {
      setCreating(false);
    }
  };

  if (!session) return <LoginRequiredState nextPath="/patient/health-questions" />;
  if (!hasRole(session.user, "PATIENT")) return <ForbiddenState title="Không thể mở hỏi đáp" description="Kênh hỏi đáp riêng chỉ dành cho bệnh nhân đã đăng nhập." />;

  return (
    <PortalChrome role="PATIENT" user={session.user}>
      <div className="section-inner portal-page">
        <header className="portal-hero">
          <div>
            <p className="section-note">HỎI ĐÁP SỨC KHỎE</p>
            <h1>Đặt câu hỏi để bệnh viện xem xét</h1>
            <p>Admin sẽ lọc PII và nội dung lạm dụng trước khi chuyển cho bác sĩ. Câu trả lời phải qua một bác sĩ độc lập duyệt và không thay thế thăm khám.</p>
          </div>
          <Link className="outline-button" href="/benh-pho-bien">Xem kho bệnh phổ biến</Link>
        </header>

        <section className="portal-panel grid gap-4" aria-labelledby="health-question-form-title">
          <div>
            <p className="section-note">GỬI CÂU HỎI</p>
            <h2 id="health-question-form-title">Chia sẻ điều bạn đang băn khoăn</h2>
            <p className="portal-panel__intro">Không nhập số điện thoại, email, CCCD hoặc thông tin nhận diện khác. Đây không phải kênh cấp cứu.</p>
          </div>
          <label className="grid gap-1 text-sm font-bold" htmlFor="health-question-topic">Chủ đề (slug ngắn)
            <input id="health-question-topic" className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={180} onChange={(event) => setTopicSlug(event.target.value)} placeholder="ví dụ: noi-tiet" value={topicSlug} />
          </label>
          <label className="grid gap-1 text-sm font-bold" htmlFor="health-question-alias">Tên hiển thị
            <input id="health-question-alias" className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={80} onChange={(event) => setPublicAlias(event.target.value)} placeholder="ví dụ: Người bệnh 01" value={publicAlias} />
          </label>
          <label className="grid gap-1 text-sm font-bold" htmlFor="health-question-body">Câu hỏi
            <textarea id="health-question-body" className="min-h-32 rounded-lg border border-slate-300 p-3" maxLength={4000} onChange={(event) => setQuestion(event.target.value)} placeholder="Mô tả ngắn gọn điều bạn muốn bệnh viện giải thích…" value={question} />
          </label>
          {createError ? <p aria-live="assertive" className="error-banner" role="alert">{createError instanceof ApiError ? createError.message : "Không thể gửi câu hỏi."}</p> : null}
          <button className="button button--primary w-fit" disabled={creating || !topicSlug.trim() || !question.trim() || !publicAlias.trim()} onClick={() => void create()} type="button">{creating ? "Đang gửi…" : "Gửi để kiểm duyệt"}</button>
        </section>

        {loading ? <LoadingState label="Đang tải câu hỏi của bạn…" /> : null}
        {error ? <ErrorState message="Không thể tải lịch sử hỏi đáp." status={errorStatus(error)} onRetry={() => setRetry((value) => value + 1)} /> : null}
        {!loading && !error && items.length === 0 ? <EmptyState title="Bạn chưa gửi câu hỏi" description="Câu hỏi sau khi gửi sẽ hiển thị trạng thái xử lý và câu trả lời tại đây." /> : null}
        <section className="grid gap-4" aria-live="polite" aria-label="Lịch sử câu hỏi">
          {items.map((item) => (
            <article className="portal-panel" key={item.id}>
              <div className="portal-panel__heading">
                <div><p className="section-note">{item.topicSlug} · {statusLabels[item.status] ?? item.status}</p><h2>{item.question}</h2></div>
                <span className="pill">{item.publicAlias}</span>
              </div>
              {item.answer ? <p className="mt-3 text-slate-700">{item.answer}</p> : <p className="mt-3 text-sm text-slate-500">Bác sĩ chưa gửi câu trả lời công khai.</p>}
              <p className="mt-3 text-xs text-slate-500">Gửi ngày {new Date(item.createdAt).toLocaleDateString("vi-VN")}. Nội dung được giữ theo chính sách lưu trữ của bệnh viện.</p>
            </article>
          ))}
        </section>
      </div>
    </PortalChrome>
  );
}
