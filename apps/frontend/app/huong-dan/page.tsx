"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchBranches, fetchFaqs, type Page } from "../../lib/api-client";
import type { Branch, Faq } from "../../types/hospital";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

const JOURNEY = [
  ["01", "Chia sẻ nhu cầu", "Bắt đầu bằng câu hỏi hoặc dùng trợ lý chọn chuyên khoa. Gợi ý không thay thế chẩn đoán của bác sĩ."],
  ["02", "Chọn nơi khám", "Xem chuyên khoa, hồ sơ bác sĩ và cơ sở phù hợp trước khi chọn ngày."],
  ["03", "Chọn khung giờ", "Hệ thống sẽ kiểm tra và giữ khung giờ còn trống trong quá trình đặt lịch."],
  ["04", "Xác nhận cuộc hẹn", "Xác thực số điện thoại, hoàn tất đặt lịch và lưu mã hẹn để tra cứu khi cần."],
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
      } catch {
        if (!cancelled) setError("Tạm thời chưa thể tải đầy đủ hướng dẫn. Vui lòng thử lại sau.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; void task; };
  }, []);

  return <PublicPageShell branches={branches?.content ?? []}><div className="resource-page section-inner"><div className="resource-breadcrumb"><Link href="/">Trang chủ</Link><span>/</span><span>Hướng dẫn</span></div><header className="resource-page__header"><p className="section-note">Hướng dẫn đặt khám</p><h1>Một lộ trình khám rõ ràng hơn</h1><p>Tìm hiểu các bước chọn chuyên khoa, bác sĩ, cơ sở và khung giờ để chuẩn bị thuận tiện hơn cho cuộc hẹn.</p></header>{loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải hướng dẫn…</p> : null}{error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}<section className="resource-panel resource-panel--wide"><div className="section-heading"><div><p className="section-note">Hành trình đặt khám</p><h2>Từ nhu cầu tới cuộc hẹn</h2></div><PublicAiButton className="outline-button">Hỗ trợ chọn chuyên khoa</PublicAiButton></div><div className="resource-steps resource-steps--grid">{JOURNEY.map(([number, title, description]) => <div className="resource-step-card" key={number}><span>{number}</span><strong>{title}</strong><p>{description}</p></div>)}</div></section><section className="resource-grid resource-grid--two"><section className="resource-panel resource-panel--accent"><p className="section-note">Cơ sở khám bệnh</p><h2>Kiểm tra trước khi đến</h2>{branches && !branches.empty ? <ul className="resource-list">{branches.content.slice(0, 4).map((branch) => <li key={branch.id}><strong>{branch.name}</strong><span>{branch.address}{branch.phone ? ` · ${branch.phone}` : ""}</span></li>)}</ul> : <p className="resource-muted">Thông tin cơ sở đang được cập nhật.</p>}</section><section className="resource-panel"><p className="section-note">Lưu ý trước cuộc hẹn</p><h2>Thông tin cần xác nhận lại</h2><p>Giờ làm việc, phí dịch vụ, bảo hiểm và giấy tờ cần thiết có thể thay đổi theo từng cơ sở. Vui lòng xem thông tin mới nhất hoặc gọi trực tiếp trước khi đến.</p><PublicBookingButton>Đặt lịch khám</PublicBookingButton></section></section><section className="resource-panel resource-panel--wide"><div className="section-heading"><div><p className="section-note">Hỗ trợ người bệnh</p><h2>Câu hỏi thường gặp</h2></div><Link className="text-button" href="/faq">Xem tất cả câu hỏi →</Link></div>{faqs && !faqs.empty ? <div className="faq-list">{faqs.content.map((item) => <details className="faq-item" key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div> : <p className="resource-muted">Nội dung câu hỏi thường gặp đang được cập nhật.</p>}</section></div></PublicPageShell>;
}
