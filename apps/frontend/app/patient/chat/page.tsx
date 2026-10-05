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
import ChatMessageContent from "../../../components/ChatMessageContent";
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
  fetchAssistantAccountSettings,
  hasRole,
  isChatMode,
  patchAssistantAccountSettings,
  updateAiMessageFeedback,
  fetchPatientAiCreditStatus,
  type AiCreditStatus,
  type AssistantAccountSettings,
  type AuthSession,
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
  provenanceLabel,
  useAssistant,
} from "../../../components/AssistantProvider";
import { CHAT_WAIT_STAGE_COPY, useChatWaitElapsedSeconds, useChatWaitStage } from "../../../components/useChatWaitStage";
import styles from "./chat.module.css";

const MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LENGTH = 10_000;
// The composer chip states the real per-question credit cost; keep it as a
// constant so the copy cannot silently drift from the backend's charge rule.
const AI_CHAT_CREDIT_COST_PER_QUESTION = 1;
// The API speaks enum; the patient portal must not. Mirrors the labels already
// used by the admin credit console so the two surfaces never disagree.
const TIER_LABEL: Readonly<Record<string, string>> = {
  STANDARD: "Cơ bản",
  SILVER: "Bạc",
  GOLD: "Vàng",
  VIP: "VIP",
};

// Vietnamese labels for triage urgency enums so patients never see raw English codes.
const TRIAGE_URGENCY_VI: Readonly<Record<string, string>> = {
  EMERGENCY: "Khẩn cấp",
  HIGH: "Ưu tiên cao",
  NORMAL: "Bình thường",
  LOW: "Ưu tiên thấp",
};

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

