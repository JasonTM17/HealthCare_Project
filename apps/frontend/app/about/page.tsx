import Link from "next/link";
import PublicPageShell from "../../components/PublicPageShell";

export default function AboutPage() {
  return (
    <PublicPageShell>
      <div className="resource-page section-inner">
        <header className="resource-page__header"><p className="section-note">Về HealthCare Project</p><h1>Chăm sóc có định hướng, thông tin rõ ràng</h1><p>Đây là nền tảng giáo dục/local mô phỏng trải nghiệm bệnh viện đa khoa Việt Nam, tập trung vào hành trình từ nhu cầu chăm sóc tới cuộc hẹn.</p></header>
        <div className="resource-grid resource-grid--two"><section className="resource-panel resource-panel--accent"><p className="section-note">Care Rail</p><h2>Ít nhiễu hơn, dễ bắt đầu hơn</h2><p>Thiết kế ưu tiên một bước tiếp theo rõ ràng: tìm chuyên khoa, xem hồ sơ, chọn cơ sở và giữ khung giờ. Các nội dung y tế không được trình bày như chẩn đoán.</p></section><section className="resource-panel"><p className="section-note">Minh bạch dữ liệu</p><h2>Backend là nguồn sự thật</h2><p>Catalog, lịch hẹn, CMS và cổng thông tin đọc theo contract backend. Khi hệ thống chưa trả dữ liệu, giao diện hiển thị trạng thái trống hoặc unavailable thay vì tự dựng bản ghi.</p><Link className="text-button" href="/doctors">Khám phá catalog →</Link></section></div>
        <section className="resource-panel resource-panel--wide"><p className="section-note">Phạm vi hiện tại</p><h2>Giá trị cho bản demo local</h2><ul className="resource-list"><li>Đặt lịch branch-aware với hold, OTP và tra cứu.</li><li>AI Care Navigator chỉ gợi ý chuyên khoa, luôn kèm disclaimer.</li><li>Admin CMS publish component typed để user nhận cập nhật realtime.</li></ul></section>
      </div>
    </PublicPageShell>
  );
}
