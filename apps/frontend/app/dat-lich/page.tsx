"use client";

import Link from "next/link";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

export default function BookingLandingPage() {
  return (
    <PublicPageShell>
      <div className="resource-page section-inner" id="dat-lich">
        <div className="resource-breadcrumb"><Link href="/">Trang chủ</Link><span>/</span><span>Đặt lịch</span></div>
        <header className="resource-page__header">
          <p className="section-note">Đặt lịch khám</p>
          <h1>Bắt đầu từ nhu cầu khám của bạn</h1>
          <p>Chọn chuyên khoa, bác sĩ, gói khám hoặc cơ sở, sau đó tìm khung giờ phù hợp với bạn.</p>
        </header>
        <section className="resource-grid resource-grid--two">
          <article className="resource-panel resource-panel--accent">
            <p className="section-note">Các bước đặt hẹn</p>
            <h2>Đặt lịch theo từng bước</h2>
            <p>Hệ thống sẽ hướng dẫn bạn chọn nhu cầu khám, bác sĩ, cơ sở, ngày và khung giờ trước khi xác nhận.</p>
            <PublicBookingButton>Mở form đặt lịch</PublicBookingButton>
          </article>
          <article className="resource-panel">
            <p className="section-note">Trợ lý chọn chuyên khoa</p>
            <h2>Chưa biết bắt đầu từ đâu?</h2>
            <p>Mô tả điều bạn đang quan tâm để nhận gợi ý tham khảo. Công cụ này không thay thế chẩn đoán của bác sĩ.</p>
            <PublicAiButton className="outline-button">Hỗ trợ chọn chuyên khoa</PublicAiButton>
          </article>
        </section>
      </div>
    </PublicPageShell>
  );
}
