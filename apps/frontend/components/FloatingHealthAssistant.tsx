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
import { useAuthSession } from "./useAuthSession";
import {
  ApiError,
  clearAuthSession,
  createAiConversation,
  fetchAiConversationMessages,
  fetchAiConversations,
  hasRole,
  sendAiConversationMessage,
} from "../lib/api-client";
import type {
  AiChatCitation,
  AiChatMessage,
  AiChatProvenance,
  AiConversation,
  AuthSession,
} from "../types/hospital";
import styles from "./FloatingHealthAssistant.module.css";

const MAX_MESSAGE_LENGTH = 10_000;
const DEFAULT_DISCLAIMER = "Thông tin chỉ mang tính tham khảo, không thay thế thăm khám hoặc hướng dẫn của bác sĩ.";
const SUGGESTED_QUESTIONS = [
  "Tôi nên chuẩn bị gì trước khi đi khám?",
  "Tìm chuyên khoa phù hợp với triệu chứng của tôi",
  "Làm sao để đặt lịch khám tại HealthCare?",
];

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

function citationHref(citation: AiChatCitation): string {
  const query = new URLSearchParams({
    q: citation.title,
    source_type: citation.source_type,
    source_id: citation.source_id,
  });
  return `/search?${query.toString()}`;
}

function FloatingHealthAssistantPanel({
  pathname,
  session,
}: {
  pathname: string;
  session: AuthSession | null;
}) {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<AssistantFailure | null>(null);
  const [lastFailedContent, setLastFailedContent] = useState<string | null>(null);
  const [blockedByModal, setBlockedByModal] = useState(false);
  const retainedAttemptRef = useRef<{ conversationId: string; content: string; key: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const isPatient = Boolean(session && hasRole(session.user, "PATIENT"));
  const hidden = pathname === "/patient/chat" || pathname.startsWith("/patient/chat/");
  const closeAssistant = useCallback(() => setOpen(false), []);

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
    if (!open || hidden || !isPatient || conversation) return;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      setLoading(true);
      setFailure(null);
      void fetchAiConversations()
        .then(async (items) => {
          if (cancelled) return;
          const latest = items[0] ?? null;
          setConversation(latest);
          if (latest) {
            const page = await fetchAiConversationMessages(latest.id, null, 12);
            if (!cancelled) setMessages(page.content.slice(-8));
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            if (error instanceof ApiError && error.status === 401) clearAuthSession();
            setFailure(failureFromError(error));
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [conversation, hidden, isPatient, open]);

  if (hidden || blockedByModal) return null;

  const ensureConversation = async (): Promise<AiConversation> => {
    if (conversation) return conversation;
    const created = await createAiConversation();
    setConversation(created);
    return created;
  };

  const handleSend = async (content = draft): Promise<void> => {
    const normalized = content.trim();
    if (!isPatient || sending || normalized.length < 2 || normalized.length > MAX_MESSAGE_LENGTH) {
      if (normalized.length > 0) setFailure(inputFailure());
      return;
    }

    setSending(true);
    setFailure(null);
    setLastFailedContent(null);
    let currentConversation: AiConversation | null = null;
    try {
      currentConversation = await ensureConversation();
      const retained = retainedAttemptRef.current;
      const key = retained
        && retained.conversationId === currentConversation.id
        && retained.content === normalized
        ? retained.key
        : createIdempotencyKey();
      retainedAttemptRef.current = { conversationId: currentConversation.id, content: normalized, key };
      const exchange = await sendAiConversationMessage(currentConversation.id, normalized, key);
      retainedAttemptRef.current = null;
      setDraft("");
      setMessages((current) => [...current, exchange.userMessage, exchange.assistantMessage].slice(-8));
      const page = await fetchAiConversationMessages(currentConversation.id, null, 12);
      setMessages(page.content.slice(-8));
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) clearAuthSession();
      if (error instanceof ApiError && ["AI_UNAVAILABLE", "AI_RESPONSE_INVALID", "CHAT_CONTENT_BLOCKED", "CHAT_IDEMPOTENCY_CONFLICT"].includes(error.code ?? "")) {
        retainedAttemptRef.current = null;
      }
      const nextFailure = failureFromError(error);
      setLastFailedContent(nextFailure.retryable ? normalized : null);
      setFailure(nextFailure);
    } finally {
      setSending(false);
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
                  src="/media/healthcare-assistant-chibi.png"
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

          {!session ? (
            <div className={styles.accessState}>
              <UiIcon name="shield-check" size={30} />
              <h2>Đăng nhập để trò chuyện</h2>
              <p>Lịch sử sức khỏe chỉ dành cho bệnh nhân đã đăng nhập và được lưu qua hệ thống HealthCare.</p>
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
              <div aria-busy={loading || sending} aria-live="polite" className={styles.thread} role="log">
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
                      </>
                    ) : null}
                    {message.role === "ASSISTANT" && message.citations.length > 0 ? (
                      <div className={styles.citations}>
                        {message.citations.slice(0, 2).map((citation) => (
                          <Link
                            aria-label={`Nguồn tham khảo: ${citation.title}`}
                            href={citationHref(citation)}
                            key={`${citation.source_type}-${citation.source_id}`}
                          >
                            {citation.title}
                            <UiIcon name="arrow-up-right" size={13} />
                          </Link>
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
                  disabled={sending}
                  id="floating-health-assistant-input"
                  maxLength={MAX_MESSAGE_LENGTH}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập câu hỏi của bạn..."
                  ref={inputRef}
                  rows={2}
                  value={draft}
                />
                <button aria-label={sending ? "Đang gửi câu hỏi" : "Gửi câu hỏi"} className={styles.sendButton} disabled={sending || draft.trim().length < 2} title="Gửi câu hỏi" type="submit">
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
            <Image
              alt=""
              className={styles.launcherAvatar}
              height={112}
              src="/media/healthcare-assistant-chibi.png"
              width={112}
            />
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

  return <FloatingHealthAssistantPanel key={stateKey} pathname={pathname} session={session} />;
}
