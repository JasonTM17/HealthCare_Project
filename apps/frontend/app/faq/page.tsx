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
      setPage(null);
      return fetchFaqs(currentPage, 10);
    }).then((data) => { if (data !== undefined && !cancelled) setPage(data); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải câu hỏi thường gặp."); }).finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [currentPage]);
  return <PublicPageShell><div className="catalog-page section-inner"><header className="resource-page__header"><p className="section-note">Hỗ trợ người bệnh</p><h1>Những câu hỏi thường gặp</h1><p>Tìm câu trả lời nhanh về đặt lịch, chuẩn bị trước khi khám và các thông tin cần thiết cho cuộc hẹn.</p></header>{loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải câu hỏi…</p> : null}{error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}{!loading && !error && page?.empty ? <p className="catalog-status" role="status">Nội dung câu hỏi thường gặp đang được cập nhật.</p> : null}{page && !page.empty ? <><p className="catalog-meta">{page.totalElements} câu hỏi · Trang {page.number + 1}/{page.totalPages}</p><div className="faq-list">{page.content.map((item) => <details className="faq-item" key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div><CatalogPagination label="Phân trang câu hỏi thường gặp" onPageChange={setCurrentPage} page={page} /></> : null}<div className="resource-panel resource-panel--accent"><h2>Cần được hỗ trợ thêm?</h2><p>Nội dung trên chỉ mang tính tham khảo. Hãy đặt lịch nếu bạn cần trao đổi trực tiếp với nhân viên y tế.</p><PublicBookingButton>Đặt lịch khám</PublicBookingButton></div></div></PublicPageShell>;
}
