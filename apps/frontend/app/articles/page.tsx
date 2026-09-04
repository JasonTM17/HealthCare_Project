"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CatalogPagination from "../../components/CatalogPagination";
import ClinicalIcon from "../../components/ClinicalIcon";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import { ApiError, fetchArticles, subscribeToCatalogChange, type Page } from "../../lib/api-client";
import { formatBusinessDate } from "../../lib/business-time";
import { presentApiError } from "../../lib/present-api-error";
import type { Article } from "../../types/hospital";

const READING_STEPS = [
  ["01", "Đọc theo nhu cầu", "Ưu tiên bài viết liên quan triệu chứng, chuyên khoa hoặc gói khám bạn đang cân nhắc."],
  ["02", "Ghi lại câu hỏi", "Chuẩn bị các dấu hiệu, thời điểm xuất hiện và thuốc đang dùng trước khi gặp bác sĩ."],
  ["03", "Xác nhận với chuyên môn", "Bài viết chỉ để tham khảo; quyết định điều trị cần được bác sĩ thăm khám trực tiếp."],
] as const;

function safeErrorCopy(reason: unknown): string {
  return presentApiError(
    reason instanceof ApiError ? reason.code : undefined,
    reason instanceof ApiError ? reason.status : undefined,
  );
}

export default function ArticlesPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [page, setPage] = useState<Page<Article> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const loadedPageRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToCatalogChange((detail) => {
      if (detail.kind === "article") {
        setRetryCount((c) => c + 1);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        if (loadedPageRef.current !== currentPage) setPage(null);
        loadedPageRef.current = currentPage;
        return fetchArticles(currentPage, 12);
    })
      .then((data) => { if (data !== undefined && !cancelled) setPage(data); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(`Tạm thời chưa thể tải bài viết. ${safeErrorCopy(reason)}`);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [currentPage, retryCount]);

  const featuredArticle = page?.content[0];
  const articleCount = page?.totalElements ?? page?.content.length ?? 0;

  return (
    <PublicPageShell>
      <div aria-busy={loading} className="catalog-page section-inner">
        <header className="resource-page__header">
          <p className="section-note">Cẩm nang sức khỏe</p>
          <h1>Kiến thức y khoa trong nhịp sống hằng ngày</h1>
          <p>
            Những nội dung tham khảo giúp bạn chủ động tìm hiểu và chuẩn bị câu hỏi trước khi gặp bác sĩ.
          </p>
        </header>

        <section className="resource-hero-card resource-hero-card--teal">
          <div className="resource-icon" aria-hidden="true">
            <ClinicalIcon name="article" />
          </div>
          <div className="resource-hero-card__body">
            <p className="resource-chip">Nội dung tham khảo · cập nhật theo dữ liệu công khai</p>
            <h2>Cập nhật kiến thức chăm sóc sức khỏe theo hướng dễ hiểu và có điểm dừng an toàn.</h2>
            <p className="resource-lead">
              Đọc bài viết để chuẩn bị câu hỏi tốt hơn, sau đó dùng trợ lý hoặc đặt lịch nếu triệu chứng cần
              được bác sĩ đánh giá.
            </p>
            <div className="resource-actions">
              <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
              <PublicBookingButton>Đặt lịch trao đổi với bác sĩ</PublicBookingButton>
              <Link className="outline-button outline-button--light" href="/specialties">
                Xem chuyên khoa
              </Link>
            </div>
            <dl className="resource-meta-grid">
              <div>
                <dt>Bài đã xuất bản</dt>
                <dd>{loading ? "Đang tải…" : articleCount || "Chưa có dữ liệu"}</dd>
              </div>
              <div>
                <dt>Bài mới nhất</dt>
                <dd>{loading ? "Đang tải…" : featuredArticle ? formatBusinessDate(featuredArticle.publishedAt) : "Chưa có dữ liệu"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="resource-grid resource-grid--two">
          <section className="resource-panel resource-panel--accent">
            <p className="section-note">Đọc cẩm nang an toàn</p>
            <h2>Ba bước trước khi tự diễn giải thông tin</h2>
            <div className="resource-steps resource-steps--grid">
              {READING_STEPS.map(([number, title, description]) => (
                <div className="resource-step-card" key={number}>
                  <span>{number}</span>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="resource-panel">
            <p className="section-note">Nội dung nổi bật</p>
            <h2>Điểm bắt đầu cho hôm nay</h2>
            {featuredArticle ? (
              <>
                <p>{featuredArticle.summary}</p>
                <div className="resource-actions">
                  <Link className="text-button" href={`/articles/${encodeURIComponent(featuredArticle.slug)}`}>
                    Đọc tóm tắt →
                  </Link>
                  {featuredArticle.relatedSpecialtySlug ? (
                    <Link
                      className="outline-button outline-button--small"
                      href={`/specialties/${encodeURIComponent(featuredArticle.relatedSpecialtySlug)}`}
                    >
                      Chuyên khoa liên quan
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="resource-muted">Backend chưa có bài viết nổi bật để hiển thị.</p>
            )}
          </section>
        </div>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">{page ? "Đang cập nhật cẩm nang…" : "Đang tải cẩm nang…"}</p> : null}
        {error ? (
          <div aria-live="assertive" className="catalog-status catalog-status--error" role="alert">
            <span>{page ? `Chưa thể cập nhật trang này. ${error} Đang hiển thị nội dung đã tải trước đó.` : error}</span>
            <button className="outline-button outline-button--small" onClick={() => setRetryCount((count) => count + 1)} type="button">
              Thử tải lại
            </button>
          </div>
        ) : null}
        {!loading && !error && page?.empty ? (
          <div className="catalog-status" role="status">
            <p>Chưa có bài viết đã xuất bản trong cẩm nang. Bạn có thể xem chuyên khoa hoặc đặt lịch để được hướng dẫn theo tình huống cụ thể.</p>
            <div className="resource-actions">
              <Link className="outline-button outline-button--small" href="/specialties">Xem chuyên khoa</Link>
              <PublicBookingButton className="button button--amber">Đặt lịch khám</PublicBookingButton>
            </div>
          </div>
        ) : null}
        {page && !page.empty ? (
          <>
            <p aria-live="polite" className="catalog-meta">{page.totalElements} bài viết · Trang {page.number + 1}/{page.totalPages}</p>
            <div className="catalog-grid catalog-grid--articles">
              {page.content.map((article) => (
                <article className="catalog-card" key={article.id}>
                  <div className="resource-icon resource-icon--small" aria-hidden="true">
                    <ClinicalIcon name="article" />
                  </div>
                  <p className="section-note">{formatBusinessDate(article.publishedAt)}</p>
                  <h3>{article.title}</h3>
                  <p>{article.summary}</p>
                  <Link className="text-button" href={`/articles/${encodeURIComponent(article.slug)}`}>Đọc tóm tắt →</Link>
                </article>
              ))}
            </div>
            <CatalogPagination label="Phân trang cẩm nang" onPageChange={setCurrentPage} page={page} />
          </>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
