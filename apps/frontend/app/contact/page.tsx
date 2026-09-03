"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createGoogleMapsUrls } from "../../components/BranchMap";
import { fetchBranches, type Page } from "../../lib/api-client";
import { safeTelephoneHref } from "../../lib/phone";
import type { Branch } from "../../types/hospital";
import ClinicalIcon from "../../components/ClinicalIcon";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";

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
        ? "Chưa có dữ liệu"
        : String(branchCount);
  const featuredBranchLabel = loading
    ? "Đang tải…"
    : error
      ? "Chưa tải được"
      : featuredBranch?.name ?? "Chưa có dữ liệu";

  return (
    <PublicPageShell branches={branches}>
      <div className="resource-page section-inner">
        <header className="resource-page__header">
          <p className="section-note">Hỗ trợ người bệnh</p>
          <h1>Liên hệ đúng nơi, đúng lúc</h1>
          <p>
            Tìm hotline, giờ làm việc, địa chỉ, bản đồ và cơ sở gần nhất trên một trang rõ ràng,
            thay vì phải dò từng chỗ rời rạc.
          </p>
        </header>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải thông tin liên hệ…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error}</p> : null}
        {!loading && !error && (!page || page.empty) ? <p className="catalog-status" role="status">Thông tin cơ sở đang được cập nhật.</p> : null}

        <section className="resource-hero-card resource-hero-card--teal">
          <div className="resource-icon" aria-hidden="true">
            <ClinicalIcon name="branch" />
          </div>
          <div className="resource-hero-card__body">
            <p className="resource-chip">Liên hệ công khai</p>
            <h2>Một điểm chạm rõ ràng trước khi bạn tới bệnh viện.</h2>
            <p className="resource-lead">
              Số điện thoại, địa chỉ và giờ làm việc của cơ sở phù hợp đều được gom lại theo cùng một
              nhịp để bạn dễ quyết định hơn.
            </p>
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

        <div className="resource-grid resource-grid--two">
          <section className="resource-panel resource-panel--accent">
            <p className="section-note">Liên hệ nhanh</p>
            <h2>{featuredBranch?.name ?? "Cơ sở đang được cập nhật"}</h2>
            <p>{featuredBranch?.address ?? "Thông tin địa chỉ đang được cập nhật."}</p>

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
                    <strong>Giờ làm việc</strong>
                    <span>{featuredBranch.workingHours}</span>
                  </li>
                ) : null}
                {featuredBranch.amenities?.length ? (
                  <li>
                    <strong>Tiện ích</strong>
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
            <p className="section-note">Cách dùng trang liên hệ</p>
            <h2>Ba bước ngắn để tới đúng đầu mối</h2>
            <div className="resource-steps resource-steps--grid">
              {CONTACT_STEPS.map((step) => (
                <div className="resource-step-card" key={step.number}>
                  <span>{step.number}</span>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

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
                    <p className="section-note">{branch.workingHours ?? "Giờ làm việc đang được cập nhật."}</p>
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
      </div>
    </PublicPageShell>
  );
}
