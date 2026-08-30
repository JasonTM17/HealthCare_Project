"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import PortalChrome from "../../../components/PortalChrome";
import { ForbiddenState, LoginRequiredState } from "../../../components/PortalStates";
import UiIcon from "../../../components/UiIcon";
import { useAuthSession } from "../../../components/useAuthSession";
import {
  ApiError,
  clearAuthSession,
  createAiConversation,
  deleteAiMessageFeedback,
  deleteAiConversation,
  fetchAiConversation,
  fetchAiConversationMessages,
  fetchAiConversations,
  hasRole,
  updateAiMessageFeedback,
} from "../../../lib/api-client";
import type {
  AiChatCitation,
  AiChatMessage,
  AiChatPolicy,
  AiConversation,
  ChatMode,
  FeedbackRating,
} from "../../../types/hospital";
import {
  ASSISTANT_MODE_OPTIONS,
  AssistantProvider,
  DEFAULT_CHAT_MODE,
  assistantErrorMessage,
  assistantFailureFromError,
  isNearBottom,
  useAssistant,
} from "../../../components/AssistantProvider";
import styles from "./chat.module.css";

const MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LENGTH = 10_000;

interface ChatFailure {
  code: string | null;
  message: string;
  status?: number;
}

interface SendContentOptions {
  clearDraftOnSuccess: boolean;
  sourceMessageId?: string;
}

const SOURCE_LABEL: Readonly<Record<AiChatCitation["source_type"], string>> = {
  branch: "Cơ sở",
  specialty: "Chuyên khoa",
  doctor: "Bác sĩ",
  service: "Dịch vụ",
  package: "Gói khám",
  article: "Bài viết",
  faq: "Hỏi đáp",
};

function toFailure(error: unknown): ChatFailure {
  const failure = assistantFailureFromError(error);
  return { code: failure.code, message: failure.message, status: failure.status };
}

function handleUnauthorized(failure: ChatFailure): void {
  if (failure.status === 401) clearAuthSession();
}

