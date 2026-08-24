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
  AiConversation,
  ChatMode,
} from "../types/hospital";

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
  const controllerRef = useRef<AbortController | null>(null);
  const conversation = controlledConversation === undefined ? localConversation : controlledConversation;
  const policy = controlledPolicy === undefined ? localPolicy : controlledPolicy;
  const [localMode, setLocalMode] = useState<ChatMode>(initialMode);
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
    setRequestEpoch((current) => current + 1);
  }, []);

  const beginRequest = useCallback((): { signal: AbortSignal; epoch: number } => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const epoch = requestEpoch + 1;
    setRequestEpoch(epoch);
    return { signal: controller.signal, epoch };
  }, [requestEpoch]);

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
  }), [
    beginRequest,
    conversation,
    invalidateRequests,
    mode,
    modeLocked,
    policy,
    requestEpoch,
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
