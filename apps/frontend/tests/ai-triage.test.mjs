import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("AI triage fails closed for emergency and unresolved specialty results", async () => {
  const [shell, home, assistant, phone] = await Promise.all([
    read("components/PublicPageShell.tsx"),
    read("app/page.tsx"),
    read("components/FloatingHealthAssistant.tsx"),
    read("lib/phone.ts"),
  ]);

  assert.match(phone, /Never normalize an arbitrary URI-like value/);
  assert.match(phone, /trimmed\.replace/);
  assert.match(shell, /requestPublicAssistantOpen/);
  assert.match(shell, /detail: \{ mode: "SYMPTOM_TRIAGE" \}/);
  assert.match(assistant, /PUBLIC_ASSISTANT_OPEN_EVENT/);
  assert.match(assistant, /handleModeChangeRef/);
  assert.match(shell, /AiTriageModal/);
  assert.match(home, /AiTriageModal/);
  assert.match(home, /isAiTriageOpen/);
  assert.match(home, /handleAiSpecialtySelect/);
});

test("AI triage error states always show the 115 emergency line", async () => {
  const modal = await read("components/AiTriageModal.tsx");
  const emergencyLine = "Trường hợp khẩn cấp, vui lòng gọi 115 hoặc đến cơ sở y tế gần nhất.";

  const occurrences = modal.split(emergencyLine).length - 1;
  assert.equal(occurrences, 1, "the static emergency sentence must appear exactly once");

  // It must live inside the error alert block (rendered for every
  // TriageErrorKind) and before the results panel — so PII-blocked, network
  // failure and server error states all carry the 115 guidance.
  const errorBlockStart = modal.indexOf("errorCopy ? (");
  const resultsBlockStart = modal.indexOf("{result ? (");
  const emergencyIndex = modal.indexOf(emergencyLine);
  assert.ok(errorBlockStart >= 0, "error alert block exists");
  assert.ok(resultsBlockStart > errorBlockStart, "results block follows error block");
  assert.ok(
    emergencyIndex > errorBlockStart && emergencyIndex < resultsBlockStart,
    "emergency line must render inside the error alert, not only with results",
  );
});
