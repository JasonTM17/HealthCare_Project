"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchBranches, fetchFaqs, type Page } from "../../lib/api-client";
import type { Branch, Faq } from "../../types/hospital";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import { CmsNativeSection, CmsNativeText } from "../../components/cms/cms-page-layout-provider";

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
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      setFaqs(null);
      setBranches(null);
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
  }, [retryCount]);

  return (
    <PublicPageShell branches={branches?.content ?? []}>
      <div className="resource-page section-inner">
        <CmsNativeSection sectionId="intro">
          <div className="resource-breadcrumb"><Link href="/">Trang chủ</Link><span>/</span><CmsNativeText fieldId="intro.label2" as="span" value={"Hướng dẫn"}>Hướng dẫn</CmsNativeText></div>
          <header className="resource-page__header">
            <CmsNativeText fieldId="intro.eyebrow" as="p" value={"Hướng dẫn đặt khám"} className="section-note">Hướng dẫn đặt khám</CmsNativeText>
            <CmsNativeText fieldId="intro.title" as="h1" value={"Một lộ trình khám rõ ràng hơn"}>Một lộ trình khám rõ ràng hơn</CmsNativeText>
            <CmsNativeText fieldId="intro.body" as="p" value={"Tìm hiểu các bước chọn chuyên khoa, bác sĩ, cơ sở và khung giờ để chuẩn bị thuận tiện hơn cho cuộc hẹn."}>Tìm hiểu các bước chọn chuyên khoa, bác sĩ, cơ sở và khung giờ để chuẩn bị thuận tiện hơn cho cuộc hẹn.</CmsNativeText>
          </header>
        </CmsNativeSection>
        <CmsNativeSection sectionId="states">
          {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải hướng dẫn…</p> : null}
          {error ? (
            <div aria-live="assertive" className="catalog-status catalog-status--error" role="alert">
              <span>{error}</span>
              <button className="outline-button outline-button--small" onClick={() => setRetryCount((count) => count + 1)} type="button">Thử tải lại</button>
            </div>
          ) : null}
        </CmsNativeSection>
        <CmsNativeSection sectionId="journey">
          <section className="resource-panel resource-panel--wide">
            <div className="section-heading">
              <div><CmsNativeText fieldId="journey.eyebrow" as="p" value={"Hành trình đặt khám"} className="section-note">Hành trình đặt khám</CmsNativeText><CmsNativeText fieldId="journey.title" as="h2" value={"Từ nhu cầu tới cuộc hẹn"}>Từ nhu cầu tới cuộc hẹn</CmsNativeText></div>
              <PublicAiButton className="outline-button">Hỗ trợ chọn chuyên khoa</PublicAiButton>
            </div>
            <div className="resource-steps resource-steps--grid">{JOURNEY.map(([number, title, description]) => <div className="resource-step-card" key={number}><span>{number}</span><CmsNativeText fieldId={`journey.step${number}.title`} as="strong" value={title}>{title}</CmsNativeText><p>{description}</p></div>)}</div>
          </section>
        </CmsNativeSection>
        <CmsNativeSection sectionId="preparation">
          <section className="resource-grid resource-grid--two">
            <section className="resource-panel resource-panel--accent">
              <CmsNativeText fieldId="preparation.eyebrow" as="p" value={"Cơ sở khám bệnh"} className="section-note">Cơ sở khám bệnh</CmsNativeText><CmsNativeText fieldId="preparation.title" as="h2" value={"Kiểm tra trước khi đến"}>Kiểm tra trước khi đến</CmsNativeText>
              {branches && !branches.empty ? <ul className="resource-list">{branches.content.slice(0, 4).map((branch) => <li key={branch.id}><strong>{branch.name}</strong><span>{branch.address}{branch.phone ? ` · ${branch.phone}` : ""}</span></li>)}</ul> : <div className="resource-muted"><p>Chưa tải được danh sách cơ sở công khai.</p><div className="resource-actions mt-4"><Link className="outline-button outline-button--small" href="/contact">Mở trang liên hệ</Link><PublicBookingButton className="button button--amber">Đặt lịch khám</PublicBookingButton></div></div>}
            </section>
            <section className="resource-panel"><CmsNativeText fieldId="preparation.eyebrow2" as="p" value={"Lưu ý trước cuộc hẹn"} className="section-note">Lưu ý trước cuộc hẹn</CmsNativeText><CmsNativeText fieldId="preparation.title2" as="h2" value={"Thông tin cần xác nhận lại"}>Thông tin cần xác nhận lại</CmsNativeText><CmsNativeText fieldId="preparation.body" as="p" value={"Giờ làm việc, phí dịch vụ, bảo hiểm và giấy tờ cần thiết có thể thay đổi theo từng cơ sở. Vui lòng xem thông tin mới nhất hoặc gọi trực tiếp trước khi đến."}>Giờ làm việc, phí dịch vụ, bảo hiểm và giấy tờ cần thiết có thể thay đổi theo từng cơ sở. Vui lòng xem thông tin mới nhất hoặc gọi trực tiếp trước khi đến.</CmsNativeText><PublicBookingButton>Đặt lịch khám</PublicBookingButton></section>
          </section>
        </CmsNativeSection>
        <CmsNativeSection sectionId="questions">
          <section className="resource-panel resource-panel--wide">
            <div className="section-heading"><div><CmsNativeText fieldId="questions.eyebrow" as="p" value={"Hỗ trợ người bệnh"} className="section-note">Hỗ trợ người bệnh</CmsNativeText><CmsNativeText fieldId="questions.title" as="h2" value={"Câu hỏi thường gặp"}>Câu hỏi thường gặp</CmsNativeText></div><Link className="text-button" href="/faq">Xem tất cả câu hỏi →</Link></div>
            {faqs && !faqs.empty ? <div className="faq-list">{faqs.content.map((item) => <details className="faq-item" key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div> : <div className="resource-muted"><p>Hiện chưa có câu hỏi được duyệt để hiển thị.</p><p className="mt-2">Bạn vẫn có thể xem hướng dẫn đặt lịch hoặc liên hệ bệnh viện để được hỗ trợ ngay.</p><div className="resource-actions mt-4"><Link className="outline-button outline-button--small" href="/contact">Liên hệ bệnh viện</Link><PublicBookingButton className="button button--amber">Đặt lịch khám</PublicBookingButton></div></div>}
          </section>
        </CmsNativeSection>
      </div>
    </PublicPageShell>
  );
}
