import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../app/page.tsx", import.meta.url);
const cmsEditorPath = new URL("../components/cms/CmsEditor.tsx", import.meta.url);
const imageUploadPath = new URL("../components/ImageUpload.tsx", import.meta.url);
const healthQuestionsPath = new URL("../app/patient/health-questions/page.tsx", import.meta.url);
const profilePath = new URL("../app/patient/profile/page.tsx", import.meta.url);
const communityPath = new URL("../app/patient/community/page.tsx", import.meta.url);
const carePlanPath = new URL("../app/patient/care-plan/page.tsx", import.meta.url);
const dashboardPath = new URL("../app/patient/dashboard/page.tsx", import.meta.url);
const articlePagePath = new URL("../app/articles/[slug]/page.tsx", import.meta.url);
const doctorPagePath = new URL("../app/doctors/[slug]/page.tsx", import.meta.url);
const packagePagePath = new URL("../app/packages/[slug]/page.tsx", import.meta.url);
const specialtyPagePath = new URL("../app/specialties/[slug]/page.tsx", import.meta.url);

test("homepage derives hero quick chips from the live specialty catalog", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /catalog\?\.specialties/);
  assert.match(page, /quickChips/);
  // The legacy hardcoded list survives only as the loading/error fallback.
  assert.match(page, /DEFAULT_QUICK_CHIPS/);
  assert.ok(!page.includes('{["Tim mạch", "Nhi khoa", "Tiêu hóa", "Khám tổng quát"].map((chip)'));
});

test("cms editor never offers the sidebar slot on sidebarless routes", async () => {
  const source = await readFile(cmsEditorPath, "utf8");

  assert.match(source, /CMS_SIDEBARLESS_ROUTE_SLUGS = new Set\(\["about", "careers"\]\)/);
  assert.match(source, /slotOptionsForSlug\(slug\)/);
  // The raw "offer every slot" mapping must not reach the picker anymore.
  assert.ok(!source.includes("{CMS_SLOT_KEYS.map((slotKey) => <option"));
});

test("image upload client gate mirrors the 5 MB backend default", async () => {
  const source = await readFile(imageUploadPath, "utf8");

  assert.match(source, /MAX_UPLOAD_BYTES = 5 \* 1024 \* 1024/);
  assert.ok(!source.includes("10 * 1024 * 1024"));
  assert.ok(!source.includes("10 MB"));
});

test("health-questions form uses a localized topic select and a live alias check", async () => {
  const source = await readFile(healthQuestionsPath, "utf8");

  assert.match(source, /<select id="health-question-topic"/);
  assert.match(source, /TOPIC_OPTIONS/);
  assert.match(source, /topicLabel\(item\.topicSlug\)/);
  // The alias rule is enforced in create(), not by the dead pattern attribute.
  assert.match(source, /PUBLIC_ALIAS_PATTERN\.test\(alias\)/);
  assert.ok(!source.includes('pattern="[A-Za-z0-9]'));
  // Raw internal moderation wording must not reach the patient.
  assert.ok(!source.includes("Chờ admin lọc"));
});

test("profile credit meter reads the real ai-credits status endpoint", async () => {
  const source = await readFile(profilePath, "utf8");

  assert.match(source, /fetchPatientAiCreditStatus/);
  assert.match(source, /creditStatus\?\.credits/);
  assert.match(source, /creditStatus\?\.maxCredits/);
  assert.match(source, /creditStatus\?\.tier/);
});

test("community page stops fabricating metadata and offers the real question flow", async () => {
  const source = await readFile(communityPath, "utf8");

  assert.ok(!source.includes("Bác sĩ Bệnh viện"));
  assert.ok(!source.includes("readingMinutes || 5"));
  assert.match(source, /"Đang cập nhật"/);
  assert.match(source, /href="\/patient\/health-questions"/);
  assert.match(source, /isCancelled/);
});

test("care-plan dates render in the business timezone", async () => {
  const source = await readFile(carePlanPath, "utf8");

  assert.match(source, /import \{ formatBusinessDate \} from "\.\.\/\.\.\/\.\.\/lib\/business-time"/);
  assert.ok(!source.includes('toLocaleDateString("vi-VN"'));
});

test("dashboard labels AI balance in Vietnamese", async () => {
  const source = await readFile(dashboardPath, "utf8");

  assert.match(source, /lượt trợ lý AI/);
  assert.ok(!source.includes("AI Credits"));
});

test("public detail pages emit JSON-LD from the configured site origin", async () => {
  for (const path of [articlePagePath, doctorPagePath, packagePagePath, specialtyPagePath]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /safeSiteOrigin/);
    assert.ok(!source.includes("https://www.healthcare.id.vn"));
  }
});

test("article byline avatar initials come from the author name", async () => {
  const source = await readFile(articlePagePath, "utf8");

  assert.match(source, /function authorInitials\(name\?: string \| null\)/);
  assert.match(source, /\{authorInitials\(article\.authorName\)\}/);
  assert.ok(!source.includes("<span>BS</span>"));
});

test("operational kickers render in Vietnamese", async () => {
  const expectations = [
    ["../app/doctor/care-plans/page.tsx", ["FOLLOW-UP CARE"]],
    ["../app/patient/care-plan/page.tsx", ["FOLLOW-UP CARE"]],
    ["../app/doctor/health-questions/page.tsx", ["PATIENT Q&amp;A", "PATIENT Q&A"]],
    ["../app/doctor/ai-content-reviews/page.tsx", ["CLINICAL REVIEW"]],
    ["../app/admin/consultations/page.tsx", ["CONSULTATION OPERATIONS", "METADATA-ONLY", "QUEUE FILTERS"]],
    ["../app/admin/ai-content-reviews/page.tsx", ["CLINICAL CONTENT GOVERNANCE", "INVENTORY FILTERS", "SUBMIT EXACT REVISION"]],
  ];

  for (const [relativePath, banned] of expectations) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    for (const text of banned) {
      assert.ok(!source.includes(text), `${relativePath} still contains "${text}"`);
    }
  }
});
