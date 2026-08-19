import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("booking and AI dialogs use generated brand tokens with visible focus", async () => {
  const [tailwind, bookingModal, aiModal] = await Promise.all([
    read("tailwind.config.ts"),
    read("components/BookingModal.tsx"),
    read("components/AiTriageModal.tsx"),
  ]);
  const usedShades = new Set(
    [...`${bookingModal}\n${aiModal}`.matchAll(/(?:bg|from|via|to|text|border|ring|outline)-brand-(\d+)/g)].map(
      ([, shade]) => shade,
    ),
  );

  for (const shade of usedShades) {
    assert.match(tailwind, new RegExp(`\\b${shade}:`), `missing brand-${shade} token`);
  }
  assert.match(bookingModal, /focus-visible:ring-2/);
  assert.match(bookingModal, /focus-visible:outline-brand-300/);
  assert.match(aiModal, /focus-visible:ring-2/);
  assert.match(aiModal, /focus-visible:outline-brand-300/);
});

test("AI triage uses the authenticated backend contract without a local answer", async () => {
  const [apiClient, legacyApi, aiModal] = await Promise.all([
    read("lib/api-client.ts"),
    read("lib/api.ts"),
    read("components/AiTriageModal.tsx"),
  ]);

  assert.match(apiClient, /export async function recommendSpecialty/);
  assert.match(apiClient, /getAuthenticatedJson<SpecialtyRecommendationResponse>/);
  assert.match(apiClient, /\/ai\/specialty-recommendation/);
  assert.match(apiClient, /JSON\.stringify\(\{ symptoms: normalized \}\)/);
  assert.match(apiClient, /recommended_specialty/);
  assert.match(apiClient, /urgency_level/);
  assert.match(apiClient, /clinical_advice/);
  assert.match(apiClient, /suggested_questions/);
  assert.match(aiModal, /recommendSpecialty/);
  assert.match(aiModal, /Vui lòng đăng nhập/);
  assert.match(aiModal, /Chưa thể sử dụng tính năng này/);
  assert.match(aiModal, /Tạm thời chưa thể xử lý/);
  assert.match(aiModal, /citations/);
  assert.match(apiClient, /provenance/);
  assert.match(aiModal, /disclaimer/);
  assert.doesNotMatch(aiModal, /performAiTriage/);
  assert.doesNotMatch(legacyApi, /performAiTriage/);
  assert.doesNotMatch(apiClient, /URLSearchParams\([^)]*symptoms/);
  assert.doesNotMatch(aiModal, /console\.(?:log|error|warn)\([^)]*symptoms/);
});
