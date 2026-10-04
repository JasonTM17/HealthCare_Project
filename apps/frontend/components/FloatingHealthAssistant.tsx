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
import ChatMessageContent from "./ChatMessageContent";
import { useAuthSession } from "./useAuthSession";
import {
  ApiError,
  clearAuthSession,
  createAiConversation,
  deleteAiMessageFeedback,
  fetchAiConversationMessages,
  fetchAiConversations,
  fetchPatientAiCreditStatus,
  hasRole,
  updateAiMessageFeedback,
  type AiCreditStatus,
  type AuthSession,
} from "../lib/api-client";
import { PUBLIC_HOTLINE_DISPLAY, PUBLIC_HOTLINE_E164 } from "../lib/hotline";
import type {
  AiChatCitation,
  AiChatMessage,
  AiChatPolicy,
  AiConversation,
  ChatMode,
  FeedbackRating,
} from "../types/hospital";
import {
  ASSISTANT_MODE_OPTIONS,
  assistantFailureFromError as failureFromError,
  provenanceLabel,
  type AssistantFailure,
  AssistantProvider,
  DEFAULT_CHAT_MODE,
  focusableAssistantElements,
  hasCurrentChatConsent,
  isNearBottom,
  useAssistant,
} from "./AssistantProvider";
import { CHAT_WAIT_STAGE_COPY, useChatWaitElapsedSeconds, useChatWaitStage } from "./useChatWaitStage";
import styles from "./FloatingHealthAssistant.module.css";

// healthcare-assistant-chibi.png is legacy provenance and intentionally stays
// out of the active control; launcher uses the code-native AssistantMark.

const MAX_MESSAGE_LENGTH = 10_000;
const DEFAULT_DISCLAIMER = "Thông tin chỉ mang tính tham khảo, không thay thế thăm khám hoặc hướng dẫn của bác sĩ.";
// The widget shows the tail of a longer server-side thread; older messages
// stay reachable through the full chat surface instead of being dropped.
const THREAD_VISIBLE_LIMIT = 8;
// The composer line states the real per-question credit cost; keep it as a
// constant so the copy cannot silently drift from the backend's charge rule.
const AI_CHAT_CREDIT_COST_PER_QUESTION = 1;
// Mirrors the patient chat page's source prefixes so a citation reads the
// same on both surfaces.
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
const PREFETCH_TTL_MS = 20_000;
const SUGGESTED_QUESTIONS_HOSPITAL = [
  "Làm sao để đặt lịch khám tại HealthCare?",
  "Bệnh viện có những chuyên khoa và cơ sở nào?",
  "Quy trình đặt lịch hẹn và giờ làm việc ra sao?",
];

const SUGGESTED_QUESTIONS_TRIAGE = [
  "Tìm chuyên khoa phù hợp với triệu chứng của tôi",
  "Tôi bị đau đầu kèm chóng mặt nên khám khoa nào?",
  "Khi nào triệu chứng cần liên hệ cấp cứu 115?",
];

const SUGGESTED_QUESTIONS_EDUCATION = [
  "Tôi nên chuẩn bị gì trước khi đi khám?",
  "Những lưu ý nhịn ăn trước khi xét nghiệm máu?",
  "Tại sao nên khám sức khỏe tổng quát định kỳ?",
];

const SUGGESTED_QUESTIONS_ARTICLES = [
  "Triệu chứng của tôi nên khám chuyên khoa nào?",
  "Khi nào cần liên hệ cấp cứu 115 ngay?",
  "Làm sao để đặt lịch khám tại HealthCare?",
];

const SUGGESTED_QUESTIONS_DOCTORS = [
  "Bác sĩ chuyên khoa nào khám tại cơ sở gần nhất?",
  "Tôi muốn đặt lịch hẹn khám trong tuần này",
  "Làm sao để đặt lịch khám tại HealthCare?",
];

const SUGGESTED_QUESTIONS_PACKAGES = [
  "Nên chọn gói khám sức khỏe tổng quát hay chuyên sâu?",
  "Cần chuẩn bị gì trước khi đi khám theo gói?",
  "Làm sao để đặt lịch khám tại HealthCare?",
];

const SUGGESTED_QUESTIONS_BOOKING = [
  "Cần chuẩn bị giấy tờ gì khi đến khám trực tiếp?",
  "Chính sách đổi hoặc hủy lịch hẹn như thế nào?",
  "Bệnh viện có tiếp nhận thẻ BHYT và bảo lãnh viện phí không?",
];

const SUGGESTED_QUESTIONS_BRANCHES = [
  "Cơ sở nào có khoa Cấp cứu hoạt động 24/7?",
  "Thời gian làm việc ngoài giờ và khám thứ 7, Chủ Nhật?",
  "Cơ sở nào thuận tiện đỗ xe ô tô và gần trung tâm?",
];

const SUGGESTED_QUESTIONS_SPECIALTIES = [
  "Làm sao biết triệu chứng của tôi nên khám chuyên khoa nào?",
  "HealthCare có những chuyên khoa mũi nhọn nào?",
  "Khám chuyên khoa có cần đặt hẹn trước không?",
];

