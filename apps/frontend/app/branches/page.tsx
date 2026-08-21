"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import BranchMap, { createGoogleMapsUrls } from "../../components/BranchMap";
import ClinicalIcon from "../../components/ClinicalIcon";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import Icon from "../../components/UiIcon";
import { fetchBranches, type Page } from "../../lib/api-client";
import { safeTelephoneHref } from "../../lib/phone";
import type { Branch } from "../../types/hospital";

const BRANCH_STEPS = [
  {
    number: "01",
    title: "Xem cơ sở gần nhất",
    description: "Địa chỉ, bản đồ và giờ làm việc hiển thị trước khi bạn quyết định đi.",
  },
  {
    number: "02",
    title: "Kiểm tra đầu mối liên hệ",
    description: "Gọi hotline cơ sở hoặc số cấp cứu nếu cần xác nhận nhanh trước khi đến.",
  },
  {
    number: "03",
    title: "Chuyển sang đặt lịch",
    description: "Mở form đặt lịch ngay tại cơ sở phù hợp để giữ khung giờ thuận tiện.",
  },
] as const;

export default function BranchesPage() {
  const [page, setPage] = useState<Page<Branch> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestSequence.current;

    async function loadBranches() {
      setLoading(true);
      setError(null);
      setPage(null);

      try {
        const data = await fetchBranches(0, 50);
        if (!cancelled && requestSequence.current === requestId) setPage(data);
      } catch {
        if (!cancelled && requestSequence.current === requestId) {
          setError("Tạm thời chưa thể tải thông tin cơ sở. Vui lòng thử lại sau.");
        }
      } finally {
        if (!cancelled && requestSequence.current === requestId) setLoading(false);
      }
    }

    void loadBranches();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const branches = page?.content ?? [];
  const branchCount = page?.totalElements ?? branches.length;
  const featuredBranch = branches.find((branch) => branch.emergencyHotline || branch.phone) ?? branches[0];
  const featuredPhone = featuredBranch?.emergencyHotline ?? featuredBranch?.phone ?? undefined;
  const featuredPhoneHref = safeTelephoneHref(featuredPhone);
  const featuredAddress = featuredBranch?.address?.trim();
  const featuredMapHref = featuredAddress ? createGoogleMapsUrls(featuredAddress, featuredBranch?.name).open : undefined;

  return (
    <PublicPageShell branches={page?.content ?? []}>
      <div className="catalog-page section-inner">
        <header className="resource-page__header">
          <p className="section-note">Mạng lưới cơ sở</p>
          <h1>Chọn cơ sở thuận tiện cho bạn</h1>
          <p>
            Xem địa chỉ, vị trí Google Maps, giờ làm việc và số điện thoại trước khi đến khám — tất
            cả trên một luồng nhất quán.
          </p>
        </header>

        <section className="resource-hero-card resource-hero-card--teal">
          <div className="resource-icon" aria-hidden="true">
            <ClinicalIcon name="branch" />
          </div>
          <div className="resource-hero-card__body">
            <p className="resource-chip">Cơ sở công khai</p>
            <h2>Nhìn một lượt là biết nên đi đâu, gọi ai, và mở lịch thế nào.</h2>
            <p className="resource-lead">
              Mỗi cơ sở đi kèm bản đồ, đầu mối liên hệ và lối đi sang đặt lịch để bạn không phải dò
              từng trang riêng lẻ.
            </p>
            <div className="resource-actions">
              <PublicBookingButton selection={featuredBranch ? { branchId: featuredBranch.id } : undefined}>
                Đặt lịch tại cơ sở
              </PublicBookingButton>
              <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
              <Link className="outline-button outline-button--light" href="/contact">
                Liên hệ bệnh viện
              </Link>
            </div>
            <dl className="resource-meta-grid">
              <div>
                <dt>Tổng cơ sở</dt>
                <dd>{branchCount || "Đang cập nhật"}</dd>
              </div>
              <div>
                <dt>Cơ sở nổi bật</dt>
                <dd>{featuredBranch?.name ?? "Đang cập nhật"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="resource-grid resource-grid--two">
          <section className="resource-panel resource-panel--accent">
            <p className="section-note">Cần kiểm tra trước khi đến</p>
            <h2>Ba điều nên nhìn nhanh</h2>
            <div className="resource-steps resource-steps--grid">
              {BRANCH_STEPS.map((step) => (
                <div className="resource-step-card" key={step.number}>
                  <span>{step.number}</span>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="resource-panel">
            <p className="section-note">Điểm nhấn mạng lưới</p>
            <h2>Cơ sở đang nổi bật</h2>
            {featuredBranch ? (
              <ul className="resource-list">
                <li>
                  <strong>Địa chỉ</strong>
                  <span>{featuredBranch.address}</span>
                </li>
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
              <p className="resource-muted">Thông tin cơ sở đang được cập nhật.</p>
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
        </div>

        {loading ? (
          <p className="catalog-status catalog-status--loading" role="status">
            Đang tải mạng lưới cơ sở…
          </p>
        ) : null}
        {error ? (
          <div className="catalog-status catalog-status--error" role="alert">
            <p>{error}</p>
            <button
              className="outline-button outline-button--small"
              onClick={() => setRetryCount((count) => count + 1)}
              type="button"
            >
              Thử tải lại
            </button>
          </div>
        ) : null}
        {!loading && !error && page?.empty ? (
          <p className="catalog-status" role="status">
            Thông tin cơ sở đang được cập nhật.
          </p>
        ) : null}

        {page && !page.empty ? (
          <div className="catalog-grid catalog-grid--branches">
            {page.content.map((branch) => {
              const address = branch.address?.trim();
              const telHref = safeTelephoneHref(branch.phone);
              const emergencyHref = safeTelephoneHref(branch.emergencyHotline);

              return (
                <article className="catalog-card" key={branch.id}>
                  <span className="resource-icon resource-icon--small" aria-hidden="true">
                    <ClinicalIcon name="branch" />
                  </span>
                  <h2>{branch.name}</h2>
                  <div className="branch-card__address">
                    <Icon name="location" size={18} />
                    <p>
                      {address || <span className="resource-muted">Địa chỉ đang được cập nhật.</span>}
                    </p>
                  </div>
                  <BranchMap
                    address={address}
                    branchName={branch.name}
                    className="branch-card__map-link"
                    variant="link"
                  />
                  <dl className="catalog-card__details">
                    <div>
                      <dt>Điện thoại</dt>
                      <dd>{branch.phone || "Đang cập nhật"}</dd>
                    </div>
                    <div>
                      <dt>Giờ làm việc</dt>
                      <dd>{branch.workingHours || "Đang cập nhật"}</dd>
                    </div>
                  </dl>
                  <div className="catalog-card__actions">
                    <Link className="text-button" href={`/branches/${branch.slug}`}>
                      Xem chi tiết →
                    </Link>
                    {telHref ? (
                      <a className="text-button" href={telHref}>
                        Gọi cơ sở →
                      </a>
                    ) : null}
                    {emergencyHref ? (
                      <a className="text-button" href={emergencyHref}>
                        Gọi cấp cứu →
                      </a>
                    ) : null}
                    <PublicBookingButton
                      className="outline-button outline-button--small"
                      selection={{ branchId: branch.id }}
                    >
                      Đặt lịch
                    </PublicBookingButton>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
