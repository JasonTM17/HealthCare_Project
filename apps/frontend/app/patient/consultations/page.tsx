"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PortalChrome from "../../../components/PortalChrome";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";
import { ApiError, createPatientConsultation, fetchPatientAppointments, fetchPatientConsultations, hasRole } from "../../../lib/api-client";
import type { ConsultationSummary, PatientPortalAppointment } from "../../../types/hospital";

function errorStatus(error: unknown) { return error instanceof ApiError ? error.status : undefined; }

export default function PatientConsultationsPage() {
  const session = useAuthSession();
  const [items, setItems] = useState<ConsultationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const [appointments, setAppointments] = useState<PatientPortalAppointment[]>([]);
  const [appointmentId, setAppointmentId] = useState("");
  const [subject, setSubject] = useState("");
  const [consent, setConsent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);

  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    let cancelled = false;
    void Promise.resolve().then(() => { if (cancelled) return undefined; setLoading(true); setError(null); return Promise.all([fetchPatientConsultations(), fetchPatientAppointments(0, 50)]); }).then((value) => { if (!cancelled && value) { setItems(value[0]); setAppointments(value[1].content.filter((appointment) => ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(appointment.status))); } })
      .catch((reason) => { if (!cancelled) setError(reason); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session, retry]);

  const create = async () => {
    if (!appointmentId || !subject.trim() || !consent || creating) return;
    setCreating(true); setCreateError(null);
    try {
      const created = await createPatientConsultation({ appointmentId, subject: subject.trim(), consentAccepted: true, consentVersion: "consultation-v1" });
      setItems((current) => [created, ...current]);
      setAppointments((current) => current.filter((appointment) => appointment.id !== appointmentId));
      setAppointmentId(""); setSubject(""); setConsent(false);
    } catch (reason) { setCreateError(reason); } finally { setCreating(false); }
  };

  if (!session) return <LoginRequiredState nextPath="/patient/consultations" />;
  if (!hasRole(session.user, "PATIENT")) return <ForbiddenState title="Không thể mở tư vấn" description="Kênh tư vấn riêng chỉ dành cho bệnh nhân đã đăng nhập." />;
  return <PortalChrome role="PATIENT" user={session.user}>
    <div className="section-inner portal-page">
      <header className="portal-hero">
        <div><p className="section-note">Kênh trao đổi riêng</p><h1>Tư vấn cùng bác sĩ</h1><p>Trao đổi sau lịch hẹn trong cửa sổ được bệnh viện cấp. Nội dung không được gửi cho chatbot.</p></div>
        <Link className="button button--primary" href="/patient/dashboard#appointments">Mở lịch hẹn</Link>
      </header>
      {loading ? <LoadingState label="Đang tải kênh tư vấn…" /> : null}
      {error ? <ErrorState message="Không thể tải danh sách tư vấn." status={errorStatus(error)} onRetry={() => setRetry((v) => v + 1)} /> : null}
      {appointments.length > 0 ? <section className="portal-panel grid gap-4" aria-labelledby="new-consultation-title"><div><p className="section-note">MỞ KÊNH MỚI</p><h2 id="new-consultation-title">Tư vấn sau lịch hẹn</h2><p className="portal-panel__intro">Chỉ lịch đã xác nhận/đã khám được mở trong cửa sổ đến 30 ngày sau buổi khám. Nội dung giữ 90 ngày và không gửi sang chatbot.</p></div><label className="grid gap-1 text-sm font-bold" htmlFor="consultation-appointment">Lịch hẹn<select id="consultation-appointment" className="min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => setAppointmentId(event.target.value)} value={appointmentId}><option value="">Chọn lịch hẹn</option>{appointments.map((appointment) => <option key={appointment.id} value={appointment.id}>{appointment.appointmentDate} · {appointment.doctorName} · {appointment.status}</option>)}</select></label><label className="grid gap-1 text-sm font-bold" htmlFor="consultation-subject">Chủ đề<input id="consultation-subject" className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={240} onChange={(event) => setSubject(event.target.value)} placeholder="Ví dụ: Hỏi thêm sau buổi khám" value={subject} /></label><label className="flex items-start gap-3 text-sm text-slate-700"><input checked={consent} className="mt-1 h-5 w-5" onChange={(event) => setConsent(event.target.checked)} type="checkbox" /><span>Tôi đồng ý lưu nội dung tư vấn trong 90 ngày để bác sĩ xử lý. Đây không phải kênh cấp cứu và không phải chatbot chẩn đoán.</span></label>{createError ? <p aria-live="assertive" className="error-banner" role="alert">{createError instanceof ApiError ? createError.message : "Không thể mở kênh tư vấn."}</p> : null}<button className="button button--primary w-fit" disabled={creating || !appointmentId || !subject.trim() || !consent} onClick={() => void create()} type="button">{creating ? "Đang mở…" : "Mở tư vấn riêng"}</button></section> : null}
      {!loading && !error && items.length === 0 ? <EmptyState title="Chưa có kênh tư vấn" description="Sau khi lịch hẹn được xác nhận, bạn có thể mở một kênh trao đổi riêng với bác sĩ." action={{ href: "/patient/dashboard#appointments", label: "Xem lịch hẹn" }} /> : null}
      <div className="portal-grid portal-grid--main" aria-live="polite">
        {items.map((item) => <Link className="portal-panel" href={`/patient/consultations/${item.id}`} key={item.id}>
          <div className="portal-panel__heading"><div><p className="section-note">{item.status}</p><h2>{item.subject}</h2></div><span className="portal-panel__icon" aria-hidden="true">↗</span></div>
          <p>Bác sĩ {item.doctorName ?? "được phân công"}</p><p className="portal-panel__intro">Cửa sổ trao đổi đến {new Date(item.openUntil).toLocaleDateString("vi-VN")} · {item.unreadCount ? `${item.unreadCount} tin chưa đọc` : "Đã xem hết"}</p>
        </Link>)}
      </div>
    </div>
  </PortalChrome>;
}
