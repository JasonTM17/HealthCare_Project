"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchArticles, type Page } from "../../lib/api-client";
import type { Article } from "../../types/hospital";
import { PublicPageShell } from "../../components/PublicPageShell";
import CatalogPagination from "../../components/CatalogPagination";
import { formatBusinessDate } from "../../lib/business-time";

export default function ArticlesPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [page, setPage] = useState<Page<Article> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải bài viết."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [currentPage]);

  return (
    <PublicPageShell>
      <div className="catalog-page section-inner">
        <header className="resource-page__header"><p className="section-note">Cẩm nang sức khỏe</p><h1>Kiến thức y khoa trong nhịp sống hằng ngày</h1><p>Những nội dung tham khảo giúp bạn chủ động tìm hiểu và chuẩn bị câu hỏi trước khi gặp bác sĩ.</p></header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải cẩm nang…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có bài viết demo thay thế.</p> : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Backend chưa có bài viết đã xuất bản.</p> : null}
        {page && !page.empty ? <><p className="catalog-meta">{page.totalElements} bài viết · Trang {page.number + 1}/{page.totalPages}</p><div className="catalog-grid catalog-grid--articles">{page.content.map((article) => <article className="catalog-card" key={article.id}><p className="section-note">{formatBusinessDate(article.publishedAt)}</p><h2>{article.title}</h2><p>{article.summary}</p><Link className="text-button" href={`/articles/${article.slug}`}>Đọc tóm tắt →</Link></article>)}</div><CatalogPagination label="Phân trang cẩm nang" onPageChange={setCurrentPage} page={page} /></> : null}
      </div>
    </PublicPageShell>
  );
}
