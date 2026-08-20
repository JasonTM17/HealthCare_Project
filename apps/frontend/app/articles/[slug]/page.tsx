"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchArticleBySlug } from "../../../lib/api-client";
import { formatBusinessDate } from "../../../lib/business-time";
import type { Article } from "../../../types/hospital";
import { PublicBackLink, PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [slug]);

  const structuredSections = article?.sections?.filter((section) => section.heading.trim() || section.body.trim()) ?? [];
  const bodyParagraphs = article?.body?.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) ?? [];

  return (
    <PublicPageShell>
      <div className="resource-page section-inner">
        <PublicBackLink href="/articles">← Quay lại cẩm nang sức khỏe</PublicBackLink>
        <header className="resource-page__header"><p className="section-note">Cẩm nang sức khỏe</p><h1>Kiến thức y khoa trong nhịp sống hằng ngày</h1><p>Thông tin tham khảo giúp bạn chủ động chuẩn bị câu hỏi và chăm sóc sức khỏe tốt hơn.</p></header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải bài viết…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && !article ? <p className="catalog-status" role="status">Không tìm thấy bài viết đã xuất bản.</p> : null}
        {article ? <article className="article-detail-card">
          <p className="section-note">{formatBusinessDate(article.publishedAt)}</p>
          <h2>{article.title}</h2>
          {article.category || article.authorName || article.readingMinutes ? <div className="article-detail-card__meta">
            {article.category ? <span>{article.category}</span> : null}
            {article.authorName ? <span>{article.authorName}</span> : null}
            {article.readingMinutes ? <span>{article.readingMinutes} phút đọc</span> : null}
          </div> : null}
          <p className="article-detail-card__summary">{article.summary}</p>
          {article.relatedSpecialtySlug ? <p><Link className="text-button" href={`/specialties/${article.relatedSpecialtySlug}`}>Xem chuyên khoa liên quan →</Link></p> : null}
          {structuredSections.length ? <div className="article-detail-card__body article-detail-card__sections">{structuredSections.map((section, index) => <section key={`${section.heading}-${index}`}><h3>{section.heading}</h3><p>{section.body}</p></section>)}</div> : bodyParagraphs.length ? <div className="article-detail-card__body">{bodyParagraphs.map((paragraph, index) => <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>)}</div> : <div className="article-detail-card__notice"><strong>Nội dung đang được cập nhật</strong><p>Phần thông tin chi tiết của bài viết sẽ sớm được bổ sung.</p></div>}
          <PublicBookingButton>Đặt lịch nếu bạn cần trao đổi trực tiếp</PublicBookingButton>
        </article> : null}
      </div>
    </PublicPageShell>
  );
}
