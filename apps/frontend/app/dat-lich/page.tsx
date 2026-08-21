"use client";

import Link from "next/link";
import Icon, { type IconName } from "../../components/UiIcon";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

const BOOKING_STAGES: Array<{ icon: IconName; title: string; description: string }> = [
  {
    icon: "stethoscope",
    title: "1. Chọn nhu cầu khám",
    description: "Bắt đầu bằng chuyên khoa, bác sĩ, gói khám hoặc cơ sở phù hợp với bạn.",
  },
  {
    icon: "building",
    title: "2. Chọn cơ sở và khung giờ",
    description: "Hệ thống chỉ giữ lịch theo cơ sở, ngày và giờ còn khả dụng từ backend.",
  },
  {
    icon: "user",
    title: "3. Điền thông tin liên hệ",
    description: "Nhập họ tên, số điện thoại, email và ghi chú ngắn để bệnh viện chuẩn bị.",
  },
  {
    icon: "mail",
    title: "4. Xác nhận OTP",
    description: "Mã OTP và thời gian giữ chỗ được xử lý riêng để tránh nhầm trạng thái lịch.",
  },
];

const PREPARE_ITEMS = [
  "Chuẩn bị số điện thoại có thể nhận OTP.",
  "Nếu chưa rõ chuyên khoa, dùng trợ lý AI để lấy gợi ý tham khảo.",
  "Kiểm tra lại cơ sở và giờ làm việc trước khi đến khám.",
] as const;

export default function BookingLandingPage() {
  return (
    <PublicPageShell>
      <div className="booking-page resource-page section-inner" id="dat-lich">
        <div className="resource-breadcrumb"><Link href="/">Trang chủ</Link><span>/</span><span>Đặt lịch</span></div>

        <header className="booking-page__hero resource-page__header">
          <div>
            <p className="section-note">Đặt lịch khám</p>
            <h1>Bắt đầu từ nhu cầu khám của bạn</h1>
            <p>
              Trang này giúp bạn hiểu trước luồng đặt hẹn. Khi sẵn sàng, form đặt lịch sẽ giữ nguyên
              các bước xác thực slot, thông tin bệnh nhân và OTP hiện có của hệ thống.
            </p>
            <div className="booking-page__hero-actions">
              <PublicBookingButton>
                <Icon name="calendar" size={18} />
                Bắt đầu đặt lịch
              </PublicBookingButton>
              <Link className="outline-button" href="/doctors">
                Xem danh sách bác sĩ
                <Icon name="arrow-up-right" size={17} />
              </Link>
            </div>
          </div>

          <aside className="booking-page__summary" aria-label="Tóm tắt luồng đặt lịch">
            <p className="section-note">Tóm tắt nhanh</p>
            <strong>4 chặng chính</strong>
            <span>Chọn nhu cầu → chọn lịch → điền thông tin → xác nhận OTP.</span>
            <small>Form đặt lịch chỉ mở khi bạn bấm bắt đầu, không còn bật modal ngay khi vào trang.</small>
          </aside>
        </header>

        <section className="booking-stage-grid" aria-label="Các bước đặt lịch khám">
          {BOOKING_STAGES.map((stage) => (
            <article className="booking-stage-card" key={stage.title}>
              <span className="booking-stage-card__icon"><Icon name={stage.icon} size={20} /></span>
              <h2>{stage.title}</h2>
              <p>{stage.description}</p>
            </article>
          ))}
        </section>

        <section className="booking-page__support resource-grid resource-grid--two" aria-label="Hỗ trợ trước khi đặt lịch">
          <article className="resource-panel resource-panel--accent">
            <p className="section-note">Trợ lý chọn chuyên khoa</p>
            <h2>Chưa biết bắt đầu từ đâu?</h2>
            <p>
              Mô tả triệu chứng bằng ngôn ngữ tự nhiên để nhận gợi ý tham khảo. Công cụ này không
              thay thế chẩn đoán của bác sĩ và chỉ hoạt động khi bạn chủ động mở.
            </p>
            <PublicAiButton className="outline-button">Hỏi trợ lý AI</PublicAiButton>
          </article>

          <article className="resource-panel">
            <p className="section-note">Chuẩn bị trước khi gửi lịch</p>
            <h2>Để thao tác nhanh hơn</h2>
            <ul className="booking-page__checklist">
              {PREPARE_ITEMS.map((item) => (
                <li key={item}><Icon name="check" size={16} />{item}</li>
              ))}
            </ul>
            <Link className="text-button" href="/tra-cuu">Đã có mã hẹn? Tra cứu lịch <Icon name="arrow-up-right" size={17} /></Link>
          </article>
        </section>

        <div className="booking-page__sticky" role="region" aria-label="Bắt đầu đặt lịch khám">
          <span>
            <strong>Sẵn sàng giữ lịch?</strong>
            <small>Form sẽ mở trên cùng hệ thống giữ chỗ và OTP thật.</small>
          </span>
          <PublicBookingButton className="button button--amber booking-page__sticky-button">
            <Icon name="calendar" size={18} />
            Mở form đặt lịch
          </PublicBookingButton>
        </div>
      </div>
    </PublicPageShell>
  );
}
