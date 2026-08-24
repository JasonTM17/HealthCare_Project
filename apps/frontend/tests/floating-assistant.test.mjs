import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("floating assistant is mounted globally and stays on the REST chat contract", async () => {
  const [layout, component] = await Promise.all([
    read("app/layout.tsx"),
    read("components/FloatingHealthAssistant.tsx"),
  ]);

  assert.match(layout, /FloatingHealthAssistant/);
  assert.match(component, /pathname === "\/patient\/chat"/);
  assert.match(component, /hasRole\(session\.user, "PATIENT"\)/);
  assert.match(component, /key=\{stateKey\}/);
  assert.match(component, /session\?\.user\.id/);
  assert.match(component, /fetchAiConversations\(\)/);
  assert.match(component, /fetchAiConversationMessages\(latest\.id/);
  assert.match(component, /sendAiConversationMessage\(currentConversation\.id, normalized, key\)/);
  assert.match(component, /Idempotency/);
  assert.match(component, /\/patient\/chat/);
  assert.match(component, /healthcare-assistant-chibi\.png/);
  assert.match(component, /launcherMascot/);
  assert.match(component, /provenanceLabel/);
  assert.match(component, /DEFAULT_DISCLAIMER/);
  assert.match(component, /citationHref/);
  assert.match(component, /AI_UNAVAILABLE/);
  assert.match(component, /className="sr-only">Trợ lý sức khỏe/);
  assert.match(component, /MutationObserver/);
  assert.match(component, /event\.key === "Escape"/);
  assert.doesNotMatch(component, /supabase|SUPABASE|localStorage/);
});

test("floating assistant exposes real recovery, safety and accessible actions", async () => {
  const [component, styles] = await Promise.all([
    read("components/FloatingHealthAssistant.tsx"),
    read("components/FloatingHealthAssistant.module.css"),
  ]);

  assert.match(component, /CHAT_CONTENT_BLOCKED/);
  assert.match(component, /Trường hợp cấp cứu, gọi 115/);
  assert.match(component, /Thử lại/);
  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /maxLength=\{MAX_MESSAGE_LENGTH\}/);
  assert.match(styles, /launcherAvatar/);
  assert.match(styles, /border-radius: 50%/);
  assert.match(styles, /launcherMascot/);
  assert.match(styles, /launcher::after/);
  assert.match(styles, /object-fit: contain/);
  assert.match(styles, /min-height: 2\.75rem/);
  assert.match(styles, /--assistant-bottom-clearance/);
  assert.match(styles, /max\(0\.75rem, env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /z-index: 80/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /linear-gradient|radial-gradient/);
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
  assert.match(component, /updateAiConversationConsent\(conversationId, currentPolicy\.policyVersion, \{ signal: controller\.signal \}\)/);
  assert.match(apiClient, /CTA_LABEL_CONTROL_PATTERN/);
  assert.match(apiClient, /\{0,219\}/);
  assert.match(apiClient, /CTA_LABEL_CONTROL_PATTERN\.test\(value\.label\)/);
});
