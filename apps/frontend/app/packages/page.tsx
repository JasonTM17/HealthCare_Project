"use client";

import { useEffect, useState } from "react";
import PackageVisualCard, { packageVisualStyles } from "../../components/PackageVisualCard";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import { fetchPackages, type Page } from "../../lib/api-client";
import type { HealthPackage } from "../../types/hospital";

export default function PackagesPage() {
  const [page, setPage] = useState<Page<HealthPackage> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPackages(0, 50)
      .then((data) => { if (!cancelled) setPage(data); })
      .catch(() => { if (!cancelled) setError("Tạm thời chưa thể tải danh sách gói khám. Vui lòng thử lại sau."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <PublicPageShell packages={page?.content ?? []}>
      <div className="catalog-page section-inner">
        <header className={packageVisualStyles.catalogIntro}>
          <div>
            <p className="section-note">Gói khám sức khỏe</p>
            <h1>Chọn gói khám theo nhu cầu của bạn</h1>
            <p>Đối chiếu đối tượng phù hợp, hạng mục chính và chi phí của từng gói trước khi đặt lịch.</p>
          </div>
          <aside className={packageVisualStyles.catalogGuide} aria-label="Hướng dẫn chọn gói khám">
            <strong>Một lựa chọn rõ ràng hơn</strong>
            <p>Mở từng gói để xem đầy đủ nội dung và hướng dẫn chuẩn bị trước khi đến bệnh viện.</p>
          </aside>
        </header>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải danh mục gói khám…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Danh sách gói khám đang được cập nhật.</p> : null}

        {page && !page.empty ? (
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
        ) : null}
      </div>
    </PublicPageShell>
  );
}
