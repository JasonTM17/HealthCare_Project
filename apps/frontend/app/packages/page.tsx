"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchPackages, type Page } from "../../lib/api-client";
import type { HealthPackage } from "../../types/hospital";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import CatalogPagination from "../../components/CatalogPagination";

const currency = (price: number) => new Intl.NumberFormat("vi-VN").format(price);

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
        <header className="resource-page__header"><p className="section-note">Care Rail · gói khám</p><h1>Chủ động kiểm tra, bắt đầu từ điều phù hợp</h1><p>So sánh các lựa chọn active trong catalog backend. Giá và mô tả không được thay thế bằng dữ liệu tĩnh khi API lỗi.</p></header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải danh mục gói khám…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có gói khám demo thay thế.</p> : null}
        {!loading && !error && page?.empty ? <p className="catalog-status" role="status">Backend chưa có gói khám active.</p> : null}
        {page && !page.empty ? <><p className="catalog-meta">{page.totalElements} gói khám · Trang {page.number + 1}/{page.totalPages}</p><div className="catalog-grid catalog-grid--packages">{page.content.map((item) => <article className="catalog-card" key={item.id}><div className="catalog-card__topline"><span className="resource-chip resource-chip--warm">{item.featured ? "Được đề xuất" : "Gói khám"}</span><span className="catalog-card__price">{currency(item.price)} VNĐ</span></div><h2>{item.name}</h2><p>{item.description}</p><div className="catalog-card__actions"><Link className="text-button" href={`/packages/${item.slug}`}>Xem chi tiết →</Link><PublicBookingButton className="outline-button outline-button--small" selection={{ packageId: item.id }}>Đặt lịch</PublicBookingButton></div></article>)}</div><CatalogPagination label="Phân trang gói khám" onPageChange={setCurrentPage} page={page} /></> : null}
      </div>
    </PublicPageShell>
  );
}
