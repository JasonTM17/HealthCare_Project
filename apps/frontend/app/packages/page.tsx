"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ClinicalIcon from "../../components/ClinicalIcon";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import { ApiError, fetchPackages, subscribeToCatalogChange, type Page } from "../../lib/api-client";
import { presentApiError } from "../../lib/present-api-error";
import type { HealthPackage } from "../../types/hospital";
import CatalogPagination from "../../components/CatalogPagination";
import PackageVisualCard, { packageVisualStyles } from "../../components/PackageVisualCard";
import PackageBookingModal from "../../components/PackageBookingModal";
import { isCmsPreviewRequested } from "../../lib/cms-preview-bridge";
import { CmsNativeSection, CmsNativeText, CmsNativeSections } from "../../components/cms/cms-page-layout-provider";

const PACKAGE_STEPS = [
  {
    number: "01",
    title: "Chọn đối tượng phù hợp",
    description: "Xem gói nào dành cho người lớn, gia đình hay nhu cầu tầm soát cụ thể.",
  },
  {
    number: "02",
    title: "Đọc hạng mục chính",
    description: "So sánh nội dung khám, thời lượng và các bước chuẩn bị đi kèm.",
  },
  {
    number: "03",
    title: "Đặt lịch theo gói",
    description: "Mở form đặt lịch để giữ khung giờ phù hợp với gói bạn đã chọn.",
  },
] as const;

