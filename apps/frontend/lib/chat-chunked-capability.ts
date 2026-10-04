// Chunked-delivery capability cache. Spring mounts /messages/stream even when
// its feature flag is off and answers with an EMPTY 404. That probe costs a
// full round trip before the JSON fallback even starts, so once the disabled
// contract is observed it is cached for the session (module flag, plus a
// session seed so a later page load skips the doomed request too). A 404
// carrying a body is the real AI_CONVERSATION_NOT_FOUND error — and no other
// failure ever marks the capability.
//
// This is a delivery-capability boolean, not auth material: it lives outside
// lib/api-client.ts so the browser-secret source gate can keep that file free
// of every web-storage surface.
const CHUNKED_CHAT_FLAG_STORAGE_KEY = "hc.chat.chunked";
let chunkedChatDisabled = false;

export function isChunkedChatDisabled(): boolean {
  if (chunkedChatDisabled) return true;
  try {
    if (typeof sessionStorage !== "undefined"
      && sessionStorage.getItem(CHUNKED_CHAT_FLAG_STORAGE_KEY) === "0") {
      chunkedChatDisabled = true;
    }
  } catch {
    // Storage can be blocked (private mode, sandboxed frame); the in-memory
    // flag still covers this page's lifetime.
  }
  return chunkedChatDisabled;
}

export function markChunkedChatDisabled(): void {
  chunkedChatDisabled = true;
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(CHUNKED_CHAT_FLAG_STORAGE_KEY, "0");
    }
  } catch {
    // Best-effort seed only; the module flag already covers this page.
  }
}
