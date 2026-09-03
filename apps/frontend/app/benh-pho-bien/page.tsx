"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CatalogPagination from "../../components/CatalogPagination";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import { useAuthSession } from "../../components/useAuthSession";
import {
  ApiError,
  fetchAllContent,
  fetchArticles,
  fetchPublishedHealthQuestions,
  hasRole,
  reportPublishedHealthQuestion,
  type Page,
} from "../../lib/api-client";
import { formatBusinessDate } from "../../lib/business-time";
import { presentApiError } from "../../lib/present-api-error";
import type { Article, HealthQuestionSummary } from "../../types/hospital";

const ARTICLE_PAGE_SIZE = 9;
const QUESTION_PAGE_SIZE = 4;

const CATEGORY_LABELS: Record<string, string> = {
  CARDIOLOGY: "Tim mạch",
  DERMATOLOGY: "Da liễu",
  ENDOCRINOLOGY: "Nội tiết",
  GASTROENTEROLOGY: "Tiêu hóa",
  GENERAL: "Sức khỏe tổng quát",
  GYNECOLOGY: "Sản phụ khoa",
  NEUROLOGY: "Thần kinh",
  ONCOLOGY: "Ung bướu",
  PEDIATRICS: "Nhi khoa",
  RESPIRATORY: "Hô hấp",
  UROLOGY: "Tiết niệu",
};

const TOPIC_LABELS: Record<string, string> = {
  ANXIETY: "Lo âu và giấc ngủ",
  BLOOD_PRESSURE: "Huyết áp",
  DIABETES: "Đái tháo đường",
  FEVER: "Sốt",
  HEADACHE: "Đau đầu",
  NUTRITION: "Dinh dưỡng",
  RESPIRATORY: "Hô hấp",
  SKIN: "Da liễu",
};

function safeErrorCopy(reason: unknown): string {
  return presentApiError(
    reason instanceof ApiError ? reason.code : undefined,
    reason instanceof ApiError ? reason.status : undefined,
  );
}

function labelForToken(value: string | null | undefined, labels: Record<string, string>, fallback: string): string {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized && labels[normalized] ? labels[normalized] : fallback;
}

function articleCategory(article: Article): string {
  return labelForToken(article.category, CATEGORY_LABELS, "Bệnh phổ biến");
}

function topicLabel(topic: string): string {
  return labelForToken(topic, TOPIC_LABELS, "Chủ đề sức khỏe");
}

function pageFromItems<T>(items: T[], page: number, size: number): Page<T> {
  const totalElements = items.length;
  const totalPages = totalElements ? Math.ceil(totalElements / size) : 0;
  const safePage = totalPages ? Math.min(page, totalPages - 1) : 0;
  const start = safePage * size;
  return {
    content: items.slice(start, start + size),
    totalElements,
    totalPages,
    size,
    number: safePage,
    first: safePage === 0,
    last: totalPages === 0 || safePage >= totalPages - 1,
    empty: totalElements === 0,
  };
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("vi-VN");
}

