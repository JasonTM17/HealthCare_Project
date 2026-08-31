import PublicPageShell from "../components/PublicPageShell";

export default function Loading() {
  return (
    <PublicPageShell>
      <section aria-busy="true" aria-labelledby="route-loading-title" className="route-state section-inner">
        <div className="resource-panel resource-panel--accent route-state__card" role="status">
          <p className="section-note">Đang chuẩn bị trải nghiệm</p>
          <h1 id="route-loading-title">Đang tải dữ liệu bệnh viện…</h1>
          <p>
            HealthCare đang cập nhật thông tin chuyên khoa, cơ sở và lịch khám mới nhất.
          </p>
          <div aria-hidden="true" className="route-state__skeletons">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
