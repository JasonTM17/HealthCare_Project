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
        ? "Chưa có dữ liệu"
        : String(packageCount);
  const featuredPackageLabel = loading
    ? "Đang tải…"
    : error
      ? "Chưa tải được"
      : featuredPackage?.name ?? "Chưa có dữ liệu";

  return (
    <PublicPageShell packages={page?.content ?? []}>
      <div className="catalog-page section-inner">
        <header className={packageVisualStyles.catalogIntro}>
          <div>
            <p className="section-note">Gói khám sức khỏe</p>
            <h1>Chủ động kiểm tra, bắt đầu từ điều phù hợp</h1>
            <p>
              Đối chiếu đối tượng phù hợp, hạng mục chính và chi phí của từng gói trước khi đặt lịch.
            </p>
          </div>
          <aside className={packageVisualStyles.catalogGuide} aria-label="Hướng dẫn chọn gói khám">
            <strong>Một lựa chọn rõ ràng hơn</strong>
            <p>Mở từng gói để xem đầy đủ nội dung và hướng dẫn chuẩn bị trước khi đến bệnh viện.</p>
          </aside>
        </header>

        <section className="resource-hero-card resource-hero-card--teal">
          <div className="resource-icon" aria-hidden="true">
            <ClinicalIcon name="service" />
          </div>
          <div className="resource-hero-card__body">
            <p className="resource-chip">Danh mục gói khám</p>
            <h2>Một nơi để so sánh gói khám trước khi bạn quyết định.</h2>
            <p className="resource-lead">
              Duyệt theo nhu cầu, đọc mục tiêu và mở lịch ngay cho gói phù hợp thay vì phải dò qua
              nhiều trang riêng lẻ.
            </p>
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

        <div className="resource-grid resource-grid--two">
          <section className="resource-panel resource-panel--accent">
            <p className="section-note">Cách chọn gói</p>
            <h2>Ba mốc để đọc nhanh</h2>
            <div className="resource-steps resource-steps--grid">
              {PACKAGE_STEPS.map((step) => (
                <div className="resource-step-card" key={step.number}>
                  <span>{step.number}</span>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="resource-panel">
            <p className="section-note">Mẹo trước khi đặt</p>
            <h2>Đọc thêm trước khi mở form</h2>
            <ul className="resource-list">
              <li>
                <strong>So sánh đối tượng phù hợp</strong>
                <span>Gói dành cho cá nhân, gia đình hoặc tầm soát khác nhau về ưu tiên khám.</span>
              </li>
              <li>
                <strong>Xem chuẩn bị trước buổi khám</strong>
                <span>Một vài gói cần nhịn ăn, mang hồ sơ cũ hoặc sắp xếp thời gian riêng.</span>
              </li>
              <li>
                <strong>Đặt lịch theo gói đã chọn</strong>
                <span>Mỗi gói đều có thể đi thẳng sang form đặt lịch để giữ khung giờ phù hợp.</span>
              </li>
            </ul>
          </section>
        </div>

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
          <p className="catalog-status" role="status">
            Danh sách gói khám đang được cập nhật.
          </p>
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
                    <PublicBookingButton className={packageVisualStyles.bookButton} selection={{ packageId: item.id }}>
                      Đặt lịch
                    </PublicBookingButton>
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
      </div>
    </PublicPageShell>
  );
}
