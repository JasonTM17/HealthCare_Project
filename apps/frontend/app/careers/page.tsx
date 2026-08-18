"use client";

import Link from "next/link";
import { PublicBackLink, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

export default function CareersPage(): React.ReactElement {
  return (
    <PublicPageShell>
      <div className="resource-page section-inner careers-page">
        <PublicBackLink href="/">← Về trang chính</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Cơ hội nghề nghiệp · CMS live</p>
          <h1>Cùng xây dựng một hành trình chăm sóc tử tế</h1>
          <p>Nội dung tuyển dụng được quản trị viên xuất bản qua backend CMS và cập nhật realtime trên trang này.</p>
        </header>
        <section className="resource-panel resource-panel--wide">
          <div className="section-heading">
            <div><p className="section-note">Cách tiếp cận</p><h2>Làm việc với sự rõ ràng và tôn trọng</h2></div>
            <span className="resource-chip">CMS live</span>
          </div>
          <div className="resource-steps resource-steps--grid">
            <article className="resource-step-card"><span>01</span><strong>Xem thông tin đã xuất bản</strong><p>Vai trò, phạm vi công việc và cách ứng tuyển chỉ có giá trị khi backend đã cung cấp.</p></article>
            <article className="resource-step-card"><span>02</span><strong>Trao đổi đúng kênh</strong><p>Gửi câu hỏi qua kênh liên hệ của cơ sở thay vì dùng dữ liệu cá nhân chưa được xác minh.</p></article>
            <article className="resource-step-card"><span>03</span><strong>Giữ thông tin minh bạch</strong><p>Nội dung CMS có version để quản trị viên cập nhật và người dùng nhìn thấy cùng một bản đã xuất bản.</p></article>
          </div>
        </section>
        <section className="resource-grid resource-grid--two">
          <article className="resource-panel resource-panel--accent"><p className="section-note">Bạn cần hỏi trước?</p><h2>Liên hệ đội ngũ</h2><p>Kênh liên hệ và số điện thoại chỉ được hiển thị khi branch active trả về từ backend.</p><Link className="outline-button" href="/contact">Mở trang liên hệ</Link></article>
          <article className="resource-panel"><p className="section-note">Hành trình bệnh nhân</p><h2>Khám phá hệ thống trước</h2><p>Nếu bạn đang tìm dịch vụ chăm sóc, hãy bắt đầu từ catalog và luồng đặt lịch.</p><PublicBookingButton>Đặt lịch khám</PublicBookingButton></article>
        </section>
      </div>
    </PublicPageShell>
  );
}
