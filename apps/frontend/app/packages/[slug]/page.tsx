"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchPackageBySlug } from "../../../lib/api-client";
import type { HealthPackage } from "../../../types/hospital";
import { PublicBackLink, PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";

const currency = (price: number) => new Intl.NumberFormat("vi-VN").format(price);

export default function PackageDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [item, setItem] = useState<HealthPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setItem(null);
        setLoading(true);
        setError(null);
        return fetchPackageBySlug(slug);
      })
      .then((data) => { if (data !== undefined && !cancelled) setItem(data); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải gói khám."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <PublicPageShell packages={item ? [item] : []}>
      <div className="resource-page section-inner">
        <PublicBackLink href="/packages">← Quay lại danh mục gói khám</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Gói khám · catalog backend</p>
          <h1>Chủ động kiểm tra, bắt đầu từ điều phù hợp</h1>
          <p>Giá và mô tả chỉ hiển thị khi backend trả về bản ghi active.</p>
        </header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải gói khám…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có gói demo thay thế.</p> : null}
        {!loading && !error && !item ? <p className="catalog-status" role="status">Không tìm thấy gói khám active.</p> : null}
        {item ? (
          <article className="resource-hero-card">
            <div className="resource-icon resource-icon--warm" aria-hidden="true">✦</div>
            <div className="resource-hero-card__body">
              <span className="resource-chip resource-chip--warm">Gói khám active</span>
              <h2>{item.name}</h2>
              <p className="resource-price">{currency(item.price)} <span>VNĐ</span></p>
              <p>{item.description || "Gói khám chưa có mô tả chi tiết."}</p>
              {item.targetAudience || item.durationDays ? (
                <dl className="resource-meta-grid">
                  {item.targetAudience ? <div><dt>Phù hợp với</dt><dd>{item.targetAudience}</dd></div> : null}
                  {item.durationDays ? <div><dt>Thời lượng dự kiến</dt><dd>{item.durationDays} ngày</dd></div> : null}
                </dl>
              ) : null}
              <section className="resource-detail-block">
                <p className="section-note">Nội dung gói</p>
                {item.checklist?.length ? <ul className="resource-list">{item.checklist.map((entry) => <li key={entry}>{entry}</li>)}</ul> : <p className="resource-muted">Backend hiện chưa trả về checklist dịch vụ cho gói này.</p>}
              </section>
              <section className="resource-detail-block">
                <p className="section-note">Chuẩn bị trước khi đến</p>
                {item.preparationSteps?.length ? <ul className="resource-list">{item.preparationSteps.map((entry) => <li key={entry}>{entry}</li>)}</ul> : <p className="resource-muted">Backend hiện chưa trả về hướng dẫn chuẩn bị cho gói này.</p>}
              </section>
              <div className="resource-actions"><PublicBookingButton selection={{ packageId: item.id }}>Đặt lịch với gói này</PublicBookingButton></div>
            </div>
          </article>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
