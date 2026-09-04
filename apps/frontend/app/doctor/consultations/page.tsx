"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  LoginRequiredState,
} from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";
import { ApiError, fetchDoctorConsultations, hasRole } from "../../../lib/api-client";
import type { ConsultationSummary } from "../../../types/hospital";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang mở",
  WAITING_FOR_DOCTOR: "Chờ bác sĩ",
  WAITING_FOR_PATIENT: "Chờ bệnh nhân",
  RESOLVED: "Đã xử lý",
  CLOSED: "Đã đóng",
  EXPIRED: "Đã hết hạn",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "Đang cập nhật";
}

function statusTone(status: string): string {
  if (status === "RESOLVED" || status === "CLOSED") return "bg-slate-200 text-slate-700";
  if (status === "EXPIRED") return "bg-rose-100 text-rose-900";
  if (status === "WAITING_FOR_DOCTOR") return "bg-amber-100 text-amber-900";
  return "bg-teal-100 text-teal-900";
}

function dateLabel(value?: string | null): string {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa có"
    : date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function isClosed(status: string): boolean {
  return status === "RESOLVED" || status === "CLOSED" || status === "EXPIRED";
}

function isSlaDue(item: ConsultationSummary): boolean {
  if (isClosed(item.status)) return false;
  const due = Date.parse(item.openUntil);
  return Number.isFinite(due) && due < Date.now();
}

function SlaBadge({ item }: { item: ConsultationSummary }) {
  const due = isSlaDue(item);
  const closed = isClosed(item.status);
  return (
    <span className={due ? "inline-flex rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900" : closed ? "inline-flex rounded-md bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700" : "inline-flex rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900"}>
      {due ? "Cần xử lý SLA" : closed ? "Đã kết thúc" : "Trong thời hạn"}
    </span>
  );
}

export default function DoctorConsultationsPage() {
  const session = useAuthSession();
  const [items, setItems] = useState<ConsultationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR")) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        return fetchDoctorConsultations();
      })
      .then((value) => {
        if (!cancelled && value) setItems(value);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retry, session]);

  const activeCount = useMemo(() => items.filter((item) => !isClosed(item.status)).length, [items]);
  const unreadCount = useMemo(() => items.reduce((total, item) => total + Math.max(0, item.unreadCount || 0), 0), [items]);

  if (!session) return <LoginRequiredState nextPath="/doctor/consultations" />;
  if (!hasRole(session.user, "DOCTOR")) return <ForbiddenState title="Không thể mở tư vấn" description="Kênh tư vấn riêng chỉ dành cho bác sĩ được phân công hoặc handoff hợp lệ." />;
  const status = error instanceof ApiError ? error.status : undefined;

  return (
    <PortalChrome role="DOCTOR" user={session.user}>
      <div className="section-inner portal-page grid gap-6">
        <header className="portal-hero">
          <div>
            <p className="section-note">PATIENT CARE</p>
            <h1>Tư vấn bệnh nhân</h1>
            <p>Chỉ các lịch hẹn được phân công hoặc handoff mới xuất hiện. Nội dung trao đổi chỉ dành cho bác sĩ có quyền.</p>
            <div aria-label="Tóm tắt kênh tư vấn" className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-teal-900">
              <span className="rounded-md bg-teal-50 px-3 py-1.5">{activeCount} kênh đang mở</span>
              <span className="rounded-md bg-amber-50 px-3 py-1.5">{unreadCount} tin chưa đọc</span>
              <span className="rounded-md bg-slate-100 px-3 py-1.5">{items.length} kênh được phân quyền</span>
            </div>
          </div>
          <button
            aria-label="Tải lại danh sách tư vấn"
            className="outline-button min-h-11"
            disabled={loading}
            onClick={() => setRetry((value) => value + 1)}
            type="button"
          >
            {loading ? "Đang tải…" : "Tải lại"}
          </button>
        </header>

        {loading ? <LoadingState label="Đang tải kênh tư vấn…" /> : null}
        {error ? <ErrorState message="Không thể tải danh sách tư vấn." status={status} onRetry={() => setRetry((value) => value + 1)} /> : null}
        {!loading && !error && items.length === 0 ? <EmptyState title="Không có kênh đang chờ" description="Các cuộc trao đổi mới sẽ xuất hiện sau khi bệnh nhân đồng ý và lịch hẹn đủ điều kiện." /> : null}

        <section aria-busy={loading} aria-label="Danh sách kênh tư vấn" className="portal-grid portal-grid--main" aria-live="polite">
          {items.map((item) => {
            const subject = item.subject?.trim() || "Cuộc tư vấn chưa có tiêu đề";
            return (
              <Link
                aria-label={`Mở ${subject}. ${statusLabel(item.status)}. ${item.unreadCount > 0 ? `${item.unreadCount} tin chưa đọc.` : "Không có tin chưa đọc."}`}
                className="portal-panel min-h-11 text-left"
                href={`/doctor/consultations/${encodeURIComponent(item.id)}`}
                key={item.id}
              >
                <div className="portal-panel__heading">
                  <div>
                    <p className="section-note">{statusLabel(item.status)}</p>
                    <h2>{subject}</h2>
                  </div>
                  <span aria-hidden="true" className="portal-panel__icon">↗</span>
                </div>
                <p>Bệnh nhân hiển thị theo quyền · Bác sĩ {item.doctorName ?? "được phân công"}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
                  <SlaBadge item={item} />
                  {item.unreadCount > 0 ? <span className="text-xs font-bold text-teal-800">{item.unreadCount} tin chưa đọc</span> : <span className="text-xs text-slate-500">Đã đọc hết</span>}
                </div>
                <p className="portal-panel__intro">Cửa sổ tư vấn đến {dateLabel(item.openUntil)} · cập nhật {dateLabel(item.updatedAt)}</p>
              </Link>
            );
          })}
        </section>
      </div>
    </PortalChrome>
  );
}
