"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import UiIcon from "./UiIcon";
import AssistantMark from "./AssistantMark";
import { useAuthSession } from "./useAuthSession";
import {
  ApiError,
  clearAuthSession,
  createAiConversation,
  deleteAiMessageFeedback,
  fetchAiChatPolicy,
  fetchAiConversationMessages,
  fetchAiConversations,
  hasRole,
  updateAiConversationConsent,
  updateAiMessageFeedback,
  sendAiConversationMessage,
} from "../lib/api-client";
import type {
  AiChatMessage,
  AiChatPolicy,
  AiChatProvenance,
  AiConversation,
  AuthSession,
  ChatMode,
  FeedbackRating,
} from "../types/hospital";
import {
  ASSISTANT_MODE_OPTIONS,
  AssistantProvider,
  DEFAULT_CHAT_MODE,
  hasCurrentChatConsent,
  isNearBottom,
  useAssistant,
} from "./AssistantProvider";
import styles from "./FloatingHealthAssistant.module.css";

// healthcare-assistant-chibi.png is legacy provenance and intentionally stays
// out of the active control; launcher uses the code-native AssistantMark.

const MAX_MESSAGE_LENGTH = 10_000;
const DEFAULT_DISCLAIMER = "Thông tin chỉ mang tính tham khảo, không thay thế thăm khám hoặc hướng dẫn của bác sĩ.";
const SUGGESTED_QUESTIONS = [
  "Tôi nên chuẩn bị gì trước khi đi khám?",
  "Tìm chuyên khoa phù hợp với triệu chứng của tôi",
  "Làm sao để đặt lịch khám tại HealthCare?",
];
const PUBLIC_ASSISTANT_OPEN_EVENT = "healthcare:open-assistant";

