"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, fetchFaqs, type Page } from "../../lib/api-client";
import type { Faq } from "../../types/hospital";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import CatalogPagination from "../../components/CatalogPagination";
import { presentApiError } from "../../lib/present-api-error";
import { JsonLd } from "../../components/JsonLd";
import { CmsNativeSection, CmsNativeText, CmsNativeSections } from "../../components/cms/cms-page-layout-provider";

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

  const faqJsonLd = page?.content?.length
    ? {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.content.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    }
    : null;

  return (
    <PublicPageShell>
      {faqJsonLd ? <JsonLd data={faqJsonLd} id="faq-jsonld" /> : null}
      <div aria-busy={loading} className="resource-page section-inner">
        <CmsNativeSection sectionId="intro">
          <header className="resource-page__header">
            <CmsNativeText fieldId="intro.eyebrow" as="p" value={"Hỗ trợ người bệnh"} className="section-note">Hỗ trợ người bệnh</CmsNativeText>
            <CmsNativeText fieldId="intro.title" as="h1" value={"Câu hỏi thường gặp & Hướng dẫn y khoa"}>Câu hỏi thường gặp & Hướng dẫn y khoa</CmsNativeText>
            <CmsNativeText fieldId="intro.body" as="p" value={"Các câu hỏi thường gặp giúp bạn nắm nhanh cách đặt lịch, chuẩn bị trước khi khám và biết khi nào nên chuyển sang trao đổi trực tiếp."}>
              Các câu hỏi thường gặp giúp bạn nắm nhanh cách đặt lịch, chuẩn bị trước khi khám và
              biết khi nào nên chuyển sang trao đổi trực tiếp.
            </CmsNativeText>
          </header>
        </CmsNativeSection>

        <CmsNativeSection sectionId="states">
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
              <p>Danh mục câu hỏi thường gặp đang được cập nhật nội dung mới nhất. Quý khách vui lòng xem hướng dẫn khám hoặc liên hệ đường dây nóng để được hỗ trợ trực tiếp.</p>
              <div className="resource-actions">
                <Link className="outline-button outline-button--small" href="/contact">Liên hệ bệnh viện</Link>
                <PublicBookingButton className="button button--amber">Đặt lịch khám</PublicBookingButton>
              </div>
            </div>
          ) : null}
        </CmsNativeSection>

        <CmsNativeSections>
          <CmsNativeSection sectionId="overview">
            <section className="resource-hero-card resource-hero-card--teal">
              <div className="resource-icon" aria-hidden="true">
                <CmsNativeText fieldId="overview.label" as="span" value={"?"} aria-hidden="true">?</CmsNativeText>
              </div>
              <div className="resource-hero-card__body">
                <CmsNativeText fieldId="overview.eyebrow" as="p" value={"Câu hỏi thường gặp"} className="resource-chip">Câu hỏi thường gặp</CmsNativeText>
                <CmsNativeText fieldId="overview.title" as="h2" value={"Giải đáp những điều người bệnh thường quan tâm."}>Giải đáp những điều người bệnh thường quan tâm.</CmsNativeText>
                <CmsNativeText fieldId="overview.body" as="p" value={"Đọc câu trả lời nhanh trước, rồi quyết định có cần đặt lịch hay gọi hỗ trợ trực tiếp hay không."} className="resource-lead">
                  Đọc câu trả lời nhanh trước, rồi quyết định có cần đặt lịch hay gọi hỗ trợ trực tiếp hay không.
                </CmsNativeText>
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
                    <dd>{loading ? "Đang tải…" : page?.totalElements ?? "Chưa có câu hỏi"}</dd>
                  </div>
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>{loading ? "Đang tải" : page && !page.empty ? "Có thể tra cứu" : "Đang cập nhật"}</dd>
                  </div>
                </dl>
              </div>
            </section>
          </CmsNativeSection>

          <CmsNativeSection sectionId="guide">
            <div className="resource-grid resource-grid--two">
              <section className="resource-panel resource-panel--accent">
                <CmsNativeText fieldId="guide.eyebrow" as="p" value={"Hỗ trợ nhanh"} className="section-note">Hỗ trợ nhanh</CmsNativeText>
                <CmsNativeText fieldId="guide.title" as="h2" value={"Chưa tìm thấy câu trả lời?"}>Chưa tìm thấy câu trả lời?</CmsNativeText>
                <CmsNativeText fieldId="guide.body" as="p" value={"Đặt lịch hoặc liên hệ trực tiếp để đội ngũ hỗ trợ xem lại theo tình huống cụ thể của bạn."}>
                  Đặt lịch hoặc liên hệ trực tiếp để đội ngũ hỗ trợ xem lại theo tình huống cụ thể của bạn.
                </CmsNativeText>
                <div className="resource-actions">
                  <PublicBookingButton>Đặt lịch khám</PublicBookingButton>
                  <Link className="outline-button" href="/contact">
                    Trang liên hệ
                  </Link>
                </div>
              </section>

              <section className="resource-panel">
                <CmsNativeText fieldId="guide.eyebrow2" as="p" value={"Cách đọc nhanh"} className="section-note">Cách đọc nhanh</CmsNativeText>
                <CmsNativeText fieldId="guide.title2" as="h2" value={"3 bước tra cứu và kết nối thăm khám"}>3 bước tra cứu và kết nối thăm khám</CmsNativeText>
                <div className="resource-steps resource-steps--grid">
                  {FAQ_STEPS.map((step, cmsItemIndex) => (
                    <div className="resource-step-card" key={step.number}>
                      <span>{step.number}</span>
                      <CmsNativeText fieldId={`guide.step${step.number}.title`} as="strong" value={step.title}>{step.title}</CmsNativeText>
                      <CmsNativeText fieldId={`guide.step${step.number}.body`} as="p" value={step.description}>{step.description}</CmsNativeText>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </CmsNativeSection>
        </CmsNativeSections>

        <CmsNativeSection sectionId="questions">
          {page && !page.empty ? (
            <>
              <p aria-live="polite" className="catalog-meta">{page.totalElements} câu hỏi · Trang {page.number + 1}/{page.totalPages}</p>
              <div aria-label="Danh sách câu hỏi thường gặp" className="faq-list">
                {page.content.map((item) => (
                  <details className="faq-item" key={item.id}>
                    <summary>{item.question}</summary>
                    <p>{item.answer || "Câu trả lời đang chờ biên tập. Vui lòng liên hệ bệnh viện nếu cần xác nhận trước."}</p>
                  </details>
                ))}
              </div>
              <CatalogPagination label="Phân trang câu hỏi thường gặp" onPageChange={setCurrentPage} page={page} />
            </>
          ) : null}
        </CmsNativeSection>
      </div>
    </PublicPageShell>
  );
}
