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
  assert.match(apiClient, /sendAiConversationMessageChunked[\s\S]*text\/event-stream/);
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
  assert.match(page, /await sendMessage[\s\S]*await Promise\.allSettled\(\[[\s\S]*loadThread/);
  assert.match(page, /onDelta: \(delta\) => \{[\s\S]*isCurrentSendRequest\(\)[\s\S]*setStreamingReply/);
  assert.match(page, /data-testid="chat-streaming-reply"/);
  assert.match(page, /fetchAiConversationMessages\(conversationId, cursor, MESSAGE_LIMIT\)/);
  assert.match(page, /mergeMessages\(page\.content, current\)/);
});

test("patient chat includes bounded composer, recovery, citations, and destructive confirmation", async () => {
  const page = await read("app/patient/chat/page.tsx");

  assert.match(page, /MAX_MESSAGE_LENGTH = 10_000/);
  assert.match(page, /maxLength=\{MAX_MESSAGE_LENGTH\}/);
  const provider = await read("components/AssistantProvider.tsx");
  assert.match(provider, /randomId\(\)/);
  assert.match(provider, /CHAT_MESSAGE_IN_PROGRESS/);
  assert.match(provider, /AI_UNAVAILABLE/);
  assert.match(provider, /CHAT_CONTENT_BLOCKED/);
  assert.match(provider, /REQUEST_TIMEOUT/);
  assert.match(provider, /Câu hỏi vẫn được giữ lại/);
  assert.match(page, /onRetry=\{\(failedMessage\)[\s\S]*sourceMessageId: failedMessage\.id/);
  assert.match(page, /source_type: citation\.source_type/);
  assert.match(page, /source_id: citation\.source_id/);
  assert.match(page, /<dialog/);
  assert.match(page, /showModal\(\)/);
  assert.match(page, /deleteAiConversation\(target\.id\)/);
  assert.match(page, /const sendLocked = sending;/);
  assert.match(page, /disabled=\{deleting \|\| sending\}/);
  assert.match(page, /selectedSummary\?\.inFlight \? "Thử gửi lại"/);
});

test("patient chat reuses one idempotency key for an ambiguous logical attempt", async () => {
  const page = await read("app/patient/chat/page.tsx");

  const provider = await read("components/AssistantProvider.tsx");

  assert.match(provider, /sendAttemptsRef = useRef\(new Map/);
  assert.match(provider, /retained\?\.content === normalizedContent[\s\S]*retained\.idempotencyKey[\s\S]*randomId\(\)/);
  assert.match(provider, /sendAiConversationMessageChunked\([\s\S]*idempotencyKey/);
  assert.match(provider, /TERMINAL_IDEMPOTENCY_CODES[\s\S]*sendAttemptsRef\.current\.delete/);
  assert.match(page, /sendMessage\(conversationId, normalizedContent[\s\S]*attemptId:/);
  assert.match(page, /failed-message:\$\{options\.sourceMessageId\}/);
  assert.doesNotMatch(page, /sendAiConversationMessage(?:Stream|Chunked)/);
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
  // Portal tabs stay a single scrollable strip; chat tabs must not wrap.
  assert.match(globalStyles, /\.portal-nav\s*\{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/);
});

test("patient chat renders safety notices as a compact single-line band", async () => {
  const page = await read("app/patient/chat/page.tsx");

  // The band keeps its accessible name and both items, but drops the heavy
  // two-banner layout: 16px icons, no standalone "Thông tin tham khảo."
  // heading, and the one-word "Khẩn cấp:" emergency lead-in.
  assert.match(page, /<section aria-label="Lưu ý an toàn khi dùng trợ lý" className=\{styles\.safetyBand\}/);
  assert.match(page, /<UiIcon name="shield-check" size=\{16\} \/>\s*<p>Trợ lý không thay thế bác sĩ, chẩn đoán, đơn thuốc hoặc hướng dẫn cấp cứu\.<\/p>/);
  assert.match(page, /<UiIcon name="alert-triangle" size=\{16\} \/>\s*<p><strong>Khẩn cấp:<\/strong> khó thở, đau ngực dữ dội, bất tỉnh — gọi 115 hoặc đến khoa cấp cứu gần nhất, không chờ trợ lý\.<\/p>/);
  assert.doesNotMatch(page, /<strong>Thông tin tham khảo\.<\/strong>/);
  assert.doesNotMatch(page, /<strong>Tình huống khẩn cấp\.<\/strong>/);
});

test("patient chat mode picker is a compact segmented row with tooltips", async () => {
  const page = await read("app/patient/chat/page.tsx");

  // Heading collapses to the short label; the conditional one-line hint is kept.
  assert.match(page, /<strong>Chọn mục đích<\/strong>/);
  assert.doesNotMatch(page, /Chọn mục đích trước khi bắt đầu/);
  assert.match(page, /Mỗi cuộc trò chuyện giữ một chế độ cố định\./);

  // Mode buttons: label only, description lives in the title tooltip, and the
  // interactive contract (aria-pressed/disabled/onClick) is untouched.
  assert.doesNotMatch(page, /<span>\{option\.description\}<\/span>/);
  assert.match(page, /title=\{option\.description\}/);
  assert.match(page, /aria-pressed=\{selectedMode === option\.value\}/);
  assert.match(page, /onClick=\{\(\) => void handleModeSelect\(option\.value\)\}/);

  // Guest mirror uses the same .modeOptions/.modeOption markup: static tile,
  // no description span, tooltip added — the two surfaces cannot drift.
  assert.match(page, /<div className=\{styles\.modeOption\} key=\{option\.value\} title=\{option\.description\}>\s*<strong>\{option\.label\}<\/strong>\s*<\/div>/);

  // Settings row is inlined under .assistantSettings: no wrapper, shorter
  // toggle label, and the live-status hint stays a direct child.
  assert.doesNotMatch(page, /assistantSettingsRow/);
  assert.match(page, /<span>Gợi ý cá nhân hóa \(tên, lịch hẹn sắp tới\)<\/span>/);
  assert.match(page, /<p aria-live="polite" className=\{styles\.assistantSettingHint\} role="status">/);
});

test("chat safety band and mode picker stay single-line with high-contrast save button", async () => {
  const [page, css] = await Promise.all([
    read("app/patient/chat/page.tsx"),
    read("app/patient/chat/chat.module.css"),
  ]);

  // (a) The emergency item keeps only a hairline divider — no large red panel.
  assert.doesNotMatch(css, /\.emergencyItem\s*\{[^}]*background:/);
  // (b) The safety band is a single thin flex strip, not a two-column grid.
  assert.match(css, /\.safetyBand\s*\{[^}]*display:\s*flex/);
  // (c) The save button is a solid accent button with paper-bright text; the
  // disabled state must stay a real flat style, not faded opacity.
  const saveBlock = css.match(/\.assistantSettingSave\s*\{[^}]*\}/);
  assert.ok(saveBlock, "chat.module.css must define .assistantSettingSave");
  assert.match(saveBlock[0], /background: var\(--chat-accent\)/);
  assert.match(saveBlock[0], /color: var\(--color-paper-bright\)/);
  assert.doesNotMatch(css, /\.assistantSettingSave:disabled\s*\{[^}]*opacity/);
  // (d) Both locked safety substrings stay verbatim; descriptions became
  // title tooltips.
  assert.match(page, /Trợ lý không thay thế bác sĩ, chẩn đoán, đơn thuốc hoặc hướng dẫn cấp cứu/);
  assert.match(page, /gọi 115 hoặc đến khoa cấp cứu gần nhất/);
  assert.match(page, /title=\{option\.description\}/);
  // (e) Flat UI: no shadows besides explicit `box-shadow: none` resets — the
  // negative-lookahead pattern is copied from floating-assistant.test.mjs:104
  // because chat.module.css legitimately contains three `none` resets.
  assert.doesNotMatch(css, /box-shadow:(?!\s*none\b)/);
});

test("patient chat keeps consent fail-closed when policy is missing or changes", async () => {
  const page = await read("app/patient/chat/page.tsx");

  assert.match(page, /const currentConsentRequired = Boolean\(/);
  assert.match(page, /!chatPolicy/);
  assert.match(page, /const policy = await refreshPolicy\(controller\.signal\)/);
  assert.match(page, /const isCurrentConsentRequest = \(\): boolean/);
  assert.match(page, /if \(!isCurrentConsentRequest\(\)\) return/);
  assert.match(page, /const interactionLocked = sendLocked \|\| creating \|\| deleting \|\| consentBusy/);
  assert.match(page, /disabled=\{!selectedConversationId \|\| sendLocked \|\| currentConsentRequired\}/);
});

test("patient chat drops late stream updates after a conversation switch", async () => {
  const page = await read("app/patient/chat/page.tsx");

  assert.match(page, /sendRequestRef = useRef\(0\)/);
  assert.match(page, /const isCurrentSendRequest = \(\): boolean/);
  assert.match(page, /if \(isCurrentSendRequest\(\)\) setStreamingReply/);
  assert.match(page, /if \(isAbortError\(error\) \|\| !isCurrentSendRequest\(\)\) return/);
  assert.match(page, /if \(isCurrentSendRequest\(\)\) \{[\s\S]*sendInFlightRef\.current = false/);
  assert.match(page, /if \(!options\.background\) \{[\s\S]*invalidateSendRequest\(\)[\s\S]*invalidateConsentRequest\(\)/);
});

test("patient chat shows the patient's own message before the exchange settles", async () => {
  const page = await read("app/patient/chat/page.tsx");

  // The exchange round-trip streams a long answer, so the patient's message
  // must be in the transcript from the moment the send starts — not only after
  // the server responds. It goes in as a local PENDING row that the settle
  // paths replace with (or drop in favour of) the server's copy.
  const insertAt = page.indexOf("pending-user-");
  const awaitAt = page.indexOf("await sendMessage(conversationId, normalizedContent");
  assert.ok(insertAt > 0, "the send path builds a local pending row");
  assert.ok(awaitAt > 0, "the send path still awaits the exchange");
  assert.ok(
    insertAt < awaitAt,
    "the patient's message is inserted before the exchange is awaited",
  );
  assert.match(page, /status: "PENDING"/);
  assert.match(page, /current\.filter\(\(message\) => message\.id !== pendingMessageId\)[\s\S]*exchange\.userMessage/);
  // A rejected attempt restores the composer text instead of losing it.
  assert.match(page, /setMessages\(\(current\) => current\.filter\(\(message\) => message\.id !== pendingMessageId\)\);\s*if \(options\.clearDraftOnSuccess\) setDraft\(normalizedContent\)/);
});
