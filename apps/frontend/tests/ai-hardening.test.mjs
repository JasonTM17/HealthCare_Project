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
  const [apiClient, legacyApi, aiModal, types] = await Promise.all([
    read("lib/api-client.ts"),
    read("lib/api.ts"),
    read("components/AiTriageModal.tsx"),
    read("types/hospital.ts"),
  ]);

  assert.match(apiClient, /export async function recommendPublicSpecialty/);
  assert.match(apiClient, /getAuthenticatedJson<SpecialtyRecommendationResponse>/);
  assert.match(apiClient, /\/public\/specialty-recommendation/);
  assert.match(apiClient, /JSON\.stringify\(\{ symptoms: normalized \}\)/);
  assert.match(apiClient, /recommended_specialty/);
  assert.match(apiClient, /urgency_level/);
  assert.match(apiClient, /clinical_advice/);
  assert.match(apiClient, /suggested_questions/);
  assert.match(aiModal, /recommendPublicSpecialty/);
  // The public recommendation endpoint never requires auth, so the modal must
  // not show login copy for a 401; a proxy failure surfaces as a 403-style
  // "unavailable" message instead.
  assert.doesNotMatch(aiModal, /Vui lòng đăng nhập/);
  assert.match(aiModal, /Chưa thể sử dụng tính năng này/);
  assert.match(aiModal, /Tạm thời chưa thể xử lý/);
  assert.match(aiModal, /citations/);
  assert.match(apiClient, /AI_CITATION_SOURCE_TYPES/);
  assert.match(apiClient, /AI_CITATION_ID_PATTERN/);
  assert.match(apiClient, /keys\.length === 3/);
  assert.match(aiModal, /citation\.source_type/);
  assert.match(aiModal, /citation\.source_id/);
  assert.doesNotMatch(types, /AiTriageCitation = string \| Record/);
  assert.doesNotMatch(aiModal, /citation\.url/);
  assert.doesNotMatch(aiModal, /target="_blank"/);
  assert.match(apiClient, /provenance/);
  assert.match(aiModal, /disclaimer/);
  assert.doesNotMatch(aiModal, /performAiTriage/);
  assert.doesNotMatch(legacyApi, /performAiTriage/);
  assert.doesNotMatch(apiClient, /URLSearchParams\([^)]*symptoms/);
  assert.doesNotMatch(aiModal, /console\.(?:log|error|warn)\([^)]*symptoms/);
});

/**
 * Doctor AI credits were decided out of the product: the backend removed the
 * doctor deduction path, refuses a `DOCTOR` grant with HTTP 400, and no longer
 * serves `GET /admin/ai-credits/doctors`. The admin screen therefore carries no
 * clinical credit surface at all — not even a decorative read-only table — and
 * must not fetch the retired route: while it did, the deleted route answered
 * non-2xx inside the same `Promise.all`, so the whole page (patient balances
 * and patient granting included) failed to load.
 */
test("no admin surface claims a spendable per-doctor AI quota", async () => {
  const [dashboard, adminCredits, apiClient] = await Promise.all([
    read("app/doctor/dashboard/page.tsx"),
    read("app/admin/ai-credits/page.tsx"),
    read("lib/api-client.ts"),
  ]);

  // No doctor-facing credit chip survived, in either of its two states.
  assert.doesNotMatch(dashboard, /lượt AI khả dụng/);
  assert.doesNotMatch(dashboard, /Hạn mức AI đang cập nhật/);
  assert.doesNotMatch(dashboard, /\.aiCredits/);

  // The retired route is gone from the client layer, not merely unused: no
  // fetch helper, no payload type, and no literal path that a renamed helper
  // could be pointed back at. The write contract narrows with the read
  // contract, so `DOCTOR` is no longer a value the client can even express.
  assert.doesNotMatch(apiClient, /adminListDoctorAiCredits|DoctorCreditDto/);
  assert.doesNotMatch(apiClient, /\/admin\/ai-credits\/doctors/);
  assert.doesNotMatch(apiClient, /targetRole: "PATIENT" \| "DOCTOR"/);
  assert.match(apiClient, /adminGrantAiCredits\(payload: \{\s*userId: string;\s*targetRole: "PATIENT";/);

  // The screen holds no clinical credit state, tab, stat card or table — the
  // read-only balance table that used to satisfy this spot is part of the
  // retired surface, so its labels are asserted absent rather than relabelled.
  assert.doesNotMatch(adminCredits, /adminListDoctorAiCredits|DoctorCreditDto|totalDoctorCredits/);
  assert.doesNotMatch(adminCredits, /doctors\./);
  assert.doesNotMatch(adminCredits, /activeTab/);
  assert.doesNotMatch(adminCredits, /targetRole: "DOCTOR"/);
  assert.doesNotMatch(adminCredits, /\+ Cấp thêm lượt AI/);
  assert.doesNotMatch(adminCredits, /Credits Lâm sàng|Chỉ đọc · không còn cấp phát/);

  // Load isolation is the actual bug fix: exactly one AI credit listing is
  // requested, so no clinical request can fail the patient table again.
  assert.deepEqual(
    adminCredits.match(/adminList\w*AiCredits\(\)/g) ?? [],
    ["adminListPatientAiCredits()"],
    "the credits page must fetch the patient listing and nothing else",
  );

  // An admin who remembers the tab still learns why it is gone, in Vietnamese,
  // and a rejected grant still surfaces the backend's own reason.
  assert.match(adminCredits, /role="note"/);
  assert.match(adminCredits, /không còn định mức theo từng bác sĩ/);
  assert.match(adminCredits, /preferServerMessage: true/);

  // Patient granting and listing stay real, reachable actions.
  assert.match(adminCredits, /adminListPatientAiCredits/);
  assert.match(adminCredits, /targetRole: "PATIENT"/);
  assert.match(adminCredits, /adminGrantAiCredits/);
  assert.match(adminCredits, /\+ Cấp thêm/);
  assert.match(adminCredits, /adminUpdatePatientTier/);
});
