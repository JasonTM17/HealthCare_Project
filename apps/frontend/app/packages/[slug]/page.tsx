"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { packageVisualStyles } from "../../../components/PackageVisualCard";
import { PublicAiButton, PublicBackLink, PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";
import { fetchPackageBySlug } from "../../../lib/api-client";
import { getPackageVisual } from "../../../lib/package-visuals";
import type { HealthPackage } from "../../../types/hospital";

const currency = (price: number) => new Intl.NumberFormat("vi-VN").format(price);
const PACKAGE_DETAIL_STEPS = [
  ["01", "Xem đối tượng phù hợp", "Đối chiếu nhu cầu của bạn với phần mô tả và nhóm người dùng của gói."],
  ["02", "Kiểm tra nội dung khám", "Đọc checklist và bước chuẩn bị để tránh thiếu giấy tờ hoặc thông tin cần thiết."],
  ["03", "Giữ lịch khám", "Đặt lịch với đúng gói để hệ thống chuyển lựa chọn sang form đặt hẹn."],
] as const;

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
      .catch(() => { if (!cancelled) setError("Tạm thời chưa thể tải thông tin gói khám. Vui lòng thử lại sau."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [slug]);

  const visual = item ? getPackageVisual(item) : null;

  return (
    <PublicPageShell packages={item ? [item] : []}>
      <div className="resource-page section-inner">
        <PublicBackLink href="/packages">← Quay lại danh mục gói khám</PublicBackLink>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải gói khám…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && !item ? <p className="catalog-status" role="status">Không tìm thấy thông tin gói khám này.</p> : null}

        {item && visual ? (
          <>
            <article className={`${packageVisualStyles.detailHero} ${packageVisualStyles[`tone-${visual.tone}`]}`}>
              <figure className={packageVisualStyles.detailMedia}>
                <Image
                  alt={visual.imageAlt}
                  className={packageVisualStyles.image}
                  fill
                  priority
                  sizes="(max-width: 760px) 100vw, 46vw"
                  src={visual.imageSrc}
                />
                <figcaption className={packageVisualStyles.detailCredit}>
                  Ảnh minh họa: <a href={visual.sourceHref} rel="noreferrer" target="_blank">{visual.sourceLabel}</a>
                </figcaption>
              </figure>

              <div className={packageVisualStyles.detailContent}>
                <span className={packageVisualStyles.detailCategory}>{visual.category}</span>
                <h1>{item.name}</h1>
                <p className={packageVisualStyles.detailDescription}>{item.description || "Gói khám chưa có mô tả chi tiết."}</p>
                <p className={packageVisualStyles.detailPrice}>
                  <small>Chi phí gói</small>
                  <strong>{currency(item.price)} <span>VNĐ</span></strong>
                </p>

                {item.targetAudience || item.durationDays ? (
                  <dl className={packageVisualStyles.metaGrid}>
                    {item.targetAudience ? <div><dt>Phù hợp với</dt><dd>{item.targetAudience}</dd></div> : null}
                    {item.durationDays ? <div><dt>Thời lượng dự kiến</dt><dd>{item.durationDays} ngày</dd></div> : null}
                  </dl>
                ) : null}

                <div className="resource-actions">
                  <PublicBookingButton className={packageVisualStyles.detailAction} selection={{ packageId: item.id }}>
                    Đặt lịch với gói này
                  </PublicBookingButton>
                  <PublicAiButton className="outline-button">Hỏi trợ lý triệu chứng</PublicAiButton>
                </div>
              </div>
            </article>

            <section className="resource-panel resource-panel--wide">
              <div className="section-heading">
                <div>
                  <p className="section-note">Cách chọn gói khám</p>
                  <h2>Ba bước trước khi xác nhận</h2>
                </div>
              </div>
              <div className="resource-steps resource-steps--grid">
                {PACKAGE_DETAIL_STEPS.map(([number, title, description]) => (
                  <div className="resource-step-card" key={number}>
                    <span>{number}</span>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className={packageVisualStyles.detailSections}>
              <section className={packageVisualStyles.detailPanel}>
                <p className="section-note">Các bước kiểm tra</p>
                <h2>Nội dung trong gói</h2>
                {item.checklist?.length ? (
                  <ol className={packageVisualStyles.detailList}>
                    {item.checklist.map((entry) => <li key={entry}>{entry}</li>)}
                  </ol>
                ) : <p className={packageVisualStyles.emptyDetail}>Nội dung chi tiết của gói khám đang được cập nhật.</p>}
              </section>

              <section className={packageVisualStyles.detailPanel}>
                <p className="section-note">Trước buổi khám</p>
                <h2>Chuẩn bị trước khi đến</h2>
                {item.preparationSteps?.length ? (
                  <ol className={packageVisualStyles.detailList}>
                    {item.preparationSteps.map((entry) => <li key={entry}>{entry}</li>)}
                  </ol>
                ) : <p className={packageVisualStyles.emptyDetail}>Hướng dẫn chuẩn bị đang được cập nhật.</p>}
              </section>
            </div>
          </>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
