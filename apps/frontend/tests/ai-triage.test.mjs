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
  assert.doesNotMatch(shell, /AiTriageModal/);
  assert.doesNotMatch(home, /AiTriageModal|isAiTriageOpen|handleAiSpecialtySelect/);
});
