"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchServices, type Page } from "../../lib/api-client";
import type { MedicalService } from "../../types/hospital";
import { ClinicalIcon } from "../../components/ClinicalIcon";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import CatalogPagination from "../../components/CatalogPagination";

export default function ServicesPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [page, setPage] = useState<Page<MedicalService> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setLoading(true);
      setError(null);
      setPage(null);
      return fetchServices(currentPage, 12);
    })
      .then((data) => { if (data !== undefined && !cancelled) setPage(data); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải dịch vụ."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [currentPage]);

  return (
    <PublicPageShell>
      <div className="catalog-page section-inner">
        <header className="resource-page__header"><p className="section-note">Dịch vụ y tế</p><h1>Dịch vụ cho từng nhu cầu chăm sóc</h1><p>Khám phá các dịch vụ hiện có và lựa chọn phương án phù hợp với nhu cầu của bạn.</p></header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải danh mục dịch vụ…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Danh sách dịch vụ đang được cập nhật.</p> : null}
        {page && !page.empty ? <><p className="catalog-meta">{page.totalElements} dịch vụ · Trang {page.number + 1}/{page.totalPages}</p><div className="catalog-grid">{page.content.map((service) => <article className="catalog-card" key={service.id}><span className="resource-icon resource-icon--small" aria-hidden="true"><ClinicalIcon name="service" /></span><h2>{service.name}</h2><p>{service.description || "Thông tin chi tiết của dịch vụ đang được cập nhật."}</p><div className="catalog-card__actions"><Link className="text-button" href={`/services/${service.slug}`}>Xem chi tiết →</Link><PublicBookingButton className="outline-button outline-button--small">Đặt lịch tư vấn</PublicBookingButton></div></article>)}</div><CatalogPagination label="Phân trang dịch vụ" onPageChange={setCurrentPage} page={page} /></> : null}
      </div>
    </PublicPageShell>
  );
}
