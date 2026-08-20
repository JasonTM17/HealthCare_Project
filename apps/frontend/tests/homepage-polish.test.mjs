import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("homepage exposes patient-first navigation and appointment intents", async () => {
  const [page, styles, effects, experience, motion] = await Promise.all([
    read("app/page.tsx"),
    read("app/styles.css"),
    read("app/effects.css"),
    read("components/CareExperience.tsx"),
    read("components/PublicMotion.tsx"),
  ]);

  assert.match(page, /className="hero-search"/);
  assert.match(page, /id="hero-search-input"/);
  assert.match(page, /className="hero-trust"/);
  assert.equal((page.match(/className="hero-actions"/g) ?? []).length, 1);
  assert.equal((page.match(/className="hero-trust"/g) ?? []).length, 1);
  const aiCareRail = page.slice(
    page.indexOf('<strong>Trợ lý triệu chứng</strong>') - 240,
    page.indexOf('<strong>Trợ lý triệu chứng</strong>') + 240,
  );
  assert.match(aiCareRail, /care-link--accent/);
  assert.match(aiCareRail, /setIsAiTriageOpen\(true\)/);
  assert.doesNotMatch(aiCareRail, /href="\/doctors"/);
  assert.match(page, /href="\/doctors"/);
  assert.match(page, /className="care-links"/);
  assert.match(page, /className="ai-navigator-fab"/);
  assert.match(styles, /\.hero-search\s*\{/);
  assert.match(styles, /\.hero-trust\s*\{/);
  assert.match(styles, /\.ai-navigator-fab\s*\{/);
  assert.match(styles, /\.ai-navigator-fab\s*\{[\s\S]*?display: none;/);
  assert.match(page, /<CareExperience \/>/);
  assert.match(page, /<PublicMotion \/>/);
  assert.match(experience, /className="care-experience"/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(effects, /\.public-scroll-progress/);
  assert.match(effects, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(page, /Hoan My|Hoàn Mỹ/i);
  assert.doesNotMatch(page, />[^<{]*(backend|demo local|Live CMS)[^<{]*</i);
});
