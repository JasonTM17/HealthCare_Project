"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchServiceBySlug } from "../../../lib/api-client";
import type { MedicalService } from "../../../types/hospital";
import { ClinicalIcon } from "../../../components/ClinicalIcon";
import { PublicBackLink, PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";

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
        <header className="resource-page__header"><p className="section-note">Dịch vụ y tế</p><h1>Dịch vụ chăm sóc theo nhu cầu</h1><p>Tìm hiểu thông tin dịch vụ và đặt lịch trao đổi với đội ngũ chuyên môn.</p></header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải dịch vụ…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && !service ? <p className="catalog-status" role="status">Không tìm thấy thông tin dịch vụ này.</p> : null}
        {service ? <article className="resource-hero-card resource-hero-card--teal"><div className="resource-icon" aria-hidden="true"><ClinicalIcon name="service" /></div><div className="resource-hero-card__body"><span className="resource-chip">Dịch vụ</span><h2>{service.name}</h2><p>{service.description || "Thông tin chi tiết của dịch vụ đang được cập nhật."}</p><div className="resource-actions"><PublicBookingButton>Trao đổi nhu cầu và đặt lịch</PublicBookingButton><Link className="outline-button outline-button--light" href="/packages">Xem gói khám liên quan</Link></div></div></article> : null}
      </div>
    </PublicPageShell>
  );
}