export default function PackagesPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState<Page<HealthPackage> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackageForModal, setSelectedPackageForModal] = useState<HealthPackage | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToCatalogChange((detail) => {
      if (detail.kind === "package") {
        setReloadKey((k) => k + 1);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        setPage(null);
        return fetchPackages(currentPage, 8);
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
  }, [currentPage, reloadKey]);

  const packages = page?.content ?? [];
  const packageCount = page?.totalElements ?? packages.length;
  const featuredPackage = packages[0];
  const packageCountLabel = loading
    ? "Đang tải…"
    : error
      ? "Chưa tải được"
      : page?.empty
        ? "Chưa có gói công khai"
        : String(packageCount);
  const featuredPackageLabel = loading
    ? "Đang tải…"
    : error
      ? "Chưa tải được"
      : featuredPackage?.name ?? "Chưa chọn gói nổi bật";

  return (
    <PublicPageShell packages={page?.content ?? []}>
      <div className="catalog-page catalog-page--directory section-inner">
        <CmsNativeSection sectionId="intro">
          <header className={packageVisualStyles.catalogIntro}>
            <div>
              <CmsNativeText fieldId="intro.eyebrow" as="p" value={"Gói khám sức khỏe"} className="section-note">Gói khám sức khỏe</CmsNativeText>
              <CmsNativeText fieldId="intro.title" as="h1" value={"Gói Khám & Tầm Soát Sức Khỏe Định Kỳ"}>Gói Khám & Tầm Soát Sức Khỏe Định Kỳ</CmsNativeText>
              <CmsNativeText fieldId="intro.body" as="p" value={"Minh bạch chi phí, danh mục xét nghiệm và các bước chuẩn bị trước khi thăm khám."}>
                Minh bạch chi phí, danh mục xét nghiệm và các bước chuẩn bị trước khi thăm khám.
              </CmsNativeText>
            </div>
            <aside className={packageVisualStyles.catalogGuide} aria-label="Hướng dẫn chọn gói khám">
              <CmsNativeText fieldId="intro.title2" as="strong" value={"Lựa chọn phù hợp cho bạn"}>Lựa chọn phù hợp cho bạn</CmsNativeText>
              <CmsNativeText fieldId="intro.body2" as="p" value={"Xem chi tiết từng gói khám để chuẩn bị tốt nhất trước khi đến bệnh viện."}>Xem chi tiết từng gói khám để chuẩn bị tốt nhất trước khi đến bệnh viện.</CmsNativeText>
            </aside>
          </header>
        </CmsNativeSection>

        <CmsNativeSections>
          <CmsNativeSection sectionId="overview">
            <section className="resource-hero-card resource-hero-card--teal">
              <div className="resource-icon" aria-hidden="true">
                <ClinicalIcon name="service" />
              </div>
              <div className="resource-hero-card__body">
                <CmsNativeText fieldId="overview.eyebrow" as="p" value={"Danh mục gói khám"} className="resource-chip">Danh mục gói khám</CmsNativeText>
                <CmsNativeText fieldId="overview.title" as="h2" value={"Tra cứu và so sánh các gói khám toàn diện"}>Tra cứu và so sánh các gói khám toàn diện</CmsNativeText>
                <CmsNativeText fieldId="overview.body" as="p" value={"Duyệt theo nhu cầu tầm soát cá nhân hoặc gia đình và đặt lịch nhanh chóng tại cơ sở thuận tiện."} className="resource-lead">
                  Duyệt theo nhu cầu tầm soát cá nhân hoặc gia đình và đặt lịch nhanh chóng tại cơ sở thuận tiện.
                </CmsNativeText>
                <div className="resource-actions">
                  <PublicBookingButton>Đặt lịch khám</PublicBookingButton>
                  <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
                  <Link className="outline-button outline-button--light" href="/specialties">
                    Xem chuyên khoa
                  </Link>
                </div>
                <dl className="resource-meta-grid">
                  <div>
                    <dt>Tổng gói</dt>
                    <dd aria-live="polite">{packageCountLabel}</dd>
                  </div>
                  <div>
                    <dt>Gói nổi bật</dt>
                    <dd aria-live="polite">{featuredPackageLabel}</dd>
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
                  <CmsNativeText fieldId="guide.eyebrow" as="p" value={"Cách chọn gói"} className="section-note">Cách chọn gói</CmsNativeText>
                  <CmsNativeText fieldId="guide.title" as="h2" value={"Ba mốc để đọc nhanh"}>Ba mốc để đọc nhanh</CmsNativeText>
                  <div className="resource-steps resource-steps--grid">
                    {PACKAGE_STEPS.map((step, cmsItemIndex) => (
                      <div className="resource-step-card" key={step.number}>
                        <span>{step.number}</span>
                        <CmsNativeText fieldId={`guide.step${step.number}.title`} as="strong" value={step.title}>{step.title}</CmsNativeText>
                        <CmsNativeText fieldId={`guide.step${step.number}.body`} as="p" value={step.description}>{step.description}</CmsNativeText>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="resource-panel">
                  <CmsNativeText fieldId="guide.eyebrow2" as="p" value={"Mẹo trước khi đặt"} className="section-note">Mẹo trước khi đặt</CmsNativeText>
                  <CmsNativeText fieldId="guide.title2" as="h2" value={"Đọc thêm trước khi mở form"}>Đọc thêm trước khi mở form</CmsNativeText>
                  <ul className="resource-list">
                    <li>
                      <CmsNativeText fieldId="guide.title3" as="strong" value={"So sánh đối tượng phù hợp"}>So sánh đối tượng phù hợp</CmsNativeText>
                      <CmsNativeText fieldId="guide.label" as="span" value={"Gói dành cho cá nhân, gia đình hoặc tầm soát khác nhau về ưu tiên khám."}>Gói dành cho cá nhân, gia đình hoặc tầm soát khác nhau về ưu tiên khám.</CmsNativeText>
                    </li>
                    <li>
                      <CmsNativeText fieldId="guide.title4" as="strong" value={"Xem chuẩn bị trước buổi khám"}>Xem chuẩn bị trước buổi khám</CmsNativeText>
                      <span>Một vài gói cần nhịn ăn, mang hồ sơ cũ hoặc sắp xếp thời gian riêng.</span>
                    </li>
                    <li>
                      <CmsNativeText fieldId="guide.title5" as="strong" value={"Đặt lịch theo gói đã chọn"}>Đặt lịch theo gói đã chọn</CmsNativeText>
                      <CmsNativeText fieldId="guide.label2" as="span" value={"Mỗi gói đều có thể đi thẳng sang form đặt lịch để giữ khung giờ phù hợp."}>Mỗi gói đều có thể đi thẳng sang form đặt lịch để giữ khung giờ phù hợp.</CmsNativeText>
                    </li>
                  </ul>
                </section>
              </div>
            </details>
          </CmsNativeSection>
        </CmsNativeSections>

        <CmsNativeSection sectionId="directory">
          {loading ? (
            <p className="catalog-status catalog-status--loading" role="status">
              Đang tải danh mục gói khám…
            </p>
          ) : null}
          {error ? (
            <p className="catalog-status catalog-status--error" role="alert">
              {error} Bạn có thể thử lại sau hoặc liên hệ bệnh viện để được tư vấn.
            </p>
          ) : null}
          {!loading && !error && page?.empty ? (
            <div className="catalog-status" role="status">
              <p>Chưa có gói khám công khai. Bạn vẫn có thể đặt lịch khám hoặc xem chuyên khoa phù hợp.</p>
              <div className="resource-actions">
                <PublicBookingButton className="button button--amber">Đặt lịch khám</PublicBookingButton>
                <Link className="outline-button outline-button--small" href="/specialties">Xem chuyên khoa</Link>
              </div>
            </div>
          ) : null}

          {page && !page.empty ? (
            <>
              <p className="catalog-meta">
                {page.totalElements} gói khám · Trang {page.number + 1}/{page.totalPages}
              </p>
              <div className={packageVisualStyles.catalogGrid}>
                {page.content.map((item, index) => (
                  <PackageVisualCard
                    bookingAction={
                      <button
                        aria-label={`Đặt lịch với gói này: ${item.name}`}
                        type="button"
                        className={packageVisualStyles.bookButton}
                        onClick={() => { if (!isCmsPreviewRequested()) setSelectedPackageForModal(item); }}
                      >
                        Đặt lịch với gói này
                      </button>
                    }
                    headingLevel="h2"
                    key={item.id}
                    packageItem={item}
                    priority={index < 2}
                  />
                ))}
              </div>
              <CatalogPagination label="Phân trang gói khám" onPageChange={setCurrentPage} page={page} />
            </>
          ) : null}
        </CmsNativeSection>

        <CmsNativeSection sectionId="booking">
          {selectedPackageForModal ? (
            <PackageBookingModal
              isOpen={Boolean(selectedPackageForModal)}
              onClose={() => setSelectedPackageForModal(null)}
              packageItem={selectedPackageForModal}
            />
          ) : null}
        </CmsNativeSection>
      </div>
    </PublicPageShell>
  );
}
