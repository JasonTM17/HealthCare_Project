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
  deleteAiConversation,
  fetchAiConversation,
  fetchAiConversationMessages,
  fetchAiConversations,
  hasRole,
  sendAiConversationMessage,
} from "../../../lib/api-client";
import type {
  AiChatCitation,
  AiChatMessage,
  AiConversation,
} from "../../../types/hospital";
import styles from "./chat.module.css";

const MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LENGTH = 10_000;

interface ChatFailure {
  code: string | null;
  message: string;
  status?: number;
}

interface RetainedSendAttempt {
  conversationId: string;
  content: string;
  idempotencyKey: string;
}

interface SendContentOptions {
  clearDraftOnSuccess: boolean;
  sourceMessageId?: string;
}

const ERROR_COPY: Readonly<Record<string, string>> = {
  AI_CONVERSATION_NOT_FOUND: "Cuộc trò chuyện này không còn tồn tại. Hãy chọn cuộc trò chuyện khác.",
  CHAT_MESSAGE_IN_PROGRESS: "Trợ lý đang xử lý một tin nhắn khác trong cuộc trò chuyện này.",
  CHAT_IDEMPOTENCY_CONFLICT: "Yêu cầu gửi lại không còn khớp với tin nhắn ban đầu. Hãy thử lại từ lịch sử.",
  CHAT_INPUT_INVALID: "Tin nhắn phải có từ 2 đến 10.000 ký tự.",
  AI_UNAVAILABLE: "Trợ lý tạm thời chưa thể phản hồi. Tin nhắn thất bại có thể được gửi lại bằng nút Thử lại.",
  AI_RESPONSE_INVALID: "Phản hồi của trợ lý chưa đạt yêu cầu an toàn. Hãy thử gửi lại sau.",
  CHAT_CONTENT_BLOCKED: "Nội dung này không thể được xử lý. Hãy bỏ thông tin nhận dạng và diễn đạt lại câu hỏi.",
  CHAT_RETENTION_EXPIRED: "Cuộc trò chuyện đã hết thời hạn lưu trữ và không còn truy cập được.",
};

const TERMINAL_IDEMPOTENCY_CODES = new Set([
  "AI_UNAVAILABLE",
  "AI_RESPONSE_INVALID",
  "CHAT_CONTENT_BLOCKED",
  "CHAT_IDEMPOTENCY_CONFLICT",
]);

const SOURCE_LABEL: Readonly<Record<AiChatCitation["source_type"], string>> = {
  specialty: "Chuyên khoa",
  doctor: "Bác sĩ",
  service: "Dịch vụ",
  package: "Gói khám",
  article: "Bài viết",
  faq: "Hỏi đáp",
};

function toFailure(error: unknown): ChatFailure {
  if (error instanceof ApiError) {
    const knownMessage = error.code ? ERROR_COPY[error.code] : undefined;
    const statusMessage = error.status === 401
      ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      : error.status === 403
        ? "Tài khoản hiện tại không có quyền sử dụng trợ lý sức khỏe."
        : error.status === 429
          ? "Bạn đang gửi yêu cầu quá nhanh. Vui lòng chờ một lát rồi thử lại."
          : error.status === 0 || error.status >= 500
            ? "Kết nối tới trợ lý đang bị gián đoạn. Vui lòng thử lại sau ít phút."
            : "Yêu cầu chưa thể hoàn tất. Vui lòng kiểm tra và thử lại.";
    return { code: error.code, message: knownMessage ?? statusMessage, status: error.status };
  }

  return {
    code: null,
    message: "Kết nối tới trợ lý đang bị gián đoạn. Vui lòng thử lại sau ít phút.",
  };
}

function handleUnauthorized(failure: ChatFailure): void {
  if (failure.status === 401) clearAuthSession();
}

