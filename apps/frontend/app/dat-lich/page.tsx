"use client";

import Link from "next/link";
import ClinicalIcon from "../../components/ClinicalIcon";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

const BOOKING_STEPS = [
  {
    number: "01",
    title: "Chọn nhu cầu khám",
    description: "Bắt đầu từ chuyên khoa, bác sĩ, gói khám hoặc dịch vụ mà bạn quan tâm.",
  },
  {
    number: "02",
    title: "Xác định nơi khám",
    description: "Chọn cơ sở phù hợp với vị trí, thời gian và nhu cầu di chuyển của bạn.",
  },
  {
    number: "03",
    title: "Giữ khung giờ",
    description: "Hệ thống sẽ giữ khung giờ còn trống trong quá trình bạn điền thông tin.",
  },
  {
    number: "04",
    title: "Xác nhận cuộc hẹn",
    description: "Hoàn tất xác thực để có mã hẹn và tra cứu lại khi cần.",
  },
] as const;

const BOOKING_SHORTCUTS = [
  { href: "/specialties", title: "Xem chuyên khoa", description: "Tìm đúng chuyên khoa trước khi mở form." },
  { href: "/packages", title: "Xem gói khám", description: "So sánh nhanh các lựa chọn phổ biến." },
  { href: "/contact", title: "Liên hệ bệnh viện", description: "Gọi đúng đầu mối nếu cần hỗ trợ ngay." },
  { href: "/faq", title: "Xem FAQ", description: "Xem câu hỏi thường gặp trước khi đặt." },
] as const;

export default function BookingLandingPage() {
  return (
    <PublicPageShell bookingInitiallyOpen>
      <div className="resource-page section-inner" id="dat-lich">
        <div className="resource-breadcrumb">
          <Link href="/">Trang chủ</Link>
          <span>/</span>
          <span>Đặt lịch</span>
        </div>

        <header className="resource-page__header">
          <p className="section-note">Đặt lịch khám</p>
          <h1>Bắt đầu từ nhu cầu khám của bạn</h1>
          <p>
            Form đặt lịch đã sẵn sàng. Nếu chưa chắc nên chọn chuyên khoa nào, bạn có thể mở trợ lý
            triệu chứng hoặc đi qua các lối tắt bên dưới.
          </p>
        </header>

        <section className="resource-hero-card resource-hero-card--teal">
          <div className="resource-icon" aria-hidden="true">
            <ClinicalIcon name="service" />
          </div>
          <div className="resource-hero-card__body">
            <p className="resource-chip">Mở form sẵn</p>
            <h2>Đi theo luồng đặt lịch rõ ràng, từ lựa chọn tới xác nhận.</h2>
            <p className="resource-lead">
              Chọn chuyên khoa, bác sĩ, cơ sở và khung giờ rồi xác nhận trên cùng một luồng thay vì
              phải nhảy qua nhiều trang.
            </p>
            <div className="resource-actions">
              <PublicBookingButton>Tiếp tục đặt lịch</PublicBookingButton>
              <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
              <Link className="outline-button outline-button--light" href="/specialties">
                Xem chuyên khoa
              </Link>
            </div>
            <dl className="resource-meta-grid">
              <div>
                <dt>Luồng chính</dt>
                <dd>Chọn nhu cầu → cơ sở → khung giờ → xác nhận</dd>
              </div>
              <div>
                <dt>Lối đi phụ</dt>
                <dd>Chuyên khoa, gói khám, liên hệ, FAQ</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="resource-grid resource-grid--two">
          <section className="resource-panel resource-panel--accent">
            <p className="section-note">Chuẩn bị trước khi đặt</p>
            <h2>Để cuộc hẹn trơn hơn</h2>
            <ul className="resource-list">
              <li>
                <strong>Mô tả ngắn nhu cầu khám</strong>
                <span>Giúp hệ thống đưa bạn về đúng chuyên khoa hoặc bác sĩ phù hợp.</span>
              </li>
              <li>
                <strong>Chọn thời gian thực tế</strong>
                <span>Chuẩn bị khung giờ dự phòng nếu bạn đi cùng người thân hoặc từ xa đến.</span>
              </li>
              <li>
                <strong>Giữ số điện thoại đang dùng</strong>
                <span>Mã hẹn và thông báo xác nhận sẽ đi qua đầu mối này.</span>
              </li>
            </ul>
          </section>

          <section className="resource-panel">
            <p className="section-note">Luồng đặt hẹn</p>
            <h2>4 mốc rõ ràng trong một lần điền</h2>
            <div className="resource-steps resource-steps--grid">
              {BOOKING_STEPS.map((step) => (
                <div className="resource-step-card" key={step.number}>
                  <span>{step.number}</span>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="resource-panel resource-panel--wide">
          <div className="section-heading">
            <div>
              <p className="section-note">Lối đi nhanh</p>
              <h2>Chọn đường đi phù hợp trước khi mở form</h2>
            </div>
          </div>
          <div className="catalog-grid catalog-grid--branches">
            {BOOKING_SHORTCUTS.map((item) => (
              <article className="catalog-card" key={item.href}>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <Link className="text-button" href={item.href}>
                  Mở trang →
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
