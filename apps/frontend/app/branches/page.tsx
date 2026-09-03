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
import styles from "./BranchesPage.module.css";

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

      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (cancelled || requestSequence.current !== requestId) return;
        try {
          const data = await fetchBranches(0, 50);
          if (!cancelled && requestSequence.current === requestId) {
            setPage(data);
            setLoading(false);
          }
          return;
        } catch {
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 650 * (attempt + 1)));
          }
        }
      }

      if (!cancelled && requestSequence.current === requestId) {
        setError("Tạm thời chưa thể tải thông tin cơ sở. Vui lòng thử lại sau.");
        setLoading(false);
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
      <div className={`catalog-page section-inner ${styles.branchesPage}`}>
        <header className="resource-page__header">
          <p className="section-note">Mạng lưới cơ sở</p>
          <h1>Chọn cơ sở thuận tiện cho bạn</h1>
          <p>
            Xem địa chỉ, vị trí Google Maps, giờ làm việc và số điện thoại trước khi đến khám — tất
            cả trên một luồng nhất quán.
          </p>
        </header>

        <section className={styles.networkOverview} aria-labelledby="branch-network-overview-title">
          <div className={`resource-icon ${styles.networkIcon}`} aria-hidden="true">
            <ClinicalIcon name="branch" />
          </div>
          <div>
            <p className="section-note">Cơ sở đang hoạt động</p>
            <h2 id="branch-network-overview-title">
              {page && !page.empty ? `${branchCount} cơ sở sẵn sàng đón bạn` : "Tìm cơ sở phù hợp trước khi đi khám"}
            </h2>
            <p className={styles.networkLead}>
              Xem địa chỉ, giờ làm việc, đầu mối liên hệ và mở chỉ đường ngay từ danh sách bên dưới.
            </p>
            <div className="resource-actions">
              <PublicBookingButton selection={featuredBranch ? { branchId: featuredBranch.id } : undefined}>
                Đặt lịch tại cơ sở
              </PublicBookingButton>
              <PublicAiButton className="outline-button">Hỏi trợ lý triệu chứng</PublicAiButton>
              <Link className="outline-button" href="/contact">
                Liên hệ bệnh viện
              </Link>
            </div>
            {page && !page.empty && featuredBranch ? (
              <dl className={styles.networkSummary}>
                <div>
                  <dt>Tổng cơ sở</dt>
                  <dd>{branchCount}</dd>
                </div>
                <div>
                  <dt>Cơ sở ưu tiên</dt>
                  <dd>{featuredBranch.name}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        </section>

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

        {page && !page.empty && featuredBranch ? (
          <section className={styles.featuredContact} aria-labelledby="branch-featured-contact-title">
            <div>
              <p className="section-note">Cơ sở ưu tiên</p>
              <h2 id="branch-featured-contact-title">{featuredBranch.name}</h2>
              <p>{featuredBranch.address}</p>
            </div>
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
