"use client";

import { useEffect, useState } from "react";
import { fetchFaqs, type Page } from "../../lib/api-client";
import type { Faq } from "../../types/hospital";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import CatalogPagination from "../../components/CatalogPagination";

export default function FaqPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [page, setPage] = useState<Page<Faq> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setLoading(true);
      setError(null);
      return fetchFaqs(currentPage, 10);
    }).then((data) => { if (data !== undefined && !cancelled) setPage(data); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải câu hỏi thường gặp."); }).finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [currentPage]);
  return <PublicPageShell><div className="catalog-page section-inner"><header className="resource-page__header"><p className="section-note">Hỗ trợ người bệnh · FAQ</p><h1>Những câu hỏi thường gặp</h1><p>Câu trả lời được quản trị và đọc từ FAQ active của backend.</p></header>{loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải câu hỏi…</p> : null}{error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có câu trả lời demo thay thế.</p> : null}{!loading && !error && page?.empty ? <p className="catalog-status" role="status">Backend chưa có câu hỏi active.</p> : null}{page && !page.empty ? <><p className="catalog-meta">{page.totalElements} câu hỏi · Trang {page.number + 1}/{page.totalPages}</p><div className="faq-list">{page.content.map((item) => <details className="faq-item" key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div><CatalogPagination label="Phân trang câu hỏi thường gặp" onPageChange={setCurrentPage} page={page} /></> : null}<div className="resource-panel resource-panel--accent"><h2>Cần trao đổi trực tiếp?</h2><p>FAQ không thay thế tư vấn y khoa. Nếu cần đặt hẹn, hãy dùng luồng booking backend.</p><PublicBookingButton>Đặt lịch khám</PublicBookingButton></div></div></PublicPageShell>;
}