export default function CommonDiseasesPage() {
  const session = useAuthSession();
  const [articles, setArticles] = useState<Article[]>([]);
  const [questions, setQuestions] = useState<HealthQuestionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [articlePageNumber, setArticlePageNumber] = useState(0);
  const [questionPageNumber, setQuestionPageNumber] = useState(0);
  const [reportReason, setReportReason] = useState<Record<string, string>>({});
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState("");
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [articlesError, setArticlesError] = useState<string | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [articlesRetry, setArticlesRetry] = useState(0);
  const [questionsRetry, setQuestionsRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setArticlesLoading(true);
        setArticlesError(null);
        return fetchAllContent(
          (page, size) => fetchArticles(page, size, "DISEASE_GUIDE"),
          100,
        );
      })
      .then((items) => {
        if (!cancelled && items) {
          // Clinical trust surfaces are fail-closed: legacy/general articles
          // without an explicit kind never appear in the disease hub.
          setArticles(items.filter((item) => item.contentKind === "DISEASE_GUIDE"));
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setArticlesError(safeErrorCopy(reason));
      })
      .finally(() => {
        if (!cancelled) setArticlesLoading(false);
      });
    void task;
    return () => {
      cancelled = true;
    };
  }, [articlesRetry]);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setQuestionsLoading(true);
        setQuestionsError(null);
        return fetchPublishedHealthQuestions();
      })
      .then((items) => {
        if (!cancelled && items) setQuestions(items);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setQuestionsError(safeErrorCopy(reason));
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });
    void task;
    return () => {
      cancelled = true;
    };
  }, [questionsRetry]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    return articles
      .map((article) => article.category?.trim() ?? "")
      .filter((value) => value.length > 0)
      .filter((value) => {
        const normalized = value.toUpperCase();
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
  }, [articles]);

  const normalizedQuery = normalizeSearch(query);
  const hasActiveFilters = normalizedQuery.length > 0 || category !== "ALL";
  const filteredArticles = useMemo(() => articles.filter((article) => {
    const categoryMatches = category === "ALL" || (article.category?.trim().toUpperCase() ?? "") === category;
    if (!categoryMatches) return false;
    if (!normalizedQuery) return true;
    return normalizeSearch(`${article.title} ${article.summary} ${article.category ?? ""} ${article.tags ?? ""}`).includes(normalizedQuery);
  }), [articles, category, normalizedQuery]);

  const filteredQuestions = useMemo(() => questions.filter((item) => {
    if (!normalizedQuery) return true;
    return normalizeSearch(`${item.question} ${item.answer ?? ""} ${topicLabel(item.topicSlug)}`).includes(normalizedQuery);
  }), [normalizedQuery, questions]);

  const articlePage = useMemo(
    () => pageFromItems(filteredArticles, articlePageNumber, ARTICLE_PAGE_SIZE),
    [articlePageNumber, filteredArticles],
  );
  const questionPage = useMemo(
    () => pageFromItems(filteredQuestions, questionPageNumber, QUESTION_PAGE_SIZE),
    [filteredQuestions, questionPageNumber],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setArticlePageNumber(0);
      setQuestionPageNumber(0);
    });
    return () => {
      cancelled = true;
    };
  }, [category, normalizedQuery]);

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
    } catch (reason: unknown) {
      setReportNotice(safeErrorCopy(reason));
    } finally {
      setReportingId(null);
    }
  };

  return (
    <PublicPageShell>
      <div className="catalog-page section-inner">
        <header className="resource-page__header">
          <p className="section-note">Kho kiến thức bệnh phổ biến</p>
          <h1>Hiểu đúng để biết khi nào nên đi khám</h1>
          <p>
            Nội dung tham khảo đã được bệnh viện kiểm duyệt theo quy trình nội bộ. Không thay thế thăm khám hoặc chẩn đoán.
          </p>
          <div className="resource-actions">
            <PublicAiButton className="outline-button">Hỏi trợ lý triệu chứng</PublicAiButton>
            <PublicBookingButton>Đặt lịch với bác sĩ</PublicBookingButton>
          </div>
        </header>

        <section aria-labelledby="disease-filters-title" className="resource-panel resource-panel--accent">
          <p className="section-note" id="disease-filters-title">Tìm theo bệnh hoặc chủ đề</p>
          <div className="resource-grid resource-grid--two">
            <label className="disease-filter" htmlFor="disease-search">
              <span className="sr-only">Từ khóa tìm kiếm</span>
              <input
                className="disease-filter__control"
                id="disease-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ví dụ: đau đầu, tiểu đường…"
                type="search"
              />
            </label>
            <label className="disease-filter" htmlFor="disease-category">
              <span className="sr-only">Lọc theo chuyên đề</span>
              <select className="disease-filter__control" id="disease-category" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="ALL">Tất cả chuyên đề</option>
                {categories.map((value) => (
                  <option key={value} value={value.toUpperCase()}>{labelForToken(value, CATEGORY_LABELS, "Chuyên đề sức khỏe")}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="catalog-meta" aria-live="polite">
            {filteredArticles.length} bài hướng dẫn · {filteredQuestions.length} câu hỏi đã xuất bản
          </p>
        </section>

        <section aria-busy={articlesLoading} aria-labelledby="disease-guides-title">
          <div className="section-heading">
            <div>
              <p className="section-note">Hướng dẫn bệnh phổ biến</p>
              <h2 id="disease-guides-title">Bắt đầu từ thông tin phù hợp với bạn</h2>
            </div>
          </div>
          {articlesLoading ? <p className="catalog-status catalog-status--loading" role="status">{articles.length ? "Đang cập nhật hướng dẫn…" : "Đang tải hướng dẫn…"}</p> : null}
          {articlesError ? (
            <div aria-live="assertive" className="catalog-status catalog-status--error" role="alert">
              <span>{articles.length ? `Chưa thể cập nhật hướng dẫn mới. ${articlesError} Đang hiển thị nội dung đã tải trước đó.` : articlesError}</span>
              <button className="outline-button outline-button--small" onClick={() => setArticlesRetry((value) => value + 1)} type="button">Thử tải lại hướng dẫn</button>
            </div>
          ) : null}
          {!articlesLoading && !articlesError && articlePage.empty ? (
            <div className="catalog-status" role="status">
              <p>{hasActiveFilters ? "Chưa có bài viết phù hợp với bộ lọc hiện tại." : "Kho hướng dẫn đang được bệnh viện bổ sung."} Hãy thử nội dung khác hoặc xem cẩm nang sức khỏe.</p>
              <div className="resource-actions">
                {hasActiveFilters ? <button className="outline-button outline-button--small" onClick={() => { setQuery(""); setCategory("ALL"); }} type="button">Xóa bộ lọc</button> : null}
                <Link className="text-button" href="/articles">Mở cẩm nang sức khỏe →</Link>
              </div>
            </div>
          ) : null}
          {!articlesLoading && !articlePage.empty ? (
            <>
              <div className="catalog-grid catalog-grid--articles">
                {articlePage.content.map((article) => (
                  <article className="catalog-card" key={article.id}>
                    <p className="section-note">{articleCategory(article)} · {article.readingMinutes ?? 5} phút đọc</p>
                    <h3>{article.title}</h3>
                    <p>{article.summary}</p>
                    <p className="catalog-meta">Cập nhật {formatBusinessDate(article.updatedAt ?? article.publishedAt)}</p>
                    <Link className="text-button" href={`/benh-pho-bien/${encodeURIComponent(article.slug)}`}>Xem hướng dẫn →</Link>
                  </article>
                ))}
              </div>
              <CatalogPagination label="Phân trang hướng dẫn bệnh phổ biến" onPageChange={setArticlePageNumber} page={articlePage} />
            </>
          ) : null}
        </section>

        <section aria-busy={questionsLoading} aria-labelledby="published-questions-title" className="resource-panel">
          <p className="section-note">Hỏi đáp đã xuất bản</p>
          <h2 id="published-questions-title">Câu hỏi được bác sĩ duyệt</h2>
          <p className="portal-panel__intro">Danh tính thật không hiển thị. Bạn có thể báo cáo nội dung không phù hợp để bệnh viện kiểm tra.</p>
          {questionsLoading ? <p className="catalog-status catalog-status--loading" role="status">{questions.length ? "Đang cập nhật hỏi đáp…" : "Đang tải hỏi đáp…"}</p> : null}
          {questionsError ? (
            <div aria-live="assertive" className="catalog-status catalog-status--error" role="alert">
              <span>{questions.length ? `Chưa thể cập nhật hỏi đáp mới. ${questionsError} Đang hiển thị nội dung đã tải trước đó.` : questionsError}</span>
              <button className="outline-button outline-button--small" onClick={() => setQuestionsRetry((value) => value + 1)} type="button">Thử tải lại hỏi đáp</button>
            </div>
          ) : null}
          {!questionsLoading && !questionsError && questionPage.empty ? (
            <div className="catalog-status" role="status">
              <p>{hasActiveFilters ? "Chưa có câu hỏi phù hợp với từ khóa hiện tại." : "Chưa có câu hỏi đã xuất bản."} Bạn có thể xem thêm các giải đáp thường gặp.</p>
              <Link className="text-button" href="/faq">Mở câu hỏi thường gặp →</Link>
            </div>
          ) : null}
          {!questionsLoading && !questionPage.empty ? (
            <>
              <div className="resource-grid resource-grid--two">
                {questionPage.content.map((item) => (
                  <article className="catalog-card" key={item.id}>
                    <p className="section-note">{topicLabel(item.topicSlug)} · {item.publicAlias || "Người hỏi ẩn danh"}</p>
                    <h3>{item.question}</h3>
                    {item.answer ? <p>{item.answer}</p> : <p className="resource-muted">Câu trả lời đang được cập nhật.</p>}
                    <p className="catalog-meta">Đã xuất bản {formatBusinessDate(item.createdAt)}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`report-reason-${item.id}`}>Lý do báo cáo</label>
                      <select id={`report-reason-${item.id}`} className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm" value={reportReason[item.id] ?? "SAFETY_CONCERN"} onChange={(event) => setReportReason((current) => ({ ...current, [item.id]: event.target.value }))}>
                        <option value="SAFETY_CONCERN">Lo ngại an toàn</option>
                        <option value="PII_DETECTED">Có thông tin cá nhân</option>
                        <option value="SPAM">Spam hoặc lạm dụng</option>
                        <option value="DUPLICATE">Trùng nội dung</option>
                      </select>
                      <button aria-busy={reportingId === item.id} className="outline-button outline-button--small" disabled={reportingId === item.id} onClick={() => void report(item.id)} type="button">
                        {reportingId === item.id ? "Đang gửi…" : "Báo cáo nội dung"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <CatalogPagination label="Phân trang hỏi đáp sức khỏe" onPageChange={setQuestionPageNumber} page={questionPage} />
            </>
          ) : null}
          {reportNotice ? <p aria-live="polite" className="catalog-status" role="status">{reportNotice}</p> : null}
        </section>
      </div>
    </PublicPageShell>
  );
}
