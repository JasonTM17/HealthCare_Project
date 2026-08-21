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

const SPECIALTY_STEPS = [
  ["01", "Đối chiếu triệu chứng", "Xem nhóm dấu hiệu thường gặp để chuẩn bị câu hỏi trước khi khám."],
  ["02", "Mở hồ sơ bác sĩ", "Chọn bác sĩ theo chuyên môn và cơ sở thuận tiện nhất với bạn."],
  ["03", "Giữ khung giờ", "Đặt lịch theo chuyên khoa để hệ thống kiểm tra cơ sở và thời gian còn trống."],
] as const;

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
      .catch(() => {
        if (!cancelled) setError("Tạm thời chưa thể tải thông tin chuyên khoa. Vui lòng thử lại sau.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [params.slug]);

  const symptomCount = specialty?.commonSymptoms?.length ?? 0;
  const preparationCount = specialty?.preparationSteps?.length ?? 0;
  const relatedDoctorCount = specialty?.relatedDoctors?.length ?? 0;

  return (
    <PublicPageShell>
      <div className="resource-page section-inner">
        <PublicBackLink href="/specialties">← Quay lại danh sách chuyên khoa</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Thông tin chuyên khoa</p>
          <h1>Bắt đầu từ điều bạn đang quan tâm</h1>
          <p>Tìm hiểu phạm vi chăm sóc, cách chuẩn bị và đội ngũ bác sĩ phù hợp với nhu cầu của bạn.</p>
        </header>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải chuyên khoa…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && !specialty ? <p className="catalog-status" role="status">Không tìm thấy thông tin chuyên khoa này.</p> : null}

        {specialty ? (
          <article className="resource-hero-card resource-hero-card--teal">
            <div className="resource-icon" aria-hidden="true"><ClinicalIcon name="specialty" /></div>
            <div className="resource-hero-card__body">
              <span className="resource-chip">Chuyên khoa</span>
              <h2>{specialty.name}</h2>
              <p className="resource-lead">Thông tin định hướng để chuẩn bị câu hỏi trước buổi khám.</p>
              <p>{specialty.description || "Chuyên khoa chưa có phần mô tả chi tiết."}</p>
              <div className="resource-actions">
                <PublicBookingButton selection={{ specialtyId: specialty.id }}>Đặt lịch theo chuyên khoa</PublicBookingButton>
                <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
                <Link className="outline-button outline-button--light" href={`/doctors?specialty=${encodeURIComponent(specialty.slug)}`}>Xem bác sĩ liên quan</Link>
              </div>
              <dl className="resource-meta-grid">
                <div>
                  <dt>Triệu chứng tham khảo</dt>
                  <dd>{symptomCount || "Đang cập nhật"}</dd>
                </div>
                <div>
                  <dt>Bước chuẩn bị</dt>
                  <dd>{preparationCount || "Đang cập nhật"}</dd>
                </div>
                <div>
                  <dt>Bác sĩ liên quan</dt>
                  <dd>{relatedDoctorCount || "Đang cập nhật"}</dd>
                </div>
              </dl>
            </div>
          </article>
        ) : null}

        {specialty ? (
          <div className="resource-grid resource-grid--two">
            <section className="resource-panel">
              <p className="section-note">Hành trình chăm sóc</p>
              <h2>Từ triệu chứng tới cuộc hẹn</h2>
              <div className="resource-steps resource-steps--grid">
                {SPECIALTY_STEPS.map(([number, title, description]) => (
                  <div className="resource-step-card" key={number}>
                    <span>{number}</span>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="resource-panel resource-panel--accent">
              <p className="section-note">Bước tiếp theo</p>
              <h2>Bạn đã sẵn sàng chọn ngày khám?</h2>
              <p>Khung giờ thực tế chỉ hiển thị sau khi chọn bác sĩ, cơ sở và ngày.</p>
              <PublicAiButton className="outline-button">Hỗ trợ chọn chuyên khoa</PublicAiButton>
            </section>
          </div>
        ) : null}

        {specialty ? <div className="resource-grid resource-grid--two">
          <section className="resource-panel"><p className="section-note">Triệu chứng thường gặp</p><h2>Điều bạn có thể chuẩn bị</h2>{specialty.commonSymptoms?.length ? <ul className="resource-list">{specialty.commonSymptoms.map((symptom) => <li key={symptom}>{symptom}</li>)}</ul> : <p className="resource-muted">Nội dung tham khảo đang được cập nhật.</p>}<p className="section-note resource-detail-block__label">Trước buổi khám</p>{specialty.preparationSteps?.length ? <ul className="resource-list">{specialty.preparationSteps.map((step) => <li key={step}>{step}</li>)}</ul> : <p className="resource-muted">Hướng dẫn chuẩn bị đang được cập nhật.</p>}</section>
          <section className="resource-panel resource-panel--accent"><p className="section-note">Lộ trình tham khảo</p><h2>Lộ trình chăm sóc</h2>{specialty.carePathway ? <p className="resource-pathway">{specialty.carePathway}</p> : <p className="resource-muted">Lộ trình chăm sóc đang được cập nhật.</p>}</section>
        </div> : null}

        {specialty ? <section className="resource-panel resource-panel--wide"><p className="section-note">Bác sĩ theo chuyên khoa</p><h2>Đội ngũ phù hợp với chuyên khoa</h2>{specialty.relatedDoctors?.length ? <div className="resource-doctor-grid resource-doctor-grid--wide">{specialty.relatedDoctors.map((doctor) => <Link className="resource-doctor-card" href={`/doctors/${doctor.slug}`} key={doctor.id}><strong>{doctor.fullName}</strong><span>{doctor.specialtyName || specialty.name}</span><span className="text-button">Mở hồ sơ bác sĩ →</span></Link>)}</div> : <p className="resource-muted">Danh sách bác sĩ phù hợp đang được cập nhật.</p>}</section> : null}
      </div>
    </PublicPageShell>
  );
}
