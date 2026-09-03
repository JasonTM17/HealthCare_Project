"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, fetchSpecialties, type Page } from "../../lib/api-client";
import { presentApiError } from "../../lib/present-api-error";
import type { Specialty } from "../../types/hospital";
import Icon, { type IconName } from "../../components/UiIcon";
import { ClinicalIcon } from "../../components/ClinicalIcon";
import CatalogPagination from "../../components/CatalogPagination";
import {
  PublicAiButton,
  PublicBackLink,
  PublicBookingButton,
  PublicPageShell,
} from "../../components/PublicPageShell";

interface SpecialtyMeta {
  icon: IconName;
  badge: string;
}

const SPECIALTY_CONFIGS: Record<string, SpecialtyMeta> = {
  "tim-mach": { icon: "heart", badge: "Chăm sóc chuyên sâu" },
  "than-kinh": { icon: "brain", badge: "Chăm sóc chuyên sâu" },
  "tieu-hoa": { icon: "activity", badge: "Chăm sóc chuyên sâu" },
  "noi-tong-hop": { icon: "stethoscope", badge: "Chăm sóc chuyên sâu" },
  "nhi-khoa": { icon: "sparkles", badge: "Chăm sóc chuyên sâu" },
  "san-phu-khoa": { icon: "user", badge: "Chăm sóc chuyên sâu" },
  "co-xuong-khop": { icon: "layers", badge: "Chăm sóc chuyên sâu" },
  "tai-mui-hong": { icon: "shield-check", badge: "Chăm sóc chuyên sâu" },
};

function getSpecialtyMeta(slug: string, name: string): SpecialtyMeta {
  const key = slug.toLowerCase();
  if (SPECIALTY_CONFIGS[key]) return SPECIALTY_CONFIGS[key];
  const n = name.toLowerCase();
  if (n.includes("tim")) return SPECIALTY_CONFIGS["tim-mach"];
  if (n.includes("thần")) return SPECIALTY_CONFIGS["than-kinh"];
  if (n.includes("tiêu")) return SPECIALTY_CONFIGS["tieu-hoa"];
  if (n.includes("nhi")) return SPECIALTY_CONFIGS["nhi-khoa"];
  if (n.includes("sản")) return SPECIALTY_CONFIGS["san-phu-khoa"];
  if (n.includes("xương")) return SPECIALTY_CONFIGS["co-xuong-khop"];
  if (n.includes("tai") || n.includes("họng")) return SPECIALTY_CONFIGS["tai-mui-hong"];
  return SPECIALTY_CONFIGS["noi-tong-hop"];
}

const SPECIALTY_STEPS = [
  {
    number: "01",
    title: "Đọc mô tả chuyên khoa",
    description: "Tìm xem phạm vi chăm sóc có khớp với tình trạng bạn đang quan tâm không.",
  },
  {
    number: "02",
    title: "Mở hồ sơ chi tiết",
    description: "Xem bác sĩ, triệu chứng thường gặp và lộ trình chăm sóc phù hợp hơn.",
  },
  {
    number: "03",
    title: "Đặt lịch đúng chuyên khoa",
    description: "Đi thẳng sang form đặt lịch với chuyên khoa đã chọn.",
  },
] as const;