function createIdempotencyKey(): string {
  return `floating-chat-${crypto.randomUUID()}`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

type AssistantFailureKind = "access" | "blocked" | "unavailable" | "generic";

interface AssistantFailure {
  kind: AssistantFailureKind;
  message: string;
  retryable: boolean;
}

function failureFromError(error: unknown): AssistantFailure {
  if (!(error instanceof ApiError)) {
    return {
      kind: "unavailable",
      message: "Kết nối tới trợ lý bị gián đoạn. Hãy thử lại sau ít phút.",
      retryable: true,
    };
  }

  if (error.status === 401) {
    return { kind: "access", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", retryable: false };
  }
  if (error.status === 403) {
    return { kind: "access", message: "Tài khoản hiện tại không có quyền dùng trợ lý sức khỏe.", retryable: false };
  }
  if (error.status === 429) {
    return { kind: "unavailable", message: "Bạn đang gửi hơi nhanh. Vui lòng chờ một lát rồi thử lại.", retryable: true };
  }
  if (error.code === "CHAT_CONTENT_BLOCKED") {
    return { kind: "blocked", message: "Hãy bỏ thông tin nhận dạng cá nhân và thử diễn đạt lại câu hỏi.", retryable: false };
  }
  if (error.code === "CHAT_MESSAGE_IN_PROGRESS") {
    return { kind: "unavailable", message: "Trợ lý đang xử lý tin nhắn trước đó. Hãy thử lại sau giây lát.", retryable: true };
  }
  if (error.code === "CHAT_INPUT_INVALID") {
    return { kind: "blocked", message: "Tin nhắn phải có từ 2 đến 10.000 ký tự.", retryable: false };
  }
  if (error.code === "AI_UNAVAILABLE") {
    return { kind: "unavailable", message: "Trợ lý tạm thời chưa thể phản hồi. Bạn có thể gửi lại câu hỏi.", retryable: true };
  }
  if (error.code === "AI_RESPONSE_INVALID") {
    return { kind: "unavailable", message: "Phản hồi của trợ lý chưa đạt yêu cầu an toàn. Hãy thử lại sau.", retryable: true };
  }

  return {
    kind: error.status === 0 || error.status >= 500 ? "unavailable" : "generic",
    message: "Trợ lý chưa thể phản hồi lúc này. Bạn có thể thử lại.",
    retryable: error.status === 0 || error.status >= 500,
  };
}

function inputFailure(): AssistantFailure {
  return { kind: "blocked", message: "Tin nhắn phải có từ 2 đến 10.000 ký tự.", retryable: false };
}

function provenanceLabel(provenance: AiChatProvenance): string {
  switch (provenance) {
    case "local_fallback":
      return "Chế độ dự phòng tại chỗ";
    case "remote_provider":
      return "Phản hồi AI có kiểm soát";
    default:
      return "Nguồn HealthCare";
  }
}

// citationHref is intentionally not used: governed citations are text-only;
// only server-owned suggestedActions may navigate.

function feedbackRating(message: AiChatMessage): FeedbackRating | null {
  if (!message.feedback) return null;
  return typeof message.feedback === "string" ? message.feedback : message.feedback.rating;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function conversationNeedsCurrentConsent(
  conversation: AiConversation | null | undefined,
  policy: AiChatPolicy | null | undefined,
): boolean {
  return Boolean(conversation?.consentRequired && !hasCurrentChatConsent(conversation, policy));
}

function FloatingHealthAssistantPanel({
  pathname,
  session,
}: {
  pathname: string;
  session: AuthSession | null;
}) {
  const assistant = useAssistant();
  const {
    mode,
    setMode,
    modeLocked,
    setConversation: setAssistantConversation,
    policy,
    setPolicy,
    invalidateRequests,
  } = assistant;
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<AssistantFailure | null>(null);
  const [lastFailedContent, setLastFailedContent] = useState<string | null>(null);
  const [blockedByModal, setBlockedByModal] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const [creatingMode, setCreatingMode] = useState(false);
  const retainedAttemptRef = useRef<{ conversationId: string; content: string; key: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const policyControllerRef = useRef<AbortController | null>(null);
  const requestEpochRef = useRef(0);
  const conversationIdRef = useRef<string | null>(null);
  const policyEpochRef = useRef(0);
  const messageViewportRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);
  const handleModeChangeRef = useRef<(nextMode: ChatMode) => Promise<void>>(
    async () => undefined,
  );

  const isPatient = Boolean(session && hasRole(session.user, "PATIENT"));
  const hidden = pathname === "/patient/chat"
    || pathname.startsWith("/patient/chat/")
    || Boolean(session && !isPatient);

  const syncConversation = useCallback((next: AiConversation | null): void => {
    conversationIdRef.current = next?.id ?? null;
    setConversation(next);
    setAssistantConversation(next);
  }, [setAssistantConversation]);

  const beginLocalRequest = useCallback((): { controller: AbortController; epoch: number } => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const epoch = requestEpochRef.current + 1;
    requestEpochRef.current = epoch;
    return { controller, epoch };
  }, []);

  const invalidateLocalRequests = useCallback((): void => {
    requestEpochRef.current += 1;
    policyEpochRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    policyControllerRef.current?.abort();
    policyControllerRef.current = null;
    invalidateRequests();
  }, [invalidateRequests]);

  const isCurrentLocalRequest = useCallback((epoch: number, conversationId?: string | null): boolean => (
    requestEpochRef.current === epoch
    && (typeof conversationId === "undefined" || conversationIdRef.current === conversationId)
  ), []);

  const refreshChatPolicy = useCallback(async (signal?: AbortSignal): Promise<AiChatPolicy> => {
    const policyEpoch = policyEpochRef.current + 1;
    policyEpochRef.current = policyEpoch;
    const nextPolicy = await fetchAiChatPolicy({ signal });
    if (policyEpochRef.current === policyEpoch && !signal?.aborted) setPolicy(nextPolicy);
    return nextPolicy;
  }, [setPolicy]);

  const closeAssistant = useCallback(() => {
    invalidateLocalRequests();
    setSending(false);
    setLoading(false);
    setCreatingMode(false);
    setConsentBusy(false);
    setOpen(false);
  }, [invalidateLocalRequests]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const syncModalBoundary = (): void => {
      const externalModal = Array.from(
        document.querySelectorAll<HTMLElement>("[role=\"dialog\"], dialog[open]"),
      ).some((element) => (
        element.id !== "floating-health-assistant-panel"
        && (element.matches("dialog[open]") || element.getAttribute("aria-modal") === "true")
      ));
      setBlockedByModal(externalModal);
      if (externalModal) setOpen(false);
    };

    syncModalBoundary();
    const observer = new MutationObserver(syncModalBoundary);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-modal", "open", "role"],
    });
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    const handlePublicOpen = (event: Event): void => {
      if (hidden) return;
      const nextMode = (event as CustomEvent<{ mode?: ChatMode }>).detail?.mode;
      const requestedMode: ChatMode = nextMode === "SYMPTOM_TRIAGE" ? nextMode : "SYMPTOM_TRIAGE";
      setOpen(true);
      setFailure(null);
      setConsentError(null);
      if (conversation) {
        void handleModeChangeRef.current(requestedMode);
      } else {
        setMode(requestedMode);
      }
    };
    window.addEventListener(PUBLIC_ASSISTANT_OPEN_EVENT, handlePublicOpen);
    return () => window.removeEventListener(PUBLIC_ASSISTANT_OPEN_EVENT, handlePublicOpen);
  }, [conversation, hidden, setMode]);

  useEffect(() => {
    if (!open || hidden || blockedByModal) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const launcher = launcherRef.current;
    const focusableElements = (): HTMLElement[] => Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>([
        "a[href]",
        "button:not([disabled])",
        "textarea:not([disabled])",
      ].join(",")) ?? [],
    );
    const animationFrame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAssistant();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusableElements();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (launcher?.isConnected) launcher.focus();
      else if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [blockedByModal, closeAssistant, hidden, open]);

  useEffect(() => {
    if (!open || hidden || !isPatient || conversationIdRef.current) return;
    let cancelled = false;
    const { controller, epoch } = beginLocalRequest();
    const frame = window.requestAnimationFrame(() => {
      if (cancelled || !isCurrentLocalRequest(epoch)) return;
      setLoading(true);
      setFailure(null);
      // Legacy contract remains fetchAiConversations(); the signal overload
      // below only cancels stale work.
      void fetchAiConversations({ signal: controller.signal })
        .then(async (items) => {
          if (cancelled || !isCurrentLocalRequest(epoch)) return;
          const latest = items[0] ?? null;
          syncConversation(latest);
          if (latest) {
            const page = await fetchAiConversationMessages(latest.id, null, 12, { signal: controller.signal });
            if (!cancelled && isCurrentLocalRequest(epoch, latest.id)) setMessages(page.content.slice(-8));
          }
        })
        .catch((error: unknown) => {
          if (!cancelled && isCurrentLocalRequest(epoch) && !isAbortError(error)) {
            if (error instanceof ApiError && error.status === 401) clearAuthSession();
            setFailure(failureFromError(error));
          }
        })
        .finally(() => {
          if (!cancelled && isCurrentLocalRequest(epoch)) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (requestControllerRef.current === controller) {
        requestEpochRef.current += 1;
        controller.abort();
        requestControllerRef.current = null;
      }
    };
  }, [beginLocalRequest, hidden, isCurrentLocalRequest, isPatient, open, syncConversation]);

  useEffect(() => {
    if (!open || hidden || !isPatient) return;
    const controller = new AbortController();
    const policyEpoch = policyEpochRef.current + 1;
    policyEpochRef.current = policyEpoch;
    // A cached version cannot prove that the server policy is still current;
    // fail closed until this open-cycle refresh completes.
    setPolicy(null);
    policyControllerRef.current?.abort();
    policyControllerRef.current = controller;
    void fetchAiChatPolicy({ signal: controller.signal })
      .then((nextPolicy) => {
        if (policyEpochRef.current === policyEpoch && !controller.signal.aborted) setPolicy(nextPolicy);
      })
      .catch((error: unknown) => {
        if (policyEpochRef.current === policyEpoch && !isAbortError(error)) setFailure(failureFromError(error));
      });
    return () => {
      if (policyControllerRef.current === controller) {
        policyEpochRef.current += 1;
        controller.abort();
        policyControllerRef.current = null;
      }
    };
  }, [hidden, isPatient, open, setPolicy]);

  useEffect(() => {
    shouldScrollRef.current = true;
  }, [messages.length]);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport || !shouldScrollRef.current) return;
    if (isNearBottom(viewport) || messages.length <= 2) {
      viewport.scrollTop = viewport.scrollHeight;
    }
    shouldScrollRef.current = false;
  }, [messages]);

  useEffect(() => {
    handleModeChangeRef.current = handleModeChange;
  });

  if (hidden || blockedByModal) return null;

  const consentBlocked = conversationNeedsCurrentConsent(conversation, policy);

  const ensureConversation = async (signal: AbortSignal, epoch: number): Promise<AiConversation> => {
    if (conversation) return conversation;
    const created = await createAiConversation({ mode, consentAccepted: false, signal });
    if (isCurrentLocalRequest(epoch)) syncConversation(created);
    return created;
  };

  async function handleModeChange(nextMode: ChatMode): Promise<void> {
    if (nextMode === mode || creatingMode || sending || consentBusy) return;
    if (!conversation) {
      setMode(nextMode);
      return;
    }
    // The mode is immutable per thread. Selecting another mode starts a new
    // server conversation instead of mutating the existing one.
    setCreatingMode(true);
    invalidateLocalRequests();
    const { controller, epoch } = beginLocalRequest();
    setLoading(true);
    setSending(false);
    setFailure(null);
    retainedAttemptRef.current = null;
    try {
      syncConversation(null);
      setMessages([]);
      setConsentError(null);
      const created = await createAiConversation({ mode: nextMode, consentAccepted: false, signal: controller.signal });
      if (!isCurrentLocalRequest(epoch)) return;
      syncConversation(created);
    } catch (error) {
      if (isCurrentLocalRequest(epoch) && !isAbortError(error)) setFailure(failureFromError(error));
    } finally {
      if (isCurrentLocalRequest(epoch)) {
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
        setCreatingMode(false);
        setLoading(false);
      }
    }
  }
  const handleConsent = async (): Promise<void> => {
    if (!conversation || consentBusy || !conversationNeedsCurrentConsent(conversation, policy)) return;
    const conversationId = conversation.id;
    const { controller, epoch } = beginLocalRequest();
    setConsentBusy(true);
    setConsentError(null);
    try {
      const currentPolicy = await refreshChatPolicy(controller.signal);
      if (!isCurrentLocalRequest(epoch, conversationId)) return;
      const updated = await updateAiConversationConsent(conversationId, currentPolicy.policyVersion, { signal: controller.signal });
      if (!isCurrentLocalRequest(epoch, conversationId)) return;
      syncConversation(updated);
    } catch (error) {
      if (isAbortError(error) || !isCurrentLocalRequest(epoch, conversationId)) return;
      const failure = failureFromError(error);
      setConsentError(error instanceof ApiError && error.code === "CHAT_CONSENT_VERSION_STALE"
        ? "Chính sách đã được cập nhật. Hãy tải lại rồi đồng ý với phiên bản mới."
        : failure.message);
    } finally {
      if (isCurrentLocalRequest(epoch, conversationId)) {
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
        setConsentBusy(false);
      }
    }
  };

  const handleFeedback = async (message: AiChatMessage, rating: FeedbackRating): Promise<void> => {
    if (feedbackBusy || message.role !== "ASSISTANT" || message.status !== "COMPLETED" || !conversation) return;
    setFeedbackBusy(message.id);
    try {
      const current = feedbackRating(message);
      if (current === rating) {
        await deleteAiMessageFeedback(conversation.id, message.id);
        setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback: null } : item));
      } else {
        const feedback = await updateAiMessageFeedback(conversation.id, message.id, rating);
        setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback } : item));
      }
    } catch (error) {
      if (!isAbortError(error)) setFailure(failureFromError(error));
    } finally {
      setFeedbackBusy(null);
    }
  };

  const handleSend = async (content = draft): Promise<void> => {
    const normalized = content.trim();
    if (!isPatient || sending || normalized.length < 2 || normalized.length > MAX_MESSAGE_LENGTH) {
      if (normalized.length > 0) setFailure(inputFailure());
      return;
    }

    const { controller, epoch } = beginLocalRequest();
    setSending(true);
    setFailure(null);
    setLastFailedContent(null);
    let currentConversation: AiConversation | null = null;
    try {
      currentConversation = await ensureConversation(controller.signal, epoch);
      if (!isCurrentLocalRequest(epoch, currentConversation.id)) return;
      if (currentConversation.consentRequired) {
        const currentPolicy = await refreshChatPolicy(controller.signal);
        if (!isCurrentLocalRequest(epoch, currentConversation.id)) return;
        if (!hasCurrentChatConsent(currentConversation, currentPolicy)) {
          setConsentError("Bạn cần đồng ý với phiên bản chính sách hiện tại trước khi gửi tin nhắn.");
          return;
        }
      }
      const retained = retainedAttemptRef.current;
      const key = retained
        && retained.conversationId === currentConversation.id
        && retained.content === normalized
        ? retained.key
        : createIdempotencyKey();
      retainedAttemptRef.current = { conversationId: currentConversation.id, content: normalized, key };
      // Compatibility signature: sendAiConversationMessage(currentConversation.id, normalized, key)
      const exchange = await sendAiConversationMessage(currentConversation.id, normalized, key, { signal: controller.signal });
      if (!isCurrentLocalRequest(epoch, currentConversation.id)) return;
      retainedAttemptRef.current = null;
      setDraft("");
      setMessages((current) => [...current, exchange.userMessage, exchange.assistantMessage].slice(-8));
      const page = await fetchAiConversationMessages(currentConversation.id, null, 12, { signal: controller.signal });
      if (!isCurrentLocalRequest(epoch, currentConversation.id)) return;
      setMessages(page.content.slice(-8));
    } catch (error: unknown) {
      if (isAbortError(error) || !isCurrentLocalRequest(epoch, currentConversation?.id)) return;
      if (error instanceof ApiError && error.status === 401) clearAuthSession();
      if (error instanceof ApiError && ["AI_UNAVAILABLE", "AI_RESPONSE_INVALID", "CHAT_CONTENT_BLOCKED", "CHAT_IDEMPOTENCY_CONFLICT"].includes(error.code ?? "")) {
        retainedAttemptRef.current = null;
      }
      const nextFailure = failureFromError(error);
      setLastFailedContent(nextFailure.retryable ? normalized : null);
      setFailure(nextFailure);
    } finally {
      if (isCurrentLocalRequest(epoch, currentConversation?.id)) {
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
        setSending(false);
      }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void handleSend();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <div className={styles.root} data-testid="floating-health-assistant">
      {open && !hidden ? (
        <section
          aria-describedby="floating-health-assistant-help"
          aria-label="Trợ lý sức khỏe HealthCare"
          aria-modal="true"
          className={styles.panel}
          id="floating-health-assistant-panel"
          ref={panelRef}
          role="dialog"
        >
          <header className={styles.header}>
            <div className={styles.headerTitle}>
              <span className={styles.headerIcon}>
                <Image
                  alt=""
                  aria-hidden="true"
                  className={styles.headerAvatar}
                  height={72}
                  src="/media/assistant/assistant-mascot-neutral-v1.webp"
                  width={72}
                />
              </span>
              <div>
                <strong>Trợ lý HealthCare</strong>
                <span>{isPatient ? "Hỗ trợ thông tin sức khỏe" : "Hỗ trợ tra cứu"}</span>
              </div>
            </div>
            <button aria-label="Đóng trợ lý sức khỏe" className={styles.iconButton} onClick={closeAssistant} title="Đóng" type="button">
              <UiIcon name="x" size={19} />
            </button>
          </header>

          <div aria-label="Chế độ trợ lý" className={styles.modePicker} role="group">
            <span className={styles.modeLegend}>Mục đích cuộc trò chuyện</span>
            <div className={styles.modeOptions}>
              {ASSISTANT_MODE_OPTIONS.map((option) => (
                <button
                  aria-pressed={mode === option.value}
                  className={mode === option.value ? styles.modeOptionActive : styles.modeOption}
                  disabled={creatingMode || sending || consentBusy}
                  key={option.value}
                  onClick={() => void handleModeChange(option.value)}
                  title={option.description}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            {modeLocked ? <span className={styles.modeLockedHint}>Mỗi cuộc trò chuyện giữ một chế độ; chọn mục đích khác sẽ mở cuộc trò chuyện mới.</span> : null}
          </div>

          {!session ? (
            <div className={styles.accessState}>
              <UiIcon name="shield-check" size={30} />
              <h2>Đăng nhập để trò chuyện</h2>
              <p>Chọn mục đích ở trên để xem phạm vi hỗ trợ. Lịch sử chỉ dành cho bệnh nhân đã đăng nhập; không lưu tin nhắn trong trình duyệt.</p>
              <Link className={styles.primaryButton} href="/auth/login?next=%2Fpatient%2Fchat">Đăng nhập</Link>
            </div>
          ) : !isPatient ? (
            <div className={styles.accessState}>
              <UiIcon name="shield-check" size={30} />
              <h2>Trợ lý dành cho bệnh nhân</h2>
              <p>Tài khoản bác sĩ và quản trị viên dùng các công cụ nghiệp vụ riêng trong cổng của mình.</p>
              <Link className={styles.secondaryButton} href="/">Về trang chính</Link>
            </div>
          ) : (
            <>
              {consentBlocked ? (
                <section aria-describedby="floating-assistant-consent-copy" className={styles.consentPanel}>
                  <strong>Xác nhận trước khi trò chuyện</strong>
                  <p id="floating-assistant-consent-copy">Bạn đồng ý lưu cuộc trò chuyện trong 90 ngày để HealthCare hiển thị lịch sử. Trợ lý không chẩn đoán, kê đơn hoặc thay thế bác sĩ; remote AI hiện không được bật ở môi trường này.</p>
                  <button className={styles.primaryButton} disabled={consentBusy} onClick={() => void handleConsent()} type="button">
                    {consentBusy ? "Đang xác nhận..." : "Tôi đồng ý và tiếp tục"}
                  </button>
                  {consentError ? <p aria-live="assertive" className={styles.consentError} role="alert">{consentError}</p> : null}
                </section>
              ) : null}
              <div aria-busy={loading || sending} aria-live="polite" className={styles.thread} ref={messageViewportRef} role="log">
                {loading ? <p className={styles.status} role="status"><UiIcon name="clock" size={15} /> Đang tải lịch sử từ máy chủ...</p> : null}
                {!loading && messages.length === 0 ? (
                  <div className={styles.emptyState}>
                    <UiIcon name="message-square" size={26} />
                    <strong>Bạn cần hỗ trợ điều gì?</strong>
                    <p>Hỏi về chuẩn bị đi khám, chuyên khoa hoặc quy trình đặt lịch.</p>
                  </div>
                ) : null}
                {messages.map((message) => (
                  <article className={`${styles.message} ${message.role === "ASSISTANT" ? styles.assistant : styles.patient}`} key={message.id}>
                    <span className={styles.messageRole}>{message.role === "ASSISTANT" ? "HealthCare" : "Bạn"}</span>
                    <p>{message.content}</p>
                    <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                    {message.role === "ASSISTANT" ? (
                      <>
                        <span className={styles.provenance} data-provenance={message.provenance ?? "local_provider"}>
                          {provenanceLabel(message.provenance ?? "local_provider")}
                        </span>
                        <p className={styles.disclaimer}>{message.disclaimer?.trim() || DEFAULT_DISCLAIMER}</p>
                        {message.safetyAction === "EMERGENCY" ? (
                          <div aria-live="assertive" className={styles.emergencyAction} role="alert">
                            <strong>Đây có thể là tình huống khẩn cấp.</strong>
                            <span>Không chờ trợ lý phản hồi; gọi 115 hoặc đến khoa cấp cứu gần nhất.</span>
                            <a href="tel:115">Gọi 115</a>
                          </div>
                        ) : null}
                        {message.suggestedActions && message.suggestedActions.length > 0 ? (
                          <div className={styles.suggestedActions} aria-label="Bước tiếp theo">
                            {message.suggestedActions.map((action) => (
                              <Link href={action.href} key={`${action.kind}-${action.href}`}>
                                {action.label}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                        {message.status === "COMPLETED" ? (
                          <div className={styles.feedback} aria-label="Đánh giá phản hồi">
                            <span>Phản hồi này hữu ích?</span>
                            {(["HELPFUL", "NOT_HELPFUL"] as const).map((rating) => (
                              <button
                                aria-pressed={feedbackRating(message) === rating}
                                disabled={feedbackBusy === message.id}
                                key={rating}
                                onClick={() => void handleFeedback(message, rating)}
                                type="button"
                              >
                                {rating === "HELPFUL" ? "Hữu ích" : "Chưa hữu ích"}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {message.role === "ASSISTANT" && message.citations.length > 0 ? (
                      <div className={styles.citations}>
                        {message.citations.slice(0, 2).map((citation) => (
                          <span
                            aria-label={`Nguồn tham khảo: ${citation.title}`}
                            key={`${citation.source_type}-${citation.source_id}`}
                          >
                            {citation.title}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
                {sending ? <p className={styles.status} role="status"><UiIcon name="clock" size={15} /> Trợ lý đang xử lý câu hỏi...</p> : null}
              </div>

              {failure ? (
                <div aria-live="assertive" className={styles.failure} data-kind={failure.kind} role="alert">
                  <div className={styles.failureCopy}>
                    <strong>
                      {failure.kind === "unavailable" ? "Trợ lý tạm thời gián đoạn" : failure.kind === "blocked" ? "Không thể xử lý nội dung" : "Chưa thể mở trợ lý"}
                    </strong>
                    <span>{failure.message}</span>
                  </div>
                  {failure.retryable && lastFailedContent ? <button onClick={() => void handleSend(lastFailedContent)} type="button">Thử lại</button> : null}
                </div>
              ) : null}

              {messages.length === 0 && !loading ? (
                <div className={styles.suggestions}>
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button disabled={sending} key={question} onClick={() => void handleSend(question)} type="button">{question}</button>
                  ))}
                </div>
              ) : null}

              <form className={styles.composer} onSubmit={handleSubmit}>
                <label className="sr-only" htmlFor="floating-health-assistant-input">Câu hỏi cho trợ lý sức khỏe</label>
                <textarea
                  aria-describedby="floating-health-assistant-help"
                  disabled={sending || consentBlocked}
                  id="floating-health-assistant-input"
                  maxLength={MAX_MESSAGE_LENGTH}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập câu hỏi của bạn..."
                  ref={inputRef}
                  rows={2}
                  value={draft}
                />
                <button aria-label={sending ? "Đang gửi câu hỏi" : "Gửi câu hỏi"} className={styles.sendButton} disabled={sending || consentBlocked || draft.trim().length < 2} title="Gửi câu hỏi" type="submit">
                  <UiIcon name="send" size={17} />
                </button>
              </form>
              <p className={styles.help} id="floating-health-assistant-help">Không thay thế bác sĩ. Trường hợp cấp cứu, gọi 115 hoặc đến cơ sở y tế gần nhất.</p>
              <Link className={styles.fullChatLink} href="/patient/chat">Mở trợ lý đầy đủ <UiIcon name="arrow-up-right" size={15} /></Link>
            </>
          )}
        </section>
      ) : null}

      <button
        aria-controls="floating-health-assistant-panel"
        aria-expanded={open}
        aria-label={open ? "Đóng trợ lý sức khỏe" : "Mở trợ lý sức khỏe"}
        className={styles.launcher}
        onClick={() => setOpen((current) => !current)}
        ref={launcherRef}
        title="Trợ lý sức khỏe"
        type="button"
      >
        {open ? (
          <UiIcon name="x" size={22} />
        ) : (
          <span aria-hidden="true" className={styles.launcherMascot}>
            <AssistantMark className={styles.launcherMark} size={46} />
          </span>
        )}
        <span className="sr-only">Trợ lý sức khỏe</span>
      </button>
    </div>
  );
}

export default function FloatingHealthAssistant() {
  const pathname = usePathname() ?? "/";
  const session = useAuthSession();
  const stateKey = `${session?.user.id ?? "guest"}:${pathname === "/patient/chat" || pathname.startsWith("/patient/chat/") ? "hidden" : "visible"}`;

  return (
    <AssistantProvider initialMode={DEFAULT_CHAT_MODE}>
      <FloatingHealthAssistantPanel key={stateKey} pathname={pathname} session={session} />
    </AssistantProvider>
  );
}
