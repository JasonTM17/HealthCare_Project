"use client";

import PublicPageShell, { PublicAiButton, PublicBackLink, PublicBookingButton } from "../components/PublicPageShell";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const hasDigest = typeof error.digest === "string" && error.digest.length > 0;

  return (
    <PublicPageShell>
      <section aria-labelledby="route-error-title" className="route-state section-inner">
        <div aria-live="assertive" className="resource-panel route-state__card route-state__card--error" role="alert">
          <p className="section-note">Trải nghiệm tạm gián đoạn</p>
          <h1 id="route-error-title">Chưa thể hiển thị trang này</h1>
          <p>
            Dữ liệu bệnh viện có thể đang được cập nhật hoặc kết nối tạm thời chưa ổn định. Hãy thử tải lại,
            quay về trang chính, hoặc tiếp tục với đặt lịch và hỗ trợ chọn chuyên khoa.
          </p>
          {hasDigest ? <p className="route-state__digest">Mã sự cố: {error.digest}</p> : null}
          <div className="route-state__actions">
            <button className="button button--primary" onClick={reset} type="button">Thử tải lại</button>
            <PublicBookingButton>Đặt lịch khám</PublicBookingButton>
            <PublicAiButton>Hỗ trợ chọn chuyên khoa</PublicAiButton>
            <PublicBackLink>Về trang chính</PublicBackLink>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
