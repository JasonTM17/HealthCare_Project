"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import PortalChrome from "../../../../components/PortalChrome";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../../components/PortalStates";
import { useAuthSession } from "../../../../components/useAuthSession";
import {
  ApiError,
  hasRole,
  sendPatientConsultationMessage,
} from "../../../../lib/api-client";
import { reconcileConsultationServerPage } from "../../../../lib/consultation-read-watermark";
import { pollConsultationAttachments } from "../../../../lib/consultation-attachment-polling";
import {
  ConsultationRequestTimeoutError,
  fetchConsultationResponseBody,
  fetchConsultationUploadResponse,
} from "../../../../lib/consultation-request";
import { presentApiError } from "../../../../lib/present-api-error";
import type { ConsultationAttachment, ConsultationDetail, ConsultationMessage } from "../../../../types/hospital";

interface MessagePageResponse {
  items: ConsultationMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface UploadIntentResponse extends ConsultationAttachment {
  uploadStatus?: string;
  uploadUrl?: string | null;
  uploadExpiresAt?: string | null;
}

type UploadStage = "QUEUED" | "HASHING" | "UPLOADING" | "SCANNING" | "CLEAN" | "REJECTED" | "ERROR";

interface PendingUpload {
  key: string;
  fileName: string;
  stage: UploadStage;
  attachmentId?: string;
  errorCode?: string | null;
}

interface ServerReadWatermark {
  threadId: string;
  epoch: number;
  messageId: string;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_MESSAGE = 3;
const CONSULTATION_UPLOAD_TIMEOUT_MS = 120_000;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang mở",
  WAITING_FOR_DOCTOR: "Chờ bác sĩ",
  WAITING_FOR_PATIENT: "Chờ bạn",
  RESOLVED: "Đã xử lý",
  CLOSED: "Đã đóng",
  EXPIRED: "Đã hết hạn",
};

const MESSAGE_STATUS_LABELS: Record<string, string> = {
  SENT: "Đã gửi",
  READ: "Đã đọc",
};

function safeDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", includeTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "medium" });
}

function statusLabel(value: string): string {
  return STATUS_LABELS[value] ?? "Đang cập nhật";
}

function isMessagePage(value: unknown): value is MessagePageResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<MessagePageResponse>;
  return Array.isArray(record.items) && typeof record.hasMore === "boolean";
}

function normalizeMessagePage(value: unknown): MessagePageResponse {
  if (isMessagePage(value)) {
    return { items: value.items, nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null, hasMore: value.hasMore };
  }
  return { items: Array.isArray(value) ? value as ConsultationMessage[] : [], nextCursor: null, hasMore: false };
}

function safeErrorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

function safeErrorCode(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function requestConsultationJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  try {
    const { response, text: responseText } = await fetchConsultationResponseBody(path, { ...init, headers });
    if (!response.ok) {
      let code: string | null = null;
      try {
        const body = JSON.parse(responseText) as { code?: unknown; errorCode?: unknown };
        const candidate = body.code ?? body.errorCode;
        if (typeof candidate === "string") code = candidate;
      } catch {
        // The user-facing copy remains code-owned even when the response is not JSON.
      }
      throw new ApiError("Yêu cầu tư vấn chưa thể hoàn tất.", response.status, path, { code });
    }
    if (response.status === 204) return undefined as T;
    if (!responseText) return undefined as T;
    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new ApiError("Dữ liệu tư vấn không hợp lệ.", 502, path);
    }
  } catch (error) {
    if (error instanceof ConsultationRequestTimeoutError) {
      throw new ApiError("Yêu cầu tư vấn mất quá nhiều thời gian. Vui lòng thử lại.", 408, path);
    }
    throw error;
  }
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function attachmentLabel(attachment: ConsultationAttachment & { uploadStatus?: string }): string {
  if (attachment.scanStatus === "CLEAN") return "Đã quét sạch";
  if (attachment.scanStatus === "REJECTED") return "Không thể mở tệp";
  if (attachment.uploadStatus === "EXPIRED") return "Liên kết tải lên đã hết hạn";
  return "Đang kiểm tra an toàn";
}

