import PublicPageShell from "../components/PublicPageShell";

export default function Loading() {
  return (
    <PublicPageShell>
      <section aria-busy="true" aria-labelledby="route-loading-title" className="route-state section-inner">
        <div className="resource-panel resource-panel--accent route-state__card" role="status">
          <p className="section-note">Đang chuẩn bị trải nghiệm</p>
          {/* Not an h1: this fallback coexists with the page's real h1 while
              streaming, so screen readers would otherwise announce two h1s. */}
          <p className="route-state__title" id="route-loading-title">Đang tải dữ liệu bệnh viện…</p>
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
