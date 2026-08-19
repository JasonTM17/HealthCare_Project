import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("public chrome and browser icon reuse the original shield-heart brand mark", async () => {
  const [mark, navbar, footer, icon] = await Promise.all([
    read("components/BrandMark.tsx"),
    read("components/Navbar.tsx"),
    read("components/Footer.tsx"),
    read("app/icon.svg"),
  ]);

  assert.match(mark, /viewBox="0 0 64 64"/);
  assert.match(mark, /brand-emblem__shield/);
  assert.match(mark, /brand-emblem__heart/);
  assert.match(mark, /brand-emblem__pulse/);
  assert.match(navbar, /<BrandMark \/>/);
  assert.match(footer, /<BrandMark tone="inverse" \/>/);
  assert.doesNotMatch(navbar, /name="plus"/);
  assert.doesNotMatch(footer, /name="plus"/);
  assert.match(icon, /viewBox="0 0 64 64"/);
  assert.match(icon, /stroke="#075f5e"/);
});

test("brand intro runs once per session before paint and respects reduced motion", async () => {
  const [layout, splash, styles] = await Promise.all([
    read("app/layout.tsx"),
    read("components/BrandSplash.tsx"),
    read("app/brand-experience.css"),
  ]);

  assert.match(layout, /window\.sessionStorage\.getItem\(key\)/);
  assert.match(layout, /healthcare-brand-intro-v1/);
  assert.match(layout, /root\.dataset\.brandIntro = seen \? "seen" : "pending"/);
  assert.match(layout, /<head><script dangerouslySetInnerHTML=/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(splash, /FULL_INTRO_MS = 1080/);
  assert.match(splash, /prefers-reduced-motion: reduce/);
  assert.match(splash, /role="status"/);
  assert.match(styles, /html\[data-brand-intro="pending"\] \.brand-splash/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("footer uses readable inverse identity, landmark navigation and responsive contact card", async () => {
  const [footer, styles] = await Promise.all([
    read("components/Footer.tsx"),
    read("app/brand-experience.css"),
  ]);

  assert.match(footer, /aria-label="Khám phá HealthCare"/);
  assert.match(footer, /aria-label="Hỗ trợ người bệnh"/);
  assert.match(footer, /className="footer-contact__eyebrow"/);
  assert.match(footer, /className="footer-assurances"/);
  assert.match(styles, /\.site-shell \.site-footer \{/);
  assert.match(styles, /background: #082f3c/);
  assert.match(styles, /\.brand-link--footer \.brand-copy strong/);
  assert.match(styles, /color: #ffffff/);
  assert.match(styles, /@media \(max-width: 640px\)/);
});
