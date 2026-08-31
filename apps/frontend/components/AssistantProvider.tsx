"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AiChatPolicy,
  AiChatExchange,
  AiConversation,
  ChatMode,
} from "../types/hospital";
import {
  ApiError,
  fetchAiChatPolicy,
  sendAiConversationMessageStream,
  updateAiConversationConsent,
} from "../lib/api-client";

export const ASSISTANT_MODE_OPTIONS: ReadonlyArray<{
  value: ChatMode;
  label: string;
  description: string;
}> = [
  {
    value: "HOSPITAL_SUPPORT",
    label: "Thông tin bệnh viện",
    description: "Cơ sở, bác sĩ, dịch vụ và đặt lịch.",
  },
  {
    value: "SYMPTOM_TRIAGE",
    label: "Định hướng triệu chứng",
    description: "Phân loại mức độ ưu tiên, không chẩn đoán.",
  },
  {
    value: "HEALTH_EDUCATION",
    label: "Giải thích sức khỏe",
    description: "Bài viết và hỏi đáp đã được duyệt.",
  },
];

export const DEFAULT_CHAT_MODE: ChatMode = "HOSPITAL_SUPPORT";

export function assistantModeLabel(mode: ChatMode): string {
  return ASSISTANT_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? "Thông tin bệnh viện";
}

export function assistantModeDescription(mode: ChatMode): string {
  return ASSISTANT_MODE_OPTIONS.find((option) => option.value === mode)?.description ?? "Thông tin bệnh viện và đặt lịch.";
}

export function isAssistantMode(value: unknown): value is ChatMode {
  return ASSISTANT_MODE_OPTIONS.some((option) => option.value === value);
}

export function hasCurrentChatConsent(
  conversation: AiConversation | null | undefined,
  policy: AiChatPolicy | null | undefined,
): boolean {
  if (!conversation || !policy) return false;
  return Boolean(
    conversation.consentedAt
    && conversation.consentVersion
    && conversation.consentVersion === policy.policyVersion,
  );
}

const TERMINAL_IDEMPOTENCY_CODES = new Set([
  "AI_UNAVAILABLE",
  "AI_RESPONSE_INVALID",
  "CHAT_CONTENT_BLOCKED",
  "CHAT_IDEMPOTENCY_CONFLICT",
]);

export interface AssistantSendOptions {
  /** Stable logical attempt identity. Retries must pass the same value. */
  attemptId?: string;
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
}

export type AssistantFailureKind = "access" | "blocked" | "unavailable" | "generic";

export interface AssistantFailure {
  code: string | null;
  kind: AssistantFailureKind;
  message: string;
  retryable: boolean;
  status?: number;
}

const ASSISTANT_ERROR_COPY: Readonly<Record<string, string>> = {
  AI_CONVERSATION_NOT_FOUND: "Cuộc trò chuyện này không còn tồn tại. Hãy chọn cuộc trò chuyện khác.",
  CHAT_MESSAGE_IN_PROGRESS: "Trợ lý đang xử lý một tin nhắn khác trong cuộc trò chuyện này.",
  CHAT_IDEMPOTENCY_CONFLICT: "Yêu cầu gửi lại không còn khớp với tin nhắn ban đầu. Hãy thử lại từ lịch sử.",
  CHAT_INPUT_INVALID: "Tin nhắn phải có từ 2 đến 10.000 ký tự.",
  PUBLIC_CHAT_INPUT_INVALID: "Tin nhắn ở chế độ khách phải có từ 2 đến 500 ký tự.",
  AI_UNAVAILABLE: "Trợ lý tạm thời chưa thể phản hồi. Bạn có thể gửi lại câu hỏi.",
  AI_RESPONSE_INVALID: "Phản hồi của trợ lý chưa đạt yêu cầu an toàn. Hãy thử lại sau.",
  CHAT_CONTENT_BLOCKED: "Hãy bỏ thông tin nhận dạng cá nhân và thử diễn đạt lại câu hỏi.",
  CHAT_RETENTION_EXPIRED: "Cuộc trò chuyện đã hết thời hạn lưu trữ và không còn truy cập được.",
  REQUEST_TIMEOUT: "Phản hồi mất quá nhiều thời gian. Kết quả có thể đã được lưu; hãy kiểm tra lịch sử trước khi thử lại.",
};

