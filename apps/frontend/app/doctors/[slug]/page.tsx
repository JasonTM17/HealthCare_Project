"use client";

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
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải hồ sơ bác sĩ.");
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
          <p className="section-note">Hồ sơ chuyên gia · catalog backend</p>
          <h1>Bác sĩ đồng hành cùng bạn</h1>
          <p>Thông tin được hiển thị từ hồ sơ active; lịch còn trống sẽ được kiểm tra theo cơ sở và ngày bạn chọn.</p>
        </header>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải hồ sơ bác sĩ…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có hồ sơ demo thay thế.</p> : null}
        {!loading && !error && !doctor ? <p className="catalog-status" role="status">Không tìm thấy hồ sơ active cho đường dẫn này.</p> : null}

        {doctor ? (
          <article className="resource-hero-card">
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
                <PublicAiButton className="outline-button">Mô tả triệu chứng trước khi đặt</PublicAiButton>
              </div>
            </div>
          </article>
        ) : null}

        {doctor ? (
          <div className="resource-grid resource-grid--two">
            <section className="resource-panel">
              <p className="section-note">Chuẩn bị cuộc hẹn</p>
              <h2>Điều cần biết trước khi đặt lịch</h2>
              <ul className="resource-list">
                <li>Chọn đúng cơ sở thuộc lịch làm việc của bác sĩ.</li>
                <li>Khung giờ chỉ được xác nhận sau khi backend giữ chỗ thành công.</li>
                <li>Hãy mang theo mã lịch hẹn khi đến cơ sở.</li>
              </ul>
            </section>
            <section className="resource-panel resource-panel--accent">
              <p className="section-note">Ranh giới an toàn</p>
              <h2>Trợ lý AI chỉ gợi ý hướng chăm sóc</h2>
              <p>AI không chẩn đoán, không thay thế bác sĩ và không tự tạo lịch. Mọi identity đặt lịch đều lấy từ catalog backend.</p>
              <PublicBookingButton className="outline-button outline-button--dark">Mở luồng đặt lịch</PublicBookingButton>
            </section>
          </div>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
