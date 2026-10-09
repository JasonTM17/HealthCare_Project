"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { packageVisualStyles } from "../../../components/PackageVisualCard";
import { PublicAiButton, PublicBackLink, PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";
import { fetchPackageBySlug } from "../../../lib/api-client";
import { safeSiteOrigin } from "../../../lib/site-url";
import { getPackageVisual } from "../../../lib/package-visuals";
import type { HealthPackage } from "../../../types/hospital";
import PackageBookingModal from "../../../components/PackageBookingModal";
import { JsonLd } from "../../../components/JsonLd";
import { isCmsPreviewRequested } from "../../../lib/cms-preview-bridge";
import { CmsNativeSection, CmsNativeText } from "../../../components/cms/cms-page-layout-provider";
import { ILLUSTRATIVE_BOOKING_NOTICE, isIllustrativeCatalogue } from "../../../lib/catalogue-illustration";

const currency = (price: number) => new Intl.NumberFormat("vi-VN").format(price);
const PACKAGE_DETAIL_STEPS = [
  ["01", "Xem đối tượng phù hợp", "Đối chiếu nhu cầu của bạn với phần mô tả và nhóm người dùng của gói."],
  ["02", "Kiểm tra nội dung khám", "Đọc checklist và bước chuẩn bị để tránh thiếu giấy tờ hoặc thông tin cần thiết."],
  ["03", "Giữ lịch khám", "Đặt lịch với đúng gói để hệ thống chuyển lựa chọn sang form đặt hẹn."],
] as const;

export default function PackageDetailPage() {
  const { slug } = useParams<{ slug: string; }>();
  const [item, setItem] = useState<HealthPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packageBookingOpen, setPackageBookingOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        if (!slug || typeof slug !== "string") return undefined;
        setItem(null);
        setLoading(true);
        setError(null);
        return fetchPackageBySlug(slug);
      })
      .then((data) => { if (data !== undefined && !cancelled) setItem(data); })
      .catch(() => { if (!cancelled) setError("Tạm thời chưa thể tải thông tin gói khám. Vui lòng thử lại sau."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [slug]);

  const visual = item ? getPackageVisual(item) : null;
  const packageJsonLd = item && !isIllustrativeCatalogue(item)
    ? {
      "@context": "https://schema.org",
      "@type": "MedicalProcedure",
      name: item.name,
      description: item.description || "Gói khám sức khỏe toàn diện tại Hệ thống Y tế HealthCare.",
      url: `${safeSiteOrigin()}/packages/${item.slug}`,
      image: visual ? [visual.imageSrc] : undefined,
      offers: {
        "@type": "Offer",
        price: item.price,
        priceCurrency: "VND",
        availability: "https://schema.org/InStock",
      },
      provider: {
        "@type": "MedicalOrganization",
        name: "Hệ thống Y tế Đa khoa HealthCare",
        url: safeSiteOrigin(),
      },
    }
    : null;

  return (
    <PublicPageShell cmsEntityId={item?.id} onBookingRequest={() => { if (item && !isIllustrativeCatalogue(item) && !isCmsPreviewRequested()) setPackageBookingOpen(true); }} packages={item ? [item] : []}>
      {packageJsonLd ? <JsonLd data={packageJsonLd} id="package-jsonld" /> : null}
      <div className="resource-page section-inner">
        <CmsNativeSection sectionId="states">
          <PublicBackLink href="/packages">← Quay lại danh mục gói khám</PublicBackLink>
          {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải gói khám…</p> : null}
          {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
          {!loading && !error && !item ? <p className="catalog-status" role="status">Không tìm thấy thông tin gói khám này.</p> : null}
        </CmsNativeSection>

        {item && visual ? (
          <>
            <CmsNativeSection sectionId="profile">
              <article className={`${packageVisualStyles.detailHero} ${packageVisualStyles[`tone-${visual.tone}`]}`}>
                <figure className={packageVisualStyles.detailMedia}>
                  <Image
                    alt={visual.imageAlt}
                    className={packageVisualStyles.image}
                    fill
                    priority
                    sizes="(max-width: 760px) 100vw, 46vw"
                    src={visual.imageSrc}
                  />
                  <figcaption className={packageVisualStyles.detailCredit}>
                    Ảnh minh họa: <a href={visual.sourceHref} rel="noreferrer" target="_blank">{visual.sourceLabel}</a>
                  </figcaption>
                </figure>

                <div className={packageVisualStyles.detailContent}>
                  <span className={packageVisualStyles.detailCategory}>{visual.category}</span>
                  <h1>{item.name}</h1>
                  <p className={packageVisualStyles.detailDescription}>{item.description || "Gói khám chưa có mô tả chi tiết."}</p>
                  <p className={packageVisualStyles.detailPrice}>
                    <small>{isIllustrativeCatalogue(item) ? "Giá minh họa" : "Chi phí gói"}</small>
                    <strong>{currency(item.price)} <span>VNĐ</span></strong>
                  </p>

                  {item.targetAudience || item.durationDays ? (
                    <dl className={packageVisualStyles.metaGrid}>
                      {item.targetAudience ? <div><dt>Phù hợp với</dt><dd>{item.targetAudience}</dd></div> : null}
                      {item.durationDays ? <div><dt>Thời lượng dự kiến</dt><dd>{item.durationDays} ngày</dd></div> : null}
                    </dl>
                  ) : null}

                  <div className={`resource-actions ${packageVisualStyles.detailActions}`}>
                    <PublicBookingButton className={packageVisualStyles.detailAction} selection={{ packageId: item.id }}>
                      Đặt lịch với gói này
                    </PublicBookingButton>
                    <PublicAiButton className="outline-button">Hỏi trợ lý triệu chứng</PublicAiButton>
                  </div>
                </div>
              </article>
            </CmsNativeSection>

            <CmsNativeSection sectionId="guide">
              <section className="resource-panel resource-panel--wide">
                <div className="section-heading">
                  <div>
                    <CmsNativeText fieldId="guide.eyebrow" as="p" value={"Cách chọn gói khám"} className="section-note">Cách chọn gói khám</CmsNativeText>
                    <CmsNativeText fieldId="guide.title" as="h2" value={"Ba bước trước khi xác nhận"}>Ba bước trước khi xác nhận</CmsNativeText>
                  </div>
                </div>
                <div className="resource-steps resource-steps--grid">
                  {PACKAGE_DETAIL_STEPS.map(([number, title, description]) => (
                    <div className="resource-step-card" key={number}>
                      <span>{number}</span>
                      <CmsNativeText fieldId={`guide.step${number}.title`} as="strong" value={title}>{title}</CmsNativeText>
                      <CmsNativeText fieldId={`guide.step${number}.body`} as="p" value={description}>{description}</CmsNativeText>
                    </div>
                  ))}
                </div>
              </section>
            </CmsNativeSection>

            <CmsNativeSection sectionId="preparation">
              <div className={packageVisualStyles.detailSections}>
                <section className={packageVisualStyles.detailPanel}>
                  <p className="section-note">Các bước kiểm tra</p>
                  <h2>Nội dung trong gói</h2>
                  {item.checklist?.length ? (
                    <ol className={packageVisualStyles.detailList}>
                      {item.checklist.map((entry) => <li key={entry}>{entry}</li>)}
                    </ol>
                  ) : <p className={packageVisualStyles.emptyDetail}>Nội dung chi tiết của gói khám đang được cập nhật.</p>}
                </section>

                <section className={packageVisualStyles.detailPanel}>
                  <p className="section-note">Trước buổi khám</p>
                  <h2>Chuẩn bị trước khi đến</h2>
                  {item.preparationSteps?.length ? (
                    <ol className={packageVisualStyles.detailList}>
                      {item.preparationSteps.map((entry) => <li key={entry}>{entry}</li>)}
                    </ol>
                  ) : <p className={packageVisualStyles.emptyDetail}>Hướng dẫn chuẩn bị đang được cập nhật.</p>}
                </section>
              </div>
            </CmsNativeSection>

            <CmsNativeSection sectionId="support">
              <section className="resource-panel resource-panel--accent text-center mt-6">
                {isIllustrativeCatalogue(item) ? <>
                  <p className="section-note">Thông tin minh họa</p>
                  <h2>Gói minh họa chỉ để tham khảo</h2>
                  <p className="max-w-xl mx-auto text-sm text-slate-600 mb-4">{ILLUSTRATIVE_BOOKING_NOTICE}</p>
                </> : <>
                  <CmsNativeText fieldId="support.eyebrow" as="p" value={"Đăng ký dễ dàng"} className="section-note">Đăng ký dễ dàng</CmsNativeText>
                  <CmsNativeText fieldId="support.title" as="h2" value={"Đặt lịch khám ngay hôm nay"}>Đặt lịch khám ngay hôm nay</CmsNativeText>
                  <CmsNativeText fieldId="support.body" as="p" value={"Chủ động chọn cơ sở y tế và khung giờ tiếp nhận phù hợp. Nhận ngay mã phiếu khám điện tử và hướng dẫn chuẩn bị chi tiết."} className="max-w-xl mx-auto text-sm text-slate-600 mb-4">
                    Chủ động chọn cơ sở y tế và khung giờ tiếp nhận phù hợp. Nhận ngay mã phiếu khám điện tử và hướng dẫn chuẩn bị chi tiết.
                  </CmsNativeText>
                </>}
                <div className="resource-actions justify-center">
                  <PublicBookingButton
                    className="button button--amber"
                    selection={{ packageId: item.id }}
                  >
                    Đặt lịch với gói này
                  </PublicBookingButton>
                </div>
              </section>
            </CmsNativeSection>
          </>
        ) : null}

        <CmsNativeSection sectionId="booking">
          {item && !isIllustrativeCatalogue(item) && packageBookingOpen ? (
            <PackageBookingModal
              isOpen={packageBookingOpen}
              onClose={() => setPackageBookingOpen(false)}
              packageItem={item}
            />
          ) : null}
        </CmsNativeSection>
      </div>
    </PublicPageShell>
  );
}
