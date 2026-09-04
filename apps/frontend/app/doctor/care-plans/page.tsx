"use client";

import { useEffect, useState } from "react";
import { businessDate } from "../../../lib/business-time";
import PortalChrome from "../../../components/PortalChrome";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { ApiError, createDoctorCarePlan, fetchDoctorAppointments, fetchDoctorCarePlans, hasRole } from "../../../lib/api-client";
import { useAuthSession } from "../../../components/useAuthSession";
import type { CarePlan, DoctorPortalAppointment } from "../../../types/hospital";

export default function DoctorCarePlansPage() {
  const session = useAuthSession();
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [appointments, setAppointments] = useState<DoctorPortalAppointment[]>([]);
  const [appointmentId, setAppointmentId] = useState("");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [reminder, setReminder] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR")) return;
    let cancelled = false;
    const today = businessDate();
    void Promise.resolve().then(() => { if (cancelled) return undefined; setLoading(true); setError(null); return Promise.all([fetchDoctorCarePlans(), fetchDoctorAppointments(today, undefined, 0, 100)]); })
      .then((value) => { if (!cancelled && value) { setPlans(value[0]); setAppointments(value[1].content.filter((item) => ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(item.status))); } })
      .catch((reason) => { if (!cancelled) setError(reason); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry, session]);

  if (!session) return <LoginRequiredState nextPath="/doctor/care-plans" />;
  if (!hasRole(session.user, "DOCTOR")) return <ForbiddenState title="Không có quyền tạo kế hoạch" description="Chỉ bác sĩ được phân công mới có thể ghi mục tiêu follow-up." />;
  const create = async () => {
    if (!appointmentId || !title.trim() || !goal.trim() || creating) return;
    setCreating(true); setError(null);
    try {
      const created = await createDoctorCarePlan({ appointmentId, title: title.trim(), items: [{ goal: goal.trim(), reminder: reminder.trim() || null }] });
      setPlans((current) => [created, ...current]); setAppointmentId(""); setTitle(""); setGoal(""); setReminder("");
    } catch (reason) { setError(reason); } finally { setCreating(false); }
  };
  const status = error instanceof ApiError ? error.status : undefined;
  return <PortalChrome role="DOCTOR" user={session.user}><div className="section-inner portal-page">
    <header className="portal-hero"><div><p className="section-note">FOLLOW-UP CARE</p><h1>Kế hoạch chăm sóc</h1><p>Tạo checklist mục tiêu và lời nhắc gắn đúng lịch hẹn. Không nhập đơn thuốc, chẩn đoán hay hướng dẫn điều trị tự động.</p></div><button className="outline-button" disabled={loading} onClick={() => setRetry((value) => value + 1)} type="button">{loading ? "Đang tải…" : "Tải lại"}</button></header>
    {loading ? <LoadingState label="Đang tải kế hoạch…" /> : null}
    {error ? <ErrorState message="Không thể tải hoặc ghi kế hoạch." status={status} onRetry={() => setRetry((value) => value + 1)} /> : null}
    {appointments.length > 0 ? <section className="portal-panel grid gap-3" aria-labelledby="create-care-plan-title"><h2 id="create-care-plan-title">Tạo mục tiêu theo dõi</h2><label className="grid gap-1 text-sm font-bold" htmlFor="care-appointment">Lịch hẹn<select id="care-appointment" className="min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => setAppointmentId(event.target.value)} value={appointmentId}><option value="">Chọn lịch hẹn</option>{appointments.map((item) => <option key={item.id} value={item.id}>{item.appointmentDate} · {item.patientName} · {item.status}</option>)}</select></label><label className="grid gap-1 text-sm font-bold" htmlFor="care-title">Tên kế hoạch<input id="care-title" className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={240} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Theo dõi sau khám" value={title} /></label><label className="grid gap-1 text-sm font-bold" htmlFor="care-goal">Mục tiêu<input id="care-goal" className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={1000} onChange={(event) => setGoal(event.target.value)} placeholder="Mục tiêu theo dõi không kê đơn" value={goal} /></label><label className="grid gap-1 text-sm font-bold" htmlFor="care-reminder">Lời nhắc<input id="care-reminder" className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={500} onChange={(event) => setReminder(event.target.value)} placeholder="Ví dụ: Ghi lại triệu chứng mỗi tối" value={reminder} /></label><button className="button button--primary w-fit" disabled={creating || !appointmentId || !title.trim() || !goal.trim()} onClick={() => void create()} type="button">{creating ? "Đang ghi…" : "Tạo kế hoạch"}</button></section> : null}
    {!loading && !error && plans.length === 0 ? <EmptyState title="Chưa có kế hoạch đã tạo" description="Chọn một lịch hẹn đủ điều kiện để tạo mục tiêu follow-up." /> : null}
    <section className="grid gap-4">{plans.map((plan) => <article className="portal-panel" key={plan.id}><div className="portal-panel__heading"><div><p className="section-note">{plan.status}</p><h2>{plan.title}</h2></div><span className="pill">{plan.items.length} mục</span></div><ul className="mt-4 grid gap-2">{plan.items.map((item) => <li className="rounded-lg border border-slate-200 p-3" key={item.id}><strong>{item.goal}</strong>{item.reminder ? <p className="mt-1 text-sm text-slate-600">{item.reminder}</p> : null}</li>)}</ul></article>)}</section>
  </div></PortalChrome>;
}
