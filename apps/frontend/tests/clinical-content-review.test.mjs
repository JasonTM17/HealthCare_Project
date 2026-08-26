import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("clinical review UI keeps admin submit and independent doctor decisions separate", async () => {
  const [admin, doctor, api] = await Promise.all([
    read("app/admin/ai-content-reviews/page.tsx"),
    read("app/doctor/ai-content-reviews/page.tsx"),
    read("lib/api-client.ts"),
  ]);

  assert.match(admin, /submitAiContentRevision/);
  assert.match(admin, /revision/);
  assert.match(admin, /contentHash/);
  assert.match(admin, /không tự approve/);
  assert.match(doctor, /fetchDoctorAiContentReviews/);
  assert.match(doctor, /fetchDoctorAiContentRevision/);
  assert.match(doctor, /decideDoctorAiContentRevision/);
  assert.match(doctor, /REQUEST_CHANGES/);
  assert.match(doctor, /REVOKE/);
  assert.match(doctor, /snapshot/);
  assert.match(doctor, /revision\.diff/);
  assert.match(doctor, /Tải lại revision/);
  assert.match(api, /AI_CONTENT_REVISION_STALE/);
  assert.match(api, /AI_CONTENT_APPROVER_NOT_INDEPENDENT|AI_CONTENT_ALREADY_DECIDED/);
});

test("clinical review API parser is closed over source type, state, hash, and snapshot", async () => {
  const api = await read("lib/api-client.ts");

  assert.match(api, /AI_CONTENT_TYPES = \["SPECIALTY", "ARTICLE", "FAQ"\]/);
  assert.match(api, /AI_CONTENT_REVIEW_STATES = \["DRAFT", "SUBMITTED", "APPROVED", "CHANGES_REQUESTED", "REVOKED", "EXPIRED"\]/);
  assert.match(api, /parseAiContentReviewSummary/);
  assert.match(api, /parseAiContentRevision/);
  assert.match(api, /!isRecord\(value\.snapshot\)/);
  assert.match(api, /method: "PUT"/);
});

test("doctor review queue and snapshot fetch fail closed on stale responses", async () => {
  const [doctor, api] = await Promise.all([
    read("app/doctor/ai-content-reviews/page.tsx"),
    read("lib/api-client.ts"),
  ]);

  assert.match(doctor, /reviewsRequestRef = useRef\(0\)/);
  assert.match(doctor, /revisionRequestRef = useRef\(0\)/);
  assert.match(doctor, /revisionControllerRef\.current\?\.abort\(\)/);
  assert.match(doctor, /requestId !== revisionRequestRef\.current/);
  assert.match(api, /fetchDoctorAiContentRevision[\s\S]*options: \{ signal\?: AbortSignal \} = \{\}/);
});

test("doctor review queue exposes approved history and keeps decision states contract-correct", async () => {
  const doctor = await read("app/doctor/ai-content-reviews/page.tsx");

  assert.match(doctor, /QUEUE_STATES/);
  assert.match(doctor, /"SUBMITTED", "APPROVED"/);
  assert.match(doctor, /fetchDoctorAiContentReviews\(\{ state: requestedState \}\)/);
  assert.match(doctor, /revision\.state === "SUBMITTED"/);
  assert.match(doctor, /revision\.state === "APPROVED"/);
  assert.match(doctor, /decision === "REVOKE"/);
  assert.match(doctor, /availableDecisions/);
  assert.doesNotMatch(doctor, /fetchDoctorAiContentReviews\(\{ state: "SUBMITTED" \}\)/);
});
