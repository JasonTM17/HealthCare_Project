"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchDoctors, fetchSpecialties, type Page } from "../../lib/api-client";
import type { Doctor, Specialty } from "../../types/hospital";
import {
  PublicBackLink,
  PublicBookingButton,
  PublicPageShell,
} from "../../components/PublicPageShell";

interface DoctorsPageClientProps {
  specialtySlug?: string;
  branchSlug?: string;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

export default function DoctorsPageClient({ specialtySlug, branchSlug }: DoctorsPageClientProps) {
  const [page, setPage] = useState<Page<Doctor> | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchSpecialties(0, 100)
      .then((data) => { if (!cancelled) setSpecialties(data.content); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        setPage(null);
        return fetchDoctors({
          page: currentPage,
          size: 12,
          sort: "fullName,asc",
          specialtySlug,
          branchSlug,
        });
      })
      .then((data) => {
        if (data !== undefined && !cancelled) setPage(data);
      })
      .catch(() => {
        if (!cancelled) setError("Tạm thời chưa thể tải danh sách bác sĩ. Vui lòng thử lại sau.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void task;
    return () => { cancelled = true; };
  }, [branchSlug, currentPage, specialtySlug]);

  const selectedSpecialty = specialties.find((item) => item.slug === specialtySlug);
  const filterLabel = selectedSpecialty?.name ?? specialtySlug;

  const handlePageChange = (nextPage: number) => {
    setLoading(true);
    setError(null);
    setCurrentPage(nextPage);
  };

  return (
    <PublicPageShell doctors={page?.content ?? []} specialties={specialties}>
      <div className="catalog-page section-inner">
        <PublicBackLink href="/">← Về trang chính</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Đội ngũ bác sĩ</p>
          <h1>Bác sĩ đồng hành cùng bạn</h1>
          <p>Tìm hiểu chuyên môn và kinh nghiệm để lựa chọn bác sĩ phù hợp với nhu cầu chăm sóc.</p>
        </header>

        {filterLabel ? (
          <div className="resource-chip-row" aria-label="Bộ lọc hiện tại">
            <span className="resource-chip">Chuyên khoa: {filterLabel}</span>
            <Link className="text-button" href="/doctors">Xóa bộ lọc</Link>
          </div>
        ) : null}

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải hồ sơ bác sĩ…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Chưa tìm thấy bác sĩ phù hợp với lựa chọn này.</p> : null}

        {page && !page.empty ? (
          <>
            <p className="catalog-meta">{page.totalElements} bác sĩ · Trang {page.number + 1}/{page.totalPages}</p>
            <div className="catalog-grid catalog-grid--doctors">
              {page.content.map((doctor) => (
                <article className="catalog-card" key={doctor.id}>
                  <div className="resource-avatar" aria-hidden="true">{initials(doctor.fullName)}</div>
                  {doctor.specialtyName ? <span className="resource-chip">{doctor.specialtyName}</span> : null}
                  <h2>{doctor.fullName}</h2>
                  <p>{doctor.bio || "Hồ sơ chưa có phần giới thiệu chi tiết."}</p>
                  <div className="catalog-card__actions">
                    <Link className="text-button" href={`/doctors/${doctor.slug}`}>Xem hồ sơ →</Link>
                    <PublicBookingButton className="outline-button outline-button--small" selection={{ doctorId: doctor.id }}>Đặt lịch</PublicBookingButton>
                  </div>
                </article>
              ))}
            </div>

            {page.totalPages > 1 ? (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button type="button" onClick={() => handlePageChange(Math.max(0, currentPage - 1))} disabled={page.first} className="px-4 py-2 rounded-full border border-slate-300 text-sm disabled:opacity-40 hover:bg-slate-50">← Trước</button>
                <span className="text-sm text-slate-600">Trang {page.number + 1} / {page.totalPages}</span>
                <button type="button" onClick={() => handlePageChange(Math.min(page.totalPages - 1, currentPage + 1))} disabled={page.last} className="px-4 py-2 rounded-full border border-slate-300 text-sm disabled:opacity-40 hover:bg-slate-50">Sau →</button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
