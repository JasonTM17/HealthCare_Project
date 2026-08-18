"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchSpecialtyBySlug } from "../../../lib/api-client";
import type { Specialty } from "../../../types/hospital";
import { ClinicalIcon } from "../../../components/ClinicalIcon";
import {
  PublicAiButton,
  PublicBackLink,
  PublicBookingButton,
  PublicPageShell,
} from "../../../components/PublicPageShell";

export default function SpecialtyDetailPage() {
  const params = useParams<{ slug: string }>();
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setSpecialty(null);
        setLoading(true);
        setError(null);
        return fetchSpecialtyBySlug(params.slug);
      })
      .then((data) => { if (data !== undefined && !cancelled) setSpecialty(data); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải chuyên khoa.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [params.slug]);

  return (
    <PublicPageShell>
      <div className="resource-page section-inner">
        <PublicBackLink href="/specialties">← Quay lại danh sách chuyên khoa</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Care Rail · chuyên khoa</p>
          <h1>Bắt đầu từ điều bạn đang quan tâm</h1>
          <p>Mô tả chuyên khoa được lấy từ catalog công khai. Bạn có thể tiếp tục tới bác sĩ hoặc mở lịch khám theo nhu cầu.</p>
        </header>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải chuyên khoa…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có dữ liệu demo thay thế.</p> : null}
        {!loading && !error && !specialty ? <p className="catalog-status" role="status">Không tìm thấy chuyên khoa active cho đường dẫn này.</p> : null}

        {specialty ? (
          <article className="resource-hero-card resource-hero-card--teal">
            <div className="resource-icon" aria-hidden="true"><ClinicalIcon name="specialty" /></div>
            <div className="resource-hero-card__body">
              <span className="resource-chip">Chuyên khoa active</span>
              <h2>{specialty.name}</h2>
              <p className="resource-lead">Thông tin định hướng để chuẩn bị câu hỏi trước buổi khám.</p>
              <p>{specialty.description || "Chuyên khoa chưa có phần mô tả chi tiết."}</p>
              <div className="resource-actions">
                <PublicBookingButton selection={{ specialtyId: specialty.id }}>Đặt lịch theo chuyên khoa</PublicBookingButton>
                <Link className="outline-button outline-button--light" href={`/doctors?specialty=${encodeURIComponent(specialty.slug)}`}>Xem bác sĩ liên quan</Link>
              </div>
            </div>
          </article>
        ) : null}

        {specialty ? (
          <div className="resource-grid resource-grid--two">
            <section className="resource-panel">
              <p className="section-note">Hành trình chăm sóc</p>
              <h2>Từ triệu chứng tới cuộc hẹn</h2>
              <ol className="resource-steps">
                <li><strong>Mô tả điều bạn đang quan tâm</strong><span>AI chỉ gợi ý hướng, không chẩn đoán.</span></li>
                <li><strong>Kiểm tra hồ sơ bác sĩ</strong><span>Chọn theo chuyên môn và cơ sở active.</span></li>
                <li><strong>Giữ khung giờ</strong><span>Backend xác nhận branch và slot trước khi hold.</span></li>
              </ol>
            </section>
            <section className="resource-panel resource-panel--accent">
              <p className="section-note">Bước tiếp theo</p>
              <h2>Bạn đã sẵn sàng chọn ngày khám?</h2>
              <p>Khung giờ thực tế chỉ hiển thị sau khi chọn bác sĩ, cơ sở và ngày.</p>
              <PublicAiButton className="outline-button">Mở Care Navigator</PublicAiButton>
            </section>
          </div>
        ) : null}

        {specialty ? <div className="resource-grid resource-grid--two">
          <section className="resource-panel"><p className="section-note">Triệu chứng thường gặp</p><h2>Điều bạn có thể chuẩn bị</h2>{specialty.commonSymptoms?.length ? <ul className="resource-list">{specialty.commonSymptoms.map((symptom) => <li key={symptom}>{symptom}</li>)}</ul> : <p className="resource-muted">Backend chưa cung cấp nhóm triệu chứng tham khảo cho chuyên khoa này.</p>}<p className="section-note resource-detail-block__label">Trước buổi khám</p>{specialty.preparationSteps?.length ? <ul className="resource-list">{specialty.preparationSteps.map((step) => <li key={step}>{step}</li>)}</ul> : <p className="resource-muted">Backend chưa cung cấp hướng dẫn chuẩn bị.</p>}</section>
          <section className="resource-panel resource-panel--accent"><p className="section-note">Care pathway · backend</p><h2>Lộ trình chăm sóc</h2>{specialty.carePathway ? <p className="resource-pathway">{specialty.carePathway}</p> : <p className="resource-muted">Backend chưa cung cấp lộ trình chăm sóc cho chuyên khoa này.</p>}</section>
        </div> : null}

        {specialty ? <section className="resource-panel resource-panel--wide"><p className="section-note">Bác sĩ liên quan · catalog active</p><h2>Đội ngũ phù hợp với chuyên khoa</h2>{specialty.relatedDoctors?.length ? <div className="resource-doctor-grid resource-doctor-grid--wide">{specialty.relatedDoctors.map((doctor) => <Link className="resource-doctor-card" href={`/doctors/${doctor.slug}`} key={doctor.id}><strong>{doctor.fullName}</strong><span>{doctor.specialtyName || specialty.name}</span><span className="text-button">Mở hồ sơ bác sĩ →</span></Link>)}</div> : <p className="resource-muted">Backend chưa trả về bác sĩ liên quan cho chuyên khoa này.</p>}</section> : null}
      </div>
    </PublicPageShell>
  );
}