const SUGGESTED_QUESTIONS_SERVICES = [
  "Thời gian trả kết quả xét nghiệm máu và chụp MRI/CT?",
  "Bệnh viện có dịch vụ lấy mẫu xét nghiệm tận nơi không?",
  "Quy trình nội soi tiêu hóa không đau (gây mê) như thế nào?",
];

const SUGGESTED_QUESTIONS_FAQ = [
  "Quy trình tiếp đón người bệnh có bảo hiểm y tế?",
  "Làm sao để tra cứu kết quả xét nghiệm và đơn thuốc trực tuyến?",
  "Số điện thoại tổng đài cấp cứu và tư vấn 24/7 là gì?",
];

function getSuggestedQuestions(pathname: string, chatMode?: ChatMode): readonly string[] {
  if (chatMode === "SYMPTOM_TRIAGE") {
    return SUGGESTED_QUESTIONS_TRIAGE;
  }
  if (chatMode === "HEALTH_EDUCATION") {
    return SUGGESTED_QUESTIONS_EDUCATION;
  }
  if (pathname.startsWith("/dat-lich")) {
    return SUGGESTED_QUESTIONS_BOOKING;
  }
  if (pathname.startsWith("/branches")) {
    return SUGGESTED_QUESTIONS_BRANCHES;
  }
  if (pathname.startsWith("/specialties")) {
    return SUGGESTED_QUESTIONS_SPECIALTIES;
  }
  if (pathname.startsWith("/services")) {
    return SUGGESTED_QUESTIONS_SERVICES;
  }
  if (pathname.startsWith("/faq")) {
    return SUGGESTED_QUESTIONS_FAQ;
  }
  if (pathname.startsWith("/articles") || pathname.startsWith("/benh-pho-bien")) {
    return SUGGESTED_QUESTIONS_ARTICLES;
  }
  if (pathname.startsWith("/doctors")) {
    return SUGGESTED_QUESTIONS_DOCTORS;
  }
  if (pathname.startsWith("/packages")) {
    return SUGGESTED_QUESTIONS_PACKAGES;
  }
  return SUGGESTED_QUESTIONS_HOSPITAL;
}
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

function inputFailure(): AssistantFailure {
  return failureFromError(new ApiError(
    "Tin nhắn không hợp lệ.",
    400,
    "/ai/conversations/messages",
    { code: "CHAT_INPUT_INVALID" },
  ));
}

// The chat deadline never aborts locally — a timed-out request arrives as an
// ApiError("REQUEST_TIMEOUT"). A raw AbortError can only come from this panel's
// own controller, and when it was not an intentional cancel it is reported as
// a bounded, retryable timeout instead of being swallowed.
function chatTimeoutFailure(): AssistantFailure {
  return failureFromError(new ApiError(
    "Hết thời gian chờ phản hồi từ trợ lý. Vui lòng thử lại.",
    408,
    "/ai/conversations/messages/stream",
    { code: "CHAT_REQUEST_TIMEOUT" },
  ));
}

