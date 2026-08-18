"use client";

import Link from "next/link";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

export default function BookingLandingPage() {
  return (
    <PublicPageShell bookingInitiallyOpen>
      <div className="resource-page section-inner" id="dat-lich">
        <div className="resource-breadcrumb"><Link href="/">Trang chủ</Link><span>/</span><span>Đặt lịch</span></div>
        <header className="resource-page__header">
          <p className="section-note">Care Rail · đặt lịch</p>
          <h1>Bắt đầu từ nhu cầu khám của bạn</h1>
          <p>Chọn chuyên khoa, bác sĩ, gói khám hoặc cơ sở từ catalog active rồi giữ một khung giờ phù hợp.</p>
        </header>
        <section className="resource-grid resource-grid--two">
          <article className="resource-panel resource-panel--accent">
            <p className="section-note">Luồng backend</p>
            <h2>Đặt lịch theo từng bước</h2>
            <p>Hệ thống sẽ tải dữ liệu live, kiểm tra cơ sở và chỉ gửi yêu cầu giữ chỗ sau khi bạn chọn đủ thông tin.</p>
            <PublicBookingButton>Mở form đặt lịch</PublicBookingButton>
          </article>
          <article className="resource-panel">
            <p className="section-note">Care Navigator</p>
            <h2>Chưa biết bắt đầu từ đâu?</h2>
            <p>Trợ lý chỉ gợi ý chuyên khoa từ backend và luôn hiển thị giới hạn của bản demo.</p>
            <PublicAiButton className="outline-button">Mở trợ lý AI</PublicAiButton>
          </article>
        </section>
      </div>
    </PublicPageShell>
  );
}