export function assistantFailureFromError(error: unknown): AssistantFailure {
  if (!(error instanceof ApiError)) {
    return {
      code: null,
      kind: "unavailable",
      message: "Kết nối tới trợ lý đang bị gián đoạn. Vui lòng thử lại sau ít phút.",
      retryable: true,
    };
  }

  const code = error.code;
  const status = error.status;
  const knownMessage = code ? ASSISTANT_ERROR_COPY[code] : undefined;
  if (status === 401 || status === 403) {
    return {
      code,
      kind: "access",
      message: status === 401
        ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
        : "Tài khoản hiện tại không có quyền dùng trợ lý sức khỏe.",
      retryable: false,
      status,
    };
  }
  if (code === "CHAT_CONTENT_BLOCKED" || code === "CHAT_INPUT_INVALID" || code === "PUBLIC_CHAT_INPUT_INVALID") {
    return { code, kind: "blocked", message: knownMessage ?? "Yêu cầu chưa thể hoàn tất.", retryable: false, status };
  }
  const retryable = status === 0
    || status >= 500
    || status === 429
    || code === "CHAT_MESSAGE_IN_PROGRESS"
    || code === "REQUEST_TIMEOUT"
    || code === "AI_UNAVAILABLE"
    || code === "AI_RESPONSE_INVALID";
  return {
    code,
    kind: retryable ? "unavailable" : "generic",
    message: knownMessage ?? (status === 429
      ? "Bạn đang gửi yêu cầu quá nhanh. Vui lòng chờ một lát rồi thử lại."
      : retryable
        ? "Kết nối tới trợ lý đang bị gián đoạn. Vui lòng thử lại sau ít phút."
        : "Yêu cầu chưa thể hoàn tất. Vui lòng kiểm tra và thử lại."),
    retryable,
    status,
  };
}

export function assistantErrorMessage(code: string): string {
  return ASSISTANT_ERROR_COPY[code] ?? "Yêu cầu chưa thể hoàn tất. Vui lòng kiểm tra và thử lại.";
}

interface AssistantContextValue {
  mode: ChatMode;
  /** Mode changes are rejected once a conversation has been created. */
  setMode: (mode: ChatMode) => boolean;
  modeLocked: boolean;
  conversation: AiConversation | null;
  setConversation: (conversation: AiConversation | null) => void;
  policy: AiChatPolicy | null;
  setPolicy: (policy: AiChatPolicy | null) => void;
  consentAccepted: boolean;
  requestEpoch: number;
  invalidateRequests: () => void;
  beginRequest: () => { signal: AbortSignal; epoch: number };
  refreshPolicy: (signal?: AbortSignal) => Promise<AiChatPolicy>;
  acceptConversationConsent: (
    conversationId: string,
    policyVersion: string,
    signal?: AbortSignal,
  ) => Promise<AiConversation>;
  sendMessage: (
    conversationId: string,
    content: string,
    options?: AssistantSendOptions,
  ) => Promise<AiChatExchange>;
  resetSendAttempt: (conversationId: string, attemptId?: string) => void;
  assistantFailureFromError: (error: unknown) => AssistantFailure;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export interface AssistantProviderProps {
  children: ReactNode;
  initialMode?: ChatMode;
  conversation?: AiConversation | null;
  policy?: AiChatPolicy | null;
  onModeChange?: (mode: ChatMode) => void;
}

/**
 * Shared state boundary for the floating assistant and the full patient chat.
 * It deliberately keeps no transcript or consent in browser storage. The
 * backend remains authoritative for both values.
 */
export function AssistantProvider({
  children,
  initialMode = DEFAULT_CHAT_MODE,
  conversation: controlledConversation,
  policy: controlledPolicy,
  onModeChange,
}: AssistantProviderProps) {
  const [localConversation, setLocalConversation] = useState<AiConversation | null>(controlledConversation ?? null);
  const [localPolicy, setLocalPolicy] = useState<AiChatPolicy | null>(controlledPolicy ?? null);
  const [requestEpoch, setRequestEpoch] = useState(0);
  const requestEpochRef = useRef(0);
  const policyEpochRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const conversation = controlledConversation === undefined ? localConversation : controlledConversation;
  const policy = controlledPolicy === undefined ? localPolicy : controlledPolicy;
  const [localMode, setLocalMode] = useState<ChatMode>(initialMode);
  const sendAttemptsRef = useRef(new Map<string, { content: string; idempotencyKey: string }>());
  const mode = conversation?.mode && isAssistantMode(conversation.mode) ? conversation.mode : localMode;
  const modeLocked = Boolean(conversation?.id);

  const setMode = useCallback((nextMode: ChatMode): boolean => {
    if (modeLocked || !isAssistantMode(nextMode)) return false;
    setLocalMode(nextMode);
    onModeChange?.(nextMode);
    return true;
  }, [modeLocked, onModeChange]);

  const setConversation = useCallback((next: AiConversation | null): void => {
    setLocalConversation(next);
    if (next?.mode && isAssistantMode(next.mode)) setLocalMode(next.mode);
  }, []);

  const setPolicy = useCallback((next: AiChatPolicy | null): void => {
    setLocalPolicy(next);
  }, []);

  const invalidateRequests = useCallback((): void => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    requestEpochRef.current += 1;
    setRequestEpoch(requestEpochRef.current);
  }, []);

