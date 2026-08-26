"use client";

import { useEffect, useState } from "react";
import PortalChrome from "../../../components/PortalChrome";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { ApiError, completePatientCarePlanItem, fetchPatientCarePlans, hasRole } from "../../../lib/api-client";
import { useAuthSession } from "../../../components/useAuthSession";
import type { CarePlan } from "../../../types/hospital";

const PLAN_STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang theo dõi",
  DONE: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  OPEN: "Cần thực hiện",
  DONE: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

function statusLabel(status: string, labels: Record<string, string>): string {
  return labels[status] ?? "Đang cập nhật";
}

function dateLabel(value?: string | null): string {
  if (!value) return "Chưa đặt ngày";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa đặt ngày" : date.toLocaleDateString("vi-VN", { dateStyle: "medium" });
}

function isOverdue(item: CarePlan["items"][number]): boolean {
  return item.status === "OPEN" && Boolean(item.dueAt) && Date.parse(item.dueAt ?? "") < Date.now();
}

export default function PatientCarePlanPage() {
  const session = useAuthSession();
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    let cancelled = false;
    void Promise.resolve().then(() => { if (cancelled) return undefined; setLoading(true); setError(null); return fetchPatientCarePlans(); })
      .then((value) => { if (!cancelled && value) setPlans(value); })
      .catch((reason) => { if (!cancelled) setError(reason); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry, session]);

  if (!session) return <LoginRequiredState nextPath="/patient/care-plan" />;
  if (!hasRole(session.user, "PATIENT")) return <ForbiddenState title="Không thể mở kế hoạch chăm sóc" description="Kế hoạch riêng chỉ hiển thị cho bệnh nhân sở hữu lịch hẹn." />;
  const markDone = async (planId: string, itemId: string) => {
    if (busy) return;
    setBusy(itemId); setError(null);
    try {
      await completePatientCarePlanItem(itemId);
      setPlans((current) => current.map((plan) => plan.id !== planId ? plan : { ...plan, status: plan.items.every((item) => item.id === itemId || item.status !== "OPEN") ? "DONE" : plan.status, items: plan.items.map((item) => item.id === itemId ? { ...item, status: "DONE", completedAt: new Date().toISOString() } : item) }));
    } catch (reason) { setError(reason); } finally { setBusy(null); }
  };
  const status = error instanceof ApiError ? error.status : undefined;
  const openItems = plans.flatMap((plan) => plan.items).filter((item) => item.status === "OPEN");
  const overdueItems = openItems.filter(isOverdue);
  const completedItems = plans.flatMap((plan) => plan.items).filter((item) => item.status === "DONE");
  const totalItems = plans.flatMap((plan) => plan.items).length;
  const progress = totalItems === 0 ? 0 : Math.round((completedItems.length / totalItems) * 100);

  return <PortalChrome role="PATIENT" user={session.user}><div className="section-inner portal-page">
    <header className="portal-hero"><div><p className="section-note">FOLLOW-UP CARE</p><h1>Kế hoạch chăm sóc</h1><p>Các mục tiêu và lời nhắc do bác sĩ tạo từ lịch hẹn. Đây là checklist theo dõi, không phải toa thuốc và không do AI tự sinh.</p></div><button className="outline-button min-h-11" disabled={loading} onClick={() => setRetry((value) => value + 1)} type="button">{loading ? "Đang tải…" : "Tải lại"}</button></header>
    {loading ? <LoadingState label="Đang tải kế hoạch…" /> : null}
    {error ? <ErrorState message="Không thể tải kế hoạch chăm sóc." status={status} onRetry={() => setRetry((value) => value + 1)} /> : null}
    {!loading && !error && plans.length === 0 ? <EmptyState title="Chưa có kế hoạch" description="Bác sĩ có thể tạo mục tiêu theo dõi sau một lịch hẹn đủ điều kiện." /> : null}
    {!loading && !error && plans.length > 0 ? <>
      <section className="portal-panel grid gap-4" aria-labelledby="care-plan-progress-title">
        <div className="portal-panel__heading"><div><p className="section-note">TỔNG QUAN TIẾN ĐỘ</p><h2 id="care-plan-progress-title">Việc cần làm hôm nay</h2></div><strong className="text-teal-900">{progress}%</strong></div>
        <div aria-label={`Đã hoàn tất ${progress}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress} className="h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar"><div className="h-full rounded-full bg-teal-700 transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>
        <div className="grid gap-3 text-sm sm:grid-cols-3"><p><strong>{openItems.length}</strong> mục đang mở</p><p className={overdueItems.length ? "font-bold text-amber-800" : ""}><strong>{overdueItems.length}</strong> mục quá hạn</p><p><strong>{completedItems.length}</strong> mục đã hoàn tất</p></div>
        {overdueItems.length ? <p className="portal-panel__intro" role="status">Bạn có {overdueItems.length} mục quá hạn. Hãy liên hệ bác sĩ nếu lịch nhắc không còn phù hợp.</p> : <p className="portal-panel__intro">Bạn đang theo dõi đúng tiến độ. Khi có thay đổi, bác sĩ sẽ cập nhật kế hoạch trong kênh tư vấn riêng.</p>}
      </section>
      <section className="grid gap-4" aria-labelledby="care-plan-list-title" aria-live="polite"><h2 className="sr-only" id="care-plan-list-title">Danh sách kế hoạch chăm sóc</h2>{plans.map((plan) => <article className="portal-panel grid gap-4" key={plan.id}><div className="portal-panel__heading"><div><p className="section-note">{statusLabel(plan.status, PLAN_STATUS_LABELS)}</p><h2>{plan.title}</h2></div><span className="pill">Bác sĩ {plan.doctorName ?? "được phân công"}</span></div><p className="text-sm text-slate-600">Lịch hẹn liên quan: {plan.appointmentId.slice(0, 8)}… · Cập nhật theo hồ sơ của bác sĩ.</p><ol className="grid gap-3">{plan.items.map((item) => <li className={`flex items-start gap-3 rounded-lg border p-3 ${isOverdue(item) ? "border-amber-300 bg-amber-50" : "border-slate-200"}`} key={item.id}><input aria-label={`${statusLabel(item.status, ITEM_STATUS_LABELS)}: ${item.goal}`} checked={item.status === "DONE"} className="mt-1 h-5 w-5" disabled={busy === item.id || item.status !== "OPEN"} onChange={() => void markDone(plan.id, item.id)} type="checkbox" /><div className="min-w-0"><p className={item.status === "DONE" ? "font-semibold text-slate-500 line-through" : "font-semibold text-slate-900"}>{item.goal}</p><p className="mt-1 text-xs font-bold text-slate-500">{statusLabel(item.status, ITEM_STATUS_LABELS)}{isOverdue(item) ? " · Quá hạn" : ""}</p>{item.reminder ? <p className="mt-1 text-sm text-slate-600">Nhắc: {item.reminder}</p> : null}<p className="mt-1 text-xs text-slate-500">Hạn: {dateLabel(item.dueAt)}{item.completedAt ? ` · Hoàn tất ${dateLabel(item.completedAt)}` : ""}</p></div></li>)}</ol></article>)}</section>
    </> : null}
  </div></PortalChrome>;
}
