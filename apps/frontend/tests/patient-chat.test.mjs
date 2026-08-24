import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("patient chat client exposes every locked REST conversation resource", async () => {
  const apiClient = await read("lib/api-client.ts");

  assert.match(apiClient, /createAiConversation[\s\S]*\/ai\/conversations/);
  assert.match(apiClient, /fetchAiConversations[\s\S]*\/ai\/conversations/);
  assert.match(apiClient, /fetchAiConversation\(conversationId/);
  assert.match(apiClient, /fetchAiConversationMessages[\s\S]*cursor/);
  assert.match(apiClient, /sendAiConversationMessage[\s\S]*"Idempotency-Key"/);
  assert.match(apiClient, /deleteAiConversation[\s\S]*method: "DELETE"/);
});

test("chat API rejects malformed provider-shaped responses before they reach the UI", async () => {
  const apiClient = await read("lib/api-client.ts");

  assert.match(apiClient, /parseAiChatMessage/);
  assert.match(apiClient, /isSafeChatCitation/);
  assert.match(apiClient, /AI_RESPONSE_INVALID/);
  assert.match(apiClient, /AI_CHAT_PROVENANCES/);
  assert.match(apiClient, /AI_CHAT_STATUSES/);
});

test("patient chat is role gated and keeps server history authoritative", async () => {
  const page = await read("app/patient/chat/page.tsx");

  assert.match(page, /LoginRequiredState nextPath="\/patient\/chat"/);
  assert.match(page, /hasRole\(session\.user, "PATIENT"\)/);
  assert.match(page, /ForbiddenState/);
  assert.match(page, /Promise\.all\(\[\s*fetchAiConversation\(conversationId\),\s*fetchAiConversationMessages/);
  assert.match(page, /await sendAiConversationMessage[\s\S]*await Promise\.all\(\[[\s\S]*loadThread/);
  assert.match(page, /fetchAiConversationMessages\(conversationId, cursor, MESSAGE_LIMIT\)/);
  assert.match(page, /mergeMessages\(page\.content, current\)/);
});

test("patient chat includes bounded composer, recovery, citations, and destructive confirmation", async () => {
  const page = await read("app/patient/chat/page.tsx");

  assert.match(page, /MAX_MESSAGE_LENGTH = 10_000/);
  assert.match(page, /maxLength=\{MAX_MESSAGE_LENGTH\}/);
  assert.match(page, /crypto\.randomUUID\(\)/);
  assert.match(page, /CHAT_MESSAGE_IN_PROGRESS/);
  assert.match(page, /AI_UNAVAILABLE/);
  assert.match(page, /CHAT_CONTENT_BLOCKED/);
  assert.match(page, /onRetry=\{\(failedMessage\)[\s\S]*sourceMessageId: failedMessage\.id/);
  assert.match(page, /source_type: citation\.source_type/);
  assert.match(page, /source_id: citation\.source_id/);
  assert.match(page, /<dialog/);
  assert.match(page, /showModal\(\)/);
  assert.match(page, /deleteAiConversation\(target\.id\)/);
  assert.match(page, /const sendLocked = sending;/);
  assert.match(page, /disabled=\{deleting\}/);
  assert.match(page, /selectedSummary\?\.inFlight \? "Thử gửi lại"/);
});

test("patient chat reuses one idempotency key for an ambiguous logical attempt", async () => {
  const page = await read("app/patient/chat/page.tsx");

  assert.match(page, /retainedSendAttemptsRef = useRef\(new Map/);
  assert.match(page, /retainedAttempt\?\.content === normalizedContent[\s\S]*retainedAttempt\.idempotencyKey[\s\S]*createIdempotencyKey\(\)/);
  assert.match(page, /sendAiConversationMessage\(conversationId, normalizedContent, idempotencyKey\)/);
  assert.match(page, /backendRequiresNewIdempotencyKey\(error\)[\s\S]*delete\(attemptMapKey\)/);
  assert.match(page, /failed-message:\$\{options\.sourceMessageId\}/);
  assert.doesNotMatch(page, /sendAiConversationMessage\([^\n]+createIdempotencyKey\(\)/);
});

test("patient chat keeps medical and emergency limits visible and accessible", async () => {
  const [page, moduleStyles, globalStyles] = await Promise.all([
    read("app/patient/chat/page.tsx"),
    read("app/patient/chat/chat.module.css"),
    read("app/styles.css"),
  ]);

  assert.match(page, /Trợ lý không thay thế bác sĩ, chẩn đoán, đơn thuốc hoặc hướng dẫn cấp cứu/);
  assert.match(page, /gọi 115 hoặc đến khoa cấp cứu gần nhất/);
  assert.match(page, /role="log"/);
  assert.match(page, /aria-describedby=\{`patient-chat-help patient-chat-count/);
  assert.match(page, /aria-label=\{`Xóa cuộc trò chuyện/);
  assert.match(moduleStyles, /--chat-touch-size: 2\.75rem/);
  assert.match(moduleStyles, /border-radius: var\(--chat-radius\)/);
  assert.match(moduleStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(moduleStyles, /transition:\s*all/);
  assert.match(globalStyles, /\.portal-nav\s*\{\s*flex-wrap: wrap;\s*overflow-x: visible;/);
});

test("patient chat keeps consent fail-closed when policy is missing or changes", async () => {
  const page = await read("app/patient/chat/page.tsx");

  assert.match(page, /const currentConsentRequired = Boolean\(/);
  assert.match(page, /!chatPolicy/);
  assert.match(page, /const policy = await fetchAiChatPolicy\(\)/);
  assert.match(page, /disabled=\{!selectedConversationId \|\| sendLocked \|\| currentConsentRequired\}/);
});