function backendRequiresNewIdempotencyKey(error: unknown): boolean {
  return error instanceof ApiError
    && error.code !== null
    && TERMINAL_IDEMPOTENCY_CODES.has(error.code);
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

function citationHref(citation: AiChatCitation): string {
  const query = new URLSearchParams({
    q: citation.title,
    source_type: citation.source_type,
    source_id: citation.source_id,
  });
  return `/search?${query.toString()}`;
}

function createIdempotencyKey(): string {
  return `chat-${crypto.randomUUID()}`;
}

function MessageItem({
  message,
  retryDisabled,
  onRetry,
}: {
  message: AiChatMessage;
  retryDisabled: boolean;
  onRetry: (message: AiChatMessage) => void;
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
                <Link href={citationHref(citation)}>
                  <span>{SOURCE_LABEL[citation.source_type]}: {citation.title}</span>
                  <UiIcon name="arrow-up-right" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {assistant && message.disclaimer ? (
        <p className={styles.messageDisclaimer}>{message.disclaimer}</p>
      ) : null}
    </li>
  );
}

export default function PatientChatPage() {
  const session = useAuthSession();
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
  const [sendFailure, setSendFailure] = useState<ChatFailure | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AiConversation | null>(null);
  const [deleteFailure, setDeleteFailure] = useState<ChatFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeIdRef = useRef<string | null>(null);
  const listRequestRef = useRef(0);
  const threadRequestRef = useRef(0);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);
  const shouldScrollToLatestRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const retainedSendAttemptsRef = useRef(new Map<string, RetainedSendAttempt>());

  const clearThread = useCallback(() => {
    threadRequestRef.current += 1;
    activeIdRef.current = null;
    setSelectedConversationId(null);
    setActiveConversation(null);
    setMessages([]);
    setNextCursor(null);
    setHasMoreMessages(false);
    setThreadFailure(null);
    setThreadLoading(false);
  }, []);

  const loadThread = useCallback(async (
    conversationId: string,
    options: { background?: boolean } = {},
  ): Promise<void> => {
    const requestId = ++threadRequestRef.current;
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
      const [conversation, page] = await Promise.all([
        fetchAiConversation(conversationId),
        fetchAiConversationMessages(conversationId, null, MESSAGE_LIMIT),
      ]);
      if (requestId !== threadRequestRef.current || activeIdRef.current !== conversationId) return;

      shouldScrollToLatestRef.current = true;
      setActiveConversation(conversation);
      setMessages(page.content);
      setNextCursor(page.nextCursor ?? null);
      setHasMoreMessages(page.hasMore);
      setConversations((current) => current.map((item) => item.id === conversation.id ? conversation : item));
    } catch (error) {
      if (requestId !== threadRequestRef.current || activeIdRef.current !== conversationId) return;
      const failure = toFailure(error);
      handleUnauthorized(failure);
      setThreadFailure(failure);
    } finally {
      if (requestId === threadRequestRef.current) setThreadLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (!shouldScrollToLatestRef.current || !messageViewportRef.current) return;
    messageViewportRef.current.scrollTop = messageViewportRef.current.scrollHeight;
    shouldScrollToLatestRef.current = false;
  }, [messages]);

  useEffect(() => {
    if (!deleteTarget || !deleteDialogRef.current || deleteDialogRef.current.open) return;
    deleteDialogRef.current.showModal();
  }, [deleteTarget]);

  if (!session) {
    return <main className="portal-entry"><LoginRequiredState nextPath="/patient/chat" /></main>;
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
  const sendLocked = sending;
  const interactionLocked = sendLocked || creating || deleting;
  const normalizedDraft = draft.trim();
  const draftIsValid = normalizedDraft.length >= 2 && normalizedDraft.length <= MAX_MESSAGE_LENGTH;

  const handleCreateConversation = async (): Promise<void> => {
    setCreating(true);
    setConversationFailure(null);
    setNotice(null);
    try {
      const conversation = await createAiConversation();
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
      setSendFailure({ code: "CHAT_INPUT_INVALID", message: ERROR_COPY.CHAT_INPUT_INVALID, status: 400 });
      return;
    }

    const attemptSlot = options.sourceMessageId ? `failed-message:${options.sourceMessageId}` : "composer";
    const attemptMapKey = `${conversationId}|${attemptSlot}`;
    const retainedAttempt = retainedSendAttemptsRef.current.get(attemptMapKey);
    const idempotencyKey = retainedAttempt?.content === normalizedContent
      ? retainedAttempt.idempotencyKey
      : createIdempotencyKey();
    retainedSendAttemptsRef.current.set(attemptMapKey, {
      conversationId,
      content: normalizedContent,
      idempotencyKey,
    });

    sendInFlightRef.current = true;
    setSending(true);
    setSendFailure(null);
    setNotice(null);
    try {
      await sendAiConversationMessage(conversationId, normalizedContent, idempotencyKey);
      retainedSendAttemptsRef.current.delete(attemptMapKey);
      if (options.clearDraftOnSuccess) setDraft("");
      setNotice("Trợ lý đã phản hồi. Lịch sử bên dưới được tải lại từ máy chủ.");
      await Promise.all([
        loadThread(conversationId, { background: true }),
        loadConversationList(conversationId, { hydrateThread: false, background: true }),
      ]);
    } catch (error) {
      const failure = toFailure(error);
      handleUnauthorized(failure);
      if (backendRequiresNewIdempotencyKey(error)) {
        retainedSendAttemptsRef.current.delete(attemptMapKey);
      }
      setSendFailure(failure);
      await Promise.allSettled([
        loadThread(conversationId, { background: true }),
        loadConversationList(conversationId, { hydrateThread: false, background: true }),
      ]);
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
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
              onRetry={(failedMessage) => void sendContent(failedMessage.content, {
                clearDraftOnSuccess: false,
                sourceMessageId: failedMessage.id,
              })}
              retryDisabled={sendLocked}
            />
          ))}
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
                          disabled={deleting}
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
                  disabled={!selectedConversationId || sendLocked}
                  id="patient-chat-message"
                  maxLength={MAX_MESSAGE_LENGTH}
                  minLength={2}
                  onChange={(event) => {
                    const nextDraft = event.target.value;
                    const conversationId = activeIdRef.current;
                    if (conversationId) {
                      const attemptMapKey = `${conversationId}|composer`;
                      const retainedAttempt = retainedSendAttemptsRef.current.get(attemptMapKey);
                      if (retainedAttempt && retainedAttempt.content !== nextDraft.trim()) {
                        retainedSendAttemptsRef.current.delete(attemptMapKey);
                      }
                    }
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
                    disabled={!selectedConversationId || sendLocked || !draftIsValid}
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
