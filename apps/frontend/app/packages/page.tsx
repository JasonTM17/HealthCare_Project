"use client";

import { useEffect, useState } from "react";
import { fetchPackages, type Page } from "../../lib/api-client";
import type { HealthPackage } from "../../types/hospital";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import CatalogPagination from "../../components/CatalogPagination";
import PackageVisualCard, { packageVisualStyles } from "../../components/PackageVisualCard";

export default function PackagesPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [page, setPage] = useState<Page<HealthPackage> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setLoading(true);
      setError(null);
      setPage(null);
      return fetchPackages(currentPage, 8);
    })
      .then((data) => { if (data !== undefined && !cancelled) setPage(data); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải gói khám."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [currentPage]);

  return (
    <PublicPageShell packages={page?.content ?? []}>
      <div className="catalog-page section-inner">
        <header className={packageVisualStyles.catalogIntro}>
          <div>
            <p className="section-note">Gói khám sức khỏe</p>
            <h1>Chủ động kiểm tra, bắt đầu từ điều phù hợp</h1>
            <p>Đối chiếu đối tượng phù hợp, hạng mục chính và chi phí của từng gói trước khi đặt lịch.</p>
          </div>
          <aside className={packageVisualStyles.catalogGuide} aria-label="Hướng dẫn chọn gói khám">
            <strong>Một lựa chọn rõ ràng hơn</strong>
            <p>Mở từng gói để xem đầy đủ nội dung và hướng dẫn chuẩn bị trước khi đến bệnh viện.</p>
          </aside>
        </header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải danh mục gói khám…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có gói khám demo thay thế.</p> : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Danh sách gói khám đang được cập nhật.</p> : null}
        {page && !page.empty ? (
          <>
            <p className="catalog-meta">{page.totalElements} gói khám · Trang {page.number + 1}/{page.totalPages}</p>
            <div className={packageVisualStyles.catalogGrid}>
              {page.content.map((item, index) => (
                <PackageVisualCard
                  bookingAction={(
                    <PublicBookingButton className={packageVisualStyles.bookButton} selection={{ packageId: item.id }}>
                      Đặt lịch
                    </PublicBookingButton>
                  )}
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