const CITATION_STATUS_LABEL: Readonly<Record<string, string>> = {
  STALE: "Có thể đã cũ",
  UNAVAILABLE: "Không còn khả dụng",
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
  if (Number.isNaN(date.getTime())) return "Vừa xong";
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

// The 33s chat deadline never surfaces as a raw AbortError: getJson converts a
// timed-out request into ApiError("REQUEST_TIMEOUT", 408). A raw AbortError can
// therefore only come from this page's own controller, and when it was not an
// intentional cancel it is reported as a bounded, retryable timeout instead of
// being swallowed.
function chatTimeoutFailure(): ChatFailure {
  return {
    code: "CHAT_REQUEST_TIMEOUT",
    message: assistantErrorMessage("CHAT_REQUEST_TIMEOUT"),
    status: 408,
  };
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
        <span className={styles.metaRight}>
          {assistant && message.status === "COMPLETED" ? (() => {
            const label = provenanceLabel(message.provenance ?? "local_provider", message.citations.length, message.safetyAction);
            if (!label) return null;
            return (
              <span className={styles.provenance} data-provenance={message.provenance ?? "local_provider"}>
                {label}
              </span>
            );
          })() : null}
          <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
        </span>
      </div>
      <ChatMessageContent className={styles.messageContent} content={message.content} />
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
                  {citation.source_status && citation.source_status !== "CURRENT" ? (
                    <em className={styles.provenance} data-status={citation.source_status}>
                      {" "}· {CITATION_STATUS_LABEL[citation.source_status] ?? citation.source_status}
                    </em>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {assistant && message.disclaimer ? (
        <p className={styles.messageDisclaimer}>{message.disclaimer}</p>
      ) : null}
      {assistant && (message.safetyAction === "REFUSE" || message.safetyAction === "HUMAN_HANDOFF") ? (
        <p className={styles.provenance} data-safety-action={message.safetyAction}>
          <UiIcon name="shield" size={13} /> {message.safetyAction === "REFUSE"
            ? "Phản hồi an toàn — trợ lý không thể trả lời yêu cầu này."
            : "Phản hồi an toàn — hãy trao đổi trực tiếp với nhân viên HealthCare."}
        </p>
      ) : null}
      {assistant && message.safetyAction === "EMERGENCY" ? (
        <div aria-live="assertive" className={styles.emergencyMessage} role="alert">
          <div className={styles.emergencyHeader}>
            <UiIcon name="alert-triangle" size={17} />
            <strong>Đây có thể là tình huống khẩn cấp.</strong>
          </div>
          <span>Không chờ trợ lý phản hồi; gọi 115 hoặc đến khoa cấp cứu gần nhất.</span>
          <div className={styles.emergencyActions}>
            <a href="tel:115">Gọi 115</a>
            <Link className={styles.emergencyBranchLink} href="/branches">Cơ sở cấp cứu gần nhất</Link>
          </div>
        </div>
      ) : null}
      {assistant && message.triage ? (
        <p className={styles.triageSummary}>
          Mức ưu tiên: <strong>{TRIAGE_URGENCY_VI[message.triage.urgencyLevel] ?? message.triage.urgencyLevel}</strong>
          {message.triage.recommendedSpecialty ? ` · Gợi ý: ${message.triage.recommendedSpecialty}` : ""}
        </p>
      ) : null}
      {assistant && message.safetyAction !== "EMERGENCY" && message.suggestedActions && message.suggestedActions.length > 0 ? (
        <div aria-label="Bước tiếp theo" className={styles.suggestedActions} role="group">
          <span className={styles.suggestedActionsLabel}>Bước tiếp theo</span>
          {message.suggestedActions.map((action, idx) => (
            action.href.startsWith("tel:")
              ? <a href={action.href} key={`${action.kind}-${action.href}-${idx}`}><UiIcon name="phone" size={14} />{action.label}</a>
              : <Link href={action.href} key={`${action.kind}-${action.href}-${idx}`}>{action.label}</Link>
          ))}
        </div>
      ) : null}
      {assistant && message.status === "COMPLETED" && !feedbackRating(message) ? (
        <div aria-label="Đánh giá phản hồi" className={styles.feedbackRow} role="group">
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

function PatientChatPageContent({ session }: { session: AuthSession | null }) {
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
  // Bounded staged feedback while the validated chunked answer is prepared.
  const waitStage = useChatWaitStage(sending);
  const waitElapsedSeconds = useChatWaitElapsedSeconds(sending);
  const [sendFailure, setSendFailure] = useState<ChatFailure | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AiConversation | null>(null);
  const [deleteFailure, setDeleteFailure] = useState<ChatFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ChatMode>(DEFAULT_CHAT_MODE);
  // Per-account assistant defaults live server-side; the user's manual mode
  // pick always wins over the seeded default.
  const [accountSettings, setAccountSettings] = useState<AssistantAccountSettings | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const modeTouchedRef = useRef(false);
  const [chatPolicy, setChatPolicy] = useState<AiChatPolicy | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentFailure, setConsentFailure] = useState<string | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const [modeCreating, setModeCreating] = useState(false);
  const [creditStatus, setCreditStatus] = useState<AiCreditStatus | null>(null);
  const creditRequestRef = useRef(0);

  const refreshCredit = useCallback(async () => {
    const requestId = ++creditRequestRef.current;
    try {
      const data = await fetchPatientAiCreditStatus();
      if (requestId === creditRequestRef.current) setCreditStatus(data);
    } catch {}
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refreshCredit);
    return () => { creditRequestRef.current += 1; };
  }, [refreshCredit]);
  // Load the account's assistant defaults once; seed the mode picker only
  // when the user has not already chosen one during this visit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await fetchAssistantAccountSettings();
        if (!cancelled) {
          setAccountSettings(settings);
          if (!modeTouchedRef.current && isChatMode(settings.chatDefaultMode)) {
            setSelectedMode(settings.chatDefaultMode);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const listRequestRef = useRef(0);
  const threadRequestRef = useRef(0);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);
  const shouldScrollToLatestRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const sendRequestRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  // Set immediately before this page intentionally aborts the send controller
  // (Stop control, invalidateSendRequest, consent, unmount) so the aborted
  // send's catch can tell a deliberate cancel from a genuine failure.
  const intentionalCancelRef = useRef(false);
  const threadControllerRef = useRef<AbortController | null>(null);
  const modeCreateInFlightRef = useRef(false);
  const consentRequestRef = useRef(0);
  const lastSentDraftRef = useRef("");
  const stopRefreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (selectedConversationId && workspaceRef.current) {
      const rect = workspaceRef.current.getBoundingClientRect();
      if (rect.top < 0) {
        workspaceRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (rect.bottom > window.innerHeight && rect.top > 120) {
        workspaceRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedConversationId]);

  const invalidateSendRequest = useCallback(() => {
    // Thread switches and clears intentionally cancel an in-flight send; the
    // flag keeps that cancel silent in sendContent's catch.
    intentionalCancelRef.current = true;
    sendRequestRef.current += 1;
    sendInFlightRef.current = false;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setSending(false);
    setStreamingReply("");
  }, []);

  const invalidateConsentRequest = useCallback(() => {
    consentRequestRef.current += 1;
    setConsentBusy(false);
  }, []);

  const clearThread = useCallback(() => {
    threadRequestRef.current += 1;
    threadControllerRef.current?.abort();
    threadControllerRef.current = null;
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
    const sendRequestId = sendRequestRef.current;
    threadControllerRef.current?.abort();
    threadControllerRef.current = controller;
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
      if (controller.signal.aborted || requestId !== threadRequestRef.current
        || sendRequestId !== sendRequestRef.current || activeIdRef.current !== conversationId) return;

      shouldScrollToLatestRef.current = true;
      setActiveConversation(conversation);
      setAssistantConversation(conversation);
      if (conversation.mode) setSelectedMode(conversation.mode);
      setMessages((current) => options.background ? mergeMessages(page.content, current) : page.content);
      setNextCursor(page.nextCursor ?? null);
      setHasMoreMessages(page.hasMore);
      setConversations((current) => current.map((item) => item.id === conversation.id ? conversation : item));
    } catch (error) {
      if (isAbortError(error)) return;
      if (controller.signal.aborted || requestId !== threadRequestRef.current
        || sendRequestId !== sendRequestRef.current || activeIdRef.current !== conversationId) return;
      const failure = toFailure(error);
      handleUnauthorized(failure);
      setThreadFailure(failure);
    } finally {
      if (requestId === threadRequestRef.current) setThreadLoading(false);
      if (threadControllerRef.current === controller) threadControllerRef.current = null;
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
    // The initial load must not wait on requestAnimationFrame: RAF is paused
    // for hidden tabs and for non-composited webviews, which left the
    // conversation list permanently empty until the user re-focused the page.
    // loadConversationList self-guards stale responses via listRequestRef.
    // The setTimeout(0) defers the first setState out of the effect body
    // (react-hooks/set-state-in-effect) while still running in hidden tabs.
    const kickoff = setTimeout(() => {
      void loadConversationList(null, { hydrateThread: true });
    }, 0);
    return () => {
      clearTimeout(kickoff);
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

  // A persisted `chatDefaultMode` can name a mode the policy has since
  // disabled — degrade the pending selection to the always-available support
  // mode once the real policy arrives, unless the user already picked a mode
  // or is viewing a persisted conversation (whose own mode stays displayed).
  useEffect(() => {
    if (!chatPolicy || modeTouchedRef.current || activeConversation || selectedConversationId) return;
    if (selectedMode === "HOSPITAL_SUPPORT") return;
    if (chatPolicy.enabledModes?.includes(selectedMode)) return;
    // Deferred out of the effect body (react-hooks/set-state-in-effect);
    // a dep change before it fires cancels the stale correction.
    const correction = setTimeout(() => setSelectedMode("HOSPITAL_SUPPORT"), 0);
    return () => clearTimeout(correction);
  }, [activeConversation, chatPolicy, selectedConversationId, selectedMode]);

  useEffect(() => {
    if (!messageViewportRef.current) return;
    if (shouldScrollToLatestRef.current) {
      messageViewportRef.current.scrollTop = messageViewportRef.current.scrollHeight;
      shouldScrollToLatestRef.current = false;
      const frame = window.requestAnimationFrame(() => {
        if (messageViewportRef.current) {
          messageViewportRef.current.scrollTop = messageViewportRef.current.scrollHeight;
        }
      });
      return () => window.cancelAnimationFrame(frame);
    } else if (isNearBottom(messageViewportRef.current)) {
      messageViewportRef.current.scrollTop = messageViewportRef.current.scrollHeight;
    }
  }, [messages, streamingReply]);

  useEffect(() => () => {
    threadControllerRef.current?.abort();
    sendRequestRef.current += 1;
    threadRequestRef.current += 1;
    listRequestRef.current += 1;
    consentRequestRef.current += 1;
    creditRequestRef.current += 1;
    if (stopRefreshTimerRef.current !== null) window.clearTimeout(stopRefreshTimerRef.current);
  }, []);

  useEffect(() => () => {
    intentionalCancelRef.current = true;
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
              <div className={styles.modeOption} key={option.value} title={option.description}>
                <strong>{option.label}</strong>
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
  // Clinical modes are only safe to offer when the policy explicitly lists
  // them: an absent `enabledModes` field (older server, failed parse) or a
  // failed policy fetch must fail closed, because the backend 503s on modes
  // it has not enabled. HOSPITAL_SUPPORT can never be disabled server-side.
  const modeAvailable = (mode: ChatMode): boolean =>
    mode === "HOSPITAL_SUPPORT" ? true : Boolean(chatPolicy?.enabledModes?.includes(mode));
  // An existing conversation keeps its creation-time mode. If the runtime has
  // since disabled that mode, the send path would 503 — block it honestly
  // instead of letting the patient hit a silent server error.
  const selectedModeUnavailable = Boolean(
    selectedSummary?.mode && !modeAvailable(selectedSummary.mode),
  );
  const interactionLocked = sendLocked || creating || deleting || consentBusy;
  const normalizedDraft = draft.trim();
  const draftIsValid = normalizedDraft.length >= 2 && normalizedDraft.length <= MAX_MESSAGE_LENGTH;

  const handleCreateConversation = async (): Promise<void> => {
    // `selectedMode` can hold a policy-unlisted mode without any picker
    // interaction — a persisted `chatDefaultMode` from the account settings
    // seed, or `loadThread` syncing a conversation whose mode has since been
    // disabled. Gate create the same way the pickers are gated; the backend
    // would 503 the request anyway, so fail honestly before issuing it.
    if (!modeAvailable(selectedMode)) {
      setConversationFailure({
        code: "AI_UNAVAILABLE",
        message: assistantErrorMessage("AI_UNAVAILABLE"),
        status: 503,
      });
      return;
    }
    setCreating(true);
    setConversationFailure(null);
    setNotice(null);
    try {
      const conversation = await createAiConversation({ mode: selectedMode, consentAccepted: true });
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
    modeTouchedRef.current = true;
    if (modeCreateInFlightRef.current || nextMode === selectedMode) return;
    if (!modeAvailable(nextMode)) return;
    if (activeConversation || selectedConversationId) {
      modeCreateInFlightRef.current = true;
      setModeCreating(true);
      setCreating(true);
      setNotice(null);
      try {
        const conversation = await createAiConversation({ mode: nextMode, consentAccepted: true });
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

  const handleSaveAssistantSettings = async (
    patch: Partial<Pick<AssistantAccountSettings, "chatTone" | "chatPersonalized" | "chatDefaultMode">>,
  ): Promise<void> => {
    if (settingsBusy) return;
    setSettingsBusy(true);
    setSettingsSaved(false);
    setSettingsError(null);
    try {
      const saved = await patchAssistantAccountSettings(patch);
      setAccountSettings(saved);
      setSettingsSaved(true);
      window.setTimeout(() => setSettingsSaved(false), 2500);
    } catch (error) {
      if (!isAbortError(error)) {
        setSettingsError(
          error instanceof ApiError && error.code
            ? assistantErrorMessage(error.code)
            : "Chưa lưu được cài đặt trợ lý.",
        );
      }
    } finally {
      setSettingsBusy(false);
    }
  };

  const handleConsent = async (): Promise<void> => {
    const conversation = activeConversation;
    if (!conversation || consentBusy) return;
    const consentRequestId = ++consentRequestRef.current;
    const controller = new AbortController();
    // Confirming consent supersedes any in-flight send on purpose.
    intentionalCancelRef.current = true;
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
    const current = feedbackRating(message);
    // Optimistically update feedback so the prompt disappears immediately upon click
    setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback: { rating } } : item));
    try {
      const feedback = await updateAiMessageFeedback(conversationId, message.id, rating);
      setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback } : item));
    } catch (error) {
      if (!isAbortError(error)) {
        // Revert optimistic update if API failed
        setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback: current } : item));
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
    // Defense in depth: the MessageItem retry path re-enters here without the
    // composer's disabled attribute — refuse sends on a disabled-mode
    // conversation so they cannot reach the backend's 503.
    if (selected?.mode && !modeAvailable(selected.mode)) {
      setSendFailure({ code: "AI_UNAVAILABLE", message: assistantErrorMessage("AI_UNAVAILABLE"), status: 503 });
      return;
    }
    if (selected?.consentRequired && (
      !selected.consentedAt
      || !chatPolicy
      || selected.consentVersion !== chatPolicy.policyVersion
    )) {
      setConsentFailure("Bạn cần đồng ý với phiên bản chính sách hiện tại trước khi gửi tin nhắn.");
      return;
    }

    sendInFlightRef.current = true;
    intentionalCancelRef.current = false;
    const sendRequestId = ++sendRequestRef.current;
    // A previous read may have captured the thread or balance before this
    // question. Invalidate it even if its transport has already buffered data.
    threadRequestRef.current += 1;
    listRequestRef.current += 1;
    creditRequestRef.current += 1;
    threadControllerRef.current?.abort();
    threadControllerRef.current = null;
    const controller = new AbortController();
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;
    const isCurrentSendRequest = (): boolean => (
      sendRequestRef.current === sendRequestId
      && activeIdRef.current === conversationId
    );
    // The exchange round-trip (including the streamed answer) can take tens of
    // seconds, so the patient's own message must reach the transcript
    // immediately: it is inserted as a local PENDING row and is replaced by the
    // server's copy — the one carrying the real id and sequence — as soon as
    // the exchange settles.
    const pendingMessageId = `pending-user-${sendRequestId}`;
    setMessages((current) => mergeMessages(current, [{
      id: pendingMessageId,
      role: "USER",
      status: "PENDING",
      content: normalizedContent,
      sequence: current.reduce((max, message) => Math.max(max, message.sequence), 0) + 1,
      citations: [],
      createdAt: new Date().toISOString(),
    }]));
    if (options.clearDraftOnSuccess) setDraft("");
    lastSentDraftRef.current = normalizedContent;
    setSending(true);
    setStreamingReply("");
    setSendFailure(null);
    setNotice(null);
    shouldScrollToLatestRef.current = true;
    try {
      const exchange = await sendMessage(conversationId, normalizedContent, {
        attemptId: options.sourceMessageId ? `failed-message:${options.sourceMessageId}` : "composer",
        signal: controller.signal,
        onDelta: (delta) => {
          if (isCurrentSendRequest()) setStreamingReply((current) => current + delta);
        },
      });
      if (!isCurrentSendRequest()) return;
      if (options.clearDraftOnSuccess) setDraft("");
      setMessages((current) => mergeMessages(
        current.filter((message) => message.id !== pendingMessageId),
        [exchange.userMessage, exchange.assistantMessage],
      ));
      setNotice("Trợ lý đã phản hồi. Lịch sử sẽ tiếp tục đồng bộ từ máy chủ.");
      // The persisted final exchange ends waiting. Reconciliation cannot hold
      // the composer or replace a newer send's thread/credit snapshot.
      void Promise.allSettled([
        loadThread(conversationId, { background: true }),
        loadConversationList(conversationId, { hydrateThread: false, background: true }),
        refreshCredit(),
      ]);
    } catch (error) {
      // Every failure path drops the optimistic placeholder and hands the text
      // back to the composer so a retry cannot lose what the patient wrote.
      setMessages((current) => current.filter((message) => message.id !== pendingMessageId));
      if (options.clearDraftOnSuccess) setDraft(normalizedContent);
      if (isAbortError(error)) {
        // Intentional cancels (Stop, thread switch, consent, unmount) stay
        // silent; any other abort surfaces as a retryable timeout instead of
        // disappearing. A superseded request never owns the failure UI.
        if (intentionalCancelRef.current || !isCurrentSendRequest()) return;
        setSendFailure(chatTimeoutFailure());
      } else {
        if (!isCurrentSendRequest()) return;
        const failure = toFailure(error);
        handleUnauthorized(failure);
        setSendFailure(failure);
        void Promise.allSettled([
          loadThread(conversationId, { background: true }),
          loadConversationList(conversationId, { hydrateThread: false, background: true }),
          refreshCredit(),
        ]);
      }
    } finally {
      if (isCurrentSendRequest()) {
        sendInFlightRef.current = false;
        setStreamingReply("");
        setSending(false);
        intentionalCancelRef.current = false;
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
        // The composer is disabled while sending, which drops keyboard focus to
        // <body>; return it so keyboard users can keep typing without re-tabbing.
        requestAnimationFrame(() => { if (composerInputRef.current && !composerInputRef.current.disabled) composerInputRef.current.focus(); });
      }
    }
  };

  // Stop is the visible escape from a 30-40s cold start: it marks the cancel as
  // intentional, aborts the request, and resets the send machine synchronously
  // so the composer unlocks even before the aborted promise settles. The
  // aborted send still cleans up after itself silently in sendContent.
  const handleStopSend = (): void => {
    if (!sendInFlightRef.current) return;
    const conversationId = activeIdRef.current;
    intentionalCancelRef.current = true;
    requestControllerRef.current?.abort();
    invalidateSendRequest();
    sendInFlightRef.current = false;
    setStreamingReply("");
    setSending(false);
    if (lastSentDraftRef.current) {
      setDraft(lastSentDraftRef.current);
      setMessages((current) => current.filter((message) => message.status !== "PENDING"));
    }
    // Backend cancellation is cooperative: a nearly-finished turn can still
    // complete (and charge), so the copy may only claim the *wait* stopped.
    // One delayed silent refresh reconciles the thread and the balance in
    // case the answer landed after Stop.
    setNotice("Đã dừng chờ. Nếu trợ lý vẫn hoàn tất, câu trả lời sẽ hiện lại trong lịch sử.");
    if (stopRefreshTimerRef.current !== null) window.clearTimeout(stopRefreshTimerRef.current);
    stopRefreshTimerRef.current = window.setTimeout(() => {
      stopRefreshTimerRef.current = null;
      if (!conversationId || activeIdRef.current !== conversationId || sendInFlightRef.current) return;
      void Promise.allSettled([
        loadThread(conversationId, { background: true }),
        refreshCredit(),
      ]);
    }, 1_500);
    requestAnimationFrame(() => composerInputRef.current?.focus());
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
              retryDisabled={sendLocked || selectedModeUnavailable || currentConsentRequired}
            />
          ))}
          {streamingReply ? (
            <li className={`${styles.message} ${styles.messageAssistant}`} data-testid="chat-streaming-reply">
              <div className={styles.messageMeta}><strong>Trợ lý HealthCare</strong></div>
              <ChatMessageContent className={styles.messageContent} content={streamingReply} />
              <p className={styles.messageStatus}>Đang nhận phản hồi từng phần đã được xác thực…</p>
            </li>
          ) : null}
          {/* While sending but not yet streaming, the staged `chat-waiting`
              status below the thread is the single progress indicator. */}
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
            {creditStatus && (
              <div className="mt-3 inline-flex items-center gap-2.5 rounded-[var(--chat-radius)] bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 text-xs font-semibold text-emerald-900">
                <UiIcon name="shield-check" size={15} className="text-emerald-700 shrink-0" />
                <span>Hạng <strong>{TIER_LABEL[creditStatus.tier ?? ""] ?? "Cơ bản"}</strong></span>
                <span className="text-emerald-300">|</span>
                <span>Lượt AI còn lại: <strong className="text-emerald-700 text-sm">{creditStatus.credits}</strong>/{creditStatus.maxCredits}</span>
              </div>
            )}
          </div>
          <Link className={styles.catalogLink} href="/search">
            Tra cứu nội dung bệnh viện
            <UiIcon name="arrow-up-right" size={18} />
          </Link>
        </header>

        <section aria-label="Lưu ý an toàn khi dùng trợ lý" className={styles.safetyBand}>
          <div className={styles.safetyItem}>
            <UiIcon name="shield-check" size={16} />
            <p>Trợ lý không thay thế bác sĩ, chẩn đoán, đơn thuốc hoặc hướng dẫn cấp cứu.</p>
          </div>
          <div className={`${styles.safetyItem} ${styles.emergencyItem}`}>
            <UiIcon name="alert-triangle" size={16} />
            <p><strong>Khẩn cấp:</strong> khó thở, đau ngực dữ dội, bất tỉnh — gọi 115 hoặc đến khoa cấp cứu gần nhất, không chờ trợ lý.</p>
          </div>
        </section>

        <section aria-label="Chọn mục đích cuộc trò chuyện" className={styles.modePicker}>
          <div className={styles.modePickerHeading}>
            <strong>Chọn mục đích</strong>
            <span>{activeConversation ? "Mỗi cuộc trò chuyện giữ một chế độ; chọn mục đích khác sẽ mở cuộc trò chuyện mới." : "Mỗi cuộc trò chuyện giữ một chế độ cố định."}</span>
          </div>
          <div aria-label="Mục đích cuộc trò chuyện" className={styles.modeOptions} role="group">
            {ASSISTANT_MODE_OPTIONS.map((option) => {
              // Fail closed: a clinical mode absent from the policy's
              // enabledModes is a real 503 on the backend — show that state
              // instead of offering a button that always fails.
              const modeUnavailable = !modeAvailable(option.value);
              return (
                <button
                  aria-pressed={selectedMode === option.value}
                  className={selectedMode === option.value ? styles.modeOptionActive : styles.modeOption}
                  disabled={interactionLocked || modeCreating || modeUnavailable}
                  key={option.value}
                  onClick={() => void handleModeSelect(option.value)}
                  title={modeUnavailable ? "Chế độ này tạm chưa khả dụng." : option.description}
                  type="button"
                >
                  <strong>{option.label}</strong>
                  {modeUnavailable ? <small>Tạm chưa khả dụng</small> : null}
                </button>
              );
            })}
          </div>
          <div aria-label="Cấu hình trợ lý theo tài khoản" className={styles.assistantSettings}>
            <label className={styles.assistantSettingField}>
              <span>Giọng trả lời</span>
              <select
                disabled={settingsBusy}
                onChange={(event) => void handleSaveAssistantSettings({
                  chatTone: event.target.value as AssistantAccountSettings["chatTone"],
                })}
                value={accountSettings?.chatTone ?? "than_thien"}
              >
                <option value="than_thien">Thân thiện</option>
                <option value="chuyen_nghiep">Chuyên nghiệp</option>
                <option value="ngan_gon">Ngắn gọn</option>
              </select>
            </label>
            <label className={styles.assistantSettingToggle}>
              <input
                checked={accountSettings?.chatPersonalized ?? false}
                disabled={settingsBusy}
                onChange={(event) => void handleSaveAssistantSettings({
                  chatPersonalized: event.target.checked,
                })}
                type="checkbox"
              />
              <span>Gợi ý cá nhân hóa (tên, lịch hẹn sắp tới)</span>
            </label>
            <button
              className={styles.assistantSettingSave}
              disabled={settingsBusy || !accountSettings || !modeAvailable(selectedMode)}
              onClick={() => accountSettings
                ? void handleSaveAssistantSettings({
                  chatDefaultMode: selectedMode,
                  chatTone: accountSettings.chatTone,
                  chatPersonalized: accountSettings.chatPersonalized,
                })
                : undefined}
              title={!modeAvailable(selectedMode) ? "Chế độ này tạm chưa khả dụng." : undefined}
              type="button"
            >
              Lưu mục đích làm mặc định
            </button>
            <p aria-live="polite" className={styles.assistantSettingHint} role="status">
              {settingsSaved
                ? "Đã lưu cài đặt trợ lý của bạn."
                : settingsError ?? "Cài đặt áp dụng cho các lượt trả lời mới của trợ lý theo tài khoản của bạn."}
            </p>
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
          <section ref={workspaceRef} aria-label="Không gian trò chuyện sức khỏe" className={styles.workspace}>
            <aside aria-label="Danh sách cuộc trò chuyện" className={styles.conversationRail}>
              <div className={styles.railHeader}>
                <div>
                  <h2>Cuộc trò chuyện</h2>
                  <p>Tối đa 50 cuộc gần đây</p>
                </div>
                <button
                  className={styles.newConversationButton}
                  disabled={interactionLocked || !modeAvailable(selectedMode)}
                  onClick={() => void handleCreateConversation()}
                  title={!modeAvailable(selectedMode) ? "Chế độ này tạm chưa khả dụng." : undefined}
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
                <div className={styles.threadHeaderRight}>
                  {creditStatus ? (
                    <div className={styles.threadCreditBadge} title="Số dư lượt AI khả dụng trong tài khoản">
                      <span className={styles.threadCreditDot} />
                      <span className={styles.threadCreditLabel}>Lượt AI:</span>
                      <strong className={styles.threadCreditValue}>{creditStatus.credits}</strong>
                      <span className={styles.threadCreditTotal}>/{creditStatus.maxCredits}</span>
                    </div>
                  ) : null}
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
                </div>
              </header>

              {currentConsentRequired ? (
                <section aria-describedby="patient-chat-consent-copy" className={styles.consentPanel}>
                  <strong>Xác nhận sử dụng trợ lý</strong>
                  <p id="patient-chat-consent-copy">{chatPolicy ? `Cuộc trò chuyện được lưu tối đa ${chatPolicy.retentionDays} ngày rồi tự động xóa.` : "Thời hạn lưu trữ được áp dụng theo chính sách hiện tại của HealthCare."} Trợ lý chỉ cung cấp thông tin tham khảo, không chẩn đoán hoặc kê đơn. Kênh trả lời từ trợ lý thông tin được kiểm duyệt của bệnh viện.</p>
                  <button className={styles.primaryConsentButton} disabled={consentBusy} onClick={() => void handleConsent()} type="button">
                    {consentBusy ? "Đang xác nhận…" : "Tôi đồng ý với chính sách"}
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
                {sending && !streamingReply ? (
                  <p
                    aria-label="Trợ lý đang xử lý câu hỏi"
                    className={styles.messageStatus}
                    data-testid="chat-waiting"
                    role="status"
                  >
                    {CHAT_WAIT_STAGE_COPY[waitStage]} · {waitElapsedSeconds}s
                  </p>
                ) : null}
              </div>

              <form className={styles.composer} onSubmit={handleSubmit}>
                <div className={styles.composerLabelRow}>
                  <div className="flex items-center gap-2">
                    <label htmlFor="patient-chat-message">Tin nhắn của bạn</label>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[var(--chat-radius)] border border-emerald-200">
                      {AI_CHAT_CREDIT_COST_PER_QUESTION} lượt / câu hỏi (hoàn lại nếu lỗi)
                    </span>
                    {creditStatus ? (
                      <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-[var(--chat-radius)] border border-teal-200">
                        Số dư: {creditStatus.credits} / {creditStatus.maxCredits}
                      </span>
                    ) : null}
                  </div>
                  <span id="patient-chat-count">{draft.length.toLocaleString("vi-VN")} / 10.000</span>
                </div>
                <textarea
                  aria-describedby={`patient-chat-help patient-chat-count${sendFailure ? " patient-chat-error" : ""}`}
                  aria-invalid={Boolean(sendFailure)}
                  disabled={!selectedConversationId || sendLocked || currentConsentRequired || selectedModeUnavailable}
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
                  ref={composerInputRef}
                  required
                  rows={3}
                  value={draft}
                />
                <div className={styles.composerFooter}>
                  <div>
                    <p id="patient-chat-help">Enter để gửi, Shift + Enter để xuống dòng. Không nhập thông tin nhận dạng không cần thiết.</p>
                    {selectedModeUnavailable ? <p className={styles.inFlightNotice}>Chế độ của cuộc trò chuyện này tạm chưa khả dụng. Bạn có thể đọc lại lịch sử hoặc mở cuộc trò chuyện mới ở chế độ khác.</p> : null}
                    {selectedSummary?.inFlight ? <p className={styles.inFlightNotice}>Tin nhắn trước có thể vẫn đang xử lý. Bạn có thể thử lại; máy chủ sẽ chỉ nhận yêu cầu mới khi lượt cũ đã hết hạn.</p> : null}
                    {sendFailure ? <p className={styles.composerError} id="patient-chat-error" role="alert">{sendFailure.message}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {sending ? (
                      <button
                        className={styles.secondaryButton}
                        onClick={handleStopSend}
                        aria-label="Dừng chờ phản hồi"
                        title="Dừng chờ phản hồi"
                        type="button"
                      >
                        Dừng
                      </button>
                    ) : null}
                    <button
                      className={styles.sendButton}
                      disabled={!selectedConversationId || sendLocked || !draftIsValid || currentConsentRequired || selectedModeUnavailable}
                      type="submit"
                    >
                      <UiIcon name="send" size={18} />
                      {sending ? "Đang gửi" : selectedSummary?.inFlight ? "Thử gửi lại" : "Gửi tin nhắn"}
                    </button>
                  </div>
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
  const session = useAuthSession();
  return (
    <AssistantProvider initialMode={DEFAULT_CHAT_MODE} key={session?.user.id ?? "guest"}>
      <PatientChatPageContent session={session} />
    </AssistantProvider>
  );
}
