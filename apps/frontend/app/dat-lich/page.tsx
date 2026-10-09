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
import { isCmsPreviewRequested } from "../../lib/cms-preview-bridge";
import { CmsNativeSection, CmsNativeText } from "../../components/cms/cms-page-layout-provider";

const BOOKING_STAGES: Array<{ icon: IconName; title: string; description: string; }> = [
  {
    icon: "stethoscope",
    title: "1. Chọn nhu cầu khám",
    description: "Bắt đầu bằng chuyên khoa, bác sĩ, gói khám hoặc cơ sở phù hợp với bạn.",
  },
  {
    icon: "building",
    title: "2. Ngày & Khung giờ khám",
    description: "Xem ngày và khung giờ tiếp nhận còn trống tại cơ sở phù hợp với bạn.",
  },
  {
    icon: "user",
    title: "3. Điền thông tin liên hệ",
    description: "Nhập họ tên, số điện thoại, email và ghi chú ngắn để bệnh viện chuẩn bị.",
  },
  {
    icon: "mail",
    title: "4. Xác nhận OTP",
    description: "Xác thực mã OTP gửi qua email giúp bảo mật thông tin và hoàn tất lịch hẹn an toàn.",
  },
];

const PREPARE_ITEMS = [
  "Chuẩn bị địa chỉ email có thể nhận mã OTP xác thực.",
  "Đến trước giờ hẹn 15 phút để hoàn tất thủ tục tiếp đón và đo sinh hiệu ban đầu.",
  "Mang theo CMND/CCCD, thẻ BHYT và kết quả thăm khám cũ (nếu có).",
  "Nhịn ăn sáng trước khi lấy mẫu nếu có chỉ định xét nghiệm máu hoặc đường huyết.",
  "Xem danh sách chuyên khoa trước nếu bạn chưa chắc nên bắt đầu từ đâu.",
] as const;

