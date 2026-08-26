"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, fetchFaqs, type Page } from "../../lib/api-client";
import type { Faq } from "../../types/hospital";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import CatalogPagination from "../../components/CatalogPagination";
import { presentApiError } from "../../lib/present-api-error";

const FAQ_STEPS = [
  {
    number: "01",
    title: "Đọc câu hỏi gần nhất",
    description: "Ưu tiên các câu hỏi liên quan tới đặt lịch, chuẩn bị trước khi đến và kênh hỗ trợ.",
  },
  {
    number: "02",
    title: "Mở trợ lý triệu chứng",
    description: "Nếu câu trả lời chưa đủ rõ, dùng AI triage để chọn chuyên khoa phù hợp hơn.",
  },
  {
    number: "03",
    title: "Đi tiếp sang liên hệ",
    description: "Khi cần xác nhận trực tiếp, chuyển thẳng sang trang liên hệ hoặc đặt lịch.",
  },
] as const;

function safeErrorCopy(reason: unknown): string {
  return presentApiError(
    reason instanceof ApiError ? reason.code : undefined,
    reason instanceof ApiError ? reason.status : undefined,
  );
}

export default function FaqPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [page, setPage] = useState<Page<Faq> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const loadedPageRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        if (loadedPageRef.current !== currentPage) setPage(null);
        loadedPageRef.current = currentPage;
        return fetchFaqs(currentPage, 10);
      })
      .then((data) => {
        if (data !== undefined && !cancelled) setPage(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(`Tạm thời chưa thể tải câu hỏi thường gặp. ${safeErrorCopy(reason)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void task;
    return () => {
      cancelled = true;
    };
  }, [currentPage, retryCount]);

  return (
    <PublicPageShell>
      <div aria-busy={loading} className="resource-page section-inner">
        <header className="resource-page__header">
          <p className="section-note">Hỗ trợ người bệnh</p>
          <h1>Giải đáp nhanh, rồi mới tới cuộc hẹn</h1>
          <p>
            Các câu hỏi thường gặp giúp bạn nắm nhanh cách đặt lịch, chuẩn bị trước khi khám và
            biết khi nào nên chuyển sang trao đổi trực tiếp.
          </p>
        </header>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">{page ? "Đang cập nhật câu hỏi…" : "Đang tải câu hỏi…"}</p> : null}
        {error ? (
          <div aria-live="assertive" className="catalog-status catalog-status--error" role="alert">
            <span>{page ? `Chưa thể cập nhật trang FAQ. ${error} Đang hiển thị nội dung đã tải trước đó.` : error}</span>
            <button className="outline-button outline-button--small" onClick={() => setRetryCount((count) => count + 1)} type="button">
              Thử tải lại
            </button>
          </div>
        ) : null}
        {!loading && !error && page?.empty ? (
          <div className="catalog-status" role="status">
            <p>Nội dung câu hỏi thường gặp đang được cập nhật. Nếu cần xác nhận ngay, đội ngũ bệnh viện có thể hỗ trợ theo tình huống cụ thể.</p>
            <div className="resource-actions">
              <Link className="outline-button outline-button--small" href="/contact">Liên hệ bệnh viện</Link>
              <PublicBookingButton className="button button--amber">Đặt lịch khám</PublicBookingButton>
            </div>
          </div>
        ) : null}

        <section className="resource-hero-card resource-hero-card--teal">
          <div className="resource-icon" aria-hidden="true">
            <span aria-hidden="true">?</span>
          </div>
          <div className="resource-hero-card__body">
            <p className="resource-chip">FAQ công khai</p>
            <h2>Những câu hỏi thường gặp theo dữ liệu thật của hệ thống.</h2>
            <p className="resource-lead">
              Đọc câu trả lời nhanh trước, rồi quyết định có cần đặt lịch hay gọi hỗ trợ trực tiếp hay không.
            </p>
            <div className="resource-actions">
              <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
              <PublicBookingButton>Đặt lịch khám</PublicBookingButton>
              <Link className="outline-button outline-button--light" href="/contact">
                Liên hệ bệnh viện
              </Link>
            </div>
            <dl className="resource-meta-grid">
              <div>
                <dt>Câu hỏi</dt>
                <dd>{loading ? "Đang tải…" : page?.totalElements ?? "Chưa có dữ liệu"}</dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
                <dd>{loading ? "Đang tải" : page && !page.empty ? "Có thể tra cứu" : "Đang bổ sung"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="resource-grid resource-grid--two">
          <section className="resource-panel resource-panel--accent">
            <p className="section-note">Hỗ trợ nhanh</p>
            <h2>Chưa tìm thấy câu trả lời?</h2>
            <p>
              Đặt lịch hoặc liên hệ trực tiếp để đội ngũ hỗ trợ xem lại theo tình huống cụ thể của bạn.
            </p>
            <div className="resource-actions">
              <PublicBookingButton>Đặt lịch khám</PublicBookingButton>
              <Link className="outline-button" href="/contact">
                Trang liên hệ
              </Link>
            </div>
          </section>

          <section className="resource-panel">
            <p className="section-note">Cách đọc nhanh</p>
            <h2>Ba bước để đi từ FAQ sang hành động</h2>
            <div className="resource-steps resource-steps--grid">
              {FAQ_STEPS.map((step) => (
                <div className="resource-step-card" key={step.number}>
                  <span>{step.number}</span>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {page && !page.empty ? (
          <>
            <p aria-live="polite" className="catalog-meta">{page.totalElements} câu hỏi · Trang {page.number + 1}/{page.totalPages}</p>
            <div aria-label="Danh sách câu hỏi thường gặp" className="faq-list">
              {page.content.map((item) => (
                <details className="faq-item" key={item.id}>
                  <summary>{item.question}</summary>
                  <p>{item.answer || "Câu trả lời đang được cập nhật. Vui lòng liên hệ bệnh viện nếu cần xác nhận."}</p>
                </details>
              ))}
            </div>
            <CatalogPagination label="Phân trang câu hỏi thường gặp" onPageChange={setCurrentPage} page={page} />
          </>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
