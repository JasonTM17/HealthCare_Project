"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createGoogleMapsUrls } from "../../components/BranchMap";
import { fetchBranches, type Page } from "../../lib/api-client";
import { safeTelephoneHref } from "../../lib/phone";
import type { Branch } from "../../types/hospital";
import ClinicalIcon from "../../components/ClinicalIcon";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import { CmsNativeSection, CmsNativeText } from "../../components/cms/cms-page-layout-provider";

const CONTACT_STEPS = [
  {
    number: "01",
    title: "Gọi đúng đầu mối",
    description: "Ưu tiên hotline cơ sở hoặc số cấp cứu nếu tình huống cần xử lý ngay.",
  },
  {
    number: "02",
    title: "Xác nhận cơ sở gần nhất",
    description: "Kiểm tra địa chỉ, giờ làm việc và tiện ích trước khi di chuyển.",
  },
  {
    number: "03",
    title: "Đi tiếp sang đặt lịch",
    description: "Nếu chưa chắc chuyên khoa nào phù hợp, mở trợ lý triệu chứng để chọn nhanh hơn.",
  },
] as const;

export default function ContactPage() {
  const [page, setPage] = useState<Page<Branch> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      try {
        const data = await fetchBranches(0, 50);
        if (!cancelled) setPage(data);
      } catch {
        if (!cancelled) setError("Tạm thời chưa thể tải thông tin liên hệ. Vui lòng thử lại sau.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      void task;
    };
  }, []);

  const branches = page?.content ?? [];
  const featuredBranch = branches.find((branch) => branch.emergencyHotline || branch.phone) ?? branches[0];
  const featuredPhone = featuredBranch?.emergencyHotline ?? featuredBranch?.phone ?? undefined;
  const featuredPhoneHref = safeTelephoneHref(featuredPhone);
  const featuredAddress = featuredBranch?.address?.trim();
  const featuredMapHref = featuredAddress ? createGoogleMapsUrls(featuredAddress, featuredBranch?.name).open : undefined;
  const branchCount = page?.totalElements ?? branches.length;
  const branchCountLabel = loading
    ? "Đang tải…"
    : error
      ? "Chưa tải được"
      : page?.empty
        ? "Chưa có cơ sở công khai"
        : String(branchCount);
  const featuredBranchLabel = loading
    ? "Đang tải…"
    : error
      ? "Chưa tải được"
      : featuredBranch?.name ?? "Chưa chọn cơ sở nổi bật";

  return (
    <PublicPageShell branches={branches}>
      <div className="resource-page section-inner">
        <CmsNativeSection sectionId="intro">
          <header className="resource-page__header">
            <CmsNativeText fieldId="intro.eyebrow" as="p" value={"Hỗ trợ người bệnh"} className="section-note">Hỗ trợ người bệnh</CmsNativeText>
            <CmsNativeText fieldId="intro.title" as="h1" value={"Liên hệ đúng nơi, đúng lúc"}>Liên hệ đúng nơi, đúng lúc</CmsNativeText>
            <CmsNativeText fieldId="intro.body" as="p" value={"Tìm hotline, giờ làm việc, địa chỉ, bản đồ và cơ sở gần nhất trên một trang rõ ràng, giúp Quý khách chủ động kết nối và tiết kiệm thời gian tối đa."}>
              Tìm hotline, giờ làm việc, địa chỉ, bản đồ và cơ sở gần nhất trên một trang rõ ràng,
              giúp Quý khách chủ động kết nối và tiết kiệm thời gian tối đa.
            </CmsNativeText>
          </header>
        </CmsNativeSection>

        <CmsNativeSection sectionId="states">
          {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải thông tin liên hệ…</p> : null}
          {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
          {!loading && !error && (!page || page.empty) ? (
            <div className="catalog-status" role="status">
              <p>Chưa có cơ sở công khai để hiển thị. Bạn vẫn có thể đặt lịch hoặc gửi yêu cầu để đội ngũ hỗ trợ xác nhận đầu mối phù hợp.</p>
              <div className="resource-actions">
                <PublicBookingButton className="button button--amber">Đặt lịch khám</PublicBookingButton>
                <Link className="outline-button outline-button--small" href="/dat-lich">Mở form đặt lịch</Link>
              </div>
            </div>
          ) : null}
        </CmsNativeSection>

        <CmsNativeSection sectionId="overview">
          <section className="resource-hero-card resource-hero-card--teal">
            <div className="resource-icon" aria-hidden="true">
              <ClinicalIcon name="branch" />
            </div>
            <div className="resource-hero-card__body">
              <CmsNativeText fieldId="overview.eyebrow" as="p" value={"Liên hệ công khai"} className="resource-chip">Liên hệ công khai</CmsNativeText>
              <CmsNativeText fieldId="overview.title" as="h2" value={"Thông tin kết nối chính thức đến Bệnh viện HealthCare"}>Thông tin kết nối chính thức đến Bệnh viện HealthCare</CmsNativeText>
              <CmsNativeText fieldId="overview.body" as="p" value={"Tổng hợp đầy đủ đường dây nóng, địa chỉ và giờ tiếp nhận của từng cơ sở để Quý khách thuận tiện lựa chọn."} className="resource-lead">
                Tổng hợp đầy đủ đường dây nóng, địa chỉ và giờ tiếp nhận của từng cơ sở để Quý khách
                thuận tiện lựa chọn.
              </CmsNativeText>
              <div className="resource-actions">
                <PublicBookingButton>Đặt lịch khám</PublicBookingButton>
                <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
                <Link className="outline-button outline-button--light" href="/tra-cuu">
                  Tra cứu lịch hẹn
                </Link>
              </div>
              <dl className="resource-meta-grid">
                <div>
                  <dt>Tổng cơ sở</dt>
                  <dd aria-live="polite">{branchCountLabel}</dd>
                </div>
                <div>
                  <dt>Cơ sở nổi bật</dt>
                  <dd aria-live="polite">{featuredBranchLabel}</dd>
                </div>
              </dl>
            </div>
          </section>
        </CmsNativeSection>

        <CmsNativeSection sectionId="guide">
          <div className="resource-grid resource-grid--two">
            <section className="resource-panel resource-panel--accent">
              <CmsNativeText fieldId="guide.eyebrow" as="p" value={"Liên hệ nhanh"} className="section-note">Liên hệ nhanh</CmsNativeText>
              <h2>{featuredBranch?.name ?? "Chưa chọn cơ sở nổi bật"}</h2>
              <p>{featuredBranch?.address ?? "Hãy đặt lịch hoặc mở danh sách cơ sở để đội ngũ hỗ trợ xác nhận địa điểm phù hợp."}</p>

              {featuredBranch ? (
                <ul className="resource-list">
                  {featuredPhone ? (
                    <li>
                      <strong>{featuredBranch.emergencyHotline ? "Hotline cấp cứu" : "Hotline cơ sở"}</strong>
                      <span>{featuredPhone}</span>
                    </li>
                  ) : null}
                  {featuredBranch.workingHours ? (
                    <li>
                      <CmsNativeText fieldId="guide.title" as="strong" value={"Giờ làm việc"}>Giờ làm việc</CmsNativeText>
                      <span>{featuredBranch.workingHours}</span>
                    </li>
                  ) : null}
                  {featuredBranch.amenities?.length ? (
                    <li>
                      <CmsNativeText fieldId="guide.title2" as="strong" value={"Tiện ích"}>Tiện ích</CmsNativeText>
                      <span>{featuredBranch.amenities.slice(0, 3).join(" · ")}</span>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="resource-muted">Chưa có cơ sở nào để liên hệ ngay lúc này.</p>
              )}

              <div className="resource-actions">
                {featuredPhoneHref ? (
                  <a className="button button--amber" href={featuredPhoneHref}>
                    {featuredBranch?.emergencyHotline ? "Gọi cấp cứu" : "Gọi cơ sở"}
                  </a>
                ) : null}
                {featuredMapHref ? (
                  <a className="outline-button" href={featuredMapHref}>
                    Xem bản đồ
                  </a>
                ) : null}
              </div>
            </section>

            <section className="resource-panel">
              <CmsNativeText fieldId="guide.eyebrow2" as="p" value={"Cách dùng trang liên hệ"} className="section-note">Cách dùng trang liên hệ</CmsNativeText>
              <CmsNativeText fieldId="guide.title3" as="h2" value={"Ba bước ngắn để tới đúng đầu mối"}>Ba bước ngắn để tới đúng đầu mối</CmsNativeText>
              <div className="resource-steps resource-steps--grid">
                {CONTACT_STEPS.map((step, cmsItemIndex) => (
                  <div className="resource-step-card" key={step.number}>
                    <span>{step.number}</span>
                    <CmsNativeText fieldId={`guide.step${step.number}.title`} as="strong" value={step.title}>{step.title}</CmsNativeText>
                    <p>{step.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </CmsNativeSection>

        <CmsNativeSection sectionId="branches">
          {page && !page.empty ? (
            <section className="resource-panel resource-panel--wide">
              <p className="section-note">Hệ thống cơ sở</p>
              <div className="catalog-grid catalog-grid--branches">
                {page.content.map((branch) => {
                  const phoneHref = safeTelephoneHref(branch.phone);
                  const emergencyHref = safeTelephoneHref(branch.emergencyHotline);
                  const address = branch.address?.trim();
                  const mapHref = address ? createGoogleMapsUrls(address, branch.name).open : undefined;
                  return (
                    <article className="catalog-card" key={branch.id}>
                      <p className="section-note">{branch.workingHours ?? "Vui lòng xác nhận giờ làm việc trước khi đến."}</p>
                      <h2>{branch.name}</h2>
                      <p>{branch.address}</p>
                      <ul className="resource-list">
                        {branch.phone ? (
                          <li>
                            <strong>Hotline</strong>
                            <span>{branch.phone}</span>
                          </li>
                        ) : null}
                        {branch.emergencyHotline ? (
                          <li>
                            <strong>Cấp cứu</strong>
                            <span>{branch.emergencyHotline}</span>
                          </li>
                        ) : null}
                        {branch.amenities?.length ? (
                          <li>
                            <strong>Tiện ích</strong>
                            <span>{branch.amenities.slice(0, 2).join(" · ")}</span>
                          </li>
                        ) : null}
                      </ul>
                      <div className="catalog-card__actions">
                        {phoneHref ? (
                          <a className="text-button" href={phoneHref}>
                            Gọi cơ sở →
                          </a>
                        ) : null}
                        {emergencyHref ? (
                          <a className="text-button" href={emergencyHref}>
                            Gọi cấp cứu →
                          </a>
                        ) : null}
                        {mapHref ? (
                          <a className="text-button" href={mapHref}>
                            Xem bản đồ →
                          </a>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </CmsNativeSection>
      </div>
    </PublicPageShell>
  );
}
