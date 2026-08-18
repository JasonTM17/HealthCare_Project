"use client";

import { useEffect, useState } from "react";
import { fetchBranches, type Page } from "../../lib/api-client";
import type { Branch } from "../../types/hospital";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

export default function ContactPage() {
  const [page, setPage] = useState<Page<Branch> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchBranches(0, 50).then((data) => { if (!cancelled) setPage(data); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải kênh liên hệ."); });
    return () => { cancelled = true; };
  }, []);
  return <PublicPageShell branches={page?.content ?? []}><div className="resource-page section-inner"><header className="resource-page__header"><p className="section-note">Hỗ trợ người bệnh</p><h1>Liên hệ khi bạn cần một điểm bắt đầu</h1><p>Thông tin cơ sở và số điện thoại được lấy từ branch active. Tình huống khẩn cấp cần gọi hotline phù hợp hoặc đến cơ sở gần nhất.</p></header>{error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có địa chỉ demo thay thế.</p> : null}<div className="resource-grid resource-grid--two"><section className="resource-panel resource-panel--accent"><p className="section-note">Hỗ trợ khẩn cấp</p><h2>1900 1234</h2><p>Đây là số hiển thị trong phạm vi demo local; hãy kiểm tra lại trước khi dùng ngoài môi trường này.</p><a className="button button--amber" href="tel:19001234">Gọi ngay</a></section><section className="resource-panel"><p className="section-note">Hỗ trợ trực tuyến</p><h2>Đặt lịch hoặc tra cứu</h2><p>Chọn catalog, giữ một khung giờ, hoặc tra cứu bằng mã lịch hẹn và số điện thoại.</p><div className="resource-actions"><PublicBookingButton>Đặt lịch khám</PublicBookingButton><a className="outline-button" href="/tra-cuu">Tra cứu lịch hẹn</a></div></section></div>{page && !page.empty ? <section className="resource-panel resource-panel--wide"><p className="section-note">Cơ sở active</p><div className="catalog-grid catalog-grid--branches">{page.content.map((branch) => <article className="catalog-card" key={branch.id}><h2>{branch.name}</h2><p>{branch.address}</p><a className="text-button" href={`tel:${branch.phone.replace(/\s/g, "")}`}>{branch.phone} →</a></article>)}</div></section> : null}</div></PublicPageShell>;
}
