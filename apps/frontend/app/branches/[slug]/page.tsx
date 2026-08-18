"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchBranchBySlug } from "../../../lib/api-client";
import type { Branch } from "../../../types/hospital";
import { ClinicalIcon } from "../../../components/ClinicalIcon";
import { PublicBackLink, PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";

export default function BranchDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setBranch(null);
        setLoading(true);
        setError(null);
        return fetchBranchBySlug(slug);
      })
      .then((data) => { if (data !== undefined && !cancelled) setBranch(data); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải thông tin cơ sở."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <PublicPageShell branches={branch ? [branch] : []}>
      <div className="resource-page section-inner">
        <PublicBackLink href="/branches">← Quay lại mạng lưới cơ sở</PublicBackLink>
        <header className="resource-page__header"><p className="section-note">Mạng lưới phục vụ · catalog backend</p><h1>Một cơ sở gần bạn, một cuộc hẹn rõ ràng</h1><p>Kiểm tra địa chỉ, giờ làm việc và chọn cơ sở trước khi mở lịch.</p></header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải cơ sở…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có địa chỉ demo thay thế.</p> : null}
        {!loading && !error && !branch ? <p className="catalog-status" role="status">Không tìm thấy cơ sở active.</p> : null}
        {branch ? <article className="resource-hero-card"><div className="resource-icon" aria-hidden="true"><ClinicalIcon name="branch" /></div><div className="resource-hero-card__body"><span className="resource-chip">Cơ sở active</span><h2>{branch.name}</h2><dl className="resource-details"><div><dt>Địa chỉ</dt><dd>{branch.address}</dd></div><div><dt>Điện thoại</dt><dd>{branch.phone ? <a href={`tel:${branch.phone.replace(/\s/g, "")}`}>{branch.phone}</a> : <span className="resource-muted">Backend chưa cung cấp số điện thoại.</span>}</dd></div><div><dt>Giờ làm việc</dt><dd>{branch.workingHours || "Backend chưa cung cấp giờ làm việc."}</dd></div><div><dt>Cấp cứu</dt><dd>{branch.emergencyHotline || "Backend chưa cung cấp hotline cấp cứu riêng."}</dd></div><div><dt>Bản đồ</dt><dd>{branch.mapUrl ? <a href={branch.mapUrl} target="_blank" rel="noreferrer">Mở chỉ đường →</a> : <span className="resource-muted">Backend chưa cung cấp liên kết bản đồ.</span>}</dd></div></dl><div className="resource-actions"><PublicBookingButton selection={{ branchId: branch.id }}>Đặt lịch tại cơ sở này</PublicBookingButton>{branch.emergencyHotline || branch.phone ? <a className="outline-button" href={`tel:${(branch.emergencyHotline || branch.phone || "").replace(/\s/g, "")}`}>Gọi cơ sở</a> : <span className="resource-muted">Backend chưa cung cấp số để gọi.</span>}</div></div></article> : null}
        {branch ? <div className="resource-grid resource-grid--two">
          <section className="resource-panel"><p className="section-note">Tiện ích tại cơ sở</p><h2>Chuẩn bị cho lần đến khám</h2>{branch.amenities?.length ? <ul className="resource-list">{branch.amenities.map((amenity) => <li key={amenity}>{amenity}</li>)}</ul> : <p className="resource-muted">Backend chưa cung cấp danh sách tiện ích cho cơ sở này.</p>}</section>
          <section className="resource-panel resource-panel--accent"><p className="section-note">Đội ngũ tại cơ sở</p><h2>Bác sĩ đang làm việc</h2>{branch.doctors?.length ? <div className="resource-doctor-grid">{branch.doctors.map((doctor) => <Link className="resource-doctor-card" href={`/doctors/${doctor.slug}`} key={doctor.id}><strong>{doctor.fullName}</strong><span>{doctor.specialtyName || "Bác sĩ thuộc catalog active"}</span><span className="text-button">Xem hồ sơ →</span></Link>)}</div> : <p className="resource-muted">Backend chưa cung cấp bác sĩ liên kết cho cơ sở này.</p>}</section>
        </div> : null}
      </div>
    </PublicPageShell>
  );
}
