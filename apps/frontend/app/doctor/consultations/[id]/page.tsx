"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import PortalChrome from "../../../../components/PortalChrome";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../../components/PortalStates";
import { useAuthSession } from "../../../../components/useAuthSession";
import {
  ApiError,
  fetchDoctorConsultation,
  fetchDoctorConsultationAttachmentDownload,
  fetchDoctorConsultationAttachmentStatus,
  fetchDoctorConsultationHandoffDirectory,
  fetchDoctorConsultationMessagePage,
  handoffDoctorConsultation,
  hasRole,
  markDoctorConsultationRead,
  reopenDoctorConsultation,
  resolveDoctorConsultation,
  sendDoctorConsultationMessage,
} from "../../../../lib/api-client";
import { pollConsultationAttachments } from "../../../../lib/consultation-attachment-polling";
import { reconcileConsultationServerPage } from "../../../../lib/consultation-read-watermark";
import { presentApiError } from "../../../../lib/present-api-error";
import type { ConsultationAttachment, ConsultationDetail, ConsultationHandoffDoctor } from "../../../../types/hospital";

interface ServerReadWatermark {
  threadId: string;
  epoch: number;
  messageId: string;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang mở",
  WAITING_FOR_DOCTOR: "Chờ bác sĩ",
  WAITING_FOR_PATIENT: "Chờ bệnh nhân",
  RESOLVED: "Đã xử lý",
  CLOSED: "Đã đóng",
  EXPIRED: "Đã hết hạn",
};

const MESSAGE_STATUS_LABELS: Record<string, string> = {
  SENT: "Đã gửi",
  READ: "Đã đọc",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "Đang cập nhật";
}

function safeDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", includeTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "medium" });
}

