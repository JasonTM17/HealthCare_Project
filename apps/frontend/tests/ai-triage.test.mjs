import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("AI triage fails closed for emergency results and announces live answers", async () => {
  const [modal, shell, home] = await Promise.all([
    read("components/AiTriageModal.tsx"),
    read("components/PublicPageShell.tsx"),
    read("app/page.tsx"),
  ]);

  assert.match(modal, /emergencyContact\?/);
  assert.match(modal, /safeTelephoneHref/);
  assert.match(modal, /Validate the source before normalizing/);
  assert.match(modal, /trimmed\.replace/);
  assert.doesNotMatch(modal, /value\?\.trim\(\)\.replace/);
  assert.match(modal, /result\.urgencyLevel !== "EMERGENCY"/);
  assert.match(modal, /role=\{result\.urgencyLevel === "EMERGENCY" \? "alert" : "status"\}/);
  assert.match(modal, /aria-live=\{result\.urgencyLevel === "EMERGENCY" \? "assertive" : "polite"\}/);
  assert.match(modal, /Xem cơ sở gần nhất/);
  assert.match(modal, /analysisRequestRef/);
  assert.match(shell, /emergencyContact=\{emergencyBranch\?\.emergencyHotline\}/);
  assert.match(home, /emergencyContact=\{emergencyBranch\?\.emergencyHotline\}/);
});
