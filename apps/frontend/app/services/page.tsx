"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, fetchServices, type Page } from "../../lib/api-client";
import { presentApiError } from "../../lib/present-api-error";
import type { MedicalService } from "../../types/hospital";
import ClinicalIcon from "../../components/ClinicalIcon";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import CatalogPagination from "../../components/CatalogPagination";

const SERVICE_STEPS = [
  {
    number: "01",
    title: "Đọc mô tả dịch vụ",
    description: "Xem dịch vụ phục vụ nhu cầu nào trước khi đi sâu vào chi tiết.",
  },
  {
    number: "02",
    title: "So sánh với gói khám",
    description: "Một số dịch vụ liên quan chặt với gói khám hoặc chuyên khoa phù hợp.",
  },
  {
    number: "03",
    title: "Mở đặt lịch",
    description: "Đi thẳng sang luồng đặt lịch để giữ khung giờ khi đã chọn được dịch vụ.",
  },
] as const;

export default function ServicesPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [page, setPage] = useState<Page<MedicalService> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        setPage(null);
        return fetchServices(currentPage, 12);
      })
      .then((data) => {
        if (data !== undefined && !cancelled) setPage(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(presentApiError(
            reason instanceof ApiError ? reason.code : null,
            reason instanceof ApiError ? reason.status : undefined,
          ));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void task;
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  const services = page?.content ?? [];
  const serviceCount = page?.totalElements ?? services.length;
  const featuredService = services[0];

  return (
    <PublicPageShell>
      <div className="catalog-page section-inner">
        <header className="resource-page__header">
          <p className="section-note">Dịch vụ y tế</p>
          <h1>Dịch vụ cho từng nhu cầu chăm sóc</h1>
          <p>
            Khám phá các dịch vụ hiện có và lựa chọn phương án phù hợp với nhu cầu của bạn.
          </p>
        </header>

        <section className="resource-hero-card resource-hero-card--teal">
          <div className="resource-icon" aria-hidden="true">
            <ClinicalIcon name="service" />
          </div>
          <div className="resource-hero-card__body">
            <p className="resource-chip">Danh mục dịch vụ</p>
            <h2>Một nơi để đọc, so sánh và đi tiếp sang đặt lịch.</h2>
            <p className="resource-lead">
              Dịch vụ công khai được gom vào cùng một khung để bạn dễ chọn hơn trước khi mở form khám
              hay liên hệ hỗ trợ.
            </p>
            <div className="resource-actions">
              <PublicBookingButton>Đặt lịch tư vấn</PublicBookingButton>
              <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
              <Link className="outline-button outline-button--light" href="/packages">
                Xem gói khám
              </Link>
            </div>
            <dl className="resource-meta-grid">
              <div>
                <dt>Tổng dịch vụ</dt>
                <dd>{serviceCount || "Đang cập nhật"}</dd>
              </div>
              <div>
                <dt>Dịch vụ nổi bật</dt>
                <dd>{featuredService?.name ?? "Đang cập nhật"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="resource-grid resource-grid--two">
          <section className="resource-panel resource-panel--accent">
            <p className="section-note">Cách đọc danh mục</p>
            <h2>Ba mốc để chọn nhanh</h2>
            <div className="resource-steps resource-steps--grid">
              {SERVICE_STEPS.map((step) => (
                <div className="resource-step-card" key={step.number}>
                  <span>{step.number}</span>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="resource-panel">
            <p className="section-note">Dịch vụ nổi bật</p>
            <h2>Điểm bắt đầu của danh mục</h2>
            {featuredService ? (
              <>
                <p>{featuredService.description || "Thông tin chi tiết của dịch vụ đang được cập nhật."}</p>
                <div className="resource-actions">
                  <Link className="text-button" href={`/services/${featuredService.slug}`}>
                    Xem chi tiết →
                  </Link>
                  <PublicBookingButton className="outline-button outline-button--small">
                    Đặt lịch tư vấn
                  </PublicBookingButton>
                </div>
              </>
            ) : (
              <p className="resource-muted">Danh sách dịch vụ đang được cập nhật.</p>
            )}
          </section>
        </div>

        {loading ? (
          <p className="catalog-status catalog-status--loading" role="status">
            Đang tải danh mục dịch vụ…
          </p>
        ) : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && page?.empty ? (
          <p className="catalog-status" role="status">
            Danh sách dịch vụ đang được cập nhật.
          </p>
        ) : null}

        {page && !page.empty ? (
          <>
            <p className="catalog-meta">
              {page.totalElements} dịch vụ · Trang {page.number + 1}/{page.totalPages}
            </p>
            <div className="catalog-grid">
              {page.content.map((service) => (
                <article className="catalog-card" key={service.id}>
                  <span className="resource-icon resource-icon--small" aria-hidden="true">
                    <ClinicalIcon name="service" />
                  </span>
                  <h2>{service.name}</h2>
                  <p>{service.description || "Thông tin chi tiết của dịch vụ đang được cập nhật."}</p>
                  <div className="catalog-card__actions">
                    <Link className="text-button" href={`/services/${service.slug}`}>
                      Xem chi tiết →
                    </Link>
                    <PublicBookingButton className="outline-button outline-button--small">
                      Đặt lịch tư vấn
                    </PublicBookingButton>
                  </div>
                </article>
              ))}
            </div>
            <CatalogPagination label="Phân trang dịch vụ" onPageChange={setCurrentPage} page={page} />
          </>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
