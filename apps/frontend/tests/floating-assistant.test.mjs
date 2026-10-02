import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("floating assistant is mounted globally and stays on the REST chat contract", async () => {
  const [layout, component, provider, styles] = await Promise.all([
    read("app/layout.tsx"),
    read("components/FloatingHealthAssistant.tsx"),
    read("components/AssistantProvider.tsx"),
    read("components/FloatingHealthAssistant.module.css"),
  ]);

  assert.match(layout, /FloatingHealthAssistant/);
  assert.match(component, /pathname === "\/patient\/chat"/);
  assert.match(component, /hasRole\(session\.user, "PATIENT"\)/);
  assert.match(component, /styles\.rootPatient/);
  assert.doesNotMatch(component, /assistant-mascot-neutral-v1/);
  assert.match(component, /key=\{stateKey\}/);
  assert.match(component, /session\?\.user\.id/);
  assert.match(component, /fetchAiConversations\(\)/);
  assert.match(component, /fetchAiConversationMessages\(latest\.id/);
  assert.match(component, /sendMessage\(currentConversation\.id, normalized/);
  assert.match(component, /sendPublicAiChat\(normalized, recentTurns/);
  assert.doesNotMatch(component, /CASUAL_GREETING_PATTERN|GREETING_ACTIONS|GREETING_ANSWER/);
  assert.doesNotMatch(component, /href:\s*"\/booking"/);
  assert.match(component, /MAX_PUBLIC_MESSAGE_LENGTH/);
  assert.match(component, /Bạn đang dùng chế độ khách/);
  assert.match(component, /Thông tin sức khỏe · Có lưu lịch sử/);
  assert.match(component, /Tra cứu HealthCare · Không lưu lịch sử/);
  assert.doesNotMatch(component, /Bác sĩ Trợ lý AI|Trực tuyến|onlineDot/);
  assert.doesNotMatch(styles, /\.onlineDot/);
  assert.match(component, /isPatient && message\.status === "COMPLETED"/);
  assert.match(component, /onDelta: \(delta\) => \{[\s\S]*isCurrentLocalRequest\(epoch, currentConversation\?\.id\)[\s\S]*setStreamingReply/);
  assert.match(component, /pendingUserMessage/);
  assert.match(component, /data-testid="floating-chat-pending-user"/);
  assert.match(component, /data-testid="floating-chat-thinking"/);
  // Timers only observe elapsed waiting. Actual rendered stages are covered by
  // chat-ui-recovery.behavior.test.mjs; do not assert invented upstream activity.
  const waitStage = await read("components/useChatWaitStage.ts");
  assert.match(component, /CHAT_WAIT_STAGE_COPY\[waitStage\]/);
  assert.match(component, /useChatWaitStage\(sending\)/);
  assert.match(waitStage, /received: "Đã nhận câu hỏi — đang chờ phản hồi…"/);
  assert.match(waitStage, /searching: "Vẫn đang chờ máy chủ phản hồi…"/);
  assert.match(waitStage, /connecting: "Phản hồi mất thêm thời gian\. Bạn có thể dừng chờ\."/);
  assert.match(waitStage, /preparing: "Thời gian chờ lâu hơn thường lệ\. Bạn có thể dừng chờ và thử lại\."/);
  // Provenance labels live in AssistantProvider so the floating panel and the
  // full patient chat page share one source-honesty contract.
  assert.match(provider, /Hỗ trợ tạm thời/);
  assert.match(component, /message\.provenance === "local_fallback" && message\.safetyAction === "INSUFFICIENT_EVIDENCE"/);
  assert.match(component, /stickToBottomRef/);
  assert.match(component, /onScroll=\{\(event\) => \{[\s\S]*isNearBottom\(event\.currentTarget\)/);
  assert.doesNotMatch(component, /Đang kết nối backend và AI/);
  assert.match(styles, /\.typingDots span \{[\s\S]*animation: assistantTyping/);
  assert.match(component, /data-testid="floating-chat-streaming-reply"/);
  assert.match(provider, /Idempotency-Key|idempotencyKey/);
  assert.match(component, /\/patient\/chat/);
  assert.match(component, /healthcare-assistant-chibi\.png/);
  assert.match(component, /launcherMascot/);
  assert.match(component, /provenanceLabel/);
  assert.match(component, /DEFAULT_DISCLAIMER/);
  // Suggested actions are server-owned. The client keeps contextual prompts,
  // but must not synthesize a greeting response or navigation CTA locally.
  assert.match(component, /SUGGESTED_QUESTIONS_HOSPITAL/);
  assert.doesNotMatch(component, /CASUAL_GREETING_PATTERN|GREETING_ACTIONS|GREETING_ANSWER/);
  assert.doesNotMatch(component, /label: "Tìm Chuyên khoa", href: "\/specialties"/);
  assert.match(component, /citationHref/);
  assert.match(provider, /AI_UNAVAILABLE/);
  assert.match(provider, /PUBLIC_CHAT_INPUT_INVALID/);
  assert.match(component, /className="sr-only">Trợ lý sức khỏe/);
  assert.match(component, /MutationObserver/);
  assert.match(component, /event\.key === "Escape"/);
  assert.doesNotMatch(component, /supabase|SUPABASE|localStorage/);
});

test("floating assistant exposes real recovery, safety and accessible actions", async () => {
  const [component, provider, styles, mark] = await Promise.all([
    read("components/FloatingHealthAssistant.tsx"),
    read("components/AssistantProvider.tsx"),
    read("components/FloatingHealthAssistant.module.css"),
    read("components/AssistantMark.tsx"),
  ]);

  assert.match(provider, /CHAT_CONTENT_BLOCKED/);
  assert.match(provider, /REQUEST_TIMEOUT/);
  assert.match(component, /Trường hợp cấp cứu, gọi 115/);
  assert.match(component, /message\.safetyAction !== "EMERGENCY" && message\.suggestedActions/);
  assert.match(component, /Thử lại/);
  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /role="dialog"/);
  // The floating panel is a non-modal companion widget: the page behind stays
  // interactive, so aria-modal="true" would misrepresent the background.
  assert.doesNotMatch(component, /aria-modal="true"/);
  assert.match(component, /maxLength=\{isPatient \? MAX_MESSAGE_LENGTH : MAX_PUBLIC_MESSAGE_LENGTH\}/);
  assert.match(styles, /launcherAvatar/);
  assert.match(styles, /\.launcher \{[\s\S]*border-radius: var\(--radius-sm\)/);
  assert.match(styles, /\.launcher \{[\s\S]*width: 3\.25rem;[\s\S]*min-height: 3\.25rem/);
  assert.match(styles, /\.launcher \{[\s\S]*background: var\(--color-teal-800\);/);
  assert.match(styles, /\.launcher\[aria-expanded="true"\] \{[\s\S]*background: var\(--color-teal-800\);/);
  assert.match(styles, /@media \(max-width: 640px\) \{[\s\S]*\.launcher \{[\s\S]*width: 3rem;[\s\S]*min-height: 3rem/);
  assert.match(styles, /\.panel \{[\s\S]*border-radius: var\(--radius-chat-panel\)/);
  assert.doesNotMatch(styles, /box-shadow:(?!\s*none\b)/);
  assert.match(styles, /launcherMascot/);
  assert.match(styles, /launcher::after/);
  assert.match(styles, /object-fit: contain/);
  assert.match(styles, /min-height: 2\.75rem/);
  assert.match(styles, /--assistant-bottom-clearance/);
  assert.match(styles, /\.provenance[\s\S]*border-radius: 0/);
  assert.match(styles, /\.suggestions button::after/);
  assert.match(styles, /border-left: 3px solid var\(--assistant-assistant-accent\)/);
  assert.match(styles, /\.feedback button \{\r?\n  min-height: 2\.75rem;[\s\S]*?touch-action: manipulation;[\s\S]*?transition: background-color var\(--duration-fast\) ease, border-color var\(--duration-fast\) ease, color var\(--duration-fast\) ease;/);
  assert.match(styles, /\.modeOption,\s*\.modeOptionActive \{[\s\S]*font-size: 0\.75rem/);
  assert.match(styles, /max\(0\.75rem, env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /z-index: 80/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /linear-gradient|radial-gradient/);
  assert.match(mark, /friendly healthcare chat/);
  assert.doesNotMatch(mark, /AI Intelligence Sparkle|cx="37" cy="14"/);
});

test("floating assistant fails closed across mode changes and policy refreshes", async () => {
  const [component, apiClient] = await Promise.all([
    read("components/FloatingHealthAssistant.tsx"),
    read("lib/api-client.ts"),
  ]);

  assert.match(component, /requestEpochRef/);
  assert.match(component, /conversationIdRef/);
  assert.match(component, /isCurrentLocalRequest\(epoch, currentConversation\.id\)/);
  assert.match(component, /invalidateLocalRequests\(\)/);
  assert.match(component, /disabled=\{creatingMode \|\| sending \|\| consentBusy\}/);
  assert.match(component, /refreshChatPolicy/);
  assert.match(component, /hasCurrentChatConsent\(currentConversation, currentPolicy\)/);
  assert.match(component, /acceptConversationConsent\(conversationId, currentPolicy\.policyVersion, controller\.signal\)/);
  assert.match(component, /if \(externalModal && open\) closeAssistant\(\)/);
  assert.match(apiClient, /CTA_LABEL_CONTROL_PATTERN/);
  assert.match(apiClient, /\{0,219\}/);
  assert.match(apiClient, /CTA_LABEL_CONTROL_PATTERN\.test\(value\.label\)/);
  assert.match(apiClient, /PUBLIC_CHAT_INPUT_INVALID/);
  assert.match(apiClient, /PUBLIC_AI_CHAT_MODES = \["HOSPITAL_SUPPORT", "HEALTH_EDUCATION"\]/);
  assert.match(apiClient, /!isPublicAiChatMode\(mode\)/);
  assert.match(apiClient, /provenance !== "local_provider"/);
  assert.ok(apiClient.includes('const CTA_CATALOG_PATH_PATTERN = /^\\/(branches|specialties|doctors|services|packages|articles|faq)$/;'));
});

test("floating assistant feedback cannot wedge an in-flight send", async () => {
  const component = await read("components/FloatingHealthAssistant.tsx");

  // (a) handleFeedback is a no-op while a send is in flight: beginLocalRequest
  // would otherwise abort the send controller and bump the epoch, which the
  // old epoch-guarded finally turned into a permanent wedge.
  assert.match(component, /const handleFeedback = async \(message: AiChatMessage, rating: FeedbackRating\): Promise<void> => \{[\s\S]{0,600}?if \(sending \|\| feedbackBusy \|\| message\.role !== "ASSISTANT"/);
  // (b) The feedback buttons themselves are disabled while sending.
  assert.match(component, /disabled=\{feedbackBusy === message\.id \|\| sending\}/);
  // (c) Closing, cancelling, and mode switches mark the cancel before aborting
  // so the aborted send stays silent instead of surfacing a fake outage.
  assert.match(component, /const invalidateLocalRequests = useCallback\(\(\): void => \{\s*\/\/[\s\S]{0,300}?intentionalCancelRef\.current = true;/);
  assert.match(component, /intentionalCancelRef = useRef\(false\)/);
  assert.match(component, /intentionalCancelRef\.current = false;\s*const \{ controller, epoch \} = beginLocalRequest\(\)/);
});

test("floating assistant send machine resets unconditionally and maps stray aborts to a retryable timeout", async () => {
  const component = await read("components/FloatingHealthAssistant.tsx");
  const provider = await read("components/AssistantProvider.tsx");

  // The old swallow-on-abort catch must not come back.
  assert.doesNotMatch(component, /if \(isAbortError\(error\) \|\| !isCurrentLocalRequest\(epoch, currentConversation\?\.id\)\) return/);
  // A raw AbortError that is not an intentional cancel (and not superseded) is
  // surfaced through the shared CHAT_REQUEST_TIMEOUT taxonomy.
  assert.match(provider, /CHAT_REQUEST_TIMEOUT: "Hết thời gian chờ phản hồi từ trợ lý\. Vui lòng thử lại\."/);
  assert.match(provider, /code === "CHAT_REQUEST_TIMEOUT"/);
  assert.match(component, /function chatTimeoutFailure\(\): AssistantFailure \{/);
  assert.match(component, /setFailure\(chatTimeoutFailure\(\)\);/);
  // Staleness still gates data mutations for non-abort failures.
  assert.match(component, /setFailure\(chatTimeoutFailure\(\)\);\s*return;\s*\}\s*if \(!isCurrentLocalRequest\(epoch, currentConversation\?\.id\)\) return;/);
  // The finally resets the machine unconditionally; the epoch/identity check
  // only gates controller cleanup, focus restore, and the intentional-cancel
  // flag (a stale finally must not disarm a newer send's pending Stop).
  assert.match(
    component,
    /} finally \{\s*\/\/ Invariant:[\s\S]*?setStreamingReply\(""\);\s*setPendingUserMessage\(null\);\s*setSending\(false\);\s*if \(isCurrentLocalRequest\(epoch, currentConversation\?\.id\)\) \{\s*intentionalCancelRef\.current = false;/,
  );
});
