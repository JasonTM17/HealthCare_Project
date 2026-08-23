"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import BranchMap from "../../components/BranchMap";
import { BookingInlineExperience, type BookingSelection } from "../../components/BookingModal";
import { ClinicalIcon } from "../../components/ClinicalIcon";
import Icon, { type IconName } from "../../components/UiIcon";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import { fetchBranches } from "../../lib/api-client";
import type { Branch } from "../../types/hospital";

const BOOKING_STAGES: Array<{ icon: IconName; title: string; description: string }> = [
  {
    icon: "stethoscope",
    title: "1. Chọn nhu cầu khám",
    description: "Bắt đầu bằng chuyên khoa, bác sĩ, gói khám hoặc cơ sở phù hợp với bạn.",
  },
  {
    icon: "building",
    title: "2. Chọn cơ sở và khung giờ",
    description: "Xem ngày và giờ còn trống tại cơ sở phù hợp với bạn.",
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
  "Xem danh sách chuyên khoa trước nếu bạn chưa chắc nên bắt đầu từ đâu.",
  "Kiểm tra lại cơ sở và giờ làm việc trước khi đến khám.",
] as const;

export default function BookingLandingPage() {
  const bookingRegionRef = useRef<HTMLElement>(null);
  const [branchCards, setBranchCards] = useState<Branch[]>([]);
  const [branchCardsLoading, setBranchCardsLoading] = useState(true);
  const [branchCardsError, setBranchCardsError] = useState<string | null>(null);
  const [bookingRequest, setBookingRequest] = useState<{ nonce: number; selection?: BookingSelection }>({ nonce: 0 });
  const handleBookingRequest = useCallback((selection?: BookingSelection) => {
    setBookingRequest((current) => ({ nonce: current.nonce + 1, selection }));
    window.requestAnimationFrame(() => {
      bookingRegionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      bookingRegionRef.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchBranches(0, 6)
      .then((page) => {
        if (cancelled) return;
        setBranchCards(page.content);
        setBranchCardsError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setBranchCardsError("Tạm thời chưa thể tải danh sách cơ sở. Vui lòng thử lại sau.");
        setBranchCards([]);
      })
      .finally(() => {
        if (!cancelled) setBranchCardsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicPageShell onBookingRequest={handleBookingRequest}>
      <div className="booking-page resource-page section-inner" id="dat-lich">
        <div className="resource-breadcrumb"><Link href="/">Trang chủ</Link><span>/</span><span>Đặt lịch</span></div>

        <header className="booking-page__hero resource-page__header booking-page__hero--centered">
          <div className="booking-page__hero-copy">
            <p className="section-note">Đặt lịch khám</p>
            <h1>Bảng thông tin đặt lịch</h1>
            <p>
              Chọn chuyên khoa, cơ sở, bác sĩ và khung giờ phù hợp trong một luồng rõ ràng.
              Hoàn tất thông tin liên hệ ngay bên dưới.
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
        </header>

        <section
          aria-labelledby="booking-inline-heading"
          className="booking-page__inline booking-page__inline--primary"
          ref={bookingRegionRef}
          tabIndex={-1}
        >
          <div className="booking-page__inline-heading booking-page__inline-heading--centered">
            <p className="section-note">Thông tin lịch hẹn</p>
            <h2 id="booking-inline-heading">Hoàn tất lịch khám trong cùng một trang</h2>
            <p>
              Nhập thông tin khách hàng, chọn bệnh viện hoặc phòng khám, rồi xác nhận mã OTP khi
              bạn đã sẵn sàng.
            </p>
          </div>
          <BookingInlineExperience key={bookingRequest.nonce} selection={bookingRequest.selection} />
        </section>

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
            <p className="section-note">Hỗ trợ chọn chuyên khoa</p>
            <h2>Chưa biết bắt đầu từ đâu?</h2>
            <p>
              Bạn có thể mở công cụ gợi ý tham khảo nếu chưa biết nên chọn chuyên khoa nào.
              Kết quả không thay thế tư vấn hoặc chẩn đoán của bác sĩ.
            </p>
            <PublicAiButton className="text-button">Xem gợi ý chuyên khoa <Icon name="arrow-right" size={17} /></PublicAiButton>
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

        <section className="booking-page__branches" aria-labelledby="booking-branches-heading">
          <div className="booking-page__branches-heading">
            <p className="section-note">Các cơ sở khám nổi bật</p>
            <h2 id="booking-branches-heading">Chọn cơ sở thuận tiện nhất trước khi vào form</h2>
            <p>
              Xem địa chỉ, giờ làm việc và số điện thoại của từng cơ sở trước khi chọn lịch.
            </p>
          </div>
          {branchCardsLoading ? (
            <p className="catalog-status catalog-status--loading" role="status">
              Đang tải danh sách cơ sở…
            </p>
          ) : branchCardsError ? (
            <div className="catalog-status catalog-status--error" role="alert">
              <p>{branchCardsError}</p>
              <Link className="outline-button outline-button--small" href="/branches">
                Xem toàn bộ cơ sở
              </Link>
            </div>
          ) : branchCards.length > 0 ? (
            <div className="catalog-grid catalog-grid--branches booking-page__branch-grid">
              {branchCards.map((branch) => {
                const address = branch.address?.trim();
                const contactPhone = branch.phone?.trim() || branch.emergencyHotline?.trim() || "Đang cập nhật";

                return (
                  <article className="catalog-card booking-page__branch-card" key={branch.id}>
                    <span className="resource-icon resource-icon--small" aria-hidden="true">
                      <ClinicalIcon name="branch" />
                    </span>
                    <h2>{branch.name}</h2>
                    <div className="branch-card__address">
                      <Icon name="location" size={18} />
                      <p>
                        {address || <span className="resource-muted">Địa chỉ đang được cập nhật.</span>}
                      </p>
                    </div>
                    <BranchMap
                      address={address}
                      branchName={branch.name}
                      className="branch-card__map-link"
                      variant="link"
                    />
                    <dl className="catalog-card__details">
                      <div>
                        <dt>Điện thoại</dt>
                        <dd>{contactPhone}</dd>
                      </div>
                      <div>
                        <dt>Giờ làm việc</dt>
                        <dd>{branch.workingHours || "Đang cập nhật"}</dd>
                      </div>
                    </dl>
                    <div className="catalog-card__actions">
                      <Link className="text-button" href={`/branches/${branch.slug}`}>
                        Tìm hiểu thêm →
                      </Link>
                      <PublicBookingButton
                        className="outline-button outline-button--small"
                        selection={{ branchId: branch.id }}
                      >
                        Đặt lịch hẹn
                      </PublicBookingButton>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="catalog-status" role="status">
              Thông tin cơ sở đang được cập nhật.
            </p>
          )}
        </section>

      </div>
    </PublicPageShell>
  );
}
