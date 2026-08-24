"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CatalogPagination from "../../components/CatalogPagination";
import ClinicalIcon from "../../components/ClinicalIcon";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import { fetchArticles, type Page } from "../../lib/api-client";
import { formatBusinessDate } from "../../lib/business-time";
import type { Article } from "../../types/hospital";

const READING_STEPS = [
  ["01", "Đọc theo nhu cầu", "Ưu tiên bài viết liên quan triệu chứng, chuyên khoa hoặc gói khám bạn đang cân nhắc."],
  ["02", "Ghi lại câu hỏi", "Chuẩn bị các dấu hiệu, thời điểm xuất hiện và thuốc đang dùng trước khi gặp bác sĩ."],
  ["03", "Xác nhận với chuyên môn", "Bài viết chỉ để tham khảo; quyết định điều trị cần được bác sĩ thăm khám trực tiếp."],
] as const;

export default function ArticlesPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [page, setPage] = useState<Page<Article> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        setPage(null);
        return fetchArticles(currentPage, 12);
    })
      .then((data) => { if (data !== undefined && !cancelled) setPage(data); })
      .catch(() => {
        if (!cancelled) setError("Tạm thời chưa thể tải bài viết. Vui lòng thử lại sau.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [currentPage, retryCount]);

  const featuredArticle = page?.content[0];
  const articleCount = page?.totalElements ?? page?.content.length ?? 0;

  return (
    <PublicPageShell>
      <div className="catalog-page section-inner">
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
            <p className="resource-chip">Tin tức & blog sức khỏe</p>
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
                <dd>{articleCount || "Đang cập nhật"}</dd>
              </div>
              <div>
                <dt>Bài mới nhất</dt>
                <dd>{featuredArticle ? formatBusinessDate(featuredArticle.publishedAt) : "Chưa có dữ liệu"}</dd>
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
                  <Link className="text-button" href={`/articles/${featuredArticle.slug}`}>
                    Đọc tóm tắt →
                  </Link>
                  {featuredArticle.relatedSpecialtySlug ? (
                    <Link
                      className="outline-button outline-button--small"
                      href={`/specialties/${featuredArticle.relatedSpecialtySlug}`}
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

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải cẩm nang…</p> : null}
        {error ? (
          <div aria-live="assertive" className="catalog-status catalog-status--error" role="alert">
            <span>{error} Không có bài viết demo thay thế.</span>
            <button className="outline-button outline-button--small" onClick={() => setRetryCount((count) => count + 1)} type="button">
              Thử tải lại
            </button>
          </div>
        ) : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Backend chưa có bài viết đã xuất bản.</p> : null}
        {page && !page.empty ? (
          <>
            <p className="catalog-meta">{page.totalElements} bài viết · Trang {page.number + 1}/{page.totalPages}</p>
            <div className="catalog-grid catalog-grid--articles">
              {page.content.map((article) => (
                <article className="catalog-card" key={article.id}>
                  <div className="resource-icon resource-icon--small" aria-hidden="true">
                    <ClinicalIcon name="article" />
                  </div>
                  <p className="section-note">{formatBusinessDate(article.publishedAt)}</p>
                  <h2>{article.title}</h2>
                  <p>{article.summary}</p>
                  <Link className="text-button" href={`/articles/${article.slug}`}>Đọc tóm tắt →</Link>
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
