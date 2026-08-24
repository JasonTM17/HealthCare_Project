"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState, type FormEvent } from "react";
import PortalChrome from "../../../../components/PortalChrome";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../../components/PortalStates";
import { useAuthSession } from "../../../../components/useAuthSession";
import { ApiError, closePatientConsultation, fetchPatientConsultation, markPatientConsultationRead, sendPatientConsultationMessage, hasRole } from "../../../../lib/api-client";
import type { ConsultationDetail } from "../../../../types/hospital";

export default function PatientConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useAuthSession();
  const [detail, setDetail] = useState<ConsultationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    let cancelled = false;
    void Promise.resolve().then(() => { if (cancelled) return undefined; setLoading(true); setError(null); return fetchPatientConsultation(id); }).then((value) => { if (!cancelled && value) setDetail(value); })
      .catch((reason) => { if (!cancelled) setError(reason); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, session, retry]);

  useEffect(() => { const last = detail?.messages.at(-1); if (last) void markPatientConsultationRead(id, last.id); }, [detail, id]);

  if (!session) return <LoginRequiredState nextPath={`/patient/consultations/${id}`} />;
  if (!hasRole(session.user, "PATIENT")) return <ForbiddenState title="Không thể mở tư vấn" description="Bạn không có quyền xem kênh này." />;
  const status = error instanceof ApiError ? error.status : undefined;
  const send = async (event: FormEvent) => {
    event.preventDefault(); if (!draft.trim() || sending) return;
    setSending(true); setError(null);
    try {
      const message = await sendPatientConsultationMessage(id, draft.trim(), crypto.randomUUID());
      setDetail((current) => current ? { ...current, messages: [...current.messages, message] } : current);
      setDraft(""); requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    } catch (reason) { setError(reason); } finally { setSending(false); }
  };
  const close = async () => { try { await closePatientConsultation(id); setDetail((current) => current ? { ...current, consultation: { ...current.consultation, status: "CLOSED" } } : current); } catch (reason) { setError(reason); } };

  return <PortalChrome role="PATIENT" user={session.user}><div className="section-inner portal-page">
    <Link className="portal-context-link" href="/patient/consultations">← Danh sách tư vấn</Link>
    {loading ? <LoadingState label="Đang tải nội dung tư vấn…" /> : null}
    {error && !detail ? <ErrorState message="Không thể tải kênh tư vấn." status={status} onRetry={() => setRetry((v) => v + 1)} /> : null}
    {detail ? <>
      <header className="portal-hero"><div><p className="section-note">Tư vấn riêng · {detail.consultation.status}</p><h1>{detail.consultation.subject}</h1><p>Bác sĩ {detail.consultation.doctorName ?? "được phân công"} · cửa sổ đến {new Date(detail.consultation.openUntil).toLocaleDateString("vi-VN")}</p></div><button className="outline-button outline-button--small" type="button" onClick={close} disabled={detail.consultation.status === "CLOSED"}>Đóng kênh</button></header>
      <section className="portal-panel" aria-label="Tin nhắn tư vấn"><div className="portal-thread" aria-live="polite">
        {detail.messages.length ? detail.messages.map((message) => <article className={`portal-thread__message ${message.authorRole === "PATIENT" ? "portal-thread__message--mine" : ""}`} key={message.id}><p className="section-note">{message.authorRole === "PATIENT" ? "Bạn" : "Bác sĩ"} · {new Date(message.createdAt).toLocaleString("vi-VN")}</p><p>{message.body}</p></article>) : <EmptyState title="Bắt đầu cuộc trao đổi" description="Mô tả điều bạn muốn hỏi; bác sĩ sẽ xem trong giờ làm việc." />}<div ref={endRef} /></div></section>
      {error && detail ? <ErrorState message="Tin nhắn chưa gửi được." status={status} /> : null}
      <form className="portal-panel" onSubmit={send}><label htmlFor="consultation-message"><span className="section-note">Tin nhắn mới</span><textarea id="consultation-message" maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Viết câu hỏi cho bác sĩ…" rows={4} disabled={sending || detail.consultation.status === "CLOSED"} /></label><div className="portal-panel__heading"><small>{draft.length}/4.000 ký tự · Không gửi ảnh/PDF cho chatbot</small><button className="button button--primary" type="submit" disabled={sending || !draft.trim() || detail.consultation.status === "CLOSED"}>{sending ? "Đang gửi…" : "Gửi tin nhắn"}</button></div></form>
    </> : null}
  </div></PortalChrome>;
}