export default function PatientConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useAuthSession();
  const [detail, setDetail] = useState<ConsultationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [attachmentError, setAttachmentError] = useState<unknown>(null);
  const [scanRetry, setScanRetry] = useState(0);
  const [scanWaiting, setScanWaiting] = useState(false);
  const [retry, setRetry] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [messagesComplete, setMessagesComplete] = useState(false);
  const [messagePageError, setMessagePageError] = useState(false);
  const [serverReadWatermark, setServerReadWatermark] = useState<ServerReadWatermark | null>(null);
  const [acknowledgedThrough, setAcknowledgedThrough] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const pageControllerRef = useRef<AbortController | null>(null);
  const requestEpochRef = useRef(0);
  const requestThreadRef = useRef(id);
  const serverMessagesRef = useRef<ConsultationMessage[]>([]);
  const sendAttemptRef = useRef<{ threadId: string; body: string; key: string } | null>(null);
  const pendingScanKey = JSON.stringify([...new Set(detail?.messages.flatMap((message) =>
    message.attachments.filter((attachment) => attachment.scanStatus === "PENDING").map((attachment) => attachment.id)) ?? [])].sort());

  const isActiveThread = (threadId: string, epoch: number): boolean => (
    requestThreadRef.current === threadId && requestEpochRef.current === epoch
  );

  const load = useCallback(async (signal: AbortSignal) => {
    const [loaded, rawPage] = await Promise.all([
      requestConsultationJson<ConsultationDetail>(`/patient/consultations/${encodeURIComponent(id)}`, { signal }),
      requestConsultationJson<unknown>(`/patient/consultations/${encodeURIComponent(id)}/messages?limit=50`, { signal }),
    ]);
    const page = normalizeMessagePage(rawPage);
    return { detail: { ...loaded, messages: page.items }, page };
  }, [id]);

  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
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
        setLoadingOlder(false);
        setSending(false);
        setBusyStatus(false);
        setUploads([]);
        setPendingFiles([]);
        setDetail(null);
        setNextCursor(null);
        setHasMore(false);
        setServerReadWatermark(null);
        setAcknowledgedThrough(null);
        serverMessagesRef.current = [];
        sendAttemptRef.current = null;
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
    const ids = JSON.parse(pendingScanKey) as string[];
    if (!ids.length || !session || !hasRole(session.user, "PATIENT")) return;
    const controller = new AbortController();
    const epoch = requestEpochRef.current;
    const current = () => !controller.signal.aborted
      && requestEpochRef.current === epoch && requestThreadRef.current === id;
    void Promise.resolve().then(async () => {
      if (!current()) return;
      setScanWaiting(false);
      const outcome = await pollConsultationAttachments({
        ids, signal: controller.signal,
        fetchStatus: (attachmentId, signal) => requestConsultationJson<ConsultationAttachment>(
          `/patient/consultations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
          { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) }),
        onUpdate: (items) => {
          if (!current()) return;
          const byId = new Map(items.map((item) => [item.id, item]));
          const merge = (messages: ConsultationMessage[]) => messages.map((message) => ({
            ...message, attachments: message.attachments.map((attachment) => byId.get(attachment.id) ?? attachment),
          }));
          serverMessagesRef.current = merge(serverMessagesRef.current);
          setDetail((value) => value && current() ? { ...value, messages: merge(value.messages) } : value);
          setUploads((value) => current() ? value.map((upload) => {
            const result = upload.attachmentId ? byId.get(upload.attachmentId) : undefined;
            return result ? { ...upload, stage: result.scanStatus === "CLEAN" ? "CLEAN"
              : result.scanStatus === "REJECTED" ? "REJECTED" : "SCANNING" } : upload;
          }) : value);
        },
      });
      if (current()) setScanWaiting(outcome === "pending");
    }).catch(() => { if (current()) setScanWaiting(true); });
    return () => controller.abort();
  }, [id, pendingScanKey, scanRetry, session]);

  useEffect(() => {
    // The first page is an ascending slice. Do not acknowledge a partial
    // transcript as read; otherwise unseen messages after the cursor would be
    // marked read before the patient has loaded them.
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
    void requestConsultationJson<void>(`/patient/consultations/${encodeURIComponent(id)}/read`, {
      method: "POST",
      body: JSON.stringify({ throughMessageId: messageId }),
      signal: controller.signal,
    })
      .then(() => {
        if (isCurrent()) setAcknowledgedThrough(messageId);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [acknowledgedThrough, hasMore, id, messagePageError, messagesComplete, serverReadWatermark]);

  const loadMore = async () => {
    if (!nextCursor || loadingOlder) return;
    pageControllerRef.current?.abort();
    const controller = new AbortController();
    pageControllerRef.current = controller;
    const epoch = requestEpochRef.current;
    const threadId = id;
    const currentCursor = nextCursor;
    const isCurrent = () => !controller.signal.aborted
      && requestEpochRef.current === epoch
      && requestThreadRef.current === threadId;
    setLoadingOlder(true);
    setMessagePageError(false);
    try {
      const page = normalizeMessagePage(await requestConsultationJson<unknown>(
        `/patient/consultations/${encodeURIComponent(threadId)}/messages?cursor=${encodeURIComponent(currentCursor)}&limit=50`,
        { signal: controller.signal },
      ));
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
      if (isCurrent()) setLoadingOlder(false);
      if (pageControllerRef.current === controller) pageControllerRef.current = null;
    }
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;
    const accepted = selected.slice(0, MAX_FILES_PER_MESSAGE).filter((file) => ALLOWED_MIME_TYPES.has(file.type) && file.size <= MAX_FILE_BYTES);
    if (accepted.length !== selected.length || selected.length > MAX_FILES_PER_MESSAGE) {
      setAttachmentError(new ApiError("Tệp không đúng định dạng hoặc vượt quá giới hạn cho phép.", 422, "attachments", { code: "CONSULTATION_ATTACHMENT_INVALID" }));
    } else {
      setAttachmentError(null);
    }
    setPendingFiles(accepted);
  };

  const appendMessage = (message: ConsultationMessage, threadId: string, epoch: number) => {
    if (!isActiveThread(threadId, epoch)) return;
    setDetail((current) => {
      if (!current || !isActiveThread(threadId, epoch)) return current;
      if (current.messages.some((item) => item.id === message.id)) return current;
      return { ...current, consultation: { ...current.consultation, status: "WAITING_FOR_DOCTOR", updatedAt: message.createdAt }, messages: [...current.messages, message] };
    });
  };

  const processAttachments = async (message: ConsultationMessage, files: File[], threadId: string, epoch: number) => {
    if (files.length === 0 || !isActiveThread(threadId, epoch)) return;
    const initial = files.map((file) => ({ key: crypto.randomUUID(), fileName: file.name, stage: "QUEUED" as const }));
    setUploads(initial);
    setAttachmentError(null);
    const signal = requestControllerRef.current?.signal;
    for (const [index, file] of files.entries()) {
      if (!isActiveThread(threadId, epoch)) return;
      const current = initial[index];
      const setStage = (stage: UploadStage, extra: Partial<PendingUpload> = {}) => {
        if (!isActiveThread(threadId, epoch)) return;
        setUploads((items) => isActiveThread(threadId, epoch)
          ? items.map((item) => item.key === current.key ? { ...item, stage, ...extra } : item)
          : items);
      };
      try {
        setStage("HASHING");
        const hash = await sha256(file);
        if (!isActiveThread(threadId, epoch)) return;
        const intent = await requestConsultationJson<UploadIntentResponse>(`/patient/consultations/${encodeURIComponent(threadId)}/attachments/intents`, {
          method: "POST",
          signal,
          body: JSON.stringify({ messageId: message.id, mimeType: file.type, sizeBytes: file.size, sha256Hash: hash }),
        });
        if (!isActiveThread(threadId, epoch)) return;
        if (!intent.uploadUrl) throw new ApiError("Kho tệp tư vấn chưa sẵn sàng.", 503, "attachments", { code: "CONSULTATION_ATTACHMENT_STORAGE_UNAVAILABLE" });
        setStage("UPLOADING", { attachmentId: intent.id });
        const uploadResponse = await fetchConsultationUploadResponse(intent.uploadUrl, { method: "PUT", body: file, signal,
          credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", headers: { "Content-Type": file.type } }, {
          timeoutMs: CONSULTATION_UPLOAD_TIMEOUT_MS,
        });
        if (!isActiveThread(threadId, epoch)) return;
        if (!uploadResponse.ok) throw new ApiError("Không thể tải tệp lên kho riêng.", 502, "attachments");
        setStage("SCANNING", { attachmentId: intent.id });
        const completed = await requestConsultationJson<UploadIntentResponse>(`/patient/consultations/${encodeURIComponent(threadId)}/attachments/${encodeURIComponent(intent.id)}/complete`, {
          method: "POST",
          signal,
          body: JSON.stringify({}),
        });
        if (!isActiveThread(threadId, epoch)) return;
        setStage(completed.scanStatus === "CLEAN" ? "CLEAN" : completed.scanStatus === "REJECTED" ? "REJECTED" : "SCANNING", { attachmentId: intent.id });
        setDetail((currentDetail) => {
          if (!currentDetail || !isActiveThread(threadId, epoch)) return currentDetail;
          return {
            ...currentDetail,
            messages: currentDetail.messages.map((item) => item.id === message.id
              ? { ...item, attachments: [...item.attachments.filter((attachment) => attachment.id !== completed.id), completed] }
              : item),
          };
        });
      } catch (reason) {
        if (!isActiveThread(threadId, epoch)) return;
        setStage("ERROR", { errorCode: safeErrorCode(reason) });
        setAttachmentError(reason);
      }
    }
  };

  if (!session) return <LoginRequiredState nextPath={`/patient/consultations/${id}`} />;
  if (!hasRole(session.user, "PATIENT")) return <ForbiddenState title="Không thể mở tư vấn" description="Bạn không có quyền xem kênh này." />;
  const status = safeErrorStatus(error);
  const consultationStatus = detail?.consultation.status ?? "";
  const channelClosed = ["RESOLVED", "CLOSED", "EXPIRED"].includes(consultationStatus);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending || !detail || channelClosed) return;
    setSending(true);
    setError(null);
    const files = pendingFiles;
    const threadId = id;
    const epoch = requestEpochRef.current;
    const body = draft.trim();
    const previousAttempt = sendAttemptRef.current;
    const attempt = previousAttempt?.threadId === threadId && previousAttempt.body === body
      ? previousAttempt : { threadId, body, key: crypto.randomUUID() };
    sendAttemptRef.current = attempt;
    try {
      const message = await sendPatientConsultationMessage(threadId, body, attempt.key, requestControllerRef.current?.signal);
      if (!isActiveThread(threadId, epoch)) return;
      sendAttemptRef.current = null;
      appendMessage(message, threadId, epoch);
      setDraft("");
      setPendingFiles([]);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }));
      await processAttachments(message, files, threadId, epoch);
    } catch (reason) {
      if (isActiveThread(threadId, epoch)) setError(reason);
    } finally {
      if (isActiveThread(threadId, epoch)) setSending(false);
    }
  };

  const close = async () => {
    if (busyStatus || !detail || channelClosed) return;
    setBusyStatus(true);
    setError(null);
    const threadId = id;
    const epoch = requestEpochRef.current;
    try {
      await requestConsultationJson<void>(`/patient/consultations/${encodeURIComponent(threadId)}/close`, {
        method: "POST", signal: requestControllerRef.current?.signal,
      });
      if (!isActiveThread(threadId, epoch)) return;
      setDetail((current) => current && isActiveThread(threadId, epoch)
        ? { ...current, consultation: { ...current.consultation, status: "CLOSED" } }
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
      await requestConsultationJson<void>(`/patient/consultations/${encodeURIComponent(threadId)}/reopen`, {
        method: "POST", signal: requestControllerRef.current?.signal,
      });
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

  const download = async (attachment: ConsultationAttachment) => {
    if (attachment.scanStatus !== "CLEAN") return;
    const threadId = id;
    const epoch = requestEpochRef.current;
    try {
      const resolved = await requestConsultationJson<ConsultationAttachment>(`/patient/consultations/${encodeURIComponent(threadId)}/attachments/${encodeURIComponent(attachment.id)}/download`, {
        signal: requestControllerRef.current?.signal,
      });
      if (resolved.scanStatus !== "CLEAN" || !resolved.downloadUrl) {
        throw new ApiError("Tệp chưa sẵn sàng để mở.", 409, "attachments", { code: "CONSULTATION_ATTACHMENT_INVALID" });
      }
      if (isActiveThread(threadId, epoch)) window.open(resolved.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (reason) {
      if (isActiveThread(threadId, epoch)) setAttachmentError(reason);
    }
  };

  return (
    <PortalChrome role="PATIENT" user={session.user}>
      <div className="section-inner portal-page">
        <Link className="portal-context-link" href="/patient/consultations">← Danh sách tư vấn</Link>
        {loading ? <LoadingState label="Đang tải nội dung tư vấn…" /> : null}
        {error && !detail ? <ErrorState message="Không thể tải kênh tư vấn." status={status} onRetry={() => setRetry((value) => value + 1)} /> : null}
        {detail ? (
          <>
            <header className="portal-hero">
              <div>
                <p className="section-note">TƯ VẤN RIÊNG · {statusLabel(consultationStatus)}</p>
                <h1>{detail.consultation.subject}</h1>
                <p>
                  Bác sĩ {detail.consultation.doctorName ?? "được phân công"} · cửa sổ đến {safeDate(detail.consultation.openUntil)}
                </p>
                <p className="portal-panel__intro">Cập nhật gần nhất: {safeDate(detail.consultation.updatedAt, true)}</p>
              </div>
              <div className="portal-hero__actions">
                {consultationStatus === "CLOSED" ? <button className="outline-button" disabled={busyStatus} onClick={() => void reopen()} type="button">{busyStatus ? "Đang mở lại…" : "Mở lại kênh"}</button> : null}
                {consultationStatus !== "CLOSED" && consultationStatus !== "EXPIRED" ? <button className="outline-button" disabled={busyStatus} onClick={() => void close()} type="button">{busyStatus ? "Đang đóng…" : "Đóng kênh"}</button> : null}
              </div>
            </header>

            <p aria-live="assertive" className="portal-panel portal-panel--notice" role="alert">
              Đây không phải kênh cấp cứu. Nếu có nguy hiểm tức thời, hãy gọi <a href="tel:115">115</a>; tin nhắn tại đây sẽ không tự động gọi hỗ trợ khẩn cấp.
            </p>

            <section className="portal-panel" aria-label="Tin nhắn tư vấn">
              <div className="portal-panel__heading">
                <div>
                  <p className="section-note">HỘI THOẠI BẢO MẬT</p>
                  <h2>Tin nhắn với bác sĩ</h2>
                </div>
                <span className="section-note">{detail.messages.length} tin đang hiển thị</span>
              </div>
              {hasMore && nextCursor ? <button className="outline-button outline-button--small mb-4 min-h-11" disabled={loadingOlder} onClick={() => void loadMore()} type="button">{loadingOlder ? "Đang tải thêm…" : "Tải thêm tin nhắn"}</button> : null}
              <div ref={threadRef} className="portal-thread" aria-live="polite" aria-relevant="additions text" tabIndex={0}>
                {detail.messages.length ? detail.messages.map((message) => (
                  <article className={`portal-thread__message ${message.authorRole === "PATIENT" ? "portal-thread__message--mine" : ""}`} key={message.id}>
                    <p className="section-note">
                      {message.authorRole === "PATIENT" ? "Bạn" : "Bác sĩ"} · {safeDate(message.createdAt, true)} · {MESSAGE_STATUS_LABELS[message.status] ?? "Đang cập nhật"}
                    </p>
                    <p>{message.body}</p>
                    {message.attachments.length ? (
                      <ul className="mt-3 grid gap-2" aria-label="Tệp đính kèm">
                        {message.attachments.map((attachment) => (
                          <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm" key={attachment.id}>
                            <span>{attachment.mimeType} · {Math.ceil(attachment.sizeBytes / 1024)} KB · {attachmentLabel(attachment)}</span>
                            {attachment.scanStatus === "CLEAN" ? <button className="outline-button outline-button--small" onClick={() => void download(attachment)} type="button">Mở tệp an toàn</button> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                )) : <EmptyState title="Bắt đầu cuộc trao đổi" description="Mô tả điều bạn muốn hỏi; bác sĩ sẽ xem trong giờ làm việc." />}
                <div ref={endRef} />
              </div>
            </section>

            {error && detail ? (
              <ErrorState
                message={messagePageError ? "Chưa thể tải đầy đủ cuộc hội thoại." : "Yêu cầu tư vấn chưa thể hoàn tất."}
                onRetry={messagePageError ? () => setRetry((value) => value + 1) : undefined}
                status={safeErrorStatus(error)}
              />
            ) : null}
            {attachmentError ? <p aria-live="assertive" className="error-banner" role="alert">{presentApiError(safeErrorCode(attachmentError), safeErrorStatus(attachmentError))}</p> : null}
            {pendingScanKey !== "[]" ? (
              <div className="portal-panel" aria-live="polite">
                <p>{scanWaiting ? "Tệp vẫn được giữ riêng tư trong khi chờ kiểm tra an toàn. Bạn có thể làm mới trạng thái." : "Đang kiểm tra an toàn tệp. Chỉ tệp đã quét sạch mới có thể mở."}</p>
                {scanWaiting ? <button className="outline-button" type="button" onClick={() => setScanRetry((value) => value + 1)}>Làm mới trạng thái tệp</button> : null}
              </div>
            ) : null}
            {uploads.length ? (
              <section className="portal-panel" aria-label="Trạng thái tệp tải lên">
                <p className="section-note">TỆP ĐÍNH KÈM</p>
                <ul className="grid gap-2">
                  {uploads.map((upload) => <li className="flex items-center justify-between gap-3 text-sm" key={upload.key}><span className="truncate">{upload.fileName}</span><span role="status">{upload.stage === "HASHING" ? "Đang kiểm tra…" : upload.stage === "UPLOADING" ? "Đang tải lên…" : upload.stage === "SCANNING" ? "Đang quét an toàn…" : upload.stage === "CLEAN" ? "Đã quét sạch" : upload.stage === "REJECTED" ? "Đã từ chối" : upload.stage === "ERROR" ? "Không hoàn tất" : "Đang chờ"}</span></li>)}
                </ul>
              </section>
            ) : null}

            <form className="portal-panel" onSubmit={send}>
              <label htmlFor="consultation-message">
                <span className="section-note">TIN NHẮN MỚI</span>
                <textarea id="consultation-message" maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Viết câu hỏi cho bác sĩ…" rows={4} disabled={sending || channelClosed} aria-describedby="consultation-message-help" />
              </label>
              <p className="portal-panel__intro" id="consultation-message-help">{draft.length}/4.000 ký tự · Không gửi ảnh/PDF cho chatbot. Tệp sẽ được quét trước khi bác sĩ có thể mở.</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="outline-button outline-button--small inline-flex cursor-pointer items-center justify-center" htmlFor="consultation-attachments">
                  Thêm ảnh/PDF
                  <input id="consultation-attachments" accept="image/jpeg,image/png,application/pdf" className="sr-only" disabled={sending || channelClosed} multiple onChange={handleFiles} type="file" />
                </label>
                <button className="button button--primary" type="submit" disabled={sending || !draft.trim() || channelClosed}>{sending ? "Đang gửi…" : "Gửi tin nhắn"}</button>
              </div>
              {pendingFiles.length ? <p className="mt-3 text-sm text-slate-600" aria-live="polite">{pendingFiles.length} tệp sẽ được tải lên sau khi tin nhắn được gửi.</p> : null}
            </form>
          </>
        ) : null}
      </div>
    </PortalChrome>
  );
}
