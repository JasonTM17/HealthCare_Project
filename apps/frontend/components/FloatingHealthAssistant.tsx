"use client";

import Link from "next/link";
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
  fetchAiConversationMessages,
  fetchAiConversations,
  hasRole,
  sendPublicAiChat,
  updateAiMessageFeedback,
  type AuthSession,
} from "../lib/api-client";
import type {
  AiChatMessage,
  AiChatPolicy,
  AiChatProvenance,
  AiConversation,
  ChatMode,
  FeedbackRating,
} from "../types/hospital";
import {
  ASSISTANT_MODE_OPTIONS,
  assistantFailureFromError as failureFromError,
  type AssistantFailure,
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
const MAX_PUBLIC_MESSAGE_LENGTH = 500;
const DEFAULT_DISCLAIMER = "Thông tin chỉ mang tính tham khảo, không thay thế thăm khám hoặc hướng dẫn của bác sĩ.";
const SUGGESTED_QUESTIONS = [
  "Tôi nên chuẩn bị gì trước khi đi khám?",
  "Tìm chuyên khoa phù hợp với triệu chứng của tôi",
  "Làm sao để đặt lịch khám tại HealthCare?",
];
const PUBLIC_ASSISTANT_OPEN_EVENT = "healthcare:open-assistant";

type PendingUserMessage = {
  content: string;
  createdAt: string;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function inputFailure(isPublic: boolean): AssistantFailure {
  return failureFromError(new ApiError(
    "Tin nhắn không hợp lệ.",
    400,
    isPublic ? "/public/ai/chat" : "/ai/conversations/messages",
    { code: isPublic ? "PUBLIC_CHAT_INPUT_INVALID" : "CHAT_INPUT_INVALID" },
  ));
}

function provenanceLabel(provenance: AiChatProvenance): string {
  switch (provenance) {
    case "local_fallback":
      return "Hỗ trợ tạm thời";
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

function assistantIsHiddenOnPath(pathname: string): boolean {
  // Authentication is a focused, security-sensitive task. Keep the global
  // assistant out of the login/recovery surfaces so it cannot compete with
  // the form or imply that medical questions belong in an auth flow.
  return pathname === "/patient/chat"
    || pathname.startsWith("/patient/chat/")
    || pathname === "/auth"
    || pathname.startsWith("/auth/");
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
    refreshPolicy,
    acceptConversationConsent,
    resetSendAttempt,
    sendMessage,
  } = assistant;
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<PendingUserMessage | null>(null);
  const [failure, setFailure] = useState<AssistantFailure | null>(null);
  const [lastFailedContent, setLastFailedContent] = useState<string | null>(null);
  const [blockedByModal, setBlockedByModal] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const [creatingMode, setCreatingMode] = useState(false);
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
  const hidden = assistantIsHiddenOnPath(pathname) || Boolean(session && !isPatient);

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
    setStreamingReply("");
    setPendingUserMessage(null);
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
    const nextPolicy = await refreshPolicy(signal);
    if (policyEpochRef.current === policyEpoch && !signal?.aborted) setPolicy(nextPolicy);
    return nextPolicy;
  }, [refreshPolicy, setPolicy]);

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
      if (externalModal && open) closeAssistant();
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
  }, [closeAssistant, open]);

  useEffect(() => {
    const handlePublicOpen = (event: Event): void => {
      if (hidden) return;
      const nextMode = (event as CustomEvent<{ mode?: ChatMode }>).detail?.mode;
      const requestedMode: ChatMode = isPatient && nextMode === "SYMPTOM_TRIAGE"
        ? nextMode
        : "HOSPITAL_SUPPORT";
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
  }, [conversation, hidden, isPatient, setMode]);

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
    void refreshPolicy(controller.signal)
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
  }, [hidden, isPatient, open, refreshPolicy, setPolicy]);

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
    if (!isPatient && nextMode !== "HOSPITAL_SUPPORT") return;
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
      const updated = await acceptConversationConsent(conversationId, currentPolicy.policyVersion, controller.signal);
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
    const inputLimit = isPatient ? MAX_MESSAGE_LENGTH : MAX_PUBLIC_MESSAGE_LENGTH;
    if (sending || normalized.length < 2 || normalized.length > inputLimit) {
      if (normalized.length > 0) setFailure(inputFailure(!isPatient));
      return;
    }

    const { controller, epoch } = beginLocalRequest();
    const pendingCreatedAt = new Date().toISOString();
    setSending(true);
    setStreamingReply("");
    setPendingUserMessage({ content: normalized, createdAt: pendingCreatedAt });
    setFailure(null);
    setLastFailedContent(null);
    let currentConversation: AiConversation | null = null;
    try {
      if (!isPatient) {
        const recentTurns = messages.slice(-6).map((message) => ({
          role: message.role === "USER" ? "user" as const : "assistant" as const,
          content: message.content,
        }));
        const reply = await sendPublicAiChat(normalized, recentTurns, { signal: controller.signal });
        if (!isCurrentLocalRequest(epoch)) return;
        const createdAt = pendingCreatedAt;
        const sequence = messages.reduce((maximum, message) => Math.max(maximum, message.sequence), 0) + 1;
        const userMessage: AiChatMessage = {
          id: crypto.randomUUID(),
          role: "USER",
          status: "COMPLETED",
          content: normalized,
          sequence,
          citations: [],
          createdAt,
          completedAt: createdAt,
        };
        const assistantMessage: AiChatMessage = {
          id: crypto.randomUUID(),
          role: "ASSISTANT",
          status: "COMPLETED",
          content: reply.answer,
          sequence: sequence + 1,
          disclaimer: reply.disclaimer,
          provenance: reply.provenance,
          citations: reply.citations,
          safetyAction: reply.safetyAction,
          createdAt,
          completedAt: createdAt,
        };
        setDraft("");
        setPendingUserMessage(null);
        setMessages((current) => [...current, userMessage, assistantMessage].slice(-8));
        return;
      }
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
      const exchange = await sendMessage(currentConversation.id, normalized, {
        attemptId: "composer",
        signal: controller.signal,
        onDelta: (delta) => {
          if (isCurrentLocalRequest(epoch, currentConversation?.id)) {
            setStreamingReply((current) => current + delta);
          }
        },
      });
      if (!isCurrentLocalRequest(epoch, currentConversation.id)) return;
      setDraft("");
      setPendingUserMessage(null);
      setMessages((current) => [...current, exchange.userMessage, exchange.assistantMessage].slice(-8));
      const page = await fetchAiConversationMessages(currentConversation.id, null, 12, { signal: controller.signal });
      if (!isCurrentLocalRequest(epoch, currentConversation.id)) return;
      setMessages(page.content.slice(-8));
    } catch (error: unknown) {
      if (isAbortError(error) || !isCurrentLocalRequest(epoch, currentConversation?.id)) return;
      if (error instanceof ApiError && error.status === 401) clearAuthSession();
      const nextFailure = failureFromError(error);
      setLastFailedContent(nextFailure.retryable ? normalized : null);
      setFailure(nextFailure);
    } finally {
      if (isCurrentLocalRequest(epoch, currentConversation?.id)) {
        setStreamingReply("");
        setPendingUserMessage(null);
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
    <div
      className={`${styles.root}${isPatient ? ` ${styles.rootPatient}` : ""}`}
      data-page={pathname}
      data-testid="floating-health-assistant"
    >
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
                <AssistantMark className={styles.headerAvatar} size={32} />
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

          {isPatient ? (
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
          ) : (
            <p className={styles.modeLockedHint}>
              Bạn đang dùng chế độ khách: câu hỏi không được lưu vào lịch sử.
              {!session ? (
                <> Để lưu và xem lại hội thoại, <Link href="/auth/login?next=%2Fpatient%2Fchat">đăng nhập</Link>.</>
              ) : null}
            </p>
          )}

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
                {!loading && messages.length === 0 && !pendingUserMessage && !sending ? (
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
                        {message.disclaimer && message.disclaimer.trim() && message.disclaimer.trim() !== DEFAULT_DISCLAIMER ? (
                          <p className={styles.disclaimer}>{message.disclaimer.trim()}</p>
                        ) : null}
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
                        {isPatient && message.status === "COMPLETED" ? (
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
                        {message.citations.map((citation) => (
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
                {pendingUserMessage ? (
                  <article className={`${styles.message} ${styles.patient} ${styles.pendingMessage}`} data-testid="floating-chat-pending-user">
                    <span className={styles.messageRole}>Bạn</span>
                    <p>{pendingUserMessage.content}</p>
                    <time dateTime={pendingUserMessage.createdAt}>{formatTime(pendingUserMessage.createdAt)}</time>
                  </article>
                ) : null}
                {streamingReply ? (
                  <article className={`${styles.message} ${styles.assistant}`} data-testid="floating-chat-streaming-reply">
                    <span className={styles.messageRole}>HealthCare</span>
                    <p>{streamingReply}</p>
                    <span className={styles.provenance}>Đang nhận phản hồi theo từng phần…</span>
                  </article>
                ) : null}
                {sending && !streamingReply ? (
                  <article
                    aria-label="Trợ lý đang suy nghĩ"
                    className={`${styles.message} ${styles.assistant} ${styles.thinkingMessage}`}
                    data-testid="floating-chat-thinking"
                    role="status"
                  >
                    <span className={styles.messageRole}>HealthCare</span>
                    <p className={styles.thinkingLine}>
                      <span>Đang suy nghĩ</span>
                      <span aria-hidden="true" className={styles.typingDots}>
                        <span />
                        <span />
                        <span />
                      </span>
                    </p>
                  </article>
                ) : null}
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
                  maxLength={isPatient ? MAX_MESSAGE_LENGTH : MAX_PUBLIC_MESSAGE_LENGTH}
                  onChange={(event) => {
                    if (conversationIdRef.current) resetSendAttempt(conversationIdRef.current);
                    setDraft(event.target.value);
                  }}
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
              {isPatient ? (
                <Link className={styles.fullChatLink} href="/patient/chat">Mở trợ lý đầy đủ <UiIcon name="arrow-up-right" size={15} /></Link>
              ) : null}
          </>
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
  const stateKey = `${session?.user.id ?? "guest"}:${assistantIsHiddenOnPath(pathname) ? "hidden" : "visible"}`;

  return (
    <AssistantProvider initialMode={DEFAULT_CHAT_MODE}>
      <FloatingHealthAssistantPanel key={stateKey} pathname={pathname} session={session} />
    </AssistantProvider>
  );
}
