"use client";

import { useEffect, useState } from "react";
import PortalChrome from "../../../components/PortalChrome";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { ApiError, completePatientCarePlanItem, fetchPatientCarePlans, hasRole } from "../../../lib/api-client";
import { useAuthSession } from "../../../components/useAuthSession";
import type { CarePlan } from "../../../types/hospital";

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
  return <PortalChrome role="PATIENT" user={session.user}><div className="section-inner portal-page">
    <header className="portal-hero"><div><p className="section-note">FOLLOW-UP CARE</p><h1>Kế hoạch chăm sóc</h1><p>Các mục tiêu và lời nhắc do bác sĩ tạo từ lịch hẹn. Đây là checklist theo dõi, không phải toa thuốc và không do AI tự sinh.</p></div><button className="outline-button" disabled={loading} onClick={() => setRetry((value) => value + 1)} type="button">{loading ? "Đang tải…" : "Tải lại"}</button></header>
    {loading ? <LoadingState label="Đang tải kế hoạch…" /> : null}
    {error ? <ErrorState message="Không thể tải kế hoạch chăm sóc." status={status} onRetry={() => setRetry((value) => value + 1)} /> : null}
    {!loading && !error && plans.length === 0 ? <EmptyState title="Chưa có kế hoạch" description="Bác sĩ có thể tạo mục tiêu theo dõi sau một lịch hẹn đủ điều kiện." /> : null}
    <section className="grid gap-4" aria-live="polite">{plans.map((plan) => <article className="portal-panel grid gap-4" key={plan.id}><div className="portal-panel__heading"><div><p className="section-note">{plan.status}</p><h2>{plan.title}</h2></div><span className="pill">Bác sĩ {plan.doctorName ?? "được phân công"}</span></div><ol className="grid gap-3">{plan.items.map((item) => <li className="flex items-start gap-3 rounded-lg border border-slate-200 p-3" key={item.id}><input aria-label={`Đánh dấu hoàn tất: ${item.goal}`} checked={item.status === "DONE"} className="mt-1 h-5 w-5" disabled={busy === item.id || item.status !== "OPEN"} onChange={() => void markDone(plan.id, item.id)} type="checkbox" /><div><p className={item.status === "DONE" ? "font-semibold text-slate-500 line-through" : "font-semibold text-slate-900"}>{item.goal}</p>{item.reminder ? <p className="mt-1 text-sm text-slate-600">Nhắc: {item.reminder}</p> : null}{item.dueAt ? <p className="mt-1 text-xs text-slate-500">Hạn: {new Date(item.dueAt).toLocaleDateString("vi-VN")}</p> : null}</div></li>)}</ol></article>)}</section>
  </div></PortalChrome>;
}
