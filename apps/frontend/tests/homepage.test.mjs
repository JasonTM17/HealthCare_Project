import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../app/page.tsx", import.meta.url);

test("appointment calls to action expose the available branch route", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /id="branches"/);
  assert.match(page, /href="\/branches"/);
});

test("homepage hero fallback attribution matches the stock image source", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /\/media\/about-care-poster\.jpg/);
  assert.doesNotMatch(page, /pexels\.com\/photos\/4266936/);
  assert.doesNotMatch(page, /Ảnh minh họa từ Pexels\./);
});

test("homepage mounts the published CMS hero slot for realtime updates", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /import \{ CmsLiveSlot \} from "\.\.\/components\/cms"/);
  assert.match(page, /id="cms-live"/);
  assert.match(page, /className="hero-inner"/);
  assert.match(page, /fallback=\{<HomeHeroComposition/);
  assert.match(page, /renderContent=\{\(content: CmsContent\)/);
  assert.match(page, /slotKey="hero"/);
  for (const slot of ["body", "sidebar"]) {
    assert.match(page, new RegExp(`slotKey="${slot}"`));
  }
  assert.match(page, /<Footer branches=\{branches\} cmsSlug="home" \/>/);
  assert.match(page, /<main id="main-content" tabIndex=\{-1\}>/);
  assert.match(page, /AiTriageModal/);
  assert.match(page, /handleAiSpecialtySelect/);
  assert.match(page, /hideWhenNotFound/);
});

test("published CMS hero payload wins over the hand-set fallback", async () => {
  const page = await readFile(pagePath, "utf8");

  // CmsLiveSlot only hands PUBLISHED rows to renderContent, so admin copy must
  // always win. The old hardcoded vetoes silently discarded published values
  // that happened to match seed text or the /dat-lich CTA — the "admin edits
  // don't show" bug. They must stay gone.
  assert.ok(!page.includes("DEFAULT_HERO_TITLE"));
  assert.ok(!page.includes('cmsCta.href !== "/dat-lich"'));
  // Published values take precedence via nullish fallback, not string vetoes.
  assert.match(page, /activeCmsHero\?\.title \?\?/);
  assert.match(page, /activeCmsHero\?\.body \?\?/);
  // The single remaining guard only hides payloads that are themselves
  // placeholder fixtures (live-compose/demo/test seeded or E2E rows).
  assert.ok(page.includes("!isPlaceholderCmsHeroPayload(cmsHero)"));
  assert.ok(page.includes("/(?:Live Compose|Live CMS|demo|test)/i"));
  assert.ok(page.includes('<span className="hero-teal-accent">gia đình</span>'));
});
