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
  assert.doesNotMatch(page, /AiTriageModal|handleAiSpecialtySelect/);
  assert.match(page, /hideWhenNotFound/);
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
  assert.doesNotMatch(page, /AiTriageModal|handleAiSpecialtySelect/);
  assert.match(page, /hideWhenNotFound/);
});
