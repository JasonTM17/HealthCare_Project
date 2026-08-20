"use client";

import { useEffect, useState } from "react";
import { fetchBranches, type Page } from "../../lib/api-client";
import { safeTelephoneHref } from "../../lib/phone";
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
      } catch {
        if (!cancelled) setError("Tạm thời chưa thể tải thông tin liên hệ. Vui lòng thử lại sau.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; void task; };
  }, []);

  const contactBranch = page?.content.find((branch) => branch.phone || branch.emergencyHotline);
  const contactPhone = contactBranch?.phone ?? contactBranch?.emergencyHotline;
  const contactLabel = contactBranch?.phone ? "Liên hệ cơ sở" : "Hotline cấp cứu";
  const contactHref = safeTelephoneHref(contactPhone);

  return <PublicPageShell branches={page?.content ?? []}><div className="resource-page section-inner"><header className="resource-page__header"><p className="section-note">Hỗ trợ người bệnh</p><h1>Liên hệ khi bạn cần một điểm bắt đầu</h1><p>Xem địa chỉ và số điện thoại của từng cơ sở. Trong tình huống khẩn cấp, hãy gọi số cấp cứu phù hợp hoặc đến cơ sở y tế gần nhất.</p></header>{loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải thông tin liên hệ…</p> : null}{error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}{!loading && !error && (!page || page.empty) ? <p className="catalog-status" role="status">Thông tin cơ sở đang được cập nhật.</p> : null}<div className="resource-grid resource-grid--two"><section className="resource-panel resource-panel--accent"><p className="section-note">{contactLabel}</p><h2>{contactPhone || "Hotline đang được cập nhật"}</h2><p>{contactBranch ? `${contactBranch.phone ? "Liên hệ trực tiếp với" : "Trong tình huống khẩn cấp, gọi"} ${contactBranch.name}.` : "Vui lòng quay lại sau để xem số điện thoại mới nhất."}</p>{contactHref ? <a className="button button--amber" href={contactHref}>{contactBranch?.phone ? "Gọi cơ sở" : "Gọi hotline cấp cứu"}</a> : null}</section><section className="resource-panel"><p className="section-note">Hỗ trợ trực tuyến</p><h2>Đặt lịch hoặc tra cứu</h2><p>Chọn nhu cầu khám và khung giờ phù hợp, hoặc tra cứu bằng mã lịch hẹn cùng số điện thoại.</p><div className="resource-actions"><PublicBookingButton>Đặt lịch khám</PublicBookingButton><a className="outline-button" href="/tra-cuu">Tra cứu lịch hẹn</a></div></section></div>{page && !page.empty ? <section className="resource-panel resource-panel--wide"><p className="section-note">Hệ thống cơ sở</p><div className="catalog-grid catalog-grid--branches">{page.content.map((branch) => <article className="catalog-card" key={branch.id}><h2>{branch.name}</h2><p>{branch.address}</p>{safeTelephoneHref(branch.phone) ? <a className="text-button" href={safeTelephoneHref(branch.phone) ?? undefined}>{branch.phone} →</a> : <p className="resource-muted">Số điện thoại đang được cập nhật.</p>}</article>)}</div></section> : null}</div></PublicPageShell>;
}
