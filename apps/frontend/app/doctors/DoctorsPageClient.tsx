"use client";

import Link from "next/link";
import Image from "next/image";
import CatalogPagination from "../../components/CatalogPagination";
import { getDoctorInitials, getDoctorPhoto } from "../../lib/doctor-portrait";
import { useEffect, useState } from "react";
import { fetchDoctors, fetchSpecialties, type Page } from "../../lib/api-client";
import type { Doctor, Specialty } from "../../types/hospital";
import { dedupePublicDoctors } from "../../lib/public-catalog";
import {
  PublicAiButton,
  PublicBookingButton,
  PublicPageShell,
} from "../../components/PublicPageShell";
import ClinicalIcon from "../../components/ClinicalIcon";
import { specialtyIdForDoctor } from "../../components/BookingModal";

interface DoctorsPageClientProps {
  specialtySlug?: string;
  branchSlug?: string;
}

interface DoctorsCatalogFilter {
  specialtySlug?: string;
  branchSlug?: string;
}

/**
 * The `/doctors` route is prerendered, so the server can no longer hand the
 * filter slugs down as props (reading `searchParams` would opt the route back
 * into dynamic rendering). Resolve them from the URL on the client instead —
 * only in an effect, never during render, so the prerender stays deterministic.
 */
function readFilterFromLocation(): DoctorsCatalogFilter {
  const search = new URLSearchParams(window.location.search);
  return {
    specialtySlug: search.get("specialty") ?? undefined,
    branchSlug: search.get("branch") ?? undefined,
  };
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
  const [filter, setFilter] = useState<DoctorsCatalogFilter | null>(
    specialtySlug || branchSlug ? { specialtySlug, branchSlug } : null,
  );

  useEffect(() => {
    // The URL owns the filter (that is how deep links like
    // `/doctors?specialty=tim-mach` keep working); prop values only fill a gap
    // when the URL carries no filter. Re-running on `popstate` keeps
    // back/forward navigation consistent.
    const sync = () => {
      const fromLocation = readFilterFromLocation();
      setFilter({
        specialtySlug: fromLocation.specialtySlug ?? specialtySlug,
        branchSlug: fromLocation.branchSlug ?? branchSlug,
      });
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [branchSlug, specialtySlug]);

  const resolvedSpecialtySlug = filter?.specialtySlug;
  const resolvedBranchSlug = filter?.branchSlug;
  const filterResolved = filter !== null;

  useEffect(() => {
    let cancelled = false;
    fetchSpecialties(0, 100)
      .then((data) => { if (!cancelled) setSpecialties(data.content); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!filterResolved) return;
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        return fetchDoctors({
          page: currentPage,
          size: 12,
          sort: "fullName,asc",
          specialtySlug: resolvedSpecialtySlug,
          branchSlug: resolvedBranchSlug,
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
  }, [currentPage, filterResolved, resolvedBranchSlug, resolvedSpecialtySlug]);

  const selectedSpecialty = specialties.find((item) => item.slug === resolvedSpecialtySlug);
  const visibleDoctors = page ? dedupePublicDoctors(page.content) : [];
  const filterLabel = selectedSpecialty?.name ?? resolvedSpecialtySlug;
  const featuredDoctor = visibleDoctors[0];
  const doctorCount = page?.totalElements ?? visibleDoctors.length;

  const handlePageChange = (nextPage: number) => {
    setLoading(true);
    setError(null);
    setCurrentPage(nextPage);
  };

  return (
    <PublicPageShell doctors={visibleDoctors} specialties={specialties}>
      <div className="catalog-page catalog-page--directory section-inner">
        {/* Breadcrumb above already links home; a duplicate back-link here
            stacked two home paths within one screen. */}
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
            <h2>Tìm bác sĩ theo nhu cầu thăm khám</h2>
            <p className="resource-lead">
              Xem chuyên môn, chọn cơ sở và chủ động đặt lịch hẹn trực tuyến.
            </p>
            <div className="resource-actions">
              <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý chọn chuyên khoa</PublicAiButton>
              <PublicBookingButton
                selection={
                  featuredDoctor
                    ? {
                        doctorId: featuredDoctor.id,
                        specialtyId: specialtyIdForDoctor(featuredDoctor, specialties) || selectedSpecialty?.id || undefined,
                        branchId: featuredDoctor.branchId || featuredDoctor.branchIds?.[0],
                      }
                    : selectedSpecialty
                      ? { specialtyId: selectedSpecialty.id }
                      : undefined
                }
              >
                Đặt lịch với bác sĩ
              </PublicBookingButton>
              <Link className="outline-button outline-button--light" href="/specialties">
                Xem chuyên khoa
              </Link>
            </div>
            <dl className="resource-meta-grid">
              <div>
                <dt>Tổng bác sĩ</dt>
                <dd>{loading && !page ? "Đang tải…" : error && !page ? "Chưa tải được" : doctorCount || "Chưa có bác sĩ công khai"}</dd>
              </div>
              <div>
                <dt>Bộ lọc hiện tại</dt>
                <dd>{filterLabel ?? "Tất cả bác sĩ"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <details className="catalog-guidance">
          <summary>Cách chọn phù hợp</summary>
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
            <h2>Bác sĩ chuyên khoa tiêu biểu</h2>
            {loading && !page ? (
              <p className="resource-muted" role="status">Đang tải hồ sơ bác sĩ…</p>
            ) : error && !page ? (
              <p className="resource-muted" role="status">Chưa thể tải hồ sơ lúc này. Vui lòng thử lại sau.</p>
            ) : featuredDoctor ? (
              <>
                <p className="catalog-card__summary">{featuredDoctor.bio || "Bác sĩ chuyên khoa giàu kinh nghiệm, tận tâm đồng hành chăm sóc người bệnh."}</p>
                <div className="resource-actions">
                  <Link className="text-button" href={`/doctors/${featuredDoctor.slug}`}>
                    Xem hồ sơ →
                  </Link>
                    <PublicBookingButton
                      ariaLabel={`Đặt lịch với bác sĩ ${featuredDoctor.fullName}`}
                      className="outline-button outline-button--small"
                      selection={{
                        doctorId: featuredDoctor.id,
                        specialtyId: specialtyIdForDoctor(featuredDoctor, specialties) || selectedSpecialty?.id || undefined,
                        branchId: featuredDoctor.branchId || featuredDoctor.branchIds?.[0],
                      }}
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
        </details>

        {filterLabel ? (
          <div className="resource-chip-row" aria-label="Bộ lọc hiện tại">
            <span className="resource-chip">Chuyên khoa: {filterLabel}</span>
            <Link className="text-button" href="/doctors">Xóa bộ lọc</Link>
          </div>
        ) : null}

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải hồ sơ bác sĩ…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && page && (page.empty || visibleDoctors.length === 0) ? <p className="catalog-status" role="status">Chưa tìm thấy bác sĩ phù hợp với lựa chọn này.</p> : null}

        {page && !page.empty && visibleDoctors.length > 0 ? (
          <>
            <p className="catalog-meta">{page.totalElements} bác sĩ · Trang {page.number + 1}/{page.totalPages}</p>
            <div className="catalog-grid catalog-grid--doctors">
              {visibleDoctors.map((doctor) => (
                <article className="catalog-card" key={doctor.id}>
                  <div className="resource-avatar">
                    {getDoctorPhoto(doctor) ? (
                      <Image
                        src={getDoctorPhoto(doctor) as string}
                        alt={`Ảnh bác sĩ ${doctor.fullName}`}
                        width={400}
                        height={300}
                        sizes="(max-width: 768px) 100vw, 360px"
                        className="resource-avatar__img"
                      />
                    ) : (
                      <span className="resource-avatar__initials" aria-hidden="true">
                        {getDoctorInitials(doctor.fullName)}
                      </span>
                    )}
                  </div>
                  {doctor.demo || doctor.slug.startsWith("demo-bs-")
                    ? <span className="resource-chip resource-chip--muted">Hồ sơ minh họa</span>
                    : null}
                  {doctor.specialtyName ? <span className="resource-chip">{doctor.specialtyName}</span> : null}
                  <h2>{doctor.fullName}</h2>
                  <p className="catalog-card__summary">{doctor.bio || "Bác sĩ chuyên khoa giàu kinh nghiệm, tận tâm đồng hành chăm sóc người bệnh."}</p>
                  <div className="catalog-card__actions">
                    <Link className="text-button" href={`/doctors/${doctor.slug}`}>Xem hồ sơ →</Link>
                    <PublicBookingButton
                      ariaLabel={`Đặt lịch với bác sĩ ${doctor.fullName}`}
                      className="outline-button outline-button--small"
                      selection={{
                        doctorId: doctor.id,
                        specialtyId: specialtyIdForDoctor(doctor, specialties) || selectedSpecialty?.id || undefined,
                        branchId: doctor.branchId || doctor.branchIds?.[0],
                      }}
                    >
                      Đặt lịch
                    </PublicBookingButton>
                  </div>
                </article>
              ))}
            </div>

            <CatalogPagination label="Phân trang bác sĩ" onPageChange={handlePageChange} page={page} />
          </>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
