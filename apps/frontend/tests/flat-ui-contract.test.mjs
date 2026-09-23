import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const BULKY_ROUNDED_SURFACES = [
  "components/AiTriageModal.tsx",
  "components/BookingModal.tsx",
  "components/cms/CmsEditor.tsx",
  "components/cms/CmsLiveSlot.tsx",
  "components/PortalChrome.tsx",
  "app/admin/ai-content-reviews/page.tsx",
  "app/admin/ai-credits/page.tsx",
  "app/admin/consultations/page.tsx",
  "app/admin/catalog/page.tsx",
  "app/admin/health-questions/page.tsx",
  "app/admin/schedules/page.tsx",
  "app/doctor/ai-content-reviews/page.tsx",
  "app/doctor/articles/page.tsx",
  "app/patient/community/page.tsx",
  "app/patient/chat/page.tsx",
  "app/patient/profile/page.tsx",
];

const TRUE_CIRCLE_SURFACES = [
  "components/AiTriageModal.tsx",
  "components/BookingModal.tsx",
  "components/cms/CmsEditor.tsx",
  "components/cms/CmsLiveSlot.tsx",
  "components/PortalChrome.tsx",
];

const CSS_SURFACES = [
  "app/styles.css",
  "app/catalog-directory.css",
  "app/about/about.module.css",
  "components/FloatingHealthAssistant.module.css",
  "components/PackageVisuals.module.css",
];

test("flat clinical UI tokens clamp structural surfaces and controls", async () => {
  const [styles, directoryStyles, tailwind, about] = await Promise.all([
    read("app/styles.css"),
    read("app/catalog-directory.css"),
    read("tailwind.config.ts"),
    read("app/about/about.module.css"),
  ]);

  assert.match(styles, /--radius-xs:\s*0\.125rem;/);
  assert.match(styles, /--radius-sm:\s*0\.25rem;/);
  assert.match(styles, /--radius-md:\s*0\.25rem;/);
  assert.match(styles, /--radius-lg:\s*0\.125rem;/);
  assert.match(styles, /--radius-xl:\s*0\.125rem;/);
  assert.match(styles, /\.site-shell :is\(\.rounded-lg, \.rounded-xl, \.rounded-2xl, \.rounded-3xl\),[\s\S]*?border-radius: var\(--radius-lg\) !important/);
  assert.match(directoryStyles, /\.site-shell :is\(\.rounded-lg, \.rounded-xl, \.rounded-2xl, \.rounded-3xl\),[\s\S]*?border-radius: var\(--radius-lg\) !important/);
  assert.doesNotMatch(styles, /booking-panel[\s\S]{0,180}rounded-full/);
  assert.doesNotMatch(styles, /ai-triage-panel[\s\S]{0,180}rounded-full/);
  assert.doesNotMatch(directoryStyles, /booking-panel[\s\S]{0,180}rounded-full/);
  assert.doesNotMatch(directoryStyles, /ai-triage-panel[\s\S]{0,180}rounded-full/);
  assert.match(tailwind, /lg:\s*"0\.125rem"/);
  assert.match(tailwind, /xl:\s*"0\.125rem"/);
  assert.match(tailwind, /"2xl":\s*"0\.125rem"/);
  assert.match(tailwind, /"3xl":\s*"0\.125rem"/);
  assert.match(about, /\.videoLabel \{[\s\S]*?background: rgb\(255 255 255 \/ 92%\);/);
  assert.match(about, /\.videoLabel \{[\s\S]*?border-radius: var\(--radius-sm\);/);
  assert.match(about, /\.videoControl \{[\s\S]*?min-height: 2\.75rem;/);
  assert.doesNotMatch(about, /background:\s*rgb\(8 49 62 \/ 84%\)/);
});

test("targeted admin, CMS, booking, portal, and chatbot surfaces avoid bulky rounded utilities", async () => {
  for (const path of BULKY_ROUNDED_SURFACES) {
    const source = await read(path);
    assert.doesNotMatch(source, /\brounded-(?:xl|2xl|3xl)\b/, `${path} still uses a bulky rounded utility`);
  }
});

test("remaining rounded-full utilities are limited to true circular affordances", async () => {
  for (const path of TRUE_CIRCLE_SURFACES) {
    const source = await read(path);
    const lines = source.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (!line.includes("rounded-full")) continue;
      assert.match(
        line,
        /(?:h-(?:2|5|11|14|16)|h-\[[^\]]+\]).*(?:w-(?:2|5|11|14|16)|w-\[[^\]]+\])|(?:w-(?:2|5|11|14|16)|w-\[[^\]]+\]).*(?:h-(?:2|5|11|14|16)|h-\[[^\]]+\])/,
        `${path}:${index + 1} uses rounded-full outside an explicitly sized circle`,
      );
    }
  }
});

test("targeted CSS avoids direct border radii above the 4px control limit", async () => {
  for (const path of CSS_SURFACES) {
    const css = await read(path);
    for (const match of css.matchAll(/border-radius:\s*([^;]+);/g)) {
      const value = match[1].trim();
      if (value === "0" || value.includes("var(--radius")) continue;
      const tooLarge = [...value.matchAll(/([0-9]*\.?[0-9]+)(px|rem)/g)].some((part) => {
        const amount = Number(part[1]);
        const unit = part[2];
        return unit === "px" ? amount > 4 : amount * 16 > 4;
      });
      assert.equal(tooLarge, false, `${path} has non-token border-radius above 4px: ${value}`);
    }
  }
});

