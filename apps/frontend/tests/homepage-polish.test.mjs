import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("homepage exposes patient-first navigation and appointment intents", async () => {
  const [page, styles, effects, experience, motion, navbar] = await Promise.all([
    read("app/page.tsx"),
    read("app/styles.css"),
    read("app/effects.css"),
    read("components/CareExperience.tsx"),
    read("components/PublicMotion.tsx"),
    read("components/Navbar.tsx"),
  ]);

  assert.match(page, /className="hero-search"/);
  assert.match(page, /id="hero-search-input"/);
  assert.match(page, /className="hero-assurance"/);
  assert.equal((page.match(/className="hero-actions"/g) ?? []).length, 1);
  assert.equal((page.match(/className="hero-assurance"/g) ?? []).length, 1);
  assert.match(page, /Hỏi trợ lý AI/);
  assert.doesNotMatch(page, /Mô tả triệu chứng/);
  assert.doesNotMatch(page, /className="ai-navigator-fab"/);
  assert.doesNotMatch(page, /TP\. Hồ Chí Minh/);
  assert.match(page, /branchAreaLabel/);
  assert.match(page, /className="care-links"/);
  assert.doesNotMatch(page, /care-link--accent/);
  const navLinksSource = navbar.slice(
    navbar.indexOf("const NAV_LINKS"),
    navbar.indexOf("function getAccountDestination"),
  );
  assert.equal((navLinksSource.match(/label:/g) ?? []).length, 5);
  assert.match(navLinksSource, /href: "\/doctors"/);
  assert.doesNotMatch(navbar, /nav-ai-button/);
  assert.doesNotMatch(navbar, /onOpenAiTriage/);
  assert.match(styles, /\.hero-search\s*\{/);
  assert.match(styles, /\.hero-assurance\s*\{/);
  assert.match(page, /<CareExperience \/>/);
  assert.match(page, /<PublicMotion \/>/);
  assert.match(experience, /className="care-experience"/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(effects, /\.public-scroll-progress/);
  assert.match(effects, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(page, /Hoan My|Hoàn Mỹ/i);
  assert.doesNotMatch(page, />[^<{]*(backend|demo local|Live CMS)[^<{]*</i);
});
