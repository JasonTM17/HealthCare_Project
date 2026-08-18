"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchServices, type Page } from "../../lib/api-client";
import type { MedicalService } from "../../types/hospital";
import { ClinicalIcon } from "../../components/ClinicalIcon";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

export default function ServicesPage() {
  const [page, setPage] = useState<Page<MedicalService> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchServices(0, 50)
      .then((data) => { if (!cancelled) setPage(data); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải dịch vụ."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <PublicPageShell>
      <div className="catalog-page section-inner">
        <header className="resource-page__header"><p className="section-note">Danh mục chăm sóc · backend active</p><h1>Dịch vụ cho từng nhu cầu chăm sóc</h1><p>Mỗi thẻ bên dưới tương ứng với một bản ghi dịch vụ active từ API bệnh viện.</p></header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải danh mục dịch vụ…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có dịch vụ demo thay thế.</p> : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Backend chưa có dịch vụ active.</p> : null}
        {page && !page.empty ? <div className="catalog-grid">{page.content.map((service) => <article className="catalog-card" key={service.id}><span className="resource-icon resource-icon--small" aria-hidden="true"><ClinicalIcon name="service" /></span><h2>{service.name}</h2><p>{service.description || "Dịch vụ chưa có mô tả chi tiết."}</p><div className="catalog-card__actions"><Link className="text-button" href={`/services/${service.slug}`}>Xem chi tiết →</Link><PublicBookingButton className="outline-button outline-button--small">Trao đổi nhu cầu</PublicBookingButton></div></article>)}</div> : null}
      </div>
    </PublicPageShell>
  );
}
