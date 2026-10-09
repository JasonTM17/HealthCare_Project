"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchServiceBySlug } from "../../../lib/api-client";
import type { MedicalService } from "../../../types/hospital";
import { ClinicalIcon } from "../../../components/ClinicalIcon";
import { PublicAiButton, PublicBackLink, PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";
import { CmsNativeSection, CmsNativeText, CmsNativeSections } from "../../../components/cms/cms-page-layout-provider";

const SERVICE_STEPS = [
  ["01", "Đọc mô tả", "Xác nhận đây có phải dịch vụ phù hợp với nhu cầu hiện tại không."],
  ["02", "So sánh gói liên quan", "Mở sang gói khám nếu bạn muốn xem phạm vi chăm sóc rộng hơn."],
  ["03", "Đặt lịch", "Khi đã chắc chắn, đi thẳng sang form đặt lịch để giữ khung giờ."],
] as const;

export default function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string; }>();
  const [service, setService] = useState<MedicalService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        if (!slug || typeof slug !== "string") return undefined;
        setService(null);
        setLoading(true);
        setError(null);
        return fetchServiceBySlug(slug);
      })
      .then((data) => { if (data !== undefined && !cancelled) setService(data); })
      .catch(() => { if (!cancelled) setError("Tạm thời chưa thể tải thông tin dịch vụ. Vui lòng thử lại sau."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <PublicPageShell cmsEntityId={service?.id}>
      <div className="resource-page section-inner">
        <CmsNativeSection sectionId="intro">
          <PublicBackLink href="/services">← Quay lại danh mục dịch vụ</PublicBackLink>
          <header className="resource-page__header">
            <CmsNativeText fieldId="intro.eyebrow" as="p" value={"Dịch vụ y tế"} className="section-note">Dịch vụ y tế</CmsNativeText>
            <CmsNativeText fieldId="intro.title" as="h1" value={"Dịch vụ chăm sóc theo nhu cầu"}>Dịch vụ chăm sóc theo nhu cầu</CmsNativeText>
            <CmsNativeText fieldId="intro.body" as="p" value={"Tìm hiểu thông tin dịch vụ và đặt lịch trao đổi với đội ngũ chuyên môn."}>Tìm hiểu thông tin dịch vụ và đặt lịch trao đổi với đội ngũ chuyên môn.</CmsNativeText>
          </header>
        </CmsNativeSection>
        <CmsNativeSection sectionId="states">
          {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải dịch vụ…</p> : null}
          {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
          {!loading && !error && !service ? <p className="catalog-status" role="status">Không tìm thấy thông tin dịch vụ này.</p> : null}
        </CmsNativeSection>
        {service ? (
          <>
            <CmsNativeSection sectionId="profile">
              <article className="resource-hero-card resource-hero-card--teal">
                <div className="resource-icon" aria-hidden="true">
                  <ClinicalIcon name="service" />
                </div>
                <div className="resource-hero-card__body">
                  <span className="resource-chip">Dịch vụ</span>
                  <h2>{service.name}</h2>
                  <p className="resource-lead">{service.description || "Thông tin chi tiết của dịch vụ đang được cập nhật."}</p>
                  <div className="resource-actions">
                    <PublicBookingButton>Trao đổi nhu cầu và đặt lịch</PublicBookingButton>
                    <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
                    <Link className="outline-button outline-button--light" href="/packages">Xem gói khám liên quan</Link>
                  </div>
                  <dl className="resource-meta-grid">
                    <div>
                      <dt>Loại nội dung</dt>
                      <dd>Dịch vụ công khai</dd>
                    </div>
                    <div>
                      <dt>Hành động tiếp theo</dt>
                      <dd>Đặt lịch hoặc xem gói khám</dd>
                    </div>
                  </dl>
                </div>
              </article>
            </CmsNativeSection>

            <CmsNativeSections>
              <CmsNativeSection sectionId="guide">
                <section className="resource-panel resource-panel--wide">
                  <div className="section-heading">
                    <div>
                      <CmsNativeText fieldId="guide.eyebrow" as="p" value={"Cách dùng dịch vụ"} className="section-note">Cách dùng dịch vụ</CmsNativeText>
                      <CmsNativeText fieldId="guide.title" as="h2" value={"Ba bước trước khi chốt lựa chọn"}>Ba bước trước khi chốt lựa chọn</CmsNativeText>
                    </div>
                  </div>
                  <div className="resource-steps resource-steps--grid">
                    {SERVICE_STEPS.map(([number, title, description]) => (
                      <div className="resource-step-card" key={number}>
                        <span>{number}</span>
                        <CmsNativeText fieldId={`guide.step${number}.title`} as="strong" value={title}>{title}</CmsNativeText>
                        <CmsNativeText fieldId={`guide.step${number}.body`} as="p" value={description}>{description}</CmsNativeText>
                      </div>
                    ))}
                  </div>
                </section>
              </CmsNativeSection>

              <CmsNativeSection sectionId="support">
                <section className="resource-grid resource-grid--two">
                  <section className="resource-panel resource-panel--accent">
                    <CmsNativeText fieldId="support.eyebrow" as="p" value={"Khi nào nên dùng"} className="section-note">Khi nào nên dùng</CmsNativeText>
                    <CmsNativeText fieldId="support.title" as="h2" value={"Chọn dịch vụ khi bạn đã có nhu cầu rõ hơn"}>Chọn dịch vụ khi bạn đã có nhu cầu rõ hơn</CmsNativeText>
                    <CmsNativeText fieldId="support.body" as="p" value={"Nếu bạn biết mình đang cần hỗ trợ ở nhóm dịch vụ nào, đây là điểm vào nhanh trước khi mở gói khám hoặc đặt lịch."}>
                      Nếu bạn biết mình đang cần hỗ trợ ở nhóm dịch vụ nào, đây là điểm vào nhanh trước
                      khi mở gói khám hoặc đặt lịch.
                    </CmsNativeText>
                  </section>
                  <section className="resource-panel">
                    <CmsNativeText fieldId="support.eyebrow2" as="p" value={"Đi tiếp sau khi đọc"} className="section-note">Đi tiếp sau khi đọc</CmsNativeText>
                    <CmsNativeText fieldId="support.title2" as="h2" value={"Không cần vòng qua nhiều trang"}>Không cần vòng qua nhiều trang</CmsNativeText>
                    <CmsNativeText fieldId="support.body2" as="p" value={"Mở gói khám để so sánh phạm vi chăm sóc, hoặc đặt lịch ngay khi đã sẵn sàng."}>Mở gói khám để so sánh phạm vi chăm sóc, hoặc đặt lịch ngay khi đã sẵn sàng.</CmsNativeText>
                    <div className="resource-actions">
                      <Link className="text-button" href="/packages">Xem gói khám →</Link>
                      <PublicBookingButton className="outline-button outline-button--small">Đặt lịch</PublicBookingButton>
                    </div>
                  </section>
                </section>
              </CmsNativeSection>
            </CmsNativeSections>
          </>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
