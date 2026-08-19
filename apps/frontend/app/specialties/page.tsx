"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchSpecialties, type Page } from "../../lib/api-client";
import type { Specialty } from "../../types/hospital";
import { ClinicalIcon } from "../../components/ClinicalIcon";
import CatalogPagination from "../../components/CatalogPagination";
import {
  PublicAiButton,
  PublicBackLink,
  PublicBookingButton,
  PublicPageShell,
} from "../../components/PublicPageShell";

export default function SpecialtiesPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [page, setPage] = useState<Page<Specialty> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setLoading(true);
      setError(null);
      setPage(null);
      return fetchSpecialties(currentPage, 12);
    })
      .then((data) => {
        if (data !== undefined && !cancelled) setPage(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải chuyên khoa.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void task;
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  return (
    <PublicPageShell>
      <div className="catalog-page section-inner">
        <PublicBackLink href="/">← Về trang chính</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Danh mục chuyên khoa</p>
          <h1>Chuyên khoa bắt đầu từ điều bạn đang quan tâm</h1>
          <p>Tìm hiểu phạm vi chăm sóc của từng chuyên khoa, xem bác sĩ phù hợp và chủ động đặt lịch theo nhu cầu.</p>
        </header>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải chuyên khoa…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Danh sách chuyên khoa đang được cập nhật.</p> : null}

        {page && !page.empty ? (
          <>
            <p className="catalog-meta">{page.totalElements} chuyên khoa · Trang {page.number + 1}/{page.totalPages}</p>
            <div className="catalog-grid catalog-grid--specialties">
              {page.content.map((specialty) => (
                <article className="catalog-card" key={specialty.id}>
                  <div className="resource-icon resource-icon--small" aria-hidden="true">
                    <ClinicalIcon name="specialty" />
                  </div>
                  <span className="resource-chip">Chăm sóc chuyên sâu</span>
                  <h2>{specialty.name}</h2>
                  <p>{specialty.description || "Chuyên khoa chưa có phần mô tả chi tiết."}</p>
                  <div className="catalog-card__actions">
                    <Link className="text-button" href={`/specialties/${specialty.slug}`}>Xem chuyên khoa →</Link>
                    <PublicBookingButton className="outline-button outline-button--small" selection={{ specialtyId: specialty.id }}>Đặt lịch</PublicBookingButton>
                  </div>
                </article>
              ))}
            </div>
            <CatalogPagination label="Phân trang chuyên khoa" onPageChange={setCurrentPage} page={page} />
          </>
        ) : null}

        <section className="resource-panel resource-panel--accent">
          <p className="section-note">Hỗ trợ chọn chuyên khoa</p>
          <h2>Chưa biết bắt đầu ở đâu?</h2>
          <p>Trợ lý giúp định hướng theo thông tin bạn cung cấp. Kết quả chỉ mang tính tham khảo và không thay thế chẩn đoán của bác sĩ.</p>
          <PublicAiButton>Hỗ trợ chọn chuyên khoa</PublicAiButton>
        </section>
      </div>
    </PublicPageShell>
  );
}
