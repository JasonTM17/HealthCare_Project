"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState, type FormEvent } from "react";
import PortalChrome from "../../../../components/PortalChrome";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../../components/PortalStates";
import { useAuthSession } from "../../../../components/useAuthSession";
import { ApiError, fetchDoctorConsultation, handoffDoctorConsultation, hasRole, sendDoctorConsultationMessage } from "../../../../lib/api-client";
import type { ConsultationDetail } from "../../../../types/hospital";

export default function DoctorConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useAuthSession();
  const [detail, setDetail] = useState<ConsultationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [handoffId, setHandoffId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busyHandoff, setBusyHandoff] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR")) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setLoading(true);
      setError(null);
      return fetchDoctorConsultation(id);
    }).then((value) => { if (!cancelled && value) setDetail(value); })
      .catch((reason) => { if (!cancelled) setError(reason); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, retry, session]);

  if (!session) return <LoginRequiredState nextPath={`/doctor/consultations/${id}`} />;
  if (!hasRole(session.user, "DOCTOR")) return <ForbiddenState title="Không thể mở tư vấn" description="Bạn không có quyền xem kênh này." />;
  const status = error instanceof ApiError ? error.status : undefined;
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending || !detail || detail.consultation.status === "CLOSED") return;
    setSending(true); setError(null);
    try {
      const message = await sendDoctorConsultationMessage(id, draft.trim(), crypto.randomUUID());
      setDetail((current) => current ? { ...current, messages: [...current.messages, message] } : current);
      setDraft("");
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    } catch (reason) { setError(reason); } finally { setSending(false); }
  };
  const handoff = async () => {
    if (!handoffId.trim() || busyHandoff) return;
    setBusyHandoff(true); setError(null);
    try {
      await handoffDoctorConsultation(id, handoffId.trim());
      setHandoffId("");
      setDetail((current) => current ? { ...current, consultation: { ...current.consultation, status: "WAITING_FOR_DOCTOR" } } : current);
    } catch (reason) { setError(reason); } finally { setBusyHandoff(false); }
  };

  return <PortalChrome role="DOCTOR" user={session.user}><div className="section-inner portal-page">
    <Link className="portal-context-link" href="/doctor/consultations">← Hàng đợi tư vấn</Link>
    {loading ? <LoadingState label="Đang tải nội dung tư vấn…" /> : null}
    {error && !detail ? <ErrorState message="Không thể tải kênh tư vấn." status={status} onRetry={() => setRetry((value) => value + 1)} /> : null}
    {detail ? <>
      <header className="portal-hero"><div><p className="section-note">Tư vấn riêng · {detail.consultation.status}</p><h1>{detail.consultation.subject}</h1><p>Bệnh nhân được bảo vệ danh tính · cửa sổ đến {new Date(detail.consultation.openUntil).toLocaleDateString("vi-VN")}</p></div></header>
      <section className="portal-panel" aria-label="Tin nhắn tư vấn"><div className="portal-thread" aria-live="polite">
        {detail.messages.length ? detail.messages.map((message) => <article className={`portal-thread__message ${message.authorRole === "DOCTOR" ? "portal-thread__message--mine" : ""}`} key={message.id}><p className="section-note">{message.authorRole === "DOCTOR" ? "Bạn" : message.authorRole === "PATIENT" ? "Bệnh nhân" : "Điều phối"} · {new Date(message.createdAt).toLocaleString("vi-VN")}</p><p>{message.body}</p>{message.attachments.map((attachment) => <p className="text-xs text-slate-600" key={attachment.id}>Tệp {attachment.mimeType} · {attachment.scanStatus === "CLEAN" ? "đã quét sạch" : "đang cách ly, chưa mở"}</p>)}</article>) : <EmptyState title="Chưa có tin nhắn" description="Bệnh nhân chưa gửi nội dung. Không tự động chuyển nội dung này cho chatbot." />}<div ref={endRef} /></div></section>
      {error && detail ? <ErrorState message="Tin nhắn hoặc handoff chưa được ghi." status={status} /> : null}
      <form className="portal-panel" onSubmit={send}><label htmlFor="doctor-consultation-message"><span className="section-note">Phản hồi bệnh nhân</span><textarea id="doctor-consultation-message" maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Viết phản hồi chuyên môn…" rows={4} disabled={sending || detail.consultation.status === "CLOSED"} /></label><div className="portal-panel__heading"><small>{draft.length}/4.000 ký tự · Không gọi AI</small><button className="button button--primary" type="submit" disabled={sending || !draft.trim() || detail.consultation.status === "CLOSED"}>{sending ? "Đang gửi…" : "Gửi phản hồi"}</button></div></form>
      <section className="portal-panel grid gap-3" aria-labelledby="handoff-title"><div><h2 id="handoff-title">Handoff bác sĩ</h2><p className="portal-panel__intro">Chỉ nhập UUID bác sĩ đang hoạt động. Handoff ghi audit và không cấp quyền cho coordinator đọc nội dung.</p></div><div className="flex flex-wrap gap-2"><input aria-label="UUID bác sĩ nhận handoff" className="min-h-11 min-w-72 flex-1 rounded-lg border border-slate-300 px-3" onChange={(event) => setHandoffId(event.target.value)} placeholder="doctor UUID" value={handoffId} /><button className="outline-button" disabled={busyHandoff || !handoffId.trim()} onClick={() => void handoff()} type="button">{busyHandoff ? "Đang chuyển…" : "Chuyển handoff"}</button></div></section>
    </> : null}
  </div></PortalChrome>;
}
