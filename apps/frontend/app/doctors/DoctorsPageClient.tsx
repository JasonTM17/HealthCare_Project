"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchDoctors, fetchSpecialties, type Page } from "../../lib/api-client";
import type { Doctor, Specialty } from "../../types/hospital";
import {
  PublicAiButton,
  PublicBackLink,
  PublicBookingButton,
  PublicPageShell,
} from "../../components/PublicPageShell";
import ClinicalIcon from "../../components/ClinicalIcon";

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
  const featuredDoctor = page?.content[0];
  const doctorCount = page?.totalElements ?? page?.content.length ?? 0;

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
          <p>
            Tìm hiểu chuyên môn và kinh nghiệm để lựa chọn bác sĩ phù hợp với nhu cầu chăm sóc.
          </p>
        </header>

        <section className="resource-hero-card resource-hero-card--teal">
          <div className="resource-icon" aria-hidden="true">
            <ClinicalIcon name="specialty" />
          </div>
          <div className="resource-hero-card__body">
            <p className="resource-chip">Đội ngũ chuyên gia</p>
            <h2>Chọn bác sĩ theo chuyên khoa, cơ sở và nhu cầu thật của bạn.</h2>
            <p className="resource-lead">
              Dùng trợ lý triệu chứng để định hướng trước, rồi mở đúng hồ sơ bác sĩ phù hợp thay vì
              chọn ngẫu nhiên.
            </p>
            <div className="resource-actions">
              <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý chọn chuyên khoa</PublicAiButton>
              <PublicBookingButton selection={selectedSpecialty ? { specialtyId: selectedSpecialty.id } : featuredDoctor ? { doctorId: featuredDoctor.id } : undefined}>
                Đặt lịch với bác sĩ
              </PublicBookingButton>
              <Link className="outline-button outline-button--light" href="/specialties">
                Xem chuyên khoa
              </Link>
            </div>
            <dl className="resource-meta-grid">
              <div>
                <dt>Tổng bác sĩ</dt>
                <dd>{doctorCount || "Đang cập nhật"}</dd>
              </div>
              <div>
                <dt>Bộ lọc hiện tại</dt>
                <dd>{filterLabel ?? "Tất cả bác sĩ"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="resource-grid resource-grid--two">
          <section className="resource-panel resource-panel--accent">
            <p className="section-note">Cách chọn bác sĩ</p>
            <h2>Ba bước để chọn nhanh</h2>
            <div className="resource-steps resource-steps--grid">
              {[
                ["01", "Xem hồ sơ", "Đọc chuyên môn, kinh nghiệm và chuyên khoa của bác sĩ."],
                ["02", "Kiểm tra bộ lọc", "Lọc theo chuyên khoa hoặc cơ sở nếu bạn đã có điểm đến cụ thể."],
                ["03", "Đặt lịch", "Mở form đặt lịch ngay khi đã chọn được bác sĩ phù hợp."],
              ].map(([number, title, description]) => (
                <div className="resource-step-card" key={number}>
                  <span>{number}</span>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="resource-panel">
            <p className="section-note">Bác sĩ nổi bật</p>
            <h2>Điểm bắt đầu của danh mục</h2>
            {featuredDoctor ? (
              <>
                <p>{featuredDoctor.bio || "Hồ sơ chưa có phần giới thiệu chi tiết."}</p>
                <div className="resource-actions">
                  <Link className="text-button" href={`/doctors/${featuredDoctor.slug}`}>
                    Xem hồ sơ →
                  </Link>
                  <PublicBookingButton
                    className="outline-button outline-button--small"
                    selection={{ doctorId: featuredDoctor.id }}
                  >
                    Đặt lịch
                  </PublicBookingButton>
                </div>
              </>
            ) : (
              <p className="resource-muted">Chưa tìm thấy bác sĩ phù hợp với lựa chọn này.</p>
            )}
          </section>

        </div>

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
