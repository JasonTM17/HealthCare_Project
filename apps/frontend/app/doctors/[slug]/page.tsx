"use client";

import Link from "next/link";
import Image from "next/image";
import { getDoctorInitials, getDoctorPhoto } from "../../../lib/doctor-portrait";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchDoctorBySlug, fetchSpecialties } from "../../../lib/api-client";
import { safeSiteOrigin } from "../../../lib/site-url";
import type { Doctor, Specialty } from "../../../types/hospital";
import { specialtyIdForDoctor } from "../../../components/BookingModal";
import {
  PublicAiButton,
  PublicBackLink,
  PublicBookingButton,
  PublicPageShell,
} from "../../../components/PublicPageShell";
import { JsonLd } from "../../../components/JsonLd";
import { CmsNativeSection, CmsNativeText } from "../../../components/cms/cms-page-layout-provider";

const DOCTOR_STEPS = [
  ["01", "Xem chuyên khoa", "Kiểm tra xem bác sĩ có đúng phạm vi điều trị bạn đang cần không."],
  ["02", "Chọn cơ sở", "Đối chiếu các cơ sở làm việc để sắp xếp đi lại thuận tiện hơn."],
  ["03", "Đặt lịch", "Giữ khung giờ trước khi bạn chuyển sang luồng đặt hẹn."],
] as const;

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

