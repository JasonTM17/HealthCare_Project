"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchArticleBySlug } from "../../../lib/api-client";
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
        setLoading(true);
        setError(null);
        return fetchArticleBySlug(slug);
      })
      .then((data) => { if (data !== undefined && !cancelled) setArticle(data); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải bài viết."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <PublicPageShell>
      <div className="resource-page section-inner">
        <PublicBackLink href="/articles">← Quay lại cẩm nang sức khỏe</PublicBackLink>
        <header className="resource-page__header"><p className="section-note">Cẩm nang · nội dung đã xuất bản</p><h1>Kiến thức y khoa trong nhịp sống hằng ngày</h1><p>Chỉ hiển thị nội dung mà API bài viết công khai trả về.</p></header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải bài viết…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có bài viết demo thay thế.</p> : null}
        {!loading && !error && !article ? <p className="catalog-status" role="status">Không tìm thấy bài viết đã xuất bản.</p> : null}
        {article ? <article className="article-detail-card"><p className="section-note">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(new Date(article.publishedAt))}</p><h2>{article.title}</h2><p className="article-detail-card__summary">{article.summary}</p><div className="article-detail-card__notice"><strong>Phạm vi nội dung hiện tại</strong><p>Backend đang trả về tiêu đề và tóm tắt bài viết. Phần nội dung dài chưa nằm trong DTO công khai nên giao diện không tự bịa thêm thông tin y khoa.</p></div><PublicBookingButton>Đặt lịch nếu bạn cần trao đổi trực tiếp</PublicBookingButton></article> : null}
      </div>
    </PublicPageShell>
  );
}
