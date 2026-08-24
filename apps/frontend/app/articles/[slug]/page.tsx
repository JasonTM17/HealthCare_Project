"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ClinicalIcon from "../../../components/ClinicalIcon";
import { fetchArticleBySlug } from "../../../lib/api-client";
import { formatBusinessDate } from "../../../lib/business-time";
import type { Article } from "../../../types/hospital";
import { PublicAiButton, PublicBackLink, PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";

const ARTICLE_STEPS = [
  ["01", "Đọc phần tóm tắt", "Xác nhận bài viết có đúng chủ đề bạn đang tìm không."],
  ["02", "Ghi chú câu hỏi", "Ghi lại phần còn băn khoăn để hỏi lại bác sĩ hoặc trợ lý."],
  ["03", "Đi tiếp sang đặt lịch", "Nếu cần tư vấn trực tiếp, mở luồng đặt lịch ngay từ bài viết."],
] as const;

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setArticle(null);
        setLoading(true);
        setError(null);
        return fetchArticleBySlug(slug);
      })
      .then((data) => { if (data !== undefined && !cancelled) setArticle(data); })
      .catch(() => { if (!cancelled) setError("Tạm thời chưa thể tải bài viết. Vui lòng thử lại sau."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [retryCount, slug]);

  const structuredSections = article?.sections?.filter((section) => section.heading.trim() || section.body.trim()) ?? [];
  const bodyParagraphs = article?.body?.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) ?? [];
  const readingMinutesLabel = article?.readingMinutes ? `${article.readingMinutes} phút đọc` : "Thời lượng chưa cập nhật";

  return (
    <PublicPageShell>
      <div className="resource-page section-inner">
        <PublicBackLink href="/articles">← Quay lại cẩm nang sức khỏe</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Cẩm nang sức khỏe</p>
          <h1>Kiến thức y khoa trong nhịp sống hằng ngày</h1>
          <p>Thông tin tham khảo giúp bạn chủ động chuẩn bị câu hỏi và chăm sóc sức khỏe tốt hơn.</p>
        </header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải bài viết…</p> : null}
        {error ? (
          <div aria-live="assertive" className="catalog-status catalog-status--error" role="alert">
            <span>{error}</span>
            <button className="outline-button outline-button--small" onClick={() => setRetryCount((count) => count + 1)} type="button">
              Thử tải lại
            </button>
          </div>
        ) : null}
        {!loading && !error && !article ? <p className="catalog-status" role="status">Không tìm thấy bài viết đã xuất bản.</p> : null}
        {article ? (
          <>
            <article className="resource-hero-card resource-hero-card--teal">
              <div className="resource-icon" aria-hidden="true">
                <ClinicalIcon name="article" />
              </div>
              <div className="resource-hero-card__body">
                <p className="resource-chip">Bài viết sức khỏe</p>
                <h2>{article.title}</h2>
                <p className="resource-lead">{article.summary}</p>
                <div className="resource-actions">
                  <PublicBookingButton>Đặt lịch nếu bạn cần trao đổi trực tiếp</PublicBookingButton>
                  <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
                  {article.relatedSpecialtySlug ? (
                    <Link className="outline-button outline-button--light" href={`/specialties/${article.relatedSpecialtySlug}`}>
                      Xem chuyên khoa liên quan
                    </Link>
                  ) : null}
                </div>
                <dl className="resource-meta-grid">
                  {article.category ? (
                    <div>
                      <dt>Chủ đề</dt>
                      <dd>{article.category}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Đọc ước tính</dt>
                    <dd>{readingMinutesLabel}</dd>
                  </div>
                  {article.authorName ? (
                    <div>
                      <dt>Tác giả</dt>
                      <dd>{article.authorName}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Xuất bản</dt>
                    <dd>{formatBusinessDate(article.publishedAt)}</dd>
                  </div>
                </dl>
              </div>
            </article>

            <section className="resource-panel resource-panel--wide">
              <div className="section-heading">
                <div>
                  <p className="section-note">Cách đọc bài viết</p>
                  <h2>Ba bước để dùng thông tin an toàn</h2>
                </div>
              </div>
              <div className="resource-steps resource-steps--grid">
                {ARTICLE_STEPS.map(([number, title, description]) => (
                  <div className="resource-step-card" key={number}>
                    <span>{number}</span>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="resource-grid resource-grid--two">
              <section className="resource-panel">
                <p className="section-note">Nội dung chi tiết</p>
                <h2>Phần bài viết</h2>
                {structuredSections.length ? (
                  <div className="article-detail-card__body article-detail-card__sections">
                    {structuredSections.map((section, index) => (
                      <section key={`${section.heading}-${index}`}>
                        <h3>{section.heading}</h3>
                        <p>{section.body}</p>
                      </section>
                    ))}
                  </div>
                ) : bodyParagraphs.length ? (
                  <div className="article-detail-card__body">
                    {bodyParagraphs.map((paragraph, index) => (
                      <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                ) : (
                  <div className="article-detail-card__notice">
                    <strong>Nội dung đang được cập nhật</strong>
                    <p>Phần thông tin chi tiết của bài viết sẽ sớm được bổ sung.</p>
                  </div>
                )}
              </section>

              <section className="resource-panel resource-panel--accent">
                <p className="section-note">Bước tiếp theo</p>
                <h2>Chuyển từ đọc sang hành động</h2>
                <p>
                  Dùng bài viết để chuẩn bị câu hỏi, sau đó mở chuyên khoa liên quan hoặc đặt lịch khi bạn
                  muốn được tư vấn trực tiếp.
                </p>
                {article.relatedSpecialtySlug ? (
                  <Link className="text-button" href={`/specialties/${article.relatedSpecialtySlug}`}>
                    Đi tới chuyên khoa liên quan →
                  </Link>
                ) : null}
              </section>
            </div>
          </>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
