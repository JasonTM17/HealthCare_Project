"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchBranches, type Page } from "../../lib/api-client";
import type { Branch } from "../../types/hospital";
import { ClinicalIcon } from "../../components/ClinicalIcon";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

export default function BranchesPage() {
  const [page, setPage] = useState<Page<Branch> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBranches(0, 50)
      .then((data) => { if (!cancelled) setPage(data); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải cơ sở."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <PublicPageShell branches={page?.content ?? []}>
      <div className="catalog-page section-inner">
        <header className="resource-page__header"><p className="section-note">Care Rail · mạng lưới phục vụ</p><h1>Một cơ sở gần bạn, một cuộc hẹn rõ ràng</h1><p>Địa chỉ, giờ làm việc và hotline chỉ được hiển thị từ branch active trong backend.</p></header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải mạng lưới cơ sở…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có địa chỉ demo thay thế.</p> : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Backend chưa có cơ sở active.</p> : null}
        {page && !page.empty ? <div className="catalog-grid catalog-grid--branches">{page.content.map((branch) => <article className="catalog-card" key={branch.id}><span className="resource-icon resource-icon--small" aria-hidden="true"><ClinicalIcon name="branch" /></span><h2>{branch.name}</h2><p>{branch.address}</p><dl className="catalog-card__details"><div><dt>Điện thoại</dt><dd>{branch.phone || "Backend chưa cung cấp số điện thoại."}</dd></div><div><dt>Giờ làm việc</dt><dd>{branch.workingHours || "Chưa cung cấp"}</dd></div></dl><div className="catalog-card__actions"><Link className="text-button" href={`/branches/${branch.slug}`}>Xem cơ sở →</Link><PublicBookingButton className="outline-button outline-button--small" selection={{ branchId: branch.id }}>Đặt lịch</PublicBookingButton></div></article>)}</div> : null}
      </div>
    </PublicPageShell>
  );
}