export default function DoctorDetailPage() {
  const params = useParams<{ slug: string; }>();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSpecialties(0, 100)
      .then((data) => {
        if (!cancelled) setSpecialties(data.content);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        if (!params?.slug || typeof params.slug !== "string") return undefined;
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
  }, [params?.slug]);

  const isDemoDoctor = Boolean(doctor?.demo) || Boolean(doctor?.slug?.startsWith("demo-bs-"));

  const doctorJsonLd = doctor
    ? {
      "@context": "https://schema.org",
      "@type": "Physician",
      name: doctor.fullName,
      jobTitle: doctor.title || "Bác sĩ chuyên khoa",
      medicalSpecialty: doctor.specialtyName || "Y đa khoa",
      description: doctor.bio || "Bác sĩ chuyên khoa giàu kinh nghiệm tại Hệ thống Bệnh viện Đa khoa HealthCare",
      image: (() => {
        const photo = getDoctorPhoto(doctor);
        if (!photo) return undefined;
        return /^https?:\/\//i.test(photo) ? photo : `${safeSiteOrigin()}${photo}`;
      })(),
      worksFor: {
        "@type": "MedicalOrganization",
        name: "Hệ thống Bệnh viện Đa khoa HealthCare",
        url: safeSiteOrigin(),
      },
    }
    : null;

  return (
    <PublicPageShell cmsEntityId={doctor?.id} doctors={doctor ? [doctor] : []} specialties={specialties}>
      {doctorJsonLd ? <JsonLd data={doctorJsonLd} id="doctor-jsonld" /> : null}
      <div className="resource-page section-inner">
        <CmsNativeSection sectionId="intro">
          <PublicBackLink href="/doctors">← Quay lại danh sách bác sĩ</PublicBackLink>
          <header className="resource-page__header">
            <CmsNativeText fieldId="intro.eyebrow" as="p" value={"Hồ sơ bác sĩ"} className="section-note">Hồ sơ bác sĩ</CmsNativeText>
            {/* Every doctor URL used to ship the same H1, so search results and
              browser tabs were indistinguishable from one another. */}
            <h1>{doctor?.fullName ?? "Bác sĩ đồng hành cùng bạn"}</h1>
            <p>{doctor?.title ?? "Tìm hiểu chuyên môn, kinh nghiệm và chọn cơ sở, ngày khám thuận tiện với bạn."}</p>
          </header>
        </CmsNativeSection>

        <CmsNativeSection sectionId="states">
          {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải hồ sơ bác sĩ…</p> : null}
          {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
          {!loading && !error && !doctor ? <p className="catalog-status" role="status">Không tìm thấy hồ sơ bác sĩ này.</p> : null}
        </CmsNativeSection>

        {doctor ? (
          <>
            <CmsNativeSection sectionId="profile">
              <article className="resource-hero-card resource-hero-card--teal resource-hero-card--doctor">
                <div className="resource-avatar resource-avatar--doctor-detail">
                  {getDoctorPhoto(doctor) ? (
                    <Image
                      src={getDoctorPhoto(doctor) as string}
                      alt={`Ảnh bác sĩ ${doctor.fullName}`}
                      width={280}
                      height={280}
                      sizes="(max-width: 768px) 160px, 240px"
                      className="resource-avatar__img"
                      priority
                    />
                  ) : (
                    <span className="resource-avatar__initials" aria-hidden="true">
                      {getDoctorInitials(doctor.fullName)}
                    </span>
                  )}
                </div>
                <div className="resource-hero-card__body">
                  <div className="resource-chip-row">
                    {isDemoDoctor ? <span className="resource-chip resource-chip--muted">Hồ sơ minh họa</span> : null}
                    {doctor.specialtyName ? <span className="resource-chip">{doctor.specialtyName}</span> : null}
                    {doctor.experienceYears ? <span className="resource-chip resource-chip--warm">{doctor.experienceYears} năm kinh nghiệm</span> : null}
                  </div>
                  <h2>Hồ sơ chuyên môn</h2>
                  <p className="resource-lead">{doctor.title ?? "Bác sĩ chuyên khoa"}</p>
                  <p>{doctor.bio || "Hồ sơ chưa có phần giới thiệu chi tiết."}</p>
                  {isDemoDoctor ? (
                    <p className="resource-muted" role="note">
                      Dữ liệu minh họa: đây là hồ sơ giả lập phục vụ trải nghiệm đặt lịch thử nghiệm,
                      không đại diện cho một bác sĩ thật của cơ sở y tế.
                    </p>
                  ) : null}
                  <div className="resource-actions">
                    <PublicBookingButton
                      selection={{
                        doctorId: doctor.id,
                        specialtyId: specialtyIdForDoctor(doctor, specialties) || undefined,
                        branchId: doctor.branchId || doctor.branchIds?.[0],
                      }}
                    >
                      Đặt lịch với bác sĩ
                    </PublicBookingButton>
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
            </CmsNativeSection>

            {doctor.achievements ? (
              <CmsNativeSection sectionId="achievements">
                <section className="resource-panel resource-panel--wide mt-6">
                  <div className="section-heading">
                    <div>
                      <p className="section-note">Thành tựu & Cột mốc nổi bật</p>
                      <h2>Dấu ấn chuyên môn & Công trình lâm sàng</h2>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-[4px] p-6 text-slate-800 text-sm leading-relaxed whitespace-pre-line shadow-xs">
                    {doctor.achievements}
                  </div>
                </section>
              </CmsNativeSection>
            ) : null}

            <CmsNativeSection sectionId="guide">
              <section className="resource-panel resource-panel--wide">
                <div className="section-heading">
                  <div>
                    <CmsNativeText fieldId="guide.eyebrow" as="p" value={"Cách chọn bác sĩ"} className="section-note">Cách chọn bác sĩ</CmsNativeText>
                    <CmsNativeText fieldId="guide.title" as="h2" value={"Ba bước trước khi chốt cuộc hẹn"}>Ba bước trước khi chốt cuộc hẹn</CmsNativeText>
                  </div>
                </div>
                <div className="resource-steps resource-steps--grid">
                  {DOCTOR_STEPS.map(([number, title, description]) => (
                    <div className="resource-step-card" key={number}>
                      <span>{number}</span>
                      <CmsNativeText fieldId={`guide.step${number}.title`} as="strong" value={title}>{title}</CmsNativeText>
                      <CmsNativeText fieldId={`guide.step${number}.body`} as="p" value={description}>{description}</CmsNativeText>
                    </div>
                  ))}
                </div>
              </section>
            </CmsNativeSection>
          </>
        ) : null}

        <CmsNativeSection sectionId="support">
          {doctor ? (
            <div className="resource-grid resource-grid--two">
              <section className="resource-panel">
                <CmsNativeText fieldId="support.eyebrow" as="p" value={"Chuẩn bị cuộc hẹn"} className="section-note">Chuẩn bị cuộc hẹn</CmsNativeText>
                <CmsNativeText fieldId="support.title" as="h2" value={"Điều cần biết trước khi đặt lịch"}>Điều cần biết trước khi đặt lịch</CmsNativeText>
                <ul className="resource-list">
                  <li>Chọn đúng cơ sở thuộc lịch làm việc của bác sĩ.</li>
                  <li>Khung giờ được xác nhận sau khi hệ thống giữ chỗ thành công.</li>
                  <li>Hãy mang theo mã lịch hẹn khi đến cơ sở.</li>
                </ul>
              </section>
              <section className="resource-panel resource-panel--accent">
                <CmsNativeText fieldId="support.eyebrow2" as="p" value={"Lưu ý an toàn"} className="section-note">Lưu ý an toàn</CmsNativeText>
                <CmsNativeText fieldId="support.title2" as="h2" value={"Trợ lý chọn khoa chỉ mang tính tham khảo"}>Trợ lý chọn khoa chỉ mang tính tham khảo</CmsNativeText>
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
        </CmsNativeSection>
      </div>
    </PublicPageShell>
  );
}
