"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import BranchMap from "../../components/BranchMap";
import { ClinicalIcon } from "../../components/ClinicalIcon";
import { PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import Icon from "../../components/UiIcon";
import { fetchBranches, type Page } from "../../lib/api-client";
import type { Branch } from "../../types/hospital";

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

  return (
    <PublicPageShell branches={page?.content ?? []}>
      <div className="catalog-page section-inner">
        <header className="resource-page__header">
          <p className="section-note">Mạng lưới cơ sở</p>
          <h1>Chọn cơ sở thuận tiện cho bạn</h1>
          <p>Xem địa chỉ, vị trí Google Maps, giờ làm việc và số điện thoại trước khi đến khám.</p>
        </header>

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