export default function BookingLandingPage() {
  const bookingRegionRef = useRef<HTMLElement>(null);
  const [branchCards, setBranchCards] = useState<Branch[]>([]);
  const [branchCardsLoading, setBranchCardsLoading] = useState(true);
  const [branchCardsError, setBranchCardsError] = useState<string | null>(null);
  const [bookingRequest, setBookingRequest] = useState<{ nonce: number; selection?: BookingSelection; }>({ nonce: 0 });
  const handleBookingRequest = useCallback((selection?: BookingSelection) => {
    if (isCmsPreviewRequested()) return;
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
        <CmsNativeSection sectionId="intro">
          <div className="resource-breadcrumb"><Link href="/">Trang chủ</Link><span>/</span><CmsNativeText fieldId="intro.label2" as="span" value={"Đặt lịch"}>Đặt lịch</CmsNativeText></div>

          <header className="booking-page__hero resource-page__header booking-page__hero--centered">
            <div className="booking-page__hero-copy">
              <CmsNativeText fieldId="intro.eyebrow" as="p" value={"Đặt lịch khám"} className="section-note">Đặt lịch khám</CmsNativeText>
              <CmsNativeText fieldId="intro.title" as="h1" value={"Đặt lịch khám trực tuyến"}>Đặt lịch khám trực tuyến</CmsNativeText>
              <CmsNativeText fieldId="intro.body" as="p" value={"Chọn chuyên khoa, cơ sở, bác sĩ và khung giờ khám thuận tiện nhất. Giữ chỗ bằng OTP và nhận mã hẹn ngay khi xác thực xong."}>
                Chọn chuyên khoa, cơ sở, bác sĩ và khung giờ khám thuận tiện nhất.
                Giữ chỗ bằng OTP và nhận mã hẹn ngay khi xác thực xong.
              </CmsNativeText>
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
        </CmsNativeSection>

        <CmsNativeSection sectionId="booking">
          <section
            aria-labelledby="booking-inline-heading"
            className="booking-page__inline booking-page__inline--primary"
            ref={bookingRegionRef}
            tabIndex={-1}
          >
            <div className="booking-page__inline-heading booking-page__inline-heading--centered">
              <CmsNativeText fieldId="booking.eyebrow" as="p" value={"Hệ thống tiếp nhận"} className="section-note">Hệ thống tiếp nhận</CmsNativeText>
              <CmsNativeText fieldId="booking.title" as="h2" value={"Đăng ký lịch khám nhanh chóng"} id="booking-inline-heading">Đăng ký lịch khám nhanh chóng</CmsNativeText>
              <CmsNativeText fieldId="booking.body" as="p" value={"Quý khách vui lòng điền thông tin người khám, chọn cơ sở y tế thuận tiện và xác thực OTP để nhận mã hẹn tức thì."}>
                Quý khách vui lòng điền thông tin người khám, chọn cơ sở y tế thuận tiện và xác thực OTP để nhận mã hẹn tức thì.
              </CmsNativeText>
            </div>
            <BookingInlineExperience key={bookingRequest.nonce} selection={bookingRequest.selection} />
          </section>
        </CmsNativeSection>

        <CmsNativeSection sectionId="stages">
          <section className="booking-stage-grid" aria-label="Các bước đặt lịch khám">
            {BOOKING_STAGES.map((stage, cmsItemIndex) => (
              <article className="booking-stage-card" key={stage.title}>
                <span className="booking-stage-card__icon"><Icon name={stage.icon} size={20} /></span>
                <CmsNativeText fieldId={`stages.item${cmsItemIndex + 1}.title`} as="h2" value={stage.title}>{stage.title}</CmsNativeText>
                <CmsNativeText fieldId={`stages.item${cmsItemIndex + 1}.body`} as="p" value={stage.description}>{stage.description}</CmsNativeText>
              </article>
            ))}
          </section>
        </CmsNativeSection>

        <CmsNativeSection sectionId="support">
          <section className="booking-page__support resource-grid resource-grid--two" aria-label="Hỗ trợ trước khi đặt lịch">
            <article className="resource-panel resource-panel--accent">
              <CmsNativeText fieldId="support.eyebrow" as="p" value={"Hỗ trợ chọn chuyên khoa"} className="section-note">Hỗ trợ chọn chuyên khoa</CmsNativeText>
              <CmsNativeText fieldId="support.title" as="h2" value={"Chưa biết bắt đầu từ đâu?"}>Chưa biết bắt đầu từ đâu?</CmsNativeText>
              <p>
                Bạn có thể mở công cụ gợi ý tham khảo nếu chưa biết nên chọn chuyên khoa nào.
                Kết quả không thay thế tư vấn hoặc chẩn đoán của bác sĩ.
              </p>
              <PublicAiButton className="text-button">Xem gợi ý chuyên khoa <Icon name="arrow-right" size={17} /></PublicAiButton>
            </article>

            <article className="resource-panel">
              <CmsNativeText fieldId="support.eyebrow2" as="p" value={"Chuẩn bị trước khi gửi lịch"} className="section-note">Chuẩn bị trước khi gửi lịch</CmsNativeText>
              <CmsNativeText fieldId="support.title2" as="h2" value={"Để thao tác nhanh hơn"}>Để thao tác nhanh hơn</CmsNativeText>
              <ul className="booking-page__checklist">
                {PREPARE_ITEMS.map((item) => (
                  <li key={item}><Icon name="check" size={16} />{item}</li>
                ))}
              </ul>
              <Link className="text-button" href="/tra-cuu">Đã có mã hẹn? Tra cứu lịch <Icon name="arrow-up-right" size={17} /></Link>
            </article>
          </section>
        </CmsNativeSection>

        <CmsNativeSection sectionId="branches">
          <section className="booking-page__branches" aria-labelledby="booking-branches-heading">
            <div className="booking-page__branches-heading">
              <CmsNativeText fieldId="branches.eyebrow" as="p" value={"Các cơ sở khám nổi bật"} className="section-note">Các cơ sở khám nổi bật</CmsNativeText>
              <CmsNativeText fieldId="branches.title" as="h2" value={"Chọn cơ sở thuận tiện nhất trước khi vào form"} id="booking-branches-heading">Chọn cơ sở thuận tiện nhất trước khi vào form</CmsNativeText>
              <CmsNativeText fieldId="branches.body" as="p" value={"Xem địa chỉ, giờ làm việc và số điện thoại của từng cơ sở trước khi chọn lịch."}>
                Xem địa chỉ, giờ làm việc và số điện thoại của từng cơ sở trước khi chọn lịch.
              </CmsNativeText>
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
                          {address || <span className="resource-muted">Địa chỉ chưa công bố; vui lòng xác nhận trước khi đến.</span>}
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
                        {branch.activeDoctorCount === 0 ? (
                          <Link className="outline-button outline-button--small" href={`/branches/${branch.slug}`}>
                            Xem tình trạng lịch
                          </Link>
                        ) : (
                          <PublicBookingButton
                            className="outline-button outline-button--small"
                            selection={{ branchId: branch.id }}
                          >
                            Đặt lịch khám
                          </PublicBookingButton>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="catalog-status" role="status">
                <p>Chưa có cơ sở công khai để chọn lịch. Bạn vẫn có thể xem danh sách cơ sở hoặc gửi yêu cầu tư vấn để được hỗ trợ.</p>
                <Link className="outline-button outline-button--small" href="/branches">
                  Xem cơ sở
                </Link>
              </div>
            )}
          </section>
        </CmsNativeSection>

      </div>
    </PublicPageShell>
  );
}