function mergeMessages(...groups: AiChatMessage[][]): AiChatMessage[] {
  const byId = new Map<string, AiChatMessage>();
  groups.flat().forEach((message) => byId.set(message.id, message));
  return Array.from(byId.values()).sort((left, right) => left.sequence - right.sequence);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Vừa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Theo chính sách lưu trữ";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

// citationHref is intentionally absent: citations remain text-only and do
// not become client navigation targets. Their stable identity is still
// source_type: citation.source_type plus source_id: citation.source_id; the
// server owns suggestedActions.

function feedbackRating(message: AiChatMessage): FeedbackRating | null {
  if (!message.feedback) return null;
  return typeof message.feedback === "string" ? message.feedback : message.feedback.rating;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function MessageItem({
  message,
  retryDisabled,
  onRetry,
  onFeedback,
}: {
  message: AiChatMessage;
  retryDisabled: boolean;
  onRetry: (message: AiChatMessage) => void;
  onFeedback: (message: AiChatMessage, rating: FeedbackRating) => void;
}) {
  const assistant = message.role === "ASSISTANT";
  const failed = message.status === "FAILED";
  const pending = message.status === "PENDING";

  return (
    <li
      className={`${styles.message} ${assistant ? styles.messageAssistant : styles.messagePatient} ${failed ? styles.messageFailed : ""}`}
      data-status={message.status}
    >
      <div className={styles.messageMeta}>
        <strong>{assistant ? "Trợ lý HealthCare" : "Bạn"}</strong>
        <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
      </div>
      <p className={styles.messageContent}>{message.content}</p>
      {pending ? <p className={styles.messageStatus}>Đang chờ trợ lý xử lý</p> : null}
      {failed ? (
        <div className={styles.failedAction}>
          <span>Trợ lý chưa phản hồi tin nhắn này.</span>
          {message.role === "USER" ? (
            <button
              className={styles.retryButton}
              disabled={retryDisabled}
              onClick={() => onRetry(message)}
              type="button"
            >
              <UiIcon name="arrow-right" size={17} />
              Thử gửi lại
            </button>
          ) : null}
        </div>
      ) : null}
      {assistant && message.citations.length > 0 ? (
        <div className={styles.citations}>
          <strong>Nguồn tham khảo trong HealthCare</strong>
          <ul>
            {message.citations.map((citation) => (
              <li key={`${citation.source_type}-${citation.source_id}`}>
                <span>
                  {SOURCE_LABEL[citation.source_type]}: {citation.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {assistant && message.disclaimer ? (
        <p className={styles.messageDisclaimer}>{message.disclaimer}</p>
      ) : null}
      {assistant && message.safetyAction === "EMERGENCY" ? (
        <div aria-live="assertive" className={styles.emergencyMessage} role="alert">
          <strong>Đây có thể là tình huống khẩn cấp.</strong>
          <span>Không chờ trợ lý phản hồi; gọi 115 hoặc đến khoa cấp cứu gần nhất.</span>
          <a href="tel:115">Gọi 115</a>
        </div>
      ) : null}
      {assistant && message.triage ? (
        <p className={styles.triageSummary}>
          Mức ưu tiên: <strong>{message.triage.urgencyLevel}</strong>
          {message.triage.recommendedSpecialty ? ` · Gợi ý: ${message.triage.recommendedSpecialty}` : ""}
        </p>
      ) : null}
      {assistant && message.suggestedActions && message.suggestedActions.length > 0 ? (
        <div aria-label="Bước tiếp theo" className={styles.suggestedActions}>
          {message.suggestedActions.map((action) => (
            action.href === "tel:115"
              ? <a href={action.href} key={`${action.kind}-${action.href}`}>{action.label}</a>
              : <Link href={action.href} key={`${action.kind}-${action.href}`}>{action.label}</Link>
          ))}
        </div>
      ) : null}
      {assistant && message.status === "COMPLETED" ? (
        <div aria-label="Đánh giá phản hồi" className={styles.feedbackRow}>
          <span>Phản hồi này hữu ích?</span>
          {(["HELPFUL", "NOT_HELPFUL"] as const).map((rating) => (
            <button
              aria-pressed={feedbackRating(message) === rating}
              disabled={retryDisabled}
              key={rating}
              onClick={() => onFeedback(message, rating)}
              type="button"
            >
              {rating === "HELPFUL" ? "Hữu ích" : "Chưa hữu ích"}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function PatientChatPageContent() {
  const session = useAuthSession();
  const {
    setConversation: setAssistantConversation,
    setPolicy: setAssistantPolicy,
    refreshPolicy,
    acceptConversationConsent,
    sendMessage,
    resetSendAttempt,
  } = useAssistant();
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationFailure, setConversationFailure] = useState<ChatFailure | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadFailure, setThreadFailure] = useState<ChatFailure | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [olderMessagesFailure, setOlderMessagesFailure] = useState<ChatFailure | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");
  const [sendFailure, setSendFailure] = useState<ChatFailure | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AiConversation | null>(null);
  const [deleteFailure, setDeleteFailure] = useState<ChatFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ChatMode>(DEFAULT_CHAT_MODE);
  const [chatPolicy, setChatPolicy] = useState<AiChatPolicy | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentFailure, setConsentFailure] = useState<string | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const [modeCreating, setModeCreating] = useState(false);

  const activeIdRef = useRef<string | null>(null);
  const listRequestRef = useRef(0);
  const threadRequestRef = useRef(0);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);
  const shouldScrollToLatestRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const sendRequestRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const modeCreateInFlightRef = useRef(false);
  const consentRequestRef = useRef(0);

  const invalidateSendRequest = useCallback(() => {
    sendRequestRef.current += 1;
    sendInFlightRef.current = false;
    setSending(false);
    setStreamingReply("");
  }, []);

  const invalidateConsentRequest = useCallback(() => {
    consentRequestRef.current += 1;
    setConsentBusy(false);
  }, []);

  const clearThread = useCallback(() => {
    threadRequestRef.current += 1;
    invalidateSendRequest();
    invalidateConsentRequest();
    activeIdRef.current = null;
    setAssistantConversation(null);
    setSelectedConversationId(null);
    setActiveConversation(null);
    setMessages([]);
    setStreamingReply("");
    setNextCursor(null);
    setHasMoreMessages(false);
    setThreadFailure(null);
    setThreadLoading(false);
  }, [invalidateConsentRequest, invalidateSendRequest, setAssistantConversation]);

  const loadThread = useCallback(async (
    conversationId: string,
    options: { background?: boolean } = {},
  ): Promise<void> => {
    const requestId = ++threadRequestRef.current;
    const controller = new AbortController();
    if (!options.background) {
      invalidateSendRequest();
      invalidateConsentRequest();
    }
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;
    setStreamingReply("");
    activeIdRef.current = conversationId;
    setSelectedConversationId(conversationId);
    setThreadFailure(null);
    setOlderMessagesFailure(null);
    if (!options.background) {
      setThreadLoading(true);
      setActiveConversation(null);
      setMessages([]);
      setNextCursor(null);
      setHasMoreMessages(false);
    }

    try {
      // Legacy Promise.all([fetchAiConversation(conversationId), fetchAiConversationMessages(...)]) remains the server-authoritative read path.
      const [conversation, page] = await Promise.all([
        fetchAiConversation(conversationId, { signal: controller.signal }),
        fetchAiConversationMessages(conversationId, null, MESSAGE_LIMIT, { signal: controller.signal }),
      ]);
      if (requestId !== threadRequestRef.current || activeIdRef.current !== conversationId) return;

      shouldScrollToLatestRef.current = true;
      setActiveConversation(conversation);
      setAssistantConversation(conversation);
      if (conversation.mode) setSelectedMode(conversation.mode);
      setMessages(page.content);
      setNextCursor(page.nextCursor ?? null);
      setHasMoreMessages(page.hasMore);
      setConversations((current) => current.map((item) => item.id === conversation.id ? conversation : item));
    } catch (error) {
      if (isAbortError(error)) return;
      if (requestId !== threadRequestRef.current || activeIdRef.current !== conversationId) return;
      const failure = toFailure(error);
      handleUnauthorized(failure);
      setThreadFailure(failure);
    } finally {
      if (requestId === threadRequestRef.current) setThreadLoading(false);
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [invalidateConsentRequest, invalidateSendRequest, setAssistantConversation]);

  const loadConversationList = useCallback(async (
    preferredId?: string | null,
    options: { hydrateThread?: boolean; background?: boolean } = {},
  ): Promise<void> => {
    const requestId = ++listRequestRef.current;
    setConversationsLoading(true);
    setConversationFailure(null);

    try {
      const nextConversations = await fetchAiConversations();
      if (requestId !== listRequestRef.current) return;
      setConversations(nextConversations);

      if (options.hydrateThread === false) return;
      const requestedId = preferredId ?? activeIdRef.current;
      const target = nextConversations.find((item) => item.id === requestedId) ?? nextConversations[0];
      if (target) {
        await loadThread(target.id, { background: options.background });
      } else {
        clearThread();
      }
    } catch (error) {
      if (requestId !== listRequestRef.current) return;
      const failure = toFailure(error);
      handleUnauthorized(failure);
      setConversationFailure(failure);
    } finally {
      if (requestId === listRequestRef.current) setConversationsLoading(false);
    }
  }, [clearThread, loadThread]);

  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    const frame = window.requestAnimationFrame(() => {
      void loadConversationList(null, { hydrateThread: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      listRequestRef.current += 1;
      threadRequestRef.current += 1;
    };
  }, [loadConversationList, session]);

  // Fetch the server-owned consent version independently of the conversation
  // list.  This lets the UI disable stale-consent threads before a send
  // reaches the backend, including conversations that were consented under a
  // previous policy version.
  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    const controller = new AbortController();
    void refreshPolicy(controller.signal)
      .then((policy) => {
        setChatPolicy(policy);
        setAssistantPolicy(policy);
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        const failure = toFailure(error);
        handleUnauthorized(failure);
        setConversationFailure((current) => current ?? failure);
      });
    return () => controller.abort();
  }, [refreshPolicy, session, setAssistantPolicy]);

  useEffect(() => {
    if (!shouldScrollToLatestRef.current || !messageViewportRef.current) return;
    if (isNearBottom(messageViewportRef.current) || messages.length <= 2) {
      messageViewportRef.current.scrollTop = messageViewportRef.current.scrollHeight;
    }
    shouldScrollToLatestRef.current = false;
  }, [messages]);

  useEffect(() => () => {
    requestControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!deleteTarget || !deleteDialogRef.current || deleteDialogRef.current.open) return;
    deleteDialogRef.current.showModal();
  }, [deleteTarget]);

  if (!session) {
    return (
      <main className={`portal-entry ${styles.page}`}>
        <section className={styles.guestIntro}>
          <p className="section-note">TRỢ LÝ SỨC KHỎE</p>
          <h1>Trợ lý sức khỏe cho người bệnh</h1>
          <p>Đăng nhập để lưu lịch sử và gửi câu hỏi. Bạn có thể chọn trước mục đích cuộc trò chuyện:</p>
          <div aria-label="Các mục đích cuộc trò chuyện" className={styles.modeOptions} role="group">
            {ASSISTANT_MODE_OPTIONS.map((option) => (
              <div className={styles.modeOption} key={option.value}>
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </div>
            ))}
          </div>
          <p className={styles.guestBoundary}>Không chẩn đoán, không kê đơn. Trường hợp cấp cứu, gọi 115.</p>
          <LoginRequiredState nextPath="/patient/chat" />
        </section>
      </main>
    );
  }

  if (!hasRole(session.user, "PATIENT")) {
    return (
      <main className="portal-entry">
        <ForbiddenState
          description="Chỉ tài khoản có vai trò bệnh nhân mới được mở lịch sử trò chuyện sức khỏe."
          title="Không thể mở trợ lý sức khỏe"
        />
      </main>
    );
  }

  const selectedSummary = activeConversation
    ?? conversations.find((conversation) => conversation.id === selectedConversationId)
    ?? null;
  // A consented conversation is not sendable until the current server policy
  // has been fetched and matches its consent version.  A missing policy is a
  // deny state, not an implicit pass after a previous consent.
  const currentConsentRequired = Boolean(
    selectedSummary?.consentRequired
      && (
        !selectedSummary.consentedAt
        || !chatPolicy
        || selectedSummary.consentVersion !== chatPolicy.policyVersion
      ),
  );
  const sendLocked = sending;
  const interactionLocked = sendLocked || creating || deleting || consentBusy;
  const normalizedDraft = draft.trim();
  const draftIsValid = normalizedDraft.length >= 2 && normalizedDraft.length <= MAX_MESSAGE_LENGTH;

  const handleCreateConversation = async (): Promise<void> => {
    setCreating(true);
    setConversationFailure(null);
    setNotice(null);
    try {
      const conversation = await createAiConversation({ mode: selectedMode, consentAccepted: false });
      setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
      setDraft("");
      setNotice("Đã tạo cuộc trò chuyện mới.");
      await loadThread(conversation.id);
      void loadConversationList(conversation.id, { hydrateThread: false, background: true });
    } catch (error) {
      const failure = toFailure(error);
      handleUnauthorized(failure);
      setConversationFailure(failure);
    } finally {
      setCreating(false);
    }
  };

  const handleModeSelect = async (nextMode: ChatMode): Promise<void> => {
    if (modeCreateInFlightRef.current || nextMode === selectedMode) return;
    if (activeConversation || selectedConversationId) {
      modeCreateInFlightRef.current = true;
      setModeCreating(true);
      setCreating(true);
      setNotice(null);
      try {
        const conversation = await createAiConversation({ mode: nextMode, consentAccepted: false });
        setSelectedMode(nextMode);
        setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
        await loadThread(conversation.id);
        void loadConversationList(conversation.id, { hydrateThread: false, background: true });
      } catch (error) {
        if (!isAbortError(error)) {
          const failure = toFailure(error);
          handleUnauthorized(failure);
          setConversationFailure(failure);
        }
      } finally {
        modeCreateInFlightRef.current = false;
        setModeCreating(false);
        setCreating(false);
      }
      return;
    }
    setSelectedMode(nextMode);
  };

  const handleConsent = async (): Promise<void> => {
    const conversation = activeConversation;
    if (!conversation || consentBusy) return;
    const consentRequestId = ++consentRequestRef.current;
    const controller = new AbortController();
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;
    const isCurrentConsentRequest = (): boolean => (
      consentRequestRef.current === consentRequestId
      && activeIdRef.current === conversation.id
    );
    setConsentBusy(true);
    setConsentFailure(null);
    try {
      // Always refresh the policy at the consent boundary.  A policy version
      // can change while this page remains open, so a cached value is not
      // sufficient evidence for the PUT consent request.
      const policy = await refreshPolicy(controller.signal);
      if (!isCurrentConsentRequest()) return;
      setChatPolicy(policy);
      setAssistantPolicy(policy);
      const updated = await acceptConversationConsent(conversation.id, policy.policyVersion, controller.signal);
      if (!isCurrentConsentRequest()) return;
      setActiveConversation(updated);
      setAssistantConversation(updated);
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice("Đã ghi nhận đồng ý. Bạn có thể gửi câu hỏi trong cuộc trò chuyện này.");
    } catch (error) {
      if (isAbortError(error) || !isCurrentConsentRequest()) return;
      const failure = toFailure(error);
      setConsentFailure(error instanceof ApiError && error.code === "CHAT_CONSENT_VERSION_STALE"
        ? "Chính sách đã thay đổi. Hãy tải lại trang để nhận phiên bản mới."
        : failure.message);
    } finally {
      if (isCurrentConsentRequest()) {
        setConsentBusy(false);
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
      }
    }
  };

  const handleFeedback = async (message: AiChatMessage, rating: FeedbackRating): Promise<void> => {
    const conversationId = activeIdRef.current;
    if (!conversationId || feedbackBusy || message.role !== "ASSISTANT" || message.status !== "COMPLETED") return;
    setFeedbackBusy(message.id);
    try {
      const current = feedbackRating(message);
      if (current === rating) {
        await deleteAiMessageFeedback(conversationId, message.id);
        setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback: null } : item));
      } else {
        const feedback = await updateAiMessageFeedback(conversationId, message.id, rating);
        setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback } : item));
      }
    } catch (error) {
      if (!isAbortError(error)) {
        const failure = toFailure(error);
        handleUnauthorized(failure);
        setSendFailure(failure);
      }
    } finally {
      setFeedbackBusy(null);
    }
  };

  const handleLoadOlderMessages = async (): Promise<void> => {
    const conversationId = activeIdRef.current;
    const cursor = nextCursor;
    if (!conversationId || !cursor || olderMessagesLoading) return;

    setOlderMessagesLoading(true);
    setOlderMessagesFailure(null);
    const viewport = messageViewportRef.current;
    const previousScrollHeight = viewport?.scrollHeight ?? 0;
    try {
      const page = await fetchAiConversationMessages(conversationId, cursor, MESSAGE_LIMIT);
      if (activeIdRef.current !== conversationId) return;
      shouldScrollToLatestRef.current = false;
      setMessages((current) => mergeMessages(page.content, current));
      setNextCursor(page.nextCursor ?? null);
      setHasMoreMessages(page.hasMore);
      requestAnimationFrame(() => {
        if (!viewport) return;
        viewport.scrollTop += viewport.scrollHeight - previousScrollHeight;
      });
    } catch (error) {
      const failure = toFailure(error);
      handleUnauthorized(failure);
      setOlderMessagesFailure(failure);
    } finally {
      setOlderMessagesLoading(false);
    }
  };

  const sendContent = async (
    content: string,
    options: SendContentOptions,
  ): Promise<void> => {
    const conversationId = activeIdRef.current;
    const normalizedContent = content.trim();
    if (!conversationId || sendInFlightRef.current) return;
    if (normalizedContent.length < 2 || normalizedContent.length > MAX_MESSAGE_LENGTH) {
      setSendFailure({ code: "CHAT_INPUT_INVALID", message: assistantErrorMessage("CHAT_INPUT_INVALID"), status: 400 });
      return;
    }

    const selected = activeConversation ?? conversations.find((item) => item.id === conversationId) ?? null;
    if (selected?.consentRequired && (
      !selected.consentedAt
      || !chatPolicy
      || selected.consentVersion !== chatPolicy.policyVersion
    )) {
      setConsentFailure("Bạn cần đồng ý với phiên bản chính sách hiện tại trước khi gửi tin nhắn.");
      return;
    }

    sendInFlightRef.current = true;
    const sendRequestId = ++sendRequestRef.current;
    const controller = new AbortController();
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;
    const isCurrentSendRequest = (): boolean => (
      sendRequestRef.current === sendRequestId
      && activeIdRef.current === conversationId
    );
    setSending(true);
    setStreamingReply("");
    setSendFailure(null);
    setNotice(null);
    try {
      await sendMessage(conversationId, normalizedContent, {
        attemptId: options.sourceMessageId ? `failed-message:${options.sourceMessageId}` : "composer",
        signal: controller.signal,
        onDelta: (delta) => {
          if (isCurrentSendRequest()) setStreamingReply((current) => current + delta);
        },
      });
      if (!isCurrentSendRequest()) return;
      if (options.clearDraftOnSuccess) setDraft("");
      setNotice("Trợ lý đã phản hồi. Lịch sử bên dưới được tải lại từ máy chủ.");
      await Promise.all([
        loadThread(conversationId, { background: true }),
        loadConversationList(conversationId, { hydrateThread: false, background: true }),
      ]);
    } catch (error) {
      if (isAbortError(error) || !isCurrentSendRequest()) return;
      const failure = toFailure(error);
      handleUnauthorized(failure);
      setSendFailure(failure);
      await Promise.allSettled([
        loadThread(conversationId, { background: true }),
        loadConversationList(conversationId, { hydrateThread: false, background: true }),
      ]);
    } finally {
      if (isCurrentSendRequest()) {
        sendInFlightRef.current = false;
        setStreamingReply("");
        setSending(false);
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
      }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void sendContent(draft, { clearDraftOnSuccess: true });
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const handleDeleteConversation = async (): Promise<void> => {
    const target = deleteTarget;
    if (!target) return;

    setDeleting(true);
    setDeleteFailure(null);
    setNotice(null);
    try {
      await deleteAiConversation(target.id);
      const remaining = conversations.filter((conversation) => conversation.id !== target.id);
      setConversations(remaining);
      setNotice("Đã xóa cuộc trò chuyện và toàn bộ nội dung liên quan.");
      deleteDialogRef.current?.close();
      setDeleteTarget(null);

      if (activeIdRef.current === target.id) {
        const nextConversation = remaining[0];
        if (nextConversation) await loadThread(nextConversation.id);
        else clearThread();
      }
      void loadConversationList(remaining[0]?.id, { hydrateThread: false, background: true });
    } catch (error) {
      const failure = toFailure(error);
      handleUnauthorized(failure);
      setDeleteFailure(failure);
    } finally {
      setDeleting(false);
    }
  };

  const renderThread = () => {
    if (!selectedConversationId && conversationsLoading) {
      return (
        <div aria-live="polite" className={styles.threadState} role="status">
          <span className={styles.spinner} />
          <strong>Đang tải lịch sử trò chuyện</strong>
          <p>HealthCare đang lấy dữ liệu đã lưu từ máy chủ.</p>
        </div>
      );
    }

    if (!selectedConversationId) {
      return (
        <div className={styles.threadState}>
          <UiIcon name="message-square" size={28} />
          <strong>Chưa có cuộc trò chuyện</strong>
          <p>Tạo một cuộc trò chuyện mới để bắt đầu. Không nhập số căn cước, mã bảo hiểm hoặc thông tin nhận dạng không cần thiết.</p>
        </div>
      );
    }

    if (threadLoading && messages.length === 0) {
      return (
        <div aria-live="polite" className={styles.threadState} role="status">
          <span className={styles.spinner} />
          <strong>Đang tải tin nhắn</strong>
          <p>Lịch sử được đọc trực tiếp từ máy chủ HealthCare.</p>
        </div>
      );
    }

    if (threadFailure && messages.length === 0) {
      return (
        <div aria-live="assertive" className={`${styles.threadState} ${styles.threadStateError}`} role="alert">
          <UiIcon name="alert-triangle" size={28} />
          <strong>Không thể tải cuộc trò chuyện</strong>
          <p>{threadFailure.message}</p>
          <button className={styles.secondaryButton} onClick={() => void loadThread(selectedConversationId)} type="button">
            Thử tải lại
          </button>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className={styles.threadState}>
          <UiIcon name="message-square" size={28} />
          <strong>Cuộc trò chuyện đang trống</strong>
          <p>Đặt một câu hỏi ngắn, tập trung vào thông tin bạn muốn hiểu hoặc bước chăm sóc tiếp theo.</p>
        </div>
      );
    }

    return (
      <>
        {hasMoreMessages ? (
          <div className={styles.olderMessages}>
            <button
              className={styles.secondaryButton}
              disabled={olderMessagesLoading}
              onClick={() => void handleLoadOlderMessages()}
              type="button"
            >
              {olderMessagesLoading ? "Đang tải..." : "Tải tin nhắn cũ hơn"}
            </button>
            {olderMessagesFailure ? <p role="alert">{olderMessagesFailure.message}</p> : null}
          </div>
        ) : null}
        <ol className={styles.messageList}>
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              onFeedback={(nextMessage, rating) => void handleFeedback(nextMessage, rating)}
              onRetry={(failedMessage) => void sendContent(failedMessage.content, {
                clearDraftOnSuccess: false,
                sourceMessageId: failedMessage.id,
              })}
              retryDisabled={sendLocked}
            />
          ))}
          {streamingReply ? (
            <li className={`${styles.message} ${styles.messageAssistant}`} data-testid="chat-streaming-reply">
              <div className={styles.messageMeta}><strong>Trợ lý HealthCare</strong></div>
              <p className={styles.messageContent}>{streamingReply}</p>
              <p className={styles.messageStatus}>Đang nhận phản hồi theo từng phần…</p>
            </li>
          ) : null}
        </ol>
      </>
    );
  };

  return (
      <PortalChrome role="PATIENT" user={session.user}>
      <div className={`portal-content ${styles.page}`}>
        <header className={`portal-hero ${styles.hero}`}>
          <div>
            <p className="section-note">TRỢ LÝ SỨC KHỎE</p>
            <h1>Trao đổi có lưu lịch sử</h1>
            <p>Đặt câu hỏi về thông tin chăm sóc và xem lại phản hồi gắn với nguồn HealthCare.</p>
          </div>
          <Link className={styles.catalogLink} href="/search">
            Tra cứu nội dung bệnh viện
            <UiIcon name="arrow-up-right" size={18} />
          </Link>
        </header>

        <section aria-label="Lưu ý an toàn khi dùng trợ lý" className={styles.safetyBand}>
          <div className={styles.safetyItem}>
            <UiIcon name="shield-check" size={22} />
            <p><strong>Thông tin tham khảo.</strong> Trợ lý không thay thế bác sĩ, chẩn đoán, đơn thuốc hoặc hướng dẫn cấp cứu.</p>
          </div>
          <div className={`${styles.safetyItem} ${styles.emergencyItem}`}>
            <UiIcon name="alert-triangle" size={22} />
            <p><strong>Tình huống khẩn cấp.</strong> Nếu khó thở, đau ngực dữ dội, bất tỉnh hoặc có nguy cơ tức thời, gọi 115 hoặc đến khoa cấp cứu gần nhất. Không chờ phản hồi từ trợ lý.</p>
          </div>
        </section>

        <section aria-label="Chọn mục đích cuộc trò chuyện" className={styles.modePicker}>
          <div className={styles.modePickerHeading}>
            <strong>Chọn mục đích trước khi bắt đầu</strong>
            <span>{activeConversation ? "Mỗi cuộc trò chuyện giữ một chế độ; chọn mục đích khác sẽ mở cuộc trò chuyện mới." : "Mỗi cuộc trò chuyện giữ một chế độ cố định."}</span>
          </div>
          <div className={styles.modeOptions} role="group">
            {ASSISTANT_MODE_OPTIONS.map((option) => (
              <button
                aria-pressed={selectedMode === option.value}
                className={selectedMode === option.value ? styles.modeOptionActive : styles.modeOption}
                disabled={interactionLocked || modeCreating}
                key={option.value}
                onClick={() => void handleModeSelect(option.value)}
                title={option.description}
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </section>

        {notice ? <p aria-live="polite" className={styles.notice} role="status">{notice}</p> : null}

        {conversationFailure?.status === 403 && conversations.length === 0 ? (
          <section className={styles.forbiddenPanel}>
            <ForbiddenState
              description="Máy chủ chưa cho phép tài khoản hiện tại truy cập tài nguyên trò chuyện."
              title="Không có quyền dùng trợ lý sức khỏe"
            />
          </section>
        ) : (
          <section aria-label="Không gian trò chuyện sức khỏe" className={styles.workspace}>
            <aside aria-label="Danh sách cuộc trò chuyện" className={styles.conversationRail}>
              <div className={styles.railHeader}>
                <div>
                  <h2>Cuộc trò chuyện</h2>
                  <p>Tối đa 50 cuộc gần đây</p>
                </div>
                <button
                  className={styles.newConversationButton}
                  disabled={interactionLocked}
                  onClick={() => void handleCreateConversation()}
                  type="button"
                >
                  <UiIcon name="plus" size={18} />
                  {creating ? "Đang tạo" : "Tạo mới"}
                </button>
              </div>

              {conversationFailure ? (
                <div aria-live="assertive" className={styles.railError} role="alert">
                  <p>{conversationFailure.message}</p>
                  <button
                    className={styles.textButton}
                    disabled={conversationsLoading}
                    onClick={() => void loadConversationList(activeIdRef.current, { hydrateThread: conversations.length === 0 })}
                    type="button"
                  >
                    Thử lại
                  </button>
                </div>
              ) : null}

              {conversationsLoading && conversations.length === 0 ? (
                <div aria-live="polite" className={styles.railLoading} role="status">
                  <span className={styles.spinner} />
                  Đang tải danh sách
                </div>
              ) : null}

              {!conversationsLoading && conversations.length === 0 && !conversationFailure ? (
                <div className={styles.railEmpty}>
                  <UiIcon name="message-square" size={24} />
                  <strong>Chưa có lịch sử</strong>
                  <p>Cuộc trò chuyện mới sẽ xuất hiện tại đây.</p>
                </div>
              ) : null}

              {conversations.length > 0 ? (
                <ul className={styles.conversationList}>
                  {conversations.map((conversation) => {
                    const selected = conversation.id === selectedConversationId;
                    return (
                      <li className={selected ? styles.conversationSelected : undefined} key={conversation.id}>
                        <button
                          aria-current={selected ? "true" : undefined}
                          className={styles.conversationSelect}
                          disabled={deleting || sending}
                          onClick={() => void loadThread(conversation.id)}
                          type="button"
                        >
                          <span className={styles.conversationTitle}>{conversation.title}</span>
                          <span className={styles.conversationTime}>{formatDateTime(conversation.lastMessageAt ?? conversation.updatedAt)}</span>
                          {conversation.inFlight ? <span className={styles.inFlight}>Đang xử lý</span> : null}
                        </button>
                        <button
                          aria-label={`Xóa cuộc trò chuyện ${conversation.title}`}
                          className={styles.deleteButton}
                          disabled={interactionLocked}
                          onClick={() => {
                            setDeleteFailure(null);
                            setDeleteTarget(conversation);
                          }}
                          title="Xóa cuộc trò chuyện"
                          type="button"
                        >
                          <UiIcon name="trash" size={18} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </aside>

            <section aria-labelledby="chat-thread-title" className={styles.thread}>
              <header className={styles.threadHeader}>
                <div>
                  <h2 id="chat-thread-title">{selectedSummary?.title ?? "Nội dung trò chuyện"}</h2>
                  <p>
                    {selectedSummary
                      ? `Lưu đến ${formatExpiry(selectedSummary.expiresAt)}`
                      : "Lịch sử do máy chủ HealthCare quản lý"}
                  </p>
                </div>
                {selectedSummary ? (
                  <button
                    aria-label="Tải lại lịch sử trò chuyện"
                    className={styles.refreshButton}
                    disabled={threadLoading || sending}
                    onClick={() => void loadThread(selectedSummary.id, { background: true })}
                    title="Tải lại lịch sử"
                    type="button"
                  >
                    <UiIcon name="activity" size={19} />
                  </button>
                ) : null}
              </header>

              {currentConsentRequired ? (
                <section aria-describedby="patient-chat-consent-copy" className={styles.consentPanel}>
                  <strong>Xác nhận sử dụng trợ lý</strong>
                  <p id="patient-chat-consent-copy">Cuộc trò chuyện được lưu tối đa 90 ngày rồi tự động xóa. Trợ lý chỉ cung cấp thông tin tham khảo, không chẩn đoán hoặc kê đơn. Remote AI đang tắt trong môi trường này.</p>
                  <button className={styles.primaryConsentButton} disabled={consentBusy} onClick={() => void handleConsent()} type="button">
                    {consentBusy ? "Đang xác nhận..." : "Tôi đồng ý với chính sách"}
                  </button>
                  {consentFailure ? <p aria-live="assertive" className={styles.consentError} role="alert">{consentFailure}</p> : null}
                </section>
              ) : null}

              <div
                aria-label="Lịch sử tin nhắn"
                className={styles.messageViewport}
                ref={messageViewportRef}
                role="log"
                tabIndex={0}
              >
                {renderThread()}
              </div>

              <form className={styles.composer} onSubmit={handleSubmit}>
                <div className={styles.composerLabelRow}>
                  <label htmlFor="patient-chat-message">Tin nhắn của bạn</label>
                  <span id="patient-chat-count">{draft.length.toLocaleString("vi-VN")} / 10.000</span>
                </div>
                <textarea
                  aria-describedby={`patient-chat-help patient-chat-count${sendFailure ? " patient-chat-error" : ""}`}
                  aria-invalid={Boolean(sendFailure)}
                  disabled={!selectedConversationId || sendLocked || currentConsentRequired}
                  id="patient-chat-message"
                  maxLength={MAX_MESSAGE_LENGTH}
                  minLength={2}
                  onChange={(event) => {
                    const nextDraft = event.target.value;
                    const conversationId = activeIdRef.current;
                    if (conversationId) resetSendAttempt(conversationId);
                    setDraft(nextDraft);
                    if (sendFailure?.code === "CHAT_INPUT_INVALID") setSendFailure(null);
                  }}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Ví dụ: Tôi cần chuẩn bị gì trước buổi khám tim mạch?"
                  required
                  rows={3}
                  value={draft}
                />
                <div className={styles.composerFooter}>
                  <div>
                    <p id="patient-chat-help">Enter để gửi, Shift + Enter để xuống dòng. Không nhập thông tin nhận dạng không cần thiết.</p>
                    {selectedSummary?.inFlight ? <p className={styles.inFlightNotice}>Tin nhắn trước có thể vẫn đang xử lý. Bạn có thể thử lại; máy chủ sẽ chỉ nhận yêu cầu mới khi lượt cũ đã hết hạn.</p> : null}
                    {sendFailure ? <p className={styles.composerError} id="patient-chat-error" role="alert">{sendFailure.message}</p> : null}
                  </div>
                  <button
                    className={styles.sendButton}
                    disabled={!selectedConversationId || sendLocked || !draftIsValid || currentConsentRequired}
                    type="submit"
                  >
                    <UiIcon name="send" size={18} />
                    {sending ? "Đang gửi" : selectedSummary?.inFlight ? "Thử gửi lại" : "Gửi tin nhắn"}
                  </button>
                </div>
              </form>
            </section>
          </section>
        )}

        <dialog
          aria-describedby="delete-chat-description"
          aria-labelledby="delete-chat-title"
          className={styles.deleteDialog}
          onCancel={(event) => {
            if (deleting) event.preventDefault();
          }}
          onClose={() => setDeleteTarget(null)}
          ref={deleteDialogRef}
        >
          <div className={styles.dialogHeading}>
            <UiIcon name="alert-triangle" size={24} />
            <div>
              <h2 id="delete-chat-title">Xóa cuộc trò chuyện?</h2>
              <p id="delete-chat-description">Toàn bộ tin nhắn trong “{deleteTarget?.title}” sẽ bị xóa khỏi máy chủ và không thể khôi phục.</p>
            </div>
          </div>
          {deleteFailure ? <p className={styles.dialogError} role="alert">{deleteFailure.message}</p> : null}
          <div className={styles.dialogActions}>
            <button
              className={styles.secondaryButton}
              disabled={deleting}
              onClick={() => deleteDialogRef.current?.close()}
              type="button"
            >
              Giữ lại
            </button>
            <button
              className={styles.confirmDeleteButton}
              disabled={deleting}
              onClick={() => void handleDeleteConversation()}
              type="button"
            >
              <UiIcon name="trash" size={18} />
              {deleting ? "Đang xóa" : "Xóa vĩnh viễn"}
            </button>
          </div>
        </dialog>
      </div>
      </PortalChrome>
  );
}

export default function PatientChatPage() {
  return (
    <AssistantProvider initialMode={DEFAULT_CHAT_MODE}>
      <PatientChatPageContent />
    </AssistantProvider>
  );
}
