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
  assert.match(component, /MAX_PUBLIC_MESSAGE_LENGTH/);
  assert.match(component, /Bạn đang dùng chế độ khách/);
  assert.match(component, /isPatient && message\.status === "COMPLETED"/);
  assert.match(component, /onDelta: \(delta\) => \{[\s\S]*isCurrentLocalRequest\(epoch, currentConversation\?\.id\)[\s\S]*setStreamingReply/);
  assert.match(component, /pendingUserMessage/);
  assert.match(component, /data-testid="floating-chat-pending-user"/);
  assert.match(component, /data-testid="floating-chat-thinking"/);
  assert.match(component, /Đang suy nghĩ/);
  assert.match(component, /Hỗ trợ tạm thời/);
  assert.doesNotMatch(component, /Đang kết nối backend và AI/);
  assert.match(styles, /\.typingDots span \{[\s\S]*animation: assistantTyping/);
  assert.match(component, /data-testid="floating-chat-streaming-reply"/);
  assert.match(provider, /Idempotency-Key|idempotencyKey/);
  assert.match(component, /\/patient\/chat/);
  assert.match(component, /healthcare-assistant-chibi\.png/);
  assert.match(component, /launcherMascot/);
  assert.match(component, /provenanceLabel/);
  assert.match(component, /DEFAULT_DISCLAIMER/);
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
  assert.match(component, /Thử lại/);
  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /maxLength=\{isPatient \? MAX_MESSAGE_LENGTH : MAX_PUBLIC_MESSAGE_LENGTH\}/);
  assert.match(styles, /launcherAvatar/);
  assert.match(styles, /\.launcher \{[\s\S]*border-radius: var\(--radius-sm\)/);
  assert.match(styles, /\.launcher \{[\s\S]*width: 3\.25rem;[\s\S]*min-height: 3\.25rem/);
  assert.match(styles, /\.launcher \{[\s\S]*background: #ffffff;/);
  assert.match(styles, /\.launcher\[aria-expanded="true"\] \{[\s\S]*background: #004c4e;/);
  assert.match(styles, /@media \(max-width: 640px\) \{[\s\S]*\.launcher \{[\s\S]*width: 3rem;[\s\S]*min-height: 3rem/);
  assert.match(styles, /\.panel \{[\s\S]*border-radius: var\(--radius-lg\)/);
  assert.doesNotMatch(styles, /box-shadow:(?!\s*none\b)/);
  assert.match(styles, /launcherMascot/);
  assert.match(styles, /launcher::after/);
  assert.match(styles, /object-fit: contain/);
  assert.match(styles, /min-height: 2\.75rem/);
  assert.match(styles, /--assistant-bottom-clearance/);
  assert.match(styles, /\.provenance[\s\S]*border-radius: 0/);
  assert.match(styles, /\.suggestions button::after/);
  assert.match(styles, /border-left: 3px solid var\(--assistant-assistant-accent\)/);
  assert.match(styles, /\.feedback button \{[\s\S]*min-height: 2\.75rem/);
  assert.match(styles, /\.modeOption,\s*\.modeOptionActive \{[\s\S]*font-size: 0\.74rem/);
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
  assert.match(apiClient, /value\.mode !== "HOSPITAL_SUPPORT"/);
  assert.match(apiClient, /provenance !== "local_provider"/);
});
