"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchBranches, fetchDoctors, fetchSpecialties } from "../../lib/api-client";
import { PublicPageShell } from "../../components/PublicPageShell";

type Snapshot = { doctors: number; specialties: number; branches: number };

export default function AboutPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      try {
        const [doctors, specialties, branches] = await Promise.all([
          fetchDoctors({ page: 0, size: 1 }),
          fetchSpecialties(0, 1),
          fetchBranches(0, 1),
        ]);
        if (!cancelled) setSnapshot({ doctors: doctors.totalElements, specialties: specialties.totalElements, branches: branches.totalElements });
      } catch (reason: unknown) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể đọc snapshot catalog.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; void task; };
  }, []);

  return <PublicPageShell><div className="resource-page section-inner"><header className="resource-page__header"><p className="section-note">Về HealthCare Project</p><h1>Chăm sóc có định hướng, thông tin rõ ràng</h1><p>Đây là nền tảng giáo dục/local mô phỏng trải nghiệm bệnh viện đa khoa Việt Nam, tập trung vào hành trình từ nhu cầu chăm sóc tới cuộc hẹn.</p></header><div className="resource-grid resource-grid--two"><section className="resource-panel resource-panel--accent"><p className="section-note">Care Rail</p><h2>Ít nhiễu hơn, dễ bắt đầu hơn</h2><p>Thiết kế ưu tiên một bước tiếp theo rõ ràng: tìm chuyên khoa, xem hồ sơ, chọn cơ sở và giữ khung giờ. Các nội dung y tế không được trình bày như chẩn đoán.</p></section><section className="resource-panel"><p className="section-note">Minh bạch dữ liệu</p><h2>Backend là nguồn sự thật</h2><p>Catalog, lịch hẹn, CMS và cổng thông tin đọc theo contract backend. Khi hệ thống chưa trả dữ liệu, giao diện hiển thị trạng thái trống hoặc unavailable thay vì tự dựng bản ghi.</p><Link className="text-button" href="/doctors">Khám phá catalog →</Link></section></div><section className="resource-panel resource-panel--wide"><div className="section-heading"><div><p className="section-note">Snapshot catalog</p><h2>Dữ liệu active hiện tại</h2></div><span className="resource-chip">Backend read</span></div>{loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải snapshot…</p> : null}{error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có số liệu demo thay thế.</p> : null}{snapshot ? <div className="catalog-grid catalog-grid--compact">{[["Bác sĩ", snapshot.doctors], ["Chuyên khoa", snapshot.specialties], ["Cơ sở", snapshot.branches]].map(([label, count]) => <div className="catalog-card" key={label}><p className="section-note">{label}</p><strong className="catalog-card__metric">{count}</strong><p>active trong public catalog</p></div>)}</div> : null}</section><section className="resource-panel resource-panel--wide"><p className="section-note">Phạm vi hiện tại</p><h2>Giá trị cho bản demo local</h2><ul className="resource-list"><li>Đặt lịch branch-aware với hold, OTP và tra cứu.</li><li>AI Care Navigator chỉ gợi ý chuyên khoa, luôn kèm disclaimer.</li><li>Admin CMS publish component typed để user nhận cập nhật realtime.</li></ul></section></div></PublicPageShell>;
}
