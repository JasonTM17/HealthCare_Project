"use client";

import { useEffect, useState } from "react";
import { fetchFaqs, type Page } from "../../lib/api-client";
import type { Faq } from "../../types/hospital";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

export default function FaqPage() {
  const [page, setPage] = useState<Page<Faq> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchFaqs(0, 50).then((data) => { if (!cancelled) setPage(data); }).catch(() => { if (!cancelled) setError("Tạm thời chưa thể tải câu hỏi thường gặp. Vui lòng thử lại sau."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return <PublicPageShell><div className="catalog-page section-inner"><header className="resource-page__header"><p className="section-note">Hỗ trợ người bệnh</p><h1>Những câu hỏi thường gặp</h1><p>Tìm câu trả lời nhanh về đặt lịch, chuẩn bị trước khi khám và các thông tin cần thiết cho cuộc hẹn.</p></header>{loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải câu hỏi…</p> : null}{error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}{!loading && !error && page?.empty ? <p className="catalog-status" role="status">Nội dung câu hỏi thường gặp đang được cập nhật.</p> : null}{page && !page.empty ? <div className="faq-list">{page.content.map((item) => <details className="faq-item" key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div> : null}<div className="resource-panel resource-panel--accent"><h2>Cần được hỗ trợ thêm?</h2><p>Nội dung trên chỉ mang tính tham khảo. Hãy đặt lịch nếu bạn cần trao đổi trực tiếp với nhân viên y tế.</p><PublicBookingButton>Đặt lịch khám</PublicBookingButton></div></div></PublicPageShell>;
}