test("delight layer stays flat, tokened and reduced-motion safe", async () => {
  const styles = await read("app/styles.css");
  assert.match(styles, /--fx-lift: -3px;/);
  assert.match(styles, /--fx-press-scale: 0\.97;/);
  assert.match(
    styles,
    /\(prefers-reduced-motion: no-preference\)[\s\S]*?fx-confetti-burst/,
    "celebration motion must be gated behind no-preference",
  );
  assert.match(
    styles,
    /\(prefers-reduced-motion: reduce\)[\s\S]*?\.fx-confetti \{\s*display: none/,
    "confetti must vanish entirely under reduced motion",
  );
  assert.match(
    styles,
    /\(prefers-reduced-motion: no-preference\)[\s\S]*?fx-orb-drift/,
    "hero orbs must be motion-gated",
  );
  assert.doesNotMatch(styles, /fx-gradient/);
});

// B6 P1: every display date/time must render through lib/business-time or
// lib/datetime (both pinned to Asia/Ho_Chi_Minh). A raw
// toLocaleDateString("vi-VN", …)/toLocaleString("vi-VN", …) call formats in
// the viewer's host time zone, which is exactly the drift B6 removed.
// Number.toLocaleString("vi-VN") is a legitimate, separate use of the locale,
// so each numeric call site is allowlisted by its receiver — not by file —
// and any new date formatting in those files still fails the gate.
const VI_VN_LOCALE_CALL = /toLocale(?:Date)?String\(\s*(?:"vi-VN"|'vi-VN'|`vi-VN`)/;
const VI_VN_DISPLAY_ALLOWLIST = [
  { file: "app/admin/page.tsx", receiver: "count.toLocaleString(\"vi-VN\")", reason: "numeric snapshot counter, not a date" },
  { file: "app/admin/appointments/page.tsx", receiver: "total.toLocaleString(\"vi-VN\")", reason: "numeric counter, not a date" },
  { file: "app/admin/careers/page.tsx", receiver: "total.toLocaleString(\"vi-VN\")", reason: "numeric counter, not a date" },
  { file: "app/admin/catalog/page.tsx", receiver: "item.price.toLocaleString(\"vi-VN\")", reason: "numeric price, not a date" },
  { file: "app/admin/catalog/page.tsx", receiver: "(item.price).toLocaleString(\"vi-VN\")", reason: "numeric price, not a date" },
  { file: "app/admin/payments/page.tsx", receiver: "total.toLocaleString(\"vi-VN\")", reason: "numeric counter, not a date" },
  { file: "app/doctor/articles/page.tsx", receiver: "ARTICLE_BODY_MAX_CHARS.toLocaleString(\"vi-VN\")", reason: "numeric char limit, not a date" },
  { file: "app/doctor/articles/page.tsx", receiver: "storedBody.length.toLocaleString(\"vi-VN\")", reason: "numeric char count, not a date" },
  { file: "app/patient/chat/page.tsx", receiver: "draft.length.toLocaleString(\"vi-VN\")", reason: "numeric char count, not a date" },
  {
    file: "app/patient/care-plan/page.tsx",
    receiver: "date.toLocaleDateString(\"vi-VN\", { dateStyle: \"medium\" })",
    reason: "OUT OF SCOPE for the B6 P1 nine-page batch: still a host-zone date site, needs the same formatDate migration in a follow-up",
  },
];

function appAndComponentSources(dir) {
  return readdirSync(new URL(`../${dir}/`, import.meta.url), { recursive: true, encoding: "utf8" })
    .map((entry) => entry.replace(/\\/g, "/"))
    .filter((entry) => /\.(?:tsx|ts|jsx|js|mjs)$/.test(entry))
    .map((entry) => `${dir}/${entry}`);
}

test("display date formatting goes through lib/business-time or lib/datetime", async () => {
  const files = [...appAndComponentSources("app"), ...appAndComponentSources("components")];
  assert.ok(files.length > 50, "the gate must actually enumerate the app/component tree");
  const violations = [];
  for (const file of files) {
    const source = await read(file);
    const lines = source.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (!VI_VN_LOCALE_CALL.test(line)) continue;
      const allowed = VI_VN_DISPLAY_ALLOWLIST.some(
        (entry) => entry.file === file && line.includes(entry.receiver),
      );
      if (!allowed) violations.push(`${file}:${index + 1}: ${line.trim().slice(0, 120)}`);
    }
  }
  assert.deepEqual(
    violations,
    [],
    `vi-VN date/time formatting must go through lib/datetime or lib/business-time:\n${violations.join("\n")}`,
  );
});

test("vi-VN allowlist entries stay narrow and used", async () => {
  for (const entry of VI_VN_DISPLAY_ALLOWLIST) {
    const source = await read(entry.file);
    assert.ok(
      source.includes(entry.receiver),
      `stale allowlist entry: ${entry.file} no longer contains ${entry.receiver} — remove the entry`,
    );
  }
});
