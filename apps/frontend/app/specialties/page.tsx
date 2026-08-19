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
          <p className="section-note">Care Rail · chuyên khoa</p>
          <h1>Chuyên khoa bắt đầu từ điều bạn đang quan tâm</h1>
          <p>Danh sách active được đọc trực tiếp từ catalog backend. Mở hồ sơ để xem mô tả, bác sĩ liên quan và đặt lịch theo đúng identity SQL.</p>
        </header>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải chuyên khoa…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có dữ liệu demo thay thế.</p> : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Backend chưa có chuyên khoa active.</p> : null}

        {page && !page.empty ? (
          <>
            <p className="catalog-meta">{page.totalElements} chuyên khoa · Trang {page.number + 1}/{page.totalPages}</p>
            <div className="catalog-grid catalog-grid--specialties">
              {page.content.map((specialty) => (
                <article className="catalog-card" key={specialty.id}>
                  <div className="resource-icon resource-icon--small" aria-hidden="true">
                    <ClinicalIcon name="specialty" />
                  </div>
                  <span className="resource-chip">Active catalog</span>
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
          <p className="section-note">Care Navigator</p>
          <h2>Chưa biết bắt đầu ở đâu?</h2>
          <p>AI chỉ gợi ý hướng trao đổi dựa trên nội dung bạn nhập; không chẩn đoán và không tự tạo identity đặt lịch.</p>
          <PublicAiButton>Mở trợ lý triệu chứng</PublicAiButton>
        </section>
      </div>
    </PublicPageShell>
  );
}
