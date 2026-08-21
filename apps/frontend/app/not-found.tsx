import Link from "next/link";
import PublicPageShell, { PublicAiButton, PublicBookingButton } from "../components/PublicPageShell";

export default function NotFound() {
  return (
    <PublicPageShell>
      <section aria-labelledby="not-found-title" className="route-state section-inner">
        <div className="resource-panel route-state__card">
          <p className="section-note">Không tìm thấy nội dung</p>
          <h1 id="not-found-title">Trang này không còn khả dụng</h1>
          <p>
            Đường dẫn có thể đã thay đổi hoặc nội dung chưa được xuất bản. Bạn vẫn có thể quay về trang chính,
            tìm chuyên khoa phù hợp hoặc đặt lịch khám từ dữ liệu đang hoạt động.
          </p>
          <div className="route-state__actions">
            <Link className="button button--primary" href="/">Về trang chủ</Link>
            <PublicBookingButton>Đặt lịch khám</PublicBookingButton>
            <PublicAiButton>Hỗ trợ chọn chuyên khoa</PublicAiButton>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
