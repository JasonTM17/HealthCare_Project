import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);
const patientChatPath = new URL("../app/patient/chat/page.tsx", import.meta.url);
const floatingPath = new URL("../components/FloatingHealthAssistant.tsx", import.meta.url);
const bffPath = new URL("../lib/server/healthcare-bff.ts", import.meta.url);
const medicalSafetyPath = new URL(
  "../../backend/src/main/java/com/healthcare/ai/chat/service/ChatMedicalSafety.java",
  import.meta.url,
);
const conversationServicePath = new URL(
  "../../backend/src/main/java/com/healthcare/ai/chat/service/AiConversationService.java",
  import.meta.url,
);

test("self-harm crisis card is pinned end to end (detector -> marker -> render)", async () => {
  const [apiClient, patientChat, floating, bff, medicalSafety, conversationService] =
    await Promise.all([
      readFile(apiClientPath, "utf8"),
      readFile(patientChatPath, "utf8"),
      readFile(floatingPath, "utf8"),
      readFile(bffPath, "utf8"),
      readFile(medicalSafetyPath, "utf8"),
      readFile(conversationServicePath, "utf8"),
    ]);

  // Backend owns the marker: a dedicated self-harm cue selects the crisis
  // wording, and the persisted reload path re-derives the marker so the card
  // survives a refresh.
  assert.match(medicalSafety, /public static boolean containsSelfHarmCue\(String input\)/);
  assert.match(medicalSafety, /SELF_HARM_INPUT_CUE/);
  assert.match(conversationService, /"self_harm_crisis" : "safety_response"/);
  assert.match(conversationService, /containsSelfHarmCue\(requestContent\)/);
  // The upstream AI lexicon is a superset (leet/idioms): its marker must be
  // honoured too, not silently dropped to the generic card — live AND on
  // reload (the canned body persisted verbatim is the surviving evidence).
  assert.match(conversationService, /"self_harm_crisis"\.equals\(upstreamRoutingReason\)/);
  assert.match(conversationService, /retrieved\.get\("routing_reason"\)/);
  assert.match(conversationService, /SELF_HARM_CRISIS_ANSWER\.equals\(value\.getContent\(\)\)/);

  // Both parsers must surface routingReason — without this the card never
  // switches and the marker is dropped silently.
  assert.match(apiClient, /routingReason: routingReason \?\? null/);
  assert.match(apiClient, /value\.routingReason \?\? value\.routing_reason/);

  // Both patient surfaces render the crisis variant on the marker.
  for (const surface of [patientChat, floating]) {
    assert.match(surface, /routingReason === "self_harm_crisis"/);
    assert.match(surface, /Bạn không đơn độc trong lúc này\./);
    assert.match(surface, /tel:115/);
  }

  // The degraded BFF lane carries the same split — a backend outage cannot
  // collapse the crisis card into the generic fallback.
  assert.match(bff, /SELF_HARM_FALLBACK_PATTERN/);
  assert.match(bff, /likelySelfHarmFallback/);
  assert.match(bff, /routingReason: selfHarm \? "self_harm_crisis"/);
});

test("completed exchange force-scrolls so a tall emergency card lands in view", async () => {
  const patientChat = await readFile(patientChatPath, "utf8");

  // The flag must be re-armed where the exchange is merged — not only before
  // sendMessage, where the pending user bubble consumes it.
  const mergeIndex = patientChat.indexOf("exchange.userMessage, exchange.assistantMessage");
  assert.ok(mergeIndex > 0, "exchange merge site must exist");
  const before = patientChat.slice(0, mergeIndex);
  const lastRearm = before.lastIndexOf("shouldScrollToLatestRef.current = true");
  const lastConsumeGuard = before.lastIndexOf("shouldScrollToLatestRef.current = false");
  assert.ok(lastRearm > -1, "send path must re-arm the scroll flag");
  assert.ok(
    lastRearm > lastConsumeGuard,
    "the re-arm must be the last flag write before the exchange merge",
  );

  // ...but only while the patient is still pinned to the bottom — a
  // deliberate scroll-up during the in-flight wait must keep its position.
  const rearmBlock = before.slice(lastRearm - 300, lastRearm);
  assert.match(
    rearmBlock,
    /isNearBottom\(/,
    "the re-arm must be gated on the viewport still being near the bottom",
  );
});
