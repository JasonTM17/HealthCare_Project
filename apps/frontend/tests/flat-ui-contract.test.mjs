import assert from "node:assert/strict";
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