export default function SpecialtiesPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [page, setPage] = useState<Page<Specialty> | null>(null);
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
        return fetchSpecialties(currentPage, 12);
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

  const specialties = page?.content ?? [];
  const specialtyCount = page?.totalElements ?? specialties.length;
  const featuredSpecialty = specialties[0];
  const specialtyCountLabel = loading
    ? "Đang tải…"
    : error
      ? "Chưa tải được"
      : page?.empty
        ? "Chưa có dữ liệu"
        : String(specialtyCount);
  const featuredSpecialtyLabel = loading
    ? "Đang tải…"
    : error
      ? "Chưa tải được"
      : featuredSpecialty?.name ?? "Chưa có dữ liệu";

  return (
    <PublicPageShell>
      <div className="catalog-page section-inner">
        <PublicBackLink href="/">← Về trang chính</PublicBackLink>

        <header className="resource-page__header">
          <p className="section-note">Danh mục chuyên khoa</p>
          <h1>Chuyên khoa bắt đầu từ điều bạn đang quan tâm</h1>
          <p>
            Tìm hiểu phạm vi chăm sóc của từng chuyên khoa, xem bác sĩ phù hợp và chủ động đặt lịch
            theo nhu cầu.
          </p>
        </header>

        <section className="resource-hero-card resource-hero-card--teal">
          <div className="resource-icon" aria-hidden="true">
            <ClinicalIcon name="specialty" />
          </div>
          <div className="resource-hero-card__body">
            <p className="resource-chip">Chọn chuyên khoa</p>
            <h2>Một lối vào thống nhất trước khi bạn đặt lịch.</h2>
            <p className="resource-lead">
              Dùng trợ lý triệu chứng để định hướng ban đầu, rồi mở đúng chuyên khoa hoặc bác sĩ phù
              hợp thay vì đoán mò từ đầu.
            </p>
            <div className="resource-actions">
              <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
              <PublicBookingButton selection={featuredSpecialty ? { specialtyId: featuredSpecialty.id } : undefined}>
                Đặt lịch theo chuyên khoa
              </PublicBookingButton>
              <Link className="outline-button outline-button--light" href="/services">
                Xem dịch vụ
              </Link>
            </div>
            <dl className="resource-meta-grid">
              <div>
                <dt>Tổng chuyên khoa</dt>
                <dd aria-live="polite">{specialtyCountLabel}</dd>
              </div>
              <div>
                <dt>Chuyên khoa nổi bật</dt>
                <dd aria-live="polite">{featuredSpecialtyLabel}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="resource-grid resource-grid--two">
          <section className="resource-panel resource-panel--accent">
            <p className="section-note">Cách đọc danh mục</p>
            <h2>Ba mốc để chọn nhanh</h2>
            <div className="resource-steps resource-steps--grid">
              {SPECIALTY_STEPS.map((step) => (
                <div className="resource-step-card" key={step.number}>
                  <span>{step.number}</span>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="resource-panel">
            <p className="section-note">Chuyên khoa nổi bật</p>
            <h2>Điểm bắt đầu của danh mục</h2>
            {featuredSpecialty ? (
              <>
                <p>{featuredSpecialty.description || "Chuyên khoa này chưa có phần mô tả chi tiết."}</p>
                <div className="resource-actions">
                  <Link className="text-button" href={`/specialties/${featuredSpecialty.slug}`}>
                    Mở hồ sơ chuyên khoa →
                  </Link>
                  <PublicBookingButton
                    className="outline-button outline-button--small"
                    selection={{ specialtyId: featuredSpecialty.id }}
                  >
                    Đặt lịch
                  </PublicBookingButton>
                </div>
              </>
            ) : (
              <p className="resource-muted">Danh sách chuyên khoa đang được cập nhật.</p>
            )}
          </section>
        </div>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải chuyên khoa…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Danh sách chuyên khoa đang được cập nhật.</p> : null}

        {page && !page.empty ? (
          <>
            <p className="catalog-meta">
              {page.totalElements} chuyên khoa · Trang {page.number + 1}/{page.totalPages}
            </p>
            <div className="catalog-grid catalog-grid--specialties">
              {page.content.map((specialty) => {
                const meta = getSpecialtyMeta(specialty.slug, specialty.name);
                return (
                  <article
                    className="catalog-card specialty-card"
                    key={specialty.id}
                  >
                    <div className="specialty-card__top">
                      <div
                        className="specialty-card__icon-wrap"
                        aria-hidden="true"
                      >
                        <Icon name={meta.icon} size={24} />
                      </div>
                      <span className="specialty-card__badge">
                        {meta.badge}
                      </span>
                    </div>

                    <h2 className="specialty-card__title">{specialty.name}</h2>
                    <p className="specialty-card__desc">
                      {specialty.description || "Chuyên khoa chưa có phần mô tả chi tiết."}
                    </p>

                    {specialty.commonSymptoms && specialty.commonSymptoms.length > 0 && (
                      <div className="specialty-card__symptoms">
                        <span className="specialty-card__symptoms-label">Triệu chứng thường gặp</span>
                        <div className="specialty-card__symptom-tags">
                          {specialty.commonSymptoms.slice(0, 3).map((symptom, idx) => (
                            <span className="specialty-card__symptom-pill" key={idx}>
                              {symptom}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="catalog-card__actions">
                      <Link className="text-button" href={`/specialties/${specialty.slug}`}>
                        Xem chuyên khoa →
                      </Link>
                      <PublicBookingButton
                        className="outline-button outline-button--small"
                        selection={{ specialtyId: specialty.id }}
                      >
                        Đặt lịch
                      </PublicBookingButton>
                    </div>
                  </article>
                );
              })}
            </div>
            <CatalogPagination label="Phân trang chuyên khoa" onPageChange={setCurrentPage} page={page} />
          </>
        ) : null}

        <section className="resource-panel resource-panel--accent">
          <p className="section-note">Hỗ trợ chọn chuyên khoa</p>
          <h2>Chưa biết bắt đầu ở đâu?</h2>
          <p>
            Trợ lý giúp định hướng theo thông tin bạn cung cấp. Kết quả chỉ mang tính tham khảo và
            không thay thế chẩn đoán của bác sĩ.
          </p>
          <PublicAiButton>Hỗ trợ chọn chuyên khoa</PublicAiButton>
        </section>
      </div>
    </PublicPageShell>
  );
}
