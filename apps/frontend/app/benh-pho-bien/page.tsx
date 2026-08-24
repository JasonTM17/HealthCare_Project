"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import { useAuthSession } from "../../components/useAuthSession";
import { ApiError, fetchArticles, fetchPublishedHealthQuestions, hasRole, reportPublishedHealthQuestion } from "../../lib/api-client";
import type { Article, HealthQuestionSummary } from "../../types/hospital";

export default function CommonDiseasesPage() {
  const session = useAuthSession();
  const [articles, setArticles] = useState<Article[]>([]);
  const [questions, setQuestions] = useState<HealthQuestionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [reportReason, setReportReason] = useState<Record<string, string>>({});
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => { let cancelled = false; void Promise.resolve().then(() => { if (cancelled) return undefined; setLoading(true); setError(null); return Promise.all([fetchArticles(0, 100, "DISEASE_GUIDE"), fetchPublishedHealthQuestions()]); }).then((value) => { if (!cancelled && value) { const [a, q] = value; setArticles(a.content); setQuestions(q); } }).catch((reason) => { if (!cancelled) setError(reason); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [retry]);
  const filtered = useMemo(() => { const value = query.trim().toLowerCase(); return value ? articles.filter((article) => `${article.title} ${article.summary} ${article.category ?? ""}`.toLowerCase().includes(value)) : articles; }, [articles, query]);
  const report = async (questionId: string) => {
    if (!session || !hasRole(session.user, "PATIENT")) {
      setReportNotice("Hãy đăng nhập bằng tài khoản bệnh nhân để báo cáo nội dung.");
      return;
    }
    setReportingId(questionId);
    setReportNotice("");
    try {
      await reportPublishedHealthQuestion(questionId, reportReason[questionId] ?? "SAFETY_CONCERN");
      setReportNotice("Đã ghi nhận báo cáo. Cảm ơn bạn đã giúp bệnh viện giữ nội dung an toàn.");
    } catch (reason) {
      setReportNotice(reason instanceof ApiError ? reason.message : "Không thể gửi báo cáo lúc này.");
    } finally {
      setReportingId(null);
    }
  };
  return <PublicPageShell><div className="catalog-page section-inner">
    <header className="resource-page__header"><p className="section-note">Kho kiến thức bệnh phổ biến</p><h1>Hiểu đúng để biết khi nào nên đi khám</h1><p>Nội dung tham khảo đã được bệnh viện kiểm duyệt theo quy trình nội bộ. Không thay thế thăm khám hoặc chẩn đoán.</p><div className="resource-actions"><PublicAiButton className="outline-button">Hỏi trợ lý triệu chứng</PublicAiButton><PublicBookingButton>Đặt lịch với bác sĩ</PublicBookingButton></div></header>
    <section className="resource-panel resource-panel--accent"><label htmlFor="disease-search"><span className="section-note">Tìm theo bệnh hoặc chủ đề</span><input id="disease-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ: đau đầu, tiểu đường…" /></label></section>
    {loading ? <p className="catalog-status" role="status">Đang tải nội dung…</p> : null}
    {error ? <div className="catalog-status catalog-status--error" role="alert">Chưa thể tải kho kiến thức. <button className="outline-button outline-button--small" type="button" onClick={() => setRetry((v) => v + 1)}>Thử tải lại</button></div> : null}
    {!loading && !error && filtered.length === 0 ? <p className="catalog-status" role="status">Chưa có bài viết phù hợp. Hãy thử từ khóa khác.</p> : null}
    <div className="catalog-grid catalog-grid--articles">{filtered.map((article) => <article className="catalog-card" key={article.id}><p className="section-note">{article.category ?? "Bệnh phổ biến"} · {article.readingMinutes ?? 5} phút đọc</p><h2>{article.title}</h2><p>{article.summary}</p><Link className="text-button" href={`/benh-pho-bien/${article.slug}`}>Xem hướng dẫn →</Link></article>)}</div>
    {questions.length ? <section className="resource-panel"><p className="section-note">Hỏi đáp đã xuất bản</p><h2>Câu hỏi cộng đồng được bác sĩ duyệt</h2><p className="portal-panel__intro">Bạn có thể báo cáo nội dung không phù hợp. Báo cáo không hiển thị danh tính của người gửi.</p><div className="resource-grid resource-grid--two">{questions.slice(0, 6).map((item) => <article className="catalog-card" key={item.id}><p className="section-note">{item.publicAlias} · {item.topicSlug}</p><h3>{item.question}</h3><p>{item.answer}</p><div className="mt-4 flex flex-wrap items-center gap-2"><label className="sr-only" htmlFor={`report-reason-${item.id}`}>Lý do báo cáo</label><select id={`report-reason-${item.id}`} className="min-h-10 rounded-lg border border-slate-300 px-2 text-sm" value={reportReason[item.id] ?? "SAFETY_CONCERN"} onChange={(event) => setReportReason((current) => ({ ...current, [item.id]: event.target.value }))}><option value="SAFETY_CONCERN">Lo ngại an toàn</option><option value="PII_DETECTED">Có thông tin cá nhân</option><option value="SPAM">Spam/lạm dụng</option><option value="DUPLICATE">Trùng nội dung</option></select><button className="outline-button outline-button--small" disabled={reportingId === item.id} onClick={() => void report(item.id)} type="button">{reportingId === item.id ? "Đang gửi…" : "Báo cáo nội dung"}</button></div></article>)}</div>{reportNotice ? <p aria-live="polite" className="catalog-status" role="status">{reportNotice}</p> : null}</section> : null}
  </div></PublicPageShell>;
}