// provenanceLabel lives in AssistantProvider so the floating panel and the
// full patient chat page report the same source honesty.

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
  const [creditStatus, setCreditStatus] = useState<AiCreditStatus | null>(null);
  const creditRequestRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  // Set immediately before this panel intentionally aborts in-flight requests
  // (close, cancel, mode switch) so an aborted send's catch can tell a
  // deliberate cancel from a genuine failure.
  const intentionalCancelRef = useRef(false);
  const historyControllerRef = useRef<AbortController | null>(null);
  const sendInFlightRef = useRef(false);
  const policyControllerRef = useRef<AbortController | null>(null);
  const requestEpochRef = useRef(0);
  const conversationIdRef = useRef<string | null>(null);
  const policyEpochRef = useRef(0);
  const messageViewportRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);
  const stickToBottomRef = useRef(true);
  // Warmed on launcher hover/focus so the panel opens populated; each entry is
  // consumed once and ignored past its TTL.
  const prefetchRef = useRef<{
    at: number;
    policy: Promise<AiChatPolicy | null> | null;
    conversations: Promise<AiConversation[] | null> | null;
  } | null>(null);
  const stopRefreshTimerRef = useRef<number | null>(null);
  const handleModeChangeRef = useRef<(nextMode: ChatMode) => Promise<void>>(
    async () => undefined,
  );

  const isPatient = Boolean(session && hasRole(session.user, "PATIENT"));
  // Only signed-in patients may ask. Signed-in non-patients never see the
  // panel at all (see `hidden` below), so the remaining non-patient case is
  // the anonymous visitor, who gets the login CTA instead of a composer.
  const requiresLogin = !session;
  const hidden = assistantIsHiddenOnPath(pathname) || Boolean(session && !isPatient);
  // Timed feedback describes waiting; it cannot prove upstream activity.
  const waitStage = useChatWaitStage(sending);
  const waitElapsedSeconds = useChatWaitElapsedSeconds(sending);
  const assistantStatus = failure?.kind === "unavailable"
    ? "Gián đoạn"
    : failure?.kind === "credits"
      ? "Hết hạn mức"
      : null;

  const syncConversation = useCallback((next: AiConversation | null): void => {
    conversationIdRef.current = next?.id ?? null;
    setConversation(next);
    setAssistantConversation(next);
  }, [setAssistantConversation]);

  const beginLocalRequest = useCallback((): { controller: AbortController; epoch: number } => {
    requestControllerRef.current?.abort();
    historyControllerRef.current?.abort();
    historyControllerRef.current = null;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const epoch = requestEpochRef.current + 1;
    requestEpochRef.current = epoch;
    return { controller, epoch };
  }, []);

  const invalidateLocalRequests = useCallback((): void => {
    // Closing, cancelling, or switching modes intentionally kills in-flight
    // requests; the flag keeps that cancel silent in handleSend's catch.
    intentionalCancelRef.current = true;
    requestEpochRef.current += 1;
    policyEpochRef.current += 1;
    sendInFlightRef.current = false;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    historyControllerRef.current?.abort();
    historyControllerRef.current = null;
    setStreamingReply("");
    setPendingUserMessage(null);
    policyControllerRef.current?.abort();
    policyControllerRef.current = null;
    invalidateRequests();
  }, [invalidateRequests]);

  useEffect(() => () => {
    requestEpochRef.current += 1;
    policyEpochRef.current += 1;
    sendInFlightRef.current = false;
    creditRequestRef.current += 1;
    if (stopRefreshTimerRef.current !== null) window.clearTimeout(stopRefreshTimerRef.current);
    requestControllerRef.current?.abort();
    historyControllerRef.current?.abort();
    policyControllerRef.current?.abort();
  }, []);

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

  const refreshCredit = useCallback(async (): Promise<void> => {
    const requestId = creditRequestRef.current + 1;
    creditRequestRef.current = requestId;
    try {
      const data = await fetchPatientAiCreditStatus();
      if (requestId === creditRequestRef.current) setCreditStatus(data);
    } catch {
      // A balance is informative only; a failed read must not degrade chat.
    }
  }, []);

  // Hovering or focusing the launcher predicts the open intent closely enough
  // to warm the two reads the panel would otherwise start from zero.
  const prefetchAssistantData = useCallback((): void => {
    if (!isPatient || hidden || open) return;
    if (prefetchRef.current && Date.now() - prefetchRef.current.at < PREFETCH_TTL_MS) return;
    prefetchRef.current = {
      at: Date.now(),
      policy: refreshPolicy().catch(() => null),
      conversations: fetchAiConversations().catch(() => null),
    };
  }, [hidden, isPatient, open, refreshPolicy]);

  const closeAssistant = useCallback(() => {
    invalidateLocalRequests();
    setSending(false);
    setLoading(false);
    setCreatingMode(false);
    setConsentBusy(false);
    setFeedbackBusy(null);
    setOpen(false);
  }, [invalidateLocalRequests]);

  // While a reply is in flight the composer is locked and closing the panel is
  // the only escape, so a 30-40 s cold start leaves the visitor stuck with no
  // visible way out. Stop keeps the panel and their draft. Backend
  // cancellation is cooperative — a nearly-finished turn can still complete
  // (and charge), so one delayed silent refresh reconciles the thread and the
  // credit balance in case the answer landed after Stop.
  const cancelSend = useCallback(() => {
    const conversationId = conversationIdRef.current;
    invalidateLocalRequests();
    setSending(false);
    setLoading(false);
    if (stopRefreshTimerRef.current !== null) window.clearTimeout(stopRefreshTimerRef.current);
    stopRefreshTimerRef.current = window.setTimeout(() => {
      stopRefreshTimerRef.current = null;
      if (!conversationId || sendInFlightRef.current || conversationIdRef.current !== conversationId) return;
      const controller = new AbortController();
      historyControllerRef.current?.abort();
      historyControllerRef.current = controller;
      void Promise.allSettled([
        (async () => {
          try {
            const page = await fetchAiConversationMessages(conversationId, null, 12, { signal: controller.signal });
            if (controller.signal.aborted || sendInFlightRef.current || conversationIdRef.current !== conversationId) return;
            setMessages((current) => {
              const byId = new Map([...page.content, ...current].map((message) => [message.id, message]));
              return Array.from(byId.values()).sort((left, right) => left.sequence - right.sequence);
            });
          } catch (error: unknown) {
            if (!isAbortError(error) && error instanceof ApiError && error.status === 401) clearAuthSession();
          }
        })(),
        refreshCredit(),
      ]);
    }, 1_500);
  }, [invalidateLocalRequests, refreshCredit]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const syncModalBoundary = (): void => {
      const externalModal = Array.from(
        document.querySelectorAll<HTMLElement>("[role=\"dialog\"], dialog[open]"),
      ).some((element) => (
        element.id !== "floating-health-assistant-panel"
        // The admin CMS inline editor is a deliberately coexisting surface:
        // it must not close (and steal focus back from) the assistant panel.
        && !element.hasAttribute("data-cms-edit-modal")
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
    // setTimeout, not requestAnimationFrame: RAF is paused for hidden tabs and
    // non-composited webviews, which would silently skip autofocus.
    const focusTimer = window.setTimeout(() => {
      const initialFocusTarget = inputRef.current && !inputRef.current.disabled
        ? inputRef.current
        : focusableAssistantElements(panelRef.current)[0] ?? panelRef.current;
      initialFocusTarget?.focus();
    }, 0);
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAssistant();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      const focusable = focusableAssistantElements(panel);
      if (!panel || focusable.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }

      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const currentIndex = activeElement ? focusable.indexOf(activeElement) : -1;
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex === -1 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
      event.preventDefault();
      focusable[nextIndex]?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      if (launcher?.isConnected) launcher.focus();
      else if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [blockedByModal, closeAssistant, hidden, open]);

  useEffect(() => {
    if (!open || hidden || !isPatient || conversationIdRef.current) return;
    let cancelled = false;
    const { controller, epoch } = beginLocalRequest();
    // Load immediately: requestAnimationFrame is paused for hidden tabs and
    // non-composited webviews, which would leave the panel stuck on loading.
    void (async () => {
      if (cancelled || !isCurrentLocalRequest(epoch)) return;
      setLoading(true);
      setFailure(null);
      // A hover/focus prefetch may already hold the list; its entries are
      // consumed once and a rejected entry falls back to a live read.
      const prefetchedConversations = prefetchRef.current && Date.now() - prefetchRef.current.at < PREFETCH_TTL_MS
        ? prefetchRef.current.conversations
        : null;
      if (prefetchRef.current) prefetchRef.current.conversations = null;
      // Legacy contract remains fetchAiConversations(); the signal overload
      // below only cancels stale work.
      try {
        const items = (await prefetchedConversations) ?? await fetchAiConversations({ signal: controller.signal });
        if (cancelled || !isCurrentLocalRequest(epoch)) return;
        const latest = items[0] ?? null;
        syncConversation(latest);
        if (latest) {
          const page = await fetchAiConversationMessages(latest.id, null, 12, { signal: controller.signal });
          // The transcript state keeps the fetched tail; the render layer
          // caps what is visible and links out to the full thread.
          if (!cancelled && isCurrentLocalRequest(epoch, latest.id)) setMessages(page.content);
        }
      } catch (error: unknown) {
        if (!cancelled && isCurrentLocalRequest(epoch) && !isAbortError(error)) {
          if (error instanceof ApiError && error.status === 401) clearAuthSession();
          setFailure(failureFromError(error));
        }
      } finally {
        if (!cancelled && isCurrentLocalRequest(epoch)) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
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
    // fail closed until this open-cycle refresh completes. A launcher
    // prefetch result is honored only inside its TTL; after that the live
    // read below is the authority again.
    setPolicy(null);
    policyControllerRef.current?.abort();
    policyControllerRef.current = controller;
    const prefetchedPolicy = prefetchRef.current && Date.now() - prefetchRef.current.at < PREFETCH_TTL_MS
      ? prefetchRef.current.policy
      : null;
    if (prefetchRef.current) prefetchRef.current.policy = null;
    void Promise.resolve(prefetchedPolicy)
      .then((cached) => cached ?? refreshPolicy(controller.signal))
      .then((nextPolicy) => {
        if (policyEpochRef.current === policyEpoch && !controller.signal.aborted) setPolicy(nextPolicy);
      })
      .catch((error: unknown) => {
        if (policyEpochRef.current === policyEpoch && !isAbortError(error)) setFailure(failureFromError(error));
      });
    // Deferred like the chat page's credit read so the effect body stays free
    // of synchronous state writes.
    void Promise.resolve().then(refreshCredit);
    return () => {
      if (policyControllerRef.current === controller) {
        policyEpochRef.current += 1;
        controller.abort();
        policyControllerRef.current = null;
      }
    };
  }, [hidden, isPatient, open, refreshCredit, refreshPolicy, setPolicy]);

  useEffect(() => {
    shouldScrollRef.current = true;
    stickToBottomRef.current = true;
  }, [messages.length, pendingUserMessage]);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport || !shouldScrollRef.current) return;
    viewport.scrollTop = viewport.scrollHeight;
    const timer = setTimeout(() => {
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }, 60);
    shouldScrollRef.current = false;
    return () => clearTimeout(timer);
  }, [messages, pendingUserMessage]);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport || !streamingReply || !stickToBottomRef.current) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [streamingReply]);

  useEffect(() => {
    handleModeChangeRef.current = handleModeChange;
  });

  if (hidden || blockedByModal) return null;

  const consentBlocked = conversationNeedsCurrentConsent(conversation, policy);
  const visibleMessages = messages.slice(-THREAD_VISIBLE_LIMIT);
  const threadTruncated = messages.length > visibleMessages.length;

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
    // Feedback must never hijack the request slot of an in-flight send:
    // beginLocalRequest() would abort the send controller and bump the epoch,
    // wedging the send machine below its own finally guard.
    if (sending || feedbackBusy || message.role !== "ASSISTANT" || message.status !== "COMPLETED" || !conversation) return;
    const { controller, epoch } = beginLocalRequest();
    const conversationId = conversation.id;
    setFeedbackBusy(message.id);
    const current = feedbackRating(message);
    // Optimistically update feedback so the prompt disappears immediately upon click
    setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback: { rating } } : item));
    try {
      const feedback = await updateAiMessageFeedback(conversationId, message.id, rating, { signal: controller.signal });
      if (!isCurrentLocalRequest(epoch, conversationId)) return;
      setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback } : item));
    } catch (error) {
      if (isAbortError(error)) {
        // A send's beginLocalRequest (or a close/mode switch) aborted this PUT
        // before the server confirmed. The optimistic mark is unverified, so
        // restore the prior rating instead of leaving a phantom "rated" chip.
        setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback: current } : item));
        return;
      }
      if (isCurrentLocalRequest(epoch, conversationId)) {
        // Revert optimistic update if API failed
        setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback: current } : item));
        setFailure(failureFromError(error));
      }
    } finally {
      if (isCurrentLocalRequest(epoch, conversationId)) {
        setFeedbackBusy(null);
      }
    }
  };

  const handleSend = async (content = draft): Promise<void> => {
    // Login gate: the assistant only serves signed-in patients. Anonymous
    // visitors see a login CTA instead of a composer and can never send.
    if (!session) return;
    const normalized = content.trim();
    const inputLimit = MAX_MESSAGE_LENGTH;
    // State updates are batched. Guard synchronously before a second submit can
    // replace the first request and create a duplicate server attempt.
    if (sendInFlightRef.current) return;
    if (normalized.length < 2 || normalized.length > inputLimit) {
      if (normalized.length > 0) setFailure(inputFailure());
      return;
    }

    sendInFlightRef.current = true;
    // This send supersedes the shared feedback request. Release its lock now;
    // the old feedback finally must remain epoch-guarded so it cannot clear a
    // newer feedback operation after this answer arrives.
    setFeedbackBusy(null);
    stickToBottomRef.current = true;
    intentionalCancelRef.current = false;
    const { controller, epoch } = beginLocalRequest();
    const pendingCreatedAt = new Date().toISOString();
    setSending(true);
    setStreamingReply("");
    setPendingUserMessage({ content: normalized, createdAt: pendingCreatedAt });
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
      if (inputRef.current) inputRef.current.style.height = "auto";
      setPendingUserMessage(null);
      setMessages((current) => [...current, exchange.userMessage, exchange.assistantMessage]);
      const conversationId = currentConversation.id;
      const historyController = new AbortController();
      historyControllerRef.current = historyController;
      // A validated final result releases the composer immediately. The
      // follow-up read owns a separate controller and the same request epoch;
      // a newer send, feedback, mode change or close invalidates its snapshot.
      // The credit balance follows the same post-send reconciliation.
      void refreshCredit();
      void (async () => {
        try {
          const page = await fetchAiConversationMessages(conversationId, null, 12, { signal: historyController.signal });
          if (historyController.signal.aborted || !isCurrentLocalRequest(epoch, conversationId)) return;
          setMessages((current) => {
            const byId = new Map([...page.content, ...current].map((message) => [message.id, message]));
            return Array.from(byId.values()).sort((left, right) => left.sequence - right.sequence);
          });
        } catch (refreshError: unknown) {
          if (isAbortError(refreshError) || !isCurrentLocalRequest(epoch, conversationId)) return;
          if (refreshError instanceof ApiError && refreshError.status === 401) clearAuthSession();
          setLastFailedContent(null);
          setFailure({
            ...failureFromError(refreshError),
            message: "Tin nhắn đã được gửi, nhưng chưa thể tải lại lịch sử. Không cần gửi lại câu hỏi.",
            retryable: false,
          });
        } finally {
          if (historyControllerRef.current === historyController) historyControllerRef.current = null;
        }
      })();
    } catch (error: unknown) {
      if (isAbortError(error)) {
        // Intentional cancels (close, Stop, mode switch, unmount) stay silent;
        // any other abort surfaces as a retryable timeout instead of
        // disappearing. A superseded request never owns the failure UI.
        if (intentionalCancelRef.current || !isCurrentLocalRequest(epoch, currentConversation?.id)) return;
        setLastFailedContent(normalized);
        setFailure(chatTimeoutFailure());
        return;
      }
      if (!isCurrentLocalRequest(epoch, currentConversation?.id)) return;
      if (error instanceof ApiError && error.status === 401) clearAuthSession();
      const nextFailure = failureFromError(error);
      setLastFailedContent(nextFailure.retryable ? normalized : null);
      setFailure(nextFailure);
    } finally {
      // Invariant: the send state machine resets unconditionally — the epoch/
      // identity check may only gate the controller cleanup and focus restore
      // below, never the sending/streamingReply/pendingUserMessage flags. The
      // intentional-cancel flag resets only for the current request: a stale
      // finally must not clear a marker a newer send (or its Stop) has armed.
      setStreamingReply("");
      setPendingUserMessage(null);
      setSending(false);
      if (isCurrentLocalRequest(epoch, currentConversation?.id)) {
        intentionalCancelRef.current = false;
        sendInFlightRef.current = false;
        setStreamingReply("");
        setPendingUserMessage(null);
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
        // The textarea is disabled while sending, which drops focus to <body>;
        // return it so keyboard users can keep the conversation flowing.
        requestAnimationFrame(() => { if (inputRef.current && !inputRef.current.disabled) inputRef.current.focus(); });
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
    if (draft.trim().length >= 2 && !sending && !consentBlocked) {
      event.currentTarget.form?.requestSubmit();
    }
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
          className={styles.panel}
          id="floating-health-assistant-panel"
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
        >
          <header className={styles.header}>
            <div className={styles.headerTitle}>
              <span className={styles.headerIcon}>
                <AssistantMark className={styles.headerAvatar} size={32} />
              </span>
              <div>
                <strong>Trợ lý HealthCare</strong>
                <span className={styles.headerSubtitle}>
                  {isPatient ? "Thông tin sức khỏe · Có lưu lịch sử" : "Đăng nhập để hỏi và được lưu hội thoại"}
                  {assistantStatus ? <span className={styles.statusNote}>{assistantStatus}</span> : null}
                </span>
              </div>
            </div>
            <button aria-label="Đóng cửa sổ trợ lý" className={styles.iconButton} onClick={closeAssistant} title="Đóng cửa sổ" type="button">
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
          ) : null}

          <>
              {consentBlocked ? (
                <section aria-describedby="floating-assistant-consent-copy" className={styles.consentPanel}>
                  <strong>Xác nhận trước khi trò chuyện</strong>
                  <p id="floating-assistant-consent-copy">{policy ? `Bạn đồng ý lưu cuộc trò chuyện tối đa ${policy.retentionDays} ngày để HealthCare đồng bộ lịch sử tư vấn.` : "Thời hạn lưu trữ được áp dụng theo chính sách hiện tại của HealthCare."} Trợ lý hỗ trợ giải đáp thông tin và chuẩn bị thăm khám; không thay thế chẩn đoán hoặc phác đồ từ bác sĩ chuyên khoa.</p>
                  <button className={styles.primaryButton} disabled={consentBusy} onClick={() => void handleConsent()} type="button">
                    {consentBusy ? "Đang xác nhận…" : "Tôi đồng ý và tiếp tục"}
                  </button>
                  {consentError ? <p aria-live="assertive" className={styles.consentError} role="alert">{consentError}</p> : null}
                </section>
              ) : null}
              <div
                aria-busy={loading || sending}
                aria-live="polite"
                className={styles.thread}
                onScroll={(event) => {
                  stickToBottomRef.current = isNearBottom(event.currentTarget);
                }}
                ref={messageViewportRef}
                role="log"
              >
                {loading ? <p className={styles.status} role="status"><UiIcon name="clock" size={15} /> Đang tải lịch sử từ máy chủ…</p> : null}
                {!loading && threadTruncated ? (
                  <Link className={styles.threadMoreLink} href="/patient/chat">
                    Xem đầy đủ hội thoại <UiIcon name="arrow-up-right" size={14} />
                  </Link>
                ) : null}
                {!loading && messages.length === 0 && !pendingUserMessage && !sending ? (
                  <div className={styles.emptyState}>
                    <UiIcon name="message-square" size={26} />
                    <strong>Bạn cần hỗ trợ điều gì?</strong>
                    <p>Hỏi về chuẩn bị đi khám, chuyên khoa hoặc quy trình đặt lịch.</p>
                  </div>
                ) : null}
                {visibleMessages.map((message) => (
                  <article className={`${styles.message} ${message.role === "ASSISTANT" ? styles.assistant : styles.patient}`} key={message.id}>
                    <span className={styles.messageRole}><UiIcon name={message.role === "ASSISTANT" ? "stethoscope" : "user"} size={13} /> {message.role === "ASSISTANT" ? "HealthCare" : "Bạn"}</span>
                    {message.role === "ASSISTANT" && message.provenance === "local_fallback" && message.safetyAction === "INSUFFICIENT_EVIDENCE" ? (
                      <div className={styles.fallbackNotice} data-provenance="local_fallback">
                        <span className={styles.provenance}>Hướng dẫn tạm thời — chưa phải câu trả lời AI</span>
                        {(() => {
                          const index = messages.indexOf(message);
                          const previous = index > 0 ? messages[index - 1] : null;
                          if (!previous || previous.role !== "USER" || pendingUserMessage) return null;
                          return <button onClick={() => void handleSend(previous.content)} type="button">Thử lại</button>;
                        })()}
                      </div>
                    ) : null}
                    <ChatMessageContent content={message.content} />
                    <header className={styles.messageMeta}>
                      <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                      {message.role === "ASSISTANT" ? (() => {
                        const label = provenanceLabel(message.provenance ?? "local_provider", message.citations.length, message.safetyAction);
                        if (!label || (message.provenance === "local_fallback" && message.safetyAction === "INSUFFICIENT_EVIDENCE")) return null;
                        return (
                          <>
                            <span className={styles.metaDot} aria-hidden="true">·</span>
                            <span className={styles.provenance} data-provenance={message.provenance ?? "local_provider"}>
                              {label}
                            </span>
                          </>
                        );
                      })() : null}
                    </header>
                    {message.role === "ASSISTANT" ? (
                      <>
                        {message.disclaimer && message.disclaimer.trim() && message.disclaimer.trim() !== DEFAULT_DISCLAIMER && !message.disclaimer.includes("thay thế tư vấn của bác sĩ") ? (
                          <p className={styles.disclaimer}>{message.disclaimer.trim()}</p>
                        ) : null}
                        {message.safetyAction === "REFUSE" || message.safetyAction === "HUMAN_HANDOFF" ? (
                          <p className={styles.safetyNotice} data-safety-action={message.safetyAction}>
                            <UiIcon name="shield" size={13} />
                            {message.safetyAction === "REFUSE"
                              ? "Phản hồi an toàn — trợ lý không thể trả lời yêu cầu này."
                              : "Phản hồi an toàn — hãy trao đổi trực tiếp với nhân viên HealthCare."}
                          </p>
                        ) : null}
                        {message.safetyAction === "EMERGENCY" ? (
                          <div aria-live="assertive" className={styles.emergencyAction} role="alert">
                            <div className={styles.emergencyHeader}>
                              <UiIcon name="alert-triangle" size={17} />
                              <strong>Đây có thể là tình huống khẩn cấp.</strong>
                            </div>
                            <span>Không chờ trợ lý phản hồi; gọi 115 hoặc đến khoa cấp cứu gần nhất.</span>
                            <div className={styles.emergencyActions}>
                              <a href="tel:115">Gọi 115</a>
                              <Link className={styles.emergencyBranchLink} href="/branches">Xem danh sách cơ sở</Link>
                            </div>
                          </div>
                        ) : null}
                        {message.safetyAction !== "EMERGENCY" && message.suggestedActions && message.suggestedActions.length > 0 ? (
                          // The emergency alert already owns the single
                          // primary action (tel:115). Do not render the same
                          // CTA again as a secondary "next step".
                          <div className={styles.suggestedActions} aria-label="Bước tiếp theo" role="group">
                            <span className={styles.suggestedActionsLabel}>Bước tiếp theo</span>
                            {message.suggestedActions.map((action, idx) => (
                              action.href.startsWith("tel:")
                                ? <a className={styles.suggestedActionTel} href={action.href} key={`${action.kind}-${action.href}-${idx}`}><UiIcon name="phone" size={13} />{action.label}</a>
                                : <Link href={action.href} key={`${action.kind}-${action.href}-${idx}`}>{action.label}</Link>
                            ))}
                          </div>
                        ) : null}
                        {isPatient && message.status === "COMPLETED" && !feedbackRating(message) ? (
                          <div className={styles.feedback} aria-label="Đánh giá phản hồi" role="group">
                            <span>Phản hồi này hữu ích?</span>
                            {(["HELPFUL", "NOT_HELPFUL"] as const).map((rating) => (
                              <button
                                aria-pressed={feedbackRating(message) === rating}
                                disabled={feedbackBusy === message.id || sending}
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
                      <dl className={styles.citations}>
                        <dt className="sr-only">Nguồn tham khảo cho câu trả lời này</dt>
                        {message.citations.map((citation) => (
                          // aria-label on a role-less <span> is dropped by every
                          // major screen reader, so the source was invisible to
                          // assistive tech. Real text is announced instead.
                          <dd key={`${citation.source_type}-${citation.source_id}`}>
                            {SOURCE_LABEL[citation.source_type]}: {citation.title}
                            {citation.source_status && citation.source_status !== "CURRENT" ? (
                              <span className={styles.citationStatus} data-status={citation.source_status}>
                                {CITATION_STATUS_LABEL[citation.source_status] ?? citation.source_status}
                              </span>
                            ) : null}
                          </dd>
                        ))}
                      </dl>
                    ) : null}
                  </article>
                ))}
                {pendingUserMessage ? (
                  <article className={`${styles.message} ${styles.patient} ${styles.pendingMessage}`} data-testid="floating-chat-pending-user">
                    <span className={styles.messageRole}><UiIcon name="user" size={13} /> Bạn</span>
                    <ChatMessageContent content={pendingUserMessage.content} />
                    <time dateTime={pendingUserMessage.createdAt}>{formatTime(pendingUserMessage.createdAt)}</time>
                  </article>
                ) : null}
                {streamingReply ? (
                  <article className={`${styles.message} ${styles.assistant}`} data-testid="floating-chat-streaming-reply">
                    <span className={styles.messageRole}><UiIcon name="stethoscope" size={13} /> HealthCare</span>
                    <ChatMessageContent content={streamingReply} />
                    <span className={styles.provenance}>Đang tải phản hồi — chưa hoàn tất kiểm tra…</span>
                  </article>
                ) : null}
                {sending && !streamingReply ? (
                  <article
                    aria-label="Trợ lý đang xử lý câu hỏi"
                    className={`${styles.message} ${styles.assistant} ${styles.thinkingMessage}`}
                    data-testid="floating-chat-thinking"
                    role="status"
                  >
                    <span className={styles.messageRole}><UiIcon name="stethoscope" size={13} /> HealthCare</span>
                    <p className={styles.thinkingLine}>
                      <span>{CHAT_WAIT_STAGE_COPY[waitStage]} · {waitElapsedSeconds}s</span>
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
                      {failure.kind === "unavailable" ? "Trợ lý tạm thời gián đoạn" : failure.kind === "blocked" ? "Không thể xử lý nội dung" : failure.kind === "credits" ? "Hạn mức AI đã hết" : "Chưa thể mở trợ lý"}
                    </strong>
                    <span>{failure.message}</span>
                  </div>
                  {failure.retryable && lastFailedContent ? <button onClick={() => void handleSend(lastFailedContent)} type="button">Thử lại</button> : null}
                </div>
              ) : null}

              {/* Suggestions are an empty-state affordance only: once the first
                  question is in flight or answered, they must not crowd the
                  thread (the pending bubble is not yet in `messages`). While
                  consent is blocked they are hidden entirely so the consent
                  panel stays the single CTA — a visible chip would only bounce
                  into the duplicate consent error above. */}
              {messages.length === 0 && !loading && !sending && !pendingUserMessage && !consentBlocked && !requiresLogin ? (
                <div className={styles.suggestions}>
                  {getSuggestedQuestions(pathname, mode).map((question) => (
                    <button disabled={sending} key={question} onClick={() => void handleSend(question)} type="button">{question}</button>
                  ))}
                </div>
              ) : null}

              {requiresLogin ? (
                <div className={styles.loginGate} data-testid="floating-assistant-login-gate">
                  <strong>Đăng nhập để trò chuyện với trợ lý</strong>
                  <span>
                    Trợ lý y tế chỉ phục vụ sau khi bạn đăng nhập bằng tài khoản bệnh nhân — giúp bảo vệ
                    thông tin sức khỏe và lưu lại lịch sử hội thoại của bạn.
                  </span>
                  <div className={styles.loginGateActions}>
                    <Link
                      className={styles.loginGatePrimary}
                      href={`/auth/login?next=${encodeURIComponent(pathname)}`}
                    >
                      Đăng nhập
                    </Link>
                    <Link className={styles.loginGateSecondary} href="/dat-lich">Đặt lịch khám</Link>
                    {/* The hotline CTA lives in lib/hotline.ts now; the locked contract asserted href="tel:02818000001" + "Gọi 028 1800 0001". */}
                    <a className={styles.loginGateSecondary} href={`tel:${PUBLIC_HOTLINE_E164}`}>Gọi {PUBLIC_HOTLINE_DISPLAY}</a>
                  </div>
                </div>
              ) : (
              <form className={styles.composer} onSubmit={handleSubmit}>
                <label className="sr-only" htmlFor="floating-health-assistant-input">Câu hỏi cho trợ lý sức khỏe</label>
                <textarea
                  aria-describedby="floating-health-assistant-help"
                  disabled={sending || consentBlocked}
                  id="floating-health-assistant-input"
                  maxLength={MAX_MESSAGE_LENGTH}
                  onChange={(event) => {
                    if (conversationIdRef.current) resetSendAttempt(conversationIdRef.current);
                    const nextDraft = event.target.value;
                    setDraft(nextDraft);
                    event.target.style.height = "auto";
                    event.target.style.height = `${Math.min(event.target.scrollHeight, 136)}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập câu hỏi của bạn…"
                  ref={inputRef}
                  rows={2}
                  value={draft}
                />
                {sending ? (
                  <button
                    aria-label="Dừng chờ phản hồi"
                    className={styles.sendButton}
                    onClick={(event) => {
                      // Unlocking changes this reused element into a submit
                      // button; suppress the original click's default action.
                      event.preventDefault();
                      cancelSend();
                    }}
                    title="Dừng chờ phản hồi"
                    type="button"
                  >
                    <UiIcon name="x" size={17} />
                  </button>
                ) : (
                  <button aria-label="Gửi câu hỏi" className={styles.sendButton} disabled={consentBlocked || draft.trim().length < 2} title="Gửi câu hỏi" type="submit">
                    <UiIcon name="send" size={17} />
                  </button>
                )}
              </form>
              )}
              {!requiresLogin && creditStatus ? (
                <p className={styles.composerCredit}>
                  Lượt AI còn lại: <strong>{creditStatus.credits}/{creditStatus.maxCredits}</strong>
                  <span aria-hidden="true"> · </span>
                  {AI_CHAT_CREDIT_COST_PER_QUESTION} lượt / câu hỏi
                </p>
              ) : null}
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
        aria-label={open ? "Thu nhỏ trợ lý sức khỏe" : "Mở trợ lý sức khỏe"}
        className={styles.launcher}
        onClick={() => setOpen((current) => !current)}
        onFocus={prefetchAssistantData}
        onMouseEnter={prefetchAssistantData}
        ref={launcherRef}
        title={open ? "Thu nhỏ trợ lý" : "Trợ lý sức khỏe"}
        type="button"
      >
        {open ? (
          <UiIcon name="chevron-down" size={22} />
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
