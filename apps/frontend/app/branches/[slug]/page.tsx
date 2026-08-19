"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BranchMap from "../../../components/BranchMap";
import { ClinicalIcon } from "../../../components/ClinicalIcon";
import {
  PublicBackLink,
  PublicBookingButton,
  PublicPageShell,
} from "../../../components/PublicPageShell";
import { fetchBranchBySlug } from "../../../lib/api-client";
import { safeTelephoneHref } from "../../../lib/phone";
import type { Branch } from "../../../types/hospital";

export default function BranchDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestSequence.current;

    async function loadBranch() {
      setBranch(null);
      setLoading(true);
      setError(null);

      try {
        const data = await fetchBranchBySlug(slug);
        if (!cancelled && requestSequence.current === requestId) setBranch(data);
      } catch {
        if (!cancelled && requestSequence.current === requestId) {
          setError("Tạm thời chưa thể tải thông tin cơ sở. Vui lòng thử lại sau.");
        }
      } finally {
        if (!cancelled && requestSequence.current === requestId) setLoading(false);
      }
    }

    void loadBranch();
    return () => {
      cancelled = true;
    };
  }, [retryCount, slug]);

  const phoneHref = safeTelephoneHref(branch?.phone);
  const emergencyHref = safeTelephoneHref(branch?.emergencyHotline);
  const callHref = emergencyHref ?? phoneHref;

  return (
    <PublicPageShell branches={branch ? [branch] : []}>
      <div className="resource-page section-inner">
        <PublicBackLink href="/branches">← Quay lại danh sách cơ sở</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Thông tin cơ sở</p>
          <h1>Thông tin cần biết trước khi đến khám</h1>
          <p>Xem địa chỉ, bản đồ, giờ làm việc và thông tin liên hệ của cơ sở.</p>
        </header>

        {loading ? (
          <p className="catalog-status catalog-status--loading" role="status">
            Đang tải thông tin cơ sở…
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
        {!loading && !error && !branch ? (
          <p className="catalog-status" role="status">
            Không tìm thấy thông tin cơ sở này.
          </p>
        ) : null}

        {branch ? (
          <article className="resource-hero-card">
            <div className="resource-icon" aria-hidden="true">
              <ClinicalIcon name="branch" />
            </div>
            <div className="resource-hero-card__body">
              <span className="resource-chip">Cơ sở khám bệnh</span>
              <h2>{branch.name}</h2>
              <dl className="resource-details">
                <div>
                  <dt>Địa chỉ</dt>
                  <dd>
                    {branch.address?.trim() || (
                      <span className="resource-muted">Địa chỉ đang được cập nhật.</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Điện thoại</dt>
                  <dd>
                    {phoneHref ? (
                      <a href={phoneHref}>{branch.phone}</a>
                    ) : (
                      <span className="resource-muted">Số điện thoại đang được cập nhật.</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Giờ làm việc</dt>
                  <dd>{branch.workingHours || "Giờ làm việc đang được cập nhật."}</dd>
                </div>
                <div>
                  <dt>Cấp cứu</dt>
                  <dd>{branch.emergencyHotline || "Chưa có hotline cấp cứu riêng cho cơ sở này."}</dd>
                </div>
                <div>
                  <dt>Chỉ đường</dt>
                  <dd>
                    <BranchMap address={branch.address} branchName={branch.name} variant="link" />
                  </dd>
                </div>
              </dl>
              <div className="resource-actions">
                <PublicBookingButton selection={{ branchId: branch.id }}>
                  Đặt lịch tại cơ sở này
                </PublicBookingButton>
                {callHref ? (
                  <a
                    className="outline-button"
                    href={callHref}
                  >
                    Gọi cơ sở
                  </a>
                ) : (
                  <span className="resource-muted">Số điện thoại đang được cập nhật.</span>
                )}
              </div>
            </div>
          </article>
        ) : null}

        {branch ? (
          <section className="branch-map-section" aria-labelledby="branch-map-title">
            <div className="branch-map-section__header">
              <div>
                <p className="section-note">Vị trí trên Google Maps</p>
                <h2 id="branch-map-title">Đường đến {branch.name}</h2>
              </div>
              <p>Kiểm tra vị trí và mở Google Maps để xem tuyến đường phù hợp trước khi khởi hành.</p>
            </div>
            <BranchMap address={branch.address} branchName={branch.name} />
          </section>
        ) : null}

        {branch ? (
          <div className="resource-grid resource-grid--two">
            <section className="resource-panel">
              <p className="section-note">Tiện ích tại cơ sở</p>
              <h2>Chuẩn bị cho lần đến khám</h2>
              {branch.amenities?.length ? (
                <ul className="resource-list">
                  {branch.amenities.map((amenity) => (
                    <li key={amenity}>{amenity}</li>
                  ))}
                </ul>
              ) : (
                <p className="resource-muted">Thông tin tiện ích đang được cập nhật.</p>
              )}
            </section>
            <section className="resource-panel resource-panel--accent">
              <p className="section-note">Đội ngũ tại cơ sở</p>
              <h2>Bác sĩ đang làm việc</h2>
              {branch.doctors?.length ? (
                <div className="resource-doctor-grid">
                  {branch.doctors.map((doctor) => (
                    <Link className="resource-doctor-card" href={`/doctors/${doctor.slug}`} key={doctor.id}>
                      <strong>{doctor.fullName}</strong>
                      <span>{doctor.specialtyName || "Bác sĩ chuyên khoa"}</span>
                      <span className="text-button">Xem hồ sơ →</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="resource-muted">Danh sách bác sĩ tại cơ sở đang được cập nhật.</p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
