"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchBranches, fetchFaqs, type Page } from "../../lib/api-client";
import type { Branch, Faq } from "../../types/hospital";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

const JOURNEY = [
  ["01", "Mô tả nhu cầu", "Bắt đầu bằng câu hỏi hoặc mở Care Navigator; AI chỉ định hướng, không chẩn đoán."],
  ["02", "Chọn catalog", "Kiểm tra chuyên khoa, hồ sơ bác sĩ và cơ sở active trước khi chọn ngày."],
  ["03", "Giữ khung giờ", "Slot được kiểm tra theo branch; backend mới có quyền giữ chỗ."],
  ["04", "Xác nhận cuộc hẹn", "Hoàn tất xác thực theo contract booking rồi dùng mã để tra cứu."],
] as const;

export default function HuongDanPage() {
  const [faqs, setFaqs] = useState<Page<Faq> | null>(null);
  const [branches, setBranches] = useState<Page<Branch> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      try {
        const [faqPage, branchPage] = await Promise.all([fetchFaqs(0, 20), fetchBranches(0, 20)]);
        if (cancelled) return;
        setFaqs(faqPage);
        setBranches(branchPage);
      } catch (reason: unknown) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải hướng dẫn từ backend.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; void task; };
  }, []);

  return <PublicPageShell branches={branches?.content ?? []}><div className="resource-page section-inner"><div className="resource-breadcrumb"><Link href="/">Trang chủ</Link><span>/</span><span>Hướng dẫn</span></div><header className="resource-page__header"><p className="section-note">Care Rail · hướng dẫn sử dụng</p><h1>Một lộ trình khám rõ ràng hơn</h1><p>Trang này mô tả cách dùng bản demo local. Nội dung FAQ và danh sách cơ sở được đọc từ backend; không tự khẳng định quan hệ bảo hiểm hoặc hướng dẫn y khoa ngoài contract đã xuất bản.</p></header>{loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải hướng dẫn…</p> : null}{error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có nội dung demo thay thế.</p> : null}<section className="resource-panel resource-panel--wide"><div className="section-heading"><div><p className="section-note">Patient journey</p><h2>Từ nhu cầu tới cuộc hẹn</h2></div><PublicAiButton className="outline-button">Mở Care Navigator</PublicAiButton></div><div className="resource-steps resource-steps--grid">{JOURNEY.map(([number, title, description]) => <div className="resource-step-card" key={number}><span>{number}</span><strong>{title}</strong><p>{description}</p></div>)}</div></section><section className="resource-grid resource-grid--two"><section className="resource-panel resource-panel--accent"><p className="section-note">Cơ sở active</p><h2>Kiểm tra trước khi đến</h2>{branches && !branches.empty ? <ul className="resource-list">{branches.content.slice(0, 4).map((branch) => <li key={branch.id}><strong>{branch.name}</strong><span>{branch.address}{branch.phone ? ` · ${branch.phone}` : ""}</span></li>)}</ul> : <p className="resource-muted">Backend chưa có cơ sở active để hiển thị.</p>}</section><section className="resource-panel"><p className="section-note">Phạm vi quản trị</p><h2>Thông tin cần xác nhận lại</h2><p>Giờ làm việc, phí dịch vụ, bảo hiểm và giấy tờ thay đổi theo từng cơ sở hoặc hợp đồng. Hãy kiểm tra catalog backend hoặc gọi trực tiếp cơ sở trước khi sử dụng.</p><PublicBookingButton>Đặt lịch từ catalog</PublicBookingButton></section></section><section className="resource-panel resource-panel--wide"><div className="section-heading"><div><p className="section-note">FAQ · backend active</p><h2>Câu hỏi thường gặp</h2></div><Link className="text-button" href="/faq">Xem trang FAQ →</Link></div>{faqs && !faqs.empty ? <div className="faq-list">{faqs.content.map((item) => <details className="faq-item" key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div> : <p className="resource-muted">Backend chưa có FAQ active.</p>}</section></div></PublicPageShell>;
}
