"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchDoctorBySlug } from "../../../lib/api-client";
import type { Doctor } from "../../../types/hospital";
import {
  PublicAiButton,
  PublicBackLink,
  PublicBookingButton,
  PublicPageShell,
} from "../../../components/PublicPageShell";

const DOCTOR_STEPS = [
  ["01", "Xem chuyên khoa", "Kiểm tra xem bác sĩ có đúng phạm vi điều trị bạn đang cần không."],
  ["02", "Chọn cơ sở", "Đối chiếu các cơ sở làm việc để sắp xếp đi lại thuận tiện hơn."],
  ["03", "Đặt lịch", "Giữ khung giờ trước khi bạn chuyển sang luồng đặt hẹn."],
] as const;

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

export default function DoctorDetailPage() {
  const params = useParams<{ slug: string }>();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setDoctor(null);
        setLoading(true);
        setError(null);
        return fetchDoctorBySlug(params.slug);
      })
      .then((data) => { if (data !== undefined && !cancelled) setDoctor(data); })
      .catch(() => {
        if (!cancelled) setError("Tạm thời chưa thể tải hồ sơ bác sĩ. Vui lòng thử lại sau.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [params.slug]);

  return (
    <PublicPageShell>
      <div className="resource-page section-inner">
        <PublicBackLink href="/doctors">← Quay lại danh sách bác sĩ</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Hồ sơ bác sĩ</p>
          <h1>Bác sĩ đồng hành cùng bạn</h1>
          <p>Tìm hiểu chuyên môn, kinh nghiệm và chọn cơ sở, ngày khám thuận tiện với bạn.</p>
        </header>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải hồ sơ bác sĩ…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && !doctor ? <p className="catalog-status" role="status">Không tìm thấy hồ sơ bác sĩ này.</p> : null}

        {doctor ? (
          <>
            <article className="resource-hero-card resource-hero-card--teal">
              <div className="resource-avatar" aria-hidden="true">{initials(doctor.fullName)}</div>
              <div className="resource-hero-card__body">
                <div className="resource-chip-row">
                  {doctor.specialtyName ? <span className="resource-chip">{doctor.specialtyName}</span> : null}
                  {doctor.experienceYears ? <span className="resource-chip resource-chip--warm">{doctor.experienceYears} năm kinh nghiệm</span> : null}
                </div>
                <h2>{doctor.fullName}</h2>
                <p className="resource-lead">{doctor.title ?? "Bác sĩ chuyên khoa"}</p>
                <p>{doctor.bio || "Hồ sơ chưa có phần giới thiệu chi tiết."}</p>
                <div className="resource-actions">
                  <PublicBookingButton selection={{ doctorId: doctor.id }}>Đặt lịch với bác sĩ</PublicBookingButton>
                  <PublicAiButton className="outline-button outline-button--light">Hỗ trợ chọn chuyên khoa</PublicAiButton>
                </div>
                <dl className="resource-meta-grid">
                  <div>
                    <dt>Chuyên khoa</dt>
                    <dd>{doctor.specialtyName ?? "Đang cập nhật"}</dd>
                  </div>
                  <div>
                    <dt>Cơ sở làm việc</dt>
                    <dd>{doctor.branchNames?.length ? doctor.branchNames.slice(0, 2).join(" · ") : "Đang cập nhật"}</dd>
                  </div>
                </dl>
              </div>
            </article>

            <section className="resource-panel resource-panel--wide">
              <div className="section-heading">
                <div>
                  <p className="section-note">Cách chọn bác sĩ</p>
                  <h2>Ba bước trước khi chốt cuộc hẹn</h2>
                </div>
              </div>
              <div className="resource-steps resource-steps--grid">
                {DOCTOR_STEPS.map(([number, title, description]) => (
                  <div className="resource-step-card" key={number}>
                    <span>{number}</span>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {doctor ? (
          <div className="resource-grid resource-grid--two">
            <section className="resource-panel">
              <p className="section-note">Chuẩn bị cuộc hẹn</p>
              <h2>Điều cần biết trước khi đặt lịch</h2>
              <ul className="resource-list">
                <li>Chọn đúng cơ sở thuộc lịch làm việc của bác sĩ.</li>
                <li>Khung giờ được xác nhận sau khi hệ thống giữ chỗ thành công.</li>
                <li>Hãy mang theo mã lịch hẹn khi đến cơ sở.</li>
              </ul>
            </section>
            <section className="resource-panel resource-panel--accent">
              <p className="section-note">Lưu ý an toàn</p>
              <h2>Trợ lý chọn khoa chỉ mang tính tham khảo</h2>
              <p>Gợi ý trực tuyến không phải chẩn đoán và không thay thế việc thăm khám trực tiếp với bác sĩ.</p>
              <div className="resource-actions">
                <PublicBookingButton className="outline-button outline-button--dark">Mở luồng đặt lịch</PublicBookingButton>
                <PublicAiButton className="outline-button outline-button--light">Xem chuyên khoa liên quan</PublicAiButton>
              </div>
              <Link className="text-button" href="/specialties">
                Khám phá chuyên khoa →
              </Link>
            </section>
          </div>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
