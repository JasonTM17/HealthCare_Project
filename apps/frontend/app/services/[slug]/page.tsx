"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchServiceBySlug } from "../../../lib/api-client";
import type { MedicalService } from "../../../types/hospital";
import { ClinicalIcon } from "../../../components/ClinicalIcon";
import { PublicAiButton, PublicBackLink, PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";

const SERVICE_STEPS = [
  ["01", "Đọc mô tả", "Xác nhận đây có phải dịch vụ phù hợp với nhu cầu hiện tại không."],
  ["02", "So sánh gói liên quan", "Mở sang gói khám nếu bạn muốn xem phạm vi chăm sóc rộng hơn."],
  ["03", "Đặt lịch", "Khi đã chắc chắn, đi thẳng sang form đặt lịch để giữ khung giờ."],
] as const;

export default function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [service, setService] = useState<MedicalService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setService(null);
        setLoading(true);
        setError(null);
        return fetchServiceBySlug(slug);
      })
      .then((data) => { if (data !== undefined && !cancelled) setService(data); })
      .catch(() => { if (!cancelled) setError("Tạm thời chưa thể tải thông tin dịch vụ. Vui lòng thử lại sau."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <PublicPageShell>
      <div className="resource-page section-inner">
        <PublicBackLink href="/services">← Quay lại danh mục dịch vụ</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Dịch vụ y tế</p>
          <h1>Dịch vụ chăm sóc theo nhu cầu</h1>
          <p>Tìm hiểu thông tin dịch vụ và đặt lịch trao đổi với đội ngũ chuyên môn.</p>
        </header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải dịch vụ…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && !service ? <p className="catalog-status" role="status">Không tìm thấy thông tin dịch vụ này.</p> : null}
        {service ? (
          <>
            <article className="resource-hero-card resource-hero-card--teal">
              <div className="resource-icon" aria-hidden="true">
                <ClinicalIcon name="service" />
              </div>
              <div className="resource-hero-card__body">
                <span className="resource-chip">Dịch vụ</span>
                <h2>{service.name}</h2>
                <p className="resource-lead">{service.description || "Thông tin chi tiết của dịch vụ đang được cập nhật."}</p>
                <div className="resource-actions">
                  <PublicBookingButton>Trao đổi nhu cầu và đặt lịch</PublicBookingButton>
                  <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
                  <Link className="outline-button outline-button--light" href="/packages">Xem gói khám liên quan</Link>
                </div>
                <dl className="resource-meta-grid">
                  <div>
                    <dt>Loại nội dung</dt>
                    <dd>Dịch vụ công khai</dd>
                  </div>
                  <div>
                    <dt>Hành động tiếp theo</dt>
                    <dd>Đặt lịch hoặc xem gói khám</dd>
                  </div>
                </dl>
              </div>
            </article>

            <section className="resource-panel resource-panel--wide">
              <div className="section-heading">
                <div>
                  <p className="section-note">Cách dùng dịch vụ</p>
                  <h2>Ba bước trước khi chốt lựa chọn</h2>
                </div>
              </div>
              <div className="resource-steps resource-steps--grid">
                {SERVICE_STEPS.map(([number, title, description]) => (
                  <div className="resource-step-card" key={number}>
                    <span>{number}</span>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="resource-grid resource-grid--two">
              <section className="resource-panel resource-panel--accent">
                <p className="section-note">Khi nào nên dùng</p>
                <h2>Chọn dịch vụ khi bạn đã có nhu cầu rõ hơn</h2>
                <p>
                  Nếu bạn biết mình đang cần hỗ trợ ở nhóm dịch vụ nào, đây là điểm vào nhanh trước
                  khi mở gói khám hoặc đặt lịch.
                </p>
              </section>
              <section className="resource-panel">
                <p className="section-note">Đi tiếp sau khi đọc</p>
                <h2>Không cần vòng qua nhiều trang</h2>
                <p>Mở gói khám để so sánh phạm vi chăm sóc, hoặc đặt lịch ngay khi đã sẵn sàng.</p>
                <div className="resource-actions">
                  <Link className="text-button" href="/packages">Xem gói khám →</Link>
                  <PublicBookingButton className="outline-button outline-button--small">Đặt lịch</PublicBookingButton>
                </div>
              </section>
            </section>
          </>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