function tokenLabel(value?: string | null): string {
  if (!value) return "";
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function attachmentStatus(attachment: ConsultationAttachment): string {
  if (attachment.scanStatus === "CLEAN") return "Đã quét sạch";
  if (attachment.scanStatus === "REJECTED") return "Đã từ chối vì an toàn";
  return "Đang quét, chưa thể mở";
}

function authorLabel(role: string): string {
  if (role === "DOCTOR") return "Bạn";
  if (role === "PATIENT") return "Bệnh nhân";
  return "Hệ thống";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export default function DoctorConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useAuthSession();
  const [detail, setDetail] = useState<ConsultationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [handoffId, setHandoffId] = useState("");
  const [handoffDoctors, setHandoffDoctors] = useState<ConsultationHandoffDoctor[]>([]);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);
  const [busyHandoff, setBusyHandoff] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [messagesComplete, setMessagesComplete] = useState(false);
  const [messagePageError, setMessagePageError] = useState(false);
  const [serverReadWatermark, setServerReadWatermark] = useState<ServerReadWatermark | null>(null);
  const [acknowledgedThrough, setAcknowledgedThrough] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const [scanRetry, setScanRetry] = useState(0);
  const [scanWaiting, setScanWaiting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const pageControllerRef = useRef<AbortController | null>(null);
  const requestEpochRef = useRef(0);
  const requestThreadRef = useRef(id);
  const serverMessagesRef = useRef<ConsultationDetail["messages"]>([]);
  const pendingScanKey = JSON.stringify([...new Set(detail?.messages.flatMap((message) =>
    message.attachments.filter((attachment) => attachment.scanStatus === "PENDING").map((attachment) => attachment.id)) ?? [])].sort());

  const isActiveThread = (threadId: string, epoch: number): boolean => (
    requestThreadRef.current === threadId && requestEpochRef.current === epoch
  );

  const load = useCallback(async (signal: AbortSignal) => {
    const [loaded, page] = await Promise.all([
      fetchDoctorConsultation(id, signal),
      fetchDoctorConsultationMessagePage(id, null, 50, signal),
    ]);
    return { detail: { ...loaded, messages: page.items }, page };
  }, [id]);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR")) return;
    requestControllerRef.current?.abort();
    pageControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    requestThreadRef.current = id;
    const epoch = ++requestEpochRef.current;
    const isCurrent = () => !controller.signal.aborted
      && requestEpochRef.current === epoch
      && requestThreadRef.current === id;
    void Promise.resolve()
      .then(() => {
        if (!isCurrent()) return undefined;
        setLoading(true);
        setError(null);
        setMessagePageError(false);
        setMessagesComplete(false);
        setLoadingMore(false);
        setHandoffLoading(false);
        setSending(false);
        setBusyStatus(false);
        setBusyHandoff(false);
        setDetail(null);
        setNextCursor(null);
        setHasMore(false);
        setServerReadWatermark(null);
        setAcknowledgedThrough(null);
        serverMessagesRef.current = [];
        return load(controller.signal);
      })
      .then((value) => {
        if (!isCurrent() || !value) return;
        const snapshot = reconcileConsultationServerPage([], value.page, session.user.id, null);
        serverMessagesRef.current = snapshot.messages;
        setDetail({ ...value.detail, messages: snapshot.messages });
        setNextCursor(snapshot.nextCursor);
        setHasMore(snapshot.hasMore);
        setMessagesComplete(snapshot.complete);
        setServerReadWatermark(snapshot.readWatermark
          ? { threadId: id, epoch, messageId: snapshot.readWatermark }
          : null);
        if (snapshot.stalled) {
          setMessagePageError(true);
          setError(new ApiError("Chuỗi tin nhắn chưa thể tải đầy đủ.", 502, "consultation-messages", { code: "CONSULTATION_CURSOR_STALLED" }));
        }
      })
      .catch((reason) => {
        if (!isAbortError(reason) && isCurrent()) {
          setMessagePageError(true);
          setError(reason);
        }
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
    return () => {
      if (requestEpochRef.current === epoch && requestThreadRef.current === id) {
        requestEpochRef.current += 1;
        requestThreadRef.current = "";
        serverMessagesRef.current = [];
      }
      controller.abort();
      pageControllerRef.current?.abort();
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    };
  }, [id, load, retry, session]);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR") || !detail) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setHandoffLoading(true);
        return fetchDoctorConsultationHandoffDirectory(id);
      })
      .then((value) => {
        if (!cancelled && value) setHandoffDoctors(value);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason);
      })
      .finally(() => {
        if (!cancelled) setHandoffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detail, id, session]);

  useEffect(() => {
    const ids = JSON.parse(pendingScanKey) as string[];
    if (!ids.length || !session || !hasRole(session.user, "DOCTOR")) return;
    const controller = new AbortController();
    const epoch = requestEpochRef.current;
    const current = () => !controller.signal.aborted
      && requestEpochRef.current === epoch && requestThreadRef.current === id;
    void Promise.resolve().then(async () => {
      if (!current()) return;
      setScanWaiting(false);
      const outcome = await pollConsultationAttachments({
        ids,
        signal: controller.signal,
        fetchStatus: (attachmentId, signal) => fetchDoctorConsultationAttachmentStatus(
          id, attachmentId, AbortSignal.any([signal, AbortSignal.timeout(10000)])),
        onUpdate: (items) => {
          if (!current()) return;
          const byId = new Map(items.map((item) => [item.id, item]));
          const merge = (messages: ConsultationDetail["messages"]) => messages.map((message) => ({
            ...message,
            attachments: message.attachments.map((attachment) => byId.get(attachment.id) ?? attachment),
          }));
          serverMessagesRef.current = merge(serverMessagesRef.current);
          setDetail((value) => value && current() ? { ...value, messages: merge(value.messages) } : value);
        },
      });
      if (current()) setScanWaiting(outcome === "pending");
    }).catch(() => { if (current()) setScanWaiting(true); });
    return () => controller.abort();
  }, [id, pendingScanKey, scanRetry, session]);

  // The read acknowledgement is sent only after the complete forward page
  // chain has been loaded. This prevents marking an unseen tail as read.
  useEffect(() => {
    if (!serverReadWatermark
      || serverReadWatermark.threadId !== id
      || serverReadWatermark.epoch !== requestEpochRef.current
      || acknowledgedThrough === serverReadWatermark.messageId
      || hasMore
      || !messagesComplete
      || messagePageError) return;
    const controller = new AbortController();
    const { epoch, messageId, threadId } = serverReadWatermark;
    const isCurrent = () => !controller.signal.aborted
      && requestEpochRef.current === epoch
      && requestThreadRef.current === threadId;
    void markDoctorConsultationRead(threadId, messageId, controller.signal)
      .then(() => {
        if (isCurrent()) setAcknowledgedThrough(messageId);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [hasMore, id, acknowledgedThrough, messagePageError, messagesComplete, serverReadWatermark]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    pageControllerRef.current?.abort();
    const controller = new AbortController();
    pageControllerRef.current = controller;
    const epoch = requestEpochRef.current;
    const threadId = id;
    const currentCursor = nextCursor;
    const isCurrent = () => !controller.signal.aborted
      && requestEpochRef.current === epoch
      && requestThreadRef.current === threadId;
    setLoadingMore(true);
    setError(null);
    setMessagePageError(false);
    try {
      const page = await fetchDoctorConsultationMessagePage(threadId, currentCursor, 50, controller.signal);
      if (!isCurrent()) return;
      const snapshot = reconcileConsultationServerPage(
        serverMessagesRef.current,
        page,
        session?.user.id ?? "",
        currentCursor,
      );
      serverMessagesRef.current = snapshot.messages;
      setDetail((current) => {
        if (!current || !isCurrent()) return current;
        const known = new Set(current.messages.map((message) => message.id));
        const newer = page.items.filter((message) => !known.has(message.id));
        return { ...current, messages: [...current.messages, ...newer] };
      });
      setNextCursor(snapshot.nextCursor);
      setHasMore(snapshot.hasMore);
      setMessagesComplete(snapshot.complete);
      setServerReadWatermark(snapshot.readWatermark
        ? { threadId, epoch, messageId: snapshot.readWatermark }
        : null);
      if (snapshot.stalled) {
        setMessagePageError(true);
        setError(new ApiError("Chuỗi tin nhắn chưa thể tải đầy đủ.", 502, "consultation-messages", { code: "CONSULTATION_CURSOR_STALLED" }));
      }
    } catch (reason) {
      if (!isAbortError(reason) && isCurrent()) {
        setMessagePageError(true);
        setMessagesComplete(false);
        setError(reason);
      }
    } finally {
      if (isCurrent()) setLoadingMore(false);
      if (pageControllerRef.current === controller) pageControllerRef.current = null;
    }
  };

  if (!session) return <LoginRequiredState nextPath={`/doctor/consultations/${id}`} />;
  if (!hasRole(session.user, "DOCTOR")) return <ForbiddenState title="Không thể mở tư vấn" description="Bạn không có quyền xem kênh này." />;
  const status = error instanceof ApiError ? error.status : undefined;
  const errorCopy = presentApiError(error instanceof ApiError ? error.code : undefined, status);
  const consultationStatus = detail?.consultation.status ?? "";
  const closed = consultationStatus === "CLOSED" || consultationStatus === "RESOLVED" || consultationStatus === "EXPIRED";

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending || !detail || closed) return;
    setSending(true);
    setError(null);
    const threadId = id;
    const epoch = requestEpochRef.current;
    try {
      const message = await sendDoctorConsultationMessage(threadId, draft.trim(), crypto.randomUUID());
      if (!isActiveThread(threadId, epoch)) return;
      setDetail((current) => {
        if (!current || !isActiveThread(threadId, epoch) || current.messages.some((item) => item.id === message.id)) return current;
        return {
          ...current,
          consultation: { ...current.consultation, status: "WAITING_FOR_PATIENT", updatedAt: message.createdAt },
          messages: [...current.messages, message],
        };
      });
      setDraft("");
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }));
    } catch (reason) {
      if (isActiveThread(threadId, epoch)) setError(reason);
    } finally {
      if (isActiveThread(threadId, epoch)) setSending(false);
    }
  };

  const resolve = async () => {
    if (busyStatus || !detail || closed) return;
    setBusyStatus(true);
    setError(null);
    const threadId = id;
    const epoch = requestEpochRef.current;
    try {
      await resolveDoctorConsultation(threadId);
      if (!isActiveThread(threadId, epoch)) return;
      setDetail((current) => current && isActiveThread(threadId, epoch)
        ? { ...current, consultation: { ...current.consultation, status: "RESOLVED" } }
        : current);
    } catch (reason) {
      if (isActiveThread(threadId, epoch)) setError(reason);
    } finally {
      if (isActiveThread(threadId, epoch)) setBusyStatus(false);
    }
  };

  const reopen = async () => {
    if (busyStatus || !detail || consultationStatus === "EXPIRED") return;
    setBusyStatus(true);
    setError(null);
    const threadId = id;
    const epoch = requestEpochRef.current;
    try {
      await reopenDoctorConsultation(threadId);
      if (!isActiveThread(threadId, epoch)) return;
      setDetail((current) => current && isActiveThread(threadId, epoch)
        ? { ...current, consultation: { ...current.consultation, status: "WAITING_FOR_DOCTOR" } }
        : current);
    } catch (reason) {
      if (isActiveThread(threadId, epoch)) setError(reason);
    } finally {
      if (isActiveThread(threadId, epoch)) setBusyStatus(false);
    }
  };

  const handoff = async () => {
    if (!handoffId || busyHandoff) return;
    setBusyHandoff(true);
    setError(null);
    const threadId = id;
    const epoch = requestEpochRef.current;
    const nextDoctorId = handoffId;
    try {
      await handoffDoctorConsultation(threadId, nextDoctorId);
      if (!isActiveThread(threadId, epoch)) return;
      setHandoffId("");
      setDetail((current) => current && isActiveThread(threadId, epoch)
        ? { ...current, consultation: { ...current.consultation, status: "WAITING_FOR_DOCTOR" } }
        : current);
    } catch (reason) {
      if (isActiveThread(threadId, epoch)) setError(reason);
    } finally {
      if (isActiveThread(threadId, epoch)) setBusyHandoff(false);
    }
  };

  const download = async (attachment: ConsultationAttachment) => {
    if (attachment.scanStatus !== "CLEAN") return;
    setDownloadError(null);
    const threadId = id;
    const epoch = requestEpochRef.current;
    try {
      const resolved = await fetchDoctorConsultationAttachmentDownload(threadId, attachment.id);
      if (!isActiveThread(threadId, epoch)) return;
      if (resolved.scanStatus !== "CLEAN" || !resolved.downloadUrl) {
        throw new ApiError("Tệp chưa sẵn sàng để mở.", 409, "attachments", { code: "CONSULTATION_ATTACHMENT_INVALID" });
      }
      window.open(resolved.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (reason) {
      if (isActiveThread(threadId, epoch)) setDownloadError(reason);
    }
  };

  return (
    <PortalChrome role="DOCTOR" user={session.user}>
      <div className="section-inner portal-page">
        <Link className="portal-context-link" href="/doctor/consultations">← Hàng đợi tư vấn</Link>
        {loading ? <LoadingState label="Đang tải nội dung tư vấn…" /> : null}
        {error && !detail ? <ErrorState message="Không thể tải kênh tư vấn." status={status} onRetry={() => setRetry((value) => value + 1)} /> : null}
        {detail ? (
          <>
            <header className="portal-hero">
              <div>
                <p className="section-note">TƯ VẤN RIÊNG · {statusLabel(consultationStatus)}</p>
                <h1>{detail.consultation.subject}</h1>
                <p>Bệnh nhân được bảo vệ danh tính · cửa sổ đến {safeDate(detail.consultation.openUntil)}</p>
                <p className="portal-panel__intro">Cập nhật gần nhất: {safeDate(detail.consultation.updatedAt, true)}</p>
              </div>
              <div className="portal-hero__actions">
                {consultationStatus === "CLOSED" || consultationStatus === "RESOLVED" ? <button className="outline-button" disabled={busyStatus} onClick={() => void reopen()} type="button">{busyStatus ? "Đang mở lại…" : "Mở lại kênh"}</button> : null}
                {consultationStatus !== "CLOSED" && consultationStatus !== "RESOLVED" && consultationStatus !== "EXPIRED" ? <button className="button button--primary" disabled={busyStatus} onClick={() => void resolve()} type="button">{busyStatus ? "Đang hoàn tất…" : "Đánh dấu đã xử lý"}</button> : null}
              </div>
            </header>

            <section className="portal-panel" aria-label="Tin nhắn tư vấn">
              <div className="portal-panel__heading">
                <div>
                  <p className="section-note">HỘI THOẠI BẢO MẬT</p>
                  <h2>Tin nhắn với bệnh nhân</h2>
                </div>
                <span className="section-note">{detail.messages.length} tin đang hiển thị</span>
              </div>
              {hasMore && nextCursor ? <button className="outline-button outline-button--small mb-4" disabled={loadingMore} onClick={() => void loadMore()} type="button">{loadingMore ? "Đang tải tin mới…" : "Tải tin mới hơn"}</button> : null}
              <div ref={threadRef} className="portal-thread" aria-live="polite" aria-relevant="additions text" tabIndex={0}>
                {detail.messages.length ? detail.messages.map((message) => (
                  <article className={`portal-thread__message ${message.authorRole === "DOCTOR" ? "portal-thread__message--mine" : ""}`} key={message.id}>
                    <p className="section-note">{authorLabel(message.authorRole)} · {safeDate(message.createdAt, true)} · {MESSAGE_STATUS_LABELS[message.status] ?? "Đang cập nhật"}</p>
                    <p>{message.body}</p>
                    {message.attachments.length ? <ul className="mt-3 grid gap-2" aria-label="Tệp đính kèm">{message.attachments.map((attachment) => <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm" key={attachment.id}><span>{attachment.mimeType} · {Math.ceil(attachment.sizeBytes / 1024)} KB · {attachmentStatus(attachment)}</span>{attachment.scanStatus === "CLEAN" ? <button className="outline-button outline-button--small" onClick={() => void download(attachment)} type="button">Mở tệp an toàn</button> : null}</li>)}</ul> : null}
                  </article>
                )) : <EmptyState title="Chưa có tin nhắn" description="Bệnh nhân chưa gửi nội dung. Không tự động chuyển nội dung này cho chatbot." />}
                <div ref={endRef} />
              </div>
              {hasMore ? <p className="portal-panel__intro" role="status">Còn tin nhắn mới hơn. Tải hết chuỗi trước khi trạng thái đọc được xác nhận.</p> : null}
            </section>

            {error && detail ? <ErrorState message={errorCopy} status={status} onRetry={() => setRetry((value) => value + 1)} /> : null}
            {downloadError ? <p aria-live="assertive" className="error-banner" role="alert">{presentApiError(downloadError instanceof ApiError ? downloadError.code : null, downloadError instanceof ApiError ? downloadError.status : undefined)}</p> : null}
            {pendingScanKey !== "[]" ? <div className="info-banner" role="status"><p>{scanWaiting ? "Tệp vẫn được khóa trong khi chờ hệ thống kiểm tra an toàn." : "Đang kiểm tra tệp. Bác sĩ chỉ có thể mở sau khi trạng thái là đã quét sạch."}</p>{scanWaiting ? <button className="outline-button outline-button--small" type="button" onClick={() => setScanRetry((value) => value + 1)}>Làm mới trạng thái tệp</button> : null}</div> : null}

            <form className="portal-panel" onSubmit={send}>
              <label htmlFor="doctor-consultation-message"><span className="section-note">PHẢN HỒI BỆNH NHÂN</span><textarea id="doctor-consultation-message" maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Viết phản hồi chuyên môn…" rows={4} disabled={sending || closed || hasMore} /></label>
              <div className="portal-panel__heading"><small>{draft.length}/4.000 ký tự · Không gọi AI{hasMore ? " · Tải hết chuỗi trước khi phản hồi" : ""}</small><button className="button button--primary" type="submit" disabled={sending || !draft.trim() || closed || hasMore}>{sending ? "Đang gửi…" : "Gửi phản hồi"}</button></div>
            </form>

            <section className="portal-panel grid gap-3" aria-labelledby="handoff-title">
              <div><h2 id="handoff-title">Handoff bác sĩ</h2><p className="portal-panel__intro">Chọn bác sĩ đang hoạt động trong cùng chuyên khoa/cơ sở. Handoff ghi audit; coordinator chỉ xem metadata.</p></div>
              {handoffLoading ? <p role="status">Đang tải danh sách bác sĩ…</p> : null}
              <label className="grid gap-1 text-sm font-bold" htmlFor="handoff-doctor">Bác sĩ nhận bàn giao<select id="handoff-doctor" className="min-h-11 rounded-lg border border-slate-300 px-3" disabled={handoffLoading || busyHandoff} onChange={(event) => setHandoffId(event.target.value)} value={handoffId}><option value="">Chọn bác sĩ</option>{handoffDoctors.map((doctor) => <option key={doctor.doctorId} value={doctor.doctorId}>{doctor.fullName}{doctor.specialtySlug ? ` · ${tokenLabel(doctor.specialtySlug)}` : ""}{doctor.branchSlug ? ` · ${tokenLabel(doctor.branchSlug)}` : ""}</option>)}</select></label>
              <button className="outline-button min-h-11 w-fit" disabled={busyHandoff || !handoffId || handoffLoading} onClick={() => void handoff()} type="button">{busyHandoff ? "Đang chuyển…" : "Chuyển handoff"}</button>
            </section>
          </>
        ) : null}
      </div>
    </PortalChrome>
  );
}