  const beginRequest = useCallback((): { signal: AbortSignal; epoch: number } => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const epoch = requestEpochRef.current + 1;
    requestEpochRef.current = epoch;
    setRequestEpoch(epoch);
    return { signal: controller.signal, epoch };
  }, []);

  const refreshPolicy = useCallback(async (signal?: AbortSignal): Promise<AiChatPolicy> => {
    const policyEpoch = policyEpochRef.current + 1;
    policyEpochRef.current = policyEpoch;
    const nextPolicy = await fetchAiChatPolicy({ signal });
    if (policyEpochRef.current === policyEpoch && !signal?.aborted) setLocalPolicy(nextPolicy);
    return nextPolicy;
  }, []);

  const acceptConversationConsent = useCallback(async (
    conversationId: string,
    policyVersion: string,
    signal?: AbortSignal,
  ): Promise<AiConversation> => {
    return updateAiConversationConsent(conversationId, policyVersion, { signal });
  }, []);

  const sendMessage = useCallback(async (
    conversationId: string,
    content: string,
    options: AssistantSendOptions = {},
  ): Promise<AiChatExchange> => {
    const normalizedContent = content.trim();
    const attemptId = options.attemptId ?? "composer";
    const attemptKey = `${conversationId}|${attemptId}`;
    const retained = sendAttemptsRef.current.get(attemptKey);
    const idempotencyKey = retained?.content === normalizedContent
      ? retained.idempotencyKey
      : `chat-${crypto.randomUUID()}`;
    sendAttemptsRef.current.set(attemptKey, { content: normalizedContent, idempotencyKey });

    try {
      const exchange = await sendAiConversationMessageStream(
        conversationId,
        normalizedContent,
        idempotencyKey,
        { signal: options.signal, onDelta: options.onDelta },
      );
      sendAttemptsRef.current.delete(attemptKey);
      return exchange;
    } catch (error) {
      if (error instanceof ApiError && TERMINAL_IDEMPOTENCY_CODES.has(error.code ?? "")) {
        sendAttemptsRef.current.delete(attemptKey);
      }
      throw error;
    }
  }, []);

  const resetSendAttempt = useCallback((conversationId: string, attemptId = "composer"): void => {
    sendAttemptsRef.current.delete(`${conversationId}|${attemptId}`);
  }, []);

  useEffect(() => () => {
    controllerRef.current?.abort();
  }, []);

  const value = useMemo<AssistantContextValue>(() => ({
    mode,
    setMode,
    modeLocked,
    conversation,
    setConversation,
    policy,
    setPolicy,
    consentAccepted: hasCurrentChatConsent(conversation, policy),
    requestEpoch,
    invalidateRequests,
    beginRequest,
    refreshPolicy,
    acceptConversationConsent,
    sendMessage,
    resetSendAttempt,
    assistantFailureFromError,
  }), [
    acceptConversationConsent,
    beginRequest,
    conversation,
    invalidateRequests,
    mode,
    modeLocked,
    policy,
    requestEpoch,
    refreshPolicy,
    sendMessage,
    resetSendAttempt,
    setConversation,
    setMode,
    setPolicy,
  ]);

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant(): AssistantContextValue {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant must be used inside AssistantProvider");
  return value;
}

export function useOptionalAssistant(): AssistantContextValue | null {
  return useContext(AssistantContext);
}

/** True when the user is close enough to the bottom to follow new messages. */
export function isNearBottom(element: HTMLElement, threshold = 72): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

export function focusableAssistantElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>([
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
  ].join(",")));
}
