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
  PublicBookingButton,
  PublicPageShell,
} from "../../components/PublicPageShell";
import { CmsNativeSection, CmsNativeText, CmsNativeSections } from "../../components/cms/cms-page-layout-provider";

interface SpecialtyMeta {
  icon: IconName;
  badge: string;
}

const SPECIALTY_CONFIGS: Record<string, SpecialtyMeta> = {
  "tim-mach": { icon: "heart", badge: "Chuyên khoa mũi nhọn" },
  "than-kinh": { icon: "brain", badge: "Nội thần kinh & Đột quỵ" },
  "tieu-hoa": { icon: "activity", badge: "Nội soi & Tiêu hóa" },
  "noi-tong-hop": { icon: "stethoscope", badge: "Khám & Điều trị ban đầu" },
  "nhi-khoa": { icon: "sparkles", badge: "Nhi & Sơ sinh toàn diện" },
  "san-phu-khoa": { icon: "user", badge: "Phụ sản & Thai kỳ" },
  "co-xuong-khop": { icon: "layers", badge: "Cơ xương khớp & PHCN" },
  "tai-mui-hong": { icon: "shield-check", badge: "Tai Mũi Họng chuyên sâu" },
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
        ? "Chưa có chuyên khoa công khai"
        : String(specialtyCount);
  const featuredSpecialtyLabel = loading
    ? "Đang tải…"
    : error
      ? "Chưa tải được"
      : featuredSpecialty?.name ?? "Chưa chọn chuyên khoa nổi bật";

  return (
    <PublicPageShell>
      <div className="catalog-page catalog-page--directory section-inner">
        {/* The PublicRouteBreadcrumb bar above already links home; a second
            "Về trang chính" here duplicated it within one screen. */}

        <CmsNativeSection sectionId="intro">
          <header className="resource-page__header">
            <CmsNativeText fieldId="intro.eyebrow" as="p" value={"Danh mục chuyên khoa"} className="section-note">Danh mục chuyên khoa</CmsNativeText>
            <CmsNativeText fieldId="intro.title" as="h1" value={"Danh mục Chuyên khoa & Dịch vụ mũi nhọn"}>Danh mục Chuyên khoa & Dịch vụ mũi nhọn</CmsNativeText>
            <CmsNativeText fieldId="intro.body" as="p" value={"Tìm hiểu phạm vi chăm sóc y khoa, đội ngũ bác sĩ chuyên khoa và chủ động đặt lịch theo nhu cầu của bạn."}>
              Tìm hiểu phạm vi chăm sóc y khoa, đội ngũ bác sĩ chuyên khoa và chủ động đặt lịch
              theo nhu cầu của bạn.
            </CmsNativeText>
          </header>
        </CmsNativeSection>

        <CmsNativeSections>
          <CmsNativeSection sectionId="overview">
            <section className="resource-hero-card resource-hero-card--teal">
              <div className="resource-icon" aria-hidden="true">
                <ClinicalIcon name="specialty" />
              </div>
              <div className="resource-hero-card__body">
                <CmsNativeText fieldId="overview.eyebrow" as="p" value={"Chọn chuyên khoa"} className="resource-chip">Chọn chuyên khoa</CmsNativeText>
                <CmsNativeText fieldId="overview.title" as="h2" value={"Định hướng chuyên khoa chuẩn xác trước khi đặt lịch."}>Định hướng chuyên khoa chuẩn xác trước khi đặt lịch.</CmsNativeText>
                <CmsNativeText fieldId="overview.body" as="p" value={"Sử dụng trợ lý triệu chứng AI để được gợi ý chuyên khoa phù hợp, giúp Quý khách chuẩn bị chu đáo và tiết kiệm thời gian thăm khám."} className="resource-lead">
                  Sử dụng trợ lý triệu chứng AI để được gợi ý chuyên khoa phù hợp, giúp Quý khách chuẩn bị chu đáo và tiết kiệm thời gian thăm khám.
                </CmsNativeText>
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
                    <dd aria-live="polite">
                      {loading ? <span className="skeleton-line" aria-hidden="true" /> : specialtyCountLabel}
                    </dd>
                  </div>
                  <div>
                    <dt>Chuyên khoa nổi bật</dt>
                    <dd aria-live="polite">
                      {loading ? <span className="skeleton-line" aria-hidden="true" /> : featuredSpecialtyLabel}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          </CmsNativeSection>

          <CmsNativeSection sectionId="guide">
            <details className="catalog-guidance">
              <summary>Cách chọn phù hợp</summary>
              <div className="resource-grid resource-grid--two">
                <section className="resource-panel resource-panel--accent">
                  <CmsNativeText fieldId="guide.eyebrow" as="p" value={"Cách đọc danh mục"} className="section-note">Cách đọc danh mục</CmsNativeText>
                  <CmsNativeText fieldId="guide.title" as="h2" value={"Ba mốc để chọn nhanh"}>Ba mốc để chọn nhanh</CmsNativeText>
                  <div className="resource-steps resource-steps--grid">
                    {SPECIALTY_STEPS.map((step, cmsItemIndex) => (
                      <div className="resource-step-card" key={step.number}>
                        <span>{step.number}</span>
                        <CmsNativeText fieldId={`guide.step${step.number}.title`} as="strong" value={step.title}>{step.title}</CmsNativeText>
                        <CmsNativeText fieldId={`guide.step${step.number}.body`} as="p" value={step.description}>{step.description}</CmsNativeText>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="resource-panel">
                  <CmsNativeText fieldId="guide.eyebrow2" as="p" value={"Chuyên khoa nổi bật"} className="section-note">Chuyên khoa nổi bật</CmsNativeText>
                  <CmsNativeText fieldId="guide.title2" as="h2" value={"Chuyên khoa tiêu biểu"}>Chuyên khoa tiêu biểu</CmsNativeText>
                  {featuredSpecialty ? (
                    <>
                      <p>{featuredSpecialty.description || "Thông tin chuyên khoa đang được cập nhật chi tiết. Quý khách vui lòng liên hệ tổng đài hoặc đặt lịch để được bác sĩ tư vấn."}</p>
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
                    <p className="resource-muted">Chưa có chuyên khoa công khai. Bạn vẫn có thể đặt lịch hoặc hỏi trợ lý để được định hướng ban đầu.</p>
                  )}
                </section>
              </div>
            </details>
          </CmsNativeSection>
        </CmsNativeSections>

        <CmsNativeSection sectionId="directory">
          {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải chuyên khoa…</p> : null}
          {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
          {!loading && !error && page?.empty ? (
            <div className="catalog-status" role="status">
              <p>Chưa có chuyên khoa công khai. Bạn vẫn có thể đặt lịch hoặc hỏi trợ lý để được định hướng ban đầu.</p>
              <div className="resource-actions">
                <PublicAiButton className="outline-button">Hỏi trợ lý triệu chứng</PublicAiButton>
                <PublicBookingButton className="button button--amber">Đặt lịch khám</PublicBookingButton>
              </div>
            </div>
          ) : null}

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
                      </div>

                      <h2 className="specialty-card__title">{specialty.name}</h2>
                      <p className="specialty-card__desc">
                        {specialty.description || "Thông tin chuyên khoa đang được cập nhật chi tiết. Quý khách vui lòng liên hệ tổng đài hoặc đặt lịch để được bác sĩ tư vấn."}
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
        </CmsNativeSection>

        <CmsNativeSection sectionId="closing">
          <section className="resource-panel resource-panel--accent">
            <CmsNativeText fieldId="closing.eyebrow" as="p" value={"Hỗ trợ chọn chuyên khoa"} className="section-note">Hỗ trợ chọn chuyên khoa</CmsNativeText>
            <CmsNativeText fieldId="closing.title" as="h2" value={"Chưa biết bắt đầu ở đâu?"}>Chưa biết bắt đầu ở đâu?</CmsNativeText>
            <p>
              Trợ lý giúp định hướng theo thông tin bạn cung cấp. Kết quả chỉ mang tính tham khảo và
              không thay thế chẩn đoán của bác sĩ.
            </p>
            <PublicAiButton>Hỗ trợ chọn chuyên khoa</PublicAiButton>
          </section>
        </CmsNativeSection>
      </div>
    </PublicPageShell>
  );
}
