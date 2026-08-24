"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PortalChrome from "../../../components/PortalChrome";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";
import { ApiError, fetchDoctorConsultations, hasRole } from "../../../lib/api-client";
import type { ConsultationSummary } from "../../../types/hospital";

export default function DoctorConsultationsPage() {
  const session = useAuthSession();
  const [items, setItems] = useState<ConsultationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR")) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setLoading(true);
      setError(null);
      return fetchDoctorConsultations();
    }).then((value) => { if (!cancelled && value) setItems(value); })
      .catch((reason) => { if (!cancelled) setError(reason); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry, session]);

  if (!session) return <LoginRequiredState nextPath="/doctor/consultations" />;
  if (!hasRole(session.user, "DOCTOR")) return <ForbiddenState title="Không thể mở tư vấn" description="Kênh tư vấn riêng chỉ dành cho bác sĩ được phân công hoặc handoff hợp lệ." />;
  const status = error instanceof ApiError ? error.status : undefined;
  return <PortalChrome role="DOCTOR" user={session.user}>
    <div className="section-inner portal-page">
      <header className="portal-hero"><div><p className="section-note">PATIENT CARE</p><h1>Tư vấn bệnh nhân</h1><p>Chỉ các lịch hẹn được phân công hoặc handoff mới xuất hiện. Điều phối viên chỉ thấy metadata và SLA.</p></div><button className="outline-button" disabled={loading} onClick={() => setRetry((value) => value + 1)} type="button">{loading ? "Đang tải..." : "Tải lại"}</button></header>
      {loading ? <LoadingState label="Đang tải kênh tư vấn…" /> : null}
      {error ? <ErrorState message="Không thể tải danh sách tư vấn." status={status} onRetry={() => setRetry((value) => value + 1)} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState title="Không có kênh đang chờ" description="Các cuộc trao đổi mới sẽ xuất hiện sau khi bệnh nhân đồng ý và lịch hẹn đủ điều kiện." /> : null}
      <div className="portal-grid portal-grid--main" aria-live="polite">
        {items.map((item) => <Link className="portal-panel" href={`/doctor/consultations/${item.id}`} key={item.id}>
          <div className="portal-panel__heading"><div><p className="section-note">{item.status}</p><h2>{item.subject}</h2></div><span className="portal-panel__icon" aria-hidden="true">↗</span></div>
          <p>Bệnh nhân ẩn danh theo quyền · Bác sĩ {item.doctorName ?? "được phân công"}</p><p className="portal-panel__intro">SLA đầu tiên và cửa sổ đến {new Date(item.openUntil).toLocaleDateString("vi-VN")}</p>
        </Link>)}
      </div>
    </div>
  </PortalChrome>;
}
