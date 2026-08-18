"use client";

import { useEffect, useState } from "react";
import { fetchBranches, type Page } from "../../lib/api-client";
import type { Branch } from "../../types/hospital";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

export default function ContactPage() {
  const [page, setPage] = useState<Page<Branch> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      try {
        const data = await fetchBranches(0, 50);
        if (!cancelled) setPage(data);
      } catch (reason: unknown) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải kênh liên hệ.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; void task; };
  }, []);

  const contactBranch = page?.content.find((branch) => branch.phone);
  const contactPhone = contactBranch?.phone;
  const contactHref = contactPhone ? `tel:${contactPhone.replace(/\s/g, "")}` : undefined;

  return <PublicPageShell branches={page?.content ?? []}><div className="resource-page section-inner"><header className="resource-page__header"><p className="section-note">Hỗ trợ người bệnh</p><h1>Liên hệ khi bạn cần một điểm bắt đầu</h1><p>Thông tin cơ sở và số điện thoại được lấy từ branch active. Tình huống khẩn cấp cần gọi hotline phù hợp hoặc đến cơ sở gần nhất.</p></header>{loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải thông tin liên hệ…</p> : null}{error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có địa chỉ demo thay thế.</p> : null}{!loading && !error && (!page || page.empty) ? <p className="catalog-status" role="status">Backend chưa có cơ sở active để cung cấp thông tin liên hệ.</p> : null}<div className="resource-grid resource-grid--two"><section className="resource-panel resource-panel--accent"><p className="section-note">Liên hệ cơ sở</p><h2>{contactPhone || "Backend chưa cung cấp hotline"}</h2><p>{contactBranch ? `Số điện thoại lấy từ ${contactBranch.name}.` : "Không tự dựng số điện thoại khi catalog chưa trả về dữ liệu."}</p>{contactHref ? <a className="button button--amber" href={contactHref}>Gọi cơ sở</a> : null}</section><section className="resource-panel"><p className="section-note">Hỗ trợ trực tuyến</p><h2>Đặt lịch hoặc tra cứu</h2><p>Chọn catalog, giữ một khung giờ, hoặc tra cứu bằng mã lịch hẹn và số điện thoại.</p><div className="resource-actions"><PublicBookingButton>Đặt lịch khám</PublicBookingButton><a className="outline-button" href="/tra-cuu">Tra cứu lịch hẹn</a></div></section></div>{page && !page.empty ? <section className="resource-panel resource-panel--wide"><p className="section-note">Cơ sở active</p><div className="catalog-grid catalog-grid--branches">{page.content.map((branch) => <article className="catalog-card" key={branch.id}><h2>{branch.name}</h2><p>{branch.address}</p>{branch.phone ? <a className="text-button" href={`tel:${branch.phone.replace(/\s/g, "")}`}>{branch.phone} →</a> : <p className="resource-muted">Backend chưa cung cấp số điện thoại.</p>}</article>)}</div></section> : null}</div></PublicPageShell>;
}
